#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../src/logger/index.js';
import { FileManager, FileType } from '../src/utils/file-manager.js';
import { SeedManager } from '../src/utils/seed-manager.js';
import * as bip39 from 'bip39';
import { randomBytes, createHash } from 'crypto';
import chalk from 'chalk';

const logger = createLogger('setup-agent');

program
  .name('setup-agent')
  .description('Set up a new agent with a seed file')
  .requiredOption('-a, --agent-id <id>', 'Agent ID (e.g., agent-123)')
  .option('-s, --seed <seed>', 'Wallet seed (if not provided, will be generated)')
  .option('-f, --force', 'Overwrite existing seed file if it exists')
  .option('-w, --words <number>', 'number of words in mnemonic (12 or 24)', '24')
  .option('-p, --password <string>', 'optional password for additional security', '')
  .option('-d, --dir <path>', 'Consumer project root directory (default: current directory)', '.')
  .parse(process.argv);

const options = program.opts();

async function generateSeed(wordCount: number = 24, password: string = ''): Promise<{ seed: string; mnemonic: string; derivedSeed?: string }> {
  // Validate word count
  if (wordCount !== 12 && wordCount !== 24) {
    throw new Error('Word count must be either 12 or 24');
  }

  // Generate strength based on word count (128 bits for 12 words, 256 bits for 24 words)
  const strength = wordCount === 12 ? 128 : 256;

  // Generate random entropy
  const entropyBytes = strength / 8;
  const entropy = randomBytes(entropyBytes);

  // Generate mnemonic from entropy
  const mnemonic = bip39.entropyToMnemonic(entropy);

  // For Midnight, we use the entropy as the seed
  const seed = entropy.toString('hex');

  // If password is provided, derive a seed from the mnemonic
  let derivedSeed: string | undefined;
  if (password) {
    const seedBuffer = bip39.mnemonicToSeedSync(mnemonic, password);
    derivedSeed = seedBuffer.toString('hex');
  }

  return {
    seed,
    mnemonic,
    derivedSeed
  };
}

async function verifySeed(seed: string, password: string = ''): Promise<{ isValid: boolean; mnemonic: string; derivedSeed?: string }> {
  // Validate seed length
  if (seed.length !== 64) {
    throw new Error('Seed must be exactly 32 bytes (64 hex characters)');
  }

  // Generate mnemonic from the seed (treating it as entropy)
  const seedAsEntropy = Buffer.from(seed, 'hex');
  const mnemonic = bip39.entropyToMnemonic(seedAsEntropy);

  // If password is provided, derive a seed from the mnemonic
  let derivedSeed: string | undefined;
  if (password) {
    const seedBuffer = bip39.mnemonicToSeedSync(mnemonic, password);
    derivedSeed = seedBuffer.toString('hex');
  }

  return {
    isValid: true, // If we got here, the seed is valid
    mnemonic,
    derivedSeed
  };
}

async function createFolderStructure(baseDir: string): Promise<void> {
  const fileManager = FileManager.getInstance({ baseDir });
  
  // Create all required directories
  const directories = [
    fileManager.getPath(FileType.SEED, ''),
    fileManager.getPath(FileType.WALLET_BACKUP, ''),
    fileManager.getPath(FileType.LOG, ''),
    fileManager.getPath(FileType.TRANSACTION_DB, '')
  ];

  for (const dir of directories) {
    try {
      fileManager.ensureDirectoryExists(dir);
      logger.info(`Created directory: ${dir}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
      throw error;
    }
  }
}

async function main() {
  try {
    const projectRoot = path.resolve(options.dir);
    const storageDir = path.join(projectRoot, '.storage');

    // Check if project root exists
    if (!fs.existsSync(projectRoot)) {
      throw new Error(`Project root directory not found: ${projectRoot}`);
    }

    // Check if .storage directory exists
    if (!fs.existsSync(storageDir)) {
      console.log(chalk.yellow(`\n.storage directory not found in ${projectRoot}. Creating folder structure...`));
      await createFolderStructure(storageDir);
      console.log(chalk.green('Folder structure created successfully!'));
    } else {
      console.log(chalk.green(`\n.storage directory found at ${storageDir}`));
    }

    const agentId = options.agentId;
    const force = options.force;
    const wordCount = parseInt(options.words);
    const password = options.password;

    // Validate agent ID format
    if (!/^[a-zA-Z0-9-]+$/.test(agentId)) {
      throw new Error('Agent ID can only contain letters, numbers, and hyphens');
    }

    // Initialize SeedManager with the correct storage path
    SeedManager.initialize(storageDir);

    // Check if seed file already exists
    if (SeedManager.hasAgentSeed(agentId) && !force) {
      throw new Error(`Seed file already exists for agent ${agentId}. Use --force to overwrite.`);
    }

    let finalSeed = options.seed;
    let mnemonic: string | undefined;
    let derivedSeed: string | undefined;

    if (!finalSeed) {
      // Generate new seed
      const generated = await generateSeed(wordCount, password);
      finalSeed = generated.seed;
      mnemonic = generated.mnemonic;
      derivedSeed = generated.derivedSeed;
      logger.info('Generated new seed');
    } else {
      // Verify provided seed
      const verified = await verifySeed(finalSeed, password);
      mnemonic = verified.mnemonic;
      derivedSeed = verified.derivedSeed;
      logger.info('Verified provided seed');
    }

    // Initialize the seed
    await SeedManager.initializeAgentSeed(agentId, finalSeed);
    logger.info(`Seed file created for agent ${agentId}`);

    // Display success message with instructions
    console.log('\nAgent setup completed successfully!');
    
    if (mnemonic) {
      console.log('\n=== Generated Wallet Information ===');
      console.log(chalk.yellow('Midnight Seed (hex):'));
      console.log(chalk.white(finalSeed));
      console.log('\n' + chalk.yellow('BIP39 Mnemonic:'));
      console.log(chalk.white(mnemonic));
      
      if (derivedSeed) {
        console.log('\n' + chalk.yellow('Derived Seed (with password):'));
        console.log(chalk.white(derivedSeed));
      }
      
      console.log('\n' + chalk.cyan('Important Note for Midnight Wallet:'));
      console.log(chalk.cyan('For Midnight, your wallet seed is the entropy value shown above'));
      console.log(chalk.cyan('The BIP39 mnemonic can be imported into any GUI wallet that supports the Midnight blockchain'));
      
      if (password) {
        console.log('\n' + chalk.yellow('Note: This seed was generated with a password. You will need this password to recreate the seed from the mnemonic.'));
      }
    }

    console.log('\nNext steps:');
    console.log('1. Use the AGENT_ID environment variable to identify this agent when calling the MCP server:');
    console.log(`   AGENT_ID=${agentId}`);
    console.log('\nIMPORTANT: Keep your seed secure and never share it!');
    console.log('Consider backing up your seed file securely.');

  } catch (error) {
    logger.error('Failed to set up agent:');
    logger.error(error);
    process.exit(1);
  }
}

main(); 