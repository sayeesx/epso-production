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
  TbAlertCircle,
  TbSearch,
  TbChevronRight,
  TbChevronLeft,
  TbCircleCheck,
  TbPlus,
  TbTrash,
  TbRuler2,
  TbCheck,
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

type WizardStep = 1 | 2 | 3 | 4;

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

  // 4-Step Stepper:
  // 1 = Select Product
  // 2 = Measure Production Quantity with Ruler
  // 3 = Select Ingredients to tick (with measurement ruler for each)
  // 4 = Review & Confirm
  const [step, setStep] = useState<WizardStep>(1);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [ingredientSearch, setIngredientSearch] = useState<string>('');
  const [isModalExpanded, setIsModalExpanded] = useState<boolean>(false);
  const [plannedQty, setPlannedQty] = useState<number>(10);
  const [actualOutputQty, setActualOutputQty] = useState<number>(10);
  const [productionDate, setProductionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [operator, setOperator] = useState<string>(staffName);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Ingredients consumption list: { ingredientId, expectedQuantity, actualQuantity, unit }
  const [consumptionItems, setConsumptionItems] = useState<
    Array<{
      ingredientId: string;
      expectedQuantity: number;
      actualQuantity: number;
      unit: string;
    }>
  >([]);

  // Ingredient deletion confirm dialog state
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  } | null>(null);

  // Active measurement tuning state using horizontal smooth ruler
  const [activeRulerItem, setActiveRulerItem] = useState<{
    type: 'ingredient' | 'output';
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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedProductId('');
      setProductSearch('');
      setIngredientSearch('');
      setIsModalExpanded(false);
      setActiveRulerItem(null);
      setItemToDelete(null);
      setPlannedQty(10);
      setActualOutputQty(10);
      setProductionDate(new Date().toISOString().split('T')[0]);
      setOperator(staffName);
      setNotes('');
      setConsumptionItems([]);
    }
  }, [isOpen, staffName]);

  // Filter products for Step 1
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) => p.isActive && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  // Filter ingredients for Step 3
  const filteredIngredients = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    return ingredients.filter(
      (ing) => ing.isActive && (!q || ing.name.toLowerCase().includes(q))
    );
  }, [ingredients, ingredientSearch]);

  // When a product is selected in Step 1, advance to Step 2 (measure quantity)
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsModalExpanded(false);
    const prodRecipe = recipes.find((r) => r.productId === productId && r.isActive);
    const initialQty = prodRecipe?.baseOutputQuantity || 10;
    setPlannedQty(initialQty);
    setActualOutputQty(initialQty);

    // Pre-populate with recipe ingredients scaled for initial planned quantity
    if (prodRecipe && prodRecipe.ingredients.length > 0) {
      const scaled = prodRecipe.ingredients.map((item) => {
        const requiredQty = Number(item.quantity.toFixed(3));
        return {
          ingredientId: item.ingredientId,
          expectedQuantity: requiredQty,
          actualQuantity: requiredQty,
          unit: item.unit,
        };
      });
      setConsumptionItems(scaled);
    } else {
      setConsumptionItems([]);
    }

    setStep(2);
  };

  // When planned quantity changes in Step 2, scale recipe ingredients if available
  const handlePlannedQtyChange = (newQty: number) => {
    setPlannedQty(newQty);
    setActualOutputQty(newQty);

    if (activeRecipe && activeRecipe.ingredients.length > 0 && activeRecipe.baseOutputQuantity > 0) {
      const scaleFactor = newQty / activeRecipe.baseOutputQuantity;
      setConsumptionItems((prev) => {
        return activeRecipe.ingredients.map((item) => {
          const scaledQty = Number((item.quantity * scaleFactor).toFixed(3));
          const existing = prev.find((p) => p.ingredientId === item.ingredientId);
          return {
            ingredientId: item.ingredientId,
            expectedQuantity: scaledQty,
            actualQuantity: existing ? existing.actualQuantity : scaledQty,
            unit: item.unit,
          };
        });
      });
    }
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

  // Toggle selection of an ingredient in Step 3
  const handleToggleIngredient = (ing: Ingredient) => {
    const isSelected = consumptionItems.some((i) => i.ingredientId === ing.id);

    if (isSelected) {
      // Untick/remove ingredient
      setConsumptionItems((prev) => prev.filter((i) => i.ingredientId !== ing.id));
    } else {
      // Find initial quantity: check recipe formula or get unit default
      const recipeItem = activeRecipe?.ingredients.find((ri) => ri.ingredientId === ing.id);
      let initialQty = 1;
      if (recipeItem && activeRecipe?.baseOutputQuantity) {
        const scale = plannedQty / activeRecipe.baseOutputQuantity;
        initialQty = Number((recipeItem.quantity * scale).toFixed(3));
      } else {
        const uConfig = getUnitConfig(ing.unit);
        initialQty = uConfig.presets[0] || uConfig.min || 1;
      }

      // Add to consumption items
      setConsumptionItems((prev) => [
        ...prev,
        {
          ingredientId: ing.id,
          expectedQuantity: initialQty,
          actualQuantity: initialQty,
          unit: ing.unit,
        },
      ]);

      // Open measurement ruler for this ingredient immediately
      const uConfig = getUnitConfig(ing.unit);
      setActiveRulerItem({
        type: 'ingredient',
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        subtitle: `സ്റ്റോക്ക്: ${ing.currentStock} ${ing.unit}`,
        isZeroStock: ing.currentStock <= 0,
        value: initialQty,
        min: uConfig.min,
        max: 999999,
        step: uConfig.step,
      });
    }
  };

  // Open ruler directly for an already selected ingredient
  const handleOpenIngredientRuler = (ing: Ingredient, currentVal: number) => {
    const uConfig = getUnitConfig(ing.unit);
    setActiveRulerItem({
      type: 'ingredient',
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      subtitle: `സ്റ്റോക്ക്: ${ing.currentStock} ${ing.unit}`,
      isZeroStock: ing.currentStock <= 0,
      value: currentVal,
      min: uConfig.min,
      max: 999999,
      step: uConfig.step,
    });
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

  // Calculate total batch ingredient cost for Step 4 review
  const totalBatchIngredientCost = useMemo(() => {
    return consumptionItems.reduce((sum, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const unitCost = ing ? Number(ing.avgCostPerUnit) || 0 : 0;
      return sum + item.actualQuantity * unitCost;
    }, 0);
  }, [consumptionItems, ingredients]);

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
      const itemsWithCost = consumptionItems.map((item) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        const unitCost = ing ? Number(ing.avgCostPerUnit) || 0 : 0;
        const totalCost = Math.round((item.actualQuantity * unitCost + Number.EPSILON) * 100) / 100;
        return {
          ...item,
          unitCost,
          totalCost,
        };
      });

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
        ingredientsConsumed: itemsWithCost,
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

  const stepTitles = {
    1: language === 'ml' ? 'ഉൽപ്പന്നം തിരഞ്ഞെടുക്കുക' : 'Select Product',
    2: language === 'ml' ? 'ഉൽപ്പാദന അളവ്' : 'Target Quantity',
    3: language === 'ml' ? 'ചേരുവകൾ തിരഞ്ഞെടുക്കുക' : 'Select Ingredients',
    4: language === 'ml' ? 'റിവ്യൂ & പ്രൊഡക്ഷൻ' : 'Review & Start',
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
              Step {step} of 4 • {stepTitles[step]}
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* ======================================================== */}
        {/* 4-STEP PROGRESS STEPPER HEADER                           */}
        {/* ======================================================== */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#282323]">
          {[
            { num: 1, label: language === 'ml' ? 'ഉൽപ്പന്നം' : 'Product' },
            { num: 2, label: language === 'ml' ? 'അളവ്' : 'Quantity' },
            { num: 3, label: language === 'ml' ? 'ചേരുവകൾ' : 'Ingredients' },
            { num: 4, label: language === 'ml' ? 'റിവ്യൂ' : 'Review' },
          ].map((s, idx) => {
            const isCurrent = step === s.num;
            const isPassed = step > s.num;

            return (
              <React.Fragment key={s.num}>
                <div
                  onClick={() => {
                    if (isPassed) setStep(s.num as WizardStep);
                  }}
                  className={`flex items-center gap-1.5 ${
                    isPassed ? 'cursor-pointer' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isCurrent
                        ? 'bg-epso-red text-white shadow-xs ring-2 ring-epso-red/30'
                        : isPassed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-stone-200 dark:bg-[#282323] text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {isPassed ? '✓' : s.num}
                  </div>
                  <span
                    className={`text-xs font-bold font-malayalam hidden sm:inline ${
                      isCurrent
                        ? 'text-stone-900 dark:text-white font-extrabold'
                        : isPassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
                      step > idx + 1 ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-[#282323]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* STEP 1: SELECT PRODUCT                                   */}
        {/* ======================================================== */}
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

            {/* Skeleton effect when fetching products */}
            {isLoadingProducts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-charcoal-border/70 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-stone-200 dark:bg-stone-800 shrink-0" />
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
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 transition-all duration-300 ${
                  isModalExpanded || productSearch ? 'max-h-[72vh] sm:max-h-[66vh]' : 'max-h-[50vh]'
                }`}
              >
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
                        <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-[#252020] border border-stone-200/80 dark:border-[#2E2828] flex items-center justify-center shrink-0 shadow-2xs">
                          <img
                            src="/epso-icon-grey.png"
                            alt={p.name}
                            className="w-6 h-6 object-contain opacity-55 dark:opacity-45 select-none pointer-events-none"
                          />
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

        {/* ======================================================== */}
        {/* STEP 2: MEASURE QUANTITY WITH RULER (DEDICATED MODAL)   */}
        {/* ======================================================== */}
        {step === 2 && selectedProduct && (
          <div className="space-y-4">
            {/* Selected Product Banner */}
            <div className="p-3.5 bg-stone-100 dark:bg-[#141212] rounded-2xl flex items-center justify-between border border-charcoal-border dark:border-[#2E2828]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-200/80 dark:bg-[#252020] border border-stone-300/80 dark:border-[#2E2828] flex items-center justify-center shrink-0 shadow-2xs">
                  <img
                    src="/epso-icon-grey.png"
                    alt={selectedProduct.name}
                    className="w-6 h-6 object-contain opacity-60 dark:opacity-50 select-none pointer-events-none"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">
                    {selectedProduct.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium font-malayalam">
                    {activeRecipe
                      ? `ഫോർമുല v${activeRecipe.version} (${activeRecipe.baseOutputQuantity} ${activeRecipe.baseOutputUnit} ബേസ്)`
                      : 'മാനുവൽ പ്രൊഡക്ഷൻ (No recipe formula)'}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                {language === 'ml' ? 'മാറ്റുക' : 'Change'}
              </Button>
            </div>

            {/* Dedicated Measurement Ruler for Output Quantity */}
            <div className="p-4 bg-white dark:bg-[#1E1B1B] rounded-2xl border border-charcoal-border dark:border-[#2E2828] shadow-xs">
              <MeasurementRulerSelector
                title={language === 'ml' ? 'ഉൽപ്പാദന അളവ് നിശ്ചയിക്കുക' : 'Set Production Quantity'}
                subtitle={language === 'ml' ? `യൂണിറ്റ്: ${selectedProduct.unit}` : `Unit: ${selectedProduct.unit}`}
                unit={selectedProduct.unit}
                value={plannedQty}
                presets={[5, 10, 25, 50, 100, 250]}
                min={0.1}
                max={999999}
                step={selectedProduct.unit.toLowerCase().includes('kg') ? 0.5 : 1}
                onChange={handlePlannedQtyChange}
              />
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-charcoal-border dark:border-[#2E2828]">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                icon={<TbChevronLeft className="w-4 h-4" />}
              >
                {language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}
              </Button>

              <Button
                variant="primary"
                onClick={() => setStep(3)}
                icon={<TbChevronRight className="w-4 h-4" />}
                disabled={plannedQty <= 0}
                className="font-bold px-5"
              >
                {language === 'ml' ? 'അടുത്തത്: ചേരുവകൾ' : 'Next: Select Ingredients'}
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT INGREDIENTS TO TICK (WITH RULER)          */}
        {/* ======================================================== */}
        {step === 3 && selectedProduct && (
          <div className="space-y-3">
            {/* Header info bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={language === 'ml' ? 'ചേരുവകൾ തിരയുക...' : 'Search ingredients...'}
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  leftAddon={<TbSearch className="w-4 h-4 text-stone-400" />}
                />
              </div>
              <div className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-[#252020] text-stone-700 dark:text-stone-300 text-xs font-bold font-mono shrink-0">
                {consumptionItems.length} {language === 'ml' ? 'ചേരുവകൾ' : 'items'}
              </div>
            </div>

            <p className="text-[11px] text-stone-400 font-malayalam">
              {language === 'ml'
                ? 'ഉപയോഗിക്കുന്ന ചേരുവകളിൽ ടിക്ക് ചെയ്യുക. അളവ് മാറ്റാൻ കാർഡിൽ ക്ലിക്ക് ചെയ്യാം.'
                : 'Tick the ingredients needed. Tap card to measure exact quantity with ruler.'}
            </p>

            {/* Ingredients Selection Grid (Styled just like Step 1 Product cards!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredIngredients.map((ing) => {
                const consumedItem = consumptionItems.find((i) => i.ingredientId === ing.id);
                const isSelected = !!consumedItem;
                const inStock = ing.currentStock || 0;
                const isZeroStock = inStock <= 0;
                const isShortage = consumedItem ? consumedItem.actualQuantity > inStock : false;

                return (
                  <div
                    key={ing.id}
                    onClick={() => handleToggleIngredient(ing)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between select-none press-apple ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-xs'
                        : 'border-charcoal-border dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-emerald-500/40 hover:bg-stone-50 dark:hover:bg-[#282323]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox indicator */}
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'border-2 border-stone-300 dark:border-stone-600 bg-transparent'
                        }`}
                      >
                        {isSelected && <TbCheck className="w-4 h-4 stroke-[3]" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam truncate">
                          {ing.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isZeroStock
                                ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                                : isShortage
                                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                                : 'bg-stone-100 dark:bg-[#252020] text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            {isZeroStock
                              ? language === 'ml'
                                ? 'സ്റ്റോക്കില്ല'
                                : 'Out of Stock'
                              : `${inStock} ${ing.unit} സ്റ്റോക്ക്`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Measured Quantity Pill & Ruler Button */}
                    {isSelected && consumedItem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenIngredientRuler(ing, consumedItem.actualQuantity);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#141212] border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-black text-xs shadow-2xs hover:border-emerald-500 transition-all shrink-0 ml-2"
                        title={language === 'ml' ? 'അളവ് മാറ്റുക' : 'Tune Quantity'}
                      >
                        <span>
                          {consumedItem.actualQuantity} {consumedItem.unit}
                        </span>
                        <TbRuler2 className="w-3.5 h-3.5 opacity-70" />
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredIngredients.length === 0 && (
                <div className="col-span-2 text-center py-8 text-stone-400 text-sm font-medium font-malayalam">
                  ചേരുവകൾ ഒന്നും കണ്ടെത്തിയില്ല
                </div>
              )}
            </div>

            {/* Out of stock warning banner if any selected ingredient is 0 */}
            {hasOutOfStockIngredient && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                <TbAlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1 font-malayalam">
                  <span className="font-bold block">സ്റ്റോക്ക് മുന്നറിയിപ്പ്:</span>
                  <span className="text-[11px] opacity-90 mt-0.5 block">
                    {outOfStockIngredients.map((i) => i.name).join(', ')} സ്റ്റോക്ക് തീർന്നു (0 Stock).
                  </span>
                </div>
              </div>
            )}

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-charcoal-border dark:border-[#2E2828]">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                icon={<TbChevronLeft className="w-4 h-4" />}
              >
                {language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}
              </Button>

              <Button
                variant="primary"
                onClick={() => setStep(4)}
                icon={<TbChevronRight className="w-4 h-4" />}
                disabled={consumptionItems.length === 0 || hasOutOfStockIngredient}
                className="font-bold px-5"
              >
                {language === 'ml' ? 'റിവ്യൂ ചെയ്യുക' : 'Next: Review'}
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: REVIEW & CONFIRM (DEFAULT MODAL)                 */}
        {/* ======================================================== */}
        {step === 4 && selectedProduct && (
          <div className="space-y-4">
            {/* Product Run Summary Card */}
            <div className="p-4 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/40 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-epso-red dark:text-red-400 font-malayalam">
                    ഉൽപ്പാദന ബാച്ച് സംഗ്രഹം
                  </span>
                  <h4 className="text-lg font-black text-stone-900 dark:text-white leading-tight mt-0.5 font-malayalam">
                    {selectedProduct.name}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-epso-red dark:text-amber-400 font-mono">
                    {actualOutputQty} {selectedProduct.unit}
                  </span>
                  <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 font-malayalam">
                    ലക്ഷ്യമിടുന്ന ഉൽപ്പാദനം
                  </p>
                </div>
              </div>

              <div className="text-xs text-stone-700 dark:text-stone-300 border-t border-red-200/60 dark:border-red-900/40 pt-2 flex items-center justify-between font-malayalam">
                <span>തിരഞ്ഞെടുത്ത ചേരുവകൾ: {consumptionItems.length}</span>
                <span className="font-bold text-stone-900 dark:text-white">
                  ചേരുവ ചിലവ്: ₹{totalBatchIngredientCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Selected Ingredients Breakdown List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 font-malayalam">
                  ചേരുവകളുടെ അളവ് ({consumptionItems.length})
                </span>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-[11px] text-epso-orange font-bold font-malayalam hover:underline"
                >
                  ചേരുവകളിൽ മാറ്റം വരുത്തുക
                </button>
              </div>

              <div className="space-y-1.5 max-h-[28vh] overflow-y-auto pr-1">
                {consumptionItems.map((item) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId);
                  const inStock = ing ? ing.currentStock : 0;
                  const unitCost = ing ? Number(ing.avgCostPerUnit) || 0 : 0;
                  const itemCost = item.actualQuantity * unitCost;

                  return (
                    <div
                      key={item.ingredientId}
                      className="p-2.5 rounded-xl border border-stone-200/80 dark:border-[#282323] bg-white dark:bg-[#1E1B1B] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900 dark:text-white font-malayalam block">
                          {ing?.name || 'Ingredient'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-sans">
                          സ്റ്റോക്ക്: {inStock} {item.unit} • ₹{unitCost.toFixed(1)}/{item.unit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-black text-stone-900 dark:text-white block">
                          {item.actualQuantity} {item.unit}
                        </span>
                        <span className="text-[10px] font-mono text-stone-500">
                          ₹{itemCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operator & Date Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block font-malayalam">
                  {t.operator}
                </label>
                <Input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Cook / Operator Name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block font-malayalam">
                  തീയതി (Date)
                </label>
                <Input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block font-malayalam">
                കുറിപ്പ് (Notes)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ബാച്ച് വിവരങ്ങൾ, താപനില, പ്രത്യേക നിർദ്ദേശങ്ങൾ..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-charcoal-border dark:border-[#2E2828]">
              <Button
                variant="ghost"
                onClick={() => setStep(3)}
                icon={<TbChevronLeft className="w-4 h-4" />}
              >
                {language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}
              </Button>

              <Button
                variant="primary"
                onClick={handleFinalSubmit}
                isLoading={isSubmitting}
                icon={<TbCircleCheck className="w-4 h-4" />}
                className="font-black px-6"
              >
                {language === 'ml' ? 'ഉൽപ്പാദനം ആരംഭിക്കുക' : t.confirmProduction}
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
                  ചേരുവ ഒഴിവാക്കണോ?
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 font-bold mt-0.5">
                  {itemToDelete.name} ({itemToDelete.quantity} {itemToDelete.unit})
                </p>
              </div>
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
                  setItemToDelete(null);
                }}
              >
                {language === 'ml' ? 'ഒഴിവാക്കുക' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Measurement Ruler Modal Overlay for Measuring Each Ingredient */}
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
                    handlePlannedQtyChange(newVal);
                  }
                }}
                confirmLabel={language === 'ml' ? 'സ്ഥിരീകരിക്കുക' : 'Done / Set Quantity'}
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
