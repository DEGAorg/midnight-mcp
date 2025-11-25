/* istanbul ignore file */

import { ILogger } from './types.js';
import pino from 'pino';

export class PinoLogger implements ILogger {
  private logger = pino();

  info(message: string, meta?: any) { this.logger.info(meta, message); }
  warn(message: string, meta?: any) { this.logger.warn(meta, message); }
  error(message: string, meta?: any) { this.logger.error(meta, message); }
  debug(message: string, meta?: any) { this.logger.debug(meta, message); }
} 