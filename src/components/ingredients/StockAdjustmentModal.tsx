import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Ingredient } from '../../types';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  preselectedIngredientId?: string;
  defaultAction?: 'usage' | 'wastage' | 'correction';
  onSuccess: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  ingredients,
  preselectedIngredientId,
  defaultAction = 'usage',
  onSuccess,
}) => {
  const { repo, role, staffName, addToast } = useApp();
  const { language } = useLanguage();

  const [selectedId, setSelectedId] = useState<string>('');
  const [actionType, setActionType] = useState<'usage' | 'wastage' | 'correction'>(defaultAction);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setActionType(defaultAction);
  }, [defaultAction, isOpen]);

  useEffect(() => {
    if (preselectedIngredientId) {
      setSelectedId(preselectedIngredientId);
    } else if (ingredients.length > 0 && !selectedId) {
      setSelectedId(ingredients[0].id);
    }
  }, [preselectedIngredientId, ingredients, isOpen]);

  const selectedIngredient = ingredients.find((i) => i.id === selectedId);

  const reasonPresets = {
    usage: [
      language === 'ml' ? 'ട്രയൽ ബാച്ച് ടെസ്റ്റിംഗ് (Trial Testing)' : 'Trial recipe batch testing',
      language === 'ml' ? 'ക്വാളിറ്റി ലാബ് പരിശോധന (Quality Sampling)' : 'Quality lab sampling',
      language === 'ml' ? 'ചെറിയ അളവ് നേരിട്ടുള്ള ഉപയോഗം (Small Batch Usage)' : 'Small batch manual seasoning adjustment',
      language === 'ml' ? 'അടുക്കളയിലെ മറ്റ് ആവശ്യങ്ങൾ (Kitchen Usage)' : 'Direct staff usage',
    ],
    wastage: [
      language === 'ml' ? 'സ്റ്റോറേജിൽ വെച്ച് കേടുവന്നത് (Storage Damage)' : 'Damaged / Spoiled during storage',
      language === 'ml' ? 'ഈർപ്പം / പൂപ്പൽ കേടുപാട് (Moisture / Fungus)' : 'Moisture / fungus damage',
      language === 'ml' ? 'പ്രാണികൾ / എലി ശല്യം (Pest Damage)' : 'Pest damage',
      language === 'ml' ? 'പാത്രത്തിൽ നിന്ന് ചിതറിപ്പോയത് (Spill or Broken Container)' : 'Spill or broken container',
      language === 'ml' ? 'കാലാവധി കഴിഞ്ഞത് (Expired)' : 'Expired raw material shelf-life',
    ],
    correction: [
      language === 'ml' ? 'ഭൗതിക സ്റ്റോക്ക് എണ്ണത്തിലെ വ്യത്യാസം (Physical Discrepancy)' : 'Physical stock audit count discrepancy',
      language === 'ml' ? 'സപ്ലയർ ബില്ലിലെ അളവ് തിരുത്തൽ (Supplier Reconciliation)' : 'Supplier delivery variance reconciliation',
      language === 'ml' ? 'ത്രാസ് ക്രമീകരണ വ്യത്യാസം (Weighing Scale Recalibration)' : 'Weighing scale recalibration adjustment',
    ],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    if (quantity <= 0) {
      addToast(
        language === 'ml' ? 'ശരിയായ അളവ് നൽകുക (പൂജ്യത്തിൽ കൂടുതൽ)' : 'Quantity must be greater than zero',
        'error'
      );
      return;
    }

    const fullReason = `${reason || reasonPresets[actionType][0]}${
      customNotes.trim() ? ` - ${customNotes.trim()}` : ''
    }`;

    try {
      setIsSubmitting(true);
      const operator = staffName || (role === 'owner' ? 'Factory Owner' : 'Production Staff');
      const delta = actionType === 'wastage' || actionType === 'usage' ? -Math.abs(quantity) : quantity;

      await repo.adjustStock({
        ingredientId: selectedIngredient.id,
        quantityDelta: delta,
        reason: fullReason,
        operatorName: operator,
      });

      addToast(
        language === 'ml'
          ? `${selectedIngredient.name}: ${quantity} ${selectedIngredient.unit} സ്റ്റോക്ക് മാറ്റം രേഖപ്പെടുത്തി`
          : `Recorded ${actionType} of ${quantity} ${selectedIngredient.unit} of ${selectedIngredient.name}`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.message || (language === 'ml' ? 'സ്റ്റോക്ക് മാറ്റം രേഖപ്പെടുത്താൻ കഴിഞ്ഞില്ല' : 'Failed to record adjustment'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        language === 'ml'
          ? actionType === 'wastage'
            ? 'കേടുപാടുകൾ / വേസ്റ്റേജ് രേഖപ്പെടുത്തുക (Wastage)'
            : actionType === 'usage'
            ? 'അസംസ്കൃത വസ്തു ഉപയോഗം (Usage)'
            : 'സ്റ്റോക്ക് തിരുത്തൽ (Audit Correction)'
          : actionType === 'wastage'
          ? 'Record Damaged / Wastage'
          : actionType === 'usage'
          ? 'Record Raw Material Usage'
          : 'Stock Count Correction'
      }
      description={
        language === 'ml'
          ? 'എല്ലാ മാറ്റങ്ങളും സ്റ്റോക്ക് ലെഡ്ജറിൽ കൃത്യമായി സൂക്ഷിക്കും.'
          : 'All deductions create an auditable transaction ledger entry.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={language === 'ml' ? 'ചേരുവ തിരഞ്ഞെടുക്കുക (Select Ingredient)' : 'Select Raw Material'}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={ingredients.map((i) => ({
            value: i.id,
            label: `${i.name} (സ്റ്റോക്ക്: ${i.currentStock} ${i.unit})`,
          }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={language === 'ml' ? 'അളവ് (Quantity)' : 'Quantity to Deduct'}
            type="number"
            step="0.1"
            min="0.1"
            max={selectedIngredient ? selectedIngredient.currentStock : undefined}
            required
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            rightAddon={selectedIngredient?.unit || 'unit'}
          />

          <Select
            label={language === 'ml' ? 'മാറ്റത്തിന്റെ വിഭാഗം (Category)' : 'Adjustment Category'}
            value={actionType}
            onChange={(e) => setActionType(e.target.value as any)}
            options={[
              { value: 'usage', label: language === 'ml' ? 'നേരിട്ടുള്ള ഉപയോഗം (Usage)' : 'Material Usage' },
              { value: 'wastage', label: language === 'ml' ? 'കേടുപാടുകൾ (Wastage)' : 'Damaged / Wastage' },
              { value: 'correction', label: language === 'ml' ? 'സ്റ്റോക്ക് തിരുത്തൽ (Correction)' : 'Audit Correction' },
            ]}
          />
        </div>

        <Select
          label={language === 'ml' ? 'കാരണം (Reason)' : 'Mandatory Reason'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={reasonPresets[actionType].map((r) => ({ value: r, label: r }))}
        />

        <Input
          label={language === 'ml' ? 'കൂടുതൽ വിവരങ്ങൾ (Notes - Optional)' : 'Additional Details / Notes (Optional)'}
          placeholder={language === 'ml' ? 'ഉദാ: പെട്ടി തകരാർ, ഈർപ്പം തട്ടിയത്...' : 'e.g. Bin 2 opened bag absorbed humidity'}
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
        />

        {selectedIngredient && (
          <div className="p-3 bg-stone-50 dark:bg-[#141212] rounded-xl border border-charcoal-border dark:border-[#2E2828] text-xs flex justify-between transition-colors">
            <span className="text-charcoal-muted dark:text-stone-400">
              {language === 'ml' ? 'ശേഷിക്കുന്ന സ്റ്റോക്ക് (Remaining Stock):' : 'Remaining Balance After Deduction:'}
            </span>
            <span className="font-bold text-charcoal dark:text-white">
              {Math.max(0, Number((selectedIngredient.currentStock - quantity).toFixed(3)))}{' '}
              {selectedIngredient.unit}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-3 border-t border-charcoal-border/70">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant={actionType === 'wastage' ? 'danger' : 'primary'}
            fullWidth
            isLoading={isSubmitting}
          >
            {language === 'ml' ? 'രേഖപ്പെടുത്തുക' : 'Record Deduction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
