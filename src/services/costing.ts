import { Recipe, RecipeIngredient, BatchIngredientUsage, Ingredient } from '../types';

/**
 * Rounds a number to a specified number of decimal places without floating-point drift.
 */
export function roundTo(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Decimal-safe stock rounding (up to 3 decimal places for precision with grams / milliliters)
 */
export function roundStock(value: number): number {
  return roundTo(value, 3);
}

/**
 * Decimal-safe currency rounding (2 decimal places)
 */
export function roundCurrency(value: number): number {
  return roundTo(value, 2);
}

/**
 * Scales a recipe proportionally based on planned output quantity.
 * Example: Base output 10kg with 15kg raw bananas -> Planned 50kg = 5x multiplier -> 75kg raw bananas.
 */
export function scaleRecipeIngredients(
  recipe: Recipe,
  plannedOutputKg: number
): Array<{ ingredientId: string; ingredientName: string; unit: RecipeIngredient['unit']; expectedQuantity: number }> {
  if (!recipe || !recipe.ingredients || recipe.baseOutputQuantity <= 0 || plannedOutputKg <= 0) {
    return [];
  }

  const multiplier = plannedOutputKg / recipe.baseOutputQuantity;

  return recipe.ingredients.map((item) => ({
    ingredientId: item.ingredientId,
    ingredientName: item.ingredientName,
    unit: item.unit,
    expectedQuantity: roundStock(item.quantity * multiplier),
  }));
}

/**
 * Computes the ingredient usage line items, including difference and cost breakdowns.
 */
export function computeBatchUsageSummary(
  scaledItems: Array<{ ingredientId: string; ingredientName: string; unit: RecipeIngredient['unit']; expectedQuantity: number }>,
  actualQuantities: Record<string, number>,
  ingredientCostMap: Record<string, number>
): BatchIngredientUsage[] {
  return scaledItems.map((item) => {
    const actual = roundStock(actualQuantities[item.ingredientId] ?? item.expectedQuantity);
    const expected = roundStock(item.expectedQuantity);
    const difference = roundStock(actual - expected);
    const unitCost = ingredientCostMap[item.ingredientId] ?? 0;
    const totalCost = roundCurrency(actual * unitCost);

    return {
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      unit: item.unit,
      expectedQuantity: expected,
      actualQuantity: actual,
      differenceQuantity: difference,
      unitCost: roundCurrency(unitCost),
      totalCost,
    };
  });
}

/**
 * Computes batch financial totals:
 * - Total Raw Material Cost
 * - Raw Material Cost per Kg of actual finished product
 * - Yield percentage
 */
export function computeBatchMetrics(
  ingredientsUsed: BatchIngredientUsage[],
  actualOutputKg: number,
  plannedOutputKg: number
) {
  const totalIngredientCost = roundCurrency(
    ingredientsUsed.reduce((sum, item) => sum + (item.totalCost || 0), 0)
  );

  const costPerKg = actualOutputKg > 0 ? roundCurrency(totalIngredientCost / actualOutputKg) : 0;
  const outputDifferenceKg = roundStock(actualOutputKg - plannedOutputKg);
  const yieldPercentage = plannedOutputKg > 0 ? roundTo((actualOutputKg / plannedOutputKg) * 100, 1) : 100;

  return {
    totalIngredientCost,
    costPerKg,
    outputDifferenceKg,
    yieldPercentage,
  };
}

/**
 * Calculates new weighted-average unit cost when new stock is purchased.
 * Formula: ((Current Stock * Current Avg Cost) + (New Qty * New Unit Cost)) / (Current Stock + New Qty)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  purchasedQty: number,
  purchasedUnitCost: number
): number {
  if (purchasedQty <= 0) return currentAvgCost;
  
  // If current stock was zero or negative, new cost is just the purchase cost
  if (currentStock <= 0) {
    return roundCurrency(purchasedUnitCost);
  }

  const currentTotalValue = currentStock * currentAvgCost;
  const newPurchaseValue = purchasedQty * purchasedUnitCost;
  const combinedQty = currentStock + purchasedQty;

  if (combinedQty <= 0) return currentAvgCost;

  return roundCurrency((currentTotalValue + newPurchaseValue) / combinedQty);
}

/**
 * Continuous Oil Balance Calculator.
 * Closing oil balance = Opening oil balance + Purchases − Oil consumption/loss.
 * Oil consumed/lost = Opening + Purchases - Closing.
 * Daily oil expense = Oil consumed * Weighted avg cost per kg.
 */
/**
 * Daily Oil Stock & Consumption Calculator according to Cook's Workflow:
 * 1. Automatically uses previous available oil stock from inventory.
 * 2. Subtracts oil used during production.
 * 3. Adds leftover oil entered at the end of the day back to stock.
 *
 * Formula:
 * Final Oil Stock = Previous Available Stock - Oil Used + Leftover Oil
 * Net Oil Consumed = Oil Used - Leftover Oil
 * Daily Oil Expense = Net Oil Consumed * Cost per kg
 *
 * Example:
 * Previous available: 20 kg
 * Oil used: 5 kg
 * Leftover: 2 kg
 * -> Final available: 20 - 5 + 2 = 17 kg
 * -> Net consumed: 3 kg
 */
export function calculateDailyOilUsage(
  previousAvailableStockKg: number,
  oilUsedKg: number,
  leftoverOilKg: number,
  oilCostPerKg: number
): {
  previousAvailableStockKg: number;
  oilUsedKg: number;
  leftoverOilKg: number;
  netOilConsumedKg: number;
  finalOilStockKg: number;
  oilTotalExpense: number;
} {
  const prevStock = Math.max(0, roundStock(previousAvailableStockKg));
  const used = Math.max(0, roundStock(oilUsedKg));
  const leftover = Math.max(0, Math.min(used, roundStock(leftoverOilKg)));
  const netOilConsumedKg = Math.max(0, roundStock(used - leftover));
  const finalOilStockKg = Math.max(0, roundStock(prevStock - netOilConsumedKg));
  const oilTotalExpense = roundCurrency(netOilConsumedKg * Math.max(0, oilCostPerKg));

  return {
    previousAvailableStockKg: prevStock,
    oilUsedKg: used,
    leftoverOilKg: leftover,
    netOilConsumedKg,
    finalOilStockKg,
    oilTotalExpense,
  };
}

export function calculateContinuousOilExpense(
  openingBalanceKg: number,
  purchasesKg: number,
  closingBalanceKg: number,
  avgCostPerKg: number
): { oilConsumedKg: number; oilTotalExpense: number } {
  const available = Math.max(0, roundStock(openingBalanceKg + purchasesKg));
  const closing = Math.max(0, roundStock(closingBalanceKg));
  const consumed = Math.max(0, roundStock(available - closing));
  const expense = roundCurrency(consumed * Math.max(0, avgCostPerKg));

  return {
    oilConsumedKg: consumed,
    oilTotalExpense: expense,
  };
}

/**
 * Consistent batch eligibility rule across Epso:
 * Excludes cancelled batches and requires positive produced weight (actualQuantity > 0).
 */
export function isEligibleProductionBatch(
  run: { status?: string; actualQuantity?: number } | null | undefined
): boolean {
  if (!run) return false;
  if (run.status === 'cancelled') return false;
  return (Number(run.actualQuantity) || 0) > 0;
}

/**
 * Extracts the effective total daily wage from a daily_wages record or daily_closings fallback.
 */
export function getEffectiveDailyWage(
  wage?: {
    totalWageBudget?: number;
    dailyWageBudget?: number;
    productionWageAmount?: number;
    packingWageAmount?: number;
  } | null,
  closing?: { productionWages?: number } | null
): number {
  if (wage) {
    const total = Number(wage.totalWageBudget) || Number(wage.dailyWageBudget) || 0;
    if (total > 0) return roundCurrency(total);
    const splitSum =
      (Number(wage.productionWageAmount) || 0) + (Number(wage.packingWageAmount) || 0);
    if (splitSum > 0) return roundCurrency(splitSum);
  }
  if (closing) {
    const closingWage = Number(closing.productionWages) || 0;
    if (closingWage > 0) return roundCurrency(closingWage);
  }
  return 0;
}

export interface BatchWageAllocationItem<T extends { id: string; actualQuantity?: number }> {
  run: T;
  weight: number;
  shareRatio: number;
  sharePercent: number;
  totalBatchWage: number;
  wagePerKg: number;
}

/**
 * Allocates the total daily wage across all eligible batches on a given date
 * based on production weight:
 *   Batch Wage = (Batch Production kg / Total Eligible Daily Production kg) × Total Daily Wage
 *
 * Rounding is reconciled on the final eligible batch so that the sum of all batch
 * allocations strictly equals the entered daily wage.
 */
export function allocateDailyWageToBatches<
  T extends { id: string; actualQuantity?: number; status?: string }
>(runsForDate: T[], totalDailyWage: number): BatchWageAllocationItem<T>[] {
  const eligibleRuns = (runsForDate || []).filter((r) => isEligibleProductionBatch(r));
  if (eligibleRuns.length === 0) return [];

  const budget = Math.max(0, roundCurrency(Number(totalDailyWage) || 0));
  const totalEligibleKg = roundStock(
    eligibleRuns.reduce((sum, r) => sum + (Number(r.actualQuantity) || 0), 0)
  );

  if (totalEligibleKg <= 0 || budget <= 0) {
    return eligibleRuns.map((run) => {
      const weight = roundStock(Number(run.actualQuantity) || 0);
      return {
        run,
        weight,
        shareRatio: 0,
        sharePercent: 0,
        totalBatchWage: 0,
        wagePerKg: 0,
      };
    });
  }

  let runningWage = 0;
  let runningPercent = 0;
  const count = eligibleRuns.length;

  return eligibleRuns.map((run, idx) => {
    const isLast = idx === count - 1;
    const weight = roundStock(Number(run.actualQuantity) || 0);
    const shareRatio = weight / totalEligibleKg;

    let totalBatchWage: number;
    let sharePercent: number;

    if (isLast) {
      totalBatchWage = roundCurrency(budget - runningWage);
      sharePercent = roundTo(100 - runningPercent, 1);
    } else {
      totalBatchWage = roundCurrency(shareRatio * budget);
      sharePercent = roundTo(shareRatio * 100, 1);
      runningWage = roundCurrency(runningWage + totalBatchWage);
      runningPercent = roundTo(runningPercent + sharePercent, 1);
    }

    const wagePerKg = weight > 0 ? roundCurrency(totalBatchWage / weight) : 0;

    return {
      run,
      weight,
      shareRatio,
      sharePercent,
      totalBatchWage,
      wagePerKg,
    };
  });
}

/**
 * Distributes shared daily expenses across products produced that day:
 * - Oil, Basic Ingredients & Daily Wages: Allocated proportional to production weight:
 *   Product Share = (Product Production kg / Total Eligible Daily Production kg) × Daily Expense
 *
 * Exact reconciliation: The final product absorbs any fractional paisa rounding discrepancy
 * so that sum(allocated) strictly equals the original expense amount.
 */
export function allocateDailySharedExpenses(
  productsSummary: Array<{
    productId: string;
    productName: string;
    totalProductionKg: number;
    batchCount: number;
    ingredientCost: number;
  }>,
  dailyOilExpense: number,
  dailyProductionWages: number,
  dailyBasicIngredientsExpense: number = 0
): Array<{
  productId: string;
  productName: string;
  totalProductionKg: number;
  batchCount: number;
  ingredientCost: number;
  allocatedOilCost: number;
  allocatedProductionWages: number;
  allocatedBasicIngredientsCost: number;
  totalProductionCost: number;
  productionCostPerKg: number;
}> {
  const eligibleProducts = productsSummary.filter((p) => (Number(p.totalProductionKg) || 0) > 0);
  const targetList = eligibleProducts.length > 0 ? productsSummary : productsSummary;
  const totalKg = targetList.reduce((sum, p) => sum + (Number(p.totalProductionKg) || 0), 0);

  if (productsSummary.length === 0) {
    return [];
  }

  let runningOil = 0;
  let runningWages = 0;
  let runningBasic = 0;

  // Find the last index with positive production weight for exact rounding reconciliation
  let lastPositiveIdx = -1;
  for (let i = productsSummary.length - 1; i >= 0; i--) {
    if ((Number(productsSummary[i].totalProductionKg) || 0) > 0) {
      lastPositiveIdx = i;
      break;
    }
  }
  if (lastPositiveIdx === -1) {
    lastPositiveIdx = productsSummary.length - 1;
  }

  return productsSummary.map((p, idx) => {
    const prodKg = Number(p.totalProductionKg) || 0;
    let oilAlloc = 0;
    let wagesAlloc = 0;
    let basicAlloc = 0;

    if (totalKg > 0 && prodKg > 0) {
      if (idx === lastPositiveIdx) {
        oilAlloc = roundCurrency(dailyOilExpense - runningOil);
        wagesAlloc = roundCurrency(dailyProductionWages - runningWages);
        basicAlloc = roundCurrency(dailyBasicIngredientsExpense - runningBasic);
      } else {
        const weightRatio = prodKg / totalKg;
        oilAlloc = roundCurrency(weightRatio * dailyOilExpense);
        wagesAlloc = roundCurrency(weightRatio * dailyProductionWages);
        basicAlloc = roundCurrency(weightRatio * dailyBasicIngredientsExpense);

        runningOil = roundCurrency(runningOil + oilAlloc);
        runningWages = roundCurrency(runningWages + wagesAlloc);
        runningBasic = roundCurrency(runningBasic + basicAlloc);
      }
    }

    const totalProdCost = roundCurrency(p.ingredientCost + oilAlloc + wagesAlloc + basicAlloc);
    const costPerKg = prodKg > 0 ? roundCurrency(totalProdCost / prodKg) : 0;

    return {
      productId: p.productId,
      productName: p.productName,
      totalProductionKg: p.totalProductionKg,
      batchCount: p.batchCount,
      ingredientCost: p.ingredientCost,
      allocatedOilCost: oilAlloc,
      allocatedProductionWages: wagesAlloc,
      allocatedBasicIngredientsCost: basicAlloc,
      totalProductionCost: totalProdCost,
      productionCostPerKg: costPerKg,
    };
  });
}

/**
 * Calculates Final Product Costing Breakdown.
 * Labour is allocated as daily wage expense across batches; per-packet labour calculation is removed.
 * Total product cost = Bulk production cost + Packaging material (cover) cost.
 */
export function calculateFinalProductCosting(
  productionAllocation: {
    productId: string;
    productName: string;
    totalProductionKg: number;
    batchCount: number;
    ingredientCost: number;
    allocatedOilCost: number;
    allocatedProductionWages: number;
    totalProductionCost: number;
    productionCostPerKg: number;
  },
  packingRecords: Array<{
    packetSize: string;
    packetsPacked: number;
    coverUnitCost: number;
    packagingCost: number;
    packingLabourRate: number;
    packingLabourCost: number;
    totalPackingCost: number;
    weightPackedKg: number;
  }>
) {
  const totalPacketsPacked = packingRecords.reduce((sum, r) => sum + r.packetsPacked, 0);
  const totalWeightPackedKg = roundStock(packingRecords.reduce((sum, r) => sum + r.weightPackedKg, 0));
  const totalPackagingCost = roundCurrency(packingRecords.reduce((sum, r) => sum + r.packagingCost, 0));
  // Removed per-packet labour charge; labour is allocated via daily wages
  const totalPackingLabourCost = 0;
  const totalPackingCost = totalPackagingCost;

  const totalCost = roundCurrency(productionAllocation.totalProductionCost + totalPackingCost);
  const unpackedKg = Math.max(0, roundStock(productionAllocation.totalProductionKg - totalWeightPackedKg));
  const unpackedValuation = roundCurrency(unpackedKg * productionAllocation.productionCostPerKg);

  // Group packing by size for packet-level costing breakdown
  const sizeMap: Record<string, { packets: number; coverCost: number; labourCost: number; totalCost: number; weightKg: number }> = {};
  for (const r of packingRecords) {
    if (!sizeMap[r.packetSize]) {
      sizeMap[r.packetSize] = { packets: 0, coverCost: 0, labourCost: 0, totalCost: 0, weightKg: 0 };
    }
    sizeMap[r.packetSize].packets += r.packetsPacked;
    sizeMap[r.packetSize].coverCost += r.packagingCost;
    sizeMap[r.packetSize].labourCost += 0;
    sizeMap[r.packetSize].totalCost += r.packagingCost;
    sizeMap[r.packetSize].weightKg += r.weightPackedKg;
  }

  const packetsBySize = Object.entries(sizeMap).map(([size, item]) => {
    // Exact weight per packet: prioritize actual recorded weight / packets, fallback to size label parse (kg vs g)
    let kgPerPacket = 0;
    if (item.packets > 0 && item.weightKg > 0) {
      kgPerPacket = item.weightKg / item.packets;
    } else if (/(\d+(?:\.\d+)?)\s*kg/i.test(size)) {
      const match = size.match(/(\d+(?:\.\d+)?)\s*kg/i);
      kgPerPacket = match ? parseFloat(match[1]) : 1;
    } else if (/(\d+)\s*g/i.test(size)) {
      const match = size.match(/(\d+)\s*g/i);
      kgPerPacket = match ? parseInt(match[1], 10) / 1000 : 0.1;
    } else {
      kgPerPacket = 0.1;
    }

    // Bulk product share inside this packet: kgPerPacket * productionCostPerKg
    const bulkInsidePacket = roundCurrency(kgPerPacket * productionAllocation.productionCostPerKg);
    const packingInsidePacket = item.packets > 0 ? roundCurrency(item.totalCost / item.packets) : 0;
    const costPerPacket = roundCurrency(bulkInsidePacket + packingInsidePacket);

    return {
      size,
      packets: item.packets,
      coverCost: roundCurrency(item.coverCost),
      labourCost: 0,
      totalCost: roundCurrency(item.totalCost),
      costPerPacket,
    };
  });

  return {
    productId: productionAllocation.productId,
    productName: productionAllocation.productName,
    totalProductionKg: productionAllocation.totalProductionKg,
    batchCount: productionAllocation.batchCount,
    totalIngredientCost: productionAllocation.ingredientCost,
    allocatedOilCost: productionAllocation.allocatedOilCost,
    allocatedProductionWages: productionAllocation.allocatedProductionWages,
    totalProductionCost: productionAllocation.totalProductionCost,
    productionCostPerKg: productionAllocation.productionCostPerKg,
    totalPacketsPacked,
    totalWeightPackedKg,
    totalPackagingCost,
    totalPackingLabourCost,
    totalPackingCost,
    totalCost,
    packetsBySize,
    unpackedKg,
    unpackedValuation,
  };
}
