/* istanbul ignore file */

import { ILogger } from './types.js';

export class SentryLogger implements ILogger {
  private sentry: any;

  constructor() {
    // Try to load Sentry dynamically, but don't fail if it's not installed
    try {
      this.sentry = require('@sentry/node');
    } catch (error) {
      console.warn('@sentry/node not installed, SentryLogger will log to console instead');
      this.sentry = null;
    }
  }

  info(message: string, meta?: any) {
    if (this.sentry) {
      this.sentry.captureMessage(message, { level: 'info', ...meta });
    } else {
      console.log(`[INFO] ${message}`, meta);
    }
  }
  
  warn(message: string, meta?: any) {
    if (this.sentry) {
      this.sentry.captureMessage(message, { level: 'warning', ...meta });
    } else {
      console.warn(`[WARN] ${message}`, meta);
    }
  }
  
  error(message: string, meta?: any) {
    if (this.sentry) {
      this.sentry.captureException(meta?.error || new Error(message));
    } else {
      console.error(`[ERROR] ${message}`, meta);
    }
  }
  
  debug(message: string, meta?: any) {
    if (this.sentry) {
      this.sentry.captureMessage(message, { level: 'debug', ...meta });
    } else {
      console.debug(`[DEBUG] ${message}`, meta);
    }
  }
} 