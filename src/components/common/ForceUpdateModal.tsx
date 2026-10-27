import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { TbRefresh, TbSparkles, TbRocket, TbArrowRight } from 'react-icons/tb';

interface VersionInfo {
  version: string;
  commit?: string;
  builtAt?: string;
}

export const ForceUpdateModal: React.FC = () => {
  const { language } = useLanguage();
  const [hasNewVersion, setHasNewVersion] = useState<boolean>(false);
  const [newVersionInfo, setNewVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // App's embedded build version
  const currentAppVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const currentAppCommit = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : '';

  const checkForUpdate = useCallback(async () => {
    try {
      // Bust cache using timestamp
      const response = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) return;

      const remoteData: VersionInfo = await response.json();
      if (!remoteData || !remoteData.version) return;

      // Check if version or commit has changed
      const isVersionDifferent =
        remoteData.version.trim() !== currentAppVersion.trim();
      const isCommitDifferent =
        Boolean(remoteData.commit) &&
        Boolean(currentAppCommit) &&
        remoteData.commit !== 'latest' &&
        currentAppCommit !== 'latest' &&
        remoteData.commit?.trim() !== currentAppCommit?.trim();

      if (isVersionDifferent || isCommitDifferent) {
        setNewVersionInfo(remoteData);
        setHasNewVersion(true);
      }
    } catch {
      // Ignore network errors during silent background check
    }
  }, [currentAppVersion, currentAppCommit]);

  useEffect(() => {
    // Initial check after 3 seconds
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    // Periodic check every 25 seconds
    const intervalTimer = setInterval(() => {
      checkForUpdate();
    }, 25000);

    // Check on tab focus or visibility change
    const handleFocus = () => checkForUpdate();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Also listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setHasNewVersion(true);
      });
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdate]);

  // Trap escape key: update is compulsory, no closing allowed
  useEffect(() => {
    if (!hasNewVersion) return;
    const preventEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', preventEscape, true);
    return () => window.removeEventListener('keydown', preventEscape, true);
  }, [hasNewVersion]);

  const handleForceReload = async () => {
    setIsUpdating(true);
    try {
      // 1. Tell all waiting service workers to skip waiting
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }

      // 2. Clear all web caches to ensure clean hot reload of bundle
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      }
    } catch {
      // Continue to reload even if cache clearing errors
    }

    // 3. Force reload page with timestamp query param to bypass browser cache
    setTimeout(() => {
      const cleanUrl = window.location.origin + window.location.pathname + `?hot_reload=${Date.now()}`;
      window.location.replace(cleanUrl);
    }, 200);
  };

  if (!hasNewVersion) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-stone-950/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1E1B1B] rounded-3xl p-6 sm:p-7 border-2 border-epso-red/30 dark:border-amber-500/30 shadow-2xl space-y-5 text-center relative overflow-hidden">
        {/* Glow ambient background accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-epso-red/20 dark:bg-amber-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-epso-orange/20 dark:bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Animated Badge Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-epso-red to-epso-orange text-white flex items-center justify-center mx-auto shadow-lg shadow-epso-red/30 relative animate-bounce duration-1000">
          <TbRocket className="w-8 h-8 stroke-[2.2]" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400" />
          </span>
        </div>

        {/* Title and Version comparison */}
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs font-black uppercase tracking-wider font-sans">
            <TbSparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Update Compulsory</span>
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white leading-tight font-malayalam">
            {language === 'ml'
              ? 'പുതിയ അപ്ഡേറ്റ് പതിപ്പ് ലഭ്യമാണ്!'
              : 'New Update Version Available!'}
          </h2>

          <div className="flex items-center justify-center gap-2 pt-1 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#141212] text-stone-600 dark:text-stone-400 font-bold">
              v{currentAppVersion}
            </span>
            <TbArrowRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="px-2.5 py-1 rounded-lg bg-epso-red/10 dark:bg-amber-500/20 text-epso-red dark:text-amber-400 font-black">
              v{newVersionInfo?.version || 'Latest'}
            </span>
          </div>
        </div>

        {/* Compulsory message */}
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 font-medium font-malayalam leading-relaxed">
          {language === 'ml'
            ? 'ആപ്പിൽ പുതിയ ഫീച്ചറുകളും സുപ്രധാന മാറ്റങ്ങളും വന്നിട്ടുണ്ട്. തുടർന്ന് പ്രവർത്തിക്കുന്നതിനായി ഇപ്പോൾ അപ്ഡേറ്റ് ചെയ്യുക. അപ്ഡേറ്റ് നിർബന്ധമാണ്.'
            : 'A new version with the latest updates and database fixes has been published. Please update now to continue using the app. This update is required.'}
        </p>

        {/* Compulsory Update Button (NO CLOSE / CANCEL BUTTON) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleForceReload}
            disabled={isUpdating}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-epso-red to-epso-orange hover:bg-epso-red-hover text-white font-black text-base shadow-xl shadow-epso-red/25 transition-all active:scale-95 press-apple flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75"
          >
            {isUpdating ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
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
                <span>{language === 'ml' ? 'അപ്ഡേറ്റ് ചെയ്യുന്നു...' : 'Updating App...'}</span>
              </>
            ) : (
              <>
                <TbRefresh className="w-5 h-5 stroke-[2.5]" />
                <span className="font-malayalam">
                  {language === 'ml' ? 'ഇപ്പോൾ അപ്ഡേറ്റ് ചെയ്യുക' : 'Update & Hot Reload'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
