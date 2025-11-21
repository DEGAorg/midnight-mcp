# StreamableHTTP Transport Research for Midnight MCP

**Research Date:** 2025-11-21
**MCP Specification Version:** 2025-03-26
**Researcher:** Technical Research Agent

---

## Executive Summary

This research investigates **StreamableHTTPServerTransport** from the Model Context Protocol (MCP) SDK for implementing HTTP-based transport to support multi-agent deployments of the Midnight MCP server. The current implementation uses STDIO transport, which works for single-agent development but cannot scale to production multi-agent scenarios.

### Key Findings

1. **StreamableHTTP is production-ready** - Official SDK support, comprehensive documentation, real-world implementations
2. **Three deployment modes** - Stateless (serverless), stateful with sessions (small-medium scale), stateful with Redis (100+ agents)
3. **Midnight MCP architecture is compatible** - Existing `MCPServer` and services can be reused unchanged
4. **Hybrid approach recommended** - Support both STDIO (development) and HTTP (production) from same codebase
5. **Implementation effort** - 4-8 hours for POC, 28-48 hours for production-ready, 68-108 hours for enterprise scale with Redis

---

## Table of Contents

1. [Background](#background)
2. [StreamableHTTP Overview](#streamablehttp-overview)
3. [Session Management](#session-management)
4. [Architecture Patterns](#architecture-patterns)
5. [Implementation Recommendations](#implementation-recommendations)
6. [Code Examples](#code-examples)
7. [Deployment Strategies](#deployment-strategies)
8. [References](#references)

---

## Background

### Current Midnight MCP Architecture

**Transport:** STDIO only (`StdioServerTransport`)
**Entry Point:** `src/mcp/stdio-server.ts`
**Server Class:** `MCPServer` (src/mcp/server.ts)
**Service Orchestration:** `WalletOrchestrator` creates per-agent services
**Agent Isolation:** Per-agent via `AGENT_ID` env var, separate wallet files

**Problem:** STDIO transport cannot support multiple concurrent agents or network-accessible deployments.

### Why StreamableHTTP?

- **Multi-agent support** - Single server handles 10-100+ concurrent agents
- **Cloud deployment** - Works with load balancers, API gateways, Kubernetes
- **Session management** - Built-in session IDs and resumability
- **Horizontal scaling** - Can scale across multiple servers with Redis
- **Production infrastructure** - Health checks, metrics, monitoring
- **Flexible deployment** - Serverless (Lambda) or long-running servers (ECS/K8s)

---

## StreamableHTTP Overview

### Protocol Specification (2025-03-26)

StreamableHTTP consolidates all MCP communication through a single endpoint that handles:

- **POST /mcp** - Client-to-server messages (initialization, tool calls, etc.)
- **GET /mcp** - Server-Sent Events (SSE) streams for server-to-client notifications
- **DELETE /mcp** - Session termination

### Key Features

1. **Session Management**
   - Server assigns unique session IDs via `Mcp-Session-Id` header
   - Client includes session ID on all subsequent requests
   - Server returns HTTP 404 for invalid/expired sessions

2. **Connection Resumability**
   - Clients reconnect with `Last-Event-ID` header
   - Server replays missed events from event store
   - Enables recovery from network interruptions

3. **Flexible Response Modes**
   - Standard HTTP JSON response
   - Streaming SSE response (content-type: text/event-stream)
   - Long-lived SSE connections for notifications

4. **Security**
   - Validate `Origin` headers (prevent DNS rebinding)
   - Bind to 127.0.0.1 for local deployments
   - Implement authentication/authorization

---

## Session Management

### Three Modes Explained

#### 1. Stateless Mode

**Configuration:** `sessionIdGenerator: undefined`

**How it works:**
- Each request creates fresh transport instance
- No state retained between requests
- No session tracking needed

**Use cases:**
- AWS Lambda / serverless functions
- Simple request-response patterns
- Auto-scaling environments (Kubernetes HPA)

**Pros:**
- Unlimited horizontal scaling
- No session affinity needed
- Simplified infrastructure
- Scale to zero support

**Cons:**
- No conversation context
- Cannot resume connections
- No server-push capabilities

---

#### 2. Stateful Mode (In-Memory)

**Configuration:** `sessionIdGenerator: () => randomUUID()`

**How it works:**
- Server maintains Map<sessionId, transport>
- Sessions persist for duration of conversation
- Supports SSE push notifications
- Event replay on reconnection

**Use cases:**
- Interactive AI agents (10-50 concurrent)
- Conversation history preservation
- Long-running workflows
- Real-time notifications

**Pros:**
- Rich conversation context
- Session resumability
- Server-push via SSE
- Better for complex workflows

**Cons:**
- Requires sticky sessions (unless Redis)
- Higher memory per client
- Session lost on server restart
- Scaling limitations

---

#### 3. Stateful Mode with Redis

**Configuration:** `sessionIdGenerator: () => randomUUID()` + Redis storage

**How it works:**
- Sessions stored in Redis as JSON
- Events stored in Redis Streams
- Any server can reconstruct session
- No sticky sessions needed

**Use cases:**
- 100+ concurrent agents
- High availability requirements
- Multi-region deployments
- Load-balanced clusters

**Pros:**
- Full session preservation
- No sticky sessions needed
- Unlimited horizontal scaling
- Survives node failures

**Cons:**
- Requires Redis infrastructure
- Additional latency
- More complex deployment
- No official SDK support (custom implementation needed)

---

## Architecture Patterns

### Official Reference Implementation

From `modelcontextprotocol/servers - everything/streamableHttp.ts`:

```typescript
// Session storage
const transports = new Map<string, StreamableHTTPServerTransport>();

// POST handler - initialization and messages
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && transports.has(sessionId)) {
    // Reuse existing session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
  } else if (!sessionId) {
    // Create new session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
      }
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } else {
    res.status(400).json({ error: 'Invalid session' });
  }
});

// GET handler - SSE streams
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE handler - session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session' });
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});
```

### CORS Configuration

```typescript
app.use(cors({
  origin: '*',  // Configure appropriately for production
  methods: 'GET,POST,DELETE',
  exposedHeaders: [
    'mcp-session-id',
    'last-event-id',
    'mcp-protocol-version'
  ]
}));
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  httpServer.close(async () => {
    // Clean up all sessions
    for (const [sessionId, transport] of transports) {
      await transport.close();
      transports.delete(sessionId);
    }

    process.exit(0);
  });

  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 30000);
});
```

---

## Implementation Recommendations

### For Midnight MCP: Hybrid Architecture

**Recommendation:** Support both STDIO and HTTP transports from same codebase.

**Why:**
- STDIO for development (Claude Desktop, local testing)
- StreamableHTTP for production (multi-agent deployment)
- Single codebase, two deployment modes
- No code duplication in services/logic

**Architecture:**

```
┌─────────────────────────────────────────────┐
│           Main Entry Point                   │
│         src/mcp/index.ts                     │
│  (Choose transport via TRANSPORT env var)    │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│ STDIO Mode  │  │  HTTP Mode   │
│ (Dev)       │  │ (Production) │
└──────┬──────┘  └──────┬───────┘
       │                │
       └────────┬────────┘
                │
        ┌───────▼────────┐
        │   MCPServer    │  ← Shared
        │  (server.ts)   │
        └───────┬────────┘
                │
        ┌───────▼────────────┐
        │ ServiceDependencies│  ← Shared
        │  - WalletService   │
        │  - TokenService    │
        │  - DaoService      │
        │  - ...             │
        └────────────────────┘
```

### Phased Implementation Plan

#### Phase 1: Stateless POC (4-8 hours)

**Goal:** Prove StreamableHTTP works with existing architecture

**Scope:**
- Create `src/mcp/http-server-stateless.ts`
- Single POST /mcp endpoint
- Stateless mode (each request independent)
- Reuse existing MCPServer class

**Testing:** MCP Inspector, simple tool calls

**Outcome:** Validate that HTTP transport works, measure baseline performance

---

#### Phase 2: Stateful Sessions (8-16 hours)

**Goal:** Support multiple concurrent agents with session management

**Scope:**
- Change to `sessionIdGenerator: () => randomUUID()`
- Add session storage: `Map<sessionId, SessionContext>`
- Session lifecycle management (create/reuse/cleanup)
- Health checks (/health, /health/ready)
- Metrics endpoint (/metrics)

**SessionContext:**
```typescript
interface SessionContext {
  transport: StreamableHTTPServerTransport;
  orchestrator: WalletOrchestrator;
  services: ServiceDependencies;
  agentId: string;
  createdAt: Date;
}
```

**Testing:** Multiple concurrent MCP clients

**Outcome:** Production-ready multi-agent support (10-50 concurrent)

---

#### Phase 3: Production Hardening (16-24 hours)

**Goal:** Production-ready with monitoring and resilience

**Scope:**
- Comprehensive error handling
- Request/response logging
- Session timeout (1 hour default)
- Max sessions limit
- Graceful shutdown
- Prometheus metrics
- Docker deployment
- Kubernetes manifests
- Load testing
- Documentation

**Outcome:** Production-grade deployment

---

#### Phase 4: Redis Scaling (40-60 hours)

**Goal:** Support 100+ concurrent agents with Redis

**Scope:**
- Implement `RedisSessionStore` class
- Store session state in Redis JSON
- Store events in Redis Streams
- Session reconstruction from Redis
- Redis health checks
- Multi-instance deployment testing

**Note:** Only needed for >50 concurrent agents or HA requirements

**Complexity:** High - no SDK support, custom implementation required

**Reference:** mcp-db (Python) for patterns

---

## Code Examples

### 1. Stateless Express Server

**File:** `src/mcp/http-server-stateless.ts`

```typescript
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCPServer } from './server.js';
import { initializeServices } from './stdio-server.js';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  try {
    // Create fresh services for each request (stateless)
    const { services, orchestrator } = await initializeServices();
    const mcpServer = new MCPServer(services, {
      name: 'midnight-mcp',
      version: '2.0.0'
    });
    const server = mcpServer.getServer();

    // Create stateless transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', async () => {
      await orchestrator.stop();
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null
      });
    }
  }
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
  console.log(`MCP HTTP Server (stateless) on http://localhost:${port}/mcp`);
});
```

**Usage:**
```bash
TRANSPORT=http PORT=3000 node dist/mcp/http-server-stateless.js
```

---

### 2. Stateful Express Server

**File:** `src/mcp/http-server-stateful.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { MCPServer } from './server.js';
import type { ServiceDependencies } from './types.js';
import { WalletOrchestrator } from '../services/WalletOrchestrator.js';
import { initializeServices } from './stdio-server.js';

interface SessionContext {
  transport: StreamableHTTPServerTransport;
  orchestrator: WalletOrchestrator;
  services: ServiceDependencies;
  agentId: string;
  createdAt: Date;
}

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: 'GET,POST,DELETE',
  exposedHeaders: ['mcp-session-id', 'last-event-id', 'mcp-protocol-version']
}));

const sessions = new Map<string, SessionContext>();

// POST handler - initialization and messages
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Reuse existing session
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res, req.body);
  } else if (!sessionId) {
    // Create new session
    const { services, orchestrator } = await initializeServices();
    const mcpServer = new MCPServer(services, {
      name: 'midnight-mcp',
      version: '2.0.0'
    });
    const server = mcpServer.getServer();
    const eventStore = new InMemoryEventStore();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore,
      onsessioninitialized: (sid) => {
        sessions.set(sid, {
          transport,
          orchestrator,
          services,
          agentId: process.env.AGENT_ID || 'default',
          createdAt: new Date()
        });
        console.log(`Session created: ${sid}`);
      }
    });

    server.onclose = async () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        const session = sessions.get(sid)!;
        await session.orchestrator.stop();
        sessions.delete(sid);
        console.log(`Session closed: ${sid}`);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid session' },
      id: null
    });
  }
});

