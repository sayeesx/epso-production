import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { GridCardSkeleton } from '../components/ui/BatchCardSkeleton';
import { Ingredient } from '../types';
import {
  TbCarrot,
  TbSearch,
  TbAlertTriangle,
  TbLock,
  TbCheck,
} from 'react-icons/tb';

export const IngredientsPage: React.FC = () => {
  const { repo, dataVersion } = useApp();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'low') {
      setCategoryFilter('low');
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await repo.listIngredients(showInactive);
        if (mounted) setIngredients(data);
      } catch (err) {
        console.error('Failed to load ingredients:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [repo, dataVersion, showInactive]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (!showInactive && ing.isActive === false) return false;

      const matchSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (categoryFilter === 'low') {
        return ing.minStock > 0 && ing.currentStock <= ing.minStock;
      }
      if (categoryFilter === 'all') return true;
      return ing.category === categoryFilter;
    });
  }, [ingredients, searchTerm, categoryFilter, showInactive]);

  const basicCount = useMemo(
    () => ingredients.filter((i) => i.category === 'basic' && (showInactive || i.isActive !== false)).length,
    [ingredients, showInactive]
  );
  const otherCount = useMemo(
    () => ingredients.filter((i) => i.category === 'other' && (showInactive || i.isActive !== false)).length,
    [ingredients, showInactive]
  );
  const lowCount = useMemo(
    () => ingredients.filter((i) => i.minStock > 0 && i.currentStock <= i.minStock).length,
    [ingredients]
  );

  return (
    <div className="space-y-4 max-w-lg md:max-w-5xl mx-auto pb-10">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{language === 'ml' ? 'ചേരുവകൾ' : 'Ingredients Catalogue'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-epso-red dark:text-red-300 font-bold">
              {ingredients.length}
            </span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {language === 'ml'
              ? 'ബേസിക് ചേരുവകളും (Category A) മറ്റു ചേരുവകളും (Category B)'
              : 'Category A: Basic ingredients & Category B: Other raw materials'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] text-stone-600 dark:text-stone-400 text-xs font-semibold">
          <TbLock className="w-3.5 h-3.5 text-amber-500" />
          <span>{language === 'ml' ? 'അഡ്മിൻ നിയന്ത്രിത സ്റ്റോക്ക്' : 'Admin Managed Catalog'}</span>
        </div>
      </div>

      {/* Search & Category Filter Tabs */}
      <div className="space-y-2">
        <Input
          placeholder={language === 'ml' ? 'ചേരുവയുടെ പേര് തിരയുക...' : 'Search ingredient name...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftAddon={<TbSearch className="w-4 h-4 text-stone-400" />}
        />

        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'all', label: `${language === 'ml' ? 'എല്ലാം' : 'All'} (${ingredients.length})` },
              { id: 'basic', label: `Category A: ${t('categoryBasic')} (${basicCount})` },
              { id: 'other', label: `Category B: ${t('categoryOther')} (${otherCount})` },
              ...(lowCount > 0 ? [{ id: 'low', label: `⚠️ ${language === 'ml' ? 'കുറഞ്ഞ സ്റ്റോക്ക്' : 'Low Stock'} (${lowCount})` }] : []),
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryFilter(cat.id);
                  if (cat.id !== 'low') setSearchParams({});
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap select-none press-apple ${
                  categoryFilter === cat.id
                    ? 'bg-epso-red text-white shadow-sm'
                    : 'bg-white dark:bg-[#1E1B1B] text-stone-700 dark:text-stone-300 border border-charcoal-border dark:border-[#2E2828] hover:bg-stone-50 dark:hover:bg-[#282323]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
              showInactive
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            {showInactive
              ? (language === 'ml' ? 'നിർജ്ജീവമായവ ഉൾപ്പെടുത്തിയിരിക്കുന്നു' : 'Showing Inactive')
              : (language === 'ml' ? 'നിർജ്ജീവമായവ കാണിക്കുക' : 'Show Inactive')}
          </button>
        </div>
      </div>

      {/* Ingredient Items Grid */}
      {loading ? (
        <GridCardSkeleton count={6} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
      ) : filteredIngredients.length === 0 ? (
        <Card className="text-center py-12 text-stone-500 dark:text-stone-400 text-sm space-y-2">
          <TbCarrot className="w-8 h-8 text-stone-400 dark:text-stone-600 mx-auto" />
          <p>
            {searchTerm
              ? (language === 'ml' ? 'തിരഞ്ഞ ചേരുവ കണ്ടെത്തിയില്ല' : 'No ingredients match your search')
              : (language === 'ml' ? 'ചേരുവകൾ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല' : 'No ingredients in catalogue')}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredIngredients.map((ing) => {
            const isLow = ing.minStock > 0 && ing.currentStock <= ing.minStock;
            const isBasic = ing.category === 'basic';

            return (
              <Card
                key={ing.id}
                padding="sm"
                className={`flex flex-col justify-between transition-all hover:border-epso-red/50 dark:hover:border-epso-red/50 ${
                  ing.isActive === false
                    ? 'opacity-60 bg-stone-50 dark:bg-[#181515] border-dashed'
                    : isLow
                    ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                    : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-[#221E1E] border border-stone-200/80 dark:border-[#2C2727] flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src="/epso-icon-grey.png"
                          alt=""
                          className="w-6 h-6 object-contain opacity-50 dark:opacity-40 select-none pointer-events-none"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              isBasic
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {isBasic ? 'Category A: Basic' : 'Category B: Other'}
                          </span>
                          {ing.isActive === false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                              Inactive
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1 leading-snug break-words font-malayalam">
                          {ing.name}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-lg font-black ${
                          isLow ? 'text-red-600 dark:text-red-400' : 'text-stone-900 dark:text-white'
                        }`}
                      >
                        {ing.currentStock}
                      </span>
                      <span className="text-xs font-bold text-stone-500 dark:text-stone-400 ml-1">
                        {ing.unit}
                      </span>
                      {isLow && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-extrabold flex items-center justify-end gap-0.5">
                          <TbAlertTriangle className="w-3 h-3" />
                          <span>{language === 'ml' ? 'കുറഞ്ഞ സ്റ്റോക്ക്' : 'Low Stock'}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stock context & notes */}
                  <div className="mt-2.5 pt-2 border-t border-charcoal-border/40 dark:border-[#2E2828] flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                    <span>
                      {language === 'ml' ? 'അളവ് യൂണിറ്റ്' : 'Unit'}: <strong className="text-stone-800 dark:text-stone-200">{ing.unit}</strong>
                    </span>
                    {ing.minStock > 0 && (
                      <span>
                        {language === 'ml' ? 'അലേർട്ട് പരിധി' : 'Alert'}: {ing.minStock} {ing.unit}
                      </span>
                    )}
                  </div>

                  {ing.notes && (
                    <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 italic truncate">
                      {ing.notes}
                    </p>
                  )}
                </div>

                {/* Stock Status Footer (Read-Only) */}
                <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-charcoal-border/50 dark:border-[#2E2828] text-xs">
                  {ing.currentStock <= 0 ? (
                    <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <TbAlertTriangle className="w-3.5 h-3.5" />
                      <span>{language === 'ml' ? 'സ്റ്റോക്ക് തീർന്നു (0 Stock)' : 'Out of Stock (0)'}</span>
                    </span>
                  ) : isLow ? (
                    <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <TbAlertTriangle className="w-3.5 h-3.5" />
                      <span>{language === 'ml' ? 'കുറഞ്ഞ സ്റ്റോക്ക്' : 'Low Stock Alert'}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <TbCheck className="w-3.5 h-3.5" />
                      <span>{language === 'ml' ? 'സ്റ്റോക്ക് ലഭ്യമാണ്' : 'In Stock'}</span>
                    </span>
                  )}

                  <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                    {ing.category === 'basic' ? 'Basic' : 'Other'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
