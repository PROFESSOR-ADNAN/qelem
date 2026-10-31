# ADR 0014: Hardened Image Processing Pipeline and Zero-Direct-Upload Architecture

## Status
Accepted

## Context
Serving user-uploaded images publicly without sanitization exposes systems to major security risks: EXIF metadata leaks (GPS coordinates of students), decompression bombs (pixel flood attacks that crash workers with out-of-memory errors), polyglot scripts disguised as images (XSS), and malicious SVG scripts. Uploading large files through Express web servers saturates API threads and Nginx request buffers.

## Decision
1. **Direct-to-Storage Presigned Upload**:
   - The client requests upload parameters from `/api/v1/media/upload-url`.
   - The server validates user ownership and rate limits, returning a presigned S3 PUT/POST policy restricted to `incoming/{userId}/{uuid}` with a 5-minute expiry, max 5 MB size limit, and strict MIME type whitelist (`image/jpeg`, `image/png`, `image/webp`).
   - Raw files land directly in private `incoming/` and are never publicly accessible.
2. **Hardened Worker Processing**:
   - Worker checks magic bytes against the whitelist (rejects SVGs, HEIC, animated GIFs, polyglots, and executables).
   - Sharp configuration: sets `limitInputPixels: 24_000_000` (24 Megapixels). Larger images fail immediately before decompression, defeating zip/pixel bombs.
   - Decodes image with a 10-second processing timeout.
   - Normalizes orientation via EXIF orientation tag, then **completely strips all EXIF, GPS, XMP, and ICC metadata** (converting color space strictly to sRGB).
   - Generates three WebP variants:
     - `thumb`: 320 px longest side
     - `medium`: 800 px longest side
     - `large`: 1280 px longest side (never enlarged if original is smaller)
   - Computes a tiny ThumbHash/BlurHash placeholder string for fast 3G skeleton loading.
   - Computes SHA256 content hashes of variants and uploads to public storage under `media/{hash}/{variant}.webp` with `Cache-Control: public, max-age=31536000, immutable`.
   - Deletes the temporary `incoming/` object immediately.
3. **Orphan Cleanup**:
   - Nightly cron job deletes any `incoming/` object older than 24 hours.
   - Any `ready` media asset unattached to a published post after 24 hours is automatically purged.

## Consequences
- Guaranteed zero GPS/EXIF data leaks on published images.
- Complete immunity to SVG-based stored XSS and pixel flood CPU/RAM exhaustion.
- Immutable content-addressed URLs enable aggressive CDN caching on Cloudflare.
