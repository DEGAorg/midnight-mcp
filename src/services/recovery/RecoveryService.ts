/**
 * Recovery Service
 *
 * Handles wallet recovery with exponential backoff and jitter.
 * Prevents thundering herd problem in multi-agent deployments.
 *
 * Uses industry best practices:
 * - Exponential backoff: Wait time doubles each attempt
 * - Jitter: Random variance prevents synchronized retries
 * - Max attempts: Prevents infinite retry loops
 * - Concurrent prevention: Only one recovery at a time
 */

import { createLogger } from '@lib/logger/index.js';
import { RECOVERY_CONFIG } from '@lib/config/constants.js';
import type { Logger } from 'pino';

export interface RecoveryOptions {
  /** Maximum number of recovery attempts (default from config) */
  maxAttempts?: number;

  /** Base backoff time in milliseconds (default from config) */
  baseBackoffMs?: number;

  /** Maximum backoff time in milliseconds (default from config) */
  maxBackoffMs?: number;

  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;

  /** Jitter factor for randomization (default: 0.3 for ±30%) */
  jitterFactor?: number;
}

export interface RecoveryState {
  /** Current number of recovery attempts */
  attempts: number;

  /** Whether recovery is currently in progress */
  isRecovering: boolean;

  /** Last recovery attempt timestamp */
  lastAttemptTime?: number;

  /** Last recovery error */
  lastError?: Error;
}

export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;

  /** Number of attempts made */
  attempts: number;

  /** Total time spent in recovery (ms) */
  totalTimeMs: number;

  /** Error if recovery failed */
  error?: Error;
}

/**
 * RecoveryService handles wallet recovery with exponential backoff and jitter
 */
export class RecoveryService {
  private logger: Logger;
  private options: Required<RecoveryOptions>;

  private recoveryState: RecoveryState = {
    attempts: 0,
    isRecovering: false,
  };

  constructor(options: RecoveryOptions = {}) {
    this.logger = createLogger('recovery-service');

    this.options = {
      maxAttempts: options.maxAttempts ?? RECOVERY_CONFIG.MAX_ATTEMPTS,
      baseBackoffMs: options.baseBackoffMs ?? RECOVERY_CONFIG.BASE_BACKOFF_MS,
      maxBackoffMs: options.maxBackoffMs ?? RECOVERY_CONFIG.MAX_BACKOFF_MS,
      backoffMultiplier: options.backoffMultiplier ?? RECOVERY_CONFIG.BACKOFF_MULTIPLIER,
      jitterFactor: options.jitterFactor ?? RECOVERY_CONFIG.JITTER_FACTOR,
    };

    this.logger.info('Recovery service initialized with options:', this.options);
  }

