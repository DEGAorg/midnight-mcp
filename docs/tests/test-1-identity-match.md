# Test Case 5: Valid Identity Match

## Description
Verify that the sender of the on-chain transaction matches the identity stored in the registration contract.

## Requirements
- Transaction sender address equals registered identity for the agent

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant CONTRACT as Registration Contract
    participant AGENT as Registered Agent
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,AGENT: Setup: Agent is registered with specific identity
    AGENT->>CONTRACT: Register with Identity (Public Key)
    CONTRACT-->>AGENT: Registration Confirmed
    CONTRACT->>BLOCKCHAIN: Store Registration Data
    
    AGENT->>BLOCKCHAIN: Send Payment (Using Registered Identity)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Extract Sender Address
    SERVICE->>CONTRACT: Query Registration for Sender
    CONTRACT-->>SERVICE: Registered Identity Data
    SERVICE->>SERVICE: Compare Sender vs Registered Identity
    Note over SERVICE: Identity match confirmed
    SERVICE->>SERVICE: Validate Amount
    SERVICE-->>WALLET: Payment Accepted
    WALLET-->>JEST: Payment Confirmed
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Updated Balance
    
    Note over JEST: Assert: Balance increased by expected amount
    Note over JEST: Assert: Sender identity matches registered agent
    Note over JEST: Assert: Identity validation passed
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> VERIFY_REGISTRATION[Verify Agent Registration]
    VERIFY_REGISTRATION --> SEND_PAYMENT[Agent Sends Payment]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> EXTRACT_SENDER[Extract Sender Address]
    EXTRACT_SENDER --> QUERY_CONTRACT[Query Registration Contract]
    QUERY_CONTRACT --> COMPARE_IDENTITY[Compare Sender vs Registered Identity]
    COMPARE_IDENTITY --> IDENTITY_MATCH{Identity<br/>Matches?}
    IDENTITY_MATCH -->|Yes| VALIDATE_AMOUNT[Validate Amount]
    IDENTITY_MATCH -->|No| REJECT_PAYMENT[Reject Payment]
    VALIDATE_AMOUNT --> ACCEPT_PAYMENT[Accept Payment]
    ACCEPT_PAYMENT --> UPDATE_BALANCE[Update Balance]
    UPDATE_BALANCE --> ASSERT_SUCCESS[Assert Success]
    REJECT_PAYMENT --> ASSERT_FAILURE[Assert Failure]
    
    ASSERT_SUCCESS --> END[Test End]
    ASSERT_FAILURE --> END
    
    style START fill:#e1f5fe
    style ASSERT_SUCCESS fill:#e8f5e8
    style ASSERT_FAILURE fill:#ffebee
    style IDENTITY_MATCH fill:#fff3e0
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_AGENT_INFO[GET /wallet/agent/{address}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_AGENT_INFO --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> CONTRACT[Registration Contract]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style CONTRACT fill:#e8f5e8
``` 