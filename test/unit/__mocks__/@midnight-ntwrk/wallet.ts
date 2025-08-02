import { Subject } from 'rxjs';

export const walletStateSubject = new Subject<any>();

export const __mockWallet = {
  getBalance: jest.fn(() => Promise.resolve(1000)),
  state: jest.fn(() => walletStateSubject.asObservable()),
  transferTransaction: jest.fn(),
  proveTransaction: jest.fn(),
  submitTransaction: jest.fn(),
  close: jest.fn(),
};

export const WalletBuilder = {
  build: jest.fn(() => Promise.resolve(__mockWallet)),
  buildFromSeed: jest.fn().mockResolvedValue(__mockWallet),
};

export type Wallet = any;
export type Resource = any;
