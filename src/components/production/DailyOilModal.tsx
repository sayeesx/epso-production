import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TbDroplet, TbCalendar, TbCheck } from 'react-icons/tb';

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
  initialDate,
}) => {
  const { repo, staffName, addToast, triggerRefresh } = useApp();
  const { language } = useLanguage();

  const todayStr = new Date().toISOString().split('T')[0];
  const [productionDate, setProductionDate] = useState<string>(initialDate || todayStr);
  const [usedOil, setUsedOil] = useState<string>('');
  const [leftoverOil, setLeftoverOil] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const targetDate = initialDate || todayStr;
      setProductionDate(targetDate);
      setUsedOil('');
      setLeftoverOil('');
      setNotes('');

      // Check if closing already recorded for this date
      let isMounted = true;
      setIsLoadingExisting(true);
      repo.getDailyClosing(targetDate).then((existing) => {
        if (!isMounted) return;
        if (existing) {
          if (existing.oilConsumed > 0) setUsedOil(String(existing.oilConsumed));
          if (existing.oilClosingBalance > 0) setLeftoverOil(String(existing.oilClosingBalance));
          if (existing.notes) setNotes(existing.notes);
        }
        setIsLoadingExisting(false);
      }).catch(() => {
        if (isMounted) setIsLoadingExisting(false);
      });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, initialDate, repo, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const used = parseFloat(usedOil);
    const leftover = parseFloat(leftoverOil);

    if (isNaN(used) || used <= 0) {
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
      const safeLeftover = isNaN(leftover) || leftover < 0 ? 0 : leftover;
      const opening = used + safeLeftover;

      await repo.saveDailyClosing({
        productionDate,
        oilOpeningBalance: opening,
        oilPurchases: 0,
        oilClosingBalance: safeLeftover,
        oilCostPerKg: 150,
        productionWages: 0,
        notes: notes.trim() || undefined,
        closedBy: staffName || 'Kitchen Staff',
      });

      addToast(
        language === 'ml'
          ? 'ഇന്നത്തെ ഓയിൽ ഉപയോഗം വിജയകരമായി രേഖപ്പെടുത്തി'
          : 'Daily oil usage recorded successfully',
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <TbDroplet className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white leading-tight">
              {language === 'ml' ? 'ദിവസേനയുള്ള ഓയിൽ രേഖപ്പെടുത്തുക' : 'Record Daily Oil Usage'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-normal">
              {language === 'ml'
                ? 'ദിവസത്തെ എല്ലാ ബാച്ചുകൾക്കും ശേഷം ഉപയോഗിച്ച ഓയിൽ രേഖപ്പെടുത്തുക'
                : 'Log oil consumption at the end of all daily production batches'}
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date Selector */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
            {language === 'ml' ? 'തീയതി (Date)' : 'Production Date'}
          </label>
          <div className="relative">
            <input
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal-border dark:border-[#2E2828] bg-stone-50 dark:bg-[#141212] text-xs font-bold text-stone-900 dark:text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Oil Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Used Oil */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
            <label className="block text-xs font-black text-amber-900 dark:text-amber-300">
              {language === 'ml' ? 'ഉപയോഗിച്ച ഓയിൽ (Used Oil) *' : 'Used Oil (Consumed) *'}
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={usedOil}
                onChange={(e) => setUsedOil(e.target.value)}
                placeholder="e.g. 15.5"
                autoFocus
                className="w-full py-2 pl-3 pr-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-amber-300 dark:border-amber-800 font-black text-base text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="absolute right-3 text-xs font-bold text-stone-400 pointer-events-none">
                kg
              </span>
            </div>
            <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80">
              {language === 'ml'
                ? 'ഇന്നത്തെ ബാച്ചുകൾ വറുക്കാൻ ആകെ ഉപയോഗിച്ചത്'
                : 'Total quantity consumed for today batches'}
            </p>
          </div>

          {/* Leftover Oil */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#141212] border border-charcoal-border dark:border-[#2E2828] space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              {language === 'ml' ? 'ബാക്കി വന്ന ഓയിൽ (Leftover Oil)' : 'Leftover Oil (Remaining)'}
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                value={leftoverOil}
                onChange={(e) => setLeftoverOil(e.target.value)}
                placeholder="e.g. 24.0"
                className="w-full py-2 pl-3 pr-10 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] font-black text-base text-stone-900 dark:text-white outline-none focus:border-amber-500"
              />
              <span className="absolute right-3 text-xs font-bold text-stone-400 pointer-events-none">
                kg
              </span>
            </div>
            <p className="text-[10px] text-stone-400">
              {language === 'ml'
                ? 'ദിവസാവസാനം ചീനച്ചട്ടിയിലോ ഡ്രമ്മിലോ ബാക്കിയുള്ളത്'
                : 'Closing stock remaining in kadai or storage'}
            </p>
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
            placeholder={language === 'ml' ? 'ഉദാ: പുതിയ ടിൻ തുറന്നു, വെളിച്ചെണ്ണ...' : 'e.g., Opened new tin, filtered leftover...'}
            className="w-full px-3 py-2 rounded-xl border border-charcoal-border dark:border-[#2E2828] bg-stone-50 dark:bg-[#141212] text-xs text-stone-900 dark:text-white outline-none focus:border-amber-500"
          />
        </div>

        {/* Footer Actions */}
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
            {language === 'ml' ? 'ഓയിൽ രേഖപ്പെടുത്തുക' : 'Save Daily Oil'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
