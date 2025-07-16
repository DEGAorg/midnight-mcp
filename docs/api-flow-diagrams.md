# Midnight MCP API Flow Diagrams

This document contains Mermaid diagrams showing the API flows, tool interactions, and request/response patterns for the Midnight MCP server.

## Tool Call Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as MCP Protocol
    participant STDIO as STDIO Server
    participant TOOLS as Tool Handler
    participant HTTP as HTTP Client
    participant WALLET as Wallet Server
    participant CONTROLLER as Controller
    participant SERVICE as Wallet Service
    
    AI->>MCP: Call Tool (walletStatus)
    MCP->>STDIO: Tool Request
    STDIO->>TOOLS: Handle Tool Call
    TOOLS->>HTTP: GET /wallet/status
    HTTP->>WALLET: HTTP Request
    WALLET->>CONTROLLER: Route Request
    CONTROLLER->>SERVICE: getWalletStatus()
    SERVICE-->>CONTROLLER: Wallet Status
    CONTROLLER-->>WALLET: JSON Response
    WALLET-->>HTTP: HTTP Response
    HTTP-->>TOOLS: Response Data
    TOOLS-->>STDIO: MCP Response
    STDIO-->>MCP: Tool Result
    MCP-->>AI: Tool Response
```

## Send Funds Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant STDIO as STDIO Server
    participant HTTP as HTTP Client
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant BLOCKCHAIN as Blockchain
    
    AI->>STDIO: sendFunds(dest, amount)
    STDIO->>HTTP: POST /wallet/send
    Note over HTTP: {destinationAddress, amount}
    HTTP->>WALLET: HTTP Request
    WALLET->>SERVICE: sendFunds(dest, amount)
    SERVICE->>BLOCKCHAIN: Submit Transaction
    BLOCKCHAIN-->>SERVICE: Transaction ID
    SERVICE-->>WALLET: InitiateTransactionResult
    WALLET-->>HTTP: JSON Response
    HTTP-->>STDIO: Response Data
    STDIO-->>AI: Transaction Initiated
```

## Transaction Status Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant STDIO as STDIO Server
    participant HTTP as HTTP Client
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant DB as Transaction DB
    
    AI->>STDIO: getTransactionStatus(txId)
    STDIO->>HTTP: GET /wallet/transaction/{txId}
    HTTP->>WALLET: HTTP Request
    WALLET->>SERVICE: getTransactionStatus(txId)
    SERVICE->>DB: Query Transaction
    DB-->>SERVICE: Transaction Record
    SERVICE-->>WALLET: TransactionStatusResult
    WALLET-->>HTTP: JSON Response
    HTTP-->>STDIO: Response Data
    STDIO-->>AI: Transaction Status
```

## Wallet Initialization Flow

```mermaid
graph TD
    START[Server Start] --> LOAD_CONFIG[Load Configuration]
    LOAD_CONFIG --> VALIDATE_AGENT{Agent ID<br/>Valid?}
    VALIDATE_AGENT -->|No| ERROR_AGENT[Agent ID Error]
    VALIDATE_AGENT -->|Yes| LOAD_SEED[Load Seed]
    LOAD_SEED --> SEED_EXISTS{Seed<br/>Exists?}
    SEED_EXISTS -->|No| CREATE_SEED[Create New Seed]
    SEED_EXISTS -->|Yes| INIT_WALLET[Initialize Wallet]
    CREATE_SEED --> INIT_WALLET
    INIT_WALLET --> SYNC_WALLET[Sync with Blockchain]
    SYNC_WALLET --> READY{Wallet<br/>Ready?}
    READY -->|No| WAIT[Wait for Sync]
    WAIT --> SYNC_WALLET
    READY -->|Yes| SERVER_READY[Server Ready]
    
    ERROR_AGENT --> END[Exit]
    SERVER_READY --> END
    
    style START fill:#e1f5fe
    style SERVER_READY fill:#e8f5e8
    style ERROR_AGENT fill:#ffebee
