# Test Case 1: Valid Payment Received

## Description
Ensure a transaction is received from a registered agent with the correct amount.

## Requirements
- On-chain transaction with expected amount
- Sender must be a registered agent

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant AGENT as Registered Agent
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,AGENT: Setup: Ensure agent is registered
    AGENT->>BLOCKCHAIN: Submit Registration Transaction
    BLOCKCHAIN-->>AGENT: Registration Confirmed
    
    AGENT->>BLOCKCHAIN: Send Payment (Expected Amount)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Validate Sender Registration
    SERVICE->>SERVICE: Validate Amount
    SERVICE-->>WALLET: Payment Accepted
    WALLET-->>JEST: Payment Confirmed
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Updated Balance
    
    Note over JEST: Assert: Balance increased by expected amount
    Note over JEST: Assert: Sender is registered agent
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> VERIFY_REGISTRATION[Verify Agent Registration]
    VERIFY_REGISTRATION --> SEND_PAYMENT[Agent Sends Payment]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> VALIDATE_SENDER[Validate Sender Registration]
    VALIDATE_SENDER --> SENDER_VALID{Sender<br/>Registered?}
    SENDER_VALID -->|No| REJECT_SENDER[Reject - Unregistered Sender]
    SENDER_VALID -->|Yes| VALIDATE_AMOUNT[Validate Amount]
    VALIDATE_AMOUNT --> AMOUNT_VALID{Amount<br/>Correct?}
    AMOUNT_VALID -->|No| REJECT_AMOUNT[Reject - Wrong Amount]
    AMOUNT_VALID -->|Yes| ACCEPT_PAYMENT[Accept Payment]
    ACCEPT_PAYMENT --> UPDATE_BALANCE[Update Balance]
    UPDATE_BALANCE --> ASSERT_SUCCESS[Assert Success]
    
    REJECT_SENDER --> ASSERT_FAILURE[Assert Failure]
    REJECT_AMOUNT --> ASSERT_FAILURE
    
    ASSERT_SUCCESS --> END[Test End]
    ASSERT_FAILURE --> END
    
    style START fill:#e1f5fe
    style ASSERT_SUCCESS fill:#e8f5e8
    style ASSERT_FAILURE fill:#ffebee
    style SENDER_VALID fill:#fff3e0
    style AMOUNT_VALID fill:#f3e5f5
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_AGENT_INFO[GET /wallet/agent/{address}]
    JEST --> GET_TRANSACTIONS[GET /wallet/transactions]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_AGENT_INFO --> WALLET
    GET_TRANSACTIONS --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style BLOCKCHAIN fill:#e8f5e8
```

## Payment Validation Logic

```mermaid
graph TD
    PAYMENT[Payment Received] --> EXTRACT_DATA[Extract Payment Data]
    EXTRACT_DATA --> SENDER_ADDRESS[Sender Address]
    EXTRACT_DATA --> PAYMENT_AMOUNT[Payment Amount]
    EXTRACT_DATA --> TX_ID[Transaction ID]
    
    SENDER_ADDRESS --> CHECK_REGISTRATION[Check Registration]
    PAYMENT_AMOUNT --> CHECK_AMOUNT[Check Expected Amount]
    
    CHECK_REGISTRATION --> REGISTERED{Agent<br/>Registered?}
    CHECK_AMOUNT --> AMOUNT_MATCH{Amount<br/>Matches?}
    
    REGISTERED -->|Yes| REGISTERED_OK[Registration OK]
    REGISTERED -->|No| REGISTRATION_FAIL[Registration Failed]
    
    AMOUNT_MATCH -->|Yes| AMOUNT_OK[Amount OK]
    AMOUNT_MATCH -->|No| AMOUNT_FAIL[Amount Failed]
    
    REGISTERED_OK --> AMOUNT_OK
    AMOUNT_OK --> VALIDATION_PASS[Validation Passed]
    REGISTRATION_FAIL --> VALIDATION_FAIL[Validation Failed]
    AMOUNT_FAIL --> VALIDATION_FAIL
    
    VALIDATION_PASS --> ACCEPT[Accept Payment]
    VALIDATION_FAIL --> REJECT[Reject Payment]
    
    style PAYMENT fill:#e1f5fe
    style VALIDATION_PASS fill:#e8f5e8
    style VALIDATION_FAIL fill:#ffebee
    style REGISTERED fill:#fff3e0
    style AMOUNT_MATCH fill:#f3e5f5
```

## Balance Update Flow

```mermaid
graph TD
    INITIAL[Initial Balance] --> PAYMENT_RECEIVED[Payment Received]
    PAYMENT_RECEIVED --> VALIDATE[Validate Payment]
    VALIDATE --> VALID{Payment<br/>Valid?}
    
    VALID -->|Yes| CALCULATE[Calculate New Balance]
    VALID -->|No| KEEP_BALANCE[Keep Current Balance]
    
    CALCULATE --> ADD_AMOUNT[Add Payment Amount]
    ADD_AMOUNT --> UPDATE_DB[Update Database]
    UPDATE_DB --> NEW_BALANCE[New Balance]
    
    KEEP_BALANCE --> BALANCE_UNCHANGED[Balance Unchanged]
    
    NEW_BALANCE --> ASSERT_INCREASE[Assert Balance Increased]
    BALANCE_UNCHANGED --> ASSERT_NO_CHANGE[Assert Balance Unchanged]
    
    ASSERT_INCREASE --> SUCCESS[Test Success]
    ASSERT_NO_CHANGE --> FAILURE[Test Failure]
    
    style INITIAL fill:#e1f5fe
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
    style VALID fill:#fff3e0
``` 