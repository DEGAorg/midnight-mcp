# Test Case 7: Sender Mismatch With Off-chain Session

## Description
Ensure the sender of the on-chain transaction does not match the off-chain session identity (e.g. mismatched agent pubkey).

## Requirements
- Agent is registered but does not match the off-chain caller

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant CONTRACT as Registration Contract
    participant AGENT_A as Registered Agent A
    participant AGENT_B as Registered Agent B
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,AGENT_A: Setup: Agent A is registered
    AGENT_A->>CONTRACT: Register with Identity A
    CONTRACT-->>AGENT_A: Registration Confirmed
    
    Note over JEST,AGENT_B: Setup: Agent B is also registered
    AGENT_B->>CONTRACT: Register with Identity B
    CONTRACT-->>AGENT_B: Registration Confirmed
    
    Note over JEST,AGENT_B: Test: Agent B sends payment but off-chain session expects Agent A
    AGENT_B->>BLOCKCHAIN: Send Payment (Using Identity B)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Extract Sender Address (Identity B)
    SERVICE->>CONTRACT: Query Registration for Sender
    CONTRACT-->>SERVICE: Registration Data for Identity B
    SERVICE->>SERVICE: Compare with Expected Identity (Identity A)
    Note over SERVICE: Identity mismatch detected
    SERVICE-->>WALLET: Payment Rejected
    WALLET-->>JEST: Payment Rejected Error
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Unchanged Balance
    
    Note over JEST: Assert: Balance unchanged
    Note over JEST: Assert: Error indicates identity mismatch
    Note over JEST: Assert: Off-chain session validation failed
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> SETUP_AGENTS[Setup Multiple Registered Agents]
    SETUP_AGENTS --> SET_EXPECTED[Set Expected Agent Identity]
    SET_EXPECTED --> SEND_PAYMENT[Different Agent Sends Payment]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> EXTRACT_SENDER[Extract Sender Address]
    EXTRACT_SENDER --> QUERY_CONTRACT[Query Registration Contract]
    QUERY_CONTRACT --> COMPARE_IDENTITY[Compare Sender vs Expected Identity]
    COMPARE_IDENTITY --> IDENTITY_MATCH{Identity<br/>Matches Expected?}
    IDENTITY_MATCH -->|No| REJECT_PAYMENT[Reject Payment]
    IDENTITY_MATCH -->|Yes| VALIDATE_AMOUNT[Validate Amount]
    REJECT_PAYMENT --> ASSERT_FAILURE[Assert Failure - Expected]
    VALIDATE_AMOUNT --> ACCEPT_PAYMENT[Accept Payment]
    ACCEPT_PAYMENT --> ASSERT_UNEXPECTED[Assert Unexpected Success]
    
    ASSERT_FAILURE --> END[Test End]
    ASSERT_UNEXPECTED --> END
    
    style START fill:#e1f5fe
    style ASSERT_FAILURE fill:#e8f5e8
    style ASSERT_UNEXPECTED fill:#ffebee
    style IDENTITY_MATCH fill:#fff3e0
```

## Session Management Flow

```mermaid
graph TD
    SESSION[Off-chain Session] --> SESSION_ID[Session Identity]
    SESSION_ID --> EXPECTED_AGENT[Expected Agent Identity]
    EXPECTED_AGENT --> STORE_SESSION[Store Session Context]
    
    TRANSACTION[Incoming Transaction] --> EXTRACT_SENDER[Extract Sender]
    EXTRACT_SENDER --> LOAD_SESSION[Load Session Context]
    LOAD_SESSION --> COMPARE[Compare Sender vs Session Identity]
    
    COMPARE --> MATCH{Match?}
    MATCH -->|Yes| VALIDATE[Validate Transaction]
    MATCH -->|No| REJECT[Reject Transaction]
    
    VALIDATE --> ACCEPT[Accept Transaction]
    REJECT --> ERROR[Return Error]
    
    style SESSION fill:#e1f5fe
    style TRANSACTION fill:#fff3e0
    style MATCH fill:#f3e5f5
    style ACCEPT fill:#e8f5e8
    style ERROR fill:#ffebee
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_SESSION[GET /wallet/session]
    JEST --> SET_SESSION[POST /wallet/session]
    JEST --> GET_AGENT_INFO[GET /wallet/agent/{address}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_SESSION --> WALLET
    SET_SESSION --> WALLET
    GET_AGENT_INFO --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> CONTRACT[Registration Contract]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style CONTRACT fill:#e8f5e8
```

## Identity Validation Logic

```mermaid
graph TD
    INPUT[Transaction Input] --> EXTRACT[Extract Sender Address]
    EXTRACT --> SESSION_CTX[Get Session Context]
    SESSION_CTX --> EXPECTED[Get Expected Identity]
    EXPECTED --> COMPARE[Compare Addresses]
    
    COMPARE --> EQUAL{Addresses<br/>Equal?}
    EQUAL -->|Yes| VALID[Valid Identity]
    EQUAL -->|No| INVALID[Invalid Identity]
    
    VALID --> PROCEED[Proceed with Transaction]
    INVALID --> REJECT[Reject Transaction]
    
    PROCEED --> SUCCESS[Transaction Success]
    REJECT --> ERROR[Return Identity Mismatch Error]
    
    style INPUT fill:#e1f5fe
    style COMPARE fill:#fff3e0
    style EQUAL fill:#f3e5f5
    style SUCCESS fill:#e8f5e8
    style ERROR fill:#ffebee
``` 