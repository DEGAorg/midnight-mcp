#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { FileManager, FileType } from '../src/utils/file-manager.js';
import { SeedManager } from '../src/utils/seed-manager.js';
import * as bip39 from 'bip39';
import { randomBytes } from 'crypto';
import chalk from 'chalk';

program
  .name('setup-agent')
  .description('Set up a new agent with a seed file')
  .requiredOption('-a, --agent-id <id>', 'Agent ID (e.g., agent-123)')
  .option('-s, --seed <seed>', 'Wallet seed in hex format (if not provided, will be generated)')
  .option('-m, --mnemonic <words>', 'BIP39 mnemonic phrase (words separated by spaces)')
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

  // For Midnight, we use the entropy as the seed (hex format)
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
  // Validate seed length (32 bytes = 64 hex characters)
  if (seed.length !== 64) {
    throw new Error('Seed must be exactly 32 bytes (64 hex characters)');
  }

  // Generate mnemonic from the seed (treating the hex seed as entropy)
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

async function mnemonicToSeed(mnemonic: string, password: string = ''): Promise<{ seed: string; derivedSeed?: string }> {
  // Validate mnemonic
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid BIP39 mnemonic phrase');
  }

  // Convert mnemonic back to entropy (this is the hex seed for Midnight)
  const entropy = bip39.mnemonicToEntropy(mnemonic);
  
  // For Midnight, we use the entropy as the seed
  const seed = entropy;

  // If password is provided, derive a seed from the mnemonic
  let derivedSeed: string | undefined;
  if (password) {
    const seedBuffer = bip39.mnemonicToSeedSync(mnemonic, password);
    derivedSeed = seedBuffer.toString('hex');
  }

  return {
    seed,
    derivedSeed
  };
}

async function validateDirectory(dir: string, isRoot: boolean = false): Promise<void> {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const stats = fs.statSync(dir);
  if (!stats.isDirectory()) {
    throw new Error(`Path exists but is not a directory: ${dir}`);
  }

  // Check if directory is writable
  try {
    const testFile = path.join(dir, `.test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    throw new Error(`Directory is not writable: ${dir}`);
  }

  if (isRoot) {
    // Check for package.json in root directory
    const packageJsonPath = path.join(dir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('Root directory must contain a package.json file');
    }
  }
}

async function createFolderStructure(baseDir: string): Promise<void> {
  const fileManager = FileManager.getInstance({ baseDir });
  
  // Define all required directories
  const directories = [
    fileManager.getPath(FileType.SEED, ''),
    fileManager.getPath(FileType.WALLET_BACKUP, ''),
    fileManager.getPath(FileType.LOG, ''),
    fileManager.getPath(FileType.TRANSACTION_DB, '')
  ];

  // Create and validate each directory
  for (const dir of directories) {
    try {
      // Create parent directories if they don't exist
      const parentDir = path.dirname(dir);
      if (!fs.existsSync(parentDir)) {
        console.log(chalk.cyan(`Creating parent directory: ${parentDir}`));
        fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 });
      }

      // Create the directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        console.log(chalk.cyan(`Creating directory: ${dir}`));
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      }

      // Validate the created directory
      await validateDirectory(dir);
      console.log(chalk.green(`✓ Directory validated: ${dir}`));
    } catch (error) {
      console.error(chalk.red(`Failed to create/validate directory ${dir}:`), error);
      throw error;
    }
  }
}

async function main() {
  try {
    const projectRoot = path.resolve(options.dir);
    const storageDir = path.join(projectRoot, '.storage');

    // Validate project root
    console.log(chalk.cyan('Validating project root...'));
    await validateDirectory(projectRoot, true);
    console.log(chalk.green('✓ Project root validated'));

    // Create and validate .storage directory
    if (!fs.existsSync(storageDir)) {
      console.log(chalk.cyan('Creating .storage directory...'));
      fs.mkdirSync(storageDir, { recursive: true, mode: 0o755 });
    }
    await validateDirectory(storageDir);
    console.log(chalk.green('✓ .storage directory validated'));

    // Create and validate all subdirectories
    await createFolderStructure(storageDir);

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

    if (options.mnemonic) {
      // Convert provided mnemonic to seed
      const result = await mnemonicToSeed(options.mnemonic, password);
      finalSeed = result.seed;
      derivedSeed = result.derivedSeed;
      mnemonic = options.mnemonic;
      console.log(chalk.cyan('Converting provided mnemonic to hex seed'));
    } else if (!finalSeed) {
      // Generate new seed
      const generated = await generateSeed(wordCount, password);
      finalSeed = generated.seed;
      mnemonic = generated.mnemonic;
      derivedSeed = generated.derivedSeed;
      console.log(chalk.cyan('Generating new random seed'));
    } else {
      // Verify provided seed
      const verified = await verifySeed(finalSeed, password);
      mnemonic = verified.mnemonic;
      derivedSeed = verified.derivedSeed;
      console.log(chalk.cyan('Using provided hex seed'));
    }

    // Initialize the seed
    await SeedManager.initializeAgentSeed(agentId, finalSeed);

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

    console.log('\n=== ElizaOS Server Configuration ===');
    console.log(chalk.cyan('Add this configuration to your character.json file:'));
    console.log(chalk.white(`
"mcp": {
    "servers": {
      "midnight-mcp": {
        "type": "stdio",
        "name": "Midnight MCP",
        "command": "bash",
        "args": [
          "-c",
          "source ~/.nvm/nvm.sh && AGENT_ID=${agentId} nvm exec 22.15.1 node ${process.cwd()}/dist/stdio-server.js"
        ]
      }
    }
}`));

    console.log('\nIMPORTANT: Keep your seed secure and never share it!');
    console.log('Consider backing up your seed file securely.');

  } catch (error) {
    console.error(chalk.red('\nError: Failed to set up agent:'));
    console.error(chalk.red(error));
    process.exit(1);
  }
}

main(); 