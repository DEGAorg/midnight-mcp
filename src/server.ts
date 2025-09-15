import express, { Router, RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pkg from 'body-parser';
const { json } = pkg;
import { WalletServiceMCP } from './mcp/index.js';
import { WalletController } from './controllers/wallet.controller.js';
import { config } from './config.js';
import { SeedManager } from './utils/seed-manager.js';
import { createLogger } from './logger/index.js';

const app = express();
const router = Router();
const port = process.env.PORT || 3000;
const logger = createLogger('server');

// Middleware
app.use(helmet());
app.use(cors());
app.use(json());

// Initialize services

const seed = SeedManager.getAgentSeed(config.agentId);
const externalConfig = {
  proofServer: config.proofServer,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  useExternalProofServer: config.useExternalProofServer,
  networkId: config.networkId
};

const walletService = new WalletServiceMCP(
  config.networkId,
  seed,
  config.walletFilename,
  externalConfig
);

// Initialize controller
const walletController = new WalletController(walletService);

// Register routes with bound methods
const routes = [
  { method: 'get', path: '/wallet/status', handler: walletController.getStatus },
  { method: 'get', path: '/wallet/address', handler: walletController.getAddress },
  { method: 'get', path: '/wallet/balance', handler: walletController.getBalance },
  { method: 'post', path: '/wallet/send', handler: walletController.sendFunds },
  { method: 'post', path: '/wallet/verify-transaction', handler: walletController.verifyTransaction },
  { method: 'get', path: '/wallet/transaction/:transactionId', handler: walletController.getTransactionStatus },
  { method: 'get', path: '/wallet/transactions', handler: walletController.getTransactions },
  { method: 'get', path: '/wallet/pending-transactions', handler: walletController.getPendingTransactions },
  { method: 'get', path: '/wallet/config', handler: walletController.getWalletConfig },
  { method: 'get', path: '/health', handler: walletController.healthCheck },
  // Token routes
  { method: 'get', path: '/wallet/tokens/balance/:tokenName', handler: walletController.getTokenBalance },
  { method: 'post', path: '/wallet/tokens/send', handler: walletController.sendToken },
  { method: 'get', path: '/wallet/tokens/list', handler: walletController.listTokens },
  { method: 'post', path: '/wallet/tokens/register', handler: walletController.registerToken },
  { method: 'post', path: '/wallet/tokens/batch', handler: walletController.registerTokensBatch },
  { method: 'post', path: '/wallet/tokens/register-from-env', handler: walletController.registerTokensFromEnv },
  { method: 'get', path: '/wallet/tokens/config-template', handler: walletController.getTokenEnvConfigTemplate },
  { method: 'get', path: '/wallet/tokens/stats', handler: walletController.getTokenRegistryStats },
  // Marketplace routes
  { method: 'post', path: '/marketplace/register', handler: walletController.registerInMarketplace },
  { method: 'post', path: '/marketplace/verify', handler: walletController.verifyUserInMarketplace }
] as const;

// Register all routes
routes.forEach(({ method, path, handler }) => {
  const boundHandler = (handler as RequestHandler).bind(walletController);
  /* istanbul ignore else */
  if (method === 'get') {
    router.get(path, boundHandler);
  } else if (method === 'post') {
    router.post(path, boundHandler);

  } else if (method === 'put') {
    router.put(path, boundHandler);
    
  } else if (method === 'delete') {
    router.delete(path, boundHandler);
  }
});

// Mount router
app.use(router);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server...');
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await walletService.close();
      logger.info('Wallet service closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Closing HTTP server...');
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await walletService.close();
      logger.info('Wallet service closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
});

export { app, server };