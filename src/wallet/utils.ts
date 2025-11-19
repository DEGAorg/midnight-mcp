/* istanbul ignore file */

/**
 * Utility functions for wallet operations
 */

/**
 * Converts a decimal amount string to a BigInt value by multiplying by the specified decimal factor
 * This provides configurable decimal places of precision while storing values as integers
 * 
 * @param decimalAmount String representing a decimal amount (e.g., "12.345678")
 * @param decimals Number of decimal places (default: 6)
 * @returns BigInt value with decimals removed (e.g., 12345678n for 6 decimals)
 */
export function convertDecimalToBigInt(decimalAmount: string, decimals: number = 6): bigint {
  if (!decimalAmount) {
    throw new Error('Amount must be provided');
  }

  // Check if the string represents a valid number with up to the specified decimals
  const decimalRegex = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!decimalRegex.test(decimalAmount)) {
    throw new Error(`Amount must be a valid decimal number with up to ${decimals} decimal places`);
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
 */
export function convertBigIntToDecimal(bigIntAmount: bigint, decimals: number = 6): string {
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