import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const NavigationProgress: React.FC = () => {
  const location = useLocation();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When location changes, trigger a quick, responsive progress animation
    setNavigating(true);
    setProgress(30);

    const t1 = setTimeout(() => {
      setProgress(75);
    }, 100);

    const t2 = setTimeout(() => {
      setProgress(100);
    }, 220);

    const t3 = setTimeout(() => {
      setNavigating(false);
      setProgress(0);
    }, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname, location.search]);

  if (!navigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Top Progress Line */}
      <div
        className="h-1 bg-gradient-to-r from-epso-red via-epso-orange to-amber-400 transition-all duration-200 ease-out shadow-[0_0_8px_rgba(198,56,43,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: navigating ? 1 : 0,
        }}
      />

      {/* Floating Micro-Spinner at top-right */}
      <div
        className="absolute top-2.5 right-3 bg-white/90 dark:bg-[#1E1B1B]/90 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-stone-200 dark:border-[#2E2828] transition-opacity duration-200"
        style={{ opacity: navigating ? 1 : 0 }}
      >
        <svg
          className="animate-spin h-3.5 w-3.5 text-epso-red dark:text-amber-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>
  );
};
