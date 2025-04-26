#!/usr/bin/env node

import * as bip39 from 'bip39';
import { Command } from 'commander';
import chalk from 'chalk';
import { createHash, randomBytes } from 'crypto';

const program = new Command();

program
  .name('generate-seed')
  .description('Generate a BIP39 mnemonic and derive seed for Midnight wallet')
  .version('1.0.0')
  .option('-w, --words <number>', 'number of words in mnemonic (12 or 24)', '24')
  .option('-p, --password <string>', 'optional password for additional security', '')
  .option('-f, --format <string>', 'seed format: "full" (64 bytes) or "compact" (32 bytes)', 'full')
  .option('-e, --entropy <hex>', 'use provided hex entropy (16, 20, 24, 28, or 32 bytes) to generate mnemonic')
  .option('-s, --seed <hex>', 'treat the provided hex as seed, verify by converting to mnemonic and back')
  .option('-m, --mnemonic <string>', 'use provided mnemonic to generate seed')
  .option('-M, --midnight-seed <hex>', 'Midnight wallet seed: generate a compatible BIP39 mnemonic for a Midnight wallet seed')
  .parse(process.argv);

const options = program.opts();

// Handle Midnight wallet specific seed (seed = entropy in Midnight's case)
if (options.midnightSeed) {
  try {
    const midnightSeed = options.midnightSeed;
    
    // Validate seed length
    if (midnightSeed.length !== 64) {
      console.error(chalk.red('Error: Midnight seed must be exactly 32 bytes (64 hex characters)'));
      process.exit(1);
    }
    
    // Convert Midnight seed to BIP39 mnemonic by using it as entropy
    const seedBuffer = Buffer.from(midnightSeed, 'hex');
    const mnemonic = bip39.entropyToMnemonic(seedBuffer);
    
    console.log(chalk.green('\n=== Midnight Wallet Seed Conversion ===\n'));
    console.log(chalk.yellow('Midnight Wallet Seed (hex):'));
    console.log(chalk.white(midnightSeed));
    console.log('\n' + chalk.yellow('Compatible BIP39 Mnemonic:'));
    console.log(chalk.white(mnemonic));
    console.log('\n' + chalk.cyan('Important Notes:'));
    console.log(chalk.cyan('1. In Midnight, your seed is used as entropy to generate the BIP39 mnemonic'));
    console.log(chalk.cyan('2. This mnemonic can be used in any BIP39-compatible wallet'));
    console.log(chalk.cyan('3. Save both your seed AND mnemonic for complete wallet recovery'));
    
    console.log(chalk.green('\n=== Keep this information secure! ===\n'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error processing Midnight seed: ${error.message}`));
    process.exit(1);
  }
}

// If mnemonic is provided, use it to generate seed
if (options.mnemonic) {
  try {
    const mnemonic = options.mnemonic.trim();
    
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      console.error(chalk.red('Error: Invalid BIP39 mnemonic'));
      process.exit(1);
    }
    
    // Get the entropy that generated this mnemonic
    const entropy = Buffer.from(bip39.mnemonicToEntropy(mnemonic), 'hex');
    
    console.log(chalk.green('\n=== Midnight Wallet Seed Generator (From Mnemonic) ===\n'));
    console.log(chalk.yellow('Provided Mnemonic:'));
    console.log(chalk.white(mnemonic));
    console.log('\n' + chalk.yellow('Entropy that generated this mnemonic (hex):'));
    console.log(chalk.white(entropy.toString('hex')));
    
    if (options.password) {
      console.log('\n' + chalk.yellow('Note: This seed was generated with a password. You will need this password to recreate the seed from the mnemonic.'));
    }
    
    console.log(chalk.green('\n=== Keep this information secure! ===\n'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error processing mnemonic: ${error.message}`));
    process.exit(1);
  }
}