```

## Error Handling Flow

```mermaid
graph TD
    REQUEST[Tool Request] --> VALIDATE[Validate Input]
    VALIDATE --> VALID{Valid?}
    VALID -->|No| INVALID_PARAMS[Invalid Parameters<br/>Error]
    VALID -->|Yes| HTTP_REQUEST[HTTP Request]
    HTTP_REQUEST --> HTTP_SUCCESS{HTTP<br/>Success?}
    HTTP_SUCCESS -->|No| HTTP_ERROR[HTTP Error<br/>Response]
    HTTP_SUCCESS -->|Yes| PARSE_RESPONSE[Parse Response]
    PARSE_RESPONSE --> WALLET_READY{Wallet<br/>Ready?}
    WALLET_READY -->|No| WALLET_ERROR[Wallet Not Ready<br/>Error]
    WALLET_READY -->|Yes| PROCESS[Process Response]
    PROCESS --> SUCCESS{Success?}
    SUCCESS -->|No| PROCESS_ERROR[Processing Error]
    SUCCESS -->|Yes| SUCCESS_RESPONSE[Success Response]
    
    INVALID_PARAMS --> MCP_ERROR[MCP Error]
    HTTP_ERROR --> MCP_ERROR
    WALLET_ERROR --> MCP_ERROR
    PROCESS_ERROR --> MCP_ERROR
    SUCCESS_RESPONSE --> MCP_SUCCESS[MCP Success]
    
    style REQUEST fill:#e1f5fe
    style MCP_SUCCESS fill:#e8f5e8
    style MCP_ERROR fill:#ffebee
```

## Resource Management Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant STDIO as STDIO Server
    participant RESOURCES as Resource Handler
    participant HTTP as HTTP Client
    participant WALLET as Wallet Server
    
    AI->>STDIO: List Resources
    STDIO->>RESOURCES: Handle List Request
    RESOURCES-->>STDIO: Resource List
    STDIO-->>AI: Available Resources
    
    AI->>STDIO: Read Resource (uri)
    STDIO->>RESOURCES: Handle Read Request
    RESOURCES->>HTTP: GET /wallet/config
    HTTP->>WALLET: HTTP Request
    WALLET-->>HTTP: Configuration Data
    HTTP-->>RESOURCES: Response Data
    RESOURCES-->>STDIO: Resource Content
    STDIO-->>AI: Resource Data
```

## Multi-Step Transaction Flow

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant STDIO as STDIO Server
    participant WALLET as Wallet Server
    participant BLOCKCHAIN as Blockchain
    
    AI->>STDIO: 1. Check Balance
    STDIO->>WALLET: GET /wallet/balance
    WALLET-->>STDIO: Balance Response
    STDIO-->>AI: Current Balance
    
    AI->>STDIO: 2. Send Funds
    STDIO->>WALLET: POST /wallet/send
    WALLET->>BLOCKCHAIN: Submit Transaction
    BLOCKCHAIN-->>WALLET: Transaction ID
    WALLET-->>STDIO: Transaction Initiated
    STDIO-->>AI: Transaction ID
    
    AI->>STDIO: 3. Check Status
    STDIO->>WALLET: GET /wallet/transaction/{id}
    WALLET-->>STDIO: Transaction Status
    STDIO-->>AI: Status Update
    
    Note over AI,BLOCKCHAIN: Repeat status check until confirmed
```

## Health Check Flow

```mermaid
sequenceDiagram
    participant HEALTH as Health Check
    participant WALLET as Wallet Server
    participant SERVICE as Wallet Service
    participant PROOF as Proof Server
    participant INDEXER as Indexer
    
    HEALTH->>WALLET: GET /health
    WALLET->>SERVICE: Check Wallet Status
    SERVICE->>PROOF: Check Connection
    PROOF-->>SERVICE: Connection Status
    SERVICE->>INDEXER: Check Connection
    INDEXER-->>SERVICE: Connection Status
    SERVICE-->>WALLET: Overall Health
    WALLET-->>HEALTH: Health Response
```

## Configuration Flow

```mermaid
graph TD
    START[Application Start] --> LOAD_ENV[Load Environment]
    LOAD_ENV --> VALIDATE_REQUIRED{Required<br/>Variables?}
    VALIDATE_REQUIRED -->|No| MISSING_CONFIG[Missing Config<br/>Error]
    VALIDATE_REQUIRED -->|Yes| SET_DEFAULTS[Set Defaults]
    SET_DEFAULTS --> EXTERNAL_SERVICES{External<br/>Services?}
    EXTERNAL_SERVICES -->|No| LOCAL_CONFIG[Local Config]
    EXTERNAL_SERVICES -->|Yes| VALIDATE_EXTERNAL{External<br/>URLs Valid?}
    VALIDATE_EXTERNAL -->|No| EXTERNAL_ERROR[External Config<br/>Error]
    VALIDATE_EXTERNAL -->|Yes| EXTERNAL_CONFIG[External Config]
    LOCAL_CONFIG --> INIT_SERVICES[Initialize Services]
    EXTERNAL_CONFIG --> INIT_SERVICES
    INIT_SERVICES --> CONFIG_READY[Configuration Ready]
    
    MISSING_CONFIG --> END[Exit]
    EXTERNAL_ERROR --> END
    CONFIG_READY --> END
    
    style START fill:#e1f5fe
    style CONFIG_READY fill:#e8f5e8
    style MISSING_CONFIG fill:#ffebee
    style EXTERNAL_ERROR fill:#ffebee
``` 