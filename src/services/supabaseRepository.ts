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
  DailyClosing,
  DailyCostAllocation,
  PackagingItem,
  PackingRecord,
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  allocateDailySharedExpenses,
  calculateContinuousOilExpense,
  roundCurrency,
  roundStock,
} from './costing';

export class SupabaseRepository implements IEpsoRepository {
  private checkClient() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please supply valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      );
    }
    return supabase;
  }

  isSupabaseMode(): boolean {
    return true;
  }

  // ============================================================================
  // PRODUCTS
  // ============================================================================

  async listProducts(includeInactive = false): Promise<Product[]> {
    const client = this.checkClient();
    let query = client.from('products').select('*').order('name', { ascending: true });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      sku: row.sku || undefined,
      unit: row.unit,
      currentStock: Number(row.current_stock || 0),
      wholesalePrice: row.wholesale_price ? Number(row.wholesale_price) : undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getProductById(id: string): Promise<Product | null> {
    const client = this.checkClient();
    const { data, error } = await client.from('products').select('*').eq('id', id).single();
    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      sku: data.sku || undefined,
      unit: data.unit,
      currentStock: Number(data.current_stock || 0),
      wholesalePrice: data.wholesale_price ? Number(data.wholesale_price) : undefined,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const client = this.checkClient();
    const { data: created, error } = await client
      .from('products')
      .insert({
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        unit: data.unit || 'kg',
        current_stock: data.currentStock || 0,
        wholesale_price: data.wholesalePrice || 0,
        is_active: data.isActive !== false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit log
    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'CREATE_PRODUCT',
      entity_type: 'PRODUCT',
      entity_id: created.id,
      details: { name: created.name, unit: created.unit },
    });

    return {
      id: created.id,
      name: created.name,
      sku: created.sku || undefined,
      unit: created.unit,
      currentStock: Number(created.current_stock || 0),
      wholesalePrice: created.wholesale_price ? Number(created.wholesale_price) : undefined,
      isActive: created.is_active,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const client = this.checkClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.sku !== undefined) updates.sku = data.sku.trim();
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.currentStock !== undefined) updates.current_stock = data.currentStock;
    if (data.wholesalePrice !== undefined) updates.wholesale_price = data.wholesalePrice;
    if (data.isActive !== undefined) updates.is_active = data.isActive;

    const { data: updated, error } = await client
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Audit log
    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'UPDATE_PRODUCT',
      entity_type: 'PRODUCT',
      entity_id: id,
      details: updates,
    });

    return {
      id: updated.id,
      name: updated.name,
      sku: updated.sku || undefined,
      unit: updated.unit,
      currentStock: Number(updated.current_stock || 0),
      wholesalePrice: updated.wholesale_price ? Number(updated.wholesale_price) : undefined,
      isActive: updated.is_active,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  async deactivateProduct(id: string): Promise<void> {
    await this.updateProduct(id, { isActive: false });
  }

  async safeDeleteProduct(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const client = this.checkClient();

    // Check if referenced in historical production runs
    const { count, error: countErr } = await client
      .from('production_runs')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id);

    if (countErr) throw new Error(countErr.message);

    if (count && count > 0) {
      // Historical references exist - soft-delete (deactivate) to protect history
      await this.deactivateProduct(id);
      return { deleted: false, deactivated: true };
    }

    // Safe to hard delete
    const { error: delErr } = await client.from('products').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);

    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'DELETE_PRODUCT',
      entity_type: 'PRODUCT',
      entity_id: id,
      details: { deleted: true },
    });

    return { deleted: true };
  }

  // ============================================================================
  // INGREDIENTS
  // ============================================================================

  async listIngredients(includeInactive = false): Promise<Ingredient[]> {
    const client = this.checkClient();
    let query = client.from('ingredients').select('*').order('name', { ascending: true });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      currentStock: Number(row.current_stock || 0),
      minStock: Number(row.min_stock || 0),
      avgCostPerUnit: Number(row.avg_cost_per_unit || 0),
      isActive: row.is_active,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getIngredientById(id: string): Promise<Ingredient | null> {
    const client = this.checkClient();
    const { data, error } = await client.from('ingredients').select('*').eq('id', id).single();
    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      category: data.category,
      unit: data.unit,
      currentStock: Number(data.current_stock || 0),
      minStock: Number(data.min_stock || 0),
      avgCostPerUnit: Number(data.avg_cost_per_unit || 0),
      isActive: data.is_active,
      notes: data.notes || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createIngredient(data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient> {
    const client = this.checkClient();
    const { data: created, error } = await client
      .from('ingredients')
      .insert({
        name: data.name.trim(),
        category: data.category,
        unit: data.unit || 'kg',
        current_stock: data.currentStock || 0,
        min_stock: data.minStock || 0,
        avg_cost_per_unit: data.avgCostPerUnit || 0,
        is_active: data.isActive !== false,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'CREATE_INGREDIENT',
      entity_type: 'INGREDIENT',
      entity_id: created.id,
      details: { name: created.name, category: created.category, unit: created.unit },
    });

    return {
      id: created.id,
      name: created.name,
      category: created.category,
      unit: created.unit,
      currentStock: Number(created.current_stock || 0),
      minStock: Number(created.min_stock || 0),
      avgCostPerUnit: Number(created.avg_cost_per_unit || 0),
      isActive: created.is_active,
      notes: created.notes || undefined,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updateIngredient(id: string, data: Partial<Ingredient>): Promise<Ingredient> {
    const client = this.checkClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.category !== undefined) updates.category = data.category;
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.currentStock !== undefined) updates.current_stock = data.currentStock;
    if (data.minStock !== undefined) updates.min_stock = data.minStock;
    if (data.avgCostPerUnit !== undefined) updates.avg_cost_per_unit = data.avgCostPerUnit;
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    if (data.notes !== undefined) updates.notes = data.notes;

    const { data: updated, error } = await client
      .from('ingredients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'UPDATE_INGREDIENT',
      entity_type: 'INGREDIENT',
      entity_id: id,
      details: updates,
    });

    return {
      id: updated.id,
      name: updated.name,
      category: updated.category,
      unit: updated.unit,
      currentStock: Number(updated.current_stock || 0),
      minStock: Number(updated.min_stock || 0),
      avgCostPerUnit: Number(updated.avg_cost_per_unit || 0),
      isActive: updated.is_active,
      notes: updated.notes || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  async deactivateIngredient(id: string): Promise<void> {
    await this.updateIngredient(id, { isActive: false });
  }

  async safeDeleteIngredient(id: string): Promise<{ deleted: boolean; deactivated?: boolean }> {
    const client = this.checkClient();

    // Check if ingredient is referenced in production consumption or recipes
    const [c1, c2] = await Promise.all([
      client.from('production_consumption').select('*', { count: 'exact', head: true }).eq('ingredient_id', id),
      client.from('recipe_items').select('*', { count: 'exact', head: true }).eq('ingredient_id', id),
    ]);

    const totalRefs = (c1.count || 0) + (c2.count || 0);
    if (totalRefs > 0) {
      await this.deactivateIngredient(id);
      return { deleted: false, deactivated: true };
    }

    const { error } = await client.from('ingredients').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await client.from('audit_logs').insert({
      actor: 'Catalogue Staff',
      action: 'DELETE_INGREDIENT',
      entity_type: 'INGREDIENT',
      entity_id: id,
      details: { deleted: true },
    });

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
    const client = this.checkClient();

    const { data: mov, error } = await client
      .from('stock_movements')
      .insert({
        item_id: ing.id,
        item_type: 'ingredient',
        item_name: ing.name,
        movement_type: params.quantityDelta >= 0 ? 'adjustment' : 'wastage',
        quantity: params.quantityDelta,
        unit: ing.unit,
        previous_balance: ing.currentStock,
        new_balance: newStock,
        reference: 'Stock Adjustment',
        operator_name: params.operatorName,
        reason: params.reason,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      ingredient: updated,
      movement: {
        id: mov.id,
        itemId: mov.item_id,
        itemType: mov.item_type,
        itemName: mov.item_name,
        movementType: mov.movement_type,
        quantity: Number(mov.quantity),
        unit: mov.unit,
        previousBalance: Number(mov.previous_balance),
        newBalance: Number(mov.new_balance),
        reference: mov.reference,
        operatorName: mov.operator_name,
        reason: mov.reason,
        createdAt: mov.created_at,
      },
    };
  }

  // ============================================================================
  // RECIPES
  // ============================================================================

  async listRecipes(): Promise<Recipe[]> {
    const client = this.checkClient();
    const { data, error } = await client
      .from('recipes')
      .select('*, products(name), recipe_items(*, ingredients(name))')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.products?.name || 'Snack Product',
      version: row.version,
      baseOutputQuantity: Number(row.base_output_quantity),
      baseOutputUnit: row.base_output_unit,
      instructions: row.instructions || undefined,
      notes: row.notes || undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ingredients: (row.recipe_items || []).map((item: any) => ({
        ingredientId: item.ingredient_id,
        ingredientName: item.ingredients?.name || 'Ingredient',
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
    }));
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    const recipes = await this.listRecipes();
    return recipes.find((r) => r.id === id) || null;
  }

  async getRecipeByProductId(productId: string): Promise<Recipe | null> {
    const recipes = await this.listRecipes();
    return recipes.find((r) => r.productId === productId) || null;
  }

  async saveRecipe(
    data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Recipe> {
    const client = this.checkClient();

    let recipeId = data.id;
    if (!recipeId) {
      const { data: rec, error } = await client
        .from('recipes')
        .insert({
          product_id: data.productId,
          version: data.version || 1,
          base_output_quantity: data.baseOutputQuantity,
          base_output_unit: data.baseOutputUnit || 'kg',
          instructions: data.instructions || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      recipeId = rec.id;
    } else {
      await client
        .from('recipes')
        .update({
          base_output_quantity: data.baseOutputQuantity,
          base_output_unit: data.baseOutputUnit,
          instructions: data.instructions,
          notes: data.notes,
          version: (data.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipeId);

      // Clear existing items for replacement
      await client.from('recipe_items').delete().eq('recipe_id', recipeId);
    }

    // Insert recipe items
    if (data.ingredients.length > 0) {
      const items = data.ingredients.map((item) => ({
        recipe_id: recipeId,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
      }));
      const { error: itemErr } = await client.from('recipe_items').insert(items);
      if (itemErr) throw new Error(itemErr.message);
    }

    const saved = await this.getRecipeById(recipeId!);
    if (!saved) throw new Error('Recipe could not be retrieved after save');
    return saved;
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
    const client = this.checkClient();
    let query = client
      .from('production_runs')
      .select('*, products(name), production_consumption(*, ingredients(name))')
      .order('production_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.limit) query = query.limit(options.limit);
    if (options?.startDate) query = query.gte('production_date', options.startDate);
    if (options?.endDate) query = query.lte('production_date', options.endDate);
    if (options?.productId) query = query.eq('product_id', options.productId);
    if (options?.status) query = query.eq('status', options.status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      runNumber: row.run_number,
      productId: row.product_id,
      productName: row.products?.name || 'Product',
      recipeId: row.recipe_id || undefined,
      recipeVersion: row.recipe_version || undefined,
      productionDate: row.production_date,
      plannedQuantity: Number(row.planned_quantity),
      actualQuantity: Number(row.actual_quantity),
      unit: row.unit,
      status: row.status,
      cancellationReason: row.cancellation_reason || undefined,
      cancelledAt: row.cancelled_at || undefined,
      cancelledBy: row.cancelled_by || undefined,
      notes: row.notes || undefined,
      operatorName: row.operator_name,
      totalIngredientCost: Number(row.total_ingredient_cost) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ingredientsConsumed: (row.production_consumption || []).map((c: any) => ({
        ingredientId: c.ingredient_id,
        ingredientName: c.ingredients?.name || 'Ingredient',
        expectedQuantity: Number(c.expected_quantity || 0),
        actualQuantity: Number(c.actual_quantity),
        unit: c.unit,
        unitCost: Number(c.unit_cost) || 0,
        totalCost: Number(c.total_cost) || 0,
      })),
    }));
  }

  async getProductionRunById(id: string): Promise<ProductionRun | null> {
    const client = this.checkClient();
    const { data, error } = await client
      .from('production_runs')
      .select('*, products(name), production_consumption(*, ingredients(name))')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      runNumber: data.run_number,
      productId: data.product_id,
      productName: data.products?.name || 'Product',
      recipeId: data.recipe_id || undefined,
      recipeVersion: data.recipe_version || undefined,
      productionDate: data.production_date,
      plannedQuantity: Number(data.planned_quantity),
      actualQuantity: Number(data.actual_quantity),
      unit: data.unit,
      status: data.status,
      cancellationReason: data.cancellation_reason || undefined,
      cancelledAt: data.cancelled_at || undefined,
      cancelledBy: data.cancelled_by || undefined,
      notes: data.notes || undefined,
      operatorName: data.operator_name,
      totalIngredientCost: Number(data.total_ingredient_cost) || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      ingredientsConsumed: (data.production_consumption || []).map((c: any) => ({
        ingredientId: c.ingredient_id,
        ingredientName: c.ingredients?.name || 'Ingredient',
        expectedQuantity: Number(c.expected_quantity || 0),
        actualQuantity: Number(c.actual_quantity),
        unit: c.unit,
        unitCost: Number(c.unit_cost) || 0,
        totalCost: Number(c.total_cost) || 0,
      })),
    };
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
      unitCost?: number;
      totalCost?: number;
    }>;
  }): Promise<ProductionRun> {
    const client = this.checkClient();

    // Invoking PostgreSQL atomic stored procedure
    const { data: runId, error } = await client.rpc('record_production_run_atomic', {
      p_run_number: params.runNumber,
      p_product_id: params.productId,
      p_recipe_id: params.recipeId || null,
      p_recipe_version: params.recipeVersion || null,
      p_production_date: params.productionDate,
      p_planned_quantity: params.plannedQuantity,
      p_actual_quantity: params.actualQuantity,
      p_unit: params.unit,
      p_operator_name: params.operatorName,
      p_notes: params.notes || null,
      p_ingredients_consumed: params.ingredientsConsumed.map((i) => ({
        ingredient_id: i.ingredientId,
        expected_quantity: i.expectedQuantity,
        actual_quantity: i.actualQuantity,
        unit: i.unit,
        unit_cost: i.unitCost || 0,
        total_cost: i.totalCost || 0,
      })),
    });

    if (error) throw new Error(error.message);

    const saved = await this.getProductionRunById(runId);
    if (!saved) throw new Error('Production run saved but could not be loaded');
    return saved;
  }

  async cancelProductionRun(params: {
    runId: string;
    reason: string;
    operatorName: string;
  }): Promise<boolean> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('cancel_production_run_atomic', {
      p_run_id: params.runId,
      p_reason: params.reason,
      p_operator: params.operatorName,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async deleteProductionRun(runId: string): Promise<boolean> {
    const client = this.checkClient();
    const { data: run } = await client
      .from('production_runs')
      .select('id, run_number')
      .eq('id', runId)
      .maybeSingle();

    if (run?.run_number) {
      await client.from('stock_movements').delete().ilike('reference', `%${run.run_number}%`);
    }

    await client.from('production_consumption').delete().eq('run_id', runId);

    const { data, error } = await client
      .from('production_runs')
      .delete()
      .eq('id', runId)
      .select('id');

    if (error) throw new Error(error.message);
    return Boolean(data && data.length > 0);
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
    const client = this.checkClient();
    let query = client.from('stock_movements').select('*').order('created_at', { ascending: false });

    if (filter?.itemId) query = query.eq('item_id', filter.itemId);
    if (filter?.itemType) query = query.eq('item_type', filter.itemType);
    if (filter?.type) query = query.eq('movement_type', filter.type);
    if (filter?.limit) query = query.limit(filter.limit);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((m: any) => ({
      id: m.id,
      itemId: m.item_id,
      itemType: m.item_type,
      itemName: m.item_name,
      movementType: m.movement_type,
      quantity: Number(m.quantity),
      unit: m.unit,
      previousBalance: Number(m.previous_balance),
      newBalance: Number(m.new_balance),
      costPerUnit: m.cost_per_unit ? Number(m.cost_per_unit) : undefined,
      reference: m.reference,
      operatorName: m.operator_name,
      reason: m.reason || undefined,
      createdAt: m.created_at,
    }));
  }

  // ============================================================================
  // ADMIN AUTH & DASHBOARD
  // ============================================================================

  async isAdminInitialized(): Promise<boolean> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('is_admin_initialized');
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async setupAdminPin(
    pin: string,
    recoveryKey: string
  ): Promise<{ success: boolean; sessionToken: string }> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('setup_initial_admin_pin', {
      p_pin: pin,
      p_recovery_key: recoveryKey,
    });

    if (error) throw new Error(error.message);
    return {
      success: true,
      sessionToken: data.session_token,
    };
  }

  async verifyAdminPin(
    pin: string
  ): Promise<{ success: boolean; sessionToken?: string; needsSetup?: boolean }> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('verify_admin_pin', { p_pin: pin });

    if (error) throw new Error(error.message);
    if (data.needs_setup) {
      return { success: false, needsSetup: true };
    }

    return {
      success: true,
      sessionToken: data.session_token,
    };
  }

  async resetAdminPinWithRecovery(
    recoveryKey: string,
    newPin: string
  ): Promise<{ success: boolean; message: string }> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('reset_admin_pin_with_recovery', {
      p_recovery_key: recoveryKey,
      p_new_pin: newPin,
    });

    if (error) throw new Error(error.message);
    return {
      success: true,
      message: data.message || 'PIN reset successfully',
    };
  }

  async verifyAdminSession(token: string): Promise<boolean> {
    if (!token) return false;
    const client = this.checkClient();
    const { data, error } = await client.rpc('is_admin_session_valid', { p_token: token });
    if (error) return false;
    return Boolean(data);
  }

  async getAdminDashboardMetrics(
    startDate: string,
    endDate: string
  ): Promise<AdminDashboardMetrics> {
    const client = this.checkClient();
    const { data, error } = await client.rpc('get_admin_dashboard_metrics', {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) throw new Error(error.message);

    return {
      totalProducts: data.total_products || 0,
      activeProducts: data.active_products || 0,
      inactiveProducts: data.inactive_products || 0,
      totalIngredients: data.total_ingredients || 0,
      runsToday: data.runs_today || 0,
      qtyToday: Number(data.qty_today || 0),
      runsInPeriod: data.runs_in_period || 0,
      qtyInPeriod: Number(data.qty_in_period || 0),
      byProduct: (data.by_product || []).map((p: any) => ({
        productName: p.product_name,
        unit: p.unit,
        totalQuantity: Number(p.total_quantity || 0),
        runCount: Number(p.run_count || 0),
      })),
      consumption: (data.consumption || []).map((c: any) => ({
        ingredientName: c.ingredient_name,
        category: c.category,
        unit: c.unit,
        totalConsumed: Number(c.total_consumed || 0),
      })),
      recentActivity: (data.recent_activity || []).map((a: any) => ({
        id: a.id,
        runNumber: a.run_number,
        productName: a.product_name,
        productionDate: a.production_date,
        actualQuantity: Number(a.actual_quantity || 0),
        unit: a.unit,
        status: a.status,
        operatorName: a.operator_name,
        createdAt: a.created_at,
      })),
    };
  }

  async getAuditLogs(limit = 50): Promise<AuditLog[]> {
    const client = this.checkClient();
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id || undefined,
      details: row.details || undefined,
      createdAt: row.created_at,
    }));
  }

  // ============================================================================
  // DAILY CLOSING, OIL INVENTORY & SHARED EXPENSE ALLOCATIONS
  // ============================================================================

  async getDailyClosing(date: string): Promise<DailyClosing | null> {
    const client = this.checkClient();
    const { data, error } = await client
      .from('daily_closings')
      .select('*')
      .eq('production_date', date)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      productionDate: data.production_date,
      oilOpeningBalance: Number(data.oil_opening_balance) || 0,
      oilPurchases: Number(data.oil_purchases) || 0,
      oilClosingBalance: Number(data.oil_closing_balance) || 0,
      oilConsumed: Number(data.oil_consumed) || 0,
      oilCostPerKg: Number(data.oil_cost_per_kg) || 0,
      oilTotalExpense: Number(data.oil_total_expense) || 0,
      productionWages: Number(data.production_wages) || 0,
      totalSharedExpense: Number(data.total_shared_expense) || 0,
      totalProductionKg: Number(data.total_production_kg) || 0,
      status: data.status,
      notes: data.notes || undefined,
      closedBy: data.closed_by || 'Admin',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listDailyClosings(limit = 60): Promise<DailyClosing[]> {
    const client = this.checkClient();
    const { data, error } = await client
      .from('daily_closings')
      .select('*')
      .order('production_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data || []).map((d: any) => ({
      id: d.id,
      productionDate: d.production_date,
      oilOpeningBalance: Number(d.oil_opening_balance) || 0,
      oilPurchases: Number(d.oil_purchases) || 0,
      oilClosingBalance: Number(d.oil_closing_balance) || 0,
      oilConsumed: Number(d.oil_consumed) || 0,
      oilCostPerKg: Number(d.oil_cost_per_kg) || 0,
      oilTotalExpense: Number(d.oil_total_expense) || 0,
      productionWages: Number(d.production_wages) || 0,
      totalSharedExpense: Number(d.total_shared_expense) || 0,
      totalProductionKg: Number(d.total_production_kg) || 0,
      status: d.status,
      notes: d.notes || undefined,
      closedBy: d.closed_by || 'Admin',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async saveDailyClosing(params: {
    productionDate: string;
    oilOpeningBalance: number;
    oilPurchases: number;
    oilClosingBalance: number;
    oilCostPerKg: number;
    productionWages: number;
    notes?: string;
    closedBy: string;
  }): Promise<DailyClosing> {
    const client = this.checkClient();
    const {
      productionDate,
      oilOpeningBalance,
      oilPurchases,
      oilClosingBalance,
      oilCostPerKg,
      productionWages,
      notes = '',
      closedBy,
    } = params;

    const { oilConsumedKg, oilTotalExpense } = calculateContinuousOilExpense(
      oilOpeningBalance,
      oilPurchases,
      oilClosingBalance,
      oilCostPerKg
    );
    const totalSharedExpense = roundCurrency(oilTotalExpense + productionWages);

    const { data: runs, error: runsErr } = await client
      .from('production_runs')
      .select('id, product_id, actual_quantity, total_ingredient_cost, products(name)')
      .eq('production_date', productionDate)
      .eq('status', 'completed');

    if (runsErr) throw new Error(runsErr.message);

    const totalProductionKg = (runs || []).reduce((sum: number, r: any) => sum + (Number(r.actual_quantity) || 0), 0);

    const closingPayload = {
      production_date: productionDate,
      oil_opening_balance: oilOpeningBalance,
      oil_purchases: oilPurchases,
      oil_closing_balance: oilClosingBalance,
      oil_consumed: oilConsumedKg,
      oil_cost_per_kg: oilCostPerKg,
      oil_total_expense: oilTotalExpense,
      production_wages: productionWages,
      total_shared_expense: totalSharedExpense,
      total_production_kg: totalProductionKg,
      status: 'closed',
      notes: notes || null,
      closed_by: closedBy,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedClosing, error: closingErr } = await client
      .from('daily_closings')
      .upsert(closingPayload, { onConflict: 'production_date' })
      .select()
      .single();

    if (closingErr) throw new Error(closingErr.message);
    const closingId = upsertedClosing.id;

    // Group runs by product
    const productMap: Record<string, { productId: string; productName: string; totalProductionKg: number; batchCount: number; ingredientCost: number }> = {};
    for (const r of runs || []) {
      const pId = r.product_id;
      const pName = (r.products as any)?.name || 'Product';
      const qty = Number(r.actual_quantity) || 0;
      const ingCost = Number(r.total_ingredient_cost) || 0;

      if (!productMap[pId]) {
        productMap[pId] = {
          productId: pId,
          productName: pName,
          totalProductionKg: 0,
          batchCount: 0,
          ingredientCost: 0,
        };
      }
      productMap[pId].totalProductionKg += qty;
      productMap[pId].batchCount += 1;
      productMap[pId].ingredientCost += ingCost;
    }

    const allocations = allocateDailySharedExpenses(Object.values(productMap), oilTotalExpense, productionWages);

    await client.from('daily_cost_allocations').delete().eq('closing_id', closingId);

    if (allocations.length > 0) {
      const allocationsPayload = allocations.map((a) => ({
        closing_id: closingId,
        production_date: productionDate,
        product_id: a.productId,
        product_name: a.productName,
        total_production_kg: a.totalProductionKg,
        batch_count: a.batchCount,
        ingredient_cost: a.ingredientCost,
        allocated_oil_cost: a.allocatedOilCost,
        allocated_production_wages: a.allocatedProductionWages,
        total_production_cost: a.totalProductionCost,
        production_cost_per_kg: a.productionCostPerKg,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await client.from('daily_cost_allocations').insert(allocationsPayload);
    }

    // Update common oil inventory
    const { data: oilIng } = await client
      .from('ingredients')
      .select('id, current_stock')
      .or("name.eq.ഓയിൽ,name.ilike.%oil%")
      .limit(1)
      .maybeSingle();

    if (oilIng) {
      await client
        .from('ingredients')
        .update({
          current_stock: oilClosingBalance,
          avg_cost_per_unit: oilCostPerKg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', oilIng.id);

      if (oilConsumedKg > 0) {
        await client.from('stock_movements').insert({
          item_id: oilIng.id,
          item_type: 'ingredient',
          item_name: 'ഓയിൽ',
          movement_type: 'production_consumption',
          quantity: -oilConsumedKg,
          unit: 'kg',
          previous_balance: oilOpeningBalance + oilPurchases,
          new_balance: oilClosingBalance,
          cost_per_unit: oilCostPerKg,
          reference: `Daily Closing ${productionDate}`,
          operator_name: closedBy,
          reason: 'Daily shared factory oil consumption & loss',
          created_at: new Date().toISOString(),
        });
      }
    }

    return {
      id: upsertedClosing.id,
      productionDate: upsertedClosing.production_date,
      oilOpeningBalance: Number(upsertedClosing.oil_opening_balance),
      oilPurchases: Number(upsertedClosing.oil_purchases),
      oilClosingBalance: Number(upsertedClosing.oil_closing_balance),
      oilConsumed: Number(upsertedClosing.oil_consumed),
      oilCostPerKg: Number(upsertedClosing.oil_cost_per_kg),
      oilTotalExpense: Number(upsertedClosing.oil_total_expense),
      productionWages: Number(upsertedClosing.production_wages),
      totalSharedExpense: Number(upsertedClosing.total_shared_expense),
      totalProductionKg: Number(upsertedClosing.total_production_kg),
      status: upsertedClosing.status,
      notes: upsertedClosing.notes || undefined,
      closedBy: upsertedClosing.closed_by,
      createdAt: upsertedClosing.created_at,
      updatedAt: upsertedClosing.updated_at,
    };
  }

  async listCostAllocations(dateOrClosingId: string): Promise<DailyCostAllocation[]> {
    const client = this.checkClient();
    const isDate = dateOrClosingId.includes('-');
    let query = client.from('daily_cost_allocations').select('*');
    if (isDate) {
      query = query.eq('production_date', dateOrClosingId);
    } else {
      query = query.eq('closing_id', dateOrClosingId);
    }

    const { data, error } = await query.order('total_production_kg', { ascending: false });
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      closingId: row.closing_id,
      productionDate: row.production_date,
      productId: row.product_id,
      productName: row.product_name,
      totalProductionKg: Number(row.total_production_kg) || 0,
      batchCount: Number(row.batch_count) || 1,
      ingredientCost: Number(row.ingredient_cost) || 0,
      allocatedOilCost: Number(row.allocated_oil_cost) || 0,
      allocatedProductionWages: Number(row.allocated_production_wages) || 0,
      totalProductionCost: Number(row.total_production_cost) || 0,
      productionCostPerKg: Number(row.production_cost_per_kg) || 0,
      createdAt: row.created_at,
    }));
  }

  async listPackagingItems(productId?: string): Promise<PackagingItem[]> {
    const client = this.checkClient();
    let query = client.from('packaging_items').select('*, products(name)').order('size_grams', { ascending: true });
    if (productId) query = query.eq('product_id', productId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.products?.name || '',
      sizeLabel: row.size_label,
      sizeGrams: Number(row.size_grams) || 100,
      currentStock: Number(row.current_stock) || 0,
      unitCost: Number(row.unit_cost) || 0,
      packingLabourRate: Number(row.packing_labour_rate) || 1.0,
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async savePackagingItem(item: Partial<PackagingItem> & { productId: string; sizeLabel: string }): Promise<PackagingItem> {
    const client = this.checkClient();
    const payload = {
      product_id: item.productId,
      size_label: item.sizeLabel.trim(),
      size_grams: item.sizeGrams ?? 100,
      current_stock: item.currentStock ?? 0,
      unit_cost: item.unitCost ?? 0,
      packing_labour_rate: item.packingLabourRate ?? 1.0,
      is_active: item.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    if (item.id) {
      const { data, error } = await client
        .from('packaging_items')
        .update(payload)
        .eq('id', item.id)
        .select('*, products(name)')
        .single();

      if (error) throw new Error(error.message);
      return {
        id: data.id,
        productId: data.product_id,
        productName: data.products?.name || '',
        sizeLabel: data.size_label,
        sizeGrams: Number(data.size_grams),
        currentStock: Number(data.current_stock),
        unitCost: Number(data.unit_cost),
        packingLabourRate: Number(data.packing_labour_rate),
        isActive: data.is_active,
      };
    } else {
      const { data, error } = await client
        .from('packaging_items')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('*, products(name)')
        .single();

      if (error) throw new Error(error.message);
      return {
        id: data.id,
        productId: data.product_id,
        productName: data.products?.name || '',
        sizeLabel: data.size_label,
        sizeGrams: Number(data.size_grams),
        currentStock: Number(data.current_stock),
        unitCost: Number(data.unit_cost),
        packingLabourRate: Number(data.packing_labour_rate),
        isActive: data.is_active,
      };
    }
  }

  async deletePackagingItem(id: string): Promise<void> {
    const client = this.checkClient();
    const { error } = await client.from('packaging_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async recordPacking(params: {
    packingDate: string;
    productId: string;
    packagingItemId?: string;
    packetSize: string;
    packetsPacked: number;
    operatorName: string;
    notes?: string;
  }): Promise<PackingRecord> {
    const client = this.checkClient();
    const {
      packingDate,
      productId,
      packagingItemId,
      packetSize,
      packetsPacked,
      operatorName,
      notes = '',
    } = params;

    const { data: prod } = await client.from('products').select('name').eq('id', productId).single();
    const prodName = prod?.name || 'Product';

    let unitCost = 0;
    let labourRate = 1.0;
    let sizeGrams = 100;
    let currStock = 0;

    if (packagingItemId) {
      const { data: packItem } = await client
        .from('packaging_items')
        .select('*')
        .eq('id', packagingItemId)
        .single();

      if (packItem) {
        unitCost = Number(packItem.unit_cost) || 0;
        labourRate = Number(packItem.packing_labour_rate) || 1.0;
        sizeGrams = Number(packItem.size_grams) || 100;
        currStock = Number(packItem.current_stock) || 0;

        const newStock = Math.max(0, currStock - packetsPacked);
        await client
          .from('packaging_items')
          .update({ current_stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', packagingItemId);

        await client.from('stock_movements').insert({
          item_id: packagingItemId,
          item_type: 'ingredient',
          item_name: `${prodName} Covers (${packetSize})`,
          movement_type: 'production_consumption',
          quantity: -packetsPacked,
          unit: 'pcs',
          previous_balance: currStock,
          new_balance: newStock,
          cost_per_unit: unitCost,
          reference: `Packing ${packingDate}`,
          operator_name: operatorName,
          reason: `Packaging covers consumed for ${packetsPacked} packets`,
          created_at: new Date().toISOString(),
        });
      }
    }

    const packagingCost = roundCurrency(packetsPacked * unitCost);
    const packingLabourCost = roundCurrency(packetsPacked * labourRate);
    const totalPackingCost = roundCurrency(packagingCost + packingLabourCost);
    const weightPackedKg = roundStock((packetsPacked * sizeGrams) / 1000.0);

    const { data: created, error } = await client
      .from('packing_records')
      .insert({
        packing_date: packingDate,
        product_id: productId,
        packaging_item_id: packagingItemId || null,
        packet_size: packetSize,
        packets_packed: packetsPacked,
        covers_consumed: packetsPacked,
        cover_unit_cost: unitCost,
        packaging_cost: packagingCost,
        packing_labour_rate: labourRate,
        packing_labour_cost: packingLabourCost,
        total_packing_cost: totalPackingCost,
        weight_packed_kg: weightPackedKg,
        operator_name: operatorName,
        notes: notes || null,
        created_at: new Date().toISOString(),
      })
      .select('*, products(name)')
      .single();

    if (error) throw new Error(error.message);

    return {
      id: created.id,
      packingDate: created.packing_date,
      productId: created.product_id,
      productName: created.products?.name || prodName,
      packagingItemId: created.packaging_item_id,
      packetSize: created.packet_size,
      packetsPacked: Number(created.packets_packed),
      coversConsumed: Number(created.covers_consumed),
      coverUnitCost: Number(created.cover_unit_cost),
      packagingCost: Number(created.packaging_cost),
      packingLabourRate: Number(created.packing_labour_rate),
      packingLabourCost: Number(created.packing_labour_cost),
      totalPackingCost: Number(created.total_packing_cost),
      weightPackedKg: Number(created.weight_packed_kg),
      operatorName: created.operator_name,
      notes: created.notes,
      createdAt: created.created_at,
    };
  }

  async listPackingRecords(options?: { productId?: string; date?: string; limit?: number }): Promise<PackingRecord[]> {
    const client = this.checkClient();
    let query = client.from('packing_records').select('*, products(name)').order('created_at', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    if (options?.productId) query = query.eq('product_id', options.productId);
    if (options?.date) query = query.eq('packing_date', options.date);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      id: row.id,
      packingDate: row.packing_date,
      productId: row.product_id,
      productName: row.products?.name || 'Product',
      packagingItemId: row.packaging_item_id,
      packetSize: row.packet_size,
      packetsPacked: Number(row.packets_packed) || 0,
      coversConsumed: Number(row.covers_consumed) || 0,
      coverUnitCost: Number(row.cover_unit_cost) || 0,
      packagingCost: Number(row.packaging_cost) || 0,
      packingLabourRate: Number(row.packing_labour_rate) || 0,
      packingLabourCost: Number(row.packing_labour_cost) || 0,
      totalPackingCost: Number(row.total_packing_cost) || 0,
      weightPackedKg: Number(row.weight_packed_kg) || 0,
      operatorName: row.operator_name,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  }
}

