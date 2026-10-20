import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { NavigationProgress } from '../ui/NavigationProgress';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { ProductionPinGate } from '../auth/ProductionPinGate';
import { OfflineScreen } from '../ui/OfflineScreen';

export const AppLayout: React.FC = () => {
  const { isOffline } = useApp();
  const { t } = useLanguage();

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('epso_production_unlocked') === 'true';
  });

  if (isOffline) {
    return <OfflineScreen onRetry={() => window.location.reload()} />;
  }

  if (!isUnlocked) {
    return <ProductionPinGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-canvas-dark text-charcoal dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <NavigationProgress />
      <ToastContainer />

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
