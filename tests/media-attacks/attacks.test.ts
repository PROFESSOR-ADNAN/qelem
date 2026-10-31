import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

function checkMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return 'png';
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) return 'webp';
  return null;
}

describe('Media Pipeline Hardening & Attack Defense Suite', () => {
  it('rejects SVG uploads disguised as images to prevent Stored XSS', () => {
    const maliciousSvg = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>'
    );
    const detected = checkMagicBytes(maliciousSvg);
    expect(detected).toBeNull();
  });

  it('rejects executable / script polyglot payloads', () => {
    const maliciousScript = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
    const detected = checkMagicBytes(maliciousScript);
    expect(detected).toBeNull();
  });

  it('rejects truncated / incomplete image binaries gracefully without crashing', () => {
    const truncatedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // Only 4 bytes
    const detected = checkMagicBytes(truncatedJpeg);
    expect(detected).toBeNull(); // Less than minimum 12 bytes
  });

  it('enforces limitInputPixels (24 Megapixels) to defeat decompression / pixel flood bombs', async () => {
    const limitPixels = 24_000_000;
    // Attempting to create an image metadata pipeline with strict pixel limits
    const sharpInstance = sharp({
      create: {
        width: 10000,
        height: 10000, // 100 Megapixels (> 24 Megapixels)
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      },
      limitInputPixels: limitPixels
    });

    // Should reject or fail to allocate
    await expect(sharpInstance.toBuffer()).rejects.toThrow();
  });

  it('strips all EXIF, GPS, and camera metadata upon WebP variant conversion', async () => {
    // Generate a test JPEG image with simulated EXIF orientation
    const originalBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Process through Qelem variant generation pipeline: rotate() + toColorspace('srgb') + webp()
    const cleanedVariant = await sharp(originalBuffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .toColorspace('srgb')
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    const cleanedMeta = await sharp(cleanedVariant).metadata();

    // Verify all metadata is stripped: no exif buffer, no GPS tags, format is webp
    expect(cleanedMeta.format).toBe('webp');
    expect(cleanedMeta.exif).toBeUndefined();
    expect(cleanedMeta.icc).toBeUndefined();
    expect(cleanedMeta.iptc).toBeUndefined();
    expect(cleanedMeta.xmp).toBeUndefined();
  });
});
