import {
  Ingredient,
  Product,
  Recipe,
  ProductionRun,
  StockMovement,
  AuditLog,
  AdminDashboardMetrics,
  MovementType,
  DailyClosing,
  DailyCostAllocation,
  PackagingItem,
  PackingRecord,
} from '../types';

export interface IEpsoRepository {
  // Products Catalogue
  listProducts(includeInactive?: boolean): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  updateProduct(id: string, data: Partial<Product>): Promise<Product>;
  deactivateProduct(id: string): Promise<void>;
  safeDeleteProduct(id: string): Promise<{ deleted: boolean; deactivated?: boolean }>;

  // Ingredients Catalogue
  listIngredients(includeInactive?: boolean): Promise<Ingredient[]>;
  getIngredientById(id: string): Promise<Ingredient | null>;
  createIngredient(data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient>;
  updateIngredient(id: string, data: Partial<Ingredient>): Promise<Ingredient>;
  deactivateIngredient(id: string): Promise<void>;
  safeDeleteIngredient(id: string): Promise<{ deleted: boolean; deactivated?: boolean }>;
  adjustStock(params: {
    ingredientId: string;
    quantityDelta: number;
    reason: string;
    operatorName: string;
  }): Promise<{ ingredient: Ingredient; movement: StockMovement }>;

  // Recipes (BOM)
  listRecipes(): Promise<Recipe[]>;
  getRecipeById(id: string): Promise<Recipe | null>;
  getRecipeByProductId(productId: string): Promise<Recipe | null>;
  saveRecipe(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Recipe>;

  // Production Operations
  listProductionRuns(options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    productId?: string;
    status?: 'completed' | 'cancelled';
  }): Promise<ProductionRun[]>;
  getProductionRunById(id: string): Promise<ProductionRun | null>;
  recordProductionRun(params: {
    runNumber: string;
    productId: string;
    recipeId?: string;
    recipeVersion?: number;
    productionDate: string;
    plannedQuantity: number;
    actualQuantity: number;
    unit: string;
    operatorName: string;
    notes?: string;
    ingredientsConsumed: Array<{
      ingredientId: string;
      expectedQuantity: number;
      actualQuantity: number;
      unit: string;
    }>;
  }): Promise<ProductionRun>;
  cancelProductionRun(params: {
    runId: string;
    reason: string;
    operatorName: string;
  }): Promise<boolean>;
  deleteProductionRun(runId: string): Promise<boolean>;

  // Stock Ledger
  getStockMovements(filter?: {
    itemId?: string;
    itemType?: 'ingredient' | 'product';
    type?: MovementType;
    limit?: number;
  }): Promise<StockMovement[]>;

  // Admin & Security Management
  isAdminInitialized(): Promise<boolean>;
  setupAdminPin(pin: string, recoveryKey: string): Promise<{ success: boolean; sessionToken: string }>;
  verifyAdminPin(pin: string): Promise<{ success: boolean; sessionToken?: string; needsSetup?: boolean }>;
  resetAdminPinWithRecovery(recoveryKey: string, newPin: string): Promise<{ success: boolean; message: string }>;
  verifyAdminSession(token: string): Promise<boolean>;
  getAdminDashboardMetrics(startDate: string, endDate: string): Promise<AdminDashboardMetrics>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;

  // Mode & System status
  isSupabaseMode(): boolean;

  // Daily Closing & Cost Allocation
  getDailyClosing(date: string): Promise<DailyClosing | null>;
  listDailyClosings(limit?: number): Promise<DailyClosing[]>;
  saveDailyClosing(data: {
    productionDate: string;
    oilOpeningBalance: number;
    oilPurchases: number;
    oilClosingBalance: number;
    oilCostPerKg: number;
    productionWages: number;
    notes?: string;
    closedBy: string;
  }): Promise<DailyClosing>;
  listCostAllocations(dateOrClosingId: string): Promise<DailyCostAllocation[]>;

  // Packaging & Packing
  listPackagingItems(productId?: string): Promise<PackagingItem[]>;
  savePackagingItem(item: Partial<PackagingItem> & { productId: string; sizeLabel: string }): Promise<PackagingItem>;
  deletePackagingItem(id: string): Promise<void>;
  recordPacking(params: {
    packingDate: string;
    productId: string;
    packagingItemId?: string;
    packetSize: string;
    packetsPacked: number;
    operatorName: string;
    notes?: string;
  }): Promise<PackingRecord>;
  listPackingRecords(options?: { productId?: string; date?: string; limit?: number }): Promise<PackingRecord[]>;
}
