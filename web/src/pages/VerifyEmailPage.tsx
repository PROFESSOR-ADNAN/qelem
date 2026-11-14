import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { CheckCircle, AlertCircle, Mail, Phone, ArrowRight, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');

  // Email verification state
  const [emailState, setEmailState] = useState<'verifying' | 'success' | 'error' | 'idle'>(token ? 'verifying' : 'idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');

  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Auto-verify email token if present in URL
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
          setEmailState('success');
          await refreshProfile();
        }
      } catch (err: any) {
        if (mounted) {
          setEmailState('error');
          setEmailError(err?.message || 'Verification token is invalid or has expired.');
        }
      }
    };

    verify();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Resend Email handler
  const handleResendEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const emailToUse = user?.email || manualEmail.trim();
    if (!emailToUse && !user) {
      setResendStatus('Please enter your email address.');
      return;
    }

    setResendingEmail(true);
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
      setResendingEmail(false);
    }
  };

  // Send SMS OTP handler (AfroMessage)
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const phone = phoneNumber.trim();
    if (!phone) {
      setPhoneError('Please enter your Ethiopian mobile number (e.g. 0912345678 or 0712345678).');
      return;
    }

    setSendingOtp(true);
    setPhoneError(null);
    setPhoneMessage(null);

    try {
      const res = await apiFetch<{ message: string; phone: string }>('/auth/phone/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          email: user?.email || undefined
        })
      });
      setOtpSent(true);
      setPhoneMessage(res.message || `Code sent to ${res.phone}!`);
    } catch (err: any) {
      setPhoneError(err?.message || 'Failed to dispatch SMS verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify SMS OTP code handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.trim();
    if (!code || code.length < 6) {
      setPhoneError('Please enter the 6-digit verification code.');
      return;
    }

    setVerifyingOtp(true);
    setPhoneError(null);

    try {
      const res = await apiFetch<{ message: string }>('/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: phoneNumber.trim(),
          code
        })
      });
      setPhoneSuccess(true);
      await refreshProfile();
    } catch (err: any) {
      setPhoneError(err?.message || 'Invalid or expired code. Please request a new one.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const isAlreadyVerified = user?.isEmailVerified || user?.isPhoneVerified || phoneSuccess || emailState === 'success';

  return (
    <div className="max-w-md mx-auto py-10 px-4 sm:px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Verification Success Screen */}
        {isAlreadyVerified ? (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">Account Verified!</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Congratulations! Your account is fully verified. You now have full access to publish posts, share code logs, and upload media on Qelem.
            </p>
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => navigate('/compose')}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
              >
                Create Your First Post
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2 rounded-lg transition-colors text-center"
              >
                Go to Feed
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center mx-auto text-indigo-400 mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white">Verify Your Account</h1>
              <p className="text-xs text-slate-400 mt-1">
                Choose either Email or Ethiopian Phone SMS to activate publishing
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'email'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email Link
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('phone')}
                className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'phone'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Phone className="w-4 h-4" />
                Phone SMS (AfroMessage)
              </button>
            </div>

            {/* TAB 1: EMAIL VERIFICATION */}
            {activeTab === 'email' && (
              <div className="text-center space-y-4">
                {emailState === 'verifying' && (
                  <div className="py-4 space-y-3">
                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                    <p className="text-sm font-medium text-white">Confirming email token...</p>
                  </div>
                )}

                {emailState === 'error' && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-xs text-rose-300 text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{emailError}</span>
                  </div>
                )}

                {emailState !== 'verifying' && (
                  <div className="space-y-4 text-left">
                    <p className="text-xs text-slate-300 leading-relaxed text-center">
                      We dispatched a verification link to your email address when you registered.
                    </p>

                    {user ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                        <span className="text-slate-400 block">Registered Email:</span>
                        <span className="font-semibold text-white block truncate">{user.email}</span>
                      </div>
                    ) : (
                      <input
                        type="email"
                        required
                        placeholder="Enter your registered email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    )}

                    <div className="space-y-2 pt-1">
                      <a
                        href="https://mail.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Gmail Inbox
                      </a>

                      <button
                        onClick={() => handleResendEmail()}
                        disabled={resendingEmail}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs"
                      >
                        {resendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Resend Verification Email
                      </button>
                    </div>

                    {resendStatus && (
                      <p className="text-xs text-blue-400 bg-blue-950/40 border border-blue-900/50 rounded-lg p-2.5 text-center">
                        {resendStatus}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PHONE SMS OTP VERIFICATION */}
            {activeTab === 'phone' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed text-center">
                  Receive a 6-digit SMS code via <strong>AfroMessage</strong> to your Ethio Telecom or Safaricom number.
                </p>

                {phoneError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{phoneError}</span>
                  </div>
                )}

                {phoneMessage && (
                  <div className="p-2.5 bg-blue-950/40 border border-blue-900/50 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{phoneMessage}</span>
                  </div>
                )}

                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Ethiopian Mobile Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0912345678 or 0712345678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sendingOtp}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs shadow"
                    >
                      {sendingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      Send 6-Digit SMS Code
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Enter 6-Digit SMS Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={verifyingOtp || otpCode.length < 6}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs shadow"
                    >
                      {verifyingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Verify Phone & Unlock
                    </button>

                    <div className="flex justify-between items-center pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                        }}
                        className="text-slate-400 hover:text-slate-200 underline"
                      >
                        Change Number
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={sendingOtp}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
