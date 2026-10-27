import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../ui/Modal';
import { BatchSuccessAnimation } from '../ui/BatchSuccessAnimation';
import { ProductionRun, Recipe } from '../../types';
import {
  TbPackage,
  TbCheck,
  TbPlus,
  TbMinus,
  TbX,
  TbAlertCircle,
  TbScale,
} from 'react-icons/tb';

interface BatchPackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: ProductionRun | null;
  recipes?: Recipe[];
  onSuccess?: () => void;
}

// Default fallback packet sizes if recipe has no packets assigned yet:
export const DEFAULT_PACKET_SIZES = [
  '3kg HM Packet',
  '2KG HM Packet',
  '10 x 12 Packet',
  '10 x 14 Packet',
  '10 x 16 Packet',
  '8 x 10 Packet',
  '8 x 12 Packet',
] as const;

export const BatchPackingModal: React.FC<BatchPackingModalProps> = ({
  isOpen,
  onClose,
  batch,
  recipes = [],
  onSuccess,
}) => {
  const { repo, staffName, addToast, triggerRefresh } = useApp();
  const { language } = useLanguage();

  // Multi-packet quantities state: { [packetSize: string]: quantity }
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);

  // Extra packets state (packets not assigned to product that user adds manually)
  const [extraPackets, setExtraPackets] = useState<Array<{ name: string; costPerPacket?: number }>>([]);
  const [showExtraPicker, setShowExtraPicker] = useState<boolean>(false);
  const [catalogPackets, setCatalogPackets] = useState<Array<{ name: string; costPerPacket?: number }>>([]);

  // Active Ruler Modal for a selected packet
  const [activeRulerPacket, setActiveRulerPacket] = useState<{
    size: string;
    count: number;
  } | null>(null);

  // Ruler scrolling refs
  const rulerRef = useRef<HTMLDivElement>(null);
  const isScrollingRuler = useRef<boolean>(false);

  const MIN_PACKETS = 1;
  const MAX_PACKETS = 500;
  const STEP_PACKETS = 1;
  const TICK_SPACING = 14;

  const scrollRulerTo = useCallback((val: number) => {
    if (!rulerRef.current) return;
    const ticksFromMin = val - MIN_PACKETS;
    const targetScroll = ticksFromMin * TICK_SPACING;
    isScrollingRuler.current = true;
    rulerRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
    setTimeout(() => {
      isScrollingRuler.current = false;
    }, 200);
  }, []);

  // Determine assigned packets for this batch:
  // "show only the packets assigned to the product , dont show other packets , but we can add other packets manualy"
  const currentRecipe = batch
    ? recipes.find((r) => r.id === batch.recipeId || r.productId === batch.productId)
    : null;

  const assignedRecipePackets = currentRecipe?.packets && currentRecipe.packets.length > 0
    ? currentRecipe.packets
    : [];

  const assignedPackets: Array<{ name: string; costPerPacket?: number }> = useMemo(() => {
    return assignedRecipePackets.map((p) => ({
      name: p.packetName,
      costPerPacket: p.costPerPacket,
    }));
  }, [assignedRecipePackets]);

  // Load packet types catalogue
  useEffect(() => {
    repo.listPacketTypes().then((types) => {
      if (types && types.length > 0) {
        setCatalogPackets(types.map((t) => ({ name: t.name, costPerPacket: t.costPerPacket })));
      } else {
        setCatalogPackets(DEFAULT_PACKET_SIZES.map((name) => ({ name, costPerPacket: 0 })));
      }
    }).catch(() => {
      setCatalogPackets(DEFAULT_PACKET_SIZES.map((name) => ({ name, costPerPacket: 0 })));
    });
  }, [repo]);

  // Load existing records for this batch
  useEffect(() => {
    if (isOpen && batch) {
      let isMounted = true;
      const initialMap: Record<string, number> = {};
      const loadedExtras: Array<{ name: string; costPerPacket?: number }> = [];

      repo.listPackingRecords({ productId: batch.productId, limit: 100 }).then((records) => {
        if (!isMounted) return;
        records.forEach((r) => {
          // Strictly match only this batch's records (no date fallback to avoid pulling in other batches)
          const isThisBatch = r.productionRunId
            ? r.productionRunId === batch.id
            : Boolean(r.notes && r.notes.includes(batch.runNumber));

          if (isThisBatch) {
            initialMap[r.packetSize] = (initialMap[r.packetSize] || 0) + (r.packetsPacked || 0);
            // If this packet was previously recorded but is NOT in the assigned packets list, include in extraPackets
            if (
              !assignedPackets.some((ap) => ap.name === r.packetSize) &&
              !loadedExtras.some((e) => e.name === r.packetSize)
            ) {
              loadedExtras.push({ name: r.packetSize, costPerPacket: 0 });
            }
          }
        });
        setQuantities({ ...initialMap });
        setExtraPackets(loadedExtras);
      }).catch(() => {
        if (isMounted) {
          setQuantities({});
          setExtraPackets([]);
        }
      });

      setActiveRulerPacket(null);
      setShowExtraPicker(false);
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, batch, repo, assignedPackets]);

  if (!batch) return null;

  // Packets displayed in the modal grid: assigned packets + any manually added extra packets
  const displayedPackets = [...assignedPackets, ...extraPackets];

  // Packets NOT set for the product that can be added extra
  const unassignedCatalogPackets = catalogPackets.filter(
    (cp) => !displayedPackets.some((dp) => dp.name.toLowerCase() === cp.name.toLowerCase())
  );

  // Open measurement ruler modal instantly when selecting a packet
  const handleOpenRulerForPacket = (size: string) => {
    const currentVal = quantities[size] || 50;
    setActiveRulerPacket({
      size,
      count: currentVal,
    });
    setTimeout(() => {
      scrollRulerTo(currentVal);
    }, 120);
  };

  const handleRulerScroll = () => {
    if (!rulerRef.current || isScrollingRuler.current || !activeRulerPacket) return;
    const scrollLeft = rulerRef.current.scrollLeft;
    const tickIndex = Math.round(scrollLeft / TICK_SPACING);
    const calculatedVal = Math.max(
      MIN_PACKETS,
      Math.min(MAX_PACKETS, MIN_PACKETS + tickIndex * STEP_PACKETS)
    );
    setActiveRulerPacket((prev) => (prev ? { ...prev, count: calculatedVal } : null));
  };

  const handleRulerStepDelta = (delta: number) => {
    if (!activeRulerPacket) return;
    const next = Math.max(MIN_PACKETS, Math.min(MAX_PACKETS, activeRulerPacket.count + delta));
    setActiveRulerPacket((prev) => (prev ? { ...prev, count: next } : null));
    scrollRulerTo(next);
  };

  const handleConfirmRulerValue = () => {
    if (!activeRulerPacket) return;
    setQuantities((prev) => ({
      ...prev,
      [activeRulerPacket.size]: activeRulerPacket.count,
    }));
    setActiveRulerPacket(null);
  };

  const handleClearRulerValue = () => {
    if (!activeRulerPacket) return;
    setQuantities((prev) => {
      const updated = { ...prev };
      delete updated[activeRulerPacket.size];
      return updated;
    });
    setActiveRulerPacket(null);
  };

  const handleRemoveExtraPacket = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExtraPackets((prev) => prev.filter((p) => p.name !== name));
    setQuantities((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  // Calculations:
  const configuredPackets = Object.entries(quantities).filter(([_, qty]) => (qty || 0) > 0);
  const totalPacketsSum = configuredPackets.reduce((sum, [_, qty]) => sum + qty, 0);

  // Check if all assigned packets have been added:
  const totalAssignedCount = assignedPackets.length;
  const addedPacketsCount = assignedPackets.filter((p) => (quantities[p.name] || 0) > 0).length;
  const isAllPacketsAdded = totalAssignedCount > 0 && addedPacketsCount === totalAssignedCount;
  const hasIncompletePackets = totalAssignedCount > 0 && addedPacketsCount < totalAssignedCount;

  const handleSubmitAllPackets = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (configuredPackets.length === 0) {
      addToast(
        language === 'ml'
          ? 'കുറഞ്ഞത് ഒരു പാക്കറ്റെങ്കിലും ചേർക്കുക'
          : 'Please add at least one packet quantity',
        'warning'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const packingDate = batch.productionDate || new Date().toISOString().split('T')[0];
      const operatorName = staffName || batch.operatorName || 'Kitchen Staff';

      // 1. Delete previous records for this run to keep calculations & DB strictly accurate (prevents duplicate rows)
      await repo.deletePackingRecordsForRun(batch.id, batch.runNumber);

      // 2. Insert new confirmed quantities
      for (const [packetSize, count] of configuredPackets) {
        await repo.recordPacking({
          packingDate,
          productId: batch.productId,
          productionRunId: batch.id,
          packetSize,
          packetsPacked: count,
          operatorName,
          notes: `Batch #${batch.runNumber}`,
        });
      }

      setIsSubmitting(false);
      setShowSuccessAnim(true);
    } catch (err: any) {
      console.error('Failed to record batch packaging', err);
      addToast(err?.message || 'Failed to save packets', 'error');
      setIsSubmitting(false);
    }
  };

  const handleSuccessAnimComplete = () => {
    setShowSuccessAnim(false);
    addToast(
      language === 'ml'
        ? `${batch.productName} ലേക്ക് ${totalPacketsSum} പാക്കറ്റുകൾ ചേർത്തു`
        : `Recorded ${totalPacketsSum} packets for ${batch.productName}`,
      'success'
    );
    triggerRefresh();
    if (onSuccess) onSuccess();
    onClose();
  };

  const totalTicks = MAX_PACKETS - MIN_PACKETS;


  return (
    <>
      <Modal
        isOpen={isOpen && !activeRulerPacket}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-2xl bg-epso-red/10 text-epso-red dark:bg-amber-500/20 dark:text-amber-400">
            <TbPackage className="w-5 h-5 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white leading-tight font-malayalam">
              {language === 'ml' ? 'പാക്കറ്റുകൾ ചേർക്കുക' : 'Add Packets'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              {batch.productName} ({batch.actualQuantity} {batch.unit})
            </p>
          </div>
        </div>
      }
      size="md"
      overlay={
        <BatchSuccessAnimation
          isVisible={showSuccessAnim}
          onComplete={handleSuccessAnimComplete}
          message={language === 'ml' ? 'പാക്കറ്റുകൾ ചേർത്തു!' : 'Packets Added Successfully!'}
          subMessage={
            language === 'ml'
              ? `${configuredPackets.length} തരങ്ങളിൽ ${totalPacketsSum} പാക്കറ്റുകൾ രേഖപ്പെടുത്തി`
              : `${totalPacketsSum} packets recorded across ${configuredPackets.length} packet types`
          }
        />
      }
    >
      <div className={`space-y-4 pb-28 -mx-1 ${activeRulerPacket ? 'hidden' : ''}`}>
        {/* Batch Info Card */}
        <div className="p-3 bg-stone-100/70 dark:bg-[#252020]/70 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-epso-orange flex items-center justify-center shrink-0">
              <TbPackage className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-stone-900 dark:text-white font-malayalam">
                {batch.productName}
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium font-sans">
                {batch.actualQuantity} {batch.unit} output • #{batch.runNumber}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`text-[11px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap shrink-0 ${
                isAllPacketsAdded
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700/60'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isAllPacketsAdded ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'
                }`}
              />
              <span className="whitespace-nowrap shrink-0">
                {addedPacketsCount}/{totalAssignedCount} {language === 'ml' ? 'ചേർത്തു' : 'Added'}
              </span>
            </span>
          </div>
        </div>

        {/* Available Packets Multi-Select Grid */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1B1B] border border-stone-200 dark:border-[#2E2828] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300 font-malayalam">
              {language === 'ml' ? 'ഉൽപ്പന്നത്തിന്റെ പാക്കറ്റുകൾ' : 'Product Packets'}
            </span>
            <span className="text-xs font-black text-stone-500 dark:text-stone-400 font-mono">
              {totalPacketsSum} pkts
            </span>
          </div>

          {displayedPackets.length === 0 ? (
            <div className="py-6 text-center text-stone-400 text-xs font-malayalam">
              {language === 'ml'
                ? 'ഈ ഉൽപ്പന്നത്തിന് പാക്കറ്റുകൾ നിശ്ചയിച്ചിട്ടില്ല. താഴെ നൽകിയിരിക്കുന്ന ബട്ടൺ ഉപയോഗിച്ച് മറ്റ് പാക്കറ്റുകൾ ചേർക്കാവുന്നതാണ്.'
                : 'No packets assigned to this product. You can add extra packets below.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {displayedPackets.map((pkt) => {
                const count = quantities[pkt.name] || 0;
                const hasCount = count > 0;
                const isExtra = !assignedPackets.some(
                  (ap) => ap.name.toLowerCase() === pkt.name.toLowerCase()
                );

                return (
                  <div
                    key={pkt.name}
                    onClick={() => handleOpenRulerForPacket(pkt.name)}
                    className={`relative p-3.5 rounded-2xl border-2 transition-all press-apple cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
                      hasCount
                        ? 'bg-orange-50/70 dark:bg-orange-950/20 border-epso-red dark:border-amber-500 shadow-sm'
                        : 'bg-stone-50 dark:bg-[#141212] border-stone-200 dark:border-[#282323] hover:border-epso-red/50 dark:hover:border-amber-500/50'
                    }`}
                  >
                    {/* TOP BADGE / COUNTER ON TOP OF THE BUTTON */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-black tracking-wider text-stone-400">
                          {isExtra ? (language === 'ml' ? 'മറ്റുള്ളവ' : 'Extra') : 'Packet'}
                        </span>
                        {isExtra && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveExtraPacket(pkt.name, e)}
                            className="p-0.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-red-500 transition-colors"
                            title={language === 'ml' ? 'ഒഴിവാക്കുക' : 'Remove'}
                          >
                            <TbX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {hasCount ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-epso-red dark:bg-amber-500 text-white dark:text-stone-950 font-black text-xs shadow-xs tracking-tight">
                          <TbCheck className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{count} pkts</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-[#282323] text-stone-500 dark:text-stone-400 font-bold text-[10px]">
                          <TbPlus className="w-3 h-3" />
                          <span>{language === 'ml' ? 'അളക്കുക' : 'Measure'}</span>
                        </span>
                      )}
                    </div>

                    {/* Packet Name & Quick Status */}
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <h4
                          className={`text-base font-black tracking-tight ${
                            hasCount
                              ? 'text-epso-red dark:text-amber-400'
                              : 'text-stone-900 dark:text-white'
                          }`}
                        >
                          {pkt.name}
                        </h4>
                        {pkt.costPerPacket ? (
                          <span className="text-[10px] text-stone-400 font-mono">
                            ₹{pkt.costPerPacket.toFixed(2)}/pkt
                          </span>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-black font-mono px-2 py-1 rounded-lg ${
                            hasCount
                              ? 'bg-white dark:bg-[#1E1B1B] text-stone-900 dark:text-white border border-epso-red/30 dark:border-amber-500/30'
                              : 'text-stone-400'
                          }`}
                        >
                          {hasCount ? `${count} pkts` : '0 pkts'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Button to add other packets extra */}
          <div className="pt-2 border-t border-stone-200/60 dark:border-[#282323]">
            {!showExtraPicker ? (
              <button
                type="button"
                onClick={() => setShowExtraPicker(true)}
                disabled={unassignedCatalogPackets.length === 0}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-[#181414] hover:bg-stone-100 dark:hover:bg-[#201c1c] text-stone-600 dark:text-stone-300 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-malayalam cursor-pointer"
              >
                <TbPlus className="w-4 h-4 text-epso-red dark:text-amber-400" />
                <span>
                  {unassignedCatalogPackets.length === 0
                    ? language === 'ml'
                      ? 'എല്ലാ പാക്കറ്റുകളും ലിസ്റ്റിൽ ഉണ്ട്'
                      : 'All available packets listed'
                    : language === 'ml'
                    ? '+ മറ്റ് പാക്കറ്റുകൾ ചേർക്കുക'
                    : '+ Add Other Packets Extra'}
                </span>
              </button>
            ) : (
              <div className="p-3 bg-stone-50 dark:bg-[#161313] rounded-2xl border border-stone-200 dark:border-[#2E2828] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 dark:text-stone-200 font-malayalam">
                    {language === 'ml' ? 'മറ്റ് പാക്കറ്റ് തിരഞ്ഞെടുക്കുക:' : 'Select Other Packet:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowExtraPicker(false)}
                    className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer"
                  >
                    <TbX className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {unassignedCatalogPackets.map((cp) => (
                    <button
                      key={cp.name}
                      type="button"
                      onClick={() => {
                        setExtraPackets((prev) => [
                          ...prev,
                          { name: cp.name, costPerPacket: cp.costPerPacket },
                        ]);
                        setShowExtraPicker(false);
                        handleOpenRulerForPacket(cp.name);
                      }}
                      className="p-2.5 rounded-xl border border-stone-200 dark:border-[#2E2828] bg-white dark:bg-[#1E1B1B] hover:border-epso-red dark:hover:border-amber-500 text-left transition-all text-xs flex flex-col justify-between cursor-pointer"
                    >
                      <span className="font-extrabold text-stone-900 dark:text-white">
                        {cp.name}
                      </span>
                      {cp.costPerPacket ? (
                        <span className="text-[10px] text-stone-400 font-mono">
                          ₹{cp.costPerPacket.toFixed(2)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Packets Summary Strip */}
        {configuredPackets.length > 0 && (
          <div className="p-3.5 bg-stone-100/80 dark:bg-[#252020]/80 rounded-2xl flex items-center justify-between text-xs">
            <span className="font-bold text-stone-600 dark:text-stone-300 font-malayalam">
              {language === 'ml' ? 'ആകെ പാക്കറ്റുകൾ:' : 'Total Packets to Save:'}
            </span>
            <span className="font-black text-sm text-stone-900 dark:text-white font-mono">
              {totalPacketsSum} {language === 'ml' ? 'പാക്കറ്റുകൾ' : 'Packets'} ({configuredPackets.length} {language === 'ml' ? 'തരങ്ങൾ' : 'sizes'})
            </span>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 p-3.5 sm:p-4 bg-white/95 dark:bg-[#1E1B1B]/95 backdrop-blur-xl border-t border-stone-200 dark:border-[#2E2828] z-40 flex items-center gap-3 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 py-3.5 sm:py-4 px-4 rounded-2xl border-2 border-stone-300 dark:border-stone-700 bg-white dark:bg-[#252020] hover:bg-stone-100 dark:hover:bg-[#2c2626] text-stone-800 dark:text-stone-200 font-extrabold text-sm transition-all press-apple cursor-pointer flex items-center justify-center gap-1.5"
        >
          <TbX className="w-4 h-4 stroke-[2.5]" />
          <span>{language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}</span>
        </button>

        {/* SAVE PACKETS BUTTON:
            "if not all packets are added. show warning yellow for the add packet button." */}
        <button
          type="button"
          onClick={() => handleSubmitAllPackets()}
          disabled={isSubmitting || configuredPackets.length === 0}
          className={`flex-[2] py-3.5 sm:py-4 px-4 rounded-2xl font-black text-sm shadow-md transition-all press-apple cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
            !isAllPacketsAdded
              ? 'bg-yellow-400 hover:bg-yellow-500 text-stone-950 border-2 border-yellow-500 shadow-yellow-500/20'
              : 'bg-epso-red hover:bg-epso-red-hover dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-stone-950'
          }`}
        >
          {isSubmitting ? (
            <span>{language === 'ml' ? 'സൂക്ഷിക്കുന്നു...' : 'Saving...'}</span>
          ) : (
            <>
              {!isAllPacketsAdded && (
                <TbAlertCircle className="w-4 h-4 stroke-[2.5] text-stone-950" />
              )}
              <TbCheck className="w-5 h-5 stroke-[3]" />
              <span>
                {language === 'ml'
                  ? !isAllPacketsAdded && addedPacketsCount > 0
                    ? `ചേർക്കുക (${addedPacketsCount}/${totalAssignedCount})`
                    : 'ചേർക്കുക'
                  : !isAllPacketsAdded && addedPacketsCount > 0
                  ? `Add (${addedPacketsCount}/${totalAssignedCount})`
                  : 'Add'}
              </span>
            </>
          )}
        </button>
      </div>
    </Modal>

    {/* =================================================================== */}
    {/* INSTANT RULER MODAL FOR SELECTED PACKET                             */}
    {/* (Rendered independently so the background modal is completely hidden)*/}
    {/* =================================================================== */}
    {activeRulerPacket && (
      <Modal
        isOpen={true}
        onClose={() => setActiveRulerPacket(null)}
        title={
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-epso-red/10 text-epso-red dark:bg-amber-500/20 dark:text-amber-400">
              <TbScale className="w-5 h-5 stroke-[2.5]" />
            </span>
            <div>
              <h3 className="text-base font-black text-stone-900 dark:text-white leading-tight font-malayalam">
                {activeRulerPacket.size}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                {language === 'ml' ? 'പാക്കറ്റ് എണ്ണം നൽകുക' : 'Measure Packet Count'}
              </p>
            </div>
          </div>
        }
        size="md"
      >
        <div className="space-y-4 py-2 font-malayalam">
          {/* Value Steppers Display */}
          <div className="flex items-center justify-center gap-2 py-1">
            <button
              type="button"
              onClick={() => handleRulerStepDelta(-10)}
              className="w-11 h-11 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="-10"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => handleRulerStepDelta(-1)}
              className="w-11 h-11 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
            >
              <TbMinus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <div className="w-40 shrink-0 flex items-baseline justify-center gap-1.5 px-3 py-2.5 rounded-2xl bg-stone-100 dark:bg-[#141212] border border-stone-200 dark:border-[#2E2828] tabular-nums shadow-inner">
              <span className="text-3xl font-black text-stone-900 dark:text-white tracking-tight tabular-nums">
                {activeRulerPacket.count}
              </span>
              <span className="text-xs font-black text-stone-500 dark:text-stone-400 uppercase">
                pkts
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleRulerStepDelta(1)}
              className="w-11 h-11 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
            >
              <TbPlus className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => handleRulerStepDelta(10)}
              className="w-11 h-11 shrink-0 rounded-2xl bg-stone-100 dark:bg-[#282323] hover:bg-stone-200 dark:hover:bg-[#342D2D] text-stone-700 dark:text-stone-200 flex items-center justify-center font-bold text-xs press-apple transition-colors cursor-pointer"
              title="+10"
            >
              +10
            </button>
          </div>

          {/* Horizontal Touch Ruler */}
          <div className="relative w-full py-2 overflow-hidden flex flex-col items-center select-none bg-stone-50 dark:bg-[#141212] rounded-2xl border border-charcoal-border/50 dark:border-[#2E2828]">
            {/* Center Marker Needle */}
            <div className="absolute top-0 bottom-4 left-1/2 -translate-x-1/2 w-0.5 z-20 pointer-events-none rounded-full bg-epso-red dark:bg-amber-500">
              <div className="w-2.5 h-2.5 rounded-full -ml-[4px] -top-1 absolute bg-epso-red dark:bg-amber-500 shadow-sm" />
            </div>

            {/* Scrollable Ruler Track */}
            <div
              ref={rulerRef}
              onScroll={handleRulerScroll}
              className="w-full overflow-x-scroll no-scrollbar touch-pan-x flex items-end h-14 relative select-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="shrink-0 w-1/2" />
              <div className="flex items-end shrink-0" style={{ gap: `${TICK_SPACING - 2}px` }}>
                {Array.from({ length: totalTicks + 1 }).map((_, idx) => {
                  const val = MIN_PACKETS + idx * STEP_PACKETS;
                  const isMajor = val % 25 === 0;
                  const isMedium = val % 5 === 0 && !isMajor;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveRulerPacket((prev) => (prev ? { ...prev, count: val } : null));
                        scrollRulerTo(val);
                      }}
                      className="flex flex-col items-center justify-end shrink-0 cursor-pointer h-10 pb-1"
                      style={{ width: '2px' }}
                    >
                      <div
                        className={`rounded-full transition-colors ${
                          isMajor
                            ? 'h-8 bg-stone-500/40 dark:bg-stone-400/35 w-[2px]'
                            : isMedium
                            ? 'h-5 bg-stone-400/30 dark:bg-stone-500/25 w-[1.5px]'
                            : 'h-3 bg-stone-300/25 dark:bg-stone-600/20 w-[1px]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="shrink-0 w-1/2" />
            </div>

            {/* Edge gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-stone-50 dark:from-[#141212] to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-stone-50 dark:from-[#141212] to-transparent pointer-events-none z-10" />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-[10px] text-stone-400 font-bold mr-1">Quick:</span>
            {[25, 50, 75, 100, 150, 200, 250].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setActiveRulerPacket((prev) => (prev ? { ...prev, count: preset } : null));
                  scrollRulerTo(preset);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  activeRulerPacket.count === preset
                    ? 'bg-epso-red text-white border-epso-red dark:bg-amber-500 dark:text-stone-950 dark:border-amber-500'
                    : 'bg-white dark:bg-[#141212] border-charcoal-border/70 dark:border-[#2E2828] text-stone-600 dark:text-stone-300 hover:text-epso-red'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Ruler Dialog Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-stone-200 dark:border-[#2E2828]">
            <button
              type="button"
              onClick={handleClearRulerValue}
              className="py-3 px-4 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-bold text-xs hover:bg-stone-100 dark:hover:bg-[#282323] cursor-pointer"
            >
              {language === 'ml' ? 'ഒഴിവാക്കുക (0)' : 'Clear (0)'}
            </button>

            <button
              type="button"
              onClick={() => setActiveRulerPacket(null)}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-stone-300 dark:border-stone-700 bg-white dark:bg-[#252020] text-stone-800 dark:text-stone-200 font-extrabold text-xs cursor-pointer text-center"
            >
              {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleConfirmRulerValue}
              className="flex-1 py-3 px-4 rounded-xl bg-epso-red hover:bg-epso-red-hover dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-stone-950 font-black text-xs shadow-md press-apple cursor-pointer flex items-center justify-center gap-1.5"
            >
              <TbCheck className="w-4 h-4 stroke-[3]" />
              <span>{language === 'ml' ? 'സ്ഥിരീകരിക്കുക' : 'Done'}</span>
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
};
