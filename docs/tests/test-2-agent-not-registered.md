# Test Case 6: Agent Not Registered

## Description
Validate that the system properly rejects a sender address that is not found in the registration contract.

## Requirements
- Contract check returns no entry for the sender

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant CONTRACT as Registration Contract
    participant UNREGISTERED as Unregistered Agent
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,UNREGISTERED: Setup: Agent is NOT registered
    Note over UNREGISTERED: Agent has wallet but no registration
    
    UNREGISTERED->>BLOCKCHAIN: Send Payment (Unregistered Identity)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Extract Sender Address
    SERVICE->>CONTRACT: Query Registration for Sender
    CONTRACT-->>SERVICE: No Registration Found
    Note over SERVICE: Sender not in registered agents list
    SERVICE-->>WALLET: Payment Rejected
    WALLET-->>JEST: Payment Rejected Error
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Unchanged Balance
    
    Note over JEST: Assert: Balance unchanged
    Note over JEST: Assert: Error indicates unregistered sender
    Note over JEST: Assert: Registration validation failed
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> VERIFY_NO_REGISTRATION[Verify Agent Not Registered]
    VERIFY_NO_REGISTRATION --> SEND_PAYMENT[Unregistered Agent Sends Payment]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> EXTRACT_SENDER[Extract Sender Address]
    EXTRACT_SENDER --> QUERY_CONTRACT[Query Registration Contract]
    QUERY_CONTRACT --> CHECK_REGISTRATION{Agent<br/>Registered?}
    CHECK_REGISTRATION -->|No| REJECT_PAYMENT[Reject Payment]
    CHECK_REGISTRATION -->|Yes| VALIDATE_AMOUNT[Validate Amount]
    REJECT_PAYMENT --> ASSERT_FAILURE[Assert Failure - Expected]
    VALIDATE_AMOUNT --> ACCEPT_PAYMENT[Accept Payment]
    ACCEPT_PAYMENT --> ASSERT_UNEXPECTED[Assert Unexpected Success]
    
    ASSERT_FAILURE --> END[Test End]
    ASSERT_UNEXPECTED --> END
    
    style START fill:#e1f5fe
    style ASSERT_FAILURE fill:#e8f5e8
    style ASSERT_UNEXPECTED fill:#ffebee
    style CHECK_REGISTRATION fill:#fff3e0
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_AGENT_INFO[GET /wallet/agent/{address}]
    JEST --> GET_REGISTRATION[GET /wallet/registration/{address}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_AGENT_INFO --> WALLET
    GET_REGISTRATION --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> CONTRACT[Registration Contract]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style CONTRACT fill:#e8f5e8
```

## Error Handling Flow

```mermaid
graph TD
    ERROR[Payment Rejected] --> ERROR_TYPE{Error Type}
    ERROR_TYPE -->|Unregistered| HANDLE_UNREGISTERED[Handle Unregistered Agent]
    ERROR_TYPE -->|Invalid Amount| HANDLE_AMOUNT[Handle Invalid Amount]
    ERROR_TYPE -->|Other| HANDLE_OTHER[Handle Other Error]
    
    HANDLE_UNREGISTERED --> LOG_ERROR[Log Error Details]
    HANDLE_AMOUNT --> LOG_ERROR
    HANDLE_OTHER --> LOG_ERROR
    
    LOG_ERROR --> RETURN_ERROR[Return Error Response]
    RETURN_ERROR --> CLIENT_RECEIVES[Client Receives Error]
    
    CLIENT_RECEIVES --> ASSERT_ERROR[Assert Correct Error Type]
    ASSERT_ERROR --> TEST_PASSES[Test Passes]
    
    style ERROR fill:#ffebee
    style TEST_PASSES fill:#e8f5e8
    style ERROR_TYPE fill:#fff3e0
``` 