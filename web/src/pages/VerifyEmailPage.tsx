import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { CheckCircle, AlertCircle, Mail, ArrowRight, RefreshCw } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [state, setState] = useState<'verifying' | 'success' | 'error' | 'idle'>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    const verify = async () => {
      try {
        await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token })
        });

        if (mounted) {
          setState('success');
          // Refresh user profile in AuthContext
          await refreshProfile();
        }
      } catch (err: any) {
        if (mounted) {
          setState('error');
          setErrorMessage(err?.message || 'Verification token is invalid or has expired.');
        }
      }
    };

    verify();
    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const emailToUse = user?.email || manualEmail.trim();
    if (!emailToUse && !user) {
      setResendStatus('Please enter your email address to resend the link.');
      return;
    }

    setResending(true);
    setResendStatus(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: emailToUse })
      });
      setResendStatus(res.message || 'Verification email sent! Check your inbox.');
    } catch (err: any) {
      setResendStatus(err?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl text-center">
        {state === 'verifying' && (
          <div className="space-y-4">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-white">Verifying your email...</h2>
            <p className="text-sm text-slate-400">Please wait while we confirm your verification link.</p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">Email Verified!</h2>
            <p className="text-sm text-slate-300">
              Your email address has been successfully confirmed. You now have full access to publish posts, share code logs, and upload media.
            </p>
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => navigate('/compose')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Create Your First Post
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Go to Feed
              </Link>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-5">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white">Verification Failed</h2>
            <p className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900/50 rounded-lg p-3">
              {errorMessage}
            </p>
            <p className="text-sm text-slate-400">
              Verification links expire after 24 hours. You can request a fresh link below.
            </p>

            {!user && (
              <input
                type="email"
                placeholder="Enter your email address"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            )}

            <button
              onClick={() => handleResend()}
              disabled={resending}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {resending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Resend Verification Email
            </button>

            {resendStatus && (
              <p className="text-xs text-blue-400 bg-blue-950/40 border border-blue-900/50 rounded-lg p-2.5">
                {resendStatus}
              </p>
            )}
          </div>
        )}

        {state === 'idle' && (
          <div className="space-y-5">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto text-blue-400">
              <Mail className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
            <p className="text-sm text-slate-400">
              We sent a verification link to your email address when you registered. Please check your inbox and click the link.
            </p>

            {user ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Signed in as: <strong className="text-slate-200">{user.email}</strong>
                </p>
                <button
                  onClick={() => handleResend()}
                  disabled={resending}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {resending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Resend Verification Email
                </button>
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {resending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send Verification Email
                </button>
              </form>
            )}

            {resendStatus && (
              <p className="text-xs text-blue-400 bg-blue-950/40 border border-blue-900/50 rounded-lg p-2.5">
                {resendStatus}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
