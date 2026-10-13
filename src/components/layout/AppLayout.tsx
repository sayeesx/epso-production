import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { NavigationProgress } from '../ui/NavigationProgress';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { TbWifiOff } from 'react-icons/tb';

export const AppLayout: React.FC = () => {
  const { isOffline } = useApp();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-canvas dark:bg-canvas-dark text-charcoal dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <NavigationProgress />
      <ToastContainer />

      {/* Offline Alert Banner (shown only when offline) */}
      {isOffline && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-sm">
          <TbWifiOff className="w-3.5 h-3.5" />
          <span>{t.offlineNotice || 'Working Offline'}</span>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-8 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
};
