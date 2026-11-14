export const SYSTEM_LIMITS = {
  MIN_USER_AGE: 16,
  USERNAME_REGEX: /^[a-z0-9_]{3,20}$/,
  POST_TEXT_MAX_LENGTH: 2000,
  POST_CODE_MAX_LENGTH: 3000,
  POST_MAX_IMAGES: 4,
  POST_MAX_TAGS: 5,
  POST_MAX_MENTIONS: 5,
  POST_EDIT_WINDOW_MINUTES: 30,
  COMMENT_TEXT_MAX_LENGTH: 1000,
  BIO_MAX_LENGTH: 160,
  DISPLAY_NAME_MAX_LENGTH: 50,
  MEDIA_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
  MEDIA_MAX_PIXELS: 24_000_000, // 24 Megapixels
  
  // Hybrid Fan-out & Feed Settings
  FANOUT_MAX_FOLLOWERS: 2000,
  FANOUT_HYSTERESIS_LOW: 1600,
  FEED_MAX_ENTRIES: 600,
  ACTIVE_WINDOW_DAYS: 14,
  FANOUT_CHUNK: 1000,
  HF_MERGE_WINDOW_DAYS: 7,
  FEED_PAGE_DEFAULT_LIMIT: 20,
  FEED_PAGE_MAX_LIMIT: 50,
  FEED_REFILL_MAX_ROUNDS: 3,
  
  // Rate Limits (Per-User / Auth)
  RATE_LIMIT_POSTS_PER_DAY: 30,
  RATE_LIMIT_POSTS_PER_DAY_NEW_ACCOUNT: 10,
  RATE_LIMIT_POSTS_PER_HOUR: 6,
  RATE_LIMIT_COMMENTS_PER_MINUTE: 10,
  RATE_LIMIT_LIKES_PER_MINUTE: 120,
  RATE_LIMIT_FOLLOWS_PER_HOUR: 60,
  RATE_LIMIT_FOLLOWS_PER_DAY: 200,
  RATE_LIMIT_FOLLOWS_PER_DAY_NEW_ACCOUNT: 20,
  RATE_LIMIT_MEDIA_UPLOADS_PER_DAY: 40,
  RATE_LIMIT_MEDIA_UPLOADS_PER_MINUTE: 8,
  RATE_LIMIT_USER_SEARCH_PER_MINUTE: 30,
  RATE_LIMIT_LOGIN_PER_IP_15M: 10,
  RATE_LIMIT_LOGIN_PER_ACCOUNT_15M: 5,
  RATE_LIMIT_REGISTER_PER_IP_HOUR: 5,

  // Email Daily Free-Tier Budget
  EMAIL_DAILY_BUDGET_LIMIT: 90,
  EMAIL_MENTION_REPLY_GRACE_MINUTES: 10,
  EMAIL_MENTION_REPLY_MAX_PER_USER_DAY: 5,

  // Retention & Purge
  PURGE_SOFT_DELETED_DAYS: 30,
  PURGE_ORPHAN_MEDIA_HOURS: 24,
  NOTIFICATIONS_TTL_DAYS: 90,
  USER_TIMELINE_TTL_DAYS: 30
} as const;

export const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'html',
  'css',
  'sql',
  'bash',
  'json',
  'yaml',
  'markdown'
] as const;

export type CodeLanguage = typeof CODE_LANGUAGES[number];

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const;

export type AllowedImageMimeType = typeof ALLOWED_IMAGE_MIME_TYPES[number];

export const DEFAULT_COHORTS = [
  { id: 'aau-cs', name: 'Addis Ababa University - Computer Science' },
  { id: 'aastu-se', name: 'AASTU - Software Engineering' },
  { id: 'astu-cse', name: 'ASTU - Computer Science & Engineering' },
  { id: 'hu-it', name: 'Hawassa University - Information Technology' },
  { id: 'bdu-cs', name: 'Bahir Dar University - Computer Science' },
  { id: 'alx-ethiopia', name: 'ALX Ethiopia Software Engineering' },
  { id: 'evangadi-tech', name: 'Evangadi Tech Full-Stack' },
  { id: 'gebeya-talent', name: 'Gebeya Tech Cohort' },
  { id: 'addiscoder-alumni', name: 'AddisCoder Alumni' },
  { id: 'independent', name: 'Independent / Self-Taught Dev' }
] as const;

export const ETHIOPIAN_UNIVERSITIES = [
  'Addis Ababa University (AAU)',
  'Adama Science and Technology University (ASTU)',
  'Addis Ababa Science and Technology University (AASTU)',
  'Hawassa University',
  'Bahir Dar University',
  'Jimma University',
  'Haramaya University',
  'Mekelle University',
  'Arba Minch University',
  'Wollo University',
  'Dilla University',
  'Dire Dawa University',
  'Debre Berhan University',
  'University of Gondar',
  'Self-Taught / Independent'
] as const;

