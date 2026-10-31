import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { PostCard } from '../components/PostCard.js';
import { useAuth } from '../context/AuthContext.js';
import { MessageSquare, Send, Trash2, Reply } from 'lucide-react';

function generateUUID(): string {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);

  // Fetch post detail
  const { data: postData, isLoading: postLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => apiFetch<{ post: any; viewerState: { liked: boolean; bookmarked: boolean } }>(`/posts/${id}`)
  });

  // Fetch comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => apiFetch<{ items: any[]; nextCursor: string | null }>(`/posts/${id}/comments`)
  });

  // Submit comment mutation
  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      const clientCommentId = generateUUID();
      return apiFetch(`/posts/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          clientCommentId,
          text,
          parentId: replyParentId
        })
      });
    },
    onSuccess: () => {
      setCommentText('');
      setReplyParentId(null);
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    }
  });

  const handleDeleteComment = async (commentId: string) => {
    try {
      await apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
    } catch {}
  };

  const comments = commentsData?.items || [];
  // Group replies under top-level parent comments
  const topLevelComments = comments.filter((c: any) => !c.parentId);
  const repliesMap = new Map<string, any[]>();

  for (const c of comments) {
    if (c.parentId) {
      const pId = typeof c.parentId === 'object' ? c.parentId._id : c.parentId;
      const list = repliesMap.get(pId) || [];
      list.push(c);
      repliesMap.set(pId, list);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      {postLoading && (
        <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-6 animate-pulse h-48" />
      )}

      {postData && (
        <PostCard
          post={postData.post}
          initialLiked={postData.viewerState?.liked}
          initialBookmarked={postData.viewerState?.bookmarked}
        />
      )}

      {/* Comments Section */}
      <div className="mt-6 border-t border-slate-800 pt-5">
        <div className="flex items-center space-x-2 mb-4 text-sm font-semibold text-slate-200">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span>Discussion ({comments.length})</span>
        </div>

        {/* Comment Composer */}
        {user ? (
          <div className="mb-6 p-3 rounded-xl border border-slate-800 bg-slate-900/50">
            {replyParentId && (
              <div className="flex items-center justify-between text-xs text-indigo-400 mb-2 font-mono">
                <span>Replying to comment...</span>
                <button onClick={() => setReplyParentId(null)} className="text-slate-400 hover:text-slate-200">
                  Cancel
                </button>
              </div>
            )}
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Write a constructive response or question..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => commentMutation.mutate(commentText)}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>Comment</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 mb-6 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
            <Link to="/login" className="text-indigo-400 hover:underline font-semibold">Log in</Link> to join the technical discussion.
          </div>
        )}

        {/* Comment Threads */}
        <div className="space-y-3">
          {topLevelComments.map((comment: any) => {
            const author = comment.authorId || {};
            const isMyComment = user && (author._id === user.id || author.id === user.id);
            const childReplies = repliesMap.get(comment._id) || [];

            return (
              <div key={comment._id} className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <Link to={`/u/${author.username}`} className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-200">{author.displayName || author.username}</span>
                    <span className="text-[11px] text-slate-500">@{author.username}</span>
                  </Link>
                  <span className="text-[10px] text-slate-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-300 leading-relaxed break-words whitespace-pre-line">
                  {comment.text}
                </div>

                <div className="mt-2.5 flex items-center space-x-4 text-[11px] text-slate-400">
                  {user && (
                    <button
                      onClick={() => setReplyParentId(comment._id)}
                      className="flex items-center space-x-1 hover:text-indigo-400 transition"
                    >
                      <Reply className="w-3 h-3" />
                      <span>Reply</span>
                    </button>
                  )}
                  {isMyComment && (
                    <button
                      onClick={() => handleDeleteComment(comment._id)}
                      className="flex items-center space-x-1 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                {/* Nested Replies (1 level) */}
                {childReplies.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-slate-800 space-y-2.5">
                    {childReplies.map((reply: any) => {
                      const rAuthor = reply.authorId || {};
                      const isMyReply = user && (rAuthor._id === user.id || rAuthor.id === user.id);
                      return (
                        <div key={reply._id} className="pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-200">{rAuthor.displayName || rAuthor.username}</span>
                            <span className="text-[10px] text-slate-500">{new Date(reply.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-300 leading-relaxed">
                            {reply.text}
                          </div>
                          {isMyReply && (
                            <button
                              onClick={() => handleDeleteComment(reply._id)}
                              className="mt-1 text-[10px] text-slate-500 hover:text-rose-400 transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
