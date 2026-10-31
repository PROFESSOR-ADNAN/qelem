import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { PostCard } from '../components/PostCard.js';
import { Bookmark } from 'lucide-react';

export const BookmarksPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => apiFetch<{ items: any[]; nextCursor: string | null }>('/feed/bookmarks')
  });

  const items = data?.items || [];

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      <div className="flex items-center space-x-2 mb-4">
        <Bookmark className="w-5 h-5 text-indigo-400" />
        <h1 className="text-base font-bold text-white">Saved Devlogs</h1>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 animate-pulse h-32" />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div>
          {items.map((item: any) => (
            <PostCard
              key={item.post._id}
              post={item.post}
              initialLiked={item.viewerState?.liked}
              initialBookmarked={item.viewerState?.bookmarked}
            />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-8 text-center my-6">
          <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">You haven't bookmarked any devlogs yet.</p>
        </div>
      )}
    </div>
  );
};
