import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
}

export type ImpureCircuits<T> = {
  register(context: __compactRuntime.CircuitContext<T>, text_0: string): __compactRuntime.CircuitResults<T, []>;
  verify_text(context: __compactRuntime.CircuitContext<T>, pk_0: Uint8Array): __compactRuntime.CircuitResults<T, string>;
  read_own_public_key(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, Uint8Array>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  register(context: __compactRuntime.CircuitContext<T>, text_0: string): __compactRuntime.CircuitResults<T, []>;
  verify_text(context: __compactRuntime.CircuitContext<T>, pk_0: Uint8Array): __compactRuntime.CircuitResults<T, string>;
  read_own_public_key(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, Uint8Array>;
}

export type Ledger = {
  registry: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
