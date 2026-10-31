import { Job } from 'bullmq';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { rgbaToThumbHash } from 'thumbhash';
import { s3Client } from '../../../server/src/config/s3.js';
import { env } from '../../../server/src/config/env.js';
import { MediaAsset } from '../../../server/src/models/MediaAsset.js';
import { Post } from '../../../server/src/models/Post.js';
import { PostService } from '../../../server/src/services/post.service.js';
import { logger } from '../../../server/src/utils/logger.js';
import { SYSTEM_LIMITS } from '@qelem/shared';

// Magic bytes validator
function checkMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

export async function processMediaJob(job: Job<{ assetId: string }>): Promise<void> {
  const { assetId } = job.data;
  const asset = await MediaAsset.findById(assetId);
  if (!asset || asset.state !== 'uploaded') {
    return;
  }

  asset.state = 'processing';
  await asset.save();

  try {
    // 1. Download raw object from incoming/
    const getRes = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: asset.incomingKey
      })
    );

    const streamToBuffer = async (stream: any): Promise<Buffer> => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    };

    const rawBuffer = await streamToBuffer(getRes.Body);

    // 2. Validate Magic Bytes (reject SVG, polyglots, executables)
    const detectedFormat = checkMagicBytes(rawBuffer);
    if (!detectedFormat) {
      asset.state = 'rejected';
      asset.rejectionReason = 'INVALID_MAGIC_BYTES: Only valid JPEG, PNG, or WebP images are allowed';
      await asset.save();
      return;
    }

    // 3. Inspect metadata with Sharp & limitInputPixels defense against pixel bombs
    const image = sharp(rawBuffer, {
      limitInputPixels: SYSTEM_LIMITS.MEDIA_MAX_PIXELS,
      failOn: 'error'
    });

    const meta = await image.metadata();

    if (!meta.width || !meta.height) {
      throw new Error('Unable to extract image dimensions');
    }

    // Reject animated images (e.g. animated WebP / GIF polyglots)
    if (meta.pages && meta.pages > 1) {
      asset.state = 'rejected';
      asset.rejectionReason = 'ANIMATED_IMAGES_NOT_ALLOWED';
      await asset.save();
      return;
    }

    // 4. Generate variants, strictly stripping all EXIF, GPS, XMP, and ICC metadata
    const generateVariant = async (maxDimension: number): Promise<{ buffer: Buffer; width: number; height: number }> => {
      let pipeline = sharp(rawBuffer, { limitInputPixels: SYSTEM_LIMITS.MEDIA_MAX_PIXELS })
        .rotate() // Automatically orient based on EXIF orientation tag before stripping
        .toColorspace('srgb'); // Standardize color profile to sRGB

      // Resize longest dimension without enlargement
      if (meta.width! > maxDimension || meta.height! > maxDimension) {
        pipeline = pipeline.resize({
          width: meta.width! >= meta.height! ? maxDimension : undefined,
          height: meta.height! > meta.width! ? maxDimension : undefined,
          withoutEnlargement: true
        });
      }

      // Encode to WebP with strip() to guarantee zero EXIF / GPS leakage
      const outputBuffer = await pipeline
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      const outMeta = await sharp(outputBuffer).metadata();
      return {
        buffer: outputBuffer,
        width: outMeta.width || maxDimension,
        height: outMeta.height || maxDimension
      };
    };

    const [thumb, medium, large] = await Promise.all([
      generateVariant(320),
      generateVariant(800),
      generateVariant(1280)
    ]);

    // 5. Generate ThumbHash placeholder (100x100 thumbnail -> ThumbHash base64)
    let placeholderStr = '';
    try {
      const { data, info } = await sharp(rawBuffer)
        .resize(100, 100, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const thumbHashBinary = rgbaToThumbHash(info.width, info.height, data);
      placeholderStr = Buffer.from(thumbHashBinary).toString('base64');
    } catch {
      // Fallback placeholder
      placeholderStr = '';
    }

    // 6. Compute SHA256 content hashes and upload variants to public media/ prefix
    const uploadVariant = async (variantBuffer: Buffer, variantName: string, w: number, h: number) => {
      const hash = createHash('sha256').update(variantBuffer).digest('hex').substring(0, 32);
      const key = `media/${hash}/${variantName}.webp`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: key,
          Body: variantBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable'
        })
      );

      const url = `${env.MEDIA_CDN_URL}/${hash}/${variantName}.webp`;

      return {
        key,
        url,
        width: w,
        height: h,
        bytes: variantBuffer.length,
        format: 'webp' as const
      };
    };

    const [thumbVariant, mediumVariant, largeVariant] = await Promise.all([
      uploadVariant(thumb.buffer, 'thumb', thumb.width, thumb.height),
      uploadVariant(medium.buffer, 'medium', medium.width, medium.height),
      uploadVariant(large.buffer, 'large', large.width, large.height)
    ]);

    // 7. Delete temporary raw incoming object
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: asset.incomingKey
      })
    );

    // 8. Update MediaAsset to ready
    asset.state = 'ready';
    asset.contentHash = createHash('sha256').update(rawBuffer).digest('hex');
    asset.originalWidth = meta.width;
    asset.originalHeight = meta.height;
    asset.placeholder = placeholderStr;
    asset.variants = {
      thumb: thumbVariant,
      medium: mediumVariant,
      large: largeVariant
    };
    await asset.save();

    // 9. If attached to a post, check if all post media assets are ready to publish
    if (asset.attachedPostId) {
      const post = await Post.findById(asset.attachedPostId);
      if (post && post.state === 'processing') {
        const postAssets = await MediaAsset.find({ _id: { $in: post.mediaIds } });
        const allReady = postAssets.every(a => a.state === 'ready');
        if (allReady) {
          await PostService.publishPost(post._id.toString());
        }
      }
    }

    logger.info({ msg: 'Media asset processed successfully', assetId });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ msg: 'Media processing failed', assetId, error: errorMsg });

    asset.state = 'rejected';
    asset.rejectionReason = errorMsg.includes('Input image exceeds pixel limit')
      ? 'PIXEL_LIMIT_EXCEEDED: Image resolution exceeds 24 megapixels'
      : 'PROCESSING_ERROR: Corrupted or unreadable image file';
    await asset.save();

    // Mark post failed if attached
    if (asset.attachedPostId) {
      await Post.findByIdAndUpdate(asset.attachedPostId, { state: 'failed' });
    }
  }
}
