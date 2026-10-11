import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { RecipeFormModal } from '../components/recipes/RecipeFormModal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Product, Recipe, Ingredient } from '../types';
import {
  TbPlus,
  TbEdit,
  TbTrash,
  TbSearch,
  TbBook,
  TbLock,
} from 'react-icons/tb';

export const ProductsPage: React.FC = () => {
  const { repo, dataVersion, triggerRefresh, addToast, isAdminAuthenticated } = useApp();
  const { t, language } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState<boolean>(false);
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<Product | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [pList, rList, iList] = await Promise.all([
          repo.listProducts(true),
          repo.listRecipes(),
          repo.listIngredients(false),
        ]);
        if (mounted) {
          setProducts(pList);
          setRecipes(rList);
          setIngredients(iList);
        }
      } catch (err: any) {
        console.error('Error loading products', err);
        addToast(err?.message || 'Failed to load products', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [repo, dataVersion, addToast]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  const handleToggleActive = async (prod: Product) => {
    if (!isAdminAuthenticated) {
      addToast(
        language === 'ml'
          ? 'ഉൽപ്പന്ന നില മാറ്റാൻ അഡ്മിൻ അനുമതി ആവശ്യമാണ്'
          : 'Admin permission required to toggle product status',
        'warning'
      );
      return;
    }

    try {
      await repo.updateProduct(prod.id, { isActive: !prod.isActive });
      addToast(
        prod.isActive
          ? `${prod.name} ${t.deactivate} ചെയ്തു`
          : `${prod.name} ${t.activate} ചെയ്തു`,
        'info'
      );
      triggerRefresh();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update status', 'error');
    }
  };

  const handleSafeDelete = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      const res = await repo.safeDeleteProduct(productToDelete.id);
      if (res.deactivated) {
        addToast(
          language === 'ml'
            ? 'ഈ ഉൽപ്പന്നത്തിന് ചരിത്രപരമായ പ്രൊഡക്ഷൻ രേഖകൾ ഉള്ളതിനാൽ അത് നിഷ്ക്രിയമാക്കി (Soft Delete).'
            : 'Product has historical production records, so it was deactivated to preserve history.',
          'warning'
        );
      } else {
        addToast(
          language === 'ml' ? 'ഉൽപ്പന്നം വിജയകരമായി ഡിലീറ്റ് ചെയ്തു.' : 'Product deleted successfully.',
          'success'
        );
      }
      setProductToDelete(null);
      triggerRefresh();
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete product', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white tracking-tight">
            {t.navProducts} ({products.length})
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {language === 'ml'
              ? 'എപ്സോ ലഘുഭക്ഷണ ഉൽപ്പന്നങ്ങളുടെ കാറ്റലോഗ്. പുതിയവ ചേർക്കാനും എഡിറ്റ് ചെയ്യാനും സാധിക്കും.'
              : 'Epso snack product catalogue. Authorised staff can add, edit, and manage items.'}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setProductToEdit(null);
            setIsFormOpen(true);
          }}
          icon={<TbPlus className="w-5 h-5" />}
          className="font-extrabold"
        >
          {t.addProduct}
        </Button>
      </div>

      {/* Search Bar */}
      <Input
        placeholder="Search snack product name or SKU..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        leftAddon={<TbSearch className="w-4 h-4 text-stone-400" />}
      />

      {/* Loading state with Epso Animated Swirl */}
      {loading && (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" label={t.loading} />
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredProducts.map((prod) => {
            const hasRecipe = recipes.some((r) => r.productId === prod.id && r.isActive);

            return (
              <Card
                key={prod.id}
                padding="md"
                className={`flex flex-col justify-between transition-all space-y-3 ${
                  prod.isActive
                    ? 'hover:border-epso-red/40 dark:hover:border-epso-red/50'
                    : 'bg-stone-50/80 dark:bg-[#181515] border-dashed opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-epso-red dark:text-red-300 flex items-center justify-center font-black text-sm shrink-0">
                        {prod.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-black text-stone-900 dark:text-white leading-tight font-malayalam">
                            {prod.name}
                          </h3>
                          {!prod.isActive && (
                            <span className="text-[10px] font-bold text-stone-500 bg-stone-200 dark:bg-stone-800 px-1.5 py-0.2 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">
                          SKU: {prod.sku || 'N/A'} • Unit: {prod.unit}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-stone-900 dark:text-white">
                        {prod.currentStock} {prod.unit}
                      </span>
                      <p className="text-[10px] text-stone-400 font-semibold">in stock</p>
                    </div>
                  </div>

                  {/* Recipe / Ingredients configuration button */}
                  <div className="mt-2.5 flex items-center gap-2">
                    {hasRecipe ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductForRecipe(prod);
                          setIsRecipeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer press-apple shadow-2xs"
                        title={language === 'ml' ? 'ചേരുവകൾ മാറ്റുക / കാണുക' : 'View or edit ingredients formula'}
                      >
                        <TbBook className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{language === 'ml' ? 'ചേരുവകൾ ക്രമീകരിച്ചിട്ടുണ്ട്' : 'Recipe Configured'}</span>
                        <TbEdit className="w-3 h-3 text-emerald-600 dark:text-emerald-400 ml-0.5 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductForRecipe(prod);
                          setIsRecipeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer press-apple shadow-2xs"
                        title={language === 'ml' ? 'ഈ ഉൽപ്പന്നത്തിന് ചേരുവകൾ ചേർക്കുക' : 'Add ingredients used for this product'}
                      >
                        <TbPlus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{language === 'ml' ? '+ ചേരുവകൾ ചേർക്കുക' : '+ Add Ingredients'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Operations Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/50 dark:border-[#2E2828] text-xs">
                  {/* Theme-matching Active / Inactive switch - Admin Protected */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prod.isActive}
                      disabled={!isAdminAuthenticated}
                      onClick={() => handleToggleActive(prod)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        !isAdminAuthenticated
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer focus:ring-2 focus:ring-epso-red/30'
                      } ${
                        prod.isActive
                          ? 'bg-epso-red hover:bg-epso-red-hover dark:bg-epso-red'
                          : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                      title={
                        !isAdminAuthenticated
                          ? (language === 'ml' ? 'അഡ്മിന് മാത്രം മാറ്റാം' : 'Admin only')
                          : (prod.isActive ? 'Active - click to deactivate' : 'Inactive - click to activate')
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          prod.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-bold ${prod.isActive ? 'text-epso-red dark:text-amber-400' : 'text-stone-400 dark:text-stone-500'}`}>
                      {prod.isActive ? (language === 'ml' ? 'സജീവം' : 'Active') : (language === 'ml' ? 'നിർജ്ജീവം' : 'Inactive')}
                    </span>
                    {!isAdminAuthenticated && (
                      <span className="text-stone-400 dark:text-stone-500" title={language === 'ml' ? 'അഡ്മിന് മാത്രം' : 'Admin only'}>
                        <TbLock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setProductToEdit(prod);
                        setIsFormOpen(true);
                      }}
                      className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-epso-red dark:hover:text-amber-400 rounded-lg hover:bg-red-50 dark:hover:bg-[#282323] transition-colors press-apple"
                      title={t.editProduct}
                    >
                      <TbEdit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setProductToDelete(prod)}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-[#282323] transition-colors press-apple"
                      title={t.deleteProduct}
                    >
                      <TbTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={productToEdit}
        onSuccess={triggerRefresh}
        onOpenRecipe={(prod) => {
          setSelectedProductForRecipe(prod);
          setIsRecipeModalOpen(true);
        }}
      />

      {/* Recipe / Ingredients BOM Configuration Modal */}
      <RecipeFormModal
        isOpen={isRecipeModalOpen}
        onClose={() => {
          setIsRecipeModalOpen(false);
          setSelectedProductForRecipe(null);
        }}
        products={products}
        ingredients={ingredients}
        preselectedProductId={selectedProductForRecipe?.id}
        recipeToEdit={recipes.find((r) => r.productId === selectedProductForRecipe?.id && r.isActive)}
        onSuccess={triggerRefresh}
      />

      {/* Delete / Deactivate Product Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleSafeDelete}
        title={t.deleteProduct}
        message={
          language === 'ml'
            ? `"${productToDelete?.name}" ഡിലീറ്റ് ചെയ്യാൻ ആഗ്രഹിക്കുന്നുണ്ടോ? ചരിത്രപരമായ പ്രൊഡക്ഷൻ രേഖകൾ ഉണ്ടെങ്കിൽ അത് യാന്ത്രികമായി നിഷ്ക്രിയമാകും (Soft Delete).`
            : `Are you sure you want to delete "${productToDelete?.name}"? If referenced in production history, it will be safely deactivated.`
        }
        confirmLabel={t.deleteProduct}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
