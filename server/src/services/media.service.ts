import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { s3Client } from '../config/s3.js';
import { env } from '../config/env.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { AppError } from '../middleware/error.js';
import { RequestUploadSchema, ConfirmUploadSchema } from '@qelem/shared';
import { mediaQueue } from './queue.service.js';

export class MediaService {
  static async requestUploadUrl(userId: string, body: unknown) {
    const input = RequestUploadSchema.parse(body);
    const userObjId = new Types.ObjectId(userId);

    // Check if clientAssetId already exists for this user (idempotency)
    const existing = await MediaAsset.findOne({
      ownerId: userObjId,
      clientAssetId: input.clientAssetId
    });

    if (existing) {
      if (existing.state === 'ready' || existing.state === 'processing' || existing.state === 'uploaded') {
        return { assetId: existing._id, state: existing.state };
      }
    }

    const uuid = randomUUID();
    const incomingKey = `incoming/${userId}/${uuid}`;

    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: incomingKey,
      ContentType: input.contentType,
      ContentLength: input.size
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    const asset = await MediaAsset.findOneAndUpdate(
      { ownerId: userObjId, clientAssetId: input.clientAssetId },
      {
        ownerId: userObjId,
        clientAssetId: input.clientAssetId,
        state: 'pending',
        contentType: input.contentType,
        size: input.size,
        incomingKey
      },
      { upsert: true, new: true }
    );

    return {
      assetId: asset._id,
      uploadUrl,
      incomingKey,
      expiresIn: 300
    };
  }

  static async confirmUpload(userId: string, body: unknown) {
    const input = ConfirmUploadSchema.parse(body);
    const asset = await MediaAsset.findOne({
      _id: new Types.ObjectId(input.assetId),
      ownerId: new Types.ObjectId(userId)
    });

    if (!asset) {
      throw new AppError(404, 'Media asset not found or not owned by user');
    }

    if (asset.state === 'ready') {
      return { assetId: asset._id, state: asset.state, variants: asset.variants };
    }

    // Check that object exists in object storage
    try {
      const head = await s3Client.send(
        new HeadObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: asset.incomingKey
        })
      );

      asset.size = head.ContentLength || asset.size;
      asset.state = 'uploaded';
      await asset.save();

      // Enqueue processing in BullMQ media queue
      await mediaQueue.add(
        'process-media',
        { assetId: asset._id.toString() },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );

      return { assetId: asset._id, state: asset.state };
    } catch {
      throw new AppError(400, 'Uploaded file not found in storage. Please upload before confirming.');
    }
  }

  static async getStatus(userId: string, assetId: string) {
    const asset = await MediaAsset.findOne({
      _id: new Types.ObjectId(assetId),
      ownerId: new Types.ObjectId(userId)
    });

    if (!asset) throw new AppError(404, 'Media asset not found');

    return {
      assetId: asset._id,
      state: asset.state,
      variants: asset.variants,
      placeholder: asset.placeholder,
      rejectionReason: asset.rejectionReason
    };
  }
}
