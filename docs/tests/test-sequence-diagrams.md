# Test Sequence Diagrams

This document contains Mermaid diagrams showing how the 4 test scenarios from `test-scenarios.txt` will be executed using Jest and HTTP calls to the manually started Docker wallet container.

## Test Setup Flow

```mermaid
sequenceDiagram
    participant USER as User
    participant DOCKER as Docker Container
    participant JEST as Jest Test Runner
    participant WALLET as Wallet Server
    
    USER->>DOCKER: Start Container Manually
    DOCKER->>WALLET: Initialize Wallet
    WALLET-->>DOCKER: Container Running
    DOCKER-->>USER: Container Ready
    
    JEST->>WALLET: GET /wallet/status
    WALLET-->>JEST: Wallet Status
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Current Balance
    
    Note over JEST,WALLET: Verify wallet has sufficient funds
```

## Test Case 1: Valid Payment Received

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

## Test Case 2: Payment With Wrong Amount

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

## Test Case 3: Payment From Unknown Sender

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

## Test Case 4: No Payment Received

```mermaid
sequenceDiagram
    participant JEST as Jest Test
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Initial Balance
    
    Note over JEST,BLOCKCHAIN: Setup: No transactions sent
    JEST->>WALLET: GET /wallet/transactions
    WALLET->>SERVICE: Query Recent Transactions
    SERVICE->>BLOCKCHAIN: Check for Pending Transactions
    BLOCKCHAIN-->>SERVICE: No Transactions Found
    SERVICE-->>WALLET: Empty Transaction List
    WALLET-->>JEST: No Transactions
    
    JEST->>WALLET: GET /wallet/balance
    WALLET-->>JEST: Unchanged Balance
    
    Note over JEST: Assert: Balance unchanged
    Note over JEST: Assert: No transactions in list
    Note over JEST: Assert: System handles gracefully
```

## Complete Test Suite Flow

```mermaid
graph TD
    USER[User Starts Docker] --> DOCKER[Docker Container Running]
    DOCKER --> WALLET_READY[Wallet Service Ready]
    WALLET_READY --> JEST_START[Jest Test Suite Starts]
    
    JEST_START --> CHECK_WALLET[Check Wallet Status]
    CHECK_WALLET --> CHECK_FUNDS[Check Wallet Funds]
    CHECK_FUNDS --> SUFFICIENT_FUNDS{Funds<br/>Sufficient?}
    SUFFICIENT_FUNDS -->|No| ERROR_FUNDS[Error: Insufficient Funds]
    SUFFICIENT_FUNDS -->|Yes| RUN_TESTS[Run Test Cases]
    
    RUN_TESTS --> TEST1[Test Case 1:<br/>Valid Payment]
    RUN_TESTS --> TEST2[Test Case 2:<br/>Wrong Amount]
    RUN_TESTS --> TEST3[Test Case 3:<br/>Unknown Sender]
    RUN_TESTS --> TEST4[Test Case 4:<br/>No Payment]
    
    TEST1 --> VALIDATE1{Test 1<br/>Passed?}
    TEST2 --> VALIDATE2{Test 2<br/>Passed?}
    TEST3 --> VALIDATE3{Test 3<br/>Passed?}
    TEST4 --> VALIDATE4{Test 4<br/>Passed?}
    
    VALIDATE1 -->|No| FAIL1[Test 1 Failed]
    VALIDATE2 -->|No| FAIL2[Test 2 Failed]
    VALIDATE3 -->|No| FAIL3[Test 3 Failed]
    VALIDATE4 -->|No| FAIL4[Test 4 Failed]
    
    VALIDATE1 -->|Yes| VALIDATE2
    VALIDATE2 -->|Yes| VALIDATE3
    VALIDATE3 -->|Yes| VALIDATE4
    VALIDATE4 -->|Yes| ALL_PASSED[All Tests Passed]
    
    FAIL1 --> END[Test Suite Complete]
    FAIL2 --> END
    FAIL3 --> END
    FAIL4 --> END
    ALL_PASSED --> END
    ERROR_FUNDS --> END
    
    style USER fill:#e1f5fe
    style ALL_PASSED fill:#e8f5e8
    style FAIL1 fill:#ffebee
    style FAIL2 fill:#ffebee
    style FAIL3 fill:#ffebee
    style FAIL4 fill:#ffebee
    style ERROR_FUNDS fill:#ffebee
```

## HTTP API Endpoints Used in Tests

```mermaid
graph LR
    JEST[Jest Test Runner] --> GET_STATUS[GET /wallet/status]
    JEST --> GET_BALANCE[GET /wallet/balance]
    JEST --> GET_TRANSACTIONS[GET /wallet/transactions]
    JEST --> POST_SEND[POST /wallet/send]
    JEST --> GET_TRANSACTION[GET /wallet/transaction/{id}]
    
    GET_STATUS --> WALLET[Wallet Server]
    GET_BALANCE --> WALLET
    GET_TRANSACTIONS --> WALLET
    POST_SEND --> WALLET
    GET_TRANSACTION --> WALLET
    
    WALLET --> SERVICE[Wallet Service]
    SERVICE --> BLOCKCHAIN[Blockchain Network]
    
    style JEST fill:#e1f5fe
    style WALLET fill:#fff3e0
    style SERVICE fill:#f3e5f5
    style BLOCKCHAIN fill:#e8f5e8
```

## Test Environment Requirements

```mermaid
graph TD
    REQUIREMENTS[Test Requirements] --> DOCKER_RUNNING[Docker Container Running]
    REQUIREMENTS --> FUNDS[Sufficient Wallet Funds]
    REQUIREMENTS --> NETWORK[Blockchain Network Access]
    REQUIREMENTS --> AGENTS[Registered Agent Setup]
    
    DOCKER_RUNNING --> WALLET_SERVICE[Wallet Service Active]
    FUNDS --> MINIMUM_BALANCE[Minimum Balance for Tests]
    NETWORK --> CONNECTION[Network Connection Stable]
    AGENTS --> REGISTERED_AGENTS[Agents Pre-registered]
    
    WALLET_SERVICE --> HTTP_ENDPOINTS[HTTP Endpoints Available]
    MINIMUM_BALANCE --> TEST_FUNDS[Funds for Test Transactions]
    CONNECTION --> TRANSACTION_SUBMISSION[Transaction Submission Works]
    REGISTERED_AGENTS --> VALIDATION_TESTS[Validation Tests Possible]
    
    HTTP_ENDPOINTS --> JEST_READY[Jest Can Connect]
    TEST_FUNDS --> TRANSACTION_TESTS[Transaction Tests Possible]
    TRANSACTION_SUBMISSION --> ONCHAIN_TESTS[On-chain Tests Possible]
    VALIDATION_TESTS --> SCENARIO_TESTS[All Scenarios Testable]
    
    JEST_READY --> TESTS_READY[Tests Ready to Run]
    TRANSACTION_TESTS --> TESTS_READY
    ONCHAIN_TESTS --> TESTS_READY
    SCENARIO_TESTS --> TESTS_READY
    
    style REQUIREMENTS fill:#e1f5fe
    style TESTS_READY fill:#e8f5e8
``` 