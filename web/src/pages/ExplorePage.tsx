import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { PostCard } from '../components/PostCard.js';
import { DEFAULT_COHORTS } from '@qelem/shared';
import { Compass, Filter, Hash, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const POPULAR_TAGS = ['python', 'react', 'typescript', 'algorithms', 'systemdesign', 'golang', 'ethiopia', 'career'];

export const ExplorePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['explore-feed', selectedCohort, selectedTag, debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery) {
        let params = new URLSearchParams();
        params.set('q', debouncedQuery);
        if (selectedCohort) params.set('cohort', selectedCohort);
        if (selectedTag) params.set('tag', selectedTag);
        const res = await apiFetch<{ items: any[] }>(`/posts/search/query?${params.toString()}`);
        return {
          items: (res.items || []).map((post: any) => ({
            post,
            viewerState: { liked: false, bookmarked: false }
          })),
          nextCursor: null
        };
      }

      let queryParams = new URLSearchParams();
      if (selectedCohort) queryParams.set('cohort', selectedCohort);
      if (selectedTag) queryParams.set('tag', selectedTag);

      const qs = queryParams.toString();
      const url = qs ? `/feed/explore?${qs}` : '/feed/explore';
      return apiFetch<{ items: any[]; nextCursor: string | null }>(url);
    }
  });

  const items = data?.items || [];

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      {/* Title & Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center space-x-2">
          <Compass className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-white">{t('explore.title')}</h1>
        </div>

        {/* Live Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search devlogs, algorithms, student notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Tag Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] text-slate-500 font-mono flex-shrink-0">Trending:</span>
          {POPULAR_TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(isSelected ? '' : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-mono transition flex-shrink-0 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Cohort Selector */}
          <div className="relative">
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">{t('explore.allCohorts')}</option>
              {DEFAULT_COHORTS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Tag Filter Input */}
          <div className="relative flex items-center">
            <Hash className="absolute left-3 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by custom tag (e.g. redis, rust)"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 animate-pulse h-32" />
          ))}
        </div>
      )}

      {/* Items */}
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

      {/* No Results */}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-xs font-mono">
          {t('explore.noResults')}
        </div>
      )}
    </div>
  );
};
