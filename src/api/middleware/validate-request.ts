/**
 * Request Validation Middleware
 *
 * Validates request body, query, and params using Zod schemas.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ApiError } from './error-handler.js';

/**
 * Validation target options
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validation options
 */
interface ValidationOptions {
  /** Which part of the request to validate */
  target?: ValidationTarget;
}

/**
 * Create validation middleware for a Zod schema
 *
 * @param schema Zod schema to validate against
 * @param options Validation options
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * const SendFundsSchema = z.object({
 *   destinationAddress: z.string(),
 *   amount: z.string(),
 * });
 *
 * router.post('/send', validateRequest(SendFundsSchema), controller.sendFunds);
 * ```
 */
export function validateRequest<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { target = 'body' } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const result = schema.parse(data);

      // Replace the request data with the validated/transformed data
      switch (target) {
        case 'body':
          req.body = result;
          break;
        case 'query':
          (req as unknown as { query: unknown }).query = result;
          break;
        case 'params':
          (req as unknown as { params: unknown }).params = result;
          break;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        next(ApiError.badRequest(
          'Validation failed',
          'VALIDATION_ERROR',
          { issues: details }
        ));
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return validateRequest(schema, { target: 'query' });
}

/**
 * Validate URL parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return validateRequest(schema, { target: 'params' });
}

// ==================== Common Validation Schemas ====================

/**
 * Midnight address validation (mn_shield-addr_test1...)
 */
export const MidnightAddressSchema = z.string()
  .regex(/^mn_shield-addr_test1[a-z0-9]+$/, 'Invalid Midnight address format');

/**
 * Amount validation (string that can be converted to bigint)
 */
export const AmountSchema = z.string()
  .regex(/^\d+$/, 'Amount must be a numeric string')
  .transform(val => val);

/**
 * Transaction ID validation
 */
export const TransactionIdSchema = z.string()
  .min(1, 'Transaction ID is required');

/**
 * Token name validation
 */
export const TokenNameSchema = z.string()
  .min(1, 'Token name is required')
  .max(50, 'Token name too long');

/**
 * Pagination query schema
 */
export const PaginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
});

/**
 * UUID validation
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');
