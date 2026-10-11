// ==============================================================================
// EPSO PRODUCTION & INVENTORY MANAGEMENT - DATA TYPES
// ==============================================================================

export type UserRole = 'owner' | 'production_staff' | 'catalogue_manager';

export type IngredientCategory = 'basic' | 'other';

export type UnitType = 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'packs' | 'rolls' | string;

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: UnitType;
  currentStock: number;
  minStock: number;
  avgCostPerUnit: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unit: UnitType;
  currentStock: number;
  wholesalePrice?: number;
  isActive: boolean;
  recipeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: UnitType;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  version: number;
  baseOutputQuantity: number;
  baseOutputUnit: UnitType;
  ingredients: RecipeIngredient[];
  instructions?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'opening'
  | 'purchase'
  | 'production_consumption'
  | 'production_output'
  | 'adjustment'
  | 'wastage'
  | 'cancellation_reversal';

export interface StockMovement {
  id: string;
  itemId: string;
  itemType: 'ingredient' | 'product';
  itemName: string;
  movementType: MovementType;
  quantity: number;
  unit: string;
  previousBalance: number;
  newBalance: number;
  costPerUnit?: number;
  reference: string;
  operatorName: string;
  reason?: string;
  createdAt: string;
}

export interface ConsumedIngredientItem {
  ingredientId: string;
  ingredientName: string;
  expectedQuantity: number;
  actualQuantity: number;
  unit: UnitType;
}

export interface BatchIngredientUsage {
  ingredientId: string;
  ingredientName: string;
  unit: UnitType;
  expectedQuantity: number;
  actualQuantity: number;
  differenceQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface ProductionRun {
  id: string;
  runNumber: string;
  productId: string;
  productName: string;
  recipeId?: string;
  recipeVersion?: number;
  productionDate: string; // YYYY-MM-DD
  plannedQuantity: number;
  actualQuantity: number;
  unit: UnitType;
  status: 'completed' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  notes?: string;
  operatorName: string;
  ingredientsConsumed: ConsumedIngredientItem[];
  createdAt: string;
  updatedAt: string;
}

// Backward compatibility alias for existing components
export type ProductionBatch = ProductionRun;

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface AdminDashboardMetrics {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  totalIngredients: number;
  runsToday: number;
  qtyToday: number;
  runsInPeriod: number;
  qtyInPeriod: number;
  byProduct: Array<{
    productName: string;
    unit: string;
    totalQuantity: number;
    runCount: number;
  }>;
  consumption: Array<{
    ingredientName: string;
    category: string;
    unit: string;
    totalConsumed: number;
  }>;
  recentActivity: Array<{
    id: string;
    runNumber: string;
    productName: string;
    productionDate: string;
    actualQuantity: number;
    unit: string;
    status: string;
    operatorName: string;
    createdAt: string;
  }>;
}

export interface AdminSession {
  token: string;
  expiresAt: string;
}
