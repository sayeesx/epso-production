import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { TbWifiOff } from 'react-icons/tb';

export const Header: React.FC = () => {
  const { isOffline } = useApp();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#141212] border-b border-charcoal-border/80 dark:border-charcoal-border-dark px-4 sm:px-6 py-2.5 transition-colors duration-200 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer flex items-center gap-2.5 select-none press-apple"
          title="Epso Production Home"
        >
          <img
            src={isDark ? '/epso-logo-dark.png' : '/epso-logo-light.png'}
            alt="Epso Logo"
            className="h-8 sm:h-9 w-auto object-contain transition-opacity duration-200"
          />
        </div>

        {/* Offline indicator if connection lost */}
        {isOffline && (
          <div
            className="flex items-center gap-1 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full animate-pulse shadow-sm"
            title={t.offlineNotice}
          >
            <TbWifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </div>
        )}
      </div>
    </header>
  );
};
