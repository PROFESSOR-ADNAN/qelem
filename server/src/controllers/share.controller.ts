import { Request, Response, NextFunction } from 'express';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ShareController {
  static async getPostPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id;
      const post = await Post.findById(postId)
        .populate('authorId', 'username displayName')
        .populate('mediaIds')
        .lean();

      if (!post || post.state !== 'published') {
        res.status(404).send('Post not found or unavailable');
        return;
      }

      const author = post.authorId as any;
      const authorName = escapeHtml(author.displayName || author.username);
      const excerpt = escapeHtml(post.text.slice(0, 160) + (post.text.length > 160 ? '...' : ''));
      const canonicalUrl = `${env.WEB_BASE_URL}/p/${post._id}`;

      let imageUrl = `${env.WEB_BASE_URL}/og-card.png`;
      if (post.mediaIds && (post.mediaIds as any[]).length > 0) {
        const firstMedia = (post.mediaIds as any[])[0];
        if (firstMedia?.variants?.medium?.url) {
          imageUrl = firstMedia.variants.medium.url;
        }
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${authorName} on Qelem</title>
  <meta name="description" content="${excerpt}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${authorName} on Qelem" />
  <meta property="og:description" content="${excerpt}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="Qelem Devlog" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${authorName} on Qelem" />
  <meta name="twitter:description" content="${excerpt}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">Qelem Devlog</a>...</p>
  <script>window.location.href = "${canonicalUrl}";</script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
      res.send(html);
    } catch (err) {
      next(err);
    }
  }

  static async getUserPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = (req.params.username as string).toLowerCase().trim();
      const user = await User.findOne({ usernameLower: username, state: 'active' }).lean();

      if (!user) {
        res.status(404).send('User profile not found');
        return;
      }

      const name = escapeHtml(user.displayName || user.username);
      const bio = escapeHtml(user.bio || `@${user.username} on Qelem - Devlog & Learning in Public`);
      const canonicalUrl = `${env.WEB_BASE_URL}/u/${user.username}`;
      const imageUrl = `${env.WEB_BASE_URL}/og-card.png`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${name} (@${user.username}) | Qelem</title>
  <meta name="description" content="${bio}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${name} (@${user.username}) on Qelem" />
  <meta property="og:description" content="${bio}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta name="twitter:card" content="summary" />
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">profile</a>...</p>
  <script>window.location.href = "${canonicalUrl}";</script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
}
