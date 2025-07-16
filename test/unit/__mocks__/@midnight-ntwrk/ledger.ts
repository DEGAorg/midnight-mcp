// Mock for @midnight-ntwrk/ledger package
export const nativeToken = jest.fn(() => 'native-token-id');

// Add other ledger-related exports as needed
export const getTokenInfo = jest.fn(() => ({
  id: 'native-token-id',
  name: 'Native Token',
  symbol: 'NT',
  decimals: 6
}));

export const validateAddress = jest.fn((address: string) => address.startsWith('mdnt1'));

export const formatAmount = jest.fn((amount: string, decimals: number = 6) => {
  const num = parseFloat(amount);
  return (num / Math.pow(10, decimals)).toFixed(6);
});

export const parseAmount = jest.fn((amount: string, decimals: number = 6) => {
  const num = parseFloat(amount);
  return (num * Math.pow(10, decimals)).toString();
}); 