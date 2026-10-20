import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProductionRun } from '../../types';
import { TbPackage, TbCheck, TbPlus, TbMinus } from 'react-icons/tb';

interface BatchPackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: ProductionRun | null;
  onSuccess?: () => void;
}

// Exact packet sizes specified by the user:
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
  const [packetCount, setPacketCount] = useState<number | string>(50);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSize(AVAILABLE_PACKET_SIZES[0]);
      setPacketCount(50);
      setNotes('');
    }
  }, [isOpen]);

  if (!batch) return null;

  const handleStepCount = (delta: number) => {
    const current = Number(packetCount) || 0;
    const next = Math.max(1, current + delta);
    setPacketCount(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = Number(packetCount);
    if (!count || count <= 0) {
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
        packetsPacked: count,
        operatorName: staffName || batch.operatorName || 'Kitchen Staff',
        notes: notes.trim()
          ? `Batch #${batch.runNumber}: ${notes.trim()}`
          : `Batch #${batch.runNumber}`,
      });

      addToast(
        language === 'ml'
          ? `ബാച്ച് #${batch.runNumber} ലേക്ക് ${count} പാക്കറ്റ് (${selectedSize}) ചേർത്തു`
          : `Added ${count} packets of ${selectedSize} for Batch #${batch.runNumber}`,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-epso-red dark:text-red-300">
            <TbPackage className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white leading-tight">
              {language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets Packed'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-normal">
              #{batch.runNumber} • {batch.productName} ({batch.actualQuantity} {batch.unit})
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Available Packet Sizes Selection */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
            {language === 'ml' ? 'ലഭ്യമായ പാക്കറ്റ് അളവുകൾ (Available Packet Sizes) *' : 'Available Packet Sizes *'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AVAILABLE_PACKET_SIZES.map((size) => {
              const isSelected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`p-3 rounded-xl border text-xs font-black transition-all press-apple cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-epso-red text-white border-epso-red shadow-md dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500 scale-[1.02]'
                      : 'bg-stone-50 dark:bg-[#141212] text-stone-700 dark:text-stone-300 border-charcoal-border dark:border-[#2E2828] hover:bg-stone-100 dark:hover:bg-[#282323]'
                  }`}
                >
                  <span className="text-sm tracking-tight">{size}</span>
                  <span
                    className={`text-[10px] font-semibold ${
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

        {/* Packet Count Input with Stepper */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#141212] border border-charcoal-border dark:border-[#2E2828] space-y-2">
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
            {language === 'ml' ? 'പാക്ക് ചെയ്ത എണ്ണം (Number of Packets) *' : 'Quantity Packed (Packets) *'}
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepCount(-10)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] flex items-center justify-center text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors press-apple cursor-pointer"
              title="-10"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => handleStepCount(-1)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] flex items-center justify-center text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors press-apple cursor-pointer"
            >
              <TbMinus className="w-4 h-4" />
            </button>

            <input
              type="number"
              step="1"
              min="1"
              required
              value={packetCount}
              onChange={(e) => setPacketCount(e.target.value)}
              className="flex-1 py-2 px-3 text-center rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] font-black text-xl text-stone-900 dark:text-white outline-none focus:border-epso-red"
            />

            <button
              type="button"
              onClick={() => handleStepCount(1)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] flex items-center justify-center text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors press-apple cursor-pointer"
            >
              <TbPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStepCount(10)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] flex items-center justify-center text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-100 dark:hover:bg-[#282323] transition-colors press-apple cursor-pointer"
              title="+10"
            >
              +10
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-stone-400 font-bold">Quick:</span>
            {[25, 50, 100, 200].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPacketCount(preset)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#1E1B1B] border border-charcoal-border/70 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 hover:text-epso-red dark:hover:text-amber-400 transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
            {language === 'ml' ? 'കുറിപ്പുകൾ (Notes - ഓപ്ഷണൽ)' : 'Notes (Optional)'}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={language === 'ml' ? 'ഉദാ: വേസ്റ്റ് കവർ മാറ്റി, ലേബൽ പതിച്ചു...' : 'e.g., Labelled, direct pack...'}
            className="w-full px-3 py-2 rounded-xl border border-charcoal-border dark:border-[#2E2828] bg-stone-50 dark:bg-[#141212] text-xs text-stone-900 dark:text-white outline-none focus:border-epso-red"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-charcoal-border/50 dark:border-[#2E2828]">
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
            {language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Save Packets'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
