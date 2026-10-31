import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { PostCard } from '../components/PostCard.js';
import { useAuth } from '../context/AuthContext.js';
import { UserCheck, UserPlus, Shield, BellOff } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Profile data
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => apiFetch<{ user: any; viewerContext: { isFollowing: boolean; isBlocked: boolean } }>(`/users/${username}`)
  });

  // User posts
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => apiFetch<{ items: any[]; nextCursor: string | null }>(`/posts/author/${username}`)
  });

  const profile = profileData?.user;
  const isFollowing = profileData?.viewerContext?.isFollowing ?? false;
  const isSelf = currentUser && profile && currentUser.id === profile.id;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      return apiFetch(`/graph/users/${profile.id}/follow`, {
        method: isFollowing ? 'DELETE' : 'PUT'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    }
  });

  if (profileLoading) {
    return <div className="max-w-2xl mx-auto py-12 text-center text-slate-500">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="max-w-2xl mx-auto py-12 text-center text-slate-500">User not found</div>;
  }

  const posts = postsData?.items || [];

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      {/* Profile Header */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{profile.displayName}</h1>
              <p className="text-xs text-slate-400">@{profile.username}</p>
              {profile.cohortId && (
                <span className="inline-block px-2 py-0.5 mt-1 rounded text-[11px] font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-900/60">
                  {profile.cohortId}
                </span>
              )}
            </div>
          </div>

          {!isSelf && currentUser && (
            <button
              onClick={() => followMutation.mutate()}
              disabled={followMutation.isPending}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                isFollowing
                  ? 'bg-slate-800 text-slate-300 hover:bg-rose-950/60 hover:text-rose-400 border border-slate-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center space-x-6 text-xs text-slate-400">
          <div>
            <span className="font-bold text-slate-100">{profile.postsCount}</span>{' '}
            <span className="text-slate-500">posts</span>
          </div>
          <div>
            <span className="font-bold text-slate-100">{profile.followersCount}</span>{' '}
            <span className="text-slate-500">followers</span>
          </div>
          <div>
            <span className="font-bold text-slate-100">{profile.followingCount}</span>{' '}
            <span className="text-slate-500">following</span>
          </div>
        </div>
      </div>

      {/* Devlogs Feed */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          Recent Devlogs
        </h2>

        {postsLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-5 animate-pulse h-32" />
            ))}
          </div>
        )}

        {!postsLoading && posts.length > 0 && (
          posts.map((post: any) => (
            <PostCard key={post._id} post={post} />
          ))
        )}

        {!postsLoading && posts.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs font-mono">
            No published devlogs yet.
          </div>
        )}
      </div>
    </div>
  );
};
