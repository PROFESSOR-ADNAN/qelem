import React, { useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { PostCard } from '../components/PostCard.js';
import { offlineDB } from '../offline/db.js';
import { ArrowUp, RefreshCw, Users, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { Link } from 'react-router-dom';

export const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [newestScore, setNewestScore] = useState<number | null>(null);

  // TanStack Infinite Query over signed HMAC keyset cursors
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey: ['home-feed'],
    queryFn: async ({ pageParam }) => {
      try {
        const url = pageParam ? `/feed/home?cursor=${encodeURIComponent(pageParam)}&limit=20` : '/feed/home?limit=20';
        const res = await apiFetch<any>(url);

        // Cache first page in Dexie for offline reading
        if (!pageParam && res.items) {
          await offlineDB.feedCache.clear();
          for (const item of res.items) {
            await offlineDB.feedCache.put({
              id: item.post._id,
              post: item.post,
              viewerState: item.viewerState,
              cachedAt: Date.now()
            });
          }
        }

        return res;
      } catch (err) {
        // Offline fallback: load cached feed from IndexedDB
        const cached = await offlineDB.feedCache.toArray();
        if (cached.length > 0) {
          return {
            items: cached.map(c => ({ post: c.post, viewerState: c.viewerState })),
            nextCursor: null,
            isOffline: true
          };
        }
        throw err;
      }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: !!user
  });

  // Track newest score for "N new posts" pill
  useEffect(() => {
    if (data?.pages[0]?.items?.[0]?.post) {
      const first = data.pages[0].items[0].post;
      setNewestScore(new Date(first.publishedAt || first.createdAt).getTime());
    }
  }, [data]);

  // Periodic check for new posts newer than newestScore
  useEffect(() => {
    if (!newestScore || !user) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch<{ count: number }>(`/feed/home/new-count?after=${newestScore}`);
        if (res.count > 0) {
          setNewPostsCount(res.count);
        }
      } catch {}
    }, 30000); // 30s check

    return () => clearInterval(interval);
  }, [newestScore, user]);

  const handleRefreshNew = () => {
    setNewPostsCount(0);
    refetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-xl shadow-indigo-600/30">
          ቀ
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('brand')}</h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{t('tagline')}</p>
        <div className="flex justify-center space-x-3">
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            {t('nav.login')}
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {t('nav.register')}
          </Link>
        </div>
      </div>
    );
  }

  const allItems = data?.pages.flatMap(p => p.items) || [];

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      {/* "N new posts" Floating Pill */}
      {newPostsCount > 0 && (
        <div className="sticky top-16 z-30 flex justify-center mb-4">
          <button
            onClick={handleRefreshNew}
            className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/40 flex items-center space-x-2 transition-all transform hover:scale-105"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{t('feed.newPostsPill', { count: newPostsCount })}</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-24 h-3.5 bg-slate-800 rounded" />
                  <div className="w-16 h-2.5 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="w-full h-3 bg-slate-800 rounded" />
                <div className="w-4/5 h-3 bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feed List */}
      {!isLoading && allItems.length > 0 && (
        <div>
          {allItems.map((item: any) => (
            <PostCard
              key={item.post._id}
              post={item.post}
              initialLiked={item.viewerState?.liked}
              initialBookmarked={item.viewerState?.bookmarked}
            />
          ))}

          {/* Pagination Controls */}
          {hasNextPage && (
            <div className="text-center py-6">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition flex items-center space-x-2 mx-auto disabled:opacity-50"
              >
                {isFetchingNextPage ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading more devlogs...</span>
                  </>
                ) : (
                  <span>Load older devlogs</span>
                )}
              </button>
            </div>
          )}

          {!hasNextPage && (
            <div className="text-center py-8 text-xs text-slate-500 font-mono">
              {t('feed.endOfFeed')}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && allItems.length === 0 && (
        <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-8 text-center my-6">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-slate-200 mb-1">{t('feed.emptyHomeTitle')}</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
            {t('feed.emptyHomeDesc')}
          </p>
          <Link
            to="/explore"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition inline-flex items-center space-x-1.5"
          >
            <span>{t('feed.exploreCohorts')}</span>
          </Link>
        </div>
      )}
    </div>
  );
};
