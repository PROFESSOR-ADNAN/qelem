import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { Shield, EyeOff, UserX, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => apiFetch<{ reports: any[] }>('/admin/reports')
  });

  const hideMutation = useMutation({
    mutationFn: (postId: string) => apiFetch(`/admin/posts/${postId}/hide`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
  });

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/admin/users/${userId}/suspend`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] })
  });

  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    return <div className="max-w-xl mx-auto py-12 text-center text-slate-500">Access denied.</div>;
  }

  const reports = data?.reports || [];

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      <div className="flex items-center space-x-2 mb-6">
        <Shield className="w-5 h-5 text-indigo-400" />
        <h1 className="text-base font-bold text-white">Moderation Queue</h1>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="border border-slate-800 bg-slate-900/40 rounded-xl p-4 animate-pulse h-24" />
          ))}
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <div key={report._id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950 text-rose-300 border border-rose-900">
                    {report.reason.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    Target: {report.targetType} ({report.targetId})
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>

              {report.notes && (
                <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800">
                  Notes: {report.notes}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                {report.targetType === 'post' && (
                  <button
                    onClick={() => hideMutation.mutate(report.targetId)}
                    disabled={hideMutation.isPending}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center space-x-1"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Post</span>
                  </button>
                )}

                <button
                  onClick={() => suspendMutation.mutate(report.targetType === 'user' ? report.targetId : report.reporterId)}
                  disabled={suspendMutation.isPending}
                  className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center space-x-1"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Suspend Account</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="border border-slate-800/80 bg-slate-900/40 rounded-xl p-8 text-center my-6">
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">All caught up! Zero pending moderation reports.</p>
        </div>
      )}
    </div>
  );
};