// GET handler - SSE streams
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid session' },
      id: null
    });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

// DELETE handler - session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid session' },
      id: null
    });
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

// Health checks
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    sessions: sessions.size,
    uptime: process.uptime()
  });
});

app.get('/health/ready', async (req, res) => {
  const ready = sessions.size < 100; // Max sessions check
  res.status(ready ? 200 : 503).json({ ready, sessions: sessions.size });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = [
    '# HELP mcp_sessions_active Active session count',
    '# TYPE mcp_sessions_active gauge',
    `mcp_sessions_active ${sessions.size}`,
    '# HELP mcp_server_uptime_seconds Server uptime',
    '# TYPE mcp_server_uptime_seconds counter',
    `mcp_server_uptime_seconds ${process.uptime()}`
  ];
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.join('\\n'));
});

// Start server
const port = parseInt(process.env.PORT || '3000');
const httpServer = app.listen(port, () => {
  console.log(`MCP HTTP Server (stateful) on http://localhost:${port}/mcp`);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);

  httpServer.close(async () => {
    console.log('HTTP server closed');

    console.log(`Cleaning up ${sessions.size} active sessions...`);
    for (const [sid, session] of sessions) {
      try {
        await session.orchestrator.stop();
        session.transport.close();
        sessions.delete(sid);
      } catch (error) {
        console.error(`Error closing session ${sid}:`, error);
      }
    }

    console.log('All sessions cleaned up');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

### 3. Hybrid Main Entry Point

**File:** `src/mcp/index.ts`

```typescript
import { createStdioServer } from './stdio-server.js';
import { createHttpServer } from './http-server.js';

const transport = process.env.TRANSPORT || 'stdio';

async function main() {
  if (transport === 'stdio') {
    console.error('Starting MCP server with STDIO transport');
    const server = await createStdioServer();
    await server.start();
  } else if (transport === 'http') {
    console.error('Starting MCP server with HTTP transport');
    const server = await createHttpServer();
    await server.start();
  } else {
    throw new Error(`Unknown transport: ${transport}`);
  }
}

main().catch(console.error);
```

**Usage:**
```bash
# Development with STDIO
TRANSPORT=stdio node dist/mcp/index.js

# Production with HTTP
TRANSPORT=http PORT=3000 node dist/mcp/index.js
```

---

## Deployment Strategies

### Kubernetes Deployment

**Deployment manifest:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: midnight-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: midnight-mcp
  template:
    metadata:
      labels:
        app: midnight-mcp
    spec:
      containers:
      - name: mcp-server
        image: midnight-mcp:latest
        env:
        - name: TRANSPORT
          value: http
        - name: PORT
          value: "3000"
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          limits:
            memory: 2Gi
            cpu: 1000m
          requests:
            memory: 1Gi
            cpu: 500m
```

**Service manifest:**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: midnight-mcp
spec:
  type: LoadBalancer
  selector:
    app: midnight-mcp
  ports:
  - port: 80
    targetPort: 3000
  sessionAffinity: ClientIP  # For stateful sessions without Redis
```

**Horizontal Pod Autoscaler:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: midnight-mcp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: midnight-mcp
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

### Docker Compose

```yaml
version: '3.8'
services:
  mcp-server:
    build: .
    environment:
      - TRANSPORT=http
      - PORT=3000
      - REDIS_URL=redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

---

## Best Practices

### Performance

1. **Connection Limits:** 10-15 connections per CPU core
2. **Timeouts:** 5-10 seconds for tool calls, 30 seconds for initialization
3. **SSE Heartbeats:** Send every 30 seconds to prevent proxy timeouts
4. **Request Queuing:** For rate-limited external APIs
5. **Connection Pooling:** For database access

### Security

1. **Validate Origin header** - Prevent DNS rebinding attacks
2. **Bind to 127.0.0.1** - For local deployments (not 0.0.0.0)
3. **Implement authentication** - JWT, API keys, or OAuth
4. **Rate limiting** - Per-IP or per-session
5. **CORS configuration** - Appropriate origin restrictions

### Monitoring

1. **Health checks** - /health (liveness), /health/ready (readiness)
2. **Metrics** - Prometheus endpoint with session count, request rate, errors
3. **Logging** - Structured logging for requests/responses
4. **Alerting** - Error rate, latency p95/p99, session count thresholds

### Reliability

1. **Graceful shutdown** - 30 second timeout for cleanup
2. **Session cleanup** - Remove expired sessions (1 hour default)
3. **Max sessions limit** - Prevent resource exhaustion
4. **Circuit breakers** - For external service calls
5. **Retry logic** - With exponential backoff

---

## Scaling Recommendations

| Concurrent Agents | Architecture | Session Storage | Infrastructure | Notes |
|------------------|--------------|-----------------|----------------|-------|
| 1-10 | Stateless or Stateful | In-memory Map | Single server | Simple deployment |
| 10-50 | Stateful | In-memory Map | 2-3 servers + sticky sessions | Consider Redis |
| 50-100 | Stateful | Redis (recommended) | 3-5 servers | Redis enables better scaling |
| 100-500 | Stateful | Redis (required) | 5-10 servers | Standard load balancing |
| 500+ | Stateful | Redis Cluster | 10+ servers + K8s HPA | Monitoring essential |

---

## Common Pitfalls

1. **Missing Mcp-Session-Id header** → HTTP 400 errors
2. **InMemoryEventStore** → Not suitable for horizontal scaling
3. **SSE timeout** → Proxies may close idle connections after 60s
4. **CORS errors** → mcp-session-id must be in exposedHeaders
5. **Memory leaks** → Transports not cleaned up on close
6. **Session lost** → On server restart without Redis persistence
7. **Race conditions** → Session tracking not in onsessioninitialized
8. **Sticky sessions required** → For stateful without Redis

---

## Comparison: STDIO vs HTTP

| Aspect | STDIO Transport | StreamableHTTP Transport |
|--------|----------------|-------------------------|
| **Architecture** | Child process, stdin/stdout | HTTP server, REST + SSE |
| **Connection Model** | Single persistent | On-demand, multiple concurrent |
| **Deployment** | Local process | Network-accessible server |
| **Scalability** | Single machine | Horizontal scaling |
| **Infrastructure** | None required | Load balancers, CDNs, etc. |
| **Session Recovery** | Not supported | Built-in with Last-Event-ID |
| **Best For** | Development, local testing | Production, multi-agent |
| **Current Midnight Use** | Primary (all dev/testing) | Not yet implemented |
| **Recommended For** | Claude Desktop, debugging | Cloud deployment, >1 agent |

---

## References

### Official Documentation

1. [MCP Transports Specification (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
2. [TypeScript SDK - StreamableHTTPServerTransport](https://github.com/modelcontextprotocol/typescript-sdk)
3. [MCP Servers - Everything Example](https://github.com/modelcontextprotocol/servers/blob/main/src/everything/streamableHttp.ts)

### Implementation Guides

4. [StreamableHTTP for Scalable Deployments](https://mcpcat.io/guides/setting-up-streamablehttp-scalable-deployments/)
5. [Configure MCP for Multiple Connections](https://mcpcat.io/guides/configuring-mcp-servers-multiple-simultaneous-connections/)
6. [Build Health Check Endpoints](https://mcpcat.io/guides/building-health-check-endpoint-mcp-server/)

### Community Resources

7. [mcp-db - Redis Session Store (Python)](https://github.com/bh-rat/mcp-db) - Experimental
8. [AWS Serverless MCP Servers](https://github.com/aws-samples/sample-serverless-mcp-servers)
9. [Deploy to Koyeb Tutorial](https://www.koyeb.com/tutorials/deploy-remote-mcp-servers-to-koyeb-using-streamable-http-transport)

### Technical Analysis

10. [Why MCP Switched from SSE to StreamableHTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)

---

## Next Steps

### Immediate Actions

1. **Create Phase 1 POC** - Stateless HTTP server (4-8 hours)
2. **Test with MCP Inspector** - Validate tool calls work over HTTP
3. **Measure baseline performance** - Latency, memory usage
4. **Document findings** - Share with team

### Short-term (1-2 weeks)

1. **Implement Phase 2** - Stateful session management (8-16 hours)
2. **Add monitoring** - Health checks, metrics, logging
3. **Load testing** - Simulate 10-50 concurrent agents
4. **Production deployment guide** - Docker, Kubernetes manifests

### Long-term (If needed)

1. **Phase 4 - Redis scaling** - Only if >50 concurrent agents needed
2. **Multi-region deployment** - For global availability
3. **Advanced features** - Rate limiting, caching, analytics

---

## Conclusion

StreamableHTTP transport is **production-ready and well-supported** for multi-agent MCP deployments. The Midnight MCP architecture is **fully compatible** - only the transport layer needs to change.

**Recommended approach:**
- Start with **Phase 1 (stateless POC)** to validate (4-8 hours)
- Proceed to **Phase 2 (stateful sessions)** for production (8-16 hours)
- Defer **Phase 4 (Redis)** until actually needed (>50 agents)

Total effort for production-ready multi-agent support: **28-48 hours** (Phases 1+2+3)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Full JSON Report:** `docs/research/streamable-http-transport-research.json`
