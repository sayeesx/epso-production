import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MeasurementRulerSelector, getUnitConfig } from '../ui/MeasurementRulerSelector';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { BatchSuccessAnimation } from '../ui/BatchSuccessAnimation';
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

export const isDailySharedBasic = (name: string) => {
  const n = (name || '').trim().toLowerCase();
  return (
    n.includes('ഓയിൽ') ||
    n.includes('oil') ||
    n.includes('ഉപ്പ്') ||
    n.includes('salt') ||
    n.includes('അണ്ടി തോട്') ||
    n.includes('തോട്') ||
    n.includes('കറിവേപ്പില') ||
    n.includes('curry leaves')
  );
};

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
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [savedRunData, setSavedRunData] = useState<any>(null);

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
        (r) => String(r.productId) === String(selectedProductId) && (r.isActive ?? true)
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
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
    };
  }, [isOpen, staffName]);

  // Filter products for Step 1
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) => p.isActive && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  // Check if active recipe has valid ingredients set
  const hasRecipeIngredients = useMemo(() => {
    return Boolean(activeRecipe && activeRecipe.ingredients && activeRecipe.ingredients.length > 0);
  }, [activeRecipe]);

  // Filter ingredients for Step 3: show all recipe ingredients configured for this product
  const displayedRecipeIngredients = useMemo(() => {
    if (activeRecipe && activeRecipe.ingredients && activeRecipe.ingredients.length > 0) {
      return activeRecipe.ingredients.map((ri) => {
        const found = ingredients.find((ing) => ing.id === ri.ingredientId);
        if (found) {
          return found;
        }
        return {
          id: ri.ingredientId,
          name: ri.ingredientName || 'Ingredient',
          unit: ri.unit || 'kg',
          currentStock: 999, // default if inventory entry not yet loaded
          minStock: 0,
          costPerUnit: 0,
          avgCostPerUnit: 0,
          isActive: true,
          category: 'other',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Ingredient;
      });
    }
    return [];
  }, [ingredients, activeRecipe]);

  // Check if any recipe ingredient is out of stock (stock <= 0)
  const isAnyIngredientOutOfStock = useMemo(() => {
    if (!displayedRecipeIngredients || displayedRecipeIngredients.length === 0) return true;
    return displayedRecipeIngredients.some((ing) => (ing.currentStock || 0) <= 0);
  }, [displayedRecipeIngredients]);

  // When a product is selected in Step 1, advance to Step 2 (measure quantity)
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsModalExpanded(false);
    const prodRecipe = recipes.find(
      (r) => String(r.productId) === String(productId) && (r.isActive ?? true)
    );
    const initialQty = prodRecipe?.baseOutputQuantity || 10;
    setPlannedQty(initialQty);
    setActualOutputQty(initialQty);

    // Pre-populate with recipe ingredients scaled for initial planned quantity
    if (prodRecipe && prodRecipe.ingredients && prodRecipe.ingredients.length > 0) {
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

    if (activeRecipe && activeRecipe.ingredients && activeRecipe.ingredients.length > 0 && activeRecipe.baseOutputQuantity > 0) {
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
    if (ing.currentStock <= 0) return;
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
        isZeroStock: false,
        value: initialQty,
        min: uConfig.min,
        max: 20,
        step: uConfig.step,
      });
    }
  };

  // Open ruler directly for an already selected ingredient
  const handleOpenIngredientRuler = (ing: Ingredient, currentVal: number) => {
    if (ing.currentStock <= 0) return;
    const uConfig = getUnitConfig(ing.unit);
    setActiveRulerItem({
      type: 'ingredient',
      ingredientId: ing.id,
      name: ing.name,
      unit: ing.unit,
      subtitle: `സ്റ്റോക്ക്: ${ing.currentStock} ${ing.unit}`,
      isZeroStock: false,
      value: currentVal,
      min: uConfig.min,
      max: 20,
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

      setSavedRunData(saved);
      setIsSubmitting(false);
      setShowSuccessAnim(true);
    } catch (err: any) {
      console.error('Production save error', err);
      addToast(err?.message || 'Failed to save production run', 'error');
      setIsSubmitting(false);
    }
  };

  const handleSuccessAnimComplete = () => {
    setShowSuccessAnim(false);
    addToast(t.productionSavedSuccess, 'success');
    if (savedRunData) {
      onSuccess(savedRunData);
    }
    onClose();
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
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs ring-1 ring-emerald-500/20'
                        : 'bg-stone-200 dark:bg-[#282323] text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {isPassed ? <TbCheck className="w-3.5 h-3.5 stroke-[3] text-white" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-bold font-malayalam hidden sm:inline ${
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
                {idx < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
                      step > idx + 1 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-stone-200 dark:bg-[#282323]'
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
                  const productRecipe = recipes.find((r) => String(r.productId) === String(p.id) && (r.isActive ?? true));
                  const hasRecipe = Boolean(productRecipe && productRecipe.ingredients && productRecipe.ingredients.length > 0);
                  const isSelected = p.id === selectedProductId;
                  const hasOutOfStockIng = Boolean(productRecipe?.ingredients?.some((ingItem) => {
                    const ing = ingredients.find((i) => i.id === ingItem.ingredientId);
                    return ing && ing.currentStock <= 0;
                  }));

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
            <div className="p-3 bg-stone-100/70 dark:bg-[#252020]/70 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-200/60 dark:bg-[#2e2828]/60 flex items-center justify-center shrink-0">
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

            {/* Dedicated Measurement Ruler for Output Quantity - Flat, borderless, shadowless */}
            <div className="w-full py-1">
              <MeasurementRulerSelector
                title={language === 'ml' ? 'ഉൽപ്പാദന അളവ് നിശ്ചയിക്കുക' : 'Set Production Quantity'}
                subtitle={language === 'ml' ? `യൂണിറ്റ്: ${selectedProduct.unit}` : `Unit: ${selectedProduct.unit}`}
                unit={selectedProduct.unit}
                value={plannedQty}
                presets={[5, 10, 25, 50, 100, 250]}
                min={0}
                max={250}
                step={0.5}
                onChange={handlePlannedQtyChange}
              />
            </div>

            {/* Error box if no ingredients are set for selected product */}
            {!hasRecipeIngredients && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <TbAlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="font-bold">
                  {language === 'ml'
                    ? 'ഈ ഉൽപ്പന്നത്തിന് ചേരുവകൾ (Recipe) ചേർത്തിട്ടില്ല. Admin-ൽ റെസിപ്പി നൽകിയ ശേഷം മാത്രം ഉൽപ്പാദനം സാധ്യമാകൂ.'
                    : 'No ingredients are set for this product. Please set up a recipe in Admin first.'}
                </span>
              </div>
            )}

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/50 dark:border-[#2E2828]/50">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                icon={<TbChevronLeft className="w-4 h-4" />}
              >
                {language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}
              </Button>

              <Button
                variant="primary"
                onClick={() => {
                  if (!hasRecipeIngredients) return;
                  setStep(3);
                }}
                disabled={!hasRecipeIngredients}
                icon={<TbChevronRight className="w-4 h-4" />}
                className="font-bold px-6"
              >
                {language === 'ml' ? 'ചേരുവകൾ' : 'Ingredients'}
              </Button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT INGREDIENTS TO TICK (WITH RULER)          */}
        {/* ======================================================== */}
        {step === 3 && selectedProduct && (
          activeRulerItem ? (
            /* DIRECT IN-MODAL MEASUREMENT RULER (NO PORTAL, NO LEVITATION, NO BORDERS, NO SHADOWS) */
            <div className="space-y-2 animate-in fade-in duration-150">
              {/* Seamless Ruler for Measuring Selected Ingredient */}
              <div className="w-full py-1">
                <MeasurementRulerSelector
                  title={activeRulerItem.name}
                  subtitle={activeRulerItem.subtitle}
                  isZeroStock={activeRulerItem.isZeroStock}
                  unit={activeRulerItem.unit}
                  value={activeRulerItem.value || 1}
                  min={activeRulerItem.min}
                  max={activeRulerItem.max ?? 20}
                  step={activeRulerItem.step}
                  onChange={(newVal) => {
                    setActiveRulerItem((prev) => (prev ? { ...prev, value: newVal } : null));
                    if (activeRulerItem.type === 'ingredient' && activeRulerItem.ingredientId) {
                      updateActualQty(activeRulerItem.ingredientId, newVal);
                    }
                  }}
                  confirmLabel={language === 'ml' ? 'സ്ഥിരീകരിക്കുക' : 'Done / Set Quantity'}
                  onConfirm={() => setActiveRulerItem(null)}
                  onClose={() => setActiveRulerItem(null)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Recipe Ingredients Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {displayedRecipeIngredients.map((ing) => {
                  const consumedItem = consumptionItems.find((i) => i.ingredientId === ing.id);
                  const isSelected = !!consumedItem;
                  const inStock = ing.currentStock || 0;
                  const isZeroStock = inStock <= 0;

                  return (
                    <div
                      key={ing.id}
                      onClick={() => {
                        // When any ingredient is out of stock, do NOT open ruler!
                        if (isZeroStock) return;

                        if (isSelected) {
                          handleOpenIngredientRuler(ing, consumedItem.actualQuantity);
                        } else {
                          handleToggleIngredient(ing);
                        }
                      }}
                      className={`p-3.5 rounded-xl border-2 transition-all flex items-center justify-between select-none ${
                        isZeroStock
                          ? 'border-stone-200 dark:border-[#282323] bg-stone-100/70 dark:bg-[#181515] opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 cursor-pointer press-apple'
                          : 'border-charcoal-border dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-emerald-500/40 hover:bg-stone-50 dark:hover:bg-[#282323] cursor-pointer press-apple'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Checkbox indicator */}
                        <button
                          type="button"
                          disabled={isZeroStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isZeroStock) return;
                            handleToggleIngredient(ing);
                          }}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            isZeroStock
                              ? 'border-2 border-stone-300 dark:border-stone-700 bg-transparent cursor-not-allowed'
                              : isSelected
                              ? 'bg-emerald-600 dark:bg-emerald-500 text-white cursor-pointer'
                              : 'border-2 border-stone-300 dark:border-stone-600 bg-transparent hover:border-emerald-500 cursor-pointer'
                          }`}
                        >
                          {isSelected && !isZeroStock && (
                            <TbCheck className="w-4 h-4 stroke-[3]" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h4
                            className={`text-sm font-extrabold leading-tight font-malayalam truncate ${
                              isZeroStock
                                ? 'text-stone-400 dark:text-stone-600'
                                : 'text-stone-900 dark:text-white'
                            }`}
                          >
                            {ing.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isZeroStock
                                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-500'
                                  : 'bg-stone-100 dark:bg-[#252020] text-stone-600 dark:text-stone-400'
                              }`}
                            >
                              {isZeroStock
                                ? language === 'ml'
                                  ? 'സ്റ്റോക്കില്ല (0 Stock)'
                                  : 'Out of Stock'
                                : `${inStock} ${ing.unit} സ്റ്റോക്ക്`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Measured Quantity Pill & Ruler Button */}
                      {isSelected && consumedItem && !isZeroStock && (
                        <div
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#141212] border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-black text-xs hover:border-emerald-500 transition-all shrink-0 ml-2"
                          title={language === 'ml' ? 'അളവ് മാറ്റുക' : 'Tune Quantity'}
                        >
                          <span>
                            {consumedItem.actualQuantity} {consumedItem.unit}
                          </span>
                          <TbRuler2 className="w-3.5 h-3.5 opacity-70" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {displayedRecipeIngredients.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-stone-400 text-sm font-medium font-malayalam">
                    {language === 'ml'
                      ? 'ഈ ഉൽപ്പന്നത്തിന് റെസിപ്പി ചേർത്തിട്ടില്ല'
                      : 'No recipe ingredients added for this product'}
                  </div>
                )}
              </div>

              {/* Step 3 Actions: Back and Review Buttons on BOTTOM */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-charcoal-border/50 dark:border-[#2E2828]/50">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  icon={<TbChevronLeft className="w-4 h-4" />}
                >
                  {language === 'ml' ? 'പിന്നോട്ട്' : 'Back'}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isAnyIngredientOutOfStock && consumptionItems.length > 0) {
                      setStep(4);
                    }
                  }}
                  disabled={isAnyIngredientOutOfStock || consumptionItems.length === 0}
                  className={`flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all select-none ${
                    isAnyIngredientOutOfStock || consumptionItems.length === 0
                      ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 border border-stone-200 dark:border-stone-800 cursor-not-allowed opacity-80 pointer-events-none'
                      : 'bg-gradient-to-r from-epso-red to-epso-orange hover:bg-epso-red-hover text-white shadow-md press-apple cursor-pointer'
                  }`}
                >
                  <span>{language === 'ml' ? 'റിവ്യൂ ചെയ്യുക' : 'Review & Next'}</span>
                  <TbChevronRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )
        )}

        {/* ======================================================== */}
        {/* STEP 4: REVIEW & CONFIRM (DEFAULT MODAL)                 */}
        {/* ======================================================== */}
        {step === 4 && selectedProduct && (
          <div className="space-y-3.5">
            {/* Product Run Summary Card - NO COST / EXPENSE */}
            <div className="p-3.5 bg-red-50/60 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/40">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-epso-red dark:text-red-400 font-malayalam">
                    ഉൽപ്പാദന ബാച്ച് സംഗ്രഹം
                  </span>
                  <h4 className="text-lg font-black text-stone-900 dark:text-white leading-tight mt-0.5 font-malayalam">
                    {selectedProduct.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium font-malayalam mt-1">
                    തിരഞ്ഞെടുത്ത ചേരുവകൾ: {consumptionItems.length}
                  </p>
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
            </div>

            {/* Selected Ingredients Breakdown List - SCROLLS WITHIN FIXED CONTAINER */}
            <div className="space-y-1.5">
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

              {/* Scrollable list within fixed container - does not increase modal length */}
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {consumptionItems.map((item) => {
                  const ing = ingredients.find((i) => i.id === item.ingredientId);
                  const inStock = ing ? ing.currentStock : 0;

                  return (
                    <div
                      key={item.ingredientId}
                      className="p-2.5 rounded-xl border border-stone-200/80 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900 dark:text-white font-malayalam block">
                          {ing?.name || 'Ingredient'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-sans">
                          സ്റ്റോക്ക്: {inStock} {item.unit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-black text-stone-900 dark:text-white block">
                          {item.actualQuantity} {item.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>



            {/* Step 4 Bottom Action Bar - placed at bottom matching step 2 */}
            <div className="flex items-center justify-between pt-3 border-t border-charcoal-border/50 dark:border-[#2E2828]/50">
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
                className="font-bold px-6"
              >
                Confirm & Save
              </Button>
            </div>
          </div>
        )}

        {/* Loading Spinner Animation during submission */}
        {isSubmitting && (
          <div className="absolute inset-0 bg-white/85 dark:bg-[#1E1B1B]/85 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center z-50 animate-in fade-in">
            <LoadingSpinner size="lg" label={language === 'ml' ? 'ബാച്ച് സേവ് ചെയ്യുന്നു...' : 'Saving production batch...'} />
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

      {/* Lottie-like Themed Success Animation */}
      <BatchSuccessAnimation
        isVisible={showSuccessAnim}
        onComplete={handleSuccessAnimComplete}
        message={language === 'ml' ? 'ബാച്ച് വിജയകരമായി ചേർത്തു!' : 'Production Batch Saved!'}
        subMessage={
          language === 'ml'
            ? `${actualOutputQty} ${selectedProduct?.unit || 'kg'} ${selectedProduct?.name || ''} സ്റ്റോക്കിലേക്ക് ചേർത്തു`
            : `${actualOutputQty} ${selectedProduct?.unit || 'kg'} ${selectedProduct?.name || ''} added to stock`
        }
      />
    </Modal>
  );
};
