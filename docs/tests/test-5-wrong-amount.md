# Test Case 2: Payment With Wrong Amount

## Description
Test behavior when a transaction is received from a valid sender but the amount is incorrect.

## Requirements
- On-chain transaction with incorrect amount
- Amount mismatch should be detected in off-chain logic

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
    
    Note over JEST,AGENT: Setup: Agent is registered
    AGENT->>BLOCKCHAIN: Send Payment (Incorrect Amount)
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Validate Sender Registration
    SERVICE->>SERVICE: Validate Amount
    Note over SERVICE: Amount mismatch detected
    SERVICE-->>WALLET: Payment Rejected
    WALLET-->>JEST: Payment Rejected Error
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Unchanged Balance
    
    Note over JEST: Assert: Balance unchanged
    Note over JEST: Assert: Error indicates amount mismatch
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> VERIFY_REGISTRATION[Verify Agent Registration]
    VERIFY_REGISTRATION --> SEND_PAYMENT[Agent Sends Payment with Wrong Amount]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> VALIDATE_SENDER[Validate Sender Registration]
    VALIDATE_SENDER --> SENDER_VALID{Sender<br/>Registered?}
    SENDER_VALID -->|No| REJECT_SENDER[Reject - Unregistered Sender]
    SENDER_VALID -->|Yes| VALIDATE_AMOUNT[Validate Amount]
    VALIDATE_AMOUNT --> AMOUNT_VALID{Amount<br/>Correct?}
    AMOUNT_VALID -->|Yes| ACCEPT_PAYMENT[Accept Payment - Unexpected]
    AMOUNT_VALID -->|No| REJECT_AMOUNT[Reject - Wrong Amount]
    REJECT_AMOUNT --> ASSERT_SUCCESS[Assert Success - Expected]
    ACCEPT_PAYMENT --> ASSERT_FAILURE[Assert Failure - Unexpected]
    
    REJECT_SENDER --> ASSERT_FAILURE
    
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
    JEST --> GET_ERROR[GET /wallet/error/{txId}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_AGENT_INFO --> WALLET
    GET_ERROR --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style BLOCKCHAIN fill:#e8f5e8
```

## Amount Validation Logic

```mermaid
graph TD
    PAYMENT[Payment Received] --> EXTRACT_AMOUNT[Extract Amount]
    EXTRACT_AMOUNT --> EXPECTED_AMOUNT[Get Expected Amount]
    EXPECTED_AMOUNT --> COMPARE[Compare Amounts]
    
    COMPARE --> AMOUNT_MATCH{Amounts<br/>Match?}
    AMOUNT_MATCH -->|Yes| AMOUNT_OK[Amount Valid]
    AMOUNT_MATCH -->|No| AMOUNT_MISMATCH[Amount Mismatch]
    
    AMOUNT_OK --> PROCEED[Proceed with Payment]
    AMOUNT_MISMATCH --> CALCULATE_DIFF[Calculate Difference]
    
    CALCULATE_DIFF --> DIFF_TYPE{Difference<br/>Type?}
    DIFF_TYPE -->|Too High| REJECT_HIGH[Reject - Too High]
    DIFF_TYPE -->|Too Low| REJECT_LOW[Reject - Too Low]
    
    REJECT_HIGH --> ERROR_HIGH[Error: Amount Too High]
    REJECT_LOW --> ERROR_LOW[Error: Amount Too Low]
    
    PROCEED --> SUCCESS[Payment Success]
    ERROR_HIGH --> FAILURE[Payment Failed]
    ERROR_LOW --> FAILURE
    
    style PAYMENT fill:#e1f5fe
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
    style AMOUNT_MATCH fill:#fff3e0
    style DIFF_TYPE fill:#f3e5f5
```

## Error Handling Flow

```mermaid
graph TD
    ERROR[Amount Mismatch Error] --> ERROR_TYPE{Error<br/>Type?}
    ERROR_TYPE -->|Amount Too High| HANDLE_HIGH[Handle High Amount]
    ERROR_TYPE -->|Amount Too Low| HANDLE_LOW[Handle Low Amount]
    ERROR_TYPE -->|Invalid Format| HANDLE_FORMAT[Handle Format Error]
    
    HANDLE_HIGH --> LOG_ERROR[Log Error Details]
    HANDLE_LOW --> LOG_ERROR
    HANDLE_FORMAT --> LOG_ERROR
    
    LOG_ERROR --> CREATE_RESPONSE[Create Error Response]
    CREATE_RESPONSE --> ERROR_CODE[Set Error Code]
    ERROR_CODE --> ERROR_MESSAGE[Set Error Message]
    
    ERROR_MESSAGE --> RETURN_ERROR[Return Error to Client]
    RETURN_ERROR --> CLIENT_RECEIVES[Client Receives Error]
    
    CLIENT_RECEIVES --> ASSERT_ERROR[Assert Correct Error]
    ASSERT_ERROR --> TEST_PASSES[Test Passes]
    
    style ERROR fill:#ffebee
    style TEST_PASSES fill:#e8f5e8
    style ERROR_TYPE fill:#fff3e0
```

## Expected vs Actual Amount Comparison

```mermaid
graph TD
    EXPECTED[Expected Amount] --> COMPARE[Compare with Actual]
    ACTUAL[Actual Amount] --> COMPARE
    
    COMPARE --> DIFFERENCE[Calculate Difference]
    DIFFERENCE --> TOLERANCE{Within<br/>Tolerance?}
    
    TOLERANCE -->|Yes| ACCEPT[Accept Payment]
    TOLERANCE -->|No| REJECT[Reject Payment]
    
    REJECT --> ERROR_TYPE{Error<br/>Type?}
    ERROR_TYPE -->|Too High| HIGH_ERROR[Amount Exceeds Expected]
    ERROR_TYPE -->|Too Low| LOW_ERROR[Amount Below Expected]
    
    HIGH_ERROR --> ERROR_RESPONSE[Return High Amount Error]
    LOW_ERROR --> ERROR_RESPONSE[Return Low Amount Error]
    
    ACCEPT --> SUCCESS[Payment Accepted]
    ERROR_RESPONSE --> FAILURE[Payment Rejected]
    
    style EXPECTED fill:#e1f5fe
    style ACTUAL fill:#fff3e0
    style TOLERANCE fill:#f3e5f5
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
``` 