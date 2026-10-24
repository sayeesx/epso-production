import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { BatchCardSkeleton } from '../components/ui/BatchCardSkeleton';
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
  TbAlertTriangle,
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
  const [yesterdayOilClosing, setYesterdayOilClosing] = useState<DailyClosing | null>(null);
  const [packingRecords, setPackingRecords] = useState<PackingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Timezone-safe local date calculation
  const getLocalDateStr = (offsetDays = 0) => {
    const d = new Date();
    if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getLocalDateStr(0), []);
  const yesterdayStr = useMemo(() => getLocalDateStr(-1), []);
  const utcTodayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const utcYesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const isTodayDate = useCallback((date: string) => {
    return date === todayStr || (todayStr !== utcTodayStr && date === utcTodayStr);
  }, [todayStr, utcTodayStr]);

  const isYesterdayDate = useCallback((date: string) => {
    return date === yesterdayStr || (yesterdayStr !== utcYesterdayStr && date === utcYesterdayStr);
  }, [yesterdayStr, utcYesterdayStr]);

  // Filters - Default to 'today' so home page specifically shows today's batches
  const [searchTerm, setSearchTerm] = useState<string>('');
  type ProductionFilter = 'today' | 'yesterday' | 'completed' | 'cancelled' | 'all';
  const [activeFilter, setActiveFilter] = useState<ProductionFilter>('today');

  // Modals
  const [oilModalDate, setOilModalDate] = useState<string>(todayStr);
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
        const [rList, pList, recList, iList, oilCloseToday, oilCloseYesterday, packList] = await Promise.all([
          repo.listProductionRuns({ limit: 60 }),
          repo.listProducts(false),
          repo.listRecipes(),
          repo.listIngredients(false),
          repo.getDailyClosing(todayStr).catch(() => null),
          repo.getDailyClosing(yesterdayStr).catch(() => null),
          repo.listPackingRecords({ limit: 100 }).catch(() => []),
        ]);
        if (mounted) {
          setRuns(rList);
          setProducts(pList);
          setRecipes(recList);
          setIngredients(iList);
          setTodayOilClosing(oilCloseToday);
          setYesterdayOilClosing(oilCloseYesterday);
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
  }, [repo, dataVersion, addToast, todayStr, yesterdayStr]);

  // Helper to count packed packets for a batch
  const getBatchPacketsCount = useCallback((run: ProductionRun) => {
    const batchPackings = packingRecords.filter(
      (p) =>
        p.productionRunId === run.id ||
        (p.notes && p.notes.includes(run.runNumber)) ||
        (p.productId === run.productId && p.packingDate === run.productionDate)
    );
    return batchPackings.reduce((sum, p) => sum + (p.packetsPacked || 0), 0);
  }, [packingRecords]);

  // Helper to verify if oil has been logged
  const hasRecordedOil = useCallback((closing: DailyClosing | null) => {
    if (!closing) return false;
    return (
      Number(closing.oilConsumed || 0) > 0 ||
      Number(closing.oilClosingBalance || 0) > 0 ||
      closing.status === 'closed'
    );
  }, []);

  // Today runs and warning detection
  const todayRuns = useMemo(
    () => runs.filter((r) => isTodayDate(r.productionDate)),
    [runs, isTodayDate]
  );
  const todayRunsCount = todayRuns.length;
  const todayActiveRuns = useMemo(
    () => todayRuns.filter((r) => r.status !== 'cancelled'),
    [todayRuns]
  );
  const todayMissingPackets = useMemo(
    () => todayActiveRuns.filter((r) => getBatchPacketsCount(r) === 0),
    [todayActiveRuns, getBatchPacketsCount]
  );
  const todayMissingOil = useMemo(
    () => todayActiveRuns.length > 0 && !hasRecordedOil(todayOilClosing),
    [todayActiveRuns, hasRecordedOil, todayOilClosing]
  );
  const todayHasWarning = todayMissingPackets.length > 0 || todayMissingOil;

  // Yesterday runs and warning detection
  const yesterdayRuns = useMemo(
    () => runs.filter((r) => isYesterdayDate(r.productionDate)),
    [runs, isYesterdayDate]
  );
  const yesterdayRunsCount = yesterdayRuns.length;
  const yesterdayActiveRuns = useMemo(
    () => yesterdayRuns.filter((r) => r.status !== 'cancelled'),
    [yesterdayRuns]
  );
  const yesterdayMissingPackets = useMemo(
    () => yesterdayActiveRuns.filter((r) => getBatchPacketsCount(r) === 0),
    [yesterdayActiveRuns, getBatchPacketsCount]
  );
  const yesterdayMissingOil = useMemo(
    () => yesterdayActiveRuns.length > 0 && !hasRecordedOil(yesterdayOilClosing),
    [yesterdayActiveRuns, hasRecordedOil, yesterdayOilClosing]
  );
  const yesterdayHasWarning = yesterdayMissingPackets.length > 0 || yesterdayMissingOil;

  const filteredRuns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return runs.filter((r) => {
      const matchSearch =
        !q ||
        r.runNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.operatorName.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (activeFilter === 'today') {
        return isTodayDate(r.productionDate);
      }

      if (activeFilter === 'yesterday') {
        return isYesterdayDate(r.productionDate);
      }

      if (activeFilter === 'completed') {
        return r.status === 'completed';
      }

      if (activeFilter === 'cancelled') {
        return r.status === 'cancelled';
      }

      // 'all' = Show all production runs
      return true;
    });
  }, [runs, searchTerm, activeFilter, isTodayDate, isYesterdayDate]);

  // Batch number in chronological ascending order (Batch 1, 2, 3...)
  const batchNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    const byDate: Record<string, ProductionRun[]> = {};
    runs.forEach((r) => {
      const d = r.productionDate || 'default';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });

    Object.values(byDate).forEach((dateRuns) => {
      const sorted = [...dateRuns].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.productionDate).getTime();
        const timeB = new Date(b.createdAt || b.productionDate).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.runNumber.localeCompare(b.runNumber);
      });
      sorted.forEach((r, idx) => {
        map.set(r.id, idx + 1);
      });
    });
    return map;
  }, [runs]);

  // Show batch cards at top where packets are yet to be added, in ascending batch order
  const sortedRuns = useMemo(() => {
    const isPacketsPending = (run: ProductionRun) => {
      if (run.status === 'cancelled') return false;
      return getBatchPacketsCount(run) === 0;
    };

    return [...filteredRuns].sort((a, b) => {
      const aPending = isPacketsPending(a);
      const bPending = isPacketsPending(b);
      // Batches where packets are yet to be added go to the top
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // Within each group, display in ascending order of creation (Batch 1, 2, 3...)
      const numA = batchNumberMap.get(a.id) || 0;
      const numB = batchNumberMap.get(b.id) || 0;
      if (numA !== numB) return numA - numB;

      const timeA = new Date(a.createdAt || a.productionDate).getTime();
      const timeB = new Date(b.createdAt || b.productionDate).getTime();
      return timeA - timeB;
    });
  }, [filteredRuns, getBatchPacketsCount, batchNumberMap]);

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



  const handleOpenNewBatch = async () => {
    try {
      setIsOpeningNewBatch(true);
      // Proactively fetch latest recipes, products, and ingredients from Supabase
      const [freshRecipes, freshProducts, freshIngredients] = await Promise.all([
        repo.listRecipes(),
        repo.listProducts(false),
        repo.listIngredients(false),
      ]);
      if (freshRecipes && freshRecipes.length > 0) setRecipes(freshRecipes);
      if (freshProducts && freshProducts.length > 0) setProducts(freshProducts);
      if (freshIngredients && freshIngredients.length > 0) setIngredients(freshIngredients);
      setIsStartProductionOpen(true);
    } catch (err) {
      console.error('Failed to pre-fetch recipes before opening batch modal', err);
      setIsStartProductionOpen(true);
    } finally {
      setIsOpeningNewBatch(false);
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
            onClick={() => {
              setOilModalDate(activeFilter === 'yesterday' ? yesterdayStr : todayStr);
              setIsDailyOilModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95 press-apple cursor-pointer"
            title={language === 'ml' ? 'ദിവസത്തെ ഓയിൽ ഉപഭോഗവും ബാക്കിയും ചേർക്കുക' : 'Record daily oil consumed & leftover'}
          >
            <TbDroplet className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
            <span>{language === 'ml' ? 'ഓയിൽ ചേർക്കുക' : 'Record Oil'}</span>
          </button>

          <button
            onClick={handleOpenNewBatch}
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
          {/* Quick status tabs including dedicated Yesterday filter with warning */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-[#1E1B1B] p-1 rounded-xl border border-charcoal-border/40 dark:border-[#2E2828] overflow-x-auto no-scrollbar">
            {/* Today Tab */}
            <button
              type="button"
              onClick={() => setActiveFilter('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'today'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <span>{language === 'ml' ? `ഇന്ന് (${todayRunsCount})` : `Today (${todayRunsCount})`}</span>
              {todayHasWarning && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"
                  title={language === 'ml' ? 'പാക്കറ്റുകൾ അല്ലെങ്കിൽ ഓയിൽ ബാക്കിയുണ്ട്' : 'Missing packets or oil'}
                />
              )}
            </button>

            {/* Yesterday Tab */}
            <button
              type="button"
              onClick={() => setActiveFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeFilter === 'yesterday'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <span>{language === 'ml' ? `ഇന്നലെ (${yesterdayRunsCount})` : `Yesterday (${yesterdayRunsCount})`}</span>
              {yesterdayHasWarning && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[10px] font-black shrink-0"
                  title={language === 'ml' ? 'ഇന്നലത്തെ ബാച്ചുകളിൽ പാക്കറ്റുകൾ അല്ലെങ്കിൽ ഓയിൽ ബാക്കിയുണ്ട്' : 'Missing packets or oil'}
                >
                  <TbAlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>!</span>
                </span>
              )}
            </button>

            {/* Completed Tab */}
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

            {/* Cancelled Tab */}
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

            {/* All Tab */}
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all press-apple cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-[#282323] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {language === 'ml' ? `എല്ലാം (${runs.length})` : `All (${runs.length})`}
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

        {/* Yesterday Actionable Warning Banner */}
        {activeFilter === 'yesterday' && yesterdayHasWarning && (
          <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-3.5 sm:p-4 text-xs space-y-2 animate-in fade-in shadow-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-black text-sm">
                  ⚠️
                </span>
                <div>
                  <h4 className="font-extrabold text-amber-950 dark:text-amber-200 text-xs sm:text-sm">
                    {language === 'ml' ? 'ശ്രദ്ധിക്കുക: ഇന്നലത്തെ വിവരങ്ങൾ പൂർണ്ണമല്ല' : 'Warning: Incomplete Yesterday Records'}
                  </h4>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium">
                    {language === 'ml' ? 'സ്റ്റോക്കും കണക്കുകളും ശരിയാക്കാൻ താഴെ പറയുന്നവ പൂർത്തിയാക്കുക:' : 'Complete the pending records to balance inventory:'}
                  </p>
                </div>
              </div>

              {yesterdayMissingOil && (
                <button
                  type="button"
                  onClick={() => {
                    setOilModalDate(yesterdayStr);
                    setIsDailyOilModalOpen(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                >
                  <TbDroplet className="w-3.5 h-3.5" />
                  <span>{language === 'ml' ? 'ഇന്നലത്തെ ഓയിൽ ചേർക്കുക' : "Record Yesterday's Oil"}</span>
                </button>
              )}
            </div>

            <div className="space-y-1 text-amber-900 dark:text-amber-300/90 pl-9 font-medium text-[11px] sm:text-xs">
              {yesterdayMissingOil && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    {language === 'ml'
                      ? 'ഇന്നലത്തെ ദിവസേന ഓയിൽ ഉപയോഗം രേഖപ്പെടുത്തിയിട്ടില്ല.'
                      : "Yesterday's daily oil consumption has not been recorded."}
                  </span>
                </p>
              )}
              {yesterdayMissingPackets.length > 0 && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    {language === 'ml'
                      ? `${yesterdayMissingPackets.length} ബാച്ചുകളിൽ പാക്കറ്റ് എണ്ണം ചേർത്തിട്ടില്ല (ചുവടെ ബാച്ചിൽ 'Add Packets' ക്ലിക്ക് ചെയ്യുക).`
                      : `${yesterdayMissingPackets.length} batch(es) missing packet counts (click 'Add Packets' on each batch card below).`}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Today Actionable Warning Banner */}
        {activeFilter === 'today' && todayHasWarning && (
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-3 sm:p-3.5 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-xs">
                  ⚠️
                </span>
                <div>
                  <h4 className="font-extrabold text-amber-900 dark:text-amber-200 text-xs">
                    {language === 'ml' ? 'ഇന്നത്തെ നടപടികൾ പൂർത്തിയാക്കുക' : "Action Needed for Today's Batches"}
                  </h4>
                </div>
              </div>

              {todayMissingOil && (
                <button
                  type="button"
                  onClick={() => {
                    setOilModalDate(todayStr);
                    setIsDailyOilModalOpen(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                >
                  <TbDroplet className="w-3.5 h-3.5" />
                  <span>{language === 'ml' ? 'ഓയിൽ രേഖപ്പെടുത്തുക' : 'Record Oil'}</span>
                </button>
              )}
            </div>

            <div className="space-y-0.5 text-amber-900 dark:text-amber-300/90 pl-8 font-medium text-[11px]">
              {todayMissingOil && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    {language === 'ml'
                      ? 'ഇന്നത്തെ ഓയിൽ ഉപയോഗം രേഖപ്പെടുത്തിയിട്ടില്ല.'
                      : "Today's daily oil consumption has not been recorded."}
                  </span>
                </p>
              )}
              {todayMissingPackets.length > 0 && (
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    {language === 'ml'
                      ? `${todayMissingPackets.length} ബാച്ചുകളിൽ പാക്കറ്റ് എണ്ണം ചേർത്തിട്ടില്ല.`
                      : `${todayMissingPackets.length} batch(es) pending packet counts.`}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading state: skeleton shimmer effect */}
        {loading && (
          <div className="py-2">
            <BatchCardSkeleton count={4} />
          </div>
        )}

        {/* Honest Empty State when no records exist */}
        {!loading && sortedRuns.length === 0 && (
          <div className="bg-white dark:bg-[#1E1B1B] rounded-2xl border border-charcoal-border dark:border-[#2E2828] p-8 sm:p-12 text-center space-y-3 transition-colors">
            <div className="w-14 h-14 bg-stone-100 dark:bg-[#282323] text-stone-400 dark:text-stone-500 rounded-2xl flex items-center justify-center mx-auto">
              <TbHistory className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                {activeFilter === 'yesterday'
                  ? (language === 'ml' ? 'ഇന്നലെ ബാച്ചുകൾ ഒന്നും ചേർത്തിട്ടില്ല' : 'No batches recorded for yesterday')
                  : activeFilter === 'today'
                  ? (language === 'ml' ? 'ഇന്ന് ബാച്ചുകൾ ഒന്നും ആരംഭിച്ചിട്ടില്ല' : 'No batches recorded for today yet')
                  : t.noProductionRecordsYet}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {activeFilter === 'yesterday'
                  ? (language === 'ml'
                      ? 'ഇന്നലത്തെ തീയതിയിൽ യാതൊരു പ്രൊഡക്ഷൻ റണ്ണും കണ്ടെത്താനായില്ല.'
                      : 'No production runs were logged for yesterday.')
                  : (language === 'ml'
                      ? 'പ്രൊഡക്ഷൻ രേഖപ്പെടുത്താൻ താഴെയുള്ള "പുതിയ ബാച്ച്" ബട്ടൺ ഉപയോഗിക്കുക.'
                      : 'Click the "Start Production" button below to log your first production run.')}
              </p>
            </div>
            {activeFilter !== 'yesterday' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenNewBatch}
                disabled={isOpeningNewBatch}
                icon={isOpeningNewBatch ? <LoadingSpinner size="sm" /> : <TbPlus className="w-4 h-4" />}
              >
                {t.startProduction}
              </Button>
            )}
          </div>
        )}

        {/* Runs List */}
        {!loading && sortedRuns.length > 0 && (
          <div className="space-y-2.5">
            {sortedRuns.map((run) => {
              const isCompleted = run.status === 'completed';
              const batchPackings = packingRecords.filter(
                (p) =>
                  p.productionRunId === run.id ||
                  (p.notes && p.notes.includes(run.runNumber)) ||
                  (p.productId === run.productId && p.packingDate === run.productionDate)
              );
              const totalPacketsPacked = batchPackings.reduce((sum, p) => sum + (p.packetsPacked || 0), 0);
              const hasPackedPackets = totalPacketsPacked > 0;
              const batchOrderNumber = batchNumberMap.get(run.id) ?? 1;

              return (
                <Card
                  key={run.id}
                  padding="md"
                  className="hover:border-epso-red/40 dark:hover:border-epso-red/50 transition-all select-none space-y-3 press-apple"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 tabular-nums ${
                          isCompleted
                            ? hasPackedPackets
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-stone-100 dark:bg-[#282323] text-stone-500 line-through'
                        }`}
                        title={`Batch #${batchOrderNumber}`}
                      >
                        {batchOrderNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam">
                            {run.productName}
                          </h4>
                          {run.status === 'cancelled' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-stone-100 dark:bg-[#282323] text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 line-through">
                              {t.runStatusCancelled}
                            </span>
                          ) : hasPackedPackets ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              {t.runStatusCompleted}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 flex items-center gap-1 font-malayalam">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>{language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}</span>
                            </span>
                          )}
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
        initialDate={oilModalDate}
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
