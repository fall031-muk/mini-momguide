import type { ErrorRequestHandler } from 'express';
import { logger } from '../common/logger.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, message: 'Internal Server Error' });
};
