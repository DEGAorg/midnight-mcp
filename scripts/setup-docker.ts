#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as bip39 from 'bip39';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import { execSync } from 'child_process';

program
  .name('setup-docker')
  .description('Set up a new agent for Docker deployment')
  .requiredOption('-a, --agent-id <id>', 'Agent ID (e.g., agent-123)')
  .option('-s, --seed <seed>', 'Wallet seed in hex format (if not provided, will be generated)')
  .option('-m, --mnemonic <words>', 'BIP39 mnemonic phrase (words separated by spaces)')
  .option('-f, --force', 'Overwrite existing seed file if it exists')
  .option('-w, --words <number>', 'number of words in mnemonic (12 or 24)', '24')
  .option('-p, --password <string>', 'optional password for additional security', '')
  .option('-P, --port <number>', 'Wallet server port', '3000')
  .option('-i, --indexer <url>', 'Indexer URL', 'http://indexer:8080')
  .option('-w, --indexer-ws <url>', 'Indexer WebSocket URL', 'ws://indexer:8080')
  .option('-n, --node <url>', 'Midnight node URL', 'http://midnight-node:8080')
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

async function main() {
  try {
    const agentId = options.agentId;

    // Validate agent ID format
    if (!/^[a-zA-Z0-9-]+$/.test(agentId)) {
      throw new Error('Agent ID can only contain letters, numbers, and hyphens');
    }

    // Create agents directory if it doesn't exist
    const agentsDir = path.join(process.cwd(), 'agents');
    if (!fs.existsSync(agentsDir)) {
      console.log(chalk.cyan('Creating agents directory...'));
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    // Create agent directory
    const agentDir = path.join(agentsDir, agentId);
    if (!fs.existsSync(agentDir)) {
      console.log(chalk.cyan(`Creating directory for agent ${agentId}...`));
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Create data and logs directories
    const dataDir = path.join(agentDir, 'data');
    const logsDir = path.join(agentDir, 'logs');
    const seedsDir = path.join(dataDir, 'seeds', agentId);
    const backupsDir = path.join(dataDir, 'wallet-backups', agentId);
    const txDbDir = path.join(dataDir, 'transaction-db', agentId);

    // Create directories with proper permissions
    [dataDir, logsDir, seedsDir, backupsDir, txDbDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Generate seed file
    const seedPath = path.join(seedsDir, 'seed');
    if (!fs.existsSync(seedPath) || options.force) {
      let seed: string;
      let mnemonic: string | undefined;
      let derivedSeed: string | undefined;

      if (options.seed) {
        // Use provided hex seed
        if (!/^[0-9a-fA-F]{64}$/.test(options.seed)) {
          throw new Error('Seed must be exactly 32 bytes (64 hex characters)');
        }
        seed = options.seed;
        console.log(chalk.cyan('Using provided hex seed'));
      } else if (options.mnemonic) {
        // Convert mnemonic to seed
        const result = await mnemonicToSeed(options.mnemonic, options.password);
        seed = result.seed;
        derivedSeed = result.derivedSeed;
        mnemonic = options.mnemonic;
        console.log(chalk.cyan('Converting provided mnemonic to hex seed'));
      } else {
        // Generate new seed
        const result = await generateSeed(parseInt(options.words), options.password);
        seed = result.seed;
        mnemonic = result.mnemonic;
        derivedSeed = result.derivedSeed;
        console.log(chalk.cyan('Generating new random seed'));
      }

      fs.writeFileSync(seedPath, seed);
      fs.chmodSync(seedPath, 0o600); // Set read/write for owner only

      // Display seed information
      console.log('\n=== Generated Wallet Information ===');
      console.log(chalk.yellow('Midnight Seed (hex):'));
      console.log(chalk.white(seed));
      
      if (mnemonic) {
        console.log('\n' + chalk.yellow('BIP39 Mnemonic:'));
        console.log(chalk.white(mnemonic));
      }
      
      if (derivedSeed) {
        console.log('\n' + chalk.yellow('Derived Seed (with password):'));
        console.log(chalk.white(derivedSeed));
      }
    }

    // Create .env file
    const envPath = path.join(agentDir, '.env');
    const envContent = `# Required
AGENT_ID=${agentId}

# Server Configuration
WALLET_SERVER_PORT=${options.port || '3000'}

# Network Configuration
NETWORK_ID=TestNet
LOG_LEVEL=info

# External Services
USE_EXTERNAL_PROOF_SERVER=true
PROOF_SERVER=${options.proofServer}
INDEXER=${options.indexer}
INDEXER_WS=${options.indexerWs}
MN_NODE=${options.node}
`;
    fs.writeFileSync(envPath, envContent);
    console.log(chalk.green('✓ .env file created'));

    // Copy docker-compose.yml to agent directory
    const dockerComposePath = path.join(agentDir, 'docker-compose.yml');
    if (!fs.existsSync(dockerComposePath)) {
      console.log(chalk.cyan('Copying docker-compose.yml...'));
      fs.copyFileSync(path.join(process.cwd(), 'docker-compose.yml'), dockerComposePath);
    }

    console.log('\n=== Docker Setup Instructions ===');
    console.log(chalk.cyan('1. Change to the agent directory:'));
    console.log(chalk.white(`   cd agents/${agentId}`));
    
    console.log(chalk.cyan('\n2. Build and start the containers:'));
    console.log(chalk.white('   docker-compose up -d'));
    
    console.log(chalk.cyan('\n3. Check the logs:'));
    console.log(chalk.white(`   docker-compose logs -f wallet-server`));
    
    console.log(chalk.cyan('\n4. To stop the containers:'));
    console.log(chalk.white('   docker-compose down'));
    
    console.log(chalk.cyan('\n5. To remove all data (including volumes):'));
    console.log(chalk.white('   docker-compose down -v'));

    console.log('\nIMPORTANT: Keep your seed secure and never share it!');
    console.log('Consider backing up your seed file securely.');

  } catch (error) {
    console.error(chalk.red('\nError: Failed to set up Docker environment:'));
    console.error(chalk.red(error));
    process.exit(1);
  }
}

main(); 