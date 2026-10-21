import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  TbDroplet,
  TbCheck,
} from 'react-icons/tb';

interface DailyOilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialDate?: string;
}

export const DailyOilModal: React.FC<DailyOilModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { repo, staffName, addToast, triggerRefresh } = useApp();
  const { language } = useLanguage();

  // Date is locked to today internally (not displayed)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Measured oil states (max 250 kg)
  const [usedOil, setUsedOil] = useState<number>(15);
  const [leftoverOil, setLeftoverOil] = useState<number>(10);
  const [usedInputStr, setUsedInputStr] = useState<string>('15');
  const [leftoverInputStr, setLeftoverInputStr] = useState<string>('10');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  // Ruler track ref for used oil
  const usedRulerRef = useRef<HTMLDivElement>(null);
  const isUsedScrollingRef = useRef<boolean>(false);

  // Progress ruler ref for leftover oil
  const leftoverTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingLeftover = useRef<boolean>(false);

  // Ruler constants for used oil (0 to 250 kg, 0.5kg steps)
  const USED_MIN = 0;
  const USED_MAX = 250;
  const USED_STEP = 0.5;
  const TICK_WIDTH = 10; // px per step

  // Load existing data if recorded for today
  useEffect(() => {
    if (isOpen) {
      setIsLoadingExisting(true);
      let isMounted = true;
      repo.getDailyClosing(todayStr).then((existing) => {
        if (!isMounted) return;
        if (existing) {
          const u = existing.oilConsumed > 0 ? Number(existing.oilConsumed) : 15;
          const l = existing.oilClosingBalance > 0 ? Number(existing.oilClosingBalance) : 10;
          const safeU = Math.min(USED_MAX, Math.max(0, u));
          const safeL = Math.min(safeU, Math.max(0, l));
          setUsedOil(safeU);
          setLeftoverOil(safeL);
          setUsedInputStr(String(safeU));
          setLeftoverInputStr(String(safeL));
        } else {
          setUsedOil(15);
          setLeftoverOil(10);
          setUsedInputStr('15');
          setLeftoverInputStr('10');
        }
        setIsLoadingExisting(false);
      }).catch(() => {
        if (isMounted) setIsLoadingExisting(false);
      });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, repo, todayStr]);

  // Center ruler on used oil change
  const scrollUsedRulerTo = useCallback((val: number) => {
    if (!usedRulerRef.current) return;
    const ticksFromMin = (val - USED_MIN) / USED_STEP;
    const scrollTarget = ticksFromMin * TICK_WIDTH;
    isUsedScrollingRef.current = true;
    usedRulerRef.current.scrollTo({
      left: scrollTarget,
      behavior: 'smooth',
    });
    setTimeout(() => {
      isUsedScrollingRef.current = false;
    }, 200);
  }, []);

  useEffect(() => {
    if (isOpen && !isLoadingExisting) {
      setTimeout(() => {
        scrollUsedRulerTo(usedOil);
      }, 150);
    }
  }, [isOpen, isLoadingExisting, scrollUsedRulerTo]);

  // Handle ruler scroll
  const handleUsedRulerScroll = () => {
    if (!usedRulerRef.current || isUsedScrollingRef.current) return;
    const scrollLeft = usedRulerRef.current.scrollLeft;
    const tickIndex = Math.round(scrollLeft / TICK_WIDTH);
    const calculatedVal = Number((USED_MIN + tickIndex * USED_STEP).toFixed(1));
    const clamped = Math.max(USED_MIN, Math.min(USED_MAX, calculatedVal));
    setUsedOil(clamped);
    setUsedInputStr(String(clamped));
    // Leftover cannot be more than used oil
    if (leftoverOil > clamped) {
      setLeftoverOil(clamped);
      setLeftoverInputStr(String(clamped));
    }
  };

  // Leftover Progress Ruler calculation (max scale is usedOil)
  const maxLeftoverScale = useMemo(() => {
    return Math.max(0.1, usedOil);
  }, [usedOil]);

  const leftoverPercentage = useMemo(() => {
    if (maxLeftoverScale <= 0) return 0;
    return Math.min(100, Math.max(0, (leftoverOil / maxLeftoverScale) * 100));
  }, [leftoverOil, maxLeftoverScale]);

  const updateLeftoverFromClientX = useCallback((clientX: number) => {
    if (!leftoverTrackRef.current) return;
    const rect = leftoverTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = ratio * maxLeftoverScale;
    // Snap to 0.5 kg, clamp to max usedOil
    const snapped = Math.round(rawVal * 2) / 2;
    const clamped = Math.min(usedOil, Math.max(0, snapped));
    setLeftoverOil(clamped);
    setLeftoverInputStr(String(clamped));
  }, [maxLeftoverScale, usedOil]);

  const handleLeftoverMouseDown = (e: React.MouseEvent) => {
    isDraggingLeftover.current = true;
    updateLeftoverFromClientX(e.clientX);
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingLeftover.current) {
        updateLeftoverFromClientX(moveEvent.clientX);
      }
    };
    const onMouseUp = () => {
      isDraggingLeftover.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleLeftoverTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      updateLeftoverFromClientX(e.touches[0].clientX);
    }
  };

  const handleLeftoverTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      updateLeftoverFromClientX(e.touches[0].clientX);
    }
  };

  // Manual input commit for Used Oil
  const handleUsedInputCommit = () => {
    const parsed = parseFloat(usedInputStr);
    const safe = isNaN(parsed) ? 0 : Math.min(USED_MAX, Math.max(0, parsed));
    const clean = Number(safe.toFixed(1));
    setUsedOil(clean);
    setUsedInputStr(String(clean));
    scrollUsedRulerTo(clean);
    if (leftoverOil > clean) {
      setLeftoverOil(clean);
      setLeftoverInputStr(String(clean));
    }
  };

  // Manual input commit for Leftover Oil
  const handleLeftoverInputCommit = () => {
    const parsed = parseFloat(leftoverInputStr);
    const safe = isNaN(parsed) ? 0 : Math.min(usedOil, Math.max(0, parsed));
    const clean = Number(safe.toFixed(1));
    setLeftoverOil(clean);
    setLeftoverInputStr(String(clean));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleUsedInputCommit();
    handleLeftoverInputCommit();

    if (usedOil <= 0) {
      addToast(
        language === 'ml'
          ? 'ഉപയോഗിച്ച ഓയിലിന്റെ അളവ് നൽകുക'
          : 'Please enter a valid quantity for used oil',
        'warning'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const safeLeftover = Math.min(usedOil, Math.max(0, leftoverOil));
      const opening = usedOil + safeLeftover;

      await repo.saveDailyClosing({
        productionDate: todayStr,
        oilOpeningBalance: opening,
        oilPurchases: 0,
        oilClosingBalance: safeLeftover,
        oilCostPerKg: 150,
        productionWages: 0,
        notes: undefined,
        closedBy: staffName || 'Kitchen Staff',
      });

      addToast(
        language === 'ml'
          ? `ഇന്നത്തെ ഓയിൽ (${usedOil}kg ഉപയോഗം, ${safeLeftover}kg ബാക്കി) രേഖപ്പെടുത്തി`
          : `Recorded daily oil: ${usedOil} kg used, ${safeLeftover} kg leftover`,
        'success'
      );

      triggerRefresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save daily oil usage', err);
      addToast(err?.message || 'Failed to record oil usage', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUsedTicks = Math.round((USED_MAX - USED_MIN) / USED_STEP);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <TbDroplet className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white leading-tight">
              {language === 'ml' ? 'ദിവസേനയുള്ള ഓയിൽ രേഖപ്പെടുത്തുക' : 'Record Daily Oil Usage'}
            </h2>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-full">
        <div className="space-y-4 pb-4">
          {/* 1. USED OIL: MEASURED BY HORIZONTAL RULER */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-amber-200 dark:border-amber-900/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <label className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
                  {language === 'ml' ? 'ഉപയോഗിച്ച ഓയിൽ (Used Oil)' : 'Used Oil (Consumed)'} *
                </label>
              </div>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                Max 250 kg
              </span>
            </div>

            {/* Touchable Value Display - Manual entry up to 250 */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/60 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all cursor-text">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="250"
                  value={usedInputStr}
                  onChange={(e) => {
                    const str = e.target.value;
                    setUsedInputStr(str);
                    const parsed = parseFloat(str);
                    if (!isNaN(parsed)) {
                      const clamped = Math.min(USED_MAX, Math.max(0, parsed));
                      setUsedOil(clamped);
                      scrollUsedRulerTo(clamped);
                      if (leftoverOil > clamped) {
                        setLeftoverOil(clamped);
                        setLeftoverInputStr(String(clamped));
                      }
                    }
                  }}
                  onBlur={handleUsedInputCommit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUsedInputCommit();
                    }
                  }}
                  className="text-4xl sm:text-5xl font-black text-amber-900 dark:text-amber-200 tabular-nums text-center w-36 bg-transparent focus:outline-none"
                />
                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 uppercase select-none">
                  kg
                </span>
              </div>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold mt-1">
                {language === 'ml' ? 'നമ്പറിൽ തൊട്ട് അളവ് ടൈപ്പ് ചെയ്യാം (Max 250)' : 'Touch number to type manually (Max 250)'}
              </span>
            </div>

            {/* Interactive Horizontal Ruler Track with reduced line opacity */}
            <div className="relative w-full py-2 overflow-hidden flex flex-col items-center select-none bg-stone-50 dark:bg-[#141212] rounded-2xl border border-charcoal-border/50 dark:border-[#2E2828]">
              {/* Center Orange Marker Needle */}
              <div className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-0.5 z-20 pointer-events-none rounded-full bg-epso-orange">
                <div className="w-2.5 h-2.5 rounded-full -ml-[4px] -top-1 absolute bg-epso-orange shadow-sm" />
              </div>

              {/* Scrollable Ruler Track */}
              <div
                ref={usedRulerRef}
                onScroll={handleUsedRulerScroll}
                className="w-full overflow-x-scroll no-scrollbar touch-pan-x flex items-end h-14 relative select-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="shrink-0 w-1/2" />
                <div className="flex items-end shrink-0" style={{ gap: `${TICK_WIDTH - 2}px` }}>
                  {Array.from({ length: totalUsedTicks + 1 }).map((_, idx) => {
                    const val = Number((USED_MIN + idx * USED_STEP).toFixed(1));
                    const isWhole = Math.abs(Math.round(val) - val) < 0.001;
                    const isMajor = isWhole && (Math.round(val) % 5 === 0);
                    const isMedium = isWhole;

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setUsedOil(val);
                          setUsedInputStr(String(val));
                          scrollUsedRulerTo(val);
                          if (leftoverOil > val) {
                            setLeftoverOil(val);
                            setLeftoverInputStr(String(val));
                          }
                        }}
                        className="flex flex-col items-center justify-end shrink-0 cursor-pointer h-10 pb-1"
                        style={{ width: '2px' }}
                      >
                        <div
                          className={`rounded-full transition-colors ${
                            isMajor
                              ? 'h-8 bg-stone-500/25 dark:bg-stone-400/20 w-[2px]'
                              : isMedium
                              ? 'h-5 bg-stone-400/15 dark:bg-stone-500/15 w-[1.5px]'
                              : 'h-3 bg-stone-300/10 dark:bg-stone-700/10 w-[1px]'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="shrink-0 w-1/2" />
              </div>

              {/* Edge fades */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-stone-50 dark:from-[#141212] to-transparent pointer-events-none z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-stone-50 dark:from-[#141212] to-transparent pointer-events-none z-10" />
            </div>
          </div>

          {/* 2. LEFTOVER OIL: MEASURED BY A HORIZONTAL PROGRESS RULER */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <label className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
                  {language === 'ml' ? 'ബാക്കി വന്ന ഓയിൽ (Leftover Oil)' : 'Leftover Oil (Remaining)'}
                </label>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                Max: {usedOil.toFixed(1)} kg
              </span>
            </div>

            {/* Touchable Value Display - Manual entry up to usedOil */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800/60 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all cursor-text">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={usedOil}
                  value={leftoverInputStr}
                  onChange={(e) => {
                    const str = e.target.value;
                    setLeftoverInputStr(str);
                    const parsed = parseFloat(str);
                    if (!isNaN(parsed)) {
                      const clamped = Math.min(usedOil, Math.max(0, parsed));
                      setLeftoverOil(clamped);
                    }
                  }}
                  onBlur={handleLeftoverInputCommit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLeftoverInputCommit();
                    }
                  }}
                  className="text-4xl sm:text-5xl font-black text-emerald-900 dark:text-emerald-200 tabular-nums text-center w-36 bg-transparent focus:outline-none"
                />
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 uppercase select-none">
                  kg
                </span>
              </div>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold mt-1">
                {language === 'ml' ? `നമ്പറിൽ തൊട്ട് അളവ് ടൈപ്പ് ചെയ്യാം (പരമാവധി ${usedOil.toFixed(1)} kg)` : `Touch number to type manually (Cannot exceed used oil)`}
              </span>
            </div>

            {/* Interactive Horizontal Progress Ruler Track */}
            <div className="space-y-1.5">
              <div
                ref={leftoverTrackRef}
                onMouseDown={handleLeftoverMouseDown}
                onTouchStart={handleLeftoverTouchStart}
                onTouchMove={handleLeftoverTouchMove}
                className="relative w-full h-12 rounded-2xl bg-stone-100 dark:bg-[#141212] border border-charcoal-border/70 dark:border-[#2E2828] overflow-hidden cursor-ew-resize select-none touch-pan-x"
              >
                {/* Liquid Progress Fill */}
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 transition-all duration-75 relative rounded-xl"
                  style={{ width: `${leftoverPercentage}%` }}
                >
                  {/* Glowing fluid wave effect */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                </div>

                {/* Ruler Scale Markings Overlaid - subtle reduced opacity */}
                <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none select-none">
                  {[0, 25, 50, 75, 100].map((pct) => (
                    <div key={pct} className="flex flex-col items-center">
                      <div className="w-[1.5px] h-4 bg-stone-400/15 dark:bg-stone-500/15 rounded-full" />
                    </div>
                  ))}
                </div>

                {/* Floating Thumb Badge inside Progress Bar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 pointer-events-none -translate-x-1/2 transition-all duration-75"
                  style={{ left: `${Math.min(94, Math.max(6, leftoverPercentage))}%` }}
                >
                  <div className="px-2 py-0.5 rounded-lg bg-stone-900/90 text-white text-[10px] font-black shadow-md border border-white/20 whitespace-nowrap">
                    {leftoverOil.toFixed(1)} kg
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium px-1">
                <span>0 kg</span>
                <span className="font-bold text-stone-500 dark:text-stone-400">
                  {leftoverOil.toFixed(1)} / {usedOil.toFixed(1)} kg
                </span>
                <span>{usedOil.toFixed(1)} kg (Max)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions: Fixed on bottom */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 bg-white/95 dark:bg-[#1E1B1B]/95 backdrop-blur-md border-t border-charcoal-border/60 dark:border-[#2E2828] flex items-center justify-end gap-3 z-30 shadow-lg mt-auto">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
            className="font-bold px-4"
          >
            {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            icon={<TbCheck className="w-5 h-5 stroke-[2.5]" />}
            className="font-black px-6 shadow-md"
          >
            {language === 'ml' ? 'ഓയിൽ രേഖപ്പെടുത്തുക' : 'Save Daily Oil'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
