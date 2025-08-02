# Midnight MCP System Design

This document contains comprehensive Mermaid diagrams showing the system architecture, API flows, data flow, and deployment scenarios for the Midnight MCP server.

## System Architecture

### Overview Architecture

```mermaid
graph TB
    AI[AI Agent<br/>via MCP] --> STDIO[STDIO Server<br/>MCP Proxy]
    STDIO --> HTTP[HTTP Requests]
    HTTP --> WALLET[Wallet Server<br/>Express.js]
    WALLET --> BLOCKCHAIN[Midnight<br/>Blockchain]
    
    subgraph "MCP Protocol"
        AI
        STDIO
    end
    
    subgraph "HTTP Layer"
        HTTP
    end
    
    subgraph "Wallet Logic"
        WALLET
    end
    
    subgraph "Blockchain"
        BLOCKCHAIN
    end
    
    style AI fill:#e1f5fe
    style STDIO fill:#fff3e0
    style WALLET fill:#f3e5f5
    style BLOCKCHAIN fill:#e8f5e8
```

### Detailed Component Architecture

```mermaid
graph TB
    subgraph "AI Agent Layer"
        AI[AI Agent]
        MCP[MCP Client]
    end
    
    subgraph "MCP Protocol Layer"
        STDIO[STDIO Server]
        TOOLS[Tool Handler]
        RESOURCES[Resource Handler]
    end
    
    subgraph "HTTP Communication Layer"
        HTTP_CLIENT[HTTP Client]
        HTTP_REQUESTS[HTTP Requests]
    end
    
    subgraph "Wallet Server Layer"
        EXPRESS[Express Server]
        CONTROLLER[Wallet Controller]
        SERVICE[Wallet Service]
        SEED_MGR[Seed Manager]
    end
    
    subgraph "Storage Layer"
        FILE_MGR[File Manager]
        DB[Transaction DB]
        SEEDS[Seed Storage]
        BACKUPS[Wallet Backups]
    end
    
    subgraph "External Services"
        PROOF[Proof Server]
        INDEXER[Indexer]
        NODE[Midnight Node]
    end
    
    AI --> MCP
    MCP --> STDIO
    STDIO --> TOOLS
    STDIO --> RESOURCES
    TOOLS --> HTTP_CLIENT
    RESOURCES --> HTTP_CLIENT
    HTTP_CLIENT --> HTTP_REQUESTS
    HTTP_REQUESTS --> EXPRESS
    EXPRESS --> CONTROLLER
    CONTROLLER --> SERVICE
    SERVICE --> SEED_MGR
    SERVICE --> FILE_MGR
    SERVICE --> PROOF
    SERVICE --> INDEXER
    SERVICE --> NODE
    FILE_MGR --> DB
    FILE_MGR --> SEEDS
    FILE_MGR --> BACKUPS
    
    style AI fill:#e1f5fe
    style STDIO fill:#fff3e0
    style EXPRESS fill:#f3e5f5
    style SERVICE fill:#f3e5f5
    style PROOF fill:#e8f5e8
    style INDEXER fill:#e8f5e8
    style NODE fill:#e8f5e8
```

### Security Architecture

```mermaid
graph TB
    subgraph "External Access"
        AI[AI Agent]
        MCP[MCP Protocol]
    end
    
    subgraph "Security Layer"
        STDIO[STDIO Server<br/>Protocol Validation]
        HTTP[HTTP Client<br/>Request Validation]
    end
    
    subgraph "Application Layer"
        WALLET[Wallet Server<br/>Authentication]
        CONTROLLER[Controller<br/>Input Validation]
    end
    
    subgraph "Storage Security"
        SEED_MGR[Seed Manager<br/>Encrypted Storage]
        FILE_MGR[File Manager<br/>Permission Control]
    end
    
    subgraph "Network Security"
        PROOF[Proof Server<br/>TLS/SSL]
        INDEXER[Indexer<br/>Secure Connection]
        NODE[Node<br/>Secure Connection]
    end
    
    AI --> MCP
    MCP --> STDIO
    STDIO --> HTTP
    HTTP --> WALLET
    WALLET --> CONTROLLER
    CONTROLLER --> SEED_MGR
    CONTROLLER --> FILE_MGR
    SEED_MGR --> PROOF
    SEED_MGR --> INDEXER
    SEED_MGR --> NODE
    
    style AI fill:#e1f5fe
    style STDIO fill:#fff3e0
    style WALLET fill:#f3e5f5
    style SEED_MGR fill:#e8f5e8
    style PROOF fill:#e8f5e8
    style INDEXER fill:#e8f5e8
    style NODE fill:#e8f5e8
```

### Multi-Agent Architecture

