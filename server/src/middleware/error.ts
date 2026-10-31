import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { RFC9457Problem } from '@qelem/shared';

export class AppError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly errors?: Record<string, string[]>;

  constructor(status: number, message: string, type = 'about:blank', errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.type = type;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || (req as any).id || 'req-' + Math.random().toString(36).substring(2, 9);

  if (err instanceof AppError) {
    const problem: RFC9457Problem = {
      type: err.type,
      title: getTitleForStatus(err.status),
      status: err.status,
      detail: err.message,
      instance: req.originalUrl,
      requestId,
      errors: err.errors
    };
    res.status(err.status).contentType('application/problem+json').json(problem);
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'body';
      if (!errors[path]) errors[path] = [];
      errors[path].push(issue.message);
    }

    const problem: RFC9457Problem = {
      type: 'https://qelem.et/errors/validation-failed',
      title: 'Validation Failed',
      status: 400,
      detail: 'The submitted request payload failed schema validation.',
      instance: req.originalUrl,
      requestId,
      errors
    };
    res.status(400).contentType('application/problem+json').json(problem);
    return;
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    const problem: RFC9457Problem = {
      type: 'https://qelem.et/errors/conflict',
      title: 'Conflict',
      status: 409,
      detail: 'A record with that unique identifier or natural key already exists.',
      instance: req.originalUrl,
      requestId
    };
    res.status(409).contentType('application/problem+json').json(problem);
    return;
  }

  const errorObj = err instanceof Error ? { message: err.message, stack: err.stack } : { raw: String(err) };
  logger.error({ msg: 'Unhandled internal server error', error: errorObj, requestId, path: req.originalUrl });

  const problem: RFC9457Problem = {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected internal error occurred. Please try again later.',
    instance: req.originalUrl,
    requestId
  };
  res.status(500).contentType('application/problem+json').json(problem);
}

function getTitleForStatus(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 409: return 'Conflict';
    case 422: return 'Unprocessable Entity';
    case 429: return 'Too Many Requests';
    default: return 'Error';
  }
}
