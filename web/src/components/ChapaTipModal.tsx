import React, { useState } from 'react';
import { X, HeartHandshake, ExternalLink, AlertCircle, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface ChapaTipModalProps {
  authorId: string;
  authorName: string;
  authorUsername: string;
  postId?: string;
  onClose: () => void;
}

export const ChapaTipModal: React.FC<ChapaTipModalProps> = ({
  authorId,
  authorName,
  authorUsername,
  postId,
  onClose
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [name, setName] = useState(user?.displayName || 'Anonymous Supporter');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRESETS = [25, 50, 100, 200];

  const handleTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    if (isNaN(finalAmount) || finalAmount < 10) {
      setError('Minimum tip is 10 ETB');
      return;
    }
    if (!email.trim() || !name.trim()) {
      setError('Please provide your name and email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ checkoutUrl: string; txRef: string }>('/payments/chapa/initialize', {
        method: 'POST',
        body: JSON.stringify({
          authorId,
          postId,
          amount: finalAmount,
          currency: 'ETB',
          email: email.trim(),
          name: name.trim(),
          message: message.trim() || undefined
        })
      });

      if (res.checkoutUrl) {
        window.open(res.checkoutUrl, '_blank', 'noopener,noreferrer');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed. Please check network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Support @{authorUsername}</h2>
            <p className="text-xs text-slate-400">Via Chapa (Telebirr, CBE Birr & Cards)</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleTip} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Select Amount (ETB)</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {PRESETS.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => {
                    setAmount(val);
                    setCustomAmount('');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition border ${
                    amount === val && !customAmount
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {val} ETB
                </button>
              ))}
            </div>
            <input
              type="number"
              min="10"
              placeholder="Or enter custom amount (e.g. 500 ETB)"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Your Email (for receipt)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Note / Encouragement (Optional)</label>
            <input
              type="text"
              maxLength={140}
              placeholder="Great writeup! Keep building."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            <span>{loading ? 'Initializing Chapa...' : `Pay ${customAmount || amount} ETB via Telebirr / CBE`}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center justify-center space-x-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured Ethiopian Gateway by Chapa Financial</span>
          </div>
        </form>
      </div>
    </div>
  );
};
