import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LogIn, AlertCircle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const LoginPage: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      await login({ login: loginInput, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="border border-slate-800 bg-slate-900/60 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white mx-auto mb-2 shadow-lg shadow-indigo-600/30">
            ቀ
          </div>
          <h1 className="text-xl font-bold text-white">Log in to Qelem</h1>
          <p className="text-xs text-slate-400 mt-1">Devlog community for Ethiopian CS students</p>
        </div>

        {/* 1-Click Demo Guest Login */}
        <div className="mb-6 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/70 to-purple-950/50 border border-indigo-500/30 text-center">
          <p className="text-xs text-indigo-300 font-medium mb-2">
            Portfolio Reviewer or Recruiter?
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                await demoLogin();
                navigate('/');
              } catch (err: any) {
                setError(err.message || 'Demo login failed');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>🚀 1-Click Demo Login (AAU Student)</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Username or Email
            </label>
            <input
              type="text"
              required
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition flex items-center justify-center space-x-1.5 shadow"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:underline font-semibold">
            Sign up here
          </Link>
        </div>
      </div>
    </div>
  );
};
