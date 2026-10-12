import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CountUp } from './count-up';
import { Check, X, Minus, Plus } from 'lucide-react';

export interface MeasurementRulerSelectorProps {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmLabel?: string;
  className?: string;
}

export const MeasurementRulerSelector: React.FC<MeasurementRulerSelectorProps> = ({
  value,
  onChange,
  unit,
  title,
  subtitle,
  icon,
  min = 0.1,
  max = 100,
  step = 0.1,
  onConfirm,
  onClose,
  confirmLabel = 'Done / Set Quantity',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startScrollLeftRef = useRef<number>(0);
  const isInternalScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<any>(null);

  // Manual typing mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [typedValue, setTypedValue] = useState<string>('');

  // Spacing between each tick mark
  const TICK_SPACING = 14;
  const decimals = step < 1 ? 1 : 0;
  const totalSteps = Math.max(1, Math.round((max - min) / step));

  const roundToStep = useCallback(
    (val: number) => {
      const clamped = Math.max(min, Math.min(max, val));
      const stepsFromMin = Math.round((clamped - min) / step);
      return Number((min + stepsFromMin * step).toFixed(decimals));
    },
    [min, max, step, decimals]
  );

  // Scroll track to target value
  const scrollToValue = useCallback(
    (targetVal: number, smooth: boolean = false) => {
      const el = containerRef.current;
      if (!el) return;
      const clamped = Math.max(min, Math.min(max, targetVal));
      const stepIndex = Math.round((clamped - min) / step);
      const targetScrollLeft = stepIndex * TICK_SPACING;

      isInternalScrollRef.current = true;
      el.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isInternalScrollRef.current = false;
      }, 100);
    },
    [min, max, step, TICK_SPACING]
  );

  // Initial scroll position on mount
  useEffect(() => {
    const initial = value > 0 ? roundToStep(value) : min;
    if (value <= 0) {
      onChange(min);
    }
    const timer = setTimeout(() => {
      scrollToValue(initial, false);
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  // Handle scroll events from ruler
  const handleScroll = () => {
    if (isInternalScrollRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const rawStepIndex = scrollLeft / TICK_SPACING;
    const roundedStep = Math.round(rawStepIndex);
    const clampedStep = Math.max(0, Math.min(totalSteps, roundedStep));
    const calculatedValue = Number((min + clampedStep * step).toFixed(decimals));

    if (calculatedValue !== value) {
      onChange(calculatedValue);
    }
  };

  // Pointer drag gestures for mouse and touch
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = el.scrollLeft;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const deltaX = e.clientX - startXRef.current;
    el.scrollLeft = startScrollLeftRef.current - deltaX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const el = containerRef.current;
    if (!el) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // Snap to nearest tick
    const scrollLeft = el.scrollLeft;
    const nearestStep = Math.round(scrollLeft / TICK_SPACING);
    const snappedVal = Number((min + Math.max(0, Math.min(totalSteps, nearestStep)) * step).toFixed(decimals));
    onChange(snappedVal);
    scrollToValue(snappedVal, true);
  };

  const adjustBy = (delta: number) => {
    const newVal = roundToStep(value + delta);
    onChange(newVal);
    scrollToValue(newVal, true);
  };

  // Determine preset buttons based on step and max
  const presets =
    step <= 0.1 || max <= 10
      ? [0.5, 1, 2, 5].filter((p) => p >= min && p <= max)
      : [5, 10, 20, 50].filter((p) => p >= min && p <= max);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`bg-white dark:bg-[#181515] rounded-3xl p-5 border border-stone-200 dark:border-[#2E2828] shadow-2xl select-none flex flex-col items-center max-w-md mx-auto w-full transition-colors relative ${className}`}
    >
      {/* Top Header Card with Close Button */}
      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-stone-100 dark:border-[#282323]">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          {icon ? (
            <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-epso-orange flex items-center justify-center shrink-0 shadow-xs">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {title && (
              <h4 className="text-base font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam truncate">
                {title}
              </h4>
            )}
            {subtitle && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right pr-1">
            <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider block">
              Unit
            </span>
            <span className="text-xs font-black text-epso-orange dark:text-amber-400">
              {unit}
            </span>
          </div>

          {(onClose || onConfirm) && (
            <button
              type="button"
              onClick={onClose || onConfirm}
              className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* RULER CONTAINER WITH THEME ORANGE CENTER INDICATOR */}
      <div className="relative w-full py-4 my-2 overflow-hidden flex flex-col items-center">
        {/* Center Vertical Marker Line: Theme Epso Orange */}
        <div className="absolute top-0 bottom-8 left-1/2 -translate-x-1/2 w-0.5 bg-epso-orange dark:bg-orange-500 z-20 pointer-events-none rounded-full shadow-[0_0_10px_rgba(229,90,36,0.6)]">
          <div className="w-2.5 h-2.5 rounded-full bg-epso-orange dark:bg-orange-500 -ml-[4px] -top-1 absolute" />
        </div>

        {/* Scrollable / Draggable Ruler Track */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full overflow-x-scroll no-scrollbar cursor-grab active:cursor-grabbing touch-pan-x flex items-end h-20 relative select-none"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Left Padding Spacer so first tick reaches center needle */}
          <div className="shrink-0 w-1/2" />

          {/* Calibrated Ticks */}
          <div className="flex items-end shrink-0" style={{ gap: `${TICK_SPACING - 2}px` }}>
            {Array.from({ length: totalSteps + 1 }).map((_, idx) => {
              const currentStepVal = Number((min + idx * step).toFixed(decimals));
              // Whole numbers (1.0, 2.0, 3.0...) or start tick (0.1) are Major ticks
              const isWhole = Math.abs(Math.round(currentStepVal) - currentStepVal) < 0.001;
              const isStart = idx === 0;
              const isMajor = isWhole || isStart || idx === totalSteps;
              // Half numbers (0.5, 1.5, 2.5...) are Medium ticks
              const isHalf = Math.abs((currentStepVal * 2) % 1) < 0.001 && !isMajor;
              const isMedium = isHalf;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    onChange(currentStepVal);
                    scrollToValue(currentStepVal, true);
                  }}
                  className="flex flex-col items-center justify-end shrink-0 cursor-pointer"
                  style={{ width: '2px' }}
                >
                  <div
                    className={`rounded-full transition-colors ${
                      isMajor
                        ? 'h-10 bg-stone-700 dark:bg-stone-300 w-[2px]'
                        : isMedium
                        ? 'h-6 bg-stone-400 dark:bg-stone-500 w-[1.5px]'
                        : 'h-4 bg-stone-200 dark:bg-stone-700 w-[1px]'
                    }`}
                  />
                  {isMajor && (
                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mt-1 select-none pointer-events-none whitespace-nowrap">
                      {isWhole ? Math.round(currentStepVal) : currentStepVal}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Padding Spacer so last tick reaches center needle */}
          <div className="shrink-0 w-1/2" />
        </div>

        {/* Gradient edge fades for horizontal depth */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#181515] to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#181515] to-transparent pointer-events-none z-10" />
      </div>

      {/* LARGE VALUE DISPLAY WITH SMOOTH STEPPERS (-) AND (+) */}
      <div className="my-2 flex items-center justify-center gap-3 w-full">
        <button
          type="button"
          onClick={() => adjustBy(-step)}
          disabled={value <= min}
          className="w-10 h-10 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-[#282323] dark:hover:bg-[#342D2D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer press-apple shrink-0"
          title={`Decrease by ${step}`}
        >
          <Minus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = parseFloat(typedValue);
              if (!isNaN(num) && num >= min && num <= max) {
                const rounded = roundToStep(num);
                onChange(rounded);
                scrollToValue(rounded, true);
              }
              setIsEditing(false);
            }}
            className="flex items-baseline gap-2"
          >
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              value={typedValue}
              onChange={(e) => {
                setTypedValue(e.target.value);
                const num = parseFloat(e.target.value);
                if (!isNaN(num) && num >= min && num <= max) {
                  onChange(num);
                  scrollToValue(num, false);
                }
              }}
              onBlur={() => {
                const num = parseFloat(typedValue);
                if (!isNaN(num) && num >= min && num <= max) {
                  const rounded = roundToStep(num);
                  onChange(rounded);
                  scrollToValue(rounded, true);
                }
                setIsEditing(false);
              }}
              autoFocus
              className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-white tabular-nums tracking-tight w-36 text-center bg-stone-100 dark:bg-[#282323] rounded-2xl px-2 py-1 border-2 border-epso-orange focus:outline-none"
            />
            <span className="text-xl sm:text-2xl font-extrabold text-epso-orange dark:text-amber-400">
              {unit}
            </span>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTypedValue(String(value));
              setIsEditing(true);
            }}
            className="flex items-baseline gap-2 cursor-pointer group px-4 py-1 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#282323] transition-all press-apple border border-transparent hover:border-charcoal-border/40"
            title="Click to manually type custom quantity"
          >
            <div className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-white tabular-nums tracking-tight">
              <CountUp
                to={value}
                digitEffect="slide"
                duration={0.2}
                separator=","
                className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-white"
              />
            </div>
            <span className="text-xl sm:text-2xl font-extrabold text-epso-orange dark:text-amber-400">
              {unit}
            </span>
            <span className="text-xs text-stone-400 group-hover:text-epso-orange font-bold ml-1 transition-colors">
              ✏️
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => adjustBy(step)}
          disabled={value >= max}
          className="w-10 h-10 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-[#282323] dark:hover:bg-[#342D2D] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer press-apple shrink-0"
          title={`Increase by ${step}`}
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      <p className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold mb-2">
        {isEditing ? 'Enter അമർത്തി സേവ് ചെയ്യുക' : 'റൂളർ നീക്കുകയോ നമ്പറിൽ തൊട്ട് ടൈപ്പ് ചെയ്യുകയോ ചെയ്യാം'}
      </p>

      {/* QUICK PRESET BUTTONS */}
      {presets.length > 0 && (
        <div className="flex items-center justify-center gap-2 my-2 w-full">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onChange(preset);
                scrollToValue(preset, true);
              }}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 press-apple cursor-pointer border ${
                value === preset
                  ? 'bg-gradient-to-r from-epso-red to-epso-orange text-white border-transparent shadow-sm ring-2 ring-epso-orange/30'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#282323] dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-300 border-charcoal-border/50 dark:border-[#383030]'
              }`}
            >
              {preset} {unit}
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM ACTION BUTTON */}
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          className="w-full mt-3 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-epso-red to-epso-orange hover:bg-epso-red-hover text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-150 active:scale-[0.98] press-apple flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>{confirmLabel}</span>
        </button>
      )}
    </div>
  );
};
