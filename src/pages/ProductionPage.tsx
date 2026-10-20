import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StartProductionModal } from '../components/production/StartProductionModal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Product, Recipe, Ingredient, ProductionRun } from '../types';
import {
  TbSearch,
  TbPlus,
  TbRotateClockwise2,
  TbHistory,
  TbTrash,
} from 'react-icons/tb';

export const ProductionPage: React.FC = () => {
  const { repo, dataVersion, triggerRefresh, addToast, staffName, isStartProductionOpen, setIsStartProductionOpen } = useApp();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();

  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSpinner, setShowSpinner] = useState<boolean>(false);

  // Show loading spinner loader only if fetching takes time (e.g. slow network), avoid fake spinner flashes
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (loading) {
      timer = setTimeout(() => {
        setShowSpinner(true);
      }, 150);
    } else {
      setShowSpinner(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  // Modals
  const [runToCancel, setRunToCancel] = useState<ProductionRun | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [runToDelete, setRunToDelete] = useState<ProductionRun | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isOpeningNewBatch, setIsOpeningNewBatch] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [rList, pList, recList, iList] = await Promise.all([
          repo.listProductionRuns({ limit: 40 }),
          repo.listProducts(false),
          repo.listRecipes(),
          repo.listIngredients(false),
        ]);
        if (mounted) {
          setRuns(rList);
          setProducts(pList);
          setRecipes(recList);
          setIngredients(iList);
        }
      } catch (err: any) {
        console.error('Error loading production data', err);
        addToast(err?.message || 'Failed to load production data', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [repo, dataVersion, addToast]);

  const filteredRuns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return runs.filter((r) => {
      const matchSearch =
        !q ||
        r.runNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.operatorName.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (statusFilter === 'all') return true;
      return r.status === statusFilter;
    });
  }, [runs, searchTerm, statusFilter]);

  const handleCancelRun = async () => {
    if (!runToCancel) return;
    if (!cancelReason.trim()) {
      addToast(
        language === 'ml' ? 'റദ്ദാക്കാനുള്ള കാരണം നൽകുക' : 'Please provide a reason for cancellation',
        'warning'
      );
      return;
    }

    try {
      setIsCancelling(true);
      await repo.cancelProductionRun({
        runId: runToCancel.id,
        reason: cancelReason.trim(),
        operatorName: staffName,
      });

      addToast(
        language === 'ml'
          ? 'പ്രൊഡക്ഷൻ ബാച്ച് റദ്ദാക്കുകയും സ്റ്റോക്ക് പുനഃസ്ഥാപിക്കുകയും ചെയ്തു'
          : 'Production run cancelled and ingredient inventory restored',
        'success'
      );
      setRunToCancel(null);
      setCancelReason('');
      triggerRefresh();
    } catch (err: any) {
      console.error('Error cancelling run', err);
      addToast(err?.message || 'Failed to cancel production run', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!runToDelete) return;
    try {
      setIsDeleting(true);
      await repo.deleteProductionRun(runToDelete.id);
      setRuns((prev) => prev.filter((r) => r.id !== runToDelete.id));
      addToast(
        language === 'ml'
          ? `പ്രൊഡക്ഷൻ ബാച്ച് #${runToDelete.runNumber} പൂർണ്ണമായി നീക്കം ചെയ്തു`
          : `Production batch #${runToDelete.runNumber} deleted permanently`,
        'success'
      );
      setRunToDelete(null);
      triggerRefresh();
    } catch (err: any) {
      console.error('Error deleting run', err);
      addToast(err?.message || 'Failed to delete production run', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayRuns = useMemo(() => {
    return runs.filter((r) => r.productionDate === todayDate && r.status === 'completed');
  }, [runs, todayDate]);

  const todaySummary = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; batches: number; ingCost: number; unit: string }> = {};
    for (const r of todayRuns) {
      if (!map[r.productId]) {
        map[r.productId] = { name: r.productName, quantity: 0, batches: 0, ingCost: 0, unit: r.unit };
      }
      map[r.productId].quantity += r.actualQuantity;
      map[r.productId].batches += 1;
      map[r.productId].ingCost += Number(r.totalIngredientCost) || 0;
    }
    return Object.values(map);
  }, [todayRuns]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Sleek header bar with prominent Epso logo */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center">
          <img
            src={isDark ? '/epso-logo-dark.png' : '/epso-logo-light.png'}
            alt="Epso Logo"
            className="h-[56px] sm:h-[68px] w-auto object-contain transition-opacity duration-200 select-none"
          />
        </div>

        <button
          onClick={() => {
            setIsOpeningNewBatch(true);
            setTimeout(() => {
              setIsStartProductionOpen(true);
              setIsOpeningNewBatch(false);
            }, 100);
          }}
          disabled={isOpeningNewBatch}
          className="flex items-center gap-1.5 bg-gradient-to-r from-epso-red to-epso-orange hover:bg-epso-red-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 press-apple select-none cursor-pointer"
        >
          {isOpeningNewBatch ? (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <TbPlus className="w-4 h-4 stroke-[3]" />
          )}
          <span>{language === 'ml' ? 'പുതിയ ബാച്ച്' : 'New Batch'}</span>
        </button>
      </div>

      {/* Daily Production Summary Card (Section 8 - Step 2) */}
      {todaySummary.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1B1B] border border-charcoal-border/50 dark:border-[#2E2828] shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#282323] pb-2">
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-white font-malayalam flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{language === 'ml' ? 'ഇന്നത്തെ ഉൽപ്പാദന സംഗ്രഹം' : 'Daily Production Summary'}</span>
              </h2>
              <p className="text-[11px] text-stone-400 font-malayalam mt-0.5">
                {language === 'ml' ? 'ഇന്ന് പൂർത്തിയാക്കിയ എല്ലാ ബാച്ചുകളും' : 'All batches completed today'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400">
              {todayRuns.length} {language === 'ml' ? 'ബാച്ചുകൾ' : 'batches'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {todaySummary.map((item) => (
              <div
                key={item.name}
                className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#141212] border border-stone-200/60 dark:border-[#282323] flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-stone-900 dark:text-white font-malayalam block">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-stone-400 font-malayalam">
                    {item.batches} {language === 'ml' ? 'ബാച്ചുകൾ' : 'batches'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-extrabold text-stone-900 dark:text-white block">
                    {item.quantity} {item.unit}
                  </span>
                  {item.ingCost > 0 && (
                    <span className="font-mono text-[10px] text-stone-500 block">
                      ₹{item.ingCost.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production History & Operational Search */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-[#1E1B1B] p-1 rounded-xl border border-charcoal-border/40 dark:border-[#2E2828]">
            {(['all', 'completed', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {st === 'all'
                  ? `All (${runs.length})`
                  : st === 'completed'
                  ? t.runStatusCompleted
                  : t.runStatusCancelled}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Search by run #, snack product name, or operator..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftAddon={<TbSearch className="w-4 h-4 text-stone-400" />}
        />

        {/* Loading state: clean loading spinner loader without text, shown only when fetching is active/slow */}
        {loading && showSpinner && (
          <div className="py-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Honest Empty State when no records exist */}
        {!loading && filteredRuns.length === 0 && (
          <div className="bg-white dark:bg-[#1E1B1B] rounded-2xl border border-charcoal-border dark:border-[#2E2828] p-8 sm:p-12 text-center space-y-3 transition-colors">
            <div className="w-14 h-14 bg-stone-100 dark:bg-[#282323] text-stone-400 dark:text-stone-500 rounded-2xl flex items-center justify-center mx-auto">
              <TbHistory className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">{t.noProductionRecordsYet}</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {language === 'ml'
                  ? 'പ്രൊഡക്ഷൻ രേഖപ്പെടുത്താൻ മുകളിലുള്ള "പുതിയ പ്രൊഡക്ഷൻ ആരംഭിക്കുക" ബട്ടൺ ഉപയോഗിക്കുക.'
                  : 'Click the "Start Production" button above to log your first production run.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStartProductionOpen(true)}
              icon={<TbPlus className="w-4 h-4" />}
            >
              {t.startProduction}
            </Button>
          </div>
        )}

        {/* Runs List */}
        {!loading && filteredRuns.length > 0 && (
          <div className="space-y-2.5">
            {filteredRuns.map((run) => {
              const isCompleted = run.status === 'completed';

              return (
                <Card
                  key={run.id}
                  padding="md"
                  className="hover:border-epso-red/40 dark:hover:border-epso-red/50 transition-all select-none space-y-3 press-apple"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isCompleted
                            ? 'bg-red-100 dark:bg-red-950/60 text-epso-red dark:text-red-300'
                            : 'bg-stone-100 dark:bg-[#282323] text-stone-500 line-through'
                        }`}
                      >
                        {run.productName.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam">
                            {run.productName}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-stone-100 dark:bg-[#282323] text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 line-through'
                            }`}
                          >
                            {isCompleted ? t.runStatusCompleted : t.runStatusCancelled}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">
                          #{run.runNumber} • {run.productionDate} • {run.operatorName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-stone-900 dark:text-white">
                        {run.actualQuantity} {run.unit}
                      </span>
                      <p className="text-[10px] font-semibold text-stone-400">output</p>
                    </div>
                  </div>

                  {/* Ingredients consumed summary */}
                  {run.ingredientsConsumed && run.ingredientsConsumed.length > 0 && (
                    <div className="bg-stone-50 dark:bg-[#141212] rounded-xl p-2.5 text-xs text-stone-600 dark:text-stone-300 flex flex-wrap items-center gap-x-3 gap-y-1 border border-charcoal-border/70 dark:border-[#2E2828]">
                      <span className="font-bold text-stone-700 dark:text-stone-200 text-[11px]">
                        {t.requiredIngredients}:
                      </span>
                      {run.ingredientsConsumed.map((c) => (
                        <span key={c.ingredientId} className="text-[11px] font-medium font-malayalam">
                          {c.ingredientName} ({c.actualQuantity} {c.unit})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Cancellation Reason if cancelled */}
                  {run.status === 'cancelled' && run.cancellationReason && (
                    <div className="text-xs text-stone-500 dark:text-stone-400 italic bg-stone-100 dark:bg-[#141212] p-2 rounded-lg border border-charcoal-border/50 dark:border-[#2E2828]">
                      Cancellation reason: {run.cancellationReason}
                    </div>
                  )}

                  {/* Notes if recorded */}
                  {run.notes && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic">"{run.notes}"</p>
                  )}

                  {/* Actions: Cancel Run and Delete Batch */}
                  <div className="flex items-center justify-between pt-1 border-t border-charcoal-border/40 dark:border-[#2E2828]/60">
                    {isCompleted ? (
                      <button
                        onClick={() => setRunToCancel(run)}
                        className="text-xs font-semibold text-stone-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors press-apple cursor-pointer"
                      >
                        <TbRotateClockwise2 className="w-3.5 h-3.5" />
                        <span>{t.cancelRun}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-stone-400 font-medium">
                        {language === 'ml' ? 'റദ്ദാക്കിയ ബാച്ച്' : 'Cancelled batch'}
                      </span>
                    )}

                    <button
                      onClick={() => setRunToDelete(run)}
                      className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors press-apple cursor-pointer"
                      title={language === 'ml' ? 'ബാച്ച് പൂർണ്ണമായി ഒഴിവാക്കുക' : 'Delete batch completely'}
                    >
                      <TbTrash className="w-3.5 h-3.5" />
                      <span>{language === 'ml' ? 'ബാച്ച് ഒഴിവാക്കുക' : 'Delete'}</span>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Production Wizard Modal */}
      <StartProductionModal
        isOpen={isStartProductionOpen}
        onClose={() => setIsStartProductionOpen(false)}
        products={products}
        recipes={recipes}
        ingredients={ingredients}
        isLoadingProducts={loading}
        onSuccess={(savedRun) => {
          if (savedRun) {
            setRuns((prev) => [savedRun, ...prev.filter((r) => r.id !== savedRun.id)]);
          }
          triggerRefresh();
        }}
      />

      {/* Cancel Run Dialog */}
      <ConfirmationDialog
        isOpen={!!runToCancel}
        onClose={() => {
          setRunToCancel(null);
          setCancelReason('');
        }}
        onConfirm={handleCancelRun}
        title={language === 'ml' ? 'പ്രൊഡക്ഷൻ റദ്ദാക്കുക' : 'Cancel Production Run'}
        confirmLabel={t.cancelRun}
        variant="danger"
        isLoading={isCancelling}
        message={
          <div className="space-y-3">
            <p className="text-xs text-stone-600 dark:text-stone-300">
              {t.cancelRunConfirm}
            </p>
            {runToCancel && (
              <div className="p-2.5 bg-stone-100 dark:bg-[#1E1B1B] rounded-xl text-xs font-semibold text-stone-800 dark:text-stone-200">
                Run #{runToCancel.runNumber} • {runToCancel.productName} ({runToCancel.actualQuantity} {runToCancel.unit})
              </div>
            )}
            <Input
              label={t.cancellationReason}
              placeholder={language === 'ml' ? 'ഉദാ: അളവ് തെറ്റായി രേഖപ്പെടുത്തി...' : 'e.g., Wrong quantity entered, batch spoiled...'}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              autoFocus
            />
          </div>
        }
      />

      {/* Delete Run Dialog */}
      <ConfirmationDialog
        isOpen={!!runToDelete}
        onClose={() => setRunToDelete(null)}
        onConfirm={handleDeleteRun}
        title={language === 'ml' ? 'പ്രൊഡക്ഷൻ ബാച്ച് പൂർണ്ണമായി ഒഴിവാക്കണോ?' : 'Delete Production Run Permanently?'}
        confirmLabel={language === 'ml' ? 'പൂർണ്ണമായി ഒഴിവാക്കുക' : 'Delete Permanently'}
        variant="danger"
        isLoading={isDeleting}
        message={
          <div className="space-y-3">
            <p className="text-xs text-stone-600 dark:text-stone-300 font-malayalam">
              {language === 'ml'
                ? 'ഈ പ്രൊഡക്ഷൻ ബാച്ച് ഡാറ്റാബേസിൽ നിന്നും റെക്കോർഡുകളിൽ നിന്നും പൂർണ്ണമായി ഒഴിവാക്കപ്പെടും. ഈ പ്രവർത്തനം പഴയപടിയാക്കാൻ കഴിയില്ല.'
                : 'This production run and its consumption records will be completely removed from the database. This action cannot be undone.'}
            </p>
            {runToDelete && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs font-bold text-red-900 dark:text-red-300 border border-red-200 dark:border-red-900">
                Run #{runToDelete.runNumber} • {runToDelete.productName} ({runToDelete.actualQuantity} {runToDelete.unit})
              </div>
            )}
          </div>
        }
      />
    </div>
  );
};
