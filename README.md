# Midnight MCP Server

A simple MCP (Model Context Protocol) server implementation with STDIO transport.

## Overview

This server implements the Model Context Protocol and provides two simple tools:

1. `getTimestamp` - Returns the current server timestamp
2. `getServerValue` - Returns a predefined server value ("midnight")

## Usage

### Starting the Server

You can start the server in two ways:

#### Option 1: Directly run the stdio-server.ts file

```bash
npx ts-node-esm src/stdio-server.ts
```

#### Option 2: Run through the index.ts entry point

```bash
npx ts-node-esm src/index.ts
```

### Importing in Your Code

You can also import and use the server in your own code:

```typescript
import { createServer } from './src/index.js';

const server = createServer();
server.start().then(() => {
  console.log("Server started successfully");
}).catch(error => {
  console.error("Failed to start server:", error);
});

// To stop the server
// server.stop();
```

## Tools Documentation

### getTimestamp

Returns the current server timestamp in ISO format.

**Example Response:**
```json
{
  "timestamp": "2023-06-01T12:34:56.789Z"
}
```

### getServerValue

Returns a predefined server value.

**Example Response:**
```json
{
  "serverValue": "midnight"
}
```

## Development

### Dependencies

- Node.js (v16 or higher)
- TypeScript
- @modelcontextprotocol/sdk

### ES Modules Setup

This project uses ES Modules. To ensure correct configuration:

1. Make sure your `package.json` has:
```json
{
  "type": "module"
}
```

2. For TypeScript projects, add to your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run the server:
```bash
npm start
```

## License

[Add your license here]
