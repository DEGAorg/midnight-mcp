import { createLogger } from '../logger/index.js';

const logger = createLogger('dao-config');

export interface DaoConfig {
  contractAddress: string;
  voteTokenContractAddress: string;
  fundTokenContractAddress: string;
  voteCoinValue: string;
  fundCoinValue: string;
  description?: string;
}

export interface DaoConfigResult {
  success: boolean;
  config?: DaoConfig;
  error?: string;
}

/**
 * Parse DAO configuration from environment variable
 * Format: CONTRACT_ADDRESS:VOTE_TOKEN_CONTRACT_ADDRESS:FUND_TOKEN_CONTRACT_ADDRESS:VOTE_COIN_VALUE:FUND_COIN_VALUE:DESCRIPTION
 * Example: 0x1234567890abcdef:0xabcdef1234567890:0x9876543210fedcba:500:1000:Custom DAO for voting
 */
export function parseDaoConfigFromEnv(envValue: string): DaoConfigResult {
  try {
    if (!envValue || !envValue.trim()) {
      return {
        success: false,
        error: 'DAO environment variable is empty or not set'
      };
    }

    const parts = envValue.split(':');
    
    if (parts.length < 5) {
      return {
        success: false,
        error: 'DAO configuration must have at least 5 parts: contractAddress:voteTokenContractAddress:fundTokenContractAddress:voteCoinValue:fundCoinValue'
      };
    }

    const [contractAddress, voteTokenContractAddress, fundTokenContractAddress, voteCoinValue, fundCoinValue, description] = parts;

    // Validate required fields
    if (!contractAddress?.trim()) {
      return {
        success: false,
        error: 'Contract address is required'
      };
    }

    if (!voteTokenContractAddress?.trim()) {
      return {
        success: false,
        error: 'Vote token contract address is required'
      };
    }

    if (!fundTokenContractAddress?.trim()) {
      return {
        success: false,
        error: 'Fund token contract address is required'
      };
    }

    if (!voteCoinValue?.trim()) {
      return {
        success: false,
        error: 'Vote coin value is required'
      };
    }

    if (!fundCoinValue?.trim()) {
      return {
        success: false,
        error: 'Fund coin value is required'
      };
    }

    // Validate vote coin value is a number
    const voteValueNum = parseInt(voteCoinValue.trim(), 10);
    if (isNaN(voteValueNum) || voteValueNum <= 0) {
      return {
        success: false,
        error: 'Vote coin value must be a positive number'
      };
    }

    // Validate fund coin value is a number
    const fundValueNum = parseInt(fundCoinValue.trim(), 10);
    if (isNaN(fundValueNum) || fundValueNum <= 0) {
      return {
        success: false,
        error: 'Fund coin value must be a positive number'
      };
    }

    const config: DaoConfig = {
      contractAddress: contractAddress.trim(),
      voteTokenContractAddress: voteTokenContractAddress.trim(),
      fundTokenContractAddress: fundTokenContractAddress.trim(),
      voteCoinValue: voteCoinValue.trim(),
      fundCoinValue: fundCoinValue.trim(),
      description: description?.trim() || undefined
    };

    logger.info('DAO configuration parsed successfully', {
      contractAddress: config.contractAddress,
      voteTokenContractAddress: config.voteTokenContractAddress,
      fundTokenContractAddress: config.fundTokenContractAddress,
      voteCoinValue: config.voteCoinValue,
      fundCoinValue: config.fundCoinValue,
      description: config.description
    });

    return {
      success: true,
      config
    };

  } catch (error) {
    logger.error('Error parsing DAO configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while parsing DAO configuration'
    };
  }
}

/**
 * Get DAO configuration from environment variables
 * Checks DAO, DAO_1, DAO_2, etc. environment variables
 */
export function getDaoConfigFromEnv(): DaoConfigResult {
  const daoEnvVars = ['DAO', 'DAO_1', 'DAO_2', 'DAO_3', 'DAO_4', 'DAO_5'];
  
  for (const envVar of daoEnvVars) {
    const envValue = process.env[envVar];
    if (envValue) {
      logger.info(`Found DAO configuration in ${envVar}`);
      return parseDaoConfigFromEnv(envValue);
    }
  }

  return {
    success: false,
    error: 'No DAO configuration found in environment variables (DAO, DAO_1, DAO_2, etc.)'
  };
}

/**
 * Get DAO environment configuration template
 */
export function getDaoEnvConfigTemplate(): string {
  return `# DAO Configuration
# Format: CONTRACT_ADDRESS:VOTE_TOKEN_CONTRACT_ADDRESS:FUND_TOKEN_CONTRACT_ADDRESS:VOTE_COIN_VALUE:FUND_COIN_VALUE:DESCRIPTION
# Example:
export DAO="0x1234567890abcdef:0xabcdef1234567890:0x9876543210fedcba:500:1000:Custom DAO for voting"

# You can define multiple DAOs using DAO_1, DAO_2, etc.
# export DAO_1="0xabcdef1234567890:0x1111111111111111:0x2222222222222222:1000:2000:Another DAO"

# Note: Vote and fund coin colors are generated automatically using:
# - Vote coins: tokenType(pad('dega_dao_vote', 32), voteTokenContractAddress)
# - Fund coins: tokenType(pad('dega_funding_token', 32), fundTokenContractAddress)
`;
}

/**
 * Validate DAO configuration
 */
export function validateDaoConfig(config: DaoConfig): string[] {
  const errors: string[] = [];

  if (!config.contractAddress) {
    errors.push('Contract address is required');
  }

  if (!config.voteTokenContractAddress) {
    errors.push('Vote token contract address is required');
  }

  if (!config.fundTokenContractAddress) {
    errors.push('Fund token contract address is required');
  }

  if (!config.voteCoinValue) {
    errors.push('Vote coin value is required');
  } else {
    const voteValue = parseInt(config.voteCoinValue, 10);
    if (isNaN(voteValue) || voteValue <= 0) {
      errors.push('Vote coin value must be a positive number');
    }
  }

  if (!config.fundCoinValue) {
    errors.push('Fund coin value is required');
  } else {
    const fundValue = parseInt(config.fundCoinValue, 10);
    if (isNaN(fundValue) || fundValue <= 0) {
      errors.push('Fund coin value must be a positive number');
    }
  }

  return errors;
}
