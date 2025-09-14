import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
}

export type ImpureCircuits<T> = {
  open_election(context: __compactRuntime.CircuitContext<T>, id_0: Uint8Array): __compactRuntime.CircuitResults<T, []>;
  close_election(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
  cast_vote(context: __compactRuntime.CircuitContext<T>,
            vote_type_0: bigint,
            vote_coin_0: { nonce: Uint8Array, color: Uint8Array, value: bigint }): __compactRuntime.CircuitResults<T, []>;
  fund_treasury(context: __compactRuntime.CircuitContext<T>,
                fund_coin_0: { nonce: Uint8Array,
                               color: Uint8Array,
                               value: bigint
                             }): __compactRuntime.CircuitResults<T, []>;
  payout_approved_proposal(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
  cancel_payout(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  open_election(context: __compactRuntime.CircuitContext<T>, id_0: Uint8Array): __compactRuntime.CircuitResults<T, []>;
  close_election(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
  cast_vote(context: __compactRuntime.CircuitContext<T>,
            vote_type_0: bigint,
            vote_coin_0: { nonce: Uint8Array, color: Uint8Array, value: bigint }): __compactRuntime.CircuitResults<T, []>;
  fund_treasury(context: __compactRuntime.CircuitContext<T>,
                fund_coin_0: { nonce: Uint8Array,
                               color: Uint8Array,
                               value: bigint
                             }): __compactRuntime.CircuitResults<T, []>;
  payout_approved_proposal(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
  cancel_payout(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
}

export type Ledger = {
  readonly election_open: boolean;
  readonly election_id: Uint8Array;
  readonly yes_votes: bigint;
  readonly no_votes: bigint;
  readonly absent_votes: bigint;
  has_voted: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  readonly treasury: { nonce: Uint8Array,
                       color: Uint8Array,
                       value: bigint,
                       mt_index: bigint
                     };
  readonly treasury_coin_color: Uint8Array;
  readonly dao_vote_coin_color: Uint8Array;
  readonly total_votes: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>,
               funding_token_address_0: { bytes: Uint8Array },
               dao_vote_token_address_0: { bytes: Uint8Array }): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
