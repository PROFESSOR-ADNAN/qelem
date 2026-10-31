import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { Bell, Heart, MessageSquare, Reply, UserPlus, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<{ items: any[]; nextCursor: string | null }>('/notifications')
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch('/notifications/read', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Mark all unread notifications as seen on open
  useEffect(() => {
    apiFetch('/notifications/seen', { method: 'POST' }).catch(() => {});
  }, []);

  const items = data?.items || [];

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'comment': return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'reply': return <Reply className="w-4 h-4 text-indigo-400" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default: return <Bell className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getMessage = (notif: any) => {
    const actors = notif.actorIds || [];
    const firstName = actors[0]?.displayName || actors[0]?.username || 'Someone';
    const othersCount = notif.actorCount - 1;

    let actorText = firstName;
    if (othersCount === 1) {
      actorText = `${firstName} and 1 other`;
    } else if (othersCount > 1) {
      actorText = `${firstName} and ${othersCount} others`;
    }

    switch (notif.type) {
      case 'like': return `${actorText} liked your devlog post.`;
      case 'comment': return `${actorText} commented on your devlog.`;
      case 'reply': return `${actorText} replied to your comment.`;
      case 'follow': return `${actorText} followed you.`;
      case 'mention': return `${actorText} mentioned you in a devlog.`;
      default: return `${actorText} interacted with your account.`;
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-indigo-400" />
          <h1 className="text-base font-bold text-white">Notifications</h1>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-4 animate-pulse h-16" />
          ))}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((notif: any) => {
            const isUnread = notif.readAt === null;
            const targetUrl = notif.targetType === 'post' ? `/p/${notif.targetId}` : `/`;

            return (
              <Link
                key={notif._id}
                to={targetUrl}
                className={`block p-3.5 rounded-xl border transition ${
                  isUnread
                    ? 'bg-indigo-950/20 border-indigo-900/60 hover:bg-indigo-950/30'
                    : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1">
                    <p className={`text-xs ${isUnread ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>
                      {getMessage(notif)}
                    </p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {new Date(notif.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-8 text-center my-6">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No new notifications right now.</p>
        </div>
      )}
    </div>
  );
};