  /**
   * Attempt recovery with exponential backoff and jitter
   *
   * @param recoveryFn Function to execute for recovery
   * @param reason Reason for recovery attempt
   * @returns Recovery result
   *
   * @example
   * ```typescript
   * const result = await recoveryService.attemptRecovery(
   *   async () => await wallet.rebuild(),
   *   'Subscription error'
   * );
   *
   * if (result.success) {
   *   console.log(`Recovered after ${result.attempts} attempts`);
   * }
   * ```
   */
  async attemptRecovery(
    recoveryFn: () => Promise<void>,
    reason: string
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    // Prevent concurrent recovery
    if (this.recoveryState.isRecovering) {
      this.logger.warn('Recovery already in progress, skipping new attempt');
      return {
        success: false,
        attempts: this.recoveryState.attempts,
        totalTimeMs: 0,
        error: new Error('Recovery already in progress'),
      };
    }

    this.recoveryState.isRecovering = true;
    this.recoveryState.attempts = 0;

    try {
      while (this.recoveryState.attempts < this.options.maxAttempts) {
        this.recoveryState.attempts++;
        this.recoveryState.lastAttemptTime = Date.now();

        this.logger.warn(
          `Recovery attempt ${this.recoveryState.attempts}/${this.options.maxAttempts}. Reason: ${reason}`
        );

        // Calculate backoff with jitter
        const backoffMs = this.calculateBackoffWithJitter(this.recoveryState.attempts);

        if (this.recoveryState.attempts > 1) {
          this.logger.info(`Waiting ${Math.round(backoffMs)}ms before recovery attempt`);
          await this.sleep(backoffMs);
        }

        try {
          // Attempt recovery
          await recoveryFn();

          // Success! Reset state and return
          const totalTimeMs = Date.now() - startTime;
          this.logger.info(
            `Recovery successful after ${this.recoveryState.attempts} attempts (${totalTimeMs}ms)`
          );

          const result: RecoveryResult = {
            success: true,
            attempts: this.recoveryState.attempts,
            totalTimeMs,
          };

          // Reset recovery state on success
          this.recoveryState.attempts = 0;
          this.recoveryState.lastError = undefined;

          return result;
        } catch (error) {
          this.recoveryState.lastError = error as Error;
          this.logger.error(
            `Recovery attempt ${this.recoveryState.attempts} failed:`,
            error
          );

          // Continue to next attempt if not at max
          if (this.recoveryState.attempts < this.options.maxAttempts) {
            this.logger.info('Will retry recovery...');
          }
        }
      }

      // Max attempts exceeded
      const totalTimeMs = Date.now() - startTime;
      this.logger.error(
        `Recovery failed after ${this.recoveryState.attempts} attempts (${totalTimeMs}ms)`
      );

      return {
        success: false,
        attempts: this.recoveryState.attempts,
        totalTimeMs,
        error: new Error(
          `Recovery failed after ${this.options.maxAttempts} attempts. Last error: ${this.recoveryState.lastError?.message}`
        ),
      };
    } finally {
      this.recoveryState.isRecovering = false;
    }
  }

  /**
   * Calculate backoff time with exponential growth and jitter
   *
   * Formula:
   * 1. Exponential: baseBackoff * (multiplier ^ (attempt - 1))
   * 2. Cap at max: min(exponential, maxBackoff)
   * 3. Add jitter: cappedDelay ± (cappedDelay * jitterFactor * random(-1, 1))
   *
   * @param attempt Current attempt number (1-indexed)
   * @returns Backoff time in milliseconds
   *
   * @example
   * With defaults (base=5000, multiplier=2, jitter=0.3):
   * Attempt 1: 5000ms ± 1500ms  = 3500-6500ms
   * Attempt 2: 10000ms ± 3000ms = 7000-13000ms
   * Attempt 3: 20000ms ± 6000ms = 14000-26000ms
   */
  private calculateBackoffWithJitter(attempt: number): number {
    // Calculate exponential backoff: base * (multiplier ^ (attempt - 1))
    const exponentialDelay =
      this.options.baseBackoffMs *
      Math.pow(this.options.backoffMultiplier, attempt - 1);

    // Cap at maximum
    const cappedDelay = Math.min(exponentialDelay, this.options.maxBackoffMs);

    // Add jitter: ±(cappedDelay * jitterFactor * random)
    const jitterRange = cappedDelay * this.options.jitterFactor;
    const jitter = jitterRange * (Math.random() * 2 - 1); // Random between -1 and 1

    // Ensure minimum of 1 second
    const finalDelay = Math.max(1000, cappedDelay + jitter);

    this.logger.debug(
      `Backoff calculation for attempt ${attempt}: exponential=${exponentialDelay}ms, ` +
        `capped=${cappedDelay}ms, jitter=${Math.round(jitter)}ms, final=${Math.round(finalDelay)}ms`
    );

    return finalDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current recovery state
   */
  getState(): Readonly<RecoveryState> {
    return { ...this.recoveryState };
  }

  /**
   * Reset recovery state
   * Useful for testing or manual intervention
   */
  resetState(): void {
    this.logger.info('Recovery state reset');
    this.recoveryState = {
      attempts: 0,
      isRecovering: false,
    };
  }

  /**
   * Check if recovery is currently in progress
   */
  isRecovering(): boolean {
    return this.recoveryState.isRecovering;
  }

  /**
   * Get number of recovery attempts made
   */
  getAttempts(): number {
    return this.recoveryState.attempts;
  }
}
