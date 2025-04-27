#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch, { RequestInit } from 'node-fetch';

// envs
import dotenv from 'dotenv';
dotenv.config();

// Default server URL
const DEFAULT_SERVER_URL = 'http://localhost:3000';

// Command definitions
const COMMANDS = {
  GET_ADDRESS: 'Get wallet address',
  GET_BALANCE: 'Get wallet balance',
  SEND_FUNDS: 'Send funds to an address',
  VALIDATE_TX: 'Validate a transaction by hash',
  CHECK_TX_BY_ID: 'Check for transaction by identifier',
  SERVER_STATUS: 'Check server status',
  EXIT: 'Exit'
};

let serverUrl = DEFAULT_SERVER_URL;

/**
 * Configure the server URL to connect to
 */
async function configureServer() {
  console.log(chalk.blue('Configuring MCP server connection...'));
  
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter MCP server URL:',
      default: DEFAULT_SERVER_URL,
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch (e) {
          return 'Please enter a valid URL';
        }
      }
    }
  ]);
  
  serverUrl = url;
  console.log(chalk.green(`Configured to use MCP server at: ${serverUrl}`));
  
  // Test connection
  try {
    await fetchWithErrorHandling('/', { method: 'GET' });
    console.log(chalk.green('Successfully connected to MCP server!'));
    return true;
  } catch (error) {
    console.error(chalk.red('Failed to connect to MCP server:'), error);
    return false;
  }
}

/**
 * Wrapper for fetch with error handling
 */
async function fetchWithErrorHandling(endpoint: string, options: RequestInit = {}) {
  try {
    const url = `${serverUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY || '',
        ...(options.headers || {})
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`HTTP Error ${response.status}: ${JSON.stringify(errorData)}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(chalk.red(`Error making request to ${endpoint}:`), error);
    throw error;
  }
}

/**
 * Check server status
 */
async function checkServerStatus() {
  try {
    const status = await fetchWithErrorHandling('/status');
    console.log(chalk.green('Server status:'));
    console.log(JSON.stringify(status, null, 2));
  } catch (error) {
    console.error(chalk.red('Error checking server status:'), error);
  }
}

/**
 * Get the wallet address
 */
async function getAddress() {
  try {
    const response = await fetchWithErrorHandling('/address');
    const { address } = response as { address: string };
    console.log(chalk.green('Wallet address:'), address);
  } catch (error) {
    console.error(chalk.red('Error getting address:'), error);
  }
}

/**
 * Get the wallet balance
 */
async function getBalance() {
  try {
    const response = await fetchWithErrorHandling('/balance');
    const { balance } = response as { balance: number | string };
    console.log(chalk.green('Wallet balance:'), balance);
  } catch (error) {
    console.error(chalk.red('Error getting balance:'), error);
  }
}

/**
 * Send funds to an address
 */
async function sendFunds() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'destinationAddress',
      message: 'Enter destination address:',
      validate: (value) => value.length > 0 ? true : 'Please enter a destination address'
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount to send:',
      validate: (value) => {
        try {
          if (parseInt(value) <= 0) {
            return 'Amount must be greater than 0';
          }
          return true;
        } catch (e) {
          return 'Please enter a valid number';
        }
      }
    }
  ]);
  
  try {
    const result = await fetchWithErrorHandling('/send', {
      method: 'POST',
      body: JSON.stringify({
        destinationAddress: answers.destinationAddress,
        amount: answers.amount
      })
    });
    
    console.log(chalk.green('Transaction submitted:'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(chalk.red('Error sending funds:'), error);
  }
}

/**
 * Validate a transaction by hash
 */
async function validateTx() {
  const { txHash } = await inquirer.prompt([
    {
      type: 'input',
      name: 'txHash',
      message: 'Enter transaction hash:',
      validate: (value) => value.length > 0 ? true : 'Please enter a transaction hash'
    }
  ]);
  
  try {
    const result = await fetchWithErrorHandling(`/tx/${txHash}`);
    console.log(chalk.green('Transaction status:'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(chalk.red('Error validating transaction:'), error);
  }
}

/**
 * Check for transaction by identifier
 */
async function checkTxByIdentifier() {
  const { identifier } = await inquirer.prompt([
    {
      type: 'input',
      name: 'identifier',
      message: 'Enter transaction identifier:',
      validate: (value) => value.length > 0 ? true : 'Please enter a transaction identifier'
    }
  ]);
  
  try {
    const result = await fetchWithErrorHandling(`/tx/identifier/${identifier}`);
    console.log(chalk.green('Transaction verification:'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(chalk.red('Error checking transaction by identifier:'), error);
  }
}

/**
 * Main menu function
 */
async function showMainMenu() {
  const { command } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'Select a command:',
      choices: Object.values(COMMANDS)
    }
  ]);
  
  switch (command) {
    case COMMANDS.SERVER_STATUS:
      await checkServerStatus();
      break;
    case COMMANDS.GET_ADDRESS:
      await getAddress();
      break;
    case COMMANDS.GET_BALANCE:
      await getBalance();
      break;
    case COMMANDS.SEND_FUNDS:
      await sendFunds();
      break;
    case COMMANDS.VALIDATE_TX:
      await validateTx();
      break;
    case COMMANDS.CHECK_TX_BY_ID:
      await checkTxByIdentifier();
      break;
    case COMMANDS.EXIT:
      console.log(chalk.green('Goodbye!'));
      process.exit(0);
      break;
  }
  
  // Return to the main menu after executing a command
  await showMainMenu();
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue.bold('Midnight MCP Server HTTP Client Tool'));
  console.log(chalk.gray('This tool allows you to interact with a running MCP server via HTTP'));
  
  const connected = await configureServer();
  if (connected) {
    await showMainMenu();
  } else {
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Would you like to try a different server URL?',
        default: true
      }
    ]);
    
    if (retry) {
      await main();
    } else {
      console.log(chalk.red('Exiting...'));
      process.exit(1);
    }
  }
}

// Start the application
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
