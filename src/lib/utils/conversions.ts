/**
 * Utility Functions for Type Conversions
 *
 * Provides conversion functions for:
 * - Decimal ↔ BigInt (with configurable decimal places)
 * - Byte padding (for token type generation)
 * - BigInt serialization (for JSON responses)
 */

import { TOKEN_CONFIG } from '../config/constants.js';

// ==================== DECIMAL ↔ BIGINT CONVERSION ====================

/**
 * Converts a decimal amount string to a BigInt value by multiplying by the specified decimal factor
 * This provides configurable decimal places of precision while storing values as integers
 *
 * @param decimalAmount String representing a decimal amount (e.g., "12.345678")
 * @param decimals Number of decimal places (default: 6)
 * @returns BigInt value with decimals removed (e.g., 12345678n for 6 decimals)
 * @throws Error if amount is invalid or has too many decimal places
 *
 * @example
 * convertDecimalToBigInt("12.345678", 6) // returns 12345678n
 * convertDecimalToBigInt("100", 6)       // returns 100000000n
 * convertDecimalToBigInt("0.123456", 6)  // returns 123456n
 */
export function convertDecimalToBigInt(
  decimalAmount: string,
  decimals: number = TOKEN_CONFIG.DEFAULT_DECIMALS
): bigint {
  if (!decimalAmount) {
    throw new Error('Amount must be provided');
  }

  // Check if the string represents a valid number with up to the specified decimals
  const decimalRegex = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!decimalRegex.test(decimalAmount)) {
    throw new Error(
      `Amount must be a valid decimal number with up to ${decimals} decimal places`
    );
  }

  // Calculate the decimal factor (10^decimals)
  const decimalFactor = BigInt(10 ** decimals);

  // Convert string to BigInt, handling decimal places
  let amountBigInt: bigint;

  if (decimalAmount.includes('.')) {
    const [wholePart, decimalPart] = decimalAmount.split('.');
    // Pad with zeros to ensure uniform precision and take only up to specified decimals
    const paddedDecimal = decimalPart.padEnd(decimals, '0').substring(0, decimals);
    // Convert whole and decimal parts separately and combine
    amountBigInt = BigInt(wholePart) * decimalFactor + BigInt(paddedDecimal);
  } else {
    // No decimal point, just multiply by decimal factor
    amountBigInt = BigInt(decimalAmount) * decimalFactor;
  }

  return amountBigInt;
}

/**
 * Converts a BigInt value back to a decimal string with proper decimal places
 *
 * @param bigIntAmount BigInt value (e.g., 12345678n)
 * @param decimals Number of decimal places (default: 6)
 * @returns String with decimal representation (e.g., "12.345678")
 *
 * @example
 * convertBigIntToDecimal(12345678n, 6) // returns "12.345678"
 * convertBigIntToDecimal(100000000n, 6) // returns "100"
 * convertBigIntToDecimal(123456n, 6)    // returns "0.123456"
 */
export function convertBigIntToDecimal(
  bigIntAmount: bigint,
  decimals: number = TOKEN_CONFIG.DEFAULT_DECIMALS
): string {
  const amountString = bigIntAmount.toString().padStart(decimals + 1, '0'); // Ensure at least decimals+1 digits

  // Extract whole and decimal parts
  const wholePart = amountString.slice(0, -decimals) || '0'; // Default to 0 if empty
  const decimalPart = amountString.slice(-decimals).replace(/0+$/, ''); // Remove trailing zeros

  if (decimalPart) {
    return `${wholePart}.${decimalPart}`;
  } else {
    return wholePart;
  }
}

// ==================== BYTE PADDING ====================

/**
 * Pads a string to a specified byte length
 * Required for token type generation and DAO operations
 *
 * Format: UTF-8 bytes of string followed by 0x00 up to length n
 *
 * @param n Target byte length
 * @param s String to pad
 * @returns Uint8Array of padded bytes
 * @throws Error if string is too long for specified length
 *
 * @example
 * padBytes(32, "dega_dao_vote")  // Returns Uint8Array[32] with UTF-8 bytes + padding
 * padBytes(16, "hello")          // Returns Uint8Array[16] with UTF-8 bytes + padding
 */
export function padBytes(n: number, s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length > n) {
    throw new Error(`String too long for pad length: ${bytes.length} > ${n}`);
  }
  const out = new Uint8Array(n);
  out.set(bytes);
  return out;
}

// ==================== BIGINT SERIALIZATION ====================

/**
 * Recursively serializes BigInt values to strings for JSON serialization
 *
 * Required for API responses that contain BigInt values (which cannot be directly JSON serialized)
 * Handles nested objects and arrays
 *
 * @param obj Object to serialize (can be any type)
 * @returns Object with all BigInt values converted to strings
 *
 * @example
 * serializeBigInts({ amount: 1000n, data: { balance: 500n } })
 * // returns { amount: "1000", data: { balance: "500" } }
 *
 * serializeBigInts([1n, 2n, 3n])
 * // returns ["1", "2", "3"]
 */
export function serializeBigInts(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts);
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }

  return obj;
}

// ==================== TYPE GUARDS ====================

/**
 * Type guard to check if a value is a BigInt
 *
 * @param value Value to check
 * @returns true if value is a BigInt
 */
export function isBigInt(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Type guard to check if a value is a valid decimal string
 *
 * @param value Value to check
 * @param decimals Maximum decimal places allowed
 * @returns true if value is a valid decimal string
 */
export function isValidDecimalString(value: string, decimals: number = TOKEN_CONFIG.DEFAULT_DECIMALS): boolean {
  const decimalRegex = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  return decimalRegex.test(value);
}
