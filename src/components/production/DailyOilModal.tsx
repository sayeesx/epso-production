import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  TbDroplet,
  TbCalendar,
  TbCheck,
  TbLock,
  TbPlus,
  TbMinus,
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

  // Date is locked to today - cannot be modified
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Measured oil states
  const [usedOil, setUsedOil] = useState<number>(15);
  const [leftoverOil, setLeftoverOil] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  // Ruler track ref for used oil
  const usedRulerRef = useRef<HTMLDivElement>(null);
  const isUsedScrollingRef = useRef<boolean>(false);

  // Progress ruler ref for leftover oil
  const leftoverTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingLeftover = useRef<boolean>(false);

  // Ruler constants for used oil (0.5kg steps, 0.5 to 100 kg)
  const USED_MIN = 0.5;
  const USED_MAX = 80;
  const USED_STEP = 0.5;
  const TICK_WIDTH = 12; // px per step

  // Maximum leftover scale based on used oil (minimum 30kg scale)
  const maxLeftoverScale = useMemo(() => {
    return Math.max(30, Math.ceil((usedOil || 15) * 1.5));
  }, [usedOil]);

  // Load existing data if recorded for today
  useEffect(() => {
    if (isOpen) {
      setIsLoadingExisting(true);
      let isMounted = true;
      repo.getDailyClosing(todayStr).then((existing) => {
        if (!isMounted) return;
        if (existing) {
          if (existing.oilConsumed > 0) setUsedOil(Number(existing.oilConsumed));
          if (existing.oilClosingBalance > 0) setLeftoverOil(Number(existing.oilClosingBalance));
        } else {
          setUsedOil(15);
          setLeftoverOil(10);
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
    }, 250);
  }, []);

  useEffect(() => {
    if (isOpen && !isLoadingExisting) {
      setTimeout(() => {
        scrollUsedRulerTo(usedOil);
      }, 150);
    }
  }, [isOpen, isLoadingExisting, scrollUsedRulerTo]);

  const handleUsedRulerScroll = () => {
    if (!usedRulerRef.current || isUsedScrollingRef.current) return;
    const scrollLeft = usedRulerRef.current.scrollLeft;
    const tickIndex = Math.round(scrollLeft / TICK_WIDTH);
    const calculatedVal = Number((USED_MIN + tickIndex * USED_STEP).toFixed(1));
    const clamped = Math.max(USED_MIN, Math.min(USED_MAX, calculatedVal));
    setUsedOil(clamped);
  };

  const adjustUsedOil = (delta: number) => {
    const next = Number(Math.max(USED_MIN, Math.min(USED_MAX, usedOil + delta)).toFixed(1));
    setUsedOil(next);
    scrollUsedRulerTo(next);
  };

  // Leftover Progress Ruler calculation and drag/scroll interaction
  const leftoverPercentage = useMemo(() => {
    if (maxLeftoverScale <= 0) return 0;
    return Math.min(100, Math.max(0, (leftoverOil / maxLeftoverScale) * 100));
  }, [leftoverOil, maxLeftoverScale]);

  const updateLeftoverFromClientX = useCallback((clientX: number) => {
    if (!leftoverTrackRef.current) return;
    const rect = leftoverTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawVal = ratio * maxLeftoverScale;
    // Snap to 0.5 kg
    const snapped = Math.round(rawVal * 2) / 2;
    setLeftoverOil(snapped);
  }, [maxLeftoverScale]);

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

  const adjustLeftover = (delta: number) => {
    setLeftoverOil((prev) => {
      const next = Number(Math.max(0, Math.min(maxLeftoverScale, prev + delta)).toFixed(1));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const safeLeftover = Math.max(0, leftoverOil);
      const opening = usedOil + safeLeftover;

      await repo.saveDailyClosing({
        productionDate: todayStr,
        oilOpeningBalance: opening,
        oilPurchases: 0,
        oilClosingBalance: safeLeftover,
        oilCostPerKg: 150,
        productionWages: 0,
        notes: undefined, // Notes removed as per request
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
            <p className="text-xs text-stone-500 dark:text-stone-400 font-normal">
              {language === 'ml'
                ? 'റൂളർ ഉപയോഗിച്ച് ഉപയോഗിച്ച ഓയിലും ബാക്കി വന്ന ഓയിലും രേഖപ്പെടുത്തുക'
                : 'Measure used and leftover oil with interactive rulers'}
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Today's Date Locked Badge */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-100 dark:bg-[#1A1616] border border-charcoal-border/50 dark:border-[#2E2828] text-xs">
          <div className="flex items-center gap-2">
            <TbCalendar className="w-4 h-4 text-epso-orange" />
            <span className="font-bold text-stone-600 dark:text-stone-400">
              {language === 'ml' ? 'തീയതി (Date)' : 'Production Date'}:
            </span>
            <span className="font-black text-stone-900 dark:text-white">
              {formattedToday}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-stone-500 dark:text-stone-400 bg-white dark:bg-[#252020] px-2.5 py-1 rounded-xl border border-charcoal-border/40 dark:border-[#2E2828]">
            <TbLock className="w-3 h-3 text-amber-500" />
            <span>{language === 'ml' ? 'ഇന്നത്തെ തീയതി' : 'Today Locked'}</span>
          </div>
        </div>

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
              Ruler Measurement
            </span>
          </div>

          {/* Large Value Display with Steppers - Fixed Position */}
          <div className="flex items-center justify-center gap-2 py-1">
            <button
              type="button"
              onClick={() => adjustUsedOil(-1)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="-1 kg"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => adjustUsedOil(-0.5)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="-0.5 kg"
            >
              <TbMinus className="w-4 h-4" />
            </button>

            <div className="w-36 shrink-0 flex items-baseline justify-center gap-1.5 px-2 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 tabular-nums">
              <span className="text-3xl font-black text-amber-900 dark:text-amber-200 tabular-nums">
                {usedOil.toFixed(1)}
              </span>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase">
                kg
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustUsedOil(0.5)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="+0.5 kg"
            >
              <TbPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustUsedOil(1)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="+1 kg"
            >
              +1
            </button>
          </div>

          {/* Interactive Horizontal Ruler Track */}
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
                        scrollUsedRulerTo(val);
                      }}
                      className="flex flex-col items-center justify-end shrink-0 cursor-pointer h-10 pb-1"
                      style={{ width: '2px' }}
                    >
                      <div
                        className={`rounded-full transition-colors ${
                          isMajor
                            ? 'h-8 bg-stone-800 dark:bg-stone-200 w-[2px]'
                            : isMedium
                            ? 'h-5 bg-stone-500 dark:bg-stone-400 w-[1.5px]'
                            : 'h-3 bg-stone-300 dark:bg-stone-700 w-[1px]'
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

          {/* Quick Presets */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-stone-400 font-bold mr-1">Quick:</span>
            {[5, 10, 15, 20, 25, 30].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setUsedOil(preset);
                  scrollUsedRulerTo(preset);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  usedOil === preset
                    ? 'bg-amber-500 text-stone-950 border-amber-500'
                    : 'bg-white dark:bg-[#141212] border-charcoal-border/70 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 hover:text-amber-600'
                }`}
              >
                {preset} kg
              </button>
            ))}
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
              Progress Ruler
            </span>
          </div>

          {/* Large Leftover Display with Steppers - Fixed Position */}
          <div className="flex items-center justify-center gap-2 py-1">
            <button
              type="button"
              onClick={() => adjustLeftover(-1)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="-1 kg"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => adjustLeftover(-0.5)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="-0.5 kg"
            >
              <TbMinus className="w-4 h-4" />
            </button>

            <div className="w-36 shrink-0 flex items-baseline justify-center gap-1.5 px-2 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 tabular-nums">
              <span className="text-3xl font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
                {leftoverOil.toFixed(1)}
              </span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                kg
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustLeftover(0.5)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="+0.5 kg"
            >
              <TbPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustLeftover(1)}
              className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="+1 kg"
            >
              +1
            </button>
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

              {/* Ruler Scale Markings Overlaid - clean ticks without bottom values */}
              <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none select-none">
                {[0, 25, 50, 75, 100].map((pct) => (
                  <div key={pct} className="flex flex-col items-center">
                    <div className="w-[1.5px] h-4 bg-stone-400/50 dark:bg-stone-500/50 rounded-full" />
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
              <span>0 kg (Empty)</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {language === 'ml' ? 'സ്ക്രോൾ ചെയ്ത് ലെവൽ മാറ്റുക' : 'Slide / scroll horizontally to adjust'}
              </span>
              <span>{maxLeftoverScale} kg (Max)</span>
            </div>
          </div>

          {/* Quick Preset Buttons for Leftover */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-[10px] text-stone-400 font-bold mr-1">Level:</span>
            {[
              { label: '0 kg', val: 0 },
              { label: '5 kg', val: 5 },
              { label: '10 kg', val: 10 },
              { label: '15 kg', val: 15 },
              { label: '20 kg', val: 20 },
              { label: `${usedOil} kg (Match Used)`, val: usedOil },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setLeftoverOil(p.val)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  leftoverOil === p.val
                    ? 'bg-emerald-500 text-stone-950 border-emerald-500'
                    : 'bg-white dark:bg-[#141212] border-charcoal-border/70 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 hover:text-emerald-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs">
          <div>
            <span className="font-extrabold text-amber-900 dark:text-amber-200">
              {language === 'ml' ? 'ആകെ ഓയിൽ കണക്ക്' : 'Total Oil Accounted'}:
            </span>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5">
              {usedOil.toFixed(1)} kg ({language === 'ml' ? 'ഉപയോഗിച്ചത്' : 'used'}) + {leftoverOil.toFixed(1)} kg ({language === 'ml' ? 'ബാക്കി' : 'leftover'})
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-amber-900 dark:text-amber-200">
              {(usedOil + leftoverOil).toFixed(1)} kg
            </span>
            <p className="text-[10px] text-stone-400 font-semibold uppercase">Total</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-charcoal-border/50 dark:border-[#2E2828]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={<TbCheck className="w-4 h-4" />}
          >
            {language === 'ml' ? 'ഓയിൽ രേഖപ്പെടുത്തുക' : 'Save Daily Oil'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
