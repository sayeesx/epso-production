import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { BatchSuccessAnimation } from '../ui/BatchSuccessAnimation';
import { ProductionRun } from '../../types';
import {
  TbPackage,
  TbCheck,
  TbPlus,
  TbMinus,
  TbX,
  TbArrowRight,
  TbArrowLeft,
} from 'react-icons/tb';

interface BatchPackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: ProductionRun | null;
  onSuccess?: () => void;
}

// Exact packet sizes specified:
export const AVAILABLE_PACKET_SIZES = [
  '3kg HM',
  '2KG HM',
  '10 x 12',
  '10 x 14',
  '10 x 16',
  '8 x10',
  '8 x 12',
] as const;

export const BatchPackingModal: React.FC<BatchPackingModalProps> = ({
  isOpen,
  onClose,
  batch,
  onSuccess,
}) => {
  const { repo, staffName, addToast, triggerRefresh } = useApp();
  const { language } = useLanguage();

  // 2-Step Stepper:
  // 1 = Select Packet Size
  // 2 = Enter / Measure Packet Count
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSize, setSelectedSize] = useState<string>(AVAILABLE_PACKET_SIZES[0]);
  const [packetCount, setPacketCount] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);

  // Ruler track ref
  const rulerRef = useRef<HTMLDivElement>(null);
  const isScrollingRuler = useRef<boolean>(false);

  const MIN_PACKETS = 1;
  const MAX_PACKETS = 500;
  const STEP_PACKETS = 1;
  const TICK_SPACING = 14; // px per tick step

  // Scroll ruler to value
  const scrollRulerTo = useCallback((val: number) => {
    if (!rulerRef.current) return;
    const ticksFromMin = val - MIN_PACKETS;
    const targetScroll = ticksFromMin * TICK_SPACING;
    isScrollingRuler.current = true;
    rulerRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
    setTimeout(() => {
      isScrollingRuler.current = false;
    }, 200);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedSize(AVAILABLE_PACKET_SIZES[0]);
      setPacketCount(50);
      setTimeout(() => {
        scrollRulerTo(50);
      }, 150);
    }
  }, [isOpen, scrollRulerTo]);

  if (!batch) return null;

  const handleRulerScroll = () => {
    if (!rulerRef.current || isScrollingRuler.current) return;
    const scrollLeft = rulerRef.current.scrollLeft;
    const tickIndex = Math.round(scrollLeft / TICK_SPACING);
    const calculatedVal = Math.max(MIN_PACKETS, Math.min(MAX_PACKETS, MIN_PACKETS + tickIndex * STEP_PACKETS));
    setPacketCount(calculatedVal);
  };

  const handleStepCount = (delta: number) => {
    const next = Math.max(MIN_PACKETS, Math.min(MAX_PACKETS, packetCount + delta));
    setPacketCount(next);
    scrollRulerTo(next);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!packetCount || packetCount <= 0) {
      addToast(
        language === 'ml'
          ? 'പാക്കറ്റുകൾ ചേർക്കുക'
          : 'Add packets',
        'warning'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await repo.recordPacking({
        packingDate: batch.productionDate || new Date().toISOString().split('T')[0],
        productId: batch.productId,
        packetSize: selectedSize,
        packetsPacked: packetCount,
        operatorName: staffName || batch.operatorName || 'Kitchen Staff',
        notes: `Batch #${batch.runNumber}`,
      });

      setIsSubmitting(false);
      setShowSuccessAnim(true);
    } catch (err: any) {
      console.error('Failed to record batch packaging', err);
      addToast(err?.message || 'Failed to add packets', 'error');
      setIsSubmitting(false);
    }
  };

  const handleSuccessAnimComplete = () => {
    setShowSuccessAnim(false);
    addToast(
      language === 'ml'
        ? `ബാച്ച് #${batch.runNumber} ലേക്ക് ${packetCount} പാക്കറ്റ് (${selectedSize}) ചേർത്തു`
        : `Added ${packetCount} packets of ${selectedSize} for Batch #${batch.runNumber}`,
      'success'
    );
    triggerRefresh();
    if (onSuccess) onSuccess();
    onClose();
  };

  const totalTicks = MAX_PACKETS - MIN_PACKETS;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-2xl bg-epso-red/10 text-epso-red dark:bg-amber-500/20 dark:text-amber-400">
            <TbPackage className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white leading-tight font-malayalam">
              {language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              #{batch.runNumber} • {batch.productName} ({batch.actualQuantity} {batch.unit})
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <div className="space-y-4 pb-24 -mx-1">
        {/* ======================================================== */}
        {/* 2-STEP STEPPER HEADER                                    */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#282323]">
          {[
            { num: 1, label: language === 'ml' ? 'പാക്കറ്റ് അളവ്' : 'Packet Size' },
            { num: 2, label: language === 'ml' ? 'പാക്കറ്റ് എണ്ണം' : 'Packet Count' },
          ].map((s, idx) => {
            const isCurrent = step === s.num;
            const isPassed = step > s.num;

            return (
              <React.Fragment key={s.num}>
                <div
                  onClick={() => {
                    if (isPassed) setStep(s.num as 1 | 2);
                  }}
                  className={`flex items-center gap-2 ${
                    isPassed ? 'cursor-pointer' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isCurrent
                        ? 'bg-epso-red text-white shadow-xs ring-2 ring-epso-red/30 dark:bg-amber-500 dark:text-stone-950 dark:ring-amber-500/30'
                        : isPassed
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs ring-1 ring-emerald-500/20'
                        : 'bg-stone-200 dark:bg-[#282323] text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {isPassed ? <TbCheck className="w-3.5 h-3.5 stroke-[3] text-white" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-bold font-malayalam ${
                      isCurrent
                        ? 'text-stone-900 dark:text-white font-extrabold'
                        : isPassed
                        ? 'text-emerald-700 dark:text-emerald-400 font-extrabold'
                        : 'text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx === 0 && (
                  <div
                    className={`flex-1 h-[2px] mx-3 rounded-full transition-all ${
                      step > 1 ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-[#282323]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* STEP 1: SELECT PACKET SIZE                               */}
        {/* ======================================================== */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Batch Info Card */}
            <div className="p-3 bg-stone-100/70 dark:bg-[#252020]/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-epso-orange flex items-center justify-center shrink-0">
                  <TbPackage className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">
                    {batch.productName}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    #{batch.runNumber} • {batch.actualQuantity} {batch.unit} output
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1E1B1B] border border-charcoal-border/50 dark:border-[#2E2828]">
                {language === 'ml' ? 'ഘട്ടം 1' : 'Step 1 of 2'}
              </span>
            </div>

            {/* Available Packet Sizes Selection */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
                  {language === 'ml' ? 'പാക്കറ്റ് അളവ് തിരഞ്ഞെടുക്കുക *' : 'Select Packet Size *'}
                </label>
                <span className="text-[11px] font-semibold text-stone-400">
                  {AVAILABLE_PACKET_SIZES.length} sizes
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {AVAILABLE_PACKET_SIZES.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`p-3.5 rounded-xl border font-black transition-all press-apple cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-epso-red text-white border-epso-red shadow-md dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 scale-[1.02]'
                          : 'bg-stone-50 dark:bg-[#141212] text-stone-700 dark:text-stone-300 border-charcoal-border/70 dark:border-[#2E2828] hover:bg-stone-100 dark:hover:bg-[#282323]'
                      }`}
                    >
                      <span className="text-base tracking-tight">{size}</span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-white dark:text-stone-950">
                          <span className="w-4 h-4 rounded-full bg-white dark:bg-stone-950 text-epso-red dark:text-amber-500 flex items-center justify-center shadow-xs shrink-0">
                            <svg
                              className="w-2.5 h-2.5"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2.5 6.2L4.8 8.5L9.5 3.5" />
                            </svg>
                          </span>
                          <span>Selected</span>
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
                          Packet
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: MEASURE PACKET COUNT                             */}
        {/* ======================================================== */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Selected Size Banner with Change Option */}
            <div className="p-3 bg-stone-100/70 dark:bg-[#252020]/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-epso-red/10 text-epso-red dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <TbPackage className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">
                    {language === 'ml' ? 'തിരഞ്ഞെടുത്ത പാക്കറ്റ്' : 'Selected Packet'}:{' '}
                    <span className="text-epso-red dark:text-amber-400">{selectedSize}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    #{batch.runNumber} • {batch.productName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-extrabold text-epso-red hover:underline dark:text-amber-400 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-stone-200/50 dark:hover:bg-[#2e2828]"
              >
                {language === 'ml' ? 'മാറ്റുക' : 'Change'}
              </button>
            </div>

            {/* Packet Count Measurement with Steppers & Ruler */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
                  {language === 'ml' ? 'പാക്ക് ചെയ്ത എണ്ണം' : 'Quantity Packed (Packets) *'}
                </label>
                <span className="text-[11px] font-bold text-epso-red dark:text-amber-400 bg-red-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-red-200 dark:border-amber-900/50">
                  Ruler Selector
                </span>
              </div>

              {/* Steppers & Value Display */}
              <div className="flex items-center justify-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => handleStepCount(-10)}
                  className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
                  title="-10"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => handleStepCount(-1)}
                  className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
                >
                  <TbMinus className="w-4 h-4" />
                </button>

                <div className="w-36 shrink-0 flex items-baseline justify-center gap-1.5 px-2 py-2 rounded-2xl bg-stone-100 dark:bg-[#141212] border border-stone-200 dark:border-[#2E2828] tabular-nums">
                  <span className="text-3xl font-black text-stone-900 dark:text-white tracking-tight tabular-nums">
                    {packetCount}
                  </span>
                  <span className="text-xs font-extrabold text-stone-500 dark:text-stone-400 uppercase">
                    pkts
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepCount(1)}
                  className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
                >
                  <TbPlus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepCount(10)}
                  className="w-10 h-10 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
                  title="+10"
                >
                  +10
                </button>
              </div>

              {/* Interactive Horizontal Ruler Track */}
              <div className="relative w-full py-2 overflow-hidden flex flex-col items-center select-none bg-stone-50 dark:bg-[#141212] rounded-2xl border border-charcoal-border/50 dark:border-[#2E2828]">
                {/* Center Epso Red Marker Needle */}
                <div className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-0.5 z-20 pointer-events-none rounded-full bg-epso-red dark:bg-amber-500">
                  <div className="w-2.5 h-2.5 rounded-full -ml-[4px] -top-1 absolute bg-epso-red dark:bg-amber-500 shadow-sm" />
                </div>

                {/* Scrollable Track */}
                <div
                  ref={rulerRef}
                  onScroll={handleRulerScroll}
                  className="w-full overflow-x-scroll no-scrollbar touch-pan-x flex items-end h-14 relative select-none"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div className="shrink-0 w-1/2" />
                  <div className="flex items-end shrink-0" style={{ gap: `${TICK_SPACING - 2}px` }}>
                    {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
                      const val = MIN_PACKETS + idx * STEP_PACKETS;
                      const isMajor = val % 25 === 0;
                      const isMedium = val % 5 === 0 && !isMajor;

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setPacketCount(val);
                            scrollRulerTo(val);
                          }}
                          className="flex flex-col items-center justify-end shrink-0 cursor-pointer h-10 pb-1"
                          style={{ width: '2px' }}
                        >
                          <div
                            className={`rounded-full transition-colors ${
                              isMajor
                                ? 'h-8 bg-stone-500/40 dark:bg-stone-400/35 w-[2px]'
                                : isMedium
                                ? 'h-5 bg-stone-400/30 dark:bg-stone-500/25 w-[1.5px]'
                                : 'h-3 bg-stone-300/25 dark:bg-stone-600/20 w-[1px]'
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
              <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-wrap">
                <span className="text-[10px] text-stone-400 font-bold mr-1">Quick:</span>
                {[25, 50, 75, 100, 150, 200, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setPacketCount(preset);
                      scrollRulerTo(preset);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      packetCount === preset
                        ? 'bg-epso-red text-white border-epso-red dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500'
                        : 'bg-white dark:bg-[#141212] border-charcoal-border/70 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 hover:text-epso-red'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 p-3.5 sm:p-4 bg-white/95 dark:bg-[#1E1B1B]/95 backdrop-blur-xl border-t border-stone-200 dark:border-[#2E2828] z-40 flex items-center gap-3 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.4)]">
        {step === 1 ? (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3.5 sm:py-4 px-4 rounded-2xl border-2 border-stone-300 dark:border-stone-700 bg-white dark:bg-[#252020] hover:bg-stone-100 dark:hover:bg-[#2c2626] text-stone-800 dark:text-stone-200 font-extrabold text-sm transition-all press-apple cursor-pointer flex items-center justify-center gap-1.5"
            >
              <TbX className="w-4 h-4 stroke-[2.5]" />
              <span>{language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(2);
                setTimeout(() => scrollRulerTo(packetCount), 100);
              }}
              className="flex-[2] py-3.5 sm:py-4 px-4 rounded-2xl bg-epso-red hover:bg-epso-red-hover dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-stone-950 font-black text-sm shadow-md transition-all press-apple cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{language === 'ml' ? 'അടുത്തത്' : 'Next'}</span>
              <TbArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
              className="flex-1 py-3.5 sm:py-4 px-4 rounded-2xl border-2 border-stone-300 dark:border-stone-700 bg-white dark:bg-[#252020] hover:bg-stone-100 dark:hover:bg-[#2c2626] text-stone-800 dark:text-stone-200 font-extrabold text-sm transition-all press-apple cursor-pointer flex items-center justify-center gap-1.5"
            >
              <TbArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>{language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="flex-[2] py-3.5 sm:py-4 px-4 rounded-2xl bg-epso-red hover:bg-epso-red-hover dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-stone-950 font-black text-sm shadow-md transition-all press-apple cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{language === 'ml' ? 'സൂക്ഷിക്കുന്നു...' : 'Saving...'}</span>
              ) : (
                <>
                  <TbCheck className="w-5 h-5 stroke-[3]" />
                  <span>
                    {language === 'ml'
                      ? 'പാക്കറ്റുകൾ ചേർക്കുക'
                      : 'Add Packets'}
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      <BatchSuccessAnimation
        isVisible={showSuccessAnim}
        onComplete={handleSuccessAnimComplete}
        message={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർത്തു!' : 'Packets Added Successfully!'}
        subMessage={
          language === 'ml'
            ? `${packetCount} പാക്കറ്റുകൾ (${selectedSize}) രേഖപ്പെടുത്തി`
            : `${packetCount} packets (${selectedSize}) recorded`
        }
      />
    </Modal>
  );
};
