import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CODE_LANGUAGES, CodeLanguage } from '@qelem/shared';
import { offlineDB } from '../offline/db.js';
import { apiFetch, ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Code, Image as ImageIcon, Send, X, Save, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function generateUUID(): string {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const ComposerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeLang, setCodeLang] = useState<CodeLanguage>('python');
  const [codeBody, setCodeBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [mediaFiles, setMediaFiles] = useState<{ id: string; file: File; preview: string; uploadedId?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Restore draft from Dexie on mount
  useEffect(() => {
    offlineDB.drafts.toCollection().last().then(draft => {
      if (draft && !text) {
        setText(draft.text || '');
        if (draft.code) {
          setShowCode(true);
          setCodeLang(draft.code.lang as CodeLanguage);
          setCodeBody(draft.code.body);
        }
        if (draft.tags) {
          setTagsInput(draft.tags.join(', '));
        }
      }
    });
  }, []);

  // Auto-save draft to Dexie every 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() || codeBody.trim()) {
        const tags = tagsInput
          .split(',')
          .map(t => t.trim().toLowerCase())
          .filter(t => t.length > 0);

        offlineDB.drafts.put({
          id: 1, // Single active draft slot
          text,
          code: showCode && codeBody.trim() ? { lang: codeLang, body: codeBody } : undefined,
          tags,
          updatedAt: Date.now()
        });
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [text, showCode, codeLang, codeBody, tagsInput]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 4 - mediaFiles.length);

    const newMedia = files.map(file => ({
      id: generateUUID(),
      file,
      preview: URL.createObjectURL(file)
    }));

    setMediaFiles(prev => [...prev, ...newMedia]);
  };

  const removeImage = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(t('composer.publishing'));

    const clientPostId = generateUUID();
    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))
      .filter(t => t.length >= 2)
      .slice(0, 5);

    try {
      // 1. Upload media files directly to S3 if attached
      const uploadedMediaIds: string[] = [];

      for (const item of mediaFiles) {
        // Request presigned upload URL
        const uploadUrlRes = await apiFetch<{ uploadUrl: string; assetId: string }>('/media/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            clientAssetId: item.id,
            contentType: item.file.type,
            size: item.file.size
          })
        });

        // Upload direct to storage
        await fetch(uploadUrlRes.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type },
          body: item.file
        });

        // Confirm upload
        await apiFetch('/media/confirm', {
          method: 'POST',
          body: JSON.stringify({ assetId: uploadUrlRes.assetId })
        });

        uploadedMediaIds.push(uploadUrlRes.assetId);
      }

      // 2. Submit post to Express API
      const payload = {
        clientPostId,
        text,
        code: showCode && codeBody.trim() ? { lang: codeLang, body: codeBody } : undefined,
        tags,
        mediaIds: uploadedMediaIds
      };

      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Clear draft in IndexedDB
      await offlineDB.drafts.clear();

      navigate('/');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setStatusMessage(err.message || 'Failed to publish post');
        return;
      }

      // Offline fallback: save to outbox queue only on genuine network failure
      const payload = {
        clientPostId,
        text,
        code: showCode && codeBody.trim() ? { lang: codeLang, body: codeBody } : undefined,
        tags,
        mediaIds: []
      };

      await offlineDB.outbox.put({
        clientPostId,
        payload,
        status: 'queued',
        attempts: 0,
        createdAt: Date.now()
      });

      setStatusMessage(t('composer.queuedOffline'));
      setTimeout(() => navigate('/'), 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4 sm:p-5">
        <h1 className="text-base font-bold text-white mb-3">{t('composer.title')}</h1>

        {user && !user.isEmailVerified && !user.isPhoneVerified && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>Your account is not verified yet. Please verify your email or Ethiopian phone number to publish. </span>
              <Link to="/verify-email" className="font-semibold underline hover:text-amber-200 ml-1">
                Verify Now
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Textarea */}
          <div className="relative">
            <textarea
              rows={4}
              maxLength={2000}
              placeholder={t('composer.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
            />
            <div className="text-right text-[11px] text-slate-500 mt-1">
              {text.length} / 2000
            </div>
          </div>

          {/* Code Snippet Block Toggle */}
          {showCode && (
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 font-mono">Code Snippet</span>
                <select
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value as CodeLanguage)}
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none"
                >
                  {CODE_LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              <textarea
                rows={5}
                maxLength={3000}
                placeholder={t('composer.codePlaceholder')}
                value={codeBody}
                onChange={(e) => setCodeBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          {/* Image Previews */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mediaFiles.map(m => (
                <div key={m.id} className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={m.preview} alt="Upload preview" className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(m.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/80 text-slate-300 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tags Input */}
          <div>
            <input
              type="text"
              placeholder={t('composer.tagsPlaceholder')}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800 text-xs text-indigo-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Code Toggle Button */}
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className={`p-2 rounded-lg border transition ${
                  showCode
                    ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Attach code snippet"
              >
                <Code className="w-4 h-4" />
              </button>

              {/* Image Upload Input */}
              {mediaFiles.length < 4 && (
                <label className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition">
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!text.trim() || isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition flex items-center space-x-1.5 shadow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('composer.publish')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