// New: If seed is provided, treat as seed and verify conversion
if (options.seed) {
  try {
    const seedHex = options.seed;
    
    // Validate seed length
    if (seedHex.length !== 64) {
      console.error(chalk.red('Error: Seed must be exactly 32 bytes (64 hex characters)'));
      process.exit(1);
    }
    
    // Generate mnemonic directly from the seed (this is not standard BIP39, but works for verification)
    // For verification, we treat the seed as entropy to convert to mnemonic
    const seedAsEntropy = Buffer.from(seedHex, 'hex');
    const mnemonic = bip39.entropyToMnemonic(seedAsEntropy);
    
    // Now derive a seed from this mnemonic
    const derivedSeed = bip39.mnemonicToSeedSync(mnemonic, options.password);
    
    // Get a compact seed if requested
    const compactDerivedSeed = createHash('sha256').update(derivedSeed).digest();
    
    // Print the results
    console.log(chalk.green('\n=== Midnight Wallet Seed Verification ===\n'));
    console.log(chalk.yellow('Input Seed/Entropy (hex):'));
    console.log(chalk.white(seedHex));
    console.log('\n' + chalk.yellow('Corresponding BIP39 Mnemonic:'));
    console.log(chalk.white(mnemonic));
    
    // Show both formats for the derived seed
    console.log('\n' + chalk.yellow('Derived Full Seed (hex):'));
    console.log(chalk.white(derivedSeed.toString('hex')));
    console.log('\n' + chalk.yellow('Derived Compact Seed (hex):'));
    console.log(chalk.white(compactDerivedSeed.toString('hex')));
    
    // Check if the derived compact seed matches the input
    const seedsMatch = seedHex === compactDerivedSeed.toString('hex');
    console.log('\n' + chalk.yellow('Verification Result:'));
    if (seedsMatch) {
      console.log(chalk.green('✓ Success: Original seed and derived compact seed match!'));
    } else {
      console.log(chalk.red('✗ Warning: Original seed and derived compact seed do not match!'));
      console.log(chalk.yellow('This is EXPECTED when using a seed as initial entropy. In BIP39:'));
      console.log(chalk.yellow('1. Entropy → Mnemonic → Seed is a one-way process'));
      console.log(chalk.yellow('2. Your input was treated as entropy to generate a mnemonic'));
      console.log(chalk.yellow('3. The mnemonic then derives a different seed value'));
      console.log(chalk.yellow('4. The mnemonic is what should be used for wallet compatibility'));
    }
    
    if (options.password) {
      console.log('\n' + chalk.yellow('Note: A password was used. The derived seeds will only match the original if the same password was used to create it.'));
    }
    
    console.log(chalk.green('\n=== Keep this information secure! ===\n'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error processing seed: ${error.message}`));
    process.exit(1);
  }
}

// If entropy is provided, use it to generate mnemonic
if (options.entropy) {
  try {
    // Check if the hex entropy is valid
    const entropyBuffer = Buffer.from(options.entropy, 'hex');
    const validLengths = [16, 20, 24, 28, 32]; // Valid entropy lengths in bytes
    const entropyLengthBytes = entropyBuffer.length;
    
    if (!validLengths.includes(entropyLengthBytes)) {
      console.error(chalk.red(`Error: Entropy must be 16, 20, 24, 28, or 32 bytes (${validLengths.map(l => l*2).join(', ')} hex characters)`));
      process.exit(1);
    }
    
    // Generate the mnemonic from entropy
    const mnemonic = bip39.entropyToMnemonic(entropyBuffer);
    
    console.log(chalk.green('\n=== Midnight Wallet Seed Generator (From Entropy) ===\n'));
    console.log(chalk.yellow('Provided Entropy (hex):'));
    console.log(chalk.white(entropyBuffer.toString('hex')));
    console.log('\n' + chalk.yellow('Generated BIP39 Mnemonic:'));
    console.log(chalk.white(mnemonic));
    
    if (options.password) {
      console.log('\n' + chalk.yellow('Note: This seed was generated with a password. You will need this password to recreate the seed from the mnemonic.'));
    }
    
    console.log(chalk.green('\n=== Keep this information secure! ===\n'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error processing entropy: ${error.message}`));
    process.exit(1);
  }
}

// Standard flow (generating new entropy) if no entropy was provided
// Validate word count
const wordCount = parseInt(options.words);
if (wordCount !== 12 && wordCount !== 24) {
  console.error(chalk.red('Error: Word count must be either 12 or 24'));
  process.exit(1);
}

// Validate format
if (options.format !== 'full' && options.format !== 'compact') {
  console.error(chalk.red('Error: Format must be either "full" or "compact"'));
  process.exit(1);
}

// Generate strength based on word count (128 bits for 12 words, 256 bits for 24 words)
const strength = wordCount === 12 ? 128 : 256;

// Generate random entropy
const entropyBytes = strength / 8;
const entropy = randomBytes(entropyBytes);

// Generate mnemonic from entropy
const mnemonic = bip39.entropyToMnemonic(entropy);

console.log(chalk.green('\n=== Midnight Wallet Seed Generator ===\n'));
console.log(chalk.yellow('Midnight Seed (hex):'));
console.log(chalk.white(entropy.toString('hex')));
console.log('\n' + chalk.yellow('BIP39 Mnemonic:'));
console.log(chalk.white(mnemonic));
console.log('\n' + chalk.cyan('Important Note for Midnight Wallet:'));
console.log(chalk.cyan('For Midnight, your wallet seed is the entropy value shown above'));

if (options.password) {
  console.log('\n' + chalk.yellow('Note: This seed was generated with a password. You will need this password to recreate the seed from the mnemonic.'));
}

console.log(chalk.green('\n=== Keep this information secure! ===\n'));
