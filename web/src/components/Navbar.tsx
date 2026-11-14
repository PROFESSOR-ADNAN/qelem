import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusSquare, Bell, Bookmark, Settings, ShieldAlert, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { user, unreadCount, logout } = useAuth();
  const { dataSaver, toggleDataSaver } = useTheme();
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('qelem_language', next);
  };

  const navItems = [
    { label: t('nav.home'), path: '/', icon: Home },
    { label: t('nav.explore'), path: '/explore', icon: Compass },
    ...(user
      ? [
          { label: t('nav.compose'), path: '/compose', icon: PlusSquare },
          { label: t('nav.notifications'), path: '/notifications', icon: Bell, badge: unreadCount },
          { label: t('nav.bookmarks'), path: '/bookmarks', icon: Bookmark }
        ]
      : [])
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      {user && !user.isEmailVerified && !user.isPhoneVerified && location.pathname !== '/verify-email' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <span className="font-semibold text-amber-400">⚠️ Verification Required:</span>
            <span className="truncate">Please verify your email or Ethiopian phone number to unlock posting.</span>
          </div>
          <Link
            to="/verify-email"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded text-[11px] transition shrink-0 ml-3 shadow"
          >
            Verify Now
          </Link>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-indigo-500/20 shadow-lg">
            ቀ
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-white group-hover:text-indigo-400 transition">
              {t('brand')}
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline">ቀለም • Devlog</span>
          </div>
        </Link>

        {/* Center Nav for Tablet/Desktop */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-slate-800 text-indigo-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Controls: DataSaver, Lang, Profile */}
        <div className="flex items-center space-x-2">
          {/* Data Saver Mode Pill */}
          <button
            onClick={toggleDataSaver}
            title={dataSaver ? 'Data Saver: ON (3G Mode)' : 'Data Saver: OFF'}
            className={`px-2 py-1 rounded text-xs font-mono font-medium border transition ${
              dataSaver
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            3G {dataSaver ? 'ON' : 'OFF'}
          </button>

          {/* Lang toggle */}
          <button
            onClick={toggleLanguage}
            className="px-2 py-1 rounded text-xs font-medium border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 transition"
          >
            {i18n.language === 'en' ? 'አማርኛ' : 'EN'}
          </button>

          {/* Auth controls */}
          {user ? (
            <div className="flex items-center space-x-2">
              <Link
                to={`/u/${user.username}`}
                className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-indigo-300 hover:border-indigo-500 transition"
                title={user.displayName}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </Link>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition"
                title={t('nav.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t('nav.login')}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