```mermaid
graph TB
    subgraph "Agent Isolation"
        AGENT1[Agent 1<br/>agent-123]
        AGENT2[Agent 2<br/>agent-456]
        AGENT3[Agent 3<br/>agent-789]
    end
    
    subgraph "Storage Isolation"
        STORAGE1[Storage<br/>agent-123]
        STORAGE2[Storage<br/>agent-456]
        STORAGE3[Storage<br/>agent-789]
    end
    
    subgraph "Docker Containers"
        CONTAINER1[Container<br/>agent-123]
        CONTAINER2[Container<br/>agent-456]
        CONTAINER3[Container<br/>agent-789]
    end
    
    AGENT1 --> CONTAINER1
    AGENT2 --> CONTAINER2
    AGENT3 --> CONTAINER3
    
    CONTAINER1 --> STORAGE1
    CONTAINER2 --> STORAGE2
    CONTAINER3 --> STORAGE3
    
    style AGENT1 fill:#e1f5fe
    style AGENT2 fill:#e1f5fe
    style AGENT3 fill:#e1f5fe
    style CONTAINER1 fill:#fff3e0
    style CONTAINER2 fill:#fff3e0
    style CONTAINER3 fill:#fff3e0
    style STORAGE1 fill:#f3e5f5
    style STORAGE2 fill:#f3e5f5
    style STORAGE3 fill:#f3e5f5
```

## API Flow Diagrams

### Tool Call Flow

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

### Send Funds Flow

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

### Transaction Status Flow

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

### Multi-Step Transaction Flow

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

### Resource Management Flow

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

### Health Check Flow

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

## Data Flow and Processing

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant STDIO as STDIO Server
    participant HTTP as HTTP Client
    participant WALLET as Wallet Server
    participant STORAGE as Storage
    participant EXTERNAL as External Services
    
    AI->>STDIO: Tool Call (walletStatus)
    STDIO->>HTTP: GET /wallet/status
    HTTP->>WALLET: HTTP Request
    WALLET->>STORAGE: Read wallet state
    STORAGE-->>WALLET: Wallet data
    WALLET-->>HTTP: JSON Response
    HTTP-->>STDIO: Response data
    STDIO-->>AI: MCP Response
    
    AI->>STDIO: Tool Call (sendFunds)
    STDIO->>HTTP: POST /wallet/send
    HTTP->>WALLET: HTTP Request
    WALLET->>EXTERNAL: Submit transaction
    EXTERNAL-->>WALLET: Transaction result
    WALLET->>STORAGE: Save transaction
    WALLET-->>HTTP: JSON Response
    HTTP-->>STDIO: Response data
    STDIO-->>AI: MCP Response
```

### Wallet Initialization Flow

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

### Configuration Flow

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

## Error Handling and Validation

### Error Handling Flow

```mermaid
graph TD
    START[Tool Call] --> VALIDATE{Validate<br/>Parameters}
    VALIDATE -->|Invalid| ERROR_PARAMS[Invalid Parameters<br/>Error]
    VALIDATE -->|Valid| HTTP_CALL[HTTP Request]
    HTTP_CALL --> HTTP_SUCCESS{HTTP<br/>Success?}
    HTTP_SUCCESS -->|No| HTTP_ERROR[HTTP Error<br/>Response]
    HTTP_SUCCESS -->|Yes| WALLET_READY{Wallet<br/>Ready?}
    WALLET_READY -->|No| WALLET_ERROR[Wallet Not Ready<br/>Error]
    WALLET_READY -->|Yes| EXECUTE[Execute<br/>Operation]
    EXECUTE --> SUCCESS{Operation<br/>Success?}
    SUCCESS -->|No| OPERATION_ERROR[Operation<br/>Error]
    SUCCESS -->|Yes| SUCCESS_RESPONSE[Success<br/>Response]
    
    ERROR_PARAMS --> END[Return Error]
    HTTP_ERROR --> END
    WALLET_ERROR --> END
    OPERATION_ERROR --> END
    SUCCESS_RESPONSE --> END
    
    style START fill:#e1f5fe
    style SUCCESS_RESPONSE fill:#e8f5e8
    style ERROR_PARAMS fill:#ffebee
    style HTTP_ERROR fill:#ffebee
    style WALLET_ERROR fill:#ffebee
    style OPERATION_ERROR fill:#ffebee
```

### API Error Handling Flow

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

## Deployment Scenarios

### Development vs Production Deployment

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_AI[AI Agent]
        DEV_STDIO[STDIO Server<br/>Local]
        DEV_WALLET[Wallet Server<br/>Local]
        DEV_STORAGE[Local Storage]
    end
    
    subgraph "Production Environment"
        PROD_AI[AI Agent]
        PROD_STDIO[STDIO Server<br/>Container]
        PROD_WALLET[Wallet Server<br/>Container]
        PROD_PROOF[Proof Server<br/>Container]
        PROD_STORAGE[Persistent Volumes]
    end
    
    DEV_AI --> DEV_STDIO
    DEV_STDIO --> DEV_WALLET
    DEV_WALLET --> DEV_STORAGE
    
    PROD_AI --> PROD_STDIO
    PROD_STDIO --> PROD_WALLET
    PROD_WALLET --> PROD_PROOF
    PROD_WALLET --> PROD_STORAGE
    PROD_PROOF --> PROD_STORAGE
    
    style DEV_AI fill:#e1f5fe
    style PROD_AI fill:#e1f5fe
    style DEV_STDIO fill:#fff3e0
    style PROD_STDIO fill:#fff3e0
    style DEV_WALLET fill:#f3e5f5
    style PROD_WALLET fill:#f3e5f5
    style PROD_PROOF fill:#e8f5e8
``` 