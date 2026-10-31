import { Types } from 'mongoose';
import { Follow } from '../models/Follow.js';
import { User } from '../models/User.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { redis } from '../config/redis.js';
import { AppError } from '../middleware/error.js';
import { SYSTEM_LIMITS } from '@qelem/shared';

export class GraphService {
  static async followUser(followerId: string, followeeId: string): Promise<{ following: boolean }> {
    if (followerId === followeeId) {
      throw new AppError(400, 'You cannot follow yourself');
    }

    const followerObjId = new Types.ObjectId(followerId);
    const followeeObjId = new Types.ObjectId(followeeId);

    // Check if target user exists and is active
    const followee = await User.findById(followeeObjId);
    if (!followee || followee.state !== 'active') {
      throw new AppError(404, 'User not found or account is not active');
    }

    // Check if blocked in either direction
    const isBlocked = await Block.findOne({
      $or: [
        { blockerId: followerObjId, blockedId: followeeObjId },
        { blockerId: followeeObjId, blockedId: followerObjId }
      ]
    });

    if (isBlocked) {
      throw new AppError(403, 'Unable to follow this user due to privacy/blocking settings');
    }

    try {
      // Natural unique index on (followerId, followeeId) guarantees idempotency
      await Follow.create({ followerId: followerObjId, followeeId: followeeObjId });

      // Increment counts only on real insert
      const updatedFollowee = await User.findByIdAndUpdate(
        followeeObjId,
        { $inc: { followersCount: 1 } },
        { new: true }
      );
      await User.findByIdAndUpdate(followerObjId, { $inc: { followingCount: 1 } });

      // Update Redis sets
      await redis.sadd(`following:${followerId}`, followeeId);

      // Check for High-Fanout transition (>= 2000 followers)
      if (updatedFollowee && updatedFollowee.followersCount >= SYSTEM_LIMITS.FANOUT_MAX_FOLLOWERS && updatedFollowee.fanoutMode === 'normal') {
        updatedFollowee.fanoutMode = 'high_fanout';
        await updatedFollowee.save();
        await redis.sadd(`following_hf:${followerId}`, followeeId);
      } else if (updatedFollowee?.fanoutMode === 'high_fanout') {
        await redis.sadd(`following_hf:${followerId}`, followeeId);
      }

      return { following: true };
    } catch (err: unknown) {
      // If already following (E11000 duplicate key), return idempotent success
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        return { following: true };
      }
      throw err;
    }
  }

  static async unfollowUser(followerId: string, followeeId: string): Promise<{ following: boolean }> {
    const followerObjId = new Types.ObjectId(followerId);
    const followeeObjId = new Types.ObjectId(followeeId);

    const deleted = await Follow.findOneAndDelete({
      followerId: followerObjId,
      followeeId: followeeObjId
    });

    if (deleted) {
      const updatedFollowee = await User.findByIdAndUpdate(
        followeeObjId,
        { $inc: { followersCount: -1 } },
        { new: true }
      );
      await User.findByIdAndUpdate(followerObjId, { $inc: { followingCount: -1 } });

      await redis.srem(`following:${followerId}`, followeeId);
      await redis.srem(`following_hf:${followerId}`, followeeId);

      // Hysteresis transition: <= 1600 followers drops back to normal
      if (updatedFollowee && updatedFollowee.followersCount <= SYSTEM_LIMITS.FANOUT_HYSTERESIS_LOW && updatedFollowee.fanoutMode === 'high_fanout') {
        updatedFollowee.fanoutMode = 'normal';
        await updatedFollowee.save();
      }
    }

    return { following: false };
  }

  static async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new AppError(400, 'You cannot block yourself');
    }

    const blockerObjId = new Types.ObjectId(blockerId);
    const blockedObjId = new Types.ObjectId(blockedId);

    await Block.findOneAndUpdate(
      { blockerId: blockerObjId, blockedId: blockedObjId },
      { blockerId: blockerObjId, blockedId: blockedObjId },
      { upsert: true }
    );

    // Sever follow edges in both directions
    await this.unfollowUser(blockerId, blockedId);
    await this.unfollowUser(blockedId, blockerId);
  }

  static async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await Block.findOneAndDelete({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId)
    });
  }

  static async muteUser(muterId: string, mutedId: string): Promise<void> {
    if (muterId === mutedId) {
      throw new AppError(400, 'You cannot mute yourself');
    }

    await Mute.findOneAndUpdate(
      { muterId: new Types.ObjectId(muterId), mutedId: new Types.ObjectId(mutedId) },
      { muterId: new Types.ObjectId(muterId), mutedId: new Types.ObjectId(mutedId) },
      { upsert: true }
    );
  }

  static async unmuteUser(muterId: string, mutedId: string): Promise<void> {
    await Mute.findOneAndDelete({
      muterId: new Types.ObjectId(muterId),
      mutedId: new Types.ObjectId(mutedId)
    });
  }
}
