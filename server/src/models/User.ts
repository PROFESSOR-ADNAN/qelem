import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, UserState, FanoutMode, SYSTEM_LIMITS } from '@qelem/shared';

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  usernameLower: string;
  displayName: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  bio?: string;
  avatarMediaId?: Types.ObjectId | null;
  cohortId?: string | null;
  role: UserRole;
  state: UserState;
  isEmailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  phone?: string | null;
  isPhoneVerified: boolean;
  phoneOtp?: string | null;
  phoneOtpExpires?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  fanoutMode: FanoutMode;
  lastActiveAt: Date;
  totpSecret?: string | null;
  mfaEnabled: boolean;
  deletionRequestedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: SYSTEM_LIMITS.USERNAME_REGEX
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: SYSTEM_LIMITS.DISPLAY_NAME_MAX_LENGTH
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    emailLower: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    bio: {
      type: String,
      maxlength: SYSTEM_LIMITS.BIO_MAX_LENGTH,
      default: ''
    },
    avatarMediaId: {
      type: Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null
    },
    cohortId: {
      type: String,
      default: null,
      index: true
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true
    },
    state: {
      type: String,
      enum: ['active', 'suspended', 'pending_deletion'],
      default: 'active',
      index: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      sparse: true
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    phoneOtp: {
      type: String,
      select: false
    },
    phoneOtpExpires: {
      type: Date,
      select: false
    },
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    followersCount: {
      type: Number,
      default: 0
    },
    followingCount: {
      type: Number,
      default: 0
    },
    postsCount: {
      type: Number,
      default: 0
    },
    fanoutMode: {
      type: String,
      enum: ['normal', 'high_fanout'],
      default: 'normal',
      index: true
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    totpSecret: {
      type: String,
      select: false
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    deletionRequestedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.passwordHash;
        delete ret.totpSecret;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        return ret;
      }
    }
  }
);

// Prefix search index on display name and username
UserSchema.index({ displayName: 'text' });

export const User = model<IUser>('User', UserSchema);
