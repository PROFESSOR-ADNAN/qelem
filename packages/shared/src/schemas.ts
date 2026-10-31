import { z } from 'zod';
import {
  SYSTEM_LIMITS,
  CODE_LANGUAGES,
  ALLOWED_IMAGE_MIME_TYPES
} from './constants.js';

// ==============================================================================
// AUTH SCHEMAS
// ==============================================================================

export const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  username: z
    .string()
    .regex(SYSTEM_LIMITS.USERNAME_REGEX, 'Username must be 3-20 characters lowercase letters, numbers, or underscore')
    .toLowerCase()
    .trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().min(1).max(SYSTEM_LIMITS.DISPLAY_NAME_MAX_LENGTH).trim(),
  cohortId: z.string().optional()
}).strict();

export const LoginSchema = z.object({
  login: z.string().min(1, 'Email or username is required').trim(),
  password: z.string().min(1, 'Password is required')
}).strict();

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().toLowerCase().trim()
}).strict();

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128)
}).strict();

export const VerifyEmailSchema = z.object({
  token: z.string().min(1)
}).strict();

// ==============================================================================
// USER & PROFILE SCHEMAS
// ==============================================================================

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(SYSTEM_LIMITS.DISPLAY_NAME_MAX_LENGTH).trim().optional(),
  bio: z.string().max(SYSTEM_LIMITS.BIO_MAX_LENGTH).trim().optional(),
  cohortId: z.string().nullable().optional(),
  avatarMediaId: z.string().nullable().optional()
}).strict();

// ==============================================================================
// POST SCHEMAS
// ==============================================================================

export const CreatePostSchema = z.object({
  clientPostId: z.string().uuid('clientPostId must be a valid UUID v4 for idempotency'),
  text: z.string().min(1, 'Post text cannot be empty').max(SYSTEM_LIMITS.POST_TEXT_MAX_LENGTH),
  code: z
    .object({
      lang: z.enum(CODE_LANGUAGES),
      body: z.string().max(SYSTEM_LIMITS.POST_CODE_MAX_LENGTH)
    })
    .optional(),
  mediaIds: z.array(z.string()).max(SYSTEM_LIMITS.POST_MAX_IMAGES).default([]),
  tags: z.array(z.string().min(2).max(30)).max(SYSTEM_LIMITS.POST_MAX_TAGS).default([]),
  mentions: z.array(z.string().regex(SYSTEM_LIMITS.USERNAME_REGEX)).max(SYSTEM_LIMITS.POST_MAX_MENTIONS).default([])
}).strict();

export const EditPostSchema = z.object({
  text: z.string().min(1).max(SYSTEM_LIMITS.POST_TEXT_MAX_LENGTH),
  code: z
    .object({
      lang: z.enum(CODE_LANGUAGES),
      body: z.string().max(SYSTEM_LIMITS.POST_CODE_MAX_LENGTH)
    })
    .optional(),
  tags: z.array(z.string().min(2).max(30)).max(SYSTEM_LIMITS.POST_MAX_TAGS).default([])
}).strict();

// ==============================================================================
// MEDIA UPLOAD SCHEMAS
// ==============================================================================

export const RequestUploadSchema = z.object({
  clientAssetId: z.string().uuid(),
  contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  size: z.number().int().positive().max(SYSTEM_LIMITS.MEDIA_MAX_BYTES, 'Max image size is 5 MB'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
}).strict();

export const ConfirmUploadSchema = z.object({
  assetId: z.string().min(1)
}).strict();

// ==============================================================================
// COMMENT SCHEMAS
// ==============================================================================

export const CreateCommentSchema = z.object({
  clientCommentId: z.string().uuid('clientCommentId must be a valid UUID v4'),
  text: z.string().min(1, 'Comment text cannot be empty').max(SYSTEM_LIMITS.COMMENT_TEXT_MAX_LENGTH).trim(),
  parentId: z.string().nullable().optional() // null for top-level, commentId for 1-level reply
}).strict();

// ==============================================================================
// REPORT SCHEMAS
// ==============================================================================

export const REPORT_REASONS = [
  'spam_or_phishing',
  'harassment_or_hate',
  'academic_dishonesty',
  'malicious_code',
  'inappropriate_content',
  'other'
] as const;

export const CreateReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  notes: z.string().max(500).optional()
}).strict();

// ==============================================================================
// PAGINATION QUERY SCHEMA
// ==============================================================================

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(SYSTEM_LIMITS.FEED_PAGE_MAX_LIMIT)
    .default(SYSTEM_LIMITS.FEED_PAGE_DEFAULT_LIMIT)
});
