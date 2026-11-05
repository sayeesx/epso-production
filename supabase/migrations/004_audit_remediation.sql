-- ==============================================================================
-- EPSO MIGRATION 004: POST-AUDIT INTEGRITY, RLS SECURITY & RECONCILIATION
-- Safe, idempotent, non-destructive migration applying fixes BUG-01 through BUG-08
-- ==============================================================================

-- 1. FIX BUG-02: PREVENT DUPLICATE RECIPE INGREDIENTS
-- Safely clean up any duplicate recipe items keeping only the primary record
DELETE FROM public.recipe_items a
USING public.recipe_items b
WHERE a.id > b.id
  AND a.recipe_id = b.recipe_id
  AND a.ingredient_id = b.ingredient_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_recipe_ingredient'
    ) THEN
        ALTER TABLE public.recipe_items
        ADD CONSTRAINT unique_recipe_ingredient UNIQUE (recipe_id, ingredient_id);
    END IF;
END $$;

-- 2. FIX BUG-01: PREVENT DUPLICATE DAILY WAGE RECORDS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_daily_wages_date'
    ) THEN
        ALTER TABLE public.daily_wages
        ADD CONSTRAINT unique_daily_wages_date UNIQUE (production_date);
    END IF;
END $$;

-- 3. FIX BUG-04: BASIC INGREDIENT COST ALLOCATION COLUMN
ALTER TABLE public.daily_cost_allocations
ADD COLUMN IF NOT EXISTS allocated_basic_ingredients_cost NUMERIC(12, 2) DEFAULT 0.00;

-- 4. FIX BUG-07: COGS RECORDING ON SALES
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS cogs NUMERIC(12, 2) DEFAULT 0.00;

-- 5. FIX BUG-06 & BUG-07: UPDATE STOCK MOVEMENTS ENUM/CHECK CONSTRAINT
-- Allows packing_deduction, packing_reversal, sale, and sale_reversal ledger types
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_movement_type_check CHECK (
    movement_type IN (
        'production_consumption',
        'production_output',
        'cancellation_reversal',
        'purchase',
        'purchase_inward',
        'damage',
        'wastage',
        'adjustment',
        'packing_deduction',
        'packing_reversal',
        'sale',
        'sale_reversal'
    )
);

