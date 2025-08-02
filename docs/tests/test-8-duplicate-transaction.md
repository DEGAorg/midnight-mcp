# Test Case 8: Duplicate Transaction Detection

## Description
Ensure the system detects and ignores repeated processing of the same transaction.

## Requirements
- Track already-processed transaction IDs
- Reject duplicates to avoid double processing

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant CONTRACT as Registration Contract
    participant AGENT as Registered Agent
    participant DB as Transaction Database
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,AGENT: Setup: Agent is registered
    AGENT->>CONTRACT: Register with Identity
    CONTRACT-->>AGENT: Registration Confirmed
    
    Note over JEST,AGENT: First Transaction
    AGENT->>BLOCKCHAIN: Send Payment (Transaction ID: TX001)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Extract Transaction ID
    SERVICE->>DB: Check if TX001 already processed
    DB-->>SERVICE: Transaction not found
    SERVICE->>SERVICE: Validate Sender Registration
    SERVICE->>SERVICE: Validate Amount
    SERVICE->>DB: Store TX001 as processed
    SERVICE-->>WALLET: Payment Accepted
    WALLET-->>JEST: Payment Confirmed
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Updated Balance
    
    Note over JEST,AGENT: Duplicate Transaction (Same TX001)
    AGENT->>BLOCKCHAIN: Send Same Payment (Transaction ID: TX001)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Extract Transaction ID
    SERVICE->>DB: Check if TX001 already processed
    DB-->>SERVICE: Transaction already processed
    Note over SERVICE: Duplicate detected
    SERVICE-->>WALLET: Payment Rejected (Duplicate)
    WALLET-->>JEST: Payment Rejected Error
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Balance unchanged
    
    Note over JEST: Assert: Balance unchanged after duplicate
    Note over JEST: Assert: Error indicates duplicate transaction
    Note over JEST: Assert: No double processing occurred
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> SETUP_AGENT[Setup Registered Agent]
    SETUP_AGENT --> SEND_FIRST[Send First Transaction]
    SEND_FIRST --> PROCESS_FIRST[Process First Transaction]
    PROCESS_FIRST --> STORE_TX[Store Transaction ID]
    STORE_TX --> UPDATE_BALANCE[Update Balance]
    UPDATE_BALANCE --> SEND_DUPLICATE[Send Duplicate Transaction]
    SEND_DUPLICATE --> CHECK_DUPLICATE[Check for Duplicate]
    CHECK_DUPLICATE --> IS_DUPLICATE{Is<br/>Duplicate?}
    IS_DUPLICATE -->|Yes| REJECT_DUPLICATE[Reject Duplicate]
    IS_DUPLICATE -->|No| PROCESS_DUPLICATE[Process as New]
    REJECT_DUPLICATE --> ASSERT_SUCCESS[Assert Success - Expected]
    PROCESS_DUPLICATE --> ASSERT_FAILURE[Assert Failure - Unexpected]
    
    ASSERT_SUCCESS --> END[Test End]
    ASSERT_FAILURE --> END
    
    style START fill:#e1f5fe
    style ASSERT_SUCCESS fill:#e8f5e8
    style ASSERT_FAILURE fill:#ffebee
    style IS_DUPLICATE fill:#fff3e0
```

## Duplicate Detection Logic

```mermaid
graph TD
    TX_INPUT[Transaction Input] --> EXTRACT_ID[Extract Transaction ID]
    EXTRACT_ID --> QUERY_DB[Query Transaction Database]
    QUERY_DB --> EXISTS{Transaction<br/>Exists?}
    
    EXISTS -->|Yes| DUPLICATE[Mark as Duplicate]
    EXISTS -->|No| VALIDATE[Validate Transaction]
    
    DUPLICATE --> REJECT[Reject Transaction]
    VALIDATE --> VALID{Valid<br/>Transaction?}
    
    VALID -->|Yes| STORE[Store Transaction]
    VALID -->|No| REJECT_INVALID[Reject Invalid Transaction]
    
    STORE --> ACCEPT[Accept Transaction]
    REJECT --> ERROR_DUPLICATE[Return Duplicate Error]
    REJECT_INVALID --> ERROR_INVALID[Return Invalid Error]
    
    style TX_INPUT fill:#e1f5fe
    style EXISTS fill:#fff3e0
    style VALID fill:#f3e5f5
    style ACCEPT fill:#e8f5e8
    style ERROR_DUPLICATE fill:#ffebee
    style ERROR_INVALID fill:#ffebee
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_TRANSACTIONS[GET /wallet/transactions]
    JEST --> POST_TRANSACTION[POST /wallet/transaction]
    JEST --> GET_PROCESSED[GET /wallet/processed/{txId}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_TRANSACTIONS --> WALLET
    POST_TRANSACTION --> WALLET
    GET_PROCESSED --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> DB[Transaction Database]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style DB fill:#e8f5e8
```

## Database Schema for Transaction Tracking

```mermaid
graph TD
    DB[Transaction Database] --> TX_TABLE[Transactions Table]
    TX_TABLE --> TX_ID[Transaction ID]
    TX_TABLE --> SENDER[Sender Address]
    TX_TABLE --> AMOUNT[Amount]
    TX_TABLE --> STATUS[Status]
    TX_TABLE --> TIMESTAMP[Timestamp]
    TX_TABLE --> PROCESSED[Processed Flag]
    
    TX_ID --> PRIMARY_KEY[Primary Key]
    SENDER --> INDEX[Indexed Field]
    STATUS --> ENUM[Enum: PENDING, PROCESSED, REJECTED]
    PROCESSED --> BOOLEAN[Boolean: true/false]
    TIMESTAMP --> DATETIME[DateTime Field]
    
    style DB fill:#e1f5fe
    style TX_TABLE fill:#fff3e0
    style PRIMARY_KEY fill:#e8f5e8
```

## Transaction Processing States

```mermaid
graph TD
    RECEIVED[Transaction Received] --> VALIDATE[Validate Transaction]
    VALIDATE --> CHECK_DUPLICATE[Check for Duplicate]
    CHECK_DUPLICATE --> DUPLICATE{Is<br/>Duplicate?}
    
    DUPLICATE -->|Yes| REJECT_DUPLICATE[Reject - Duplicate]
    DUPLICATE -->|No| CHECK_REGISTRATION[Check Registration]
    
    CHECK_REGISTRATION --> REGISTERED{Agent<br/>Registered?}
    REGISTERED -->|No| REJECT_UNREGISTERED[Reject - Unregistered]
    REGISTERED -->|Yes| CHECK_AMOUNT[Check Amount]
    
    CHECK_AMOUNT --> AMOUNT_VALID{Amount<br/>Valid?}
    AMOUNT_VALID -->|No| REJECT_AMOUNT[Reject - Invalid Amount]
    AMOUNT_VALID -->|Yes| PROCESS[Process Transaction]
    
    PROCESS --> ACCEPT[Accept Transaction]
    
    REJECT_DUPLICATE --> END[End]
    REJECT_UNREGISTERED --> END
    REJECT_AMOUNT --> END
    ACCEPT --> END
    
    style RECEIVED fill:#e1f5fe
    style ACCEPT fill:#e8f5e8
    style REJECT_DUPLICATE fill:#ffebee
    style REJECT_UNREGISTERED fill:#ffebee
    style REJECT_AMOUNT fill:#ffebee
``` 