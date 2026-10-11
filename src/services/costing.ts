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
