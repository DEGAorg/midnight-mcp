/**
 * Token Configuration Parser
 * 
 * Handles parsing token configurations from environment variables
 * and provides batch registration functionality.
 */

import { createLogger } from '../logger/index.js';
import type { Logger } from 'pino';
import type { TokenInfo } from '../types/wallet.js';

export interface TokenConfig {
  name: string;
  symbol: string;
  contractAddress: string;
  domainSeparator?: string;
  description?: string;
  decimals?: number;
}

export interface BatchTokenRegistrationResult {
  success: boolean;
  registeredCount: number;
  errors: Array<{ token: string; error: string }>;
  registeredTokens: string[];
}

/**
 * Parse token configuration from environment variable
 * Expected format: TOKEN_NAME:SYMBOL:CONTRACT_ADDRESS:DOMAIN_SEPARATOR:DESCRIPTION:DECIMALS
 * Example: DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token:8
 */
export function parseTokenConfigFromEnv(envValue: string): TokenConfig | null {
  try {
    const parts = envValue.split(':');
    
    if (parts.length < 3) {
      throw new Error('Invalid token configuration format. Expected: NAME:SYMBOL:CONTRACT_ADDRESS[:DOMAIN_SEPARATOR][:DESCRIPTION][:DECIMALS]');
    }
    
    const [name, symbol, contractAddress, domainSeparator, description, decimalsStr] = parts;
    
    return {
      name: name.trim(),
      symbol: symbol.trim(),
      contractAddress: contractAddress.trim(),
      domainSeparator: domainSeparator?.trim() || 'custom_token',
      description: description?.trim() || undefined,
      decimals: decimalsStr ? parseInt(decimalsStr.trim(), 10) : undefined
    };
  } catch (error) {
    return null;
  }
}

/**
 * Parse multiple token configurations from environment variable
 * Expected format: TOKEN1_CONFIG|TOKEN2_CONFIG|TOKEN3_CONFIG
 * Example: DAO_VOTING:DVT:0x1234567890abcdef:dega_dao_vote:DAO voting token|FUNDING:FUND:0xfedcba0987654321:dega_funding_token:Funding token
 */
export function parseTokensFromEnv(envValue: string): TokenConfig[] {
  if (!envValue || envValue.trim() === '') {
    return [];
  }
  
  const logger = createLogger('token-config');
  const tokens: TokenConfig[] = [];
  const tokenConfigs = envValue.split('|');
  
  for (const config of tokenConfigs) {
    const parsed = parseTokenConfigFromEnv(config);
    if (parsed) {
      tokens.push(parsed);
      logger.debug(`Parsed token config: ${parsed.name} (${parsed.symbol})`);
    } else {
      logger.warn(`Failed to parse token config: ${config}`);
    }
  }
  
  return tokens;
}

/**
 * Parse token configurations from multiple environment variables
 * Supports TOKENS, TOKENS_1, TOKENS_2, etc.
 */
export function parseTokensFromMultipleEnvVars(): TokenConfig[] {
  const logger = createLogger('token-config');
  const tokens: TokenConfig[] = [];
  
  // Parse TOKENS environment variable
  const tokensEnv = process.env.TOKENS;
  if (tokensEnv) {
    const parsed = parseTokensFromEnv(tokensEnv);
    tokens.push(...parsed);
    logger.info(`Loaded ${parsed.length} tokens from TOKENS environment variable`);
  }
  
  // Parse numbered TOKENS_N environment variables
  let index = 1;
  while (true) {
    const envVarName = `TOKENS_${index}`;
    const envValue = process.env[envVarName];
    
    if (!envValue) {
      break;
    }
    
    const parsed = parseTokensFromEnv(envValue);
    tokens.push(...parsed);
    logger.info(`Loaded ${parsed.length} tokens from ${envVarName} environment variable`);
    
    index++;
  }
  
  return tokens;
}

/**
 * Validate token configuration
 */
export function validateTokenConfig(config: TokenConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.name || config.name.trim() === '') {
    errors.push('Token name is required');
  }
  
  if (!config.symbol || config.symbol.trim() === '') {
    errors.push('Token symbol is required');
  }
  
  if (!config.contractAddress || config.contractAddress.trim() === '') {
    errors.push('Contract address is required');
  }
  
  if (!config.domainSeparator || config.domainSeparator.trim() === '') {
    errors.push('Domain separator is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert TokenConfig to TokenInfo
 */
export function configToTokenInfo(config: TokenConfig): TokenInfo {
  return {
    name: config.name.toLowerCase(),
    symbol: config.symbol.toUpperCase(),
    contractAddress: config.contractAddress,
    domainSeparator: config.domainSeparator || 'custom_token',
    description: config.description,
    decimals: config.decimals || 6
  };
}
