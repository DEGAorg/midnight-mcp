/**
 * Conversions Utility Unit Tests
 *
 * Tests for type conversion functions:
 * - Decimal ↔ BigInt conversion
 * - Byte padding
 * - BigInt serialization
 * - Type guards
 */

import { describe, it, expect } from '@jest/globals';
import {
  convertDecimalToBigInt,
  convertBigIntToDecimal,
  padBytes,
  serializeBigInts,
  isBigInt,
  isValidDecimalString,
} from '../../../../src/lib/utils/conversions.js';

describe('Conversions Utility', () => {
  describe('convertDecimalToBigInt', () => {
    it('should convert whole number string to BigInt', () => {
      expect(convertDecimalToBigInt('100', 6)).toBe(100000000n);
      expect(convertDecimalToBigInt('1', 6)).toBe(1000000n);
      expect(convertDecimalToBigInt('0', 6)).toBe(0n);
    });

    it('should convert decimal string to BigInt', () => {
      expect(convertDecimalToBigInt('12.345678', 6)).toBe(12345678n);
      expect(convertDecimalToBigInt('0.123456', 6)).toBe(123456n);
      expect(convertDecimalToBigInt('100.5', 6)).toBe(100500000n);
    });

    it('should handle decimal with fewer decimal places', () => {
      expect(convertDecimalToBigInt('1.5', 6)).toBe(1500000n);
      expect(convertDecimalToBigInt('10.25', 6)).toBe(10250000n);
      expect(convertDecimalToBigInt('0.1', 6)).toBe(100000n);
    });

    it('should handle different decimal configurations', () => {
      expect(convertDecimalToBigInt('1.5', 2)).toBe(150n);
      expect(convertDecimalToBigInt('1.5', 9)).toBe(1500000000n);
      expect(convertDecimalToBigInt('100', 8)).toBe(10000000000n);
    });

    it('should throw error for empty amount', () => {
      expect(() => convertDecimalToBigInt('', 6)).toThrow('Amount must be provided');
    });

    it('should throw error for invalid decimal format', () => {
      expect(() => convertDecimalToBigInt('abc', 6)).toThrow(
        'Amount must be a valid decimal number'
      );
      expect(() => convertDecimalToBigInt('1.2.3', 6)).toThrow(
        'Amount must be a valid decimal number'
      );
      expect(() => convertDecimalToBigInt('-100', 6)).toThrow(
        'Amount must be a valid decimal number'
      );
    });

    it('should throw error for too many decimal places', () => {
      expect(() => convertDecimalToBigInt('1.1234567', 6)).toThrow(
        'Amount must be a valid decimal number with up to 6 decimal places'
      );
    });

    it('should handle large numbers', () => {
      expect(convertDecimalToBigInt('1000000000', 6)).toBe(1000000000000000n);
      expect(convertDecimalToBigInt('999999999.999999', 6)).toBe(999999999999999n);
    });
  });

  describe('convertBigIntToDecimal', () => {
    it('should convert BigInt to decimal string with whole number result', () => {
      expect(convertBigIntToDecimal(100000000n, 6)).toBe('100');
      expect(convertBigIntToDecimal(1000000n, 6)).toBe('1');
      expect(convertBigIntToDecimal(0n, 6)).toBe('0');
    });

    it('should convert BigInt to decimal string with decimal result', () => {
      expect(convertBigIntToDecimal(12345678n, 6)).toBe('12.345678');
      expect(convertBigIntToDecimal(123456n, 6)).toBe('0.123456');
      expect(convertBigIntToDecimal(100500000n, 6)).toBe('100.5');
    });

    it('should remove trailing zeros in decimal part', () => {
      expect(convertBigIntToDecimal(1500000n, 6)).toBe('1.5');
      expect(convertBigIntToDecimal(10250000n, 6)).toBe('10.25');
      expect(convertBigIntToDecimal(100000n, 6)).toBe('0.1');
    });

    it('should handle different decimal configurations', () => {
      expect(convertBigIntToDecimal(150n, 2)).toBe('1.5');
      expect(convertBigIntToDecimal(1500000000n, 9)).toBe('1.5');
      expect(convertBigIntToDecimal(10000000000n, 8)).toBe('100');
    });

    it('should handle small values with leading zeros', () => {
      expect(convertBigIntToDecimal(1n, 6)).toBe('0.000001');
      expect(convertBigIntToDecimal(10n, 6)).toBe('0.00001');
      expect(convertBigIntToDecimal(100n, 6)).toBe('0.0001');
    });

    it('should handle large BigInt values', () => {
      expect(convertBigIntToDecimal(1000000000000000n, 6)).toBe('1000000000');
      expect(convertBigIntToDecimal(999999999999999n, 6)).toBe('999999999.999999');
    });
  });

  describe('padBytes', () => {
    it('should pad string to specified byte length', () => {
      const result = padBytes(32, 'hello');
      expect(result.length).toBe(32);
      expect(result[0]).toBe(104); // 'h'
      expect(result[1]).toBe(101); // 'e'
      expect(result[5]).toBe(0);   // padding
    });

    it('should handle empty string', () => {
      const result = padBytes(16, '');
      expect(result.length).toBe(16);
      expect(result.every(byte => byte === 0)).toBe(true);
    });

    it('should handle string exactly matching length', () => {
      const result = padBytes(5, 'hello');
      expect(result.length).toBe(5);
      expect(new TextDecoder().decode(result)).toBe('hello');
    });

    it('should throw error for string too long', () => {
      expect(() => padBytes(3, 'hello')).toThrow('String too long for pad length: 5 > 3');
    });

    it('should handle UTF-8 characters', () => {
      const result = padBytes(10, 'café');
      expect(result.length).toBe(10);
      // 'café' is 5 bytes in UTF-8 (c, a, f, é takes 2 bytes)
      expect(result[4]).toBe(0xA9); // é second byte
    });

    it('should handle typical DAO token type string', () => {
      const result = padBytes(32, 'dega_dao_vote');
      expect(result.length).toBe(32);
      expect(result[13]).toBe(0); // padding starts
    });
  });

  describe('serializeBigInts', () => {
    it('should convert BigInt to string', () => {
      expect(serializeBigInts(1000n)).toBe('1000');
      expect(serializeBigInts(0n)).toBe('0');
    });

    it('should handle null and undefined', () => {
      expect(serializeBigInts(null)).toBe(null);
      expect(serializeBigInts(undefined)).toBe(undefined);
    });

    it('should handle primitive types unchanged', () => {
      expect(serializeBigInts('hello')).toBe('hello');
      expect(serializeBigInts(42)).toBe(42);
      expect(serializeBigInts(true)).toBe(true);
    });

    it('should serialize BigInts in arrays', () => {
      const result = serializeBigInts([1n, 2n, 3n]);
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should serialize BigInts in nested arrays', () => {
      const result = serializeBigInts([[1n, 2n], [3n, 4n]]);
      expect(result).toEqual([['1', '2'], ['3', '4']]);
    });

    it('should serialize BigInts in objects', () => {
      const result = serializeBigInts({ amount: 1000n, data: { balance: 500n } });
      expect(result).toEqual({ amount: '1000', data: { balance: '500' } });
    });

    it('should handle mixed arrays and objects', () => {
      const result = serializeBigInts({
        values: [1n, 2n],
        nested: { value: 100n },
        plain: 'text',
      });
      expect(result).toEqual({
        values: ['1', '2'],
        nested: { value: '100' },
        plain: 'text',
      });
    });

    it('should handle deeply nested structures', () => {
      const result = serializeBigInts({
        level1: {
          level2: {
            level3: {
              amount: 999n,
            },
          },
        },
      });
      expect(result.level1.level2.level3.amount).toBe('999');
    });

    it('should handle arrays inside objects inside arrays', () => {
      const result = serializeBigInts([{ values: [1n, 2n] }, { values: [3n] }]);
      expect(result).toEqual([{ values: ['1', '2'] }, { values: ['3'] }]);
    });
  });

  describe('isBigInt', () => {
    it('should return true for BigInt values', () => {
      expect(isBigInt(100n)).toBe(true);
      expect(isBigInt(0n)).toBe(true);
      expect(isBigInt(BigInt(100))).toBe(true);
    });

    it('should return false for non-BigInt values', () => {
      expect(isBigInt(100)).toBe(false);
      expect(isBigInt('100')).toBe(false);
      expect(isBigInt(null)).toBe(false);
      expect(isBigInt(undefined)).toBe(false);
      expect(isBigInt({})).toBe(false);
      expect(isBigInt([])).toBe(false);
    });
  });

  describe('isValidDecimalString', () => {
    it('should return true for valid decimal strings', () => {
      expect(isValidDecimalString('100')).toBe(true);
      expect(isValidDecimalString('0')).toBe(true);
      expect(isValidDecimalString('1.5')).toBe(true);
      expect(isValidDecimalString('12.345678')).toBe(true);
    });

    it('should return true for decimals within specified precision', () => {
      expect(isValidDecimalString('1.5', 2)).toBe(true);
      expect(isValidDecimalString('1.12', 2)).toBe(true);
      expect(isValidDecimalString('1.123456789', 9)).toBe(true);
    });

    it('should return false for invalid decimal strings', () => {
      expect(isValidDecimalString('abc')).toBe(false);
      expect(isValidDecimalString('-100')).toBe(false);
      expect(isValidDecimalString('1.2.3')).toBe(false);
      expect(isValidDecimalString('')).toBe(false);
    });

    it('should return false for too many decimal places', () => {
      expect(isValidDecimalString('1.1234567', 6)).toBe(false);
      expect(isValidDecimalString('1.123', 2)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidDecimalString('.5')).toBe(false); // missing leading zero
      expect(isValidDecimalString('1.')).toBe(false); // trailing decimal
      expect(isValidDecimalString(' 1.5')).toBe(false); // leading space
      expect(isValidDecimalString('1.5 ')).toBe(false); // trailing space
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain value through decimal→bigint→decimal conversion', () => {
      const testValues = ['100', '1.5', '0.123456', '999999.999999', '0.000001'];

      for (const value of testValues) {
        const bigInt = convertDecimalToBigInt(value, 6);
        const decimal = convertBigIntToDecimal(bigInt, 6);
        expect(decimal).toBe(value);
      }
    });

    it('should maintain value through bigint→decimal→bigint conversion', () => {
      const testValues = [100000000n, 1500000n, 123456n, 999999999999n, 1n];

      for (const value of testValues) {
        const decimal = convertBigIntToDecimal(value, 6);
        const bigInt = convertDecimalToBigInt(decimal, 6);
        expect(bigInt).toBe(value);
      }
    });
  });

  describe('Edge cases that could break financial calculations', () => {
    it('should not lose precision with large values', () => {
      // Test with values beyond standard float precision
      const bigValue = convertDecimalToBigInt('9007199254.740991', 6);
      expect(bigValue).toBe(9007199254740991n);

      // Round-trip should preserve value
      const decimal = convertBigIntToDecimal(bigValue, 6);
      expect(decimal).toBe('9007199254.740991');
    });

    it('should handle exactly 6 decimal places without error', () => {
      // Boundary condition: exactly at the limit
      expect(() => convertDecimalToBigInt('1.123456', 6)).not.toThrow();
      expect(convertDecimalToBigInt('1.123456', 6)).toBe(1123456n);
    });

    it('should correctly pad decimals with zeros', () => {
      // 1.5 with 6 decimals should be 1.500000 = 1500000
      const result = convertDecimalToBigInt('1.5', 6);
      expect(result).toBe(1500000n);

      // Verify it's not 15 or 15000 or some other wrong value
      expect(result).not.toBe(15n);
      expect(result).not.toBe(15000n);
    });

    it('should handle zero correctly in all forms', () => {
      expect(convertDecimalToBigInt('0', 6)).toBe(0n);
      expect(convertDecimalToBigInt('0.0', 6)).toBe(0n);
      expect(convertDecimalToBigInt('0.000000', 6)).toBe(0n);
      expect(convertBigIntToDecimal(0n, 6)).toBe('0');
    });

    it('should reject negative numbers', () => {
      expect(() => convertDecimalToBigInt('-1', 6)).toThrow();
      expect(() => convertDecimalToBigInt('-0.5', 6)).toThrow();
    });

    it('should reject malformed inputs that could cause issues', () => {
      expect(() => convertDecimalToBigInt('1e6', 6)).toThrow(); // Scientific notation
      expect(() => convertDecimalToBigInt('1,000', 6)).toThrow(); // Comma separator
      expect(() => convertDecimalToBigInt('+100', 6)).toThrow(); // Explicit positive
    });
  });
});
