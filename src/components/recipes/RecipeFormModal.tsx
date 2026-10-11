import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Recipe, RecipeIngredient, Ingredient, Product, UnitType } from '../../types';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { TbPlus, TbTrash } from 'react-icons/tb';

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeToEdit?: Recipe | null;
  products: Product[];
  ingredients: Ingredient[];
  preselectedProductId?: string;
  onSuccess: () => void;
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  recipeToEdit,
  products,
  ingredients,
  preselectedProductId,
  onSuccess,
}) => {
  const { repo, addToast } = useApp();
  const { language } = useLanguage();
  const [productId, setProductId] = useState('');
  const [baseOutputQuantity, setBaseOutputQuantity] = useState<number>(10);
  const [baseOutputUnit, setBaseOutputUnit] = useState<UnitType>('kg');
  const [notes, setNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (recipeToEdit) {
      setProductId(recipeToEdit.productId);
      setBaseOutputQuantity(recipeToEdit.baseOutputQuantity);
      setBaseOutputUnit(recipeToEdit.baseOutputUnit);
      setNotes(recipeToEdit.notes || '');
      setInstructions(recipeToEdit.instructions || '');
      setRecipeIngredients([...recipeToEdit.ingredients]);
    } else {
      const initialProductId = preselectedProductId || products[0]?.id || '';
      const prod = products.find((p) => p.id === initialProductId);
      setProductId(initialProductId);
      setBaseOutputQuantity(10);
      setBaseOutputUnit(prod?.unit || 'kg');
      setNotes('');
      setInstructions('');
      setRecipeIngredients(
        ingredients.length > 0
          ? [
              {
                ingredientId: ingredients[0].id,
                ingredientName: ingredients[0].name,
                quantity: 1,
                unit: ingredients[0].unit,
              },
            ]
          : []
      );
    }
  }, [recipeToEdit, products, ingredients, preselectedProductId, isOpen]);

  const handleAddIngredient = () => {
    if (ingredients.length === 0) return;
    const defaultIng = ingredients[0];
    setRecipeIngredients([
      ...recipeIngredients,
      {
        ingredientId: defaultIng.id,
        ingredientName: defaultIng.name,
        quantity: 1,
        unit: defaultIng.unit,
      },
    ]);
  };

  const handleRemoveIngredient = (idx: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx));
  };

  const handleIngredientChange = (idx: number, ingredientId: string) => {
    const selected = ingredients.find((i) => i.id === ingredientId);
    if (!selected) return;

    const copy = [...recipeIngredients];
    copy[idx] = {
      ...copy[idx],
      ingredientId: selected.id,
      ingredientName: selected.name,
      unit: selected.unit,
    };
    setRecipeIngredients(copy);
  };

  const handleQuantityChange = (idx: number, qty: number) => {
    const copy = [...recipeIngredients];
    copy[idx] = {
      ...copy[idx],
      quantity: Math.max(0.01, qty),
    };
    setRecipeIngredients(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === productId);
    if (!product) {
      addToast(
        language === 'ml' ? 'ഉൽപ്പന്നം തിരഞ്ഞെടുക്കുക' : 'Please select a valid product',
        'error'
      );
      return;
    }
    if (recipeIngredients.length === 0) {
      addToast(
        language === 'ml' ? 'കുറഞ്ഞത് ഒരു ചേരുവയെങ്കിലും ചേർക്കുക' : 'Recipe must contain at least one ingredient',
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (recipeToEdit) {
        await repo.saveRecipe({
          id: recipeToEdit.id,
          productId: recipeToEdit.productId,
          productName: recipeToEdit.productName,
          version: recipeToEdit.version + 1,
          baseOutputQuantity,
          baseOutputUnit,
          ingredients: recipeIngredients,
          notes: notes.trim() || undefined,
          instructions: instructions.trim() || undefined,
          isActive: true,
        });
        addToast(
          language === 'ml'
            ? `${product.name} റെസിപ്പി വിജയകരമായി അപ്ഡേറ്റ് ചെയ്തു!`
            : `Updated recipe formulation for ${product.name}`,
          'success'
        );
      } else {
        await repo.saveRecipe({
          productId: product.id,
          productName: product.name,
          version: 1,
          baseOutputQuantity,
          baseOutputUnit,
          ingredients: recipeIngredients,
          notes: notes.trim() || undefined,
          instructions: instructions.trim() || undefined,
          isActive: true,
        });
        addToast(
          language === 'ml'
            ? `${product.name} ചേരുവകൾ വിജയകരമായി ക്രമീകരിച്ചു!`
            : `Created new recipe for ${product.name}`,
          'success'
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.message || (language === 'ml' ? 'റെസിപ്പി സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല' : 'Failed to save recipe'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        recipeToEdit
          ? (language === 'ml' ? `റെസിപ്പി തിരുത്തുക (v${recipeToEdit.version})` : `Edit Recipe (v${recipeToEdit.version})`)
          : (language === 'ml' ? 'റെസിപ്പി ചേരുവകൾ ക്രമീകരിക്കുക (Recipe BOM)' : 'Create Recipe Formulation')
      }
      description={
        language === 'ml'
          ? 'ഉൽപ്പന്ന നിർമ്മാണത്തിന് ആവശ്യമായ ചേരുവകളുടെ കൃത്യമായ അനുപാതം ചേർക്കുക. പ്രൊഡക്ഷൻ സമയത്ത് ഇത് സ്വയം ലോഡ് ആകും.'
          : 'Define the bill of materials (BOM) per standard batch output.'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label={language === 'ml' ? 'ഉൽപ്പന്നം (Product)' : 'Product'}
          value={productId}
          disabled={Boolean(recipeToEdit)}
          onChange={(e) => setProductId(e.target.value)}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={language === 'ml' ? 'സ്റ്റാൻഡേർഡ് ഉൽപ്പാദന അളവ് (Base Output)' : 'Base Batch Output'}
            type="number"
            step="1"
            min="1"
            required
            value={baseOutputQuantity}
            onChange={(e) => setBaseOutputQuantity(parseFloat(e.target.value) || 0)}
          />

          <Select
            label={language === 'ml' ? 'യൂണിറ്റ് (Unit)' : 'Base Unit'}
            value={baseOutputUnit}
            onChange={(e) => setBaseOutputUnit(e.target.value as UnitType)}
            options={[
              { value: 'kg', label: language === 'ml' ? 'കിലോഗ്രാം (kg)' : 'Kilograms (kg)' },
              { value: 'packs', label: language === 'ml' ? 'പാക്കറ്റ് (packs)' : 'Packs' },
            ]}
          />
        </div>

        {/* Recipe Ingredients dynamic builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
              {language === 'ml'
                ? `ആവശ്യമായ ചേരുവകൾ (${baseOutputQuantity} ${baseOutputUnit}-ന്)`
                : `Required Ingredients per ${baseOutputQuantity} ${baseOutputUnit}`}
            </label>
            <button
              type="button"
              onClick={handleAddIngredient}
              className="flex items-center gap-1 bg-gradient-to-r from-epso-red to-epso-orange text-white hover:bg-epso-red-hover text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 press-apple cursor-pointer shadow-xs"
            >
              <TbPlus className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? '+ ചേരുവ ചേർക്കുക' : 'Add Ingredient'}</span>
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {recipeIngredients.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 bg-stone-50 dark:bg-[#141212] rounded-2xl border border-charcoal-border dark:border-[#2E2828] transition-colors"
              >
                <div className="flex-1">
                  <Select
                    value={item.ingredientId}
                    onChange={(e) => handleIngredientChange(idx, e.target.value)}
                    options={ingredients.map((ing) => ({
                      value: ing.id,
                      label: `${ing.name} (${ing.unit})`,
                    }))}
                  />
                </div>

                <div className="w-24">
                  <input
                    type="number"
                    step="0.05"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-black bg-white dark:bg-[#1E1B1B] text-stone-900 dark:text-white border border-charcoal-border dark:border-[#2E2828] rounded-xl p-2.5 text-center focus:ring-1 focus:ring-epso-red focus:outline-none min-h-[44px]"
                  />
                </div>

                <span className="text-xs font-bold text-stone-500 dark:text-stone-400 w-8 text-center">
                  {item.unit}
                </span>

                <button
                  type="button"
                  onClick={() => handleRemoveIngredient(idx)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-[#282323] rounded-lg transition-colors press-apple cursor-pointer"
                  title="Remove item"
                >
                  <TbTrash className="w-4 h-4" />
                </button>
              </div>
            ))}

            {recipeIngredients.length === 0 && (
              <div className="text-center py-6 border border-dashed border-charcoal-border dark:border-[#2E2828] rounded-xl text-stone-400 text-xs">
                {language === 'ml'
                  ? 'ചേരുവകൾ ഒന്നും ചേർത്തിട്ടില്ല. മുകളിലെ ബട്ടൺ ഉപയോഗിച്ച് ചേർക്കുക.'
                  : 'No ingredients added. Click Add Ingredient above.'}
              </div>
            )}
          </div>
        </div>

        <Input
          label={language === 'ml' ? 'പ്രത്യേക കുറിപ്പുകൾ (Optional)' : 'Process & Seasoning Notes (Optional)'}
          placeholder={language === 'ml' ? 'ഉദാ: വറുക്കുന്ന താപനില, പ്രത്യേക മസാല അനുപാതം...' : 'e.g. Frying temperature, seasoning ratio'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center gap-3 pt-3 border-t border-charcoal-border/70">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
            {recipeToEdit
              ? (language === 'ml' ? 'സൂക്ഷിക്കുക' : 'Save Changes')
              : (language === 'ml' ? 'റെസിപ്പി സൂക്ഷിക്കുക' : 'Save Recipe')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
