import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { ProductionRun } from '../../types';
import {
  TbPackage,
  TbCheck,
  TbPlus,
  TbMinus,
  TbX,
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

  const [selectedSize, setSelectedSize] = useState<string>(AVAILABLE_PACKET_SIZES[0]);
  const [packetCount, setPacketCount] = useState<number>(50);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
      setSelectedSize(AVAILABLE_PACKET_SIZES[0]);
      setPacketCount(50);
      setNotes('');
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
          ? 'പാക്കറ്റുകളുടെ കൃത്യമായ എണ്ണം നൽകുക'
          : 'Please enter a valid count of packets packed',
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
        notes: notes.trim()
          ? `Batch #${batch.runNumber}: ${notes.trim()}`
          : `Batch #${batch.runNumber}`,
      });

      addToast(
        language === 'ml'
          ? `ബാച്ച് #${batch.runNumber} ലേക്ക് ${packetCount} പാക്കറ്റ് (${selectedSize}) ചേർത്തു`
          : `Added ${packetCount} packets of ${selectedSize} for Batch #${batch.runNumber}`,
        'success'
      );

      triggerRefresh();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to record batch packaging', err);
      addToast(err?.message || 'Failed to add packets', 'error');
    } finally {
      setIsSubmitting(false);
    }
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
              {language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets Packed'}
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
        {/* Available Packet Sizes Selection */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-2">
          <label className="block text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
            {language === 'ml' ? 'പാക്കറ്റ് അളവുകൾ (Packet Sizes) *' : 'Available Packet Sizes *'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AVAILABLE_PACKET_SIZES.map((size) => {
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`py-3 px-2 rounded-xl border text-xs font-black transition-all press-apple cursor-pointer text-center flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-epso-red text-white border-epso-red shadow-md dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 scale-[1.02]'
                      : 'bg-stone-50 dark:bg-[#141212] text-stone-700 dark:text-stone-300 border-charcoal-border/70 dark:border-[#2E2828] hover:bg-stone-100 dark:hover:bg-[#282323]'
                  }`}
                >
                  <span className="text-sm tracking-tight">{size}</span>
                  <span
                    className={`text-[9px] uppercase font-bold tracking-wider ${
                      isSelected
                        ? 'text-white/80 dark:text-stone-900/80'
                        : 'text-stone-400'
                    }`}
                  >
                    Packet
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Packet Count Measurement with Ruler */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
              {language === 'ml' ? 'പാക്ക് ചെയ്ത എണ്ണം (Number of Packets) *' : 'Quantity Packed (Packets) *'}
            </label>
            <span className="text-[11px] font-bold text-epso-red dark:text-amber-400 bg-red-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-red-200 dark:border-amber-900/50">
              Ruler Selector
            </span>
          </div>

          {/* Steppers & Value Display - Fixed Position */}
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
                            ? 'h-8 bg-stone-700/50 dark:bg-stone-300/40 w-[2px]'
                            : isMedium
                            ? 'h-5 bg-stone-400/35 dark:bg-stone-500/30 w-[1.5px]'
                            : 'h-3 bg-stone-300/20 dark:bg-stone-700/20 w-[1px]'
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

        {/* Optional notes */}
        <div className="p-3 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828]">
          <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 mb-1">
            {language === 'ml' ? 'കുറിപ്പുകൾ (ഓപ്ഷണൽ)' : 'Notes (Optional)'}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={language === 'ml' ? 'ഉദാ: വേസ്റ്റ് കവർ മാറ്റി, ലേബൽ പതിച്ചു...' : 'e.g., Labelled, direct pack...'}
            className="w-full px-3 py-2 rounded-xl border border-charcoal-border/60 dark:border-[#2E2828] bg-stone-50 dark:bg-[#141212] text-xs text-stone-900 dark:text-white outline-none focus:border-epso-red"
          />
        </div>
      </div>

      {/* BIGGER ACTION BUTTONS FIXED ON BOTTOM */}
      <div className="fixed bottom-0 inset-x-0 p-3.5 sm:p-4 bg-white/95 dark:bg-[#1E1B1B]/95 backdrop-blur-xl border-t border-stone-200 dark:border-[#2E2828] z-40 flex items-center gap-3 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.4)]">
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
                  ? `${packetCount} പാക്കറ്റുകൾ ചേർക്കുക`
                  : `Add ${packetCount} Packets`}
              </span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};