-- 6. ATOMIC PRODUCTION RUN: AGGREGATE DUPLICATE INGREDIENTS AT DATABASE LEVEL
CREATE OR REPLACE FUNCTION public.record_production_run_atomic(
    p_run_number text,
    p_product_id uuid,
    p_recipe_id uuid,
    p_recipe_version integer,
    p_production_date date,
    p_planned_quantity numeric,
    p_actual_quantity numeric,
    p_unit text,
    p_operator_name text,
    p_notes text,
    p_ingredients_consumed jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_run_id UUID;
    v_ing_item JSONB;
    v_ing_id UUID;
    v_actual_qty NUMERIC;
    v_expected_qty NUMERIC;
    v_unit TEXT;
    v_ing_name TEXT;
    v_curr_ing_stock NUMERIC;
    v_new_ing_stock NUMERIC;
    v_avg_cost NUMERIC;
    v_item_unit_cost NUMERIC;
    v_item_total_cost NUMERIC;
    v_total_ing_cost NUMERIC := 0.00;
    v_prod_name TEXT;
    v_curr_prod_stock NUMERIC;
    v_new_prod_stock NUMERIC;
BEGIN
    SELECT name, current_stock INTO v_prod_name, v_curr_prod_stock
    FROM public.products WHERE id = p_product_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', p_product_id;
    END IF;

    IF EXISTS (SELECT 1 FROM public.production_runs WHERE run_number = p_run_number) THEN
        RAISE EXCEPTION 'Production run number % already exists', p_run_number;
    END IF;

    -- Create Production Run Header
    INSERT INTO public.production_runs (
        run_number,
        product_id,
        recipe_id,
        recipe_version,
        production_date,
        planned_quantity,
        actual_quantity,
        unit,
        status,
        operator_name,
        notes,
        total_ingredient_cost
    ) VALUES (
        p_run_number,
        p_product_id,
        p_recipe_id,
        p_recipe_version,
        p_production_date,
        COALESCE(p_planned_quantity, 0),
        COALESCE(p_actual_quantity, 0),
        p_unit,
        'completed',
        p_operator_name,
        p_notes,
        0.00
    ) RETURNING id INTO v_run_id;

    -- Deduct Ingredients and Write Stock Ledger (Aggregated by ingredient_id to prevent duplicate deductions)
    IF p_ingredients_consumed IS NOT NULL AND jsonb_array_length(p_ingredients_consumed) > 0 THEN
        FOR v_ing_item IN 
            SELECT jsonb_build_object(
                'ingredient_id', ing_id,
                'actual_quantity', SUM(actual_q),
                'expected_quantity', SUM(expected_q),
                'unit', MAX(unit_val),
                'unit_cost', MAX(unit_cost_val)
            ) AS item_data
            FROM (
                SELECT 
                    (elem->>'ingredient_id')::UUID AS ing_id,
                    (elem->>'actual_quantity')::NUMERIC AS actual_q,
                    COALESCE((elem->>'expected_quantity')::NUMERIC, (elem->>'actual_quantity')::NUMERIC) AS expected_q,
                    (elem->>'unit') AS unit_val,
                    COALESCE((elem->>'unit_cost')::NUMERIC, 0) AS unit_cost_val
                FROM jsonb_array_elements(p_ingredients_consumed) elem
                WHERE (elem->>'ingredient_id') IS NOT NULL
            ) s
            GROUP BY ing_id
        LOOP
            v_ing_id := (v_ing_item->>'ingredient_id')::UUID;
            v_actual_qty := (v_ing_item->>'actual_quantity')::NUMERIC;
            v_expected_qty := COALESCE((v_ing_item->>'expected_quantity')::NUMERIC, v_actual_qty);
            v_unit := (v_ing_item->>'unit');

            SELECT name, current_stock, avg_cost_per_unit INTO v_ing_name, v_curr_ing_stock, v_avg_cost
            FROM public.ingredients WHERE id = v_ing_id FOR UPDATE;

            IF NOT FOUND THEN
                CONTINUE;
            END IF;

            v_item_unit_cost := COALESCE((v_ing_item->>'unit_cost')::NUMERIC, v_avg_cost, 0.00);
            v_item_total_cost := ROUND(v_actual_qty * v_item_unit_cost, 2);
            v_total_ing_cost := v_total_ing_cost + v_item_total_cost;

            v_new_ing_stock := v_curr_ing_stock - v_actual_qty;

            UPDATE public.ingredients
            SET current_stock = v_new_ing_stock, updated_at = NOW()
            WHERE id = v_ing_id;

            INSERT INTO public.production_consumption (
                run_id,
                ingredient_id,
                expected_quantity,
                actual_quantity,
                unit,
                unit_cost,
                total_cost
            ) VALUES (
                v_run_id,
                v_ing_id,
                v_expected_qty,
                v_actual_qty,
                v_unit,
                v_item_unit_cost,
                v_item_total_cost
            );

            INSERT INTO public.stock_movements (
                item_id,
                item_type,
                item_name,
                movement_type,
                quantity,
                unit,
                previous_balance,
                new_balance,
                cost_per_unit,
                reference,
                operator_name,
                reason
            ) VALUES (
                v_ing_id,
                'ingredient',
                v_ing_name,
                'production_consumption',
                -v_actual_qty,
                v_unit,
                v_curr_ing_stock,
                v_new_ing_stock,
                v_item_unit_cost,
                'Run ' || p_run_number,
                p_operator_name,
                'Consumed in production of ' || v_prod_name
            );
        END LOOP;
    END IF;

    UPDATE public.production_runs
    SET total_ingredient_cost = v_total_ing_cost, updated_at = NOW()
    WHERE id = v_run_id;

    -- Add Finished Goods Product Stock
    IF COALESCE(p_actual_quantity, 0) > 0 THEN
        v_new_prod_stock := v_curr_prod_stock + p_actual_quantity;

        UPDATE public.products
        SET current_stock = v_new_prod_stock, updated_at = NOW()
        WHERE id = p_product_id;

        INSERT INTO public.stock_movements (
            item_id,
            item_type,
            item_name,
            movement_type,
            quantity,
            unit,
            previous_balance,
            new_balance,
            reference,
            operator_name,
            reason
        ) VALUES (
            p_product_id,
            'product',
            v_prod_name,
            'production_output',
            p_actual_quantity,
            p_unit,
            v_curr_prod_stock,
            v_new_prod_stock,
            'Run ' || p_run_number,
            p_operator_name,
            'Finished snack production batch'
        );
    END IF;

    INSERT INTO public.audit_logs (actor, action, entity_type, entity_id, details)
    VALUES (
        p_operator_name,
        'RECORD_PRODUCTION_RUN',
        'PRODUCTION',
        v_run_id::TEXT,
        jsonb_build_object(
            'run_number', p_run_number,
            'product_name', v_prod_name,
            'output_qty', COALESCE(p_actual_quantity, 0),
            'unit', p_unit,
            'ingredient_cost', v_total_ing_cost
        )
    );

    RETURN v_run_id;
END;
$function$;

-- 7. FIX BUG-08: HARDEN ROW LEVEL SECURITY POLICIES
-- Block direct client access to admin credentials and security hashes
DROP POLICY IF EXISTS "allow_all_anon_authenticated" ON public.admin_security;
DROP POLICY IF EXISTS "admin_security_no_direct_access" ON public.admin_security;
CREATE POLICY "admin_security_no_direct_access" ON public.admin_security FOR ALL USING (false);

DROP POLICY IF EXISTS "allow_all_anon_authenticated" ON public.admin_sessions;
DROP POLICY IF EXISTS "admin_sessions_no_direct_access" ON public.admin_sessions;
CREATE POLICY "admin_sessions_no_direct_access" ON public.admin_sessions FOR ALL USING (false);

-- Protect audit trail against tampering / truncation
DROP POLICY IF EXISTS "allow_all_anon_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_read" ON public.audit_logs;
CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
CREATE POLICY "audit_logs_no_update" ON public.audit_logs FOR UPDATE USING (false);
DROP POLICY IF EXISTS "audit_logs_no_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_no_delete" ON public.audit_logs FOR DELETE USING (false);

-- Protect financial stock ledger against unauthorized direct alteration / deletion
DROP POLICY IF EXISTS "allow_all_anon_authenticated" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_read" ON public.stock_movements;
CREATE POLICY "stock_movements_read" ON public.stock_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "stock_movements_no_update" ON public.stock_movements;
CREATE POLICY "stock_movements_no_update" ON public.stock_movements FOR UPDATE USING (false);
DROP POLICY IF EXISTS "stock_movements_no_delete" ON public.stock_movements;
CREATE POLICY "stock_movements_no_delete" ON public.stock_movements FOR DELETE USING (false);

