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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  type ProductionFilter = 'all' | 'yesterday' | 'completed' | 'cancelled';
  const [activeFilter, setActiveFilter] = useState<ProductionFilter>('all');

  const todayRunsCount = useMemo(() => runs.filter((r) => r.productionDate === todayStr).length, [runs, todayStr]);
  const yesterdayRunsCount = useMemo(() => runs.filter((r) => r.productionDate === yesterdayStr).length, [runs, yesterdayStr]);

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

      if (activeFilter === 'yesterday') {
        return r.productionDate === yesterdayStr;
      }

      if (activeFilter === 'completed') {
        return r.status === 'completed' && r.productionDate !== yesterdayStr;
      }

      if (activeFilter === 'cancelled') {
        return r.status === 'cancelled';
      }

      // 'all' = Show today's and active production, explicitly excluding yesterday's production
      return r.productionDate !== yesterdayStr;
    });
  }, [runs, searchTerm, activeFilter, yesterdayStr]);

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

      {/* Production History & Operational Search */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          {/* Quick status tabs including dedicated Yesterday filter */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-[#1E1B1B] p-1 rounded-xl border border-charcoal-border/40 dark:border-[#2E2828] overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {language === 'ml' ? `ഇന്ന് (${todayRunsCount})` : `Today (${todayRunsCount})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap ${
                activeFilter === 'yesterday'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {language === 'ml' ? `ഇന്നലെ (${yesterdayRunsCount})` : `Yesterday (${yesterdayRunsCount})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap ${
                activeFilter === 'completed'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {t.runStatusCompleted}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('cancelled')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap ${
                activeFilter === 'cancelled'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {t.runStatusCancelled}
            </button>
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
              const batchPackings = packingRecords.filter(
                (p) =>
                  p.productionRunId === run.id ||
                  (p.notes && p.notes.includes(run.runNumber)) ||
                  (p.productId === run.productId && p.packingDate === run.productionDate)
              );

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
                          {batchPackings.reduce((sum, p) => sum + (p.packetsPacked || 0), 0)} {language === 'ml' ? 'പാക്കറ്റുകൾ' : 'pkts total'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {batchPackings.map((pkg) => (
                          <span
                            key={pkg.id}
                            className="inline-flex items-center gap-1 bg-white dark:bg-[#1E1B1B] text-stone-800 dark:text-stone-200 border border-charcoal-border/60 dark:border-[#2E2828] px-2 py-0.5 rounded-md font-semibold text-[11px]"
                          >
                            <span className="font-bold text-epso-red">{pkg.packetSize}:</span>
                            <span>{pkg.packetsPacked} pkts</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions: 3 Square Icon Buttons (Cancel Run, Add Packet, Delete) */}
                  <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/40 dark:border-[#2E2828]/60 gap-2">
                    <div className="text-[11px] font-semibold text-stone-400 dark:text-stone-500">
                      {run.status === 'cancelled' ? (
                        <span className="text-red-500 dark:text-red-400">
                          {language === 'ml' ? 'റദ്ദാക്കിയ ബാച്ച്' : 'Cancelled'}
                        </span>
                      ) : (
                        <span>
                          {language === 'ml' ? 'ബാച്ച് നടപടികൾ' : 'Actions'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 sm:gap-3.5">
                      {/* 1. Cancel Run Icon Box */}
                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={() => setRunToCancel(run)}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs"
                          title={language === 'ml' ? 'ബാച്ച് റദ്ദാക്കുക' : 'Cancel Run'}
                          aria-label="Cancel Run"
                        >
                          <TbRotateClockwise2 className="w-5 h-5 stroke-[2.2]" />
                        </button>
                      ) : (
                        <div
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-stone-100 dark:bg-[#1E1B1B] text-stone-300 dark:text-stone-700 border border-stone-200 dark:border-[#282323] flex items-center justify-center cursor-not-allowed opacity-40"
                          title={language === 'ml' ? 'ഇതിനകം റദ്ദാക്കി' : 'Already Cancelled'}
                        >
                          <TbRotateClockwise2 className="w-5 h-5" />
                        </div>
                      )}

                      {/* 2. Add Packet Icon Box */}
                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={() => setBatchForPacking(run)}
                          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-900/50 text-epso-orange border border-orange-200 dark:border-orange-900/50 flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs"
                          title={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}
                          aria-label="Add Packets"
                        >
                          <TbPackage className="w-5 h-5 stroke-[2.2]" />
                          {batchPackings.length === 0 && (
                            <span
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-epso-red text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-[#1E1B1B] leading-none select-none"
                              title={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർത്തിട്ടില്ല' : 'No packets added yet'}
                            >
                              !
                            </span>
                          )}
                        </button>
                      ) : (
                        <div
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-stone-100 dark:bg-[#1E1B1B] text-stone-300 dark:text-stone-700 border border-stone-200 dark:border-[#282323] flex items-center justify-center cursor-not-allowed opacity-40"
                        >
                          <TbPackage className="w-5 h-5" />
                        </div>
                      )}

                      {/* 3. Delete Batch Icon Box */}
                      <button
                        type="button"
                        onClick={() => setRunToDelete(run)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs"
                        title={language === 'ml' ? 'ബാച്ച് ഒഴിവാക്കുക' : 'Delete Batch'}
                        aria-label="Delete Batch"
                      >
                        <TbTrash className="w-5 h-5 stroke-[2.2]" />
                      </button>
                    </div>
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
