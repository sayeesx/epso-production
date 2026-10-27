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
import { BasicIngredientsSelectorModal } from '../components/production/BasicIngredientsSelectorModal';
import { BasicIngredientMeasurementModal } from '../components/production/BasicIngredientMeasurementModal';
import { Modal } from '../components/ui/Modal';
import { Product, Recipe, Ingredient, ProductionRun, PackingRecord, DailyClosing } from '../types';
import {
  TbSearch,
  TbPlus,
  TbHistory,
  TbTrash,
  TbDroplet,
  TbPackage,
  TbAlertTriangle,
  TbCheck,
  TbAlertCircle,
  TbPencil,
  TbToolsKitchen2,
} from 'react-icons/tb';

// 3D Rotating Warning Message Cube (transforms across X-axis every 2.8s in a loop)
const Rotating3DWarning: React.FC<{ items: string[] }> = ({ items }) => {
  const [index, setIndex] = useState<number>(0);
  const [animating, setAnimating] = useState<boolean>(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % items.length);
        setAnimating(false);
      }, 700);
    }, 2800);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const currentItem = items[index % items.length];
  const nextItem = items[(index + 1) % items.length];

  return (
    <div className="relative h-6 w-full overflow-hidden [perspective:400px] select-none">
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: animating ? 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          transform: animating ? 'rotateX(90deg)' : 'rotateX(0deg)',
        }}
      >
        <div
          className="absolute inset-0 flex items-center"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(12px)',
          }}
        >
          <p className="font-extrabold text-amber-950 dark:text-amber-200 text-[11px] sm:text-xs truncate font-malayalam leading-tight">
            {currentItem}
          </p>
        </div>
        <div
          className="absolute inset-0 flex items-center"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateX(-90deg) translateZ(12px)',
          }}
        >
          <p className="font-extrabold text-amber-950 dark:text-amber-200 text-[11px] sm:text-xs truncate font-malayalam leading-tight">
            {nextItem}
          </p>
        </div>
      </div>
    </div>
  );
};

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

  // Format YYYY-MM-DD or ISO string to DD-MM-YYYY
  const formatBatchDate = (dStr: string) => {
    if (!dStr) return '';
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}-${m}-${y}`;
    }
    return clean;
  };

  const isKitchenStaffDefault = (name?: string) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    return (
      lower.includes('kitchen staff') ||
      lower.includes('production team') ||
      name.includes('പ്രൊഡക്ഷൻ ടീം') ||
      lower === 'staff'
    );
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
  const [runToDelete, setRunToDelete] = useState<ProductionRun | null>(null);
  const [runToEdit, setRunToEdit] = useState<ProductionRun | null>(null);
  const [isBasicSelectorOpen, setIsBasicSelectorOpen] = useState<boolean>(false);
  const [measuringBasicIngredient, setMeasuringBasicIngredient] = useState<Ingredient | null>(null);
  const [restockChoice, setRestockChoice] = useState<'yes' | 'no'>('yes');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isOpeningNewBatch, setIsOpeningNewBatch] = useState<boolean>(false);
  const [isDailyOilModalOpen, setIsDailyOilModalOpen] = useState<boolean>(false);
  const [batchForPacking, setBatchForPacking] = useState<ProductionRun | null>(null);

  // Basic ingredients tracking state (Salt, Cashew shell, Chippli, Curry leaves)
  const [recordedBasics, setRecordedBasics] = useState<Record<string, string[]>>(() => {
    try {
      const todaySaved = JSON.parse(localStorage.getItem(`epso_basic_${todayStr}`) || '[]');
      const yestSaved = JSON.parse(localStorage.getItem(`epso_basic_${yesterdayStr}`) || '[]');
      return { [todayStr]: todaySaved, [yesterdayStr]: yestSaved };
    } catch {
      return {};
    }
  });

  const markBasicAsRecorded = useCallback((date: string, ingredientOrKey: Ingredient | string) => {
    let key = '';
    if (typeof ingredientOrKey === 'string') {
      key = ingredientOrKey;
    } else {
      const name = ingredientOrKey.name.toLowerCase();
      if (name.includes('ഓയിൽ') || name.includes('oil')) key = 'oil';
      else if (name.includes('ഉപ്പ്') || (name.includes('salt') && !name.includes('black'))) key = 'salt';
      else if (name.includes('അണ്ടി തോട്') || name.includes('തോട്') || name.includes('shell') || name.includes('cashew')) key = 'cashew_shell';
      else if (name.includes('ചിപ്പ്ളി') || name.includes('chippli')) key = 'chippli';
      else if (name.includes('കറിവേപ്പില') || name.includes('curry')) key = 'curry_leaves';
    }

    if (key) {
      setRecordedBasics((prev) => {
        const cur = prev[date] || [];
        if (!cur.includes(key)) {
          const updated = [...cur, key];
          try {
            localStorage.setItem(`epso_basic_${date}`, JSON.stringify(updated));
          } catch {}
          return { ...prev, [date]: updated };
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const [rList, pList, recList, iList, oilCloseToday, oilCloseYesterday, packList, movements] = await Promise.all([
          repo.listProductionRuns({ limit: 60 }),
          repo.listProducts(false),
          repo.listRecipes(),
          repo.listIngredients(false),
          repo.getDailyClosing(todayStr).catch(() => null),
          repo.getDailyClosing(yesterdayStr).catch(() => null),
          repo.listPackingRecords({ limit: 100 }).catch(() => []),
          repo.getStockMovements({ limit: 100 }).catch(() => []),
        ]);
        if (mounted) {
          setRuns(rList);
          setProducts(pList);
          setRecipes(recList);
          setIngredients(iList);
          setTodayOilClosing(oilCloseToday);
          setYesterdayOilClosing(oilCloseYesterday);
          setPackingRecords(packList || []);

          if (movements && movements.length > 0) {
            const detectedToday: string[] = [];
            const detectedYesterday: string[] = [];

            for (const m of movements) {
              const mDate = m.createdAt ? m.createdAt.split('T')[0] : '';
              const r = (m.reason || '').toLowerCase();
              const n = (m.itemName || '').toLowerCase();

              let key = '';
              if (n.includes('ഉപ്പ്') || (n.includes('salt') && !n.includes('black'))) key = 'salt';
              else if (n.includes('അണ്ടി തോട്') || n.includes('തോട്') || n.includes('shell') || n.includes('cashew')) key = 'cashew_shell';
              else if (n.includes('ചിപ്പ്ളി') || n.includes('chippli')) key = 'chippli';
              else if (n.includes('കറിവേപ്പില') || n.includes('curry')) key = 'curry_leaves';

              if (key) {
                if (mDate === todayStr || r.includes(todayStr)) {
                  if (!detectedToday.includes(key)) detectedToday.push(key);
                }
                if (mDate === yesterdayStr || r.includes(yesterdayStr)) {
                  if (!detectedYesterday.includes(key)) detectedYesterday.push(key);
                }
              }
            }

            setRecordedBasics((prev) => {
              const mergedToday = Array.from(new Set([...(prev[todayStr] || []), ...detectedToday]));
              const mergedYesterday = Array.from(new Set([...(prev[yesterdayStr] || []), ...detectedYesterday]));
              return { ...prev, [todayStr]: mergedToday, [yesterdayStr]: mergedYesterday };
            });
          }
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
        p.productionRunId
          ? p.productionRunId === run.id
          : Boolean(p.notes && p.notes.includes(run.runNumber))
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

  // Missing basic ingredients for the active filter date
  const isYesterday = activeFilter === 'yesterday';
  const activeDate = isYesterday ? yesterdayStr : todayStr;
  const activeClosing = isYesterday ? yesterdayOilClosing : todayOilClosing;
  const recordedKeysForActiveDate = recordedBasics[activeDate] || [];

  const missingBasicItems = useMemo(() => {
    const activeDateRuns = runs.filter((r) =>
      isYesterday ? isYesterdayDate(r.productionDate) : isTodayDate(r.productionDate)
    ).filter((r) => r.status !== 'cancelled');

    if (activeDateRuns.length === 0) return [];

    const list: string[] = [];
    const isOilRecorded = hasRecordedOil(activeClosing) || recordedKeysForActiveDate.includes('oil');

    if (!isOilRecorded) {
      list.push(
        language === 'ml'
          ? (isYesterday ? 'ഇന്നലത്തെ ഓയിൽ ഉപയോഗം രേഖപ്പെടുത്തിയിട്ടില്ല' : 'ഇന്നത്തെ ഓയിൽ ഉപയോഗം രേഖപ്പെടുത്തിയിട്ടില്ല')
          : (isYesterday ? "Yesterday's oil has not been recorded" : "Today's oil has not been recorded")
      );
    }
    if (!recordedKeysForActiveDate.includes('salt')) {
      list.push(
        language === 'ml'
          ? (isYesterday ? 'ഇന്നലത്തെ ഉപ്പ് രേഖപ്പെടുത്തിയിട്ടില്ല' : 'ഇന്നത്തെ ഉപ്പ് രേഖപ്പെടുത്തിയിട്ടില്ല')
          : (isYesterday ? "Yesterday's salt has not been recorded" : "Today's salt has not been recorded")
      );
    }
    if (!recordedKeysForActiveDate.includes('cashew_shell')) {
      list.push(
        language === 'ml'
          ? (isYesterday ? 'ഇന്നലത്തെ അണ്ടി തോട് രേഖപ്പെടുത്തിയിട്ടില്ല' : 'ഇന്നത്തെ അണ്ടി തോട് രേഖപ്പെടുത്തിയിട്ടില്ല')
          : (isYesterday ? "Yesterday's cashew shell has not been recorded" : "Today's cashew shell has not been recorded")
      );
    }
    if (!recordedKeysForActiveDate.includes('chippli')) {
      list.push(
        language === 'ml'
          ? (isYesterday ? 'ഇന്നലത്തെ ചിപ്പ്ളി പൊടി രേഖപ്പെടുത്തിയിട്ടില്ല' : 'ഇന്നത്തെ ചിപ്പ്ളി പൊടി രേഖപ്പെടുത്തിയിട്ടില്ല')
          : (isYesterday ? "Yesterday's chippli powder has not been recorded" : "Today's chippli powder has not been recorded")
      );
    }
    if (!recordedKeysForActiveDate.includes('curry_leaves')) {
      list.push(
        language === 'ml'
          ? (isYesterday ? 'ഇന്നലത്തെ കറിവേപ്പില രേഖപ്പെടുത്തിയിട്ടില്ല' : 'ഇന്നത്തെ കറിവേപ്പില രേഖപ്പെടുത്തിയിട്ടില്ല')
          : (isYesterday ? "Yesterday's curry leaves have not been recorded" : "Today's curry leaves have not been recorded")
      );
    }

    const missingPacketsCount = (isYesterday ? yesterdayMissingPackets : todayMissingPackets).length;
    if (missingPacketsCount > 0) {
      list.push(
        language === 'ml'
          ? `${missingPacketsCount} ബാച്ചുകളിൽ പാക്കറ്റ് എണ്ണം ചേർത്തിട്ടില്ല`
          : `${missingPacketsCount} batch(es) pending packet counts`
      );
    }

    return list;
  }, [runs, activeClosing, isYesterday, isYesterdayDate, isTodayDate, recordedKeysForActiveDate, language, hasRecordedOil, yesterdayMissingPackets, todayMissingPackets]);

  const todayHasWarning = todayMissingPackets.length > 0 || (activeFilter === 'today' ? missingBasicItems.length > 0 : todayMissingOil);
  const yesterdayHasWarning = yesterdayMissingPackets.length > 0 || (activeFilter === 'yesterday' ? missingBasicItems.length > 0 : yesterdayMissingOil);

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
      const rec = recipes.find((r) => r.id === run.recipeId || r.productId === run.productId);
      const assigned = rec?.packets && rec.packets.length > 0 ? rec.packets : [];
      if (assigned.length === 0) return true;
      const packings = packingRecords.filter((p) =>
        p.productionRunId ? p.productionRunId === run.id : Boolean(p.notes && p.notes.includes(run.runNumber))
      );
      const packedSet = new Set(packings.filter((p) => (p.packetsPacked || 0) > 0).map((p) => p.packetSize));
      return !assigned.every((p) => packedSet.has(p.packetName));
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
  }, [filteredRuns, recipes, packingRecords, batchNumberMap]);


  const handleDeleteRun = async (restock: boolean) => {
    if (!runToDelete) return;
    try {
      setIsDeleting(true);
      await repo.deleteProductionRun({
        runId: runToDelete.id,
        restock,
        operatorName: staffName,
        reason: restock ? 'restocked' : 'wastage',
      });

      // Update local state to show run as deleted/cancelled in grey with restock or wastage
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runToDelete.id
            ? {
                ...r,
                status: 'cancelled' as const,
                cancellationReason: restock ? 'restocked' : 'wastage',
                cancelledAt: new Date().toISOString(),
                cancelledBy: staffName,
              }
            : r
        )
      );

      // Refresh live ingredients stock immediately
      try {
        const freshIngredients = await repo.listIngredients(false);
        if (freshIngredients && freshIngredients.length > 0) {
          setIngredients(freshIngredients);
        }
      } catch (e) {
        console.error('Error refreshing live ingredient stock', e);
      }

      addToast(
        restock
          ? language === 'ml'
            ? `${runToDelete.productName} ബാച്ച് ഒഴിവാക്കി, ചേരുവകൾ സ്റ്റോക്കിലേക്ക് മാറ്റി`
            : `Batch deleted & ingredients restocked (${runToDelete.productName})`
          : language === 'ml'
            ? `${runToDelete.productName} ബാച്ച് വേസ്റ്റേജ് ആയി ഒഴിവാക്കി`
            : `Batch deleted as wastage (${runToDelete.productName})`,
        'success'
      );

      setRunToDelete(null);
      setRestockChoice('yes');
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

  const handleEditBatch = async (run: ProductionRun) => {
    try {
      const [freshRecipes, freshProducts, freshIngredients] = await Promise.all([
        repo.listRecipes(),
        repo.listProducts(false),
        repo.listIngredients(false),
      ]);
      if (freshRecipes && freshRecipes.length > 0) setRecipes(freshRecipes);
      if (freshProducts && freshProducts.length > 0) setProducts(freshProducts);
      if (freshIngredients && freshIngredients.length > 0) setIngredients(freshIngredients);
    } catch (err) {
      console.error('Failed to pre-fetch recipes before editing batch', err);
    }
    setRunToEdit(run);
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
          {/* Add Basic ingredients button (replaces Add Oil) */}
          <button
            onClick={() => {
              setOilModalDate(activeFilter === 'yesterday' ? yesterdayStr : todayStr);
              setIsBasicSelectorOpen(true);
            }}
            className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold px-3 py-2.5 rounded-xl transition-all active:scale-95 press-apple cursor-pointer"
            title={language === 'ml' ? 'ബേസിക് ചേരുവകൾ ചേർക്കുക (ഓയിൽ, ഉപ്പ്, അണ്ടി തോട്, ചിപ്പ്ളി പൊടി, കറിവേപ്പില)' : 'Add basic ingredients (Oil, Salt, Cashew shell, Chippli, Curry leaves)'}
          >
            <TbToolsKitchen2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{language === 'ml' ? 'ബേസിക് ചേർക്കുക' : 'Add Basic'}</span>
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

        {/* Actionable 3D Rotating Warning Banner for Basic Ingredients & Missing Packets */}
        {(activeFilter === 'today' || activeFilter === 'yesterday') && missingBasicItems.length > 0 && (
          <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/60 rounded-xl px-3 sm:px-3.5 py-2 text-xs flex items-center justify-between gap-2.5 animate-in fade-in shadow-2xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0 text-sm">⚠️</span>
              <Rotating3DWarning items={missingBasicItems} />
            </div>

            <button
              type="button"
              onClick={() => {
                setOilModalDate(activeFilter === 'yesterday' ? yesterdayStr : todayStr);
                setIsBasicSelectorOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <TbToolsKitchen2 className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'ബേസിക് ചേർക്കുക' : 'Add Basic'}</span>
            </button>
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
              const isDeleted = run.status === 'cancelled';
              const isRestocked = isDeleted && (run.cancellationReason?.toLowerCase().includes('restock') ?? false);

              const batchRecipe = recipes.find((r) => r.id === run.recipeId || r.productId === run.productId);
              const assignedPackets = batchRecipe?.packets && batchRecipe.packets.length > 0 ? batchRecipe.packets : [];
              const totalExpectedPackets = assignedPackets.length;

              const batchPackings = packingRecords.filter(
                (p) =>
                  p.productionRunId
                    ? p.productionRunId === run.id
                    : Boolean(p.notes && p.notes.includes(run.runNumber))
              );

              // Group packets by packetSize to eliminate duplicate badges on cards
              const packingsGroupMap = new Map<string, number>();
              batchPackings.forEach((p) => {
                packingsGroupMap.set(
                  p.packetSize,
                  (packingsGroupMap.get(p.packetSize) || 0) + (p.packetsPacked || 0)
                );
              });
              const groupedBatchPackings = Array.from(packingsGroupMap.entries()).map(
                ([packetSize, packetsPacked]) => ({ packetSize, packetsPacked })
              );

              const totalPacketsPacked = batchPackings.reduce((sum, p) => sum + (p.packetsPacked || 0), 0);
              const hasPackedPackets = totalPacketsPacked > 0;

              // Unique packet sizes that have been packed for this batch:
              const packedSizesSet = new Set(
                groupedBatchPackings.filter((p) => p.packetsPacked > 0).map((p) => p.packetSize)
              );
              const packedTypesCount = totalExpectedPackets > 0
                ? assignedPackets.filter((p) => packedSizesSet.has(p.packetName)).length
                : (hasPackedPackets ? 1 : 0);

              // ONLY set completed when all assigned packets are added:
              const isAllPacketsAdded = totalExpectedPackets > 0
                ? packedTypesCount >= totalExpectedPackets
                : false;

              const isWarningYellow = !isAllPacketsAdded;
              const batchOrderNumber = batchNumberMap.get(run.id) ?? 1;

              return (
                <Card
                  key={run.id}
                  padding="md"
                  className={`transition-all select-none space-y-3 press-apple ${
                    isDeleted
                      ? 'bg-stone-100/70 dark:bg-[#181515] border-stone-200 dark:border-[#282323] opacity-75'
                      : isWarningYellow
                      ? 'hover:border-yellow-400/60 dark:hover:border-yellow-500/60 border-yellow-200/50 dark:border-yellow-900/30'
                      : 'hover:border-epso-red/40 dark:hover:border-epso-red/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shrink-0 tabular-nums shadow-xs ${
                          isDeleted
                            ? 'bg-stone-200/80 dark:bg-[#282323] text-stone-400 dark:text-stone-500 line-through'
                            : isAllPacketsAdded
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 ring-2 ring-yellow-400/40'
                        }`}
                        title={`Batch #${batchOrderNumber}`}
                      >
                        {batchOrderNumber}
                      </div>
                      <div>
                        <h4
                          className={`text-sm sm:text-base font-extrabold leading-tight font-malayalam ${
                            isDeleted ? 'text-stone-400 dark:text-stone-500 line-through' : 'text-stone-900 dark:text-white'
                          }`}
                        >
                          {run.productName}
                        </h4>
                        <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-1">
                          {formatBatchDate(run.productionDate)}
                          {!isKitchenStaffDefault(run.operatorName) ? ` • ${run.operatorName}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-black ${
                          isDeleted ? 'text-stone-400 dark:text-stone-500 line-through' : 'text-stone-900 dark:text-white'
                        }`}
                      >
                        {run.actualQuantity} {run.unit}
                      </span>
                      <p className="text-[10px] font-semibold text-stone-400">output</p>
                    </div>
                  </div>

                  {/* Deletion Info if deleted */}
                  {isDeleted && (
                    <div className="text-xs text-stone-500 dark:text-stone-400 bg-stone-200/50 dark:bg-[#141212] p-2.5 rounded-lg border border-charcoal-border/50 dark:border-[#2E2828] flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-malayalam">
                        <TbAlertCircle className={`w-4 h-4 shrink-0 ${isRestocked ? 'text-emerald-500' : 'text-amber-500'}`} />
                        <span>
                          {language === 'ml' ? 'ബാച്ച് ഒഴിവാക്കി:' : 'Batch Deleted:'}{' '}
                          <strong className="font-semibold text-stone-700 dark:text-stone-300">
                            {isRestocked
                              ? (language === 'ml' ? 'സ്റ്റോക്ക് തിരികെ ചേർത്തു (Restocked)' : 'Ingredients Restocked')
                              : (language === 'ml' ? 'വേസ്റ്റേജ് ആയി രേഖപ്പെടുത്തി (Wastage)' : 'Marked as Wastage')}
                          </strong>
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Notes if recorded and not deleted */}
                  {!isDeleted && run.notes && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic">"{run.notes}"</p>
                  )}

                  {/* Packed packets summary for this batch */}
                  {!isDeleted && batchPackings.length > 0 && (
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
                        {groupedBatchPackings.map((pkg) => (
                          <span
                            key={pkg.packetSize}
                            className="inline-flex items-center gap-1 bg-white dark:bg-[#1E1B1B] text-stone-800 dark:text-stone-200 border border-charcoal-border/60 dark:border-[#2E2828] px-2 py-0.5 rounded-md font-semibold text-[11px]"
                          >
                            <span className="font-bold text-epso-red">{pkg.packetSize}:</span>
                            <span>{pkg.packetsPacked} pkts</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar: Status Badge (Add / Completed / Restocked / Wastage) & Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-charcoal-border/40 dark:border-[#2E2828]/60 gap-2">
                    <div className="flex items-center">
                      {isDeleted ? (
                        isRestocked ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 font-malayalam">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>{language === 'ml' ? 'ഒഴിവാക്കി (Restocked)' : 'Deleted (Restocked)'}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 flex items-center gap-1.5 font-malayalam">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>{language === 'ml' ? 'ഒഴിവാക്കി (Wastage)' : 'Deleted (Wastage)'}</span>
                          </span>
                        )
                      ) : isAllPacketsAdded ? (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 font-malayalam">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{language === 'ml' ? 'പൂർത്തിയായി' : 'Completed'}</span>
                        </span>
                      ) : (
                        /* Warning yellow button when not all packets are added */
                        <button
                          type="button"
                          onClick={() => setBatchForPacking(run)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/60 dark:hover:bg-yellow-900/60 text-yellow-900 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600/80 flex items-center gap-1.5 font-malayalam transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                          title={language === 'ml' ? 'ചേർക്കുക' : 'Add'}
                        >
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                          <span>
                            {totalExpectedPackets > 0 && packedTypesCount > 0
                              ? language === 'ml'
                                ? `ചേർക്കുക (${packedTypesCount}/${totalExpectedPackets})`
                                : `Add (${packedTypesCount}/${totalExpectedPackets})`
                              : language === 'ml'
                              ? 'ചേർക്കുക'
                              : 'Add'}
                          </span>
                        </button>
                      )}
                    </div>


                    {!isDeleted && (
                      <div className="flex items-center gap-3 sm:gap-3.5">
                        {/* 1. Add Packet Icon Box - Warning Yellow when not all packets added */}
                        <button
                          type="button"
                          onClick={() => setBatchForPacking(run)}
                          className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs ${
                            isWarningYellow
                              ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/60 dark:hover:bg-yellow-900/70 text-yellow-800 dark:text-yellow-200 border-2 border-yellow-400 dark:border-yellow-600/80 ring-2 ring-yellow-400/40'
                              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                          }`}
                          title={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}
                          aria-label={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}
                        >
                          <TbPackage className="w-5 h-5 stroke-[2.2]" />
                          {isWarningYellow && (
                            <span
                              className="absolute -top-1.5 -right-1.5 px-1 min-w-[18px] h-4 rounded-full bg-yellow-500 text-stone-950 text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-[#1E1B1B] leading-none select-none"
                              title={
                                totalExpectedPackets > 0
                                  ? `${packedTypesCount} of ${totalExpectedPackets} packet types added`
                                  : 'Packets not completed'
                              }
                            >
                              {totalExpectedPackets > 0 && packedTypesCount > 0
                                ? `${packedTypesCount}/${totalExpectedPackets}`
                                : '!'}
                            </span>
                          )}
                        </button>

                        {/* 2. Edit Batch Icon Box - opens multi-step wizard from step 2 to 4 */}
                        <button
                          type="button"
                          onClick={() => handleEditBatch(run)}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs"
                          title={language === 'ml' ? 'ബാച്ച് തിരുത്തുക' : 'Edit Batch'}
                          aria-label="Edit Batch"
                        >
                          <TbPencil className="w-5 h-5 stroke-[2.2]" />
                        </button>

                        {/* 3. Delete Batch Icon Box (With Restock vs Wastage Prompt) - Only shown if NOT completed */}
                        {!hasPackedPackets && (
                          <button
                            type="button"
                            onClick={() => {
                              setRestockChoice('yes');
                              setRunToDelete(run);
                            }}
                            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-center justify-center transition-all press-apple cursor-pointer shadow-xs"
                            title={language === 'ml' ? 'ബാച്ച് ഒഴിവാക്കുക' : 'Delete Batch'}
                            aria-label="Delete Batch"
                          >
                            <TbTrash className="w-5 h-5 stroke-[2.2]" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Production Wizard Modal */}
      <StartProductionModal
        isOpen={isStartProductionOpen || Boolean(runToEdit)}
        onClose={() => {
          setIsStartProductionOpen(false);
          setRunToEdit(null);
        }}
        runToEdit={runToEdit}
        products={products}
        recipes={recipes}
        ingredients={ingredients}
        isLoadingProducts={loading}
        onSuccess={async (savedRun) => {
          if (savedRun) {
            setRuns((prev) => {
              const exists = prev.some((r) => r.id === savedRun.id);
              if (exists) {
                return prev.map((r) => (r.id === savedRun.id ? savedRun : r));
              }
              return [savedRun, ...prev];
            });
          }
          setIsStartProductionOpen(false);
          setRunToEdit(null);
          try {
            const freshIngredients = await repo.listIngredients(false);
            if (freshIngredients && freshIngredients.length > 0) {
              setIngredients(freshIngredients);
            }
          } catch (e) {
            console.error('Error refreshing live ingredient stock', e);
          }
          triggerRefresh();
        }}
      />

      {/* Delete Batch Modal with Restock vs Wastage Option */}
      <Modal
        isOpen={!!runToDelete}
        onClose={() => {
          if (!isDeleting) {
            setRunToDelete(null);
            setRestockChoice('yes');
          }
        }}
        title={
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <TbTrash className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white leading-tight font-malayalam">
                {language === 'ml' ? 'ബാച്ച് ഒഴിവാക്കുക' : 'Delete Production Batch'}
              </h3>
              {runToDelete && (
                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium font-malayalam">
                  {runToDelete.productName} ({runToDelete.actualQuantity} {runToDelete.unit})
                </p>
              )}
            </div>
          </div>
        }
        size="md"
      >
        {runToDelete && (
          <div className="space-y-4 py-1">
            {/* Batch Info Card - NO #PRD- NUMBER */}
            <div className="p-3 bg-stone-100/80 dark:bg-[#252020] rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">
                  {runToDelete.productName}
                </h4>
                <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mt-0.5">
                  {formatBatchDate(runToDelete.productionDate)}
                  {!isKitchenStaffDefault(runToDelete.operatorName) ? ` • ${runToDelete.operatorName}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-stone-900 dark:text-white font-sans">
                  {runToDelete.actualQuantity} {runToDelete.unit}
                </span>
                <p className="text-[10px] font-bold text-stone-400">output</p>
              </div>
            </div>

            {/* Restock Question */}
            <div className="space-y-2">
              <label className="text-xs font-black text-stone-900 dark:text-white font-malayalam uppercase tracking-wider block">
                {language === 'ml'
                  ? 'ചേരുവകൾ (Ingredients) വീണ്ടും സ്റ്റോക്കിലേക്ക് ചേർക്കണോ?'
                  : 'Do you wish to restock the ingredients?'}
              </label>

              {/* Option 1: Yes, Restock Ingredients */}
              <div
                onClick={() => setRestockChoice('yes')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${
                  restockChoice === 'yes'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                    : 'border-stone-200 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-emerald-400/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    restockChoice === 'yes'
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-stone-300 dark:border-stone-600 bg-transparent'
                  }`}
                >
                  {restockChoice === 'yes' && <TbCheck className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-stone-900 dark:text-white font-malayalam block">
                    {language === 'ml' ? 'അതെ, ചേരുവകൾ സ്റ്റോക്കിലേക്ക് ചേർക്കുക' : 'Yes, Restock Ingredients'}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium font-malayalam block mt-0.5">
                    {language === 'ml'
                      ? 'ചേരുവകൾ തിരികെ സ്റ്റോക്കിലേക്ക് ചേർക്കും, എന്നാൽ നിർമ്മിച്ച ഉൽപ്പന്നം സ്റ്റോക്കിൽ നിന്നും കുറയ്ക്കും.'
                      : 'Ingredient stock will be restored, and produced product will be deducted.'}
                  </span>
                </div>
              </div>

              {/* Option 2: No, Mark as Wastage */}
              <div
                onClick={() => setRestockChoice('no')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${
                  restockChoice === 'no'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30'
                    : 'border-stone-200 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-amber-400/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    restockChoice === 'no'
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-stone-300 dark:border-stone-600 bg-transparent'
                  }`}
                >
                  {restockChoice === 'no' && <TbCheck className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-stone-900 dark:text-white font-malayalam block">
                    {language === 'ml' ? 'അല്ല, വേസ്റ്റേജ് ആയി രേഖപ്പെടുത്തുക' : 'No, Mark as Wastage'}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium font-malayalam block mt-0.5">
                    {language === 'ml'
                      ? 'ചേരുവകൾ വേസ്റ്റേജ് ആയി പോകും, സ്റ്റോക്കിലേക്ക് ചേർക്കില്ല.'
                      : 'Items will go to wastage, not added back to stock.'}
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent Warning Banner if 'No' (Wastage) is selected */}
            {restockChoice === 'no' && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-150">
                <TbAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block font-malayalam">
                    {language === 'ml' ? 'മുന്നറിയിപ്പ്: സാധനങ്ങൾ വേസ്റ്റേജ് ആയി രേഖപ്പെടുത്തും!' : 'Warning: Items will go to wastage!'}
                  </span>
                  <span className="font-semibold text-[11px] opacity-90 font-malayalam block mt-0.5">
                    {language === 'ml'
                      ? 'ഉപയോഗിച്ച ചേരുവകളോ നിർമ്മിച്ച ഉൽപ്പന്നമോ സ്റ്റോക്കിലേക്ക് തിരികെ ലഭിക്കില്ല.'
                      : 'Neither ingredients nor produced product will be added back to stock.'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal-border/50 dark:border-[#2E2828]/50">
              <Button
                variant="ghost"
                onClick={() => {
                  setRunToDelete(null);
                  setRestockChoice('yes');
                }}
                disabled={isDeleting}
                className="font-bold px-4"
              >
                {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
              </Button>

              <Button
                variant={restockChoice === 'yes' ? 'primary' : 'danger'}
                onClick={() => handleDeleteRun(restockChoice === 'yes')}
                isLoading={isDeleting}
                className="font-bold px-6 shadow-sm"
              >
                {restockChoice === 'yes'
                  ? language === 'ml'
                    ? 'റീസ്റ്റോക്ക് ചെയ്ത് ഒഴിവാക്കുക'
                    : 'Delete & Restock'
                  : language === 'ml'
                  ? 'വേസ്റ്റേജായി ഒഴിവാക്കുക'
                  : 'Delete as Wastage'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Daily Oil Modal */}
      <DailyOilModal
        isOpen={isDailyOilModalOpen}
        initialDate={oilModalDate}
        onClose={() => setIsDailyOilModalOpen(false)}
        onSuccess={() => {
          markBasicAsRecorded(oilModalDate, 'oil');
          triggerRefresh();
        }}
      />

      {/* Batch Packing Modal */}
      <BatchPackingModal
        isOpen={!!batchForPacking}
        batch={batchForPacking}
        recipes={recipes}
        onClose={() => setBatchForPacking(null)}
        onSuccess={() => {
          triggerRefresh();
        }}
      />

      {/* Basic Ingredients Selector Modal */}
      <BasicIngredientsSelectorModal
        isOpen={isBasicSelectorOpen}
        onClose={() => setIsBasicSelectorOpen(false)}
        ingredients={ingredients}
        onSelectOil={() => {
          setIsDailyOilModalOpen(true);
        }}
        onSelectBasicIngredient={(ing) => {
          setMeasuringBasicIngredient(ing);
        }}
      />

      {/* Basic Ingredient Measurement Modal (25kg ruler + grams) */}
      <BasicIngredientMeasurementModal
        isOpen={Boolean(measuringBasicIngredient)}
        onClose={() => setMeasuringBasicIngredient(null)}
        ingredient={measuringBasicIngredient}
        targetDate={oilModalDate}
        onSuccess={async () => {
          if (measuringBasicIngredient) {
            markBasicAsRecorded(oilModalDate, measuringBasicIngredient);
          }
          try {
            const freshIngredients = await repo.listIngredients(false);
            if (freshIngredients && freshIngredients.length > 0) {
              setIngredients(freshIngredients);
            }
          } catch (e) {
            console.error('Error refreshing ingredients after measurement', e);
          }
          triggerRefresh();
        }}
      />
    </div>
  );
};
