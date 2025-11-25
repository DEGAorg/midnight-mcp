/**
 * HTTP API Server
 *
 * Express server that exposes wallet and blockchain operations via HTTP endpoints.
 * Uses WalletOrchestrator for all operations with a professional middleware stack.
 *
 * Architecture:
 *   HTTP Request -> Middleware -> Routes -> Controllers -> Services
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pkg from 'body-parser';
const { json } = pkg;

import { createApiRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/index.js';
import type { WalletOrchestrator } from '@services/WalletOrchestrator.js';
import { createLogger } from '@lib/logger/index.js';
import type { Logger } from 'pino';

/**
 * API Server Configuration
 */
export interface ApiServerConfig {
  /** Port to listen on */
  port: number;
  /** WalletOrchestrator instance */
  orchestrator: WalletOrchestrator;
  /** Optional CORS options */
  corsOptions?: cors.CorsOptions;
  /** Enable request logging (default: true) */
  enableLogging?: boolean;
}

/**
 * API Server
 *
 * Professional Express server with:
 * - Helmet for security headers
 * - CORS support
 * - Request logging with request IDs
 * - Centralized error handling
 * - Organized route structure
 */
export class ApiServer {
  private app: express.Application;
  private server?: ReturnType<typeof express.application.listen>;
  private logger: Logger;
  private config: ApiServerConfig;

  constructor(config: ApiServerConfig) {
    this.config = config;
    this.logger = createLogger('api-server');
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware stack
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }));

    // CORS
    this.app.use(cors(this.config.corsOptions ?? {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));

    // Body parsing
    this.app.use(json({ limit: '1mb' }));

    // Request logging (optional)
    if (this.config.enableLogging !== false) {
      this.app.use(requestLogger);
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Create and mount API routes
    const apiRoutes = createApiRoutes(this.config.orchestrator);

    // Mount at /api prefix
    this.app.use('/api', apiRoutes);

    // Also mount at root for backwards compatibility
    this.app.use('/', apiRoutes);
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler for undefined routes
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        this.logger.info({
          port: this.config.port,
          endpoints: {
            health: '/api/health',
            wallet: '/api/wallet/*',
            tokens: '/api/tokens/*',
            dao: '/api/dao/*',
            marketplace: '/api/marketplace/*',
          },
        }, `API server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          this.logger.error({ err }, 'Error closing server');
          reject(err);
        } else {
          this.logger.info('API server closed');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}

/**
 * Create and start API server
 */
export async function startApiServer(config: ApiServerConfig): Promise<ApiServer> {
  const server = new ApiServer(config);
  await server.start();
  return server;
}
