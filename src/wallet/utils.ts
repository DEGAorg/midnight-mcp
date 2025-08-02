/* istanbul ignore file */

/**
 * Utility functions for wallet operations
 */

/**
 * Converts a decimal amount string to a BigInt value by multiplying by 1,000,000
 * This provides 6 decimal places of precision while storing values as integers
 * 
 * @param decimalAmount String representing a decimal amount (e.g., "12.345678")
 * @returns BigInt value with decimals removed (e.g., 12345678n)
 */
export function convertDecimalToBigInt(decimalAmount: string): bigint {
  if (!decimalAmount) {
    throw new Error('Amount must be provided');
  }

  // Check if the string represents a valid number with up to 6 decimals
  if (!/^\d+(\.\d{1,6})?$/.test(decimalAmount)) {
    throw new Error('Amount must be a valid decimal number with up to 6 decimal places');
  }

  // Convert string to BigInt, handling decimal places
  let amountBigInt: bigint;
  
  if (decimalAmount.includes('.')) {
    const [wholePart, decimalPart] = decimalAmount.split('.');
    // Pad with zeros to ensure uniform precision and take only up to 6 decimals
    const paddedDecimal = decimalPart.padEnd(6, '0').substring(0, 6);
    // Convert whole and decimal parts separately and combine
    amountBigInt = BigInt(wholePart) * BigInt(1_000_000) + BigInt(paddedDecimal);
  } else {
    // No decimal point, just multiply by 1,000,000
    amountBigInt = BigInt(decimalAmount) * BigInt(1_000_000);
  }

  return amountBigInt;
}

/**
 * Converts a BigInt value back to a decimal string with proper decimal places
 * 
 * @param bigIntAmount BigInt value (e.g., 12345678n)
 * @returns String with decimal representation (e.g., "12.345678")
 */
export function convertBigIntToDecimal(bigIntAmount: bigint): string {
  const amountString = bigIntAmount.toString().padStart(7, '0'); // Ensure at least 7 digits
  
  // Extract whole and decimal parts
  const wholePart = amountString.slice(0, -6) || '0'; // Default to 0 if empty
  const decimalPart = amountString.slice(-6).replace(/0+$/, ''); // Remove trailing zeros
  
  if (decimalPart) {
    return `${wholePart}.${decimalPart}`;
  } else {
    return wholePart;
  }
} 