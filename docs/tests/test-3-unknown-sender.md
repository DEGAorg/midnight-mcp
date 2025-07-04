# Test Case 3: Payment From Unknown Sender

## Description
Simulate a transaction from a wallet that has not registered as an agent.

## Requirements
- On-chain transaction from unknown public key
- Contract check for registration should fail

## Sequence Diagram

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    participant UNKNOWN as Unknown Wallet
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,UNKNOWN: Setup: Unknown wallet (not registered)
    UNKNOWN->>BLOCKCHAIN: Send Payment
    BLOCKCHAIN->>SERVICE: Transaction Received
    SERVICE->>SERVICE: Check Sender Registration
    Note over SERVICE: Sender not found in registered agents
    SERVICE-->>WALLET: Payment Rejected
    WALLET-->>JEST: Payment Rejected Error
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Unchanged Balance
    
    Note over JEST: Assert: Balance unchanged
    Note over JEST: Assert: Error indicates unregistered sender
```

## Test Flow

```mermaid
graph TD
    START[Test Start] --> CHECK_BALANCE[Check Initial Balance]
    CHECK_BALANCE --> SETUP_UNKNOWN[Setup Unknown Wallet]
    SETUP_UNKNOWN --> SEND_PAYMENT[Unknown Wallet Sends Payment]
    SEND_PAYMENT --> RECEIVE_TX[Receive Transaction]
    RECEIVE_TX --> VALIDATE_SENDER[Validate Sender Registration]
    VALIDATE_SENDER --> SENDER_VALID{Sender<br/>Registered?}
    SENDER_VALID -->|Yes| ACCEPT_PAYMENT[Accept Payment - Unexpected]
    SENDER_VALID -->|No| REJECT_SENDER[Reject - Unregistered Sender]
    REJECT_SENDER --> ASSERT_SUCCESS[Assert Success - Expected]
    ACCEPT_PAYMENT --> ASSERT_FAILURE[Assert Failure - Unexpected]
    
    ASSERT_SUCCESS --> END[Test End]
    ASSERT_FAILURE --> END
    
    style START fill:#e1f5fe
    style ASSERT_SUCCESS fill:#e8f5e8
    style ASSERT_FAILURE fill:#ffebee
    style SENDER_VALID fill:#fff3e0
```

## HTTP API Calls

```mermaid
graph LR
    JEST[Jest Test] --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    JEST --> GET_AGENT_INFO[GET /wallet/agent/{address}]
    JEST --> GET_REGISTRATION[GET /wallet/registration/{address}]
    JEST --> GET_ERROR[GET /wallet/error/{txId}]
    
    GET_BALANCE --> WALLET[Wallet Server]
    GET_TRANSACTION --> WALLET
    GET_AGENT_INFO --> WALLET
    GET_REGISTRATION --> WALLET
    GET_ERROR --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> BLOCKCHAIN[Blockchain]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style BLOCKCHAIN fill:#e8f5e8
```

## Registration Check Logic

```mermaid
graph TD
    SENDER[Sender Address] --> QUERY_REGISTRATION[Query Registration Contract]
    QUERY_REGISTRATION --> REGISTRATION_DATA[Get Registration Data]
    REGISTRATION_DATA --> CHECK_EXISTS{Registration<br/>Exists?}
    
    CHECK_EXISTS -->|Yes| REGISTERED[Agent Registered]
    CHECK_EXISTS -->|No| UNREGISTERED[Agent Not Registered]
    
    REGISTERED --> VALIDATE_STATUS[Validate Registration Status]
    VALIDATE_STATUS --> STATUS_VALID{Status<br/>Valid?}
    STATUS_VALID -->|Yes| PROCEED[Proceed with Payment]
    STATUS_VALID -->|No| REJECT_STATUS[Reject - Invalid Status]
    
    UNREGISTERED --> REJECT_UNREGISTERED[Reject - Unregistered]
    
    PROCEED --> SUCCESS[Payment Accepted]
    REJECT_STATUS --> FAILURE[Payment Rejected]
    REJECT_UNREGISTERED --> FAILURE
    
    style SENDER fill:#e1f5fe
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
    style CHECK_EXISTS fill:#fff3e0
    style STATUS_VALID fill:#f3e5f5
