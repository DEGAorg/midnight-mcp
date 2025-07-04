export const convertBigIntToDecimal = jest.fn((amount: bigint) => {
  if (typeof amount === 'bigint') {
    const amountString = amount.toString().padStart(7, '0');
    const wholePart = amountString.slice(0, -6) || '0';
    const decimalPart = amountString.slice(-6).replace(/0+$/, '');
    if (decimalPart) {
      return `${wholePart}.${decimalPart}`;
    } else {
      return wholePart;
    }
  }
  return '0';
});

export const convertDecimalToBigInt = jest.fn((amount: string) => {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 1000000000));
});

export const nativeToken = jest.fn(() => 'native-token-id');

export const validateAddress = jest.fn((address: string) => {
  return address.startsWith('mdnt1') && address.length > 10;
});

export const formatAmount = jest.fn((amount: string, decimals: number = 6) => {
  const num = parseFloat(amount);
  return (num / Math.pow(10, decimals)).toFixed(6);
});

export const parseAmount = jest.fn((amount: string, decimals: number = 6) => {
  const num = parseFloat(amount);
  return (num * Math.pow(10, decimals)).toString();
}); 