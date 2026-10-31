import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusSquare, Bell, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const BottomNav: React.FC = () => {
  const { user, unreadCount } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const items = [
    { path: '/', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Compass, label: 'Explore' },
    { path: '/compose', icon: PlusSquare, label: 'Post' },
    { path: '/notifications', icon: Bell, label: 'Alerts', badge: unreadCount },
    { path: `/u/${user.username}`, icon: User, label: 'Profile' }
  ];

  return (
    <div className="fixed bottom-0 left-0 z-40 w-full h-14 bg-slate-950/95 border-t border-slate-800 md:hidden flex items-center justify-around px-2 backdrop-blur-md">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-lg transition ${
              isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
};
