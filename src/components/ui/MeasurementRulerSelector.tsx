import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CountUp } from './count-up';
import { Check, X } from 'lucide-react';

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
  min = 0,
  max = 100,
  step = 0.5,
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

  // Manual typing mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [typedValue, setTypedValue] = useState<string>('');

  // Configuration for ruler ticks
  const TICK_SPACING = 14;
  const totalSteps = Math.round((max - min) / step);

  // Sync scroll position when external value changes
  const scrollToValue = useCallback(
    (targetVal: number, smooth: boolean = false) => {
      const el = containerRef.current;
      if (!el) return;
      const clamped = Math.max(min, Math.min(max, targetVal));
      const stepIndex = (clamped - min) / step;
      const targetScrollLeft = stepIndex * TICK_SPACING;

      isInternalScrollRef.current = true;
      el.scrollTo({
        left: targetScrollLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setTimeout(() => {
        isInternalScrollRef.current = false;
      }, 50);
    },
    [min, max, step, TICK_SPACING]
  );

  // Initial scroll position: keep needle at 1 starting default if value is 0 or 1
  useEffect(() => {
    const initial = value > 0 ? value : 1;
    if (value <= 0) {
      onChange(1);
    }
    scrollToValue(initial, false);
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
    const calculatedValue = Number((min + clampedStep * step).toFixed(2));

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
    el.setPointerCapture(e.pointerId);
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
    const scrollLeft = el.scrollLeft;
    const nearestStep = Math.round(scrollLeft / TICK_SPACING);
    el.scrollTo({
      left: nearestStep * TICK_SPACING,
      behavior: 'smooth',
    });
  };

  const adjustBy = (delta: number) => {
    const newVal = Number(Math.max(min, Math.min(max, value + delta)).toFixed(2));
    onChange(newVal);
    scrollToValue(newVal, true);
  };

  const displayDecimals = step < 1 ? (step <= 0.1 ? 1 : 1) : 0;
  const formattedValNumber = Number(value.toFixed(displayDecimals));

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

          {/* Close Button */}
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
          {/* Left Padding Spacer so first tick reaches center */}
          <div className="shrink-0 w-1/2" />

          {/* Calibrated Ticks */}
          <div className="flex items-end shrink-0" style={{ gap: `${TICK_SPACING - 2}px` }}>
            {Array.from({ length: totalSteps + 1 }).map((_, idx) => {
              const currentStepVal = min + idx * step;
              const isMajor = idx % 10 === 0 || idx === 0 || idx === totalSteps;
              const isMedium = idx % 5 === 0 && !isMajor;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-end shrink-0"
                  style={{ width: '2px' }}
                >
                  <div
                    className={`rounded-full transition-colors ${
                      isMajor
                        ? 'h-10 bg-stone-500 dark:bg-stone-400 w-[2px]'
                        : isMedium
                        ? 'h-6 bg-stone-300 dark:bg-stone-600 w-[1.5px]'
                        : 'h-4 bg-stone-200 dark:bg-stone-700 w-[1px]'
                    }`}
                  />
                  {isMajor && (
                    <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 mt-1 select-none pointer-events-none">
                      {currentStepVal % 1 === 0 ? currentStepVal : currentStepVal.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Padding Spacer so last tick reaches center */}
          <div className="shrink-0 w-1/2" />
        </div>

        {/* Gradient edge fades for horizontal depth */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-[#181515] to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#181515] to-transparent pointer-events-none z-10" />
      </div>

      {/* LARGE VALUE DISPLAY WITH SMOOTH COUNT-UP OR DIRECT MANUAL INPUT */}
      <div className="my-2 flex flex-col items-center justify-center">
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = parseFloat(typedValue);
              if (!isNaN(num) && num >= min && num <= max) {
                onChange(num);
                scrollToValue(num, true);
              }
              setIsEditing(false);
            }}
            className="flex items-baseline gap-2"
          >
            <input
              type="number"
              step="any"
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
                  onChange(num);
                  scrollToValue(num, true);
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
              setTypedValue(String(formattedValNumber));
              setIsEditing(true);
            }}
            className="flex items-baseline gap-2 cursor-pointer group px-4 py-1.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-[#282323] transition-all press-apple border border-transparent hover:border-charcoal-border/40"
            title="Click to manually type custom quantity"
          >
            <div className="text-4xl sm:text-5xl font-black text-stone-900 dark:text-white tabular-nums tracking-tight">
              <CountUp
                to={formattedValNumber}
                digitEffect="slide"
                duration={0.25}
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
        <p className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold mt-0.5">
          {isEditing ? 'Enter അമർത്തി സേവ് ചെയ്യുക' : 'നമ്പറിൽ തൊട്ട് അളവ് ടൈപ്പ് ചെയ്യാം'}
        </p>
      </div>

      {/* QUICK PRESET BUTTONS ONLY: 5, 10, 20, 50 */}
      <div className="flex items-center justify-center gap-2 my-2.5 w-full">
        {[5, 10, 20, 50].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onChange(preset);
              scrollToValue(preset, true);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 press-apple cursor-pointer border ${
              value === preset
                ? 'bg-gradient-to-r from-epso-red to-epso-orange text-white border-transparent shadow-sm ring-2 ring-epso-orange/30'
                : 'bg-stone-100 hover:bg-stone-200 dark:bg-[#282323] dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-300 border-charcoal-border/50 dark:border-[#383030]'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* BOTTOM ACTION BUTTON: Theme Orange / Red Gradient */}
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
