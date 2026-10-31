import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Bookmark, Share2, Check } from 'lucide-react';
import { CodeBlock } from './CodeBlock.js';
import { DataSaverImage } from './DataSaverImage.js';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useTranslation } from 'react-i18next';

interface PostCardProps {
  post: any;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  initialLiked = false,
  initialBookmarked = false
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [copied, setCopied] = useState(false);

  const author = post.authorId || {};
  const authorName = author.displayName || author.username || 'Anonymous Dev';
  const authorUsername = author.username || 'anonymous';
  const cohort = author.cohortId;

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toString();
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;

    // Optimistic UI update
    const nextState = !liked;
    setLiked(nextState);
    setLikeCount((prev: number) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(`/posts/${post._id}/like`, {
        method: nextState ? 'PUT' : 'DELETE'
      });
      setLikeCount(res.likeCount);
      setLiked(res.liked);
    } catch {
      // Rollback on failure
      setLiked(!nextState);
      setLikeCount((prev: number) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;

    const nextState = !bookmarked;
    setBookmarked(nextState);

    try {
      await apiFetch(`/posts/${post._id}/bookmark`, {
        method: nextState ? 'PUT' : 'DELETE'
      });
    } catch {
      setBookmarked(!nextState);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    const postUrl = `${window.location.origin}/p/${post._id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${authorName} on Qelem`,
          text: post.text.slice(0, 100),
          url: postUrl
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const timeString = new Date(post.publishedAt || post.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article className="border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/60 rounded-xl p-4 sm:p-5 transition mb-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <Link to={`/u/${authorUsername}`} className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-semibold text-sm shadow">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                {authorName}
              </span>
              <span className="text-xs text-slate-400">@{authorUsername}</span>
            </div>
            {cohort && (
              <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-900/60">
                {cohort}
              </span>
            )}
          </div>
        </Link>
        <span className="text-xs text-slate-500">{timeString}</span>
      </div>

      {/* Post Text */}
      <div className="mt-3 text-slate-200 text-sm whitespace-pre-line leading-relaxed break-words">
        {post.text}
      </div>

      {/* Optional Code Snippet */}
      {post.code && post.code.body && (
        <CodeBlock lang={post.code.lang || 'code'} code={post.code.body} />
      )}

      {/* Optional Attached Screenshots */}
      {post.mediaIds && post.mediaIds.length > 0 && (
        <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
          {post.mediaIds.map((media: any) => {
            const variant = media.variants?.medium || media.variants?.large;
            if (!variant) return null;
            return (
              <DataSaverImage
                key={media._id}
                src={variant.url}
                alt="Post screenshot"
                width={variant.width}
                height={variant.height}
                bytes={variant.bytes}
                placeholder={media.placeholder}
              />
            );
          })}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag: string) => (
            <Link
              key={tag}
              to={`/tags/${tag}`}
              className="px-2 py-0.5 rounded-full text-xs font-mono text-slate-400 bg-slate-800/80 hover:bg-slate-800 hover:text-indigo-300 transition"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Engagement Actions */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-slate-400 text-xs">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center space-x-1.5 transition ${
            liked ? 'text-rose-500 font-medium' : 'hover:text-rose-400'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} />
          <span>{formatCount(likeCount)}</span>
        </button>

        {/* Comment */}
        <Link
          to={`/p/${post._id}`}
          className="flex items-center space-x-1.5 hover:text-indigo-400 transition"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{formatCount(post.commentCount || 0)}</span>
        </Link>

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          className={`flex items-center space-x-1.5 transition ${
            bookmarked ? 'text-amber-400' : 'hover:text-amber-300'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-amber-400' : ''}`} />
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center space-x-1 hover:text-slate-200 transition"
          title={t('feed.copyLink')}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span>{copied ? 'Copied' : ''}</span>
        </button>
      </div>
    </article>
  );
};
