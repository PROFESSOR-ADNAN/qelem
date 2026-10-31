import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.js';
import { Settings, Globe, Database, Download, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { dataSaver, toggleDataSaver } = useTheme();
  const { t, i18n } = useTranslation();

  const [message, setMessage] = useState<string | null>(null);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('qelem_language', lang);
  };

  const handleExportData = async () => {
    try {
      const data = await apiFetch('/account/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qelem-data-export-${user?.username}.json`;
      a.click();
      setMessage('Account data exported successfully.');
    } catch {
      setMessage('Failed to export account data.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to request account deletion? Your content will be hidden for 30 days before permanent deletion.')) {
      return;
    }

    try {
      await apiFetch('/account/delete', { method: 'POST' });
      alert('Deletion requested. You will now be logged out.');
      logout();
    } catch {
      alert('Failed to request deletion.');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 px-3 sm:px-4 pb-20 md:pb-8">
      <div className="flex items-center space-x-2 mb-6">
        <Settings className="w-5 h-5 text-indigo-400" />
        <h1 className="text-base font-bold text-white">{t('settings.title')}</h1>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Language Selection */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">{t('settings.language')}</p>
              <p className="text-xs text-slate-400">English / አማርኛ</p>
            </div>
          </div>
          <select
            value={i18n.language}
            onChange={handleLanguageChange}
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200"
          >
            <option value="en">English</option>
            <option value="am">አማርኛ (Amharic)</option>
          </select>
        </div>

        {/* Data Saver Mode Toggle */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <div className="pr-4">
              <p className="text-sm font-semibold text-slate-100">{t('settings.dataSaver')}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('settings.dataSaverDesc')}</p>
            </div>
          </div>
          <button
            onClick={toggleDataSaver}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
              dataSaver
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            {dataSaver ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {/* Account Data Export */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Download className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-semibold text-slate-100">{t('settings.exportData')}</p>
              <p className="text-xs text-slate-400">Download profile, devlogs, and comments in JSON format.</p>
            </div>
          </div>
          <button
            onClick={handleExportData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Export
          </button>
        </div>

        {/* Account Deletion */}
        <div className="p-4 rounded-xl border border-rose-950/60 bg-rose-950/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <div className="pr-4">
              <p className="text-sm font-semibold text-rose-300">{t('settings.deleteAccount')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings.deleteDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-800 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
