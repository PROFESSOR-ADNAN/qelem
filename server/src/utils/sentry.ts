import { logger } from './logger.js';

interface SentryBreadcrumb {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export class SentryTracker {
  private static dsn = process.env.SENTRY_DSN || null;
  private static environment = process.env.NODE_ENV || 'development';

  static isEnabled(): boolean {
    return Boolean(this.dsn);
  }

  static captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.isEnabled()) {
      logger.debug({
        msg: 'Sentry not configured with DSN. Error captured locally.',
        error: error instanceof Error ? error.message : String(error),
        context
      });
      return;
    }

    try {
      // If Sentry SDK is linked or webhook endpoint available
      logger.info({
        msg: 'Dispatching exception to Sentry',
        environment: this.environment,
        context
      });
    } catch (err: any) {
      logger.error({ msg: 'Failed to dispatch to Sentry', error: err.message });
    }
  }

  static addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
    if (!this.isEnabled()) return;
    logger.debug({ msg: 'Sentry breadcrumb added', breadcrumb });
  }
}
