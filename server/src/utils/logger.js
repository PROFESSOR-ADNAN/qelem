import pino from 'pino';
import { env } from '../config/env.js';
export const logger = pino({
    level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
    formatters: {
        level: (label) => ({ level: label })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'password',
            'token',
            'email',
            'text',
            'body.password',
            'body.token',
            'body.email'
        ],
        remove: true
    }
});
