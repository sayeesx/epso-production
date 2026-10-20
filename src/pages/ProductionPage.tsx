import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { StartProductionModal } from '../components/production/StartProductionModal';
import { DailyOilModal } from '../components/production/DailyOilModal';
import { BatchPackingModal } from '../components/production/BatchPackingModal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Product, Recipe, Ingredient, ProductionRun, PackingRecord, DailyClosing } from '../types';
import {
  TbSearch,
  TbPlus,
  TbRotateClockwise2,
  TbHistory,
  TbTrash,
  TbDroplet,
  TbPackage,
} from 'react-icons/tb';

export const ProductionPage: React.FC = () => {
  const { repo, dataVersion, triggerRefresh, addToast, staffName, isStartProductionOpen, setIsStartProductionOpen } = useApp();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();

  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [todayOilClosing, setTodayOilClosing] = useState<DailyClosing | null>(null);
  const [packingRecords, setPackingRecords] = useState<PackingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
  const [isDailyOilModalOpen, setIsDailyOilModalOpen] = useState<boolean>(false);
  const [batchForPacking, setBatchForPacking] = useState<ProductionRun | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const todayStr = new Date().toISOString().split('T')[0];
        const [rList, pList, recList, iList, oilClose, packList] = await Promise.all([
          repo.listProductionRuns({ limit: 40 }),
          repo.listProducts(false),
          repo.listRecipes(),
          repo.listIngredients(false),
          repo.getDailyClosing(todayStr).catch(() => null),
          repo.listPackingRecords({ limit: 60 }).catch(() => []),
        ]);
        if (mounted) {
          setRuns(rList);
          setProducts(pList);
          setRecipes(recList);
          setIngredients(iList);
          setTodayOilClosing(oilClose);
          setPackingRecords(packList || []);
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



  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Sleek header bar with prominent Epso logo */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap sm:flex-nowrap">
        <div className="flex items-center">
          <img
            src={isDark ? '/epso-logo-dark.png' : '/epso-logo-light.png'}
            alt="Epso Logo"
            className="h-[52px] sm:h-[64px] w-auto object-contain transition-opacity duration-200 select-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Daily Oil consumption & leftover button */}
          <button
            onClick={() => setIsDailyOilModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95 press-apple cursor-pointer"
            title={language === 'ml' ? 'ദിവസത്തെ ഓയിൽ ഉപഭോഗവും ബാക്കിയും ചേർക്കുക' : 'Record daily oil consumed & leftover'}
          >
            <TbDroplet className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
            <span>{language === 'ml' ? 'ഓയിൽ ചേർക്കുക' : 'Record Oil'}</span>
          </button>

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
      </div>

      {/* Today's oil status strip if recorded */}
      {todayOilClosing && (todayOilClosing.oilConsumed > 0 || todayOilClosing.oilClosingBalance > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <TbDroplet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-amber-900 dark:text-amber-200">
                {language === 'ml' ? 'ഇന്നത്തെ ഓയിൽ' : "Today's Oil"}:
              </span>{' '}
              <span className="font-bold text-amber-800 dark:text-amber-300">
                {language === 'ml' ? 'ഉപയോഗിച്ചത്' : 'Used'}: {todayOilClosing.oilConsumed} L
              </span>
              {todayOilClosing.oilClosingBalance > 0 && (
                <span className="text-amber-700/80 dark:text-amber-400/80 ml-2">
                  • {language === 'ml' ? 'ബാക്കി' : 'Leftover'}: {todayOilClosing.oilClosingBalance} L
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsDailyOilModalOpen(true)}
            className="text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:underline cursor-pointer shrink-0"
          >
            {language === 'ml' ? 'മാറ്റുക' : 'Edit'}
          </button>
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

        {/* Loading state: clean loading spinner loader */}
        {loading && (
          <div className="py-16 flex justify-center items-center">
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
              const batchPackings = packingRecords.filter((p) => p.productionRunId === run.id);

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

                  {/* Packed packets summary for this batch */}
                  {batchPackings.length > 0 && (
                    <div className="bg-stone-50 dark:bg-[#141212] rounded-xl p-2.5 text-xs border border-charcoal-border/70 dark:border-[#2E2828] space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-stone-700 dark:text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <TbPackage className="w-3.5 h-3.5 text-epso-orange" />
                          {language === 'ml' ? 'പാക്ക് ചെയ്തവ' : 'Packed Quantities'}:
                        </span>
                        <span className="text-stone-500 font-normal">
                          {batchPackings.reduce((sum, p) => sum + p.quantityPacked, 0)} {language === 'ml' ? 'പാക്കറ്റുകൾ' : 'pkts total'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {batchPackings.map((pkg) => (
                          <span
                            key={pkg.id}
                            className="inline-flex items-center gap-1 bg-white dark:bg-[#1E1B1B] text-stone-800 dark:text-stone-200 border border-charcoal-border/60 dark:border-[#2E2828] px-2 py-0.5 rounded-md font-semibold text-[11px]"
                          >
                            <span className="font-bold text-epso-red">{pkg.packetSize}:</span>
                            <span>{pkg.quantityPacked} pkts</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions: Add Packets, Cancel Run and Delete Batch */}
                  <div className="flex items-center justify-between pt-1 border-t border-charcoal-border/40 dark:border-[#2E2828]/60 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
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

                      {/* Add Packets Button on batch */}
                      {isCompleted && (
                        <button
                          onClick={() => setBatchForPacking(run)}
                          className="text-xs font-bold text-stone-700 dark:text-stone-200 bg-stone-100 hover:bg-stone-200 dark:bg-[#282323] dark:hover:bg-[#342e2e] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all press-apple cursor-pointer border border-charcoal-border/40 dark:border-[#2E2828]"
                          title={language === 'ml' ? 'ഈ ബാച്ചിൽ പാക്കറ്റുകൾ ചേർക്കുക' : 'Add packets for this batch'}
                        >
                          <TbPackage className="w-3.5 h-3.5 text-epso-orange" />
                          <span>{language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}</span>
                        </button>
                      )}
                    </div>

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
      {/* Daily Oil Modal */}
      <DailyOilModal
        isOpen={isDailyOilModalOpen}
        onClose={() => setIsDailyOilModalOpen(false)}
        onSuccess={() => {
          triggerRefresh();
        }}
      />

      {/* Batch Packing Modal */}
      <BatchPackingModal
        isOpen={!!batchForPacking}
        batch={batchForPacking}
        onClose={() => setBatchForPacking(null)}
        onSuccess={() => {
          triggerRefresh();
        }}
      />
    </div>
  );
};
