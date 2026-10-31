import { CodeLanguage, AllowedImageMimeType } from './constants.js';

export type UserRole = 'user' | 'moderator' | 'admin';
export type UserState = 'active' | 'suspended' | 'pending_deletion';
export type FanoutMode = 'normal' | 'high_fanout';

export type PostState = 'processing' | 'published' | 'failed' | 'hidden' | 'deleted';
export type MediaState = 'pending' | 'uploaded' | 'processing' | 'ready' | 'rejected';

export type NotificationType = 'like' | 'comment' | 'reply' | 'mention' | 'follow';
export type NotificationTargetType = 'post' | 'comment' | 'user';

export interface ImageVariant {
  key: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: 'webp';
}

export interface MediaAssetVariants {
  thumb: ImageVariant;
  medium: ImageVariant;
  large: ImageVariant;
}

export interface KeysetCursorPayload {
  v: number;
  kind: 'home' | 'explore' | 'profile' | 'tag' | 'comments' | 'notifications' | 'followers';
  score: number;
  id: string;
  ts: number;
  extra?: string; // snapshot version for explore
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  endReason?: 'depth_limit' | 'end_of_results';
}

export interface RFC9457Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
}
