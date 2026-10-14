import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MeasurementRulerSelector, getUnitConfig } from '../ui/MeasurementRulerSelector';
import { Product, Recipe, Ingredient } from '../../types';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  TbChefHat,
  TbAlertCircle,
  TbSearch,
  TbChevronRight,
  TbChevronLeft,
  TbCircleCheck,
  TbPlus,
  TbTrash,
  TbRuler2,
} from 'react-icons/tb';

interface StartProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  isLoadingProducts?: boolean;
  onSuccess: (savedRun?: any) => void;
}

export const StartProductionModal: React.FC<StartProductionModalProps> = ({
  isOpen,
  onClose,
  products,
  recipes,
  ingredients,
  isLoadingProducts = false,
  onSuccess,
}) => {
  const { repo, staffName, addToast } = useApp();
  const { t, language } = useLanguage();

  // Wizard Step: 1 = Select Product, 2 = Quantity & Ingredients, 3 = Confirm
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [isModalExpanded, setIsModalExpanded] = useState<boolean>(false);
  const [isShimmerLoading, setIsShimmerLoading] = useState<boolean>(false);
  const [plannedQty, setPlannedQty] = useState<number>(1);
  const [actualOutputQty, setActualOutputQty] = useState<number>(1);
  const [productionDate, setProductionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [operator, setOperator] = useState<string>(staffName);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Ingredient deletion confirm dialog state
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  } | null>(null);

  // Ingredients consumption list: { ingredientId, expectedQuantity, actualQuantity, unit }
  const [consumptionItems, setConsumptionItems] = useState<
    Array<{
      ingredientId: string;
      expectedQuantity: number;
      actualQuantity: number;
      unit: string;
    }>
  >([]);

  // Manual ingredient add in step 2
  const [manualIngId, setManualIngId] = useState<string>(ingredients[0]?.id || '');
  const [manualIngQty, setManualIngQty] = useState<number>(1);

  // Active measurement tuning state using horizontal smooth ruler
  const [activeRulerItem, setActiveRulerItem] = useState<{
    type: 'ingredient' | 'output' | 'manual';
    ingredientId?: string;
    name: string;
    unit: string;
    subtitle?: string;
    isZeroStock?: boolean;
    value: number;
    min?: number;
    max?: number;
    step?: number;
  } | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedProductId('');
      setProductSearch('');
      setIsModalExpanded(false);
      setIsShimmerLoading(true);
      const timer = setTimeout(() => {
        setIsShimmerLoading(false);
      }, 350);
      setActiveRulerItem(null);
      setItemToDelete(null);
      setPlannedQty(1);
      setActualOutputQty(1);
      setProductionDate(new Date().toISOString().split('T')[0]);
      setOperator(staffName);
      setNotes('');
      setConsumptionItems([]);
      if (ingredients.length > 0) setManualIngId(ingredients[0].id);
      return () => clearTimeout(timer);
    }
  }, [isOpen, staffName, ingredients]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const activeRecipe = useMemo(
    () =>
      recipes.find(
        (r) => r.productId === selectedProductId && r.isActive
      ),
    [recipes, selectedProductId]
  );

  // Filter products for Step 1
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) => p.isActive && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  // When product or planned quantity changes in Step 2, scale recipe formula
  useEffect(() => {
    if (!selectedProduct) return;

    if (activeRecipe && activeRecipe.ingredients.length > 0) {
      const scaleFactor =
        activeRecipe.baseOutputQuantity > 0
          ? plannedQty / activeRecipe.baseOutputQuantity
          : 1;

      const scaled = activeRecipe.ingredients.map((item) => {
        const requiredQty = Number((item.quantity * scaleFactor).toFixed(3));
        return {
          ingredientId: item.ingredientId,
          expectedQuantity: requiredQty,
          actualQuantity: requiredQty,
          unit: item.unit,
        };
      });
      setConsumptionItems(scaled);
    } else {
      // No recipe formula: leave empty or retain manually added ingredients
      setConsumptionItems((prev) => (prev.length > 0 ? prev : []));
    }
  }, [selectedProduct, activeRecipe, plannedQty]);

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsModalExpanded(false);
    setStep(2);
  };

  const updateActualQty = (ingredientId: string, newQty: number) => {
    setConsumptionItems((prev) =>
      prev.map((item) =>
        item.ingredientId === ingredientId
          ? { ...item, actualQuantity: Math.max(0, newQty) }
          : item
      )
    );
  };

  const removeConsumptionItem = (ingredientId: string) => {
    setConsumptionItems((prev) => prev.filter((i) => i.ingredientId !== ingredientId));
  };

  const addManualIngredient = () => {
    if (!manualIngId || manualIngQty <= 0) return;
    const ing = ingredients.find((i) => i.id === manualIngId);
    if (!ing) return;
    if (ing.currentStock <= 0 || manualIngQty > ing.currentStock) return;

    setConsumptionItems((prev) => {
      const exists = prev.find((i) => i.ingredientId === manualIngId);
      if (exists) {
        return prev.map((i) =>
          i.ingredientId === manualIngId
            ? { ...i, actualQuantity: Number((i.actualQuantity + manualIngQty).toFixed(3)) }
            : i
        );
      }
      return [
        ...prev,
        {
          ingredientId: ing.id,
          expectedQuantity: manualIngQty,
          actualQuantity: manualIngQty,
          unit: ing.unit,
        },
      ];
    });
    setManualIngQty(1);
  };

  // Check for any ingredient in consumption list that is out of stock (currentStock <= 0)
  const outOfStockIngredients = useMemo(() => {
    return consumptionItems
      .map((item) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        const inStock = ing ? ing.currentStock : 0;
        return {
          ...item,
          name: ing?.name || 'Ingredient',
          currentStock: inStock,
          isOutOfStock: inStock <= 0,
        };
      })
      .filter((item) => item.isOutOfStock);
  }, [consumptionItems, ingredients]);

  const hasOutOfStockIngredient = outOfStockIngredients.length > 0;

  const handleFinalSubmit = async () => {
    if (!selectedProduct) return;
    if (actualOutputQty <= 0) {
      addToast(
        language === 'ml' ? 'ശരിയായ അളവ് നൽകുക' : 'Please provide a valid output quantity',
        'warning'
      );
      return;
    }
    if (hasOutOfStockIngredient) {
      addToast(
        language === 'ml'
          ? 'ചേരുവകളുടെ സ്റ്റോക്ക് തീർന്നതിനാൽ പ്രൊഡക്ഷൻ സേവ് ചെയ്യാനാവില്ല'
          : 'Cannot save production: some required ingredients are out of stock',
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const saved = await repo.recordProductionRun({
        runNumber: `PRD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        productId: selectedProduct.id,
        recipeId: activeRecipe?.id,
        recipeVersion: activeRecipe?.version,
        productionDate,
        plannedQuantity: plannedQty,
        actualQuantity: actualOutputQty,
        unit: selectedProduct.unit,
        operatorName: operator.trim() || 'Kitchen Staff',
        notes: notes.trim() || undefined,
        ingredientsConsumed: consumptionItems,
      });

      addToast(t.productionSavedSuccess, 'success');
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Production save error', err);
      addToast(err?.message || 'Failed to save production run', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      expanded={step === 1 && isModalExpanded}
      title={
        <div className="flex items-center gap-2 text-stone-900 dark:text-white">
          <div className="w-8 h-8 rounded-lg bg-epso-red text-white flex items-center justify-center font-bold">
            <TbPlus className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold leading-tight">{t.startProduction}</h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              Step {step} of 3 • {step === 1 ? t.selectProduct : step === 2 ? t.quantityToProduce : t.confirmTitle}
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* STEP 1: SELECT PRODUCT */}
        {step === 1 && (
          <div className="space-y-3">
            <div onClick={() => setIsModalExpanded(true)}>
              <Input
                placeholder={t.searchProductPlaceholder}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setIsModalExpanded(true);
                }}
                onFocus={() => setIsModalExpanded(true)}
                leftAddon={<TbSearch className="w-4 h-4 text-stone-400" />}
              />
            </div>

            {/* Shimmer Skeleton effect when fetching products */}
            {isLoadingProducts || isShimmerLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-charcoal-border/70 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-stone-200 dark:bg-stone-800 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-28 bg-stone-200 dark:bg-stone-800 rounded" />
                        <div className="h-3 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
                      </div>
                    </div>
                    <div className="w-4 h-4 rounded bg-stone-200 dark:bg-stone-800 shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 transition-all duration-300 ${
                isModalExpanded || productSearch ? 'max-h-[72vh] sm:max-h-[66vh]' : 'max-h-[50vh]'
              }`}>
                {filteredProducts.map((p) => {
                  const productRecipe = recipes.find((r) => r.productId === p.id && r.isActive);
                  const hasRecipe = !!productRecipe;
                  const isSelected = p.id === selectedProductId;
                  const hasOutOfStockIng = productRecipe?.ingredients.some((ingItem) => {
                    const ing = ingredients.find((i) => i.id === ingItem.ingredientId);
                    return !ing || ing.currentStock <= 0;
                  });

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between select-none press-apple ${
                        isSelected
                          ? 'border-epso-red bg-red-50/80 dark:bg-red-950/40 shadow-sm'
                          : 'border-charcoal-border dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-epso-red/50 hover:bg-stone-50 dark:hover:bg-[#282323]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/60 text-epso-red dark:text-red-300 flex items-center justify-center font-extrabold text-sm shrink-0">
                          {p.name.slice(0, 1)}
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                              {p.unit}
                            </span>
                            {hasRecipe ? (
                              hasOutOfStockIng ? (
                                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
                                  {language === 'ml' ? 'സ്റ്റോക്ക് തീർന്നു' : 'Out of Stock'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                  Recipe Ready
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-[#282323] px-1.5 py-0.5 rounded">
                                Manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <TbChevronRight className="w-5 h-5 text-stone-400" />
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-stone-400 text-sm font-medium">
                    {language === 'ml' ? 'ഉൽപ്പന്നങ്ങൾ ഒന്നും കണ്ടെത്തിയില്ല' : 'No products found'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: QUANTITY & INGREDIENT USAGE */}
        {step === 2 && selectedProduct && (
          <div className="space-y-4">
            {/* Selected Product Summary Banner */}
            <div className="p-3 bg-stone-100 dark:bg-[#141212] rounded-xl flex items-center justify-between border border-charcoal-border dark:border-[#2E2828]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-epso-red text-white flex items-center justify-center font-bold text-sm">
                  {selectedProduct.name.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">{selectedProduct.name}</h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                    {activeRecipe
                      ? `Formula v${activeRecipe.version} (${activeRecipe.baseOutputQuantity} ${activeRecipe.baseOutputUnit} base)`
                      : t.recipeNotConfigured}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Change
              </Button>
            </div>

            {/* Target Output Quantity Controls */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block font-malayalam">
                {t.quantityToProduce} ({selectedProduct.unit})
              </label>
              <button
                type="button"
                onClick={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  const uConfig = getUnitConfig(selectedProduct.unit);
                  setActiveRulerItem({
                    type: 'output',
                    name: selectedProduct.name,
                    unit: selectedProduct.unit,
                    subtitle: `${t.quantityToProduce} (${selectedProduct.unit})`,
                    value: plannedQty,
                    min: uConfig.min,
                    max: 999999,
                    step: uConfig.step,
                  });
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border dark:border-[#2E2828] text-stone-900 dark:text-white font-black text-lg shadow-xs hover:border-epso-orange transition-all cursor-pointer text-left press-apple"
                title={language === 'ml' ? 'അളവ് മാറ്റാൻ ക്ലിക്ക് ചെയ്യുക' : 'Click to adjust quantity'}
              >
                <span className="tabular-nums">{plannedQty}</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-epso-orange dark:text-amber-400">
                  <span>{selectedProduct.unit}</span>
                  <TbRuler2 className="w-4 h-4 opacity-75" />
                </div>
              </button>

              {/* Quick Presets: 5, 10, 25, 50, 100, 250 */}
              <div className="grid grid-cols-6 gap-1.5">
                {[5, 10, 25, 50, 100, 250].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setPlannedQty(preset);
                      setActualOutputQty(preset);
                    }}
                    className={`py-2 rounded-xl text-xs font-extrabold border transition-all press-apple text-center ${
                      plannedQty === preset
                        ? 'bg-epso-red text-white border-epso-red shadow-sm'
                        : 'bg-white dark:bg-[#1E1B1B] text-stone-700 dark:text-stone-300 border-charcoal-border dark:border-[#2E2828] hover:bg-stone-50 dark:hover:bg-[#282323]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Ingredients Consumption List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  {t.requiredIngredients} ({consumptionItems.length})
                </label>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold">
                  {t.actualConsumption}
                </span>
              </div>

              <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                {consumptionItems.map((item) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId);
                  const inStock = ing ? ing.currentStock : 0;
                  const isZeroStock = inStock <= 0;
                  const isShortage = inStock < item.actualQuantity;

                  return (
                    <div
                      key={item.ingredientId}
                      className="p-3 rounded-xl border border-charcoal-border dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-extrabold text-stone-900 dark:text-white truncate font-malayalam">
                            {ing?.name || 'Ingredient'}
                          </h5>
                          <div className="flex items-center gap-2 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                            <span>
                              Formula: {item.expectedQuantity} {item.unit}
                            </span>
                            <span>•</span>
                            <span
                              className={
                                isZeroStock
                                  ? 'text-red-600 dark:text-red-400 font-extrabold'
                                  : isShortage
                                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                                  : 'text-emerald-600 dark:text-emerald-400 font-bold'
                              }
                            >
                              Stock: {inStock} {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Actual Input & Ruler Selector Trigger */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                              const uConfig = getUnitConfig(item.unit);
                              setActiveRulerItem({
                                type: 'ingredient',
                                ingredientId: item.ingredientId,
                                name: ing?.name || 'Ingredient',
                                unit: item.unit,
                                subtitle: isZeroStock
                                  ? `Formula: ${item.expectedQuantity} ${item.unit} • Stock: 0 ${item.unit}`
                                  : `Formula: ${item.expectedQuantity} ${item.unit} • Stock: ${inStock} ${item.unit}`,
                                isZeroStock,
                                value: isZeroStock ? 0 : item.actualQuantity,
                                min: uConfig.min,
                                max: 999999,
                                step: uConfig.step,
                              });
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all press-apple cursor-pointer shadow-xs ${
                              isZeroStock
                                ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                                : 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                            }`}
                            title="Click to adjust quantity"
                          >
                            <span className="text-sm font-black tabular-nums">{item.actualQuantity}</span>
                            <span className="text-[11px] font-bold">{item.unit}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setItemToDelete({
                                id: item.ingredientId,
                                name: ing?.name || 'Ingredient',
                                quantity: item.actualQuantity,
                                unit: item.unit,
                              });
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors press-apple cursor-pointer"
                            title="Remove item from this batch"
                          >
                            <TbTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Red warning text when ingredient stock is 0 */}
                      {isZeroStock && (
                        <div className="mt-2 pt-1.5 border-t border-stone-100 dark:border-[#282323] flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 font-malayalam">
                          <TbAlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                          <span>
                            {language === 'ml'
                              ? `ശ്രദ്ധിക്കുക: സ്റ്റോക്ക് ലഭ്യമല്ല (0 ${item.unit} സ്റ്റോക്ക്)`
                              : `Warning: Stock is 0 ${item.unit} (Out of stock)`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {consumptionItems.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-charcoal-border dark:border-[#2E2828] rounded-xl text-stone-400 text-xs">
                    {language === 'ml'
                      ? 'ചേരുവകൾ ഒന്നും ചേർത്തിട്ടില്ല. താഴെയുള്ള ബോക്സ് ഉപയോഗിച്ച് ചേരുവകൾ ചേർക്കുക.'
                      : 'No ingredients added yet. Add ingredients using the selector below.'}
                  </div>
                )}
              </div>

              {/* Add manual ingredient row with Ruler Measurement */}
              {(() => {
                const selectedManualIng = ingredients.find((i) => i.id === manualIngId) || ingredients[0];
                const isManualZeroStock = selectedManualIng ? selectedManualIng.currentStock <= 0 : false;
                const isManualExceedsStock = selectedManualIng ? manualIngQty > selectedManualIng.currentStock : false;
                const isAddDisabled = isManualZeroStock || isManualExceedsStock || manualIngQty <= 0;

                return (
                  <div className="p-3 bg-white dark:bg-[#1E1B1B] rounded-xl border border-charcoal-border dark:border-[#2E2828] shadow-xs transition-colors">
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <select
                        value={manualIngId}
                        onChange={(e) => setManualIngId(e.target.value)}
                        className="flex-1 min-w-[140px] px-2.5 py-2 text-xs font-semibold bg-stone-50 dark:bg-[#141212] text-stone-900 dark:text-white border border-charcoal-border dark:border-[#2E2828] rounded-xl font-malayalam focus:outline-none focus:ring-1 focus:ring-epso-orange"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit}) {ing.currentStock <= 0 ? (language === 'ml' ? '• (സ്റ്റോക്ക് ഇല്ല)' : '• (0 stock)') : `• (${ing.currentStock} ${ing.unit})`}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                          const ing = selectedManualIng;
                          if (ing) {
                            const isZero = ing.currentStock <= 0;
                            const uConfig = getUnitConfig(ing.unit);
                            setActiveRulerItem({
                              type: 'manual',
                              ingredientId: ing.id,
                              name: ing.name,
                              unit: ing.unit,
                              subtitle: isZero
                                ? (language === 'ml' ? `സ്റ്റോക്ക്: 0 ${ing.unit}` : `Current stock: 0 ${ing.unit}`)
                                : (language === 'ml' ? `സ്റ്റോക്ക്: ${ing.currentStock} ${ing.unit}` : `Current stock: ${ing.currentStock} ${ing.unit}`),
                              isZeroStock: isZero,
                              value: isZero ? 0 : manualIngQty,
                              min: uConfig.min,
                              max: 999999,
                              step: uConfig.step,
                            });
                          }
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1 cursor-pointer press-apple shadow-xs transition-all ${
                          isManualZeroStock
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                            : isManualExceedsStock
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                            : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
                        }`}
                        title="Click to adjust quantity"
                      >
                        <span>
                          {manualIngQty} {selectedManualIng?.unit || 'unit'}
                        </span>
                      </button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isAddDisabled}
                        onClick={isAddDisabled ? undefined : addManualIngredient}
                        className={
                          isAddDisabled
                            ? '!bg-stone-200 dark:!bg-stone-800 !text-stone-400 dark:!text-stone-500 !border-stone-300 dark:!border-stone-700 opacity-60 cursor-not-allowed pointer-events-none shadow-none'
                            : ''
                        }
                        icon={<TbPlus className="w-3.5 h-3.5" />}
                      >
                        Add
                      </Button>
                    </div>

                    {/* Red warning text INSIDE the container, just like added ingredients */}
                    {isManualZeroStock && selectedManualIng && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-[#282323] flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 font-malayalam">
                        <TbAlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                        <span>
                          {language === 'ml'
                            ? `ശ്രദ്ധിക്കുക: സ്റ്റോക്ക് ലഭ്യമല്ല (0 ${selectedManualIng.unit} സ്റ്റോക്ക്)`
                            : `Warning: Stock is 0 ${selectedManualIng.unit} (Out of stock)`}
                        </span>
                      </div>
                    )}

                    {/* Warning if selected measurement exceeds stock */}
                    {!isManualZeroStock && isManualExceedsStock && selectedManualIng && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-[#282323] flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 font-malayalam">
                        <TbAlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>
                          {language === 'ml'
                            ? `ശ്രദ്ധിക്കുക: തിരഞ്ഞെടുത്ത അളവ് സ്റ്റോക്കിനേക്കാൾ കൂടുതലാണ് (${selectedManualIng.currentStock} ${selectedManualIng.unit} ലഭ്യമാണ്)`
                            : `Warning: Quantity exceeds current stock (${selectedManualIng.currentStock} ${selectedManualIng.unit} available)`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Out of stock warning banner above action buttons */}
            {hasOutOfStockIngredient && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <TbAlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <span className="font-extrabold font-malayalam block">
                    {language === 'ml'
                      ? 'ചേരുവകളുടെ സ്റ്റോക്ക് തീർന്നു (Out of Stock)'
                      : 'Ingredients Out of Stock'}
                  </span>
                  <span className="text-[11px] font-medium font-malayalam opacity-90 mt-0.5 block">
                    {language === 'ml'
                      ? `${outOfStockIngredients.map((i) => i.name).join(', ')} എന്നിവയുടെ നിലവിലെ സ്റ്റോക്ക് 0 ആണ്. സ്റ്റോക്ക് റീസ്റ്റോക്ക് ചെയ്യാതെ അടുത്ത ഘട്ടത്തിലേക്ക് തുടരാനാവില്ല.`
                      : `${outOfStockIngredients.map((i) => i.name).join(', ')} has 0 stock available. You cannot proceed to review until stock is replenished.`}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-charcoal-border dark:border-[#2E2828]">
              <Button variant="ghost" onClick={() => setStep(1)} icon={<TbChevronLeft className="w-4 h-4" />}>
                Back
              </Button>

              <Button
                variant="primary"
                onClick={() => setStep(3)}
                icon={<TbChevronRight className="w-4 h-4" />}
                disabled={plannedQty <= 0 || hasOutOfStockIngredient}
                className={
                  hasOutOfStockIngredient
                    ? '!bg-stone-300 dark:!bg-stone-800 !text-stone-500 dark:!text-stone-400 !border-stone-300 dark:!border-stone-700 opacity-60 cursor-not-allowed pointer-events-none'
                    : ''
                }
                title={
                  hasOutOfStockIngredient
                    ? language === 'ml'
                      ? 'ചേരുവകളുടെ സ്റ്റോക്ക് തീർന്നതിനാൽ തുടരാനാവില്ല'
                      : 'Cannot proceed: ingredients are out of stock'
                    : undefined
                }
              >
                Next: Review
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRMATION & OPERATOR DETAILS */}
        {step === 3 && selectedProduct && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/40 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-epso-red dark:text-red-400">
                    Product Run Summary
                  </span>
                  <h4 className="text-lg font-black text-stone-900 dark:text-white leading-tight mt-0.5 font-malayalam">
                    {selectedProduct.name}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-epso-red dark:text-amber-400">
                    {actualOutputQty} {selectedProduct.unit}
                  </span>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Finished Output</p>
                </div>
              </div>

              <div className="text-xs text-stone-700 dark:text-stone-300 border-t border-red-200/60 dark:border-red-900/40 pt-2 flex items-center justify-between">
                <span>Total Ingredients: {consumptionItems.length} items</span>
                <span>Date: {productionDate}</span>
              </div>
            </div>

            {/* Operator & Date Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">{t.operator}</label>
                <Input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Cook / Operator Name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">Production Date</label>
                <Input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">{t.notes}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Batch quality notes, frying temperature, remarks..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-charcoal-border dark:border-[#2E2828]">
              <Button variant="ghost" onClick={() => setStep(2)} icon={<TbChevronLeft className="w-4 h-4" />}>
                Back
              </Button>

              <Button
                variant="primary"
                onClick={handleFinalSubmit}
                isLoading={isSubmitting}
                icon={<TbCircleCheck className="w-4 h-4" />}
                className="font-black px-6"
              >
                {t.confirmProduction}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Ingredient Removal Confirmation Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1C1818] rounded-2xl p-5 max-w-sm w-full border border-charcoal-border dark:border-[#2E2828] shadow-2xl space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-epso-red flex items-center justify-center font-bold shrink-0">
                <TbTrash className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-stone-900 dark:text-white leading-tight font-malayalam">
                  {language === 'ml' ? 'ചേരുവ ഒഴിവാക്കണോ?' : 'Remove Ingredient?'}
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 font-bold mt-0.5">
                  {itemToDelete.name} ({itemToDelete.quantity} {itemToDelete.unit})
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 font-medium">
              {language === 'ml'
                ? 'ഈ പ്രത്യേക പ്രൊഡക്ഷൻ ബാച്ചിൽ നിന്ന് മാത്രമാണ് ഈ ചേരുവ ഒഴിവാക്കുന്നത്. പ്രധാന റെസിപ്പി ഫോർമുലയിൽ മാറ്റം വരില്ല.'
                : 'This ingredient will only be removed from this custom production run. The original recipe formula remains unchanged.'}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setItemToDelete(null)}
              >
                {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                className="flex-1 font-bold"
                onClick={() => {
                  removeConsumptionItem(itemToDelete.id);
                  addToast(
                    language === 'ml'
                      ? `${itemToDelete.name} ഈ ബാച്ചിൽ നിന്ന് ഒഴിവാക്കി`
                      : `${itemToDelete.name} removed from this batch`,
                    'info'
                  );
                  setItemToDelete(null);
                }}
              >
                {language === 'ml' ? 'ഒഴിവാക്കുക' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Horizontal Smooth Scrolling Ruler Modal - Teleported to Body to Cover Background Completely */}
      {activeRulerItem &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setActiveRulerItem(null)}
          >
            <div
              className="w-full max-w-md animate-in zoom-in-95 duration-200 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <MeasurementRulerSelector
                title={activeRulerItem.name}
                subtitle={activeRulerItem.subtitle}
                isZeroStock={activeRulerItem.isZeroStock}
                presets={activeRulerItem.type === 'output' ? [5, 10, 25, 50, 100, 250] : undefined}
                unit={activeRulerItem.unit}
                value={activeRulerItem.value || 1}
                min={activeRulerItem.min}
                max={activeRulerItem.max ?? 999999}
                step={activeRulerItem.step}
                onChange={(newVal) => {
                  setActiveRulerItem((prev) => (prev ? { ...prev, value: newVal } : null));
                  if (activeRulerItem.type === 'ingredient' && activeRulerItem.ingredientId) {
                    updateActualQty(activeRulerItem.ingredientId, newVal);
                  } else if (activeRulerItem.type === 'output') {
                    setPlannedQty(newVal);
                    setActualOutputQty(newVal);
                  } else if (activeRulerItem.type === 'manual') {
                    setManualIngQty(newVal);
                  }
                }}
                confirmLabel={language === 'ml' ? 'അളവ് രേഖപ്പെടുത്തുക' : 'Done / Set Quantity'}
                onConfirm={() => setActiveRulerItem(null)}
                onClose={() => setActiveRulerItem(null)}
              />
            </div>
          </div>,
          document.body
        )}
    </Modal>
  );
};
