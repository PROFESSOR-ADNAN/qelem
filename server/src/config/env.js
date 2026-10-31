import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(5000),
    API_BASE_URL: z.string().default('http://localhost:5000'),
    WEB_BASE_URL: z.string().default('http://localhost:3000'),
    BASE_DOMAIN: z.string().default('example.com'),
    MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/qelem?replicaSet=rs0&directConnection=true'),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    CURSOR_SIGNING_SECRET: z.string().min(32, 'CURSOR_SIGNING_SECRET must be at least 32 characters'),
    CURSOR_SIGNING_SECRET_OLD: z.string().optional(),
    UNSUBSCRIBE_TOKEN_SECRET: z.string().min(32, 'UNSUBSCRIBE_TOKEN_SECRET must be at least 32 characters'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET_NAME: z.string().default('qelem-dev-bucket'),
    S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
    S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    MEDIA_CDN_URL: z.string().default('http://localhost:9000/qelem-dev-bucket/media'),
    EMAIL_PROVIDER: z.enum(['mailpit', 'resend', 'brevo', 'mock']).default('mailpit'),
    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default('Qelem Community <noreply@example.com>'),
    EMAIL_DAILY_BUDGET: z.coerce.number().default(90),
    FANOUT_MAX_FOLLOWERS: z.coerce.number().default(2000),
    FANOUT_HYSTERESIS_LOW: z.coerce.number().default(1600),
    FEED_MAX_ENTRIES: z.coerce.number().default(600),
    ACTIVE_WINDOW_DAYS: z.coerce.number().default(14),
    EMAIL_DIGEST_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_ENABLED: z.coerce.boolean().default(true)
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('CRITICAL: Invalid environment configuration:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}
export const env = parsed.data;
