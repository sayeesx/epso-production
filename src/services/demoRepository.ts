import { IEpsoRepository } from './repository';
import {
  Ingredient,
  Product,
  Recipe,
  ProductionRun,
  StockMovement,
  AuditLog,
  AdminDashboardMetrics,
  MovementType,
} from '../types';
import { INITIAL_PRODUCTS, INITIAL_INGREDIENTS, INITIAL_RECIPES } from './demoSeedData';

const STORAGE_KEYS = {
  PRODUCTS: 'epso_storage_products_v2',
  INGREDIENTS: 'epso_storage_ingredients_v2',
  RECIPES: 'epso_storage_recipes_v2',
  RUNS: 'epso_storage_production_runs_v2',
  MOVEMENTS: 'epso_storage_movements_v2',
  AUDIT_LOGS: 'epso_storage_audit_logs_v2',
  SECURITY: 'epso_storage_admin_security_v2',
  SESSIONS: 'epso_storage_admin_sessions_v2',
};

export class DemoRepository implements IEpsoRepository {
  constructor() {
    this.ensureInitialized();
  }

  isSupabaseMode(): boolean {
    return false;
  }

  private memoryStorage = new Map<string, string>();

  private getItem<T>(key: string, defaultVal: T): T {
    try {
      let data: string | null = null;
      if (typeof localStorage !== 'undefined') {
        data = localStorage.getItem(key);
      } else {
        data = this.memoryStorage.get(key) || null;
      }
      return data ? JSON.parse(data) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      } else {
        this.memoryStorage.set(key, serialized);
      }
    } catch (e) {
      console.error('Storage write error', e);
    }
  }

  private removeItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        this.memoryStorage.delete(key);
      }
    } catch (e) {
      console.error('Storage remove error', e);
    }
  }

  public async resetDemoData(): Promise<void> {
    const prods: Product[] = INITIAL_PRODUCTS.map((p, idx) => ({
      ...p,
      id: `prod-${idx + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    this.setItem(STORAGE_KEYS.PRODUCTS, prods);

    const ings: Ingredient[] = INITIAL_INGREDIENTS.map((i, idx) => ({
      ...i,
      id: `ing-${idx + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    this.setItem(STORAGE_KEYS.INGREDIENTS, ings);

    this.setItem(STORAGE_KEYS.RECIPES, INITIAL_RECIPES);
    this.setItem(STORAGE_KEYS.RUNS, []);
    this.setItem(STORAGE_KEYS.MOVEMENTS, []);
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, []);
    this.removeItem(STORAGE_KEYS.SECURITY);
    this.removeItem(STORAGE_KEYS.SESSIONS);
  }

  public ensureInitialized(): void {
    const existingProds = this.getItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    if (!existingProds || existingProds.length === 0) {
      const prods: Product[] = INITIAL_PRODUCTS.map((p, idx) => ({
        ...p,
        id: `prod-${idx + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      this.setItem(STORAGE_KEYS.PRODUCTS, prods);
    }

    const existingIngs = this.getItem<Ingredient[]>(STORAGE_KEYS.INGREDIENTS, []);
    if (!existingIngs || existingIngs.length === 0) {
      const ings: Ingredient[] = INITIAL_INGREDIENTS.map((i, idx) => ({
        ...i,
        id: `ing-${idx + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      this.setItem(STORAGE_KEYS.INGREDIENTS, ings);
    }

    const existingRecs = this.getItem<Recipe[]>(STORAGE_KEYS.RECIPES, []);
    if (!existingRecs) {
      this.setItem(STORAGE_KEYS.RECIPES, INITIAL_RECIPES);
    }

    const existingRuns = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    if (!existingRuns) {
      this.setItem(STORAGE_KEYS.RUNS, []);
    }

    const existingMvs = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
    if (!existingMvs) {
      this.setItem(STORAGE_KEYS.MOVEMENTS, []);
    }

    const existingLogs = this.getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    if (!existingLogs) {
      this.setItem(STORAGE_KEYS.AUDIT_LOGS, []);
    }
  }

  // ============================================================================
  // PRODUCTS
  // ============================================================================

  async listProducts(includeInactive = false): Promise<Product[]> {
    this.ensureInitialized();
    const list = this.getItem<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    return includeInactive ? list : list.filter((p) => p.isActive);
  }

  async getProductById(id: string): Promise<Product | null> {
    const list = await this.listProducts(true);
    return list.find((p) => p.id === id) || null;
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const list = await this.listProducts(true);
    if (list.some((p) => p.name.trim().toLowerCase() === data.name.trim().toLowerCase() && p.isActive)) {
      throw new Error(`A product named '${data.name}' already exists.`);
    }

    const now = new Date().toISOString();
    const newProd: Product = {
      ...data,
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };

    list.push(newProd);
    this.setItem(STORAGE_KEYS.PRODUCTS, list);

    this.recordAudit('Staff', 'CREATE_PRODUCT', 'PRODUCT', newProd.id, { name: newProd.name });
    return newProd;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const list = await this.listProducts(true);
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');

    const updated: Product = {
      ...list[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    this.setItem(STORAGE_KEYS.PRODUCTS, list);

    this.recordAudit('Staff', 'UPDATE_PRODUCT', 'PRODUCT', id, data);
    return updated;
  }

  async deactivateProduct(id: string): Promise<void> {
    await this.updateProduct(id, { isActive: false });
  }

  async safeDeleteProduct(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    const isReferenced = runs.some((r) => r.productId === id);

    if (isReferenced) {
      await this.deactivateProduct(id);
      return { deleted: false, deactivated: true };
    }

    const list = await this.listProducts(true);
    const filtered = list.filter((p) => p.id !== id);
    this.setItem(STORAGE_KEYS.PRODUCTS, filtered);

    this.recordAudit('Staff', 'DELETE_PRODUCT', 'PRODUCT', id, { deleted: true });
    return { deleted: true };
  }

  // ============================================================================
  // INGREDIENTS
  // ============================================================================

  async listIngredients(includeInactive = false): Promise<Ingredient[]> {
    this.ensureInitialized();
    const list = this.getItem<Ingredient[]>(STORAGE_KEYS.INGREDIENTS, []);
    return includeInactive ? list : list.filter((i) => i.isActive);
  }

  async getIngredientById(id: string): Promise<Ingredient | null> {
    const list = await this.listIngredients(true);
    return list.find((i) => i.id === id) || null;
  }

  async createIngredient(data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient> {
    const list = await this.listIngredients(true);
    if (list.some((i) => i.name.trim().toLowerCase() === data.name.trim().toLowerCase() && i.isActive)) {
      throw new Error(`An ingredient named '${data.name}' already exists.`);
    }

    const now = new Date().toISOString();
    const newIng: Ingredient = {
      ...data,
      id: `ing-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };

    list.push(newIng);
    this.setItem(STORAGE_KEYS.INGREDIENTS, list);

    this.recordAudit('Staff', 'CREATE_INGREDIENT', 'INGREDIENT', newIng.id, { name: newIng.name });
    return newIng;
  }

  async updateIngredient(id: string, data: Partial<Ingredient>): Promise<Ingredient> {
    const list = await this.listIngredients(true);
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Ingredient not found');

    const updated: Ingredient = {
      ...list[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    this.setItem(STORAGE_KEYS.INGREDIENTS, list);

    this.recordAudit('Staff', 'UPDATE_INGREDIENT', 'INGREDIENT', id, data);
    return updated;
  }

  async deactivateIngredient(id: string): Promise<void> {
    await this.updateIngredient(id, { isActive: false });
  }

  async safeDeleteIngredient(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    const isReferencedInRuns = runs.some((r) =>
      r.ingredientsConsumed?.some((c) => c.ingredientId === id)
    );

    const recipes = this.getItem<Recipe[]>(STORAGE_KEYS.RECIPES, []);
    const isReferencedInRecipes = recipes.some((rec) =>
      rec.ingredients?.some((item) => item.ingredientId === id)
    );

    if (isReferencedInRuns || isReferencedInRecipes) {
      await this.deactivateIngredient(id);
      return { deleted: false, deactivated: true };
    }

    const list = await this.listIngredients(true);
    const filtered = list.filter((i) => i.id !== id);
    this.setItem(STORAGE_KEYS.INGREDIENTS, filtered);

    this.recordAudit('Staff', 'DELETE_INGREDIENT', 'INGREDIENT', id, { deleted: true });
    return { deleted: true };
  }

  async adjustStock(params: {
    ingredientId: string;
    quantityDelta: number;
    reason: string;
    operatorName: string;
  }): Promise<{ ingredient: Ingredient; movement: StockMovement }> {
    const ing = await this.getIngredientById(params.ingredientId);
    if (!ing) throw new Error('Ingredient not found');

    const newStock = ing.currentStock + params.quantityDelta;
    if (newStock < 0) throw new Error('സ്റ്റോക്ക് 0 ആണ് അല്ലെങ്കിൽ കുറവാണ്. നെഗറ്റീവ് ആകാൻ കഴിയില്ല (Stock cannot be negative)');

    const updated = await this.updateIngredient(params.ingredientId, { currentStock: newStock });

    const movements = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemId: ing.id,
      itemType: 'ingredient',
      itemName: ing.name,
      movementType: params.quantityDelta >= 0 ? 'adjustment' : 'wastage',
      quantity: params.quantityDelta,
      unit: ing.unit,
      previousBalance: ing.currentStock,
      newBalance: newStock,
      reference: 'Manual Adjustment',
      operatorName: params.operatorName,
      reason: params.reason,
      createdAt: new Date().toISOString(),
    };

    movements.unshift(newMovement);
    this.setItem(STORAGE_KEYS.MOVEMENTS, movements);

    return { ingredient: updated, movement: newMovement };
  }

  // ============================================================================
  // RECIPES
  // ============================================================================

  async listRecipes(): Promise<Recipe[]> {
    return this.getItem<Recipe[]>(STORAGE_KEYS.RECIPES, []);
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    const list = await this.listRecipes();
    return list.find((r) => r.id === id) || null;
  }

  async getRecipeByProductId(productId: string): Promise<Recipe | null> {
    const list = await this.listRecipes();
    return list.find((r) => r.productId === productId && r.isActive) || null;
  }

  async saveRecipe(
    data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Recipe> {
    const list = await this.listRecipes();
    const now = new Date().toISOString();

    if (data.id) {
      const idx = list.findIndex((r) => r.id === data.id);
      if (idx !== -1) {
        const updated: Recipe = {
          ...list[idx],
          ...data,
          id: data.id,
          version: list[idx].version + 1,
          updatedAt: now,
        };
        list[idx] = updated;
        this.setItem(STORAGE_KEYS.RECIPES, list);
        return updated;
      }
    }

    const newRecipe: Recipe = {
      ...data,
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    list.push(newRecipe);
    this.setItem(STORAGE_KEYS.RECIPES, list);
    return newRecipe;
  }

  // ============================================================================
  // PRODUCTION OPERATIONS
  // ============================================================================

  async listProductionRuns(options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    productId?: string;
    status?: 'completed' | 'cancelled';
  }): Promise<ProductionRun[]> {
    let runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);

    if (options?.startDate) runs = runs.filter((r) => r.productionDate >= options.startDate!);
    if (options?.endDate) runs = runs.filter((r) => r.productionDate <= options.endDate!);
    if (options?.productId) runs = runs.filter((r) => r.productId === options.productId);
    if (options?.status) runs = runs.filter((r) => r.status === options.status);

    runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (options?.limit) runs = runs.slice(0, options.limit);
    return runs;
  }

  async getProductionRunById(id: string): Promise<ProductionRun | null> {
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    return runs.find((r) => r.id === id) || null;
  }

  async recordProductionRun(params: {
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
  }): Promise<ProductionRun> {
    const existingRuns = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    if (existingRuns.some((r) => r.runNumber === params.runNumber)) {
      throw new Error(`Production run with number "${params.runNumber}" already exists.`);
    }

    const product = await this.getProductById(params.productId);
    if (!product) throw new Error('Product not found');

    const ingredients = await this.listIngredients(true);
    const now = new Date().toISOString();
    const movements = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);

    // 1. Verify and deduct ingredient stocks
    const consumedDetails = params.ingredientsConsumed.map((c) => {
      const ing = ingredients.find((i) => i.id === c.ingredientId);
      if (!ing) throw new Error(`Ingredient ${c.ingredientId} not found`);

      if (ing.currentStock < c.actualQuantity) {
        throw new Error(
          `Insufficient stock for ${ing.name}: Available ${ing.currentStock} ${ing.unit}, required ${c.actualQuantity} ${c.unit}`
        );
      }

      const prev = ing.currentStock;
      ing.currentStock -= c.actualQuantity;
      ing.updatedAt = now;

      movements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        itemId: ing.id,
        itemType: 'ingredient',
        itemName: ing.name,
        movementType: 'production_consumption',
        quantity: -c.actualQuantity,
        unit: c.unit,
        previousBalance: prev,
        newBalance: ing.currentStock,
        reference: `Run ${params.runNumber}`,
        operatorName: params.operatorName,
        reason: `Consumed in production of ${product.name}`,
        createdAt: now,
      });

      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        expectedQuantity: c.expectedQuantity,
        actualQuantity: c.actualQuantity,
        unit: c.unit,
      };
    });

    // 2. Increment product stock
    const prevProdStock = product.currentStock;
    product.currentStock += params.actualQuantity;
    product.updatedAt = now;

    movements.unshift({
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemId: product.id,
      itemType: 'product',
      itemName: product.name,
      movementType: 'production_output',
      quantity: params.actualQuantity,
      unit: params.unit,
      previousBalance: prevProdStock,
      newBalance: product.currentStock,
      reference: `Run ${params.runNumber}`,
      operatorName: params.operatorName,
      reason: 'Finished production output',
      createdAt: now,
    });

    // Save updated stocks and movements
    this.setItem(STORAGE_KEYS.INGREDIENTS, ingredients);
    await this.updateProduct(product.id, { currentStock: product.currentStock });
    this.setItem(STORAGE_KEYS.MOVEMENTS, movements);

    // 3. Create run record
    const run: ProductionRun = {
      id: `run-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      runNumber: params.runNumber,
      productId: product.id,
      productName: product.name,
      recipeId: params.recipeId,
      recipeVersion: params.recipeVersion,
      productionDate: params.productionDate,
      plannedQuantity: params.plannedQuantity,
      actualQuantity: params.actualQuantity,
      unit: params.unit,
      status: 'completed',
      operatorName: params.operatorName,
      notes: params.notes,
      ingredientsConsumed: consumedDetails,
      createdAt: now,
      updatedAt: now,
    };

    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    runs.unshift(run);
    this.setItem(STORAGE_KEYS.RUNS, runs);

    this.recordAudit(
      params.operatorName,
      'RECORD_PRODUCTION_RUN',
      'PRODUCTION',
      run.id,
      { runNumber: run.runNumber, product: product.name, quantity: params.actualQuantity }
    );

    return run;
  }

  async cancelProductionRun(params: {
    runId: string;
    reason: string;
    operatorName: string;
  }): Promise<boolean> {
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    const idx = runs.findIndex((r) => r.id === params.runId);
    if (idx === -1) throw new Error('Run not found');

    const run = runs[idx];
    if (run.status === 'cancelled') throw new Error('Run is already cancelled');

    const now = new Date().toISOString();
    const ingredients = await this.listIngredients(true);
    const product = await this.getProductById(run.productId);
    const movements = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);

    // 1. Revert ingredient consumption
    for (const c of run.ingredientsConsumed) {
      const ing = ingredients.find((i) => i.id === c.ingredientId);
      if (ing) {
        const prev = ing.currentStock;
        ing.currentStock += c.actualQuantity;
        ing.updatedAt = now;

        movements.unshift({
          id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          itemId: ing.id,
          itemType: 'ingredient',
          itemName: ing.name,
          movementType: 'cancellation_reversal',
          quantity: c.actualQuantity,
          unit: c.unit,
          previousBalance: prev,
          newBalance: ing.currentStock,
          reference: `Reversal of ${run.runNumber}`,
          operatorName: params.operatorName,
          reason: params.reason,
          createdAt: now,
        });
      }
    }

    // 2. Deduct product output
    if (product) {
      const prev = product.currentStock;
      product.currentStock = Math.max(0, product.currentStock - run.actualQuantity);
      product.updatedAt = now;

      movements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        itemId: product.id,
        itemType: 'product',
        itemName: product.name,
        movementType: 'cancellation_reversal',
        quantity: -run.actualQuantity,
        unit: run.unit,
        previousBalance: prev,
        newBalance: product.currentStock,
        reference: `Reversal of ${run.runNumber}`,
        operatorName: params.operatorName,
        reason: params.reason,
        createdAt: now,
      });

      await this.updateProduct(product.id, { currentStock: product.currentStock });
    }

    // Save
    this.setItem(STORAGE_KEYS.INGREDIENTS, ingredients);
    this.setItem(STORAGE_KEYS.MOVEMENTS, movements);

    run.status = 'cancelled';
    run.cancellationReason = params.reason;
    run.cancelledAt = now;
    run.cancelledBy = params.operatorName;
    run.updatedAt = now;
    runs[idx] = run;
    this.setItem(STORAGE_KEYS.RUNS, runs);

    this.recordAudit(
      params.operatorName,
      'CANCEL_PRODUCTION_RUN',
      'PRODUCTION',
      run.id,
      { runNumber: run.runNumber, reason: params.reason }
    );

    return true;
  }

  async deleteProductionRun(runId: string): Promise<boolean> {
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);
    const run = runs.find((r) => r.id === runId);
    if (!run) return true;

    // Filter out run from storage
    const updatedRuns = runs.filter((r) => r.id !== runId);
    this.setItem(STORAGE_KEYS.RUNS, updatedRuns);

    // Clean up associated movements if any
    const movements = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
    const updatedMovements = movements.filter((m) => !m.reference.includes(run.runNumber));
    this.setItem(STORAGE_KEYS.MOVEMENTS, updatedMovements);

    this.recordAudit('System', 'DELETE_PRODUCTION_RUN', 'PRODUCTION', runId, {
      runNumber: run.runNumber,
      product: run.productName,
    });

    return true;
  }

  // ============================================================================
  // STOCK LEDGER
  // ============================================================================

  async getStockMovements(filter?: {
    itemId?: string;
    itemType?: 'ingredient' | 'product';
    type?: MovementType;
    limit?: number;
  }): Promise<StockMovement[]> {
    let list = this.getItem<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);

    if (filter?.itemId) list = list.filter((m) => m.itemId === filter.itemId);
    if (filter?.itemType) list = list.filter((m) => m.itemType === filter.itemType);
    if (filter?.type) list = list.filter((m) => m.movementType === filter.type);

    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  // ============================================================================
  // ADMIN AUTH & DASHBOARD
  // ============================================================================

  async isAdminInitialized(): Promise<boolean> {
    const sec = this.getItem<any>(STORAGE_KEYS.SECURITY, null);
    return Boolean(sec?.isInitialized);
  }

  async setupAdminPin(
    pin: string,
    recoveryKey: string
  ): Promise<{ success: boolean; sessionToken: string }> {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 numeric digits');
    }
    if (recoveryKey.trim().length < 6) {
      throw new Error('Recovery key must be at least 6 characters');
    }

    const sec = {
      pin, // In mock, store string; in Supabase, bcrypt salted hash
      recoveryKey,
      failedAttempts: 0,
      lockedUntil: null,
      isInitialized: true,
      updatedAt: new Date().toISOString(),
    };
    this.setItem(STORAGE_KEYS.SECURITY, sec);

    const token = `adm_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    this.setItem(STORAGE_KEYS.SESSIONS, { token, expiresAt });

    this.recordAudit('Shop Owner', 'SETUP_ADMIN_PIN', 'SECURITY', 'owner', { status: 'initialized' });
    return { success: true, sessionToken: token };
  }

  async verifyAdminPin(
    pin: string
  ): Promise<{ success: boolean; sessionToken?: string; needsSetup?: boolean }> {
    const sec = this.getItem<any>(STORAGE_KEYS.SECURITY, null);
    if (!sec || !sec.isInitialized) {
      return { success: false, needsSetup: true };
    }

    if (sec.lockedUntil && new Date(sec.lockedUntil) > new Date()) {
      throw new Error(`Account temporarily locked due to repeated failed attempts. Try again later.`);
    }

    if (!/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits');
    }

    if (sec.pin === pin) {
      sec.failedAttempts = 0;
      sec.lockedUntil = null;
      this.setItem(STORAGE_KEYS.SECURITY, sec);

      const token = `adm_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const expiresAt = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
      this.setItem(STORAGE_KEYS.SESSIONS, { token, expiresAt });

      this.recordAudit('Shop Owner', 'ADMIN_LOGIN_SUCCESS', 'SECURITY', 'owner', {});
      return { success: true, sessionToken: token };
    } else {
      sec.failedAttempts = (sec.failedAttempts || 0) + 1;
      if (sec.failedAttempts >= 5) {
        sec.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      this.setItem(STORAGE_KEYS.SECURITY, sec);

      this.recordAudit('Unknown', 'ADMIN_LOGIN_FAILED', 'SECURITY', 'owner', {
        attempts: sec.failedAttempts,
      });

      if (sec.failedAttempts >= 5) {
        throw new Error('Incorrect PIN. Account locked for 15 minutes due to 5 consecutive failed attempts.');
      } else {
        throw new Error(`Incorrect PIN. ${5 - sec.failedAttempts} attempt(s) remaining before lockout.`);
      }
    }
  }

  async resetAdminPinWithRecovery(
    recoveryKey: string,
    newPin: string
  ): Promise<{ success: boolean; message: string }> {
    const sec = this.getItem<any>(STORAGE_KEYS.SECURITY, null);
    if (!sec || !sec.isInitialized) {
      throw new Error('System security has not been initialized yet');
    }

    if (!/^\d{6}$/.test(newPin)) {
      throw new Error('New PIN must be exactly 6 digits');
    }

    if (sec.recoveryKey === recoveryKey.trim()) {
      sec.pin = newPin;
      sec.failedAttempts = 0;
      sec.lockedUntil = null;
      sec.updatedAt = new Date().toISOString();
      this.setItem(STORAGE_KEYS.SECURITY, sec);

      // Clear sessions
      this.removeItem(STORAGE_KEYS.SESSIONS);

      this.recordAudit('Shop Owner', 'ADMIN_PIN_RESET', 'SECURITY', 'owner', {});
      return { success: true, message: 'PIN reset successfully. Please log in with your new PIN.' };
    } else {
      throw new Error('Invalid recovery key phrase');
    }
  }

  async verifyAdminSession(token: string): Promise<boolean> {
    if (!token) return false;
    const sess = this.getItem<any>(STORAGE_KEYS.SESSIONS, null);
    if (!sess || sess.token !== token) return false;
    return new Date(sess.expiresAt) > new Date();
  }

  async getAdminDashboardMetrics(
    startDate: string,
    endDate: string
  ): Promise<AdminDashboardMetrics> {
    const products = await this.listProducts(true);
    const ingredients = await this.listIngredients(true);
    const runs = this.getItem<ProductionRun[]>(STORAGE_KEYS.RUNS, []);

    const todayStr = new Date().toISOString().split('T')[0];
    const runsToday = runs.filter((r) => r.productionDate === todayStr && r.status === 'completed');
    const qtyToday = runsToday.reduce((sum, r) => sum + r.actualQuantity, 0);

    const periodRuns = runs.filter(
      (r) => r.productionDate >= startDate && r.productionDate <= endDate && r.status === 'completed'
    );
    const qtyInPeriod = periodRuns.reduce((sum, r) => sum + r.actualQuantity, 0);

    // Group by product
    const productMap: Record<string, { totalQuantity: number; runCount: number; unit: string }> = {};
    for (const r of periodRuns) {
      if (!productMap[r.productName]) {
        productMap[r.productName] = { totalQuantity: 0, runCount: 0, unit: r.unit };
      }
      productMap[r.productName].totalQuantity += r.actualQuantity;
      productMap[r.productName].runCount += 1;
    }

    const byProduct = Object.entries(productMap).map(([productName, data]) => ({
      productName,
      unit: data.unit,
      totalQuantity: data.totalQuantity,
      runCount: data.runCount,
    }));

    // Group consumption
    const consMap: Record<string, { totalConsumed: number; category: string; unit: string }> = {};
    for (const r of periodRuns) {
      for (const c of r.ingredientsConsumed || []) {
        if (!consMap[c.ingredientName]) {
          const ing = ingredients.find((i) => i.id === c.ingredientId);
          consMap[c.ingredientName] = {
            totalConsumed: 0,
            category: ing?.category || 'other',
            unit: c.unit,
          };
        }
        consMap[c.ingredientName].totalConsumed += c.actualQuantity;
      }
    }

    const consumption = Object.entries(consMap).map(([ingredientName, data]) => ({
      ingredientName,
      category: data.category,
      unit: data.unit,
      totalConsumed: data.totalConsumed,
    }));

    const recentActivity = runs.slice(0, 8).map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      productName: r.productName,
      productionDate: r.productionDate,
      actualQuantity: r.actualQuantity,
      unit: r.unit,
      status: r.status,
      operatorName: r.operatorName,
      createdAt: r.createdAt,
    }));

    return {
      totalProducts: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      inactiveProducts: products.filter((p) => !p.isActive).length,
      totalIngredients: ingredients.length,
      runsToday: runsToday.length,
      qtyToday,
      runsInPeriod: periodRuns.length,
      qtyInPeriod,
      byProduct,
      consumption,
      recentActivity,
    };
  }

  async getAuditLogs(limit = 50): Promise<AuditLog[]> {
    const logs = this.getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    return logs.slice(0, limit);
  }

  private recordAudit(
    actor: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, any>
  ): void {
    const logs = this.getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    logs.unshift({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor,
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    });
    this.setItem(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 200));
  }
}
