import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui/ToastContainer';
import { NavigationProgress } from '../ui/NavigationProgress';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas dark:bg-canvas-dark text-charcoal dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <NavigationProgress />
      <Header />
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