```

## Unknown Sender Handling

```mermaid
graph TD
    UNKNOWN_TX[Unknown Sender Transaction] --> EXTRACT_ADDRESS[Extract Sender Address]
    EXTRACT_ADDRESS --> SEARCH_REGISTRATION[Search Registration Database]
    SEARCH_REGISTRATION --> FOUND{Address<br/>Found?}
    
    FOUND -->|Yes| KNOWN_AGENT[Known Agent]
    FOUND -->|No| UNKNOWN_AGENT[Unknown Agent]
    
    KNOWN_AGENT --> VALIDATE_AGENT[Validate Agent Status]
    VALIDATE_AGENT --> AGENT_VALID{Agent<br/>Valid?}
    AGENT_VALID -->|Yes| ACCEPT[Accept Transaction]
    AGENT_VALID -->|No| REJECT_INVALID[Reject - Invalid Agent]
    
    UNKNOWN_AGENT --> REJECT_UNKNOWN[Reject - Unknown Agent]
    
    ACCEPT --> SUCCESS[Transaction Success]
    REJECT_INVALID --> FAILURE[Transaction Failed]
    REJECT_UNKNOWN --> FAILURE
    
    style UNKNOWN_TX fill:#e1f5fe
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
    style FOUND fill:#fff3e0
    style AGENT_VALID fill:#f3e5f5
```

## Security Validation Flow

```mermaid
graph TD
    INCOMING[Incoming Transaction] --> SECURITY_CHECK[Security Validation]
    SECURITY_CHECK --> CHECK_SENDER[Check Sender Identity]
    CHECK_SENDER --> SENDER_KNOWN{Sender<br/>Known?}
    
    SENDER_KNOWN -->|Yes| CHECK_PERMISSIONS[Check Permissions]
    SENDER_KNOWN -->|No| BLOCK_UNKNOWN[Block Unknown Sender]
    
    CHECK_PERMISSIONS --> PERMISSIONS_OK{Permissions<br/>OK?}
    PERMISSIONS_OK -->|Yes| ALLOW[Allow Transaction]
    PERMISSIONS_OK -->|No| BLOCK_PERMISSIONS[Block - No Permissions]
    
    BLOCK_UNKNOWN --> LOG_BLOCK[Log Blocked Transaction]
    BLOCK_PERMISSIONS --> LOG_BLOCK
    
    ALLOW --> PROCEED[Proceed with Processing]
    LOG_BLOCK --> REJECT[Reject Transaction]
    
    PROCEED --> SUCCESS[Transaction Success]
    REJECT --> FAILURE[Transaction Failed]
    
    style INCOMING fill:#e1f5fe
    style SUCCESS fill:#e8f5e8
    style FAILURE fill:#ffebee
    style SENDER_KNOWN fill:#fff3e0
    style PERMISSIONS_OK fill:#f3e5f5
```

## Error Response Structure

```mermaid
graph TD
    ERROR[Registration Error] --> ERROR_TYPE{Error<br/>Type?}
    ERROR_TYPE -->|Not Registered| NOT_REGISTERED[Not Registered Error]
    ERROR_TYPE -->|Invalid Status| INVALID_STATUS[Invalid Status Error]
    ERROR_TYPE -->|Expired| EXPIRED[Expired Registration Error]
    
    NOT_REGISTERED --> ERROR_CODE[Set Error Code: 401]
    INVALID_STATUS --> ERROR_CODE[Set Error Code: 403]
    EXPIRED --> ERROR_CODE[Set Error Code: 410]
    
    ERROR_CODE --> ERROR_MESSAGE[Create Error Message]
    ERROR_MESSAGE --> ERROR_DETAILS[Add Error Details]
    ERROR_DETAILS --> ERROR_RESPONSE[Format Error Response]
    
    ERROR_RESPONSE --> RETURN_ERROR[Return to Client]
    RETURN_ERROR --> CLIENT_HANDLES[Client Handles Error]
    
    CLIENT_HANDLES --> ASSERT_ERROR[Assert Correct Error]
    ASSERT_ERROR --> TEST_PASSES[Test Passes]
    
    style ERROR fill:#ffebee
    style TEST_PASSES fill:#e8f5e8
    style ERROR_TYPE fill:#fff3e0
``` 