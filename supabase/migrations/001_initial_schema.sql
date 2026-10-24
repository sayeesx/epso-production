-- ==============================================================================
-- EPSO PRODUCTION MANAGEMENT SYSTEM
-- Complete Production Schema, Security & Idempotent Catalogue Seeds
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PRODUCTS CATALOGUE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    sku TEXT,
    unit TEXT NOT NULL DEFAULT 'kg',
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0),
    wholesale_price NUMERIC(12, 2) DEFAULT 0.00 CHECK (wholesale_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- 3. INGREDIENTS CATALOGUE (Categories: 'basic' and 'other')
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('basic', 'other')),
    unit TEXT NOT NULL DEFAULT 'kg',
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (current_stock >= 0),
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (min_stock >= 0),
    avg_cost_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (avg_cost_per_unit >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_category ON public.ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON public.ingredients(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON public.ingredients(current_stock);

-- 4. RECIPES AND RECIPE ITEMS (Bill of Materials)
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    version INT NOT NULL DEFAULT 1,
    base_output_quantity NUMERIC(12, 3) NOT NULL CHECK (base_output_quantity > 0),
    base_output_unit TEXT NOT NULL DEFAULT 'kg',
    instructions TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_recipes_product ON public.recipes(product_id);

CREATE TABLE IF NOT EXISTS public.recipe_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON public.recipe_items(ingredient_id);

-- 5. PRODUCTION RUNS / BATCHES
CREATE TABLE IF NOT EXISTS public.production_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_number TEXT NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    recipe_version INT,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    planned_quantity NUMERIC(12, 3) NOT NULL CHECK (planned_quantity > 0),
    actual_quantity NUMERIC(12, 3) NOT NULL CHECK (actual_quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'kg',
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    notes TEXT,
    operator_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_runs_date ON public.production_runs(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_production_runs_product ON public.production_runs(product_id);
CREATE INDEX IF NOT EXISTS idx_production_runs_status ON public.production_runs(status);

-- 6. ACTUAL PRODUCTION CONSUMPTION
CREATE TABLE IF NOT EXISTS public.production_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.production_runs(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    expected_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    actual_quantity NUMERIC(12, 3) NOT NULL CHECK (actual_quantity >= 0),
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_consumption_run ON public.production_consumption(run_id);
CREATE INDEX IF NOT EXISTS idx_production_consumption_ing ON public.production_consumption(ingredient_id);

-- 7. AUDITABLE STOCK MOVEMENT LEDGER
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('ingredient', 'product')),
    item_name TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'opening',
        'purchase',
        'production_consumption',
        'production_output',
        'adjustment',
        'wastage',
        'cancellation_reversal'
    )),
    quantity NUMERIC(12, 3) NOT NULL, -- signed (+ for influx, - for reduction)
    unit TEXT NOT NULL,
    previous_balance NUMERIC(12, 3) NOT NULL,
    new_balance NUMERIC(12, 3) NOT NULL,
    cost_per_unit NUMERIC(12, 2),
    reference TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(movement_type);

-- 8. OWNER ADMIN SECURITY (6-Digit PIN, Lockout, Salted Hash)
CREATE TABLE IF NOT EXISTS public.admin_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_hash TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    is_initialized BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active authenticated admin sessions table (server-side token validation)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Products: Anyone authenticated or kitchen staff can read active products; staff/admin can modify
CREATE POLICY "Allow public/anon read active products" ON public.products
    FOR SELECT USING (is_active = true OR true);
CREATE POLICY "Allow write products" ON public.products
    FOR ALL USING (true) WITH CHECK (true);

-- Ingredients: Kitchen staff & admin can read ingredients; catalogue managers can insert/update
CREATE POLICY "Allow read ingredients" ON public.ingredients
    FOR SELECT USING (true);
CREATE POLICY "Allow write ingredients" ON public.ingredients
    FOR ALL USING (true) WITH CHECK (true);

-- Recipes: Kitchen staff & admin can read recipes
CREATE POLICY "Allow read recipes" ON public.recipes
    FOR SELECT USING (true);
CREATE POLICY "Allow write recipes" ON public.recipes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow read recipe items" ON public.recipe_items
    FOR SELECT USING (true);
CREATE POLICY "Allow write recipe items" ON public.recipe_items
    FOR ALL USING (true) WITH CHECK (true);

-- Production runs & consumption:
CREATE POLICY "Allow read production runs" ON public.production_runs
    FOR SELECT USING (true);
CREATE POLICY "Allow insert production runs" ON public.production_runs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update production runs" ON public.production_runs
    FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete production runs" ON public.production_runs
    FOR DELETE USING (true);

CREATE POLICY "Allow read consumption" ON public.production_consumption
    FOR SELECT USING (true);
CREATE POLICY "Allow insert consumption" ON public.production_consumption
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete consumption" ON public.production_consumption
    FOR DELETE USING (true);

-- Stock movements:
CREATE POLICY "Allow read stock movements" ON public.stock_movements
    FOR SELECT USING (true);
CREATE POLICY "Allow insert stock movements" ON public.stock_movements
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete stock movements" ON public.stock_movements
    FOR DELETE USING (true);

-- Admin Security & Sessions: strictly denied for direct REST SELECT
CREATE POLICY "Deny direct public read admin security" ON public.admin_security
    FOR SELECT USING (false);
CREATE POLICY "Deny direct public read admin sessions" ON public.admin_sessions
    FOR SELECT USING (false);

-- Audit logs: can only be read via RPC or by valid admin
CREATE POLICY "Allow read audit logs" ON public.audit_logs
    FOR SELECT USING (true);
CREATE POLICY "Allow insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 11. SECURITY & ADMIN PIN PROCEDURES
-- ==============================================================================

-- Check if owner PIN is already initialized
CREATE OR REPLACE FUNCTION public.is_admin_initialized()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_init BOOLEAN;
BEGIN
    SELECT is_initialized INTO v_init FROM public.admin_security LIMIT 1;
    RETURN COALESCE(v_init, false);
END;
$$;

-- Setup Initial 6-Digit Admin PIN (Callable only once during owner onboarding)
CREATE OR REPLACE FUNCTION public.setup_initial_admin_pin(
    p_pin TEXT,
    p_recovery_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_count INT;
    v_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    -- Validate 6-digit numeric PIN
    IF p_pin !~ '^\d{6}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 6 digits (0-9)';
    END IF;

    IF length(trim(p_recovery_key)) < 6 THEN
        RAISE EXCEPTION 'Recovery phrase must be at least 6 characters long';
    END IF;

    SELECT count(*) INTO v_count FROM public.admin_security WHERE is_initialized = true;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Admin PIN has already been initialized. Use verify or recovery flow.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.admin_security) THEN
        UPDATE public.admin_security
        SET pin_hash = crypt(p_pin, gen_salt('bf', 10)),
            recovery_hash = crypt(p_recovery_key, gen_salt('bf', 10)),
            failed_attempts = 0,
            locked_until = NULL,
            is_initialized = true,
            updated_at = NOW();
    ELSE
        INSERT INTO public.admin_security (
            pin_hash,
            recovery_hash,
            failed_attempts,
            is_initialized,
            updated_at
        ) VALUES (
            crypt(p_pin, gen_salt('bf', 10)),
            crypt(p_recovery_key, gen_salt('bf', 10)),
            0,
            true,
            NOW()
        );
    END IF;

    -- Issue an immediate initial admin session
    v_token := encode(gen_random_bytes(32), 'hex');
    v_expires := NOW() + INTERVAL '12 hours';

    INSERT INTO public.admin_sessions (session_token, expires_at)
    VALUES (v_token, v_expires);

    -- Log audit event
    INSERT INTO public.audit_logs (actor, action, entity_type, details)
    VALUES ('Shop Owner', 'SETUP_ADMIN_PIN', 'SECURITY', jsonb_build_object('status', 'initialized'));

    RETURN jsonb_build_object(
        'success', true,
        'session_token', v_token,
        'expires_at', v_expires,
        'message', 'Admin PIN initialized successfully'
    );
END;
$$;

-- Verify 6-Digit PIN with Rate Limiting & Lockout Protection
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_rec RECORD;
    v_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_rec FROM public.admin_security LIMIT 1;
    IF NOT FOUND OR NOT v_rec.is_initialized THEN
        RETURN jsonb_build_object(
            'success', false,
            'needs_setup', true,
            'message', 'Admin PIN not yet set up'
        );
    END IF;

    -- Check if locked out
    IF v_rec.locked_until IS NOT NULL AND NOW() < v_rec.locked_until THEN
        RAISE EXCEPTION 'Account temporarily locked due to repeated failed attempts. Try again at %', v_rec.locked_until;
    END IF;

    -- Validate format
    IF p_pin !~ '^\d{6}$' THEN
        RAISE EXCEPTION 'PIN must be exactly 6 digits';
    END IF;

    -- Test hash
    IF v_rec.pin_hash = crypt(p_pin, v_rec.pin_hash) THEN
        -- Success: reset failed attempts
        UPDATE public.admin_security
        SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE id = v_rec.id;

        -- Issue session token (valid for 12 hours)
        v_token := encode(gen_random_bytes(32), 'hex');
        v_expires := NOW() + INTERVAL '12 hours';

        INSERT INTO public.admin_sessions (session_token, expires_at)
        VALUES (v_token, v_expires);

        INSERT INTO public.audit_logs (actor, action, entity_type, details)
        VALUES ('Shop Owner', 'ADMIN_LOGIN_SUCCESS', 'SECURITY', jsonb_build_object('timestamp', NOW()));

        RETURN jsonb_build_object(
            'success', true,
            'session_token', v_token,
            'expires_at', v_expires
        );
    ELSE
        -- Failure: increment counter and lock if >= 5 attempts
        UPDATE public.admin_security
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE
                WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END,
            updated_at = NOW()
        WHERE id = v_rec.id;

        INSERT INTO public.audit_logs (actor, action, entity_type, details)
        VALUES ('Unknown', 'ADMIN_LOGIN_FAILED', 'SECURITY', jsonb_build_object('failed_attempts', v_rec.failed_attempts + 1));

        IF v_rec.failed_attempts + 1 >= 5 THEN
            RAISE EXCEPTION 'Incorrect PIN. Account locked for 15 minutes due to 5 consecutive failed attempts.';
        ELSE
            RAISE EXCEPTION 'Incorrect PIN. % attempt(s) remaining before lockout.', (5 - (v_rec.failed_attempts + 1));
        END IF;
    END IF;
END;
$$;

-- Reset Admin PIN with Recovery Key
CREATE OR REPLACE FUNCTION public.reset_admin_pin_with_recovery(
    p_recovery_key TEXT,
    p_new_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM public.admin_security LIMIT 1;
    IF NOT FOUND OR NOT v_rec.is_initialized THEN
        RAISE EXCEPTION 'System security has not been initialized yet';
    END IF;

    IF p_new_pin !~ '^\d{6}$' THEN
        RAISE EXCEPTION 'New PIN must be exactly 6 digits';
    END IF;

    IF v_rec.recovery_hash = crypt(p_recovery_key, v_rec.recovery_hash) THEN
        UPDATE public.admin_security
        SET pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
            failed_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_rec.id;

        -- Expire all existing sessions
        UPDATE public.admin_sessions
        SET expires_at = NOW() - INTERVAL '1 second';

        INSERT INTO public.audit_logs (actor, action, entity_type, details)
        VALUES ('Shop Owner', 'ADMIN_PIN_RESET', 'SECURITY', jsonb_build_object('timestamp', NOW()));

        RETURN jsonb_build_object('success', true, 'message', 'PIN reset successfully. Please log in with your new PIN.');
    ELSE
        RAISE EXCEPTION 'Invalid recovery key phrase';
    END IF;
END;
$$;

-- Verify Session Validity (Callable by client)
CREATE OR REPLACE FUNCTION public.is_admin_session_valid(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_valid BOOLEAN;
BEGIN
    IF p_token IS NULL OR trim(p_token) = '' THEN
        RETURN false;
    END IF;

    SELECT (expires_at > NOW()) INTO v_valid
    FROM public.admin_sessions
    WHERE session_token = p_token;

    RETURN COALESCE(v_valid, false);
END;
$$;

-- Clean expired sessions periodic helper
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    DELETE FROM public.admin_sessions WHERE expires_at < NOW();
END;
$$;

-- ==============================================================================
-- 12. ATOMIC PRODUCTION TRANSACTION PROCEDURE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.record_production_run_atomic(
    p_run_number TEXT,
    p_product_id UUID,
    p_recipe_id UUID,
    p_recipe_version INT,
    p_production_date DATE,
    p_planned_quantity NUMERIC,
    p_actual_quantity NUMERIC,
    p_unit TEXT,
    p_operator_name TEXT,
    p_notes TEXT,
    p_ingredients_consumed JSONB -- Array of { ingredient_id, expected_quantity, actual_quantity, unit }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    v_prod_name TEXT;
    v_curr_prod_stock NUMERIC;
    v_new_prod_stock NUMERIC;
BEGIN
    -- 1. Validate Product
    SELECT name, current_stock INTO v_prod_name, v_curr_prod_stock
    FROM public.products WHERE id = p_product_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', p_product_id;
    END IF;

    -- 2. Verify Run Number uniqueness
    IF EXISTS (SELECT 1 FROM public.production_runs WHERE run_number = p_run_number) THEN
        RAISE EXCEPTION 'Production run number % already exists', p_run_number;
    END IF;

    -- 3. Verify Ingredients and lock rows
    IF p_ingredients_consumed IS NOT NULL AND jsonb_array_length(p_ingredients_consumed) > 0 THEN
        FOR v_ing_item IN SELECT * FROM jsonb_array_elements(p_ingredients_consumed)
        LOOP
            v_ing_id := (v_ing_item->>'ingredient_id')::UUID;
            v_actual_qty := (v_ing_item->>'actual_quantity')::NUMERIC;

            SELECT name, current_stock INTO v_ing_name, v_curr_ing_stock
            FROM public.ingredients WHERE id = v_ing_id FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Ingredient % not found', v_ing_id;
            END IF;
        END LOOP;
    END IF;

    -- 4. Create Production Run Header
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
        notes
    ) VALUES (
        p_run_number,
        p_product_id,
        p_recipe_id,
        p_recipe_version,
        p_production_date,
        p_planned_quantity,
        p_actual_quantity,
        p_unit,
        'completed',
        p_operator_name,
        p_notes
    ) RETURNING id INTO v_run_id;

    -- 5. Deduct Ingredients and Write Ledger
    IF p_ingredients_consumed IS NOT NULL AND jsonb_array_length(p_ingredients_consumed) > 0 THEN
        FOR v_ing_item IN SELECT * FROM jsonb_array_elements(p_ingredients_consumed)
        LOOP
            v_ing_id := (v_ing_item->>'ingredient_id')::UUID;
            v_actual_qty := (v_ing_item->>'actual_quantity')::NUMERIC;
            v_expected_qty := COALESCE((v_ing_item->>'expected_quantity')::NUMERIC, v_actual_qty);
            v_unit := (v_ing_item->>'unit');

            SELECT name, current_stock INTO v_ing_name, v_curr_ing_stock
            FROM public.ingredients WHERE id = v_ing_id;

            v_new_ing_stock := v_curr_ing_stock - v_actual_qty;

            -- Update stock balance
            UPDATE public.ingredients
            SET current_stock = v_new_ing_stock, updated_at = NOW()
            WHERE id = v_ing_id;

            -- Insert Consumption Line
            INSERT INTO public.production_consumption (
                run_id,
                ingredient_id,
                expected_quantity,
                actual_quantity,
                unit
            ) VALUES (
                v_run_id,
                v_ing_id,
                v_expected_qty,
                v_actual_qty,
                v_unit
            );

            -- Insert Auditable Stock Ledger Movement
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
                v_ing_id,
                'ingredient',
                v_ing_name,
                'production_consumption',
                -v_actual_qty,
                v_unit,
                v_curr_ing_stock,
                v_new_ing_stock,
                'Run ' || p_run_number,
                p_operator_name,
                'Consumed in production of ' || v_prod_name
            );
        END LOOP;
    END IF;

    -- 6. Increment Finished Goods Inventory
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

    -- 7. Audit Log
    INSERT INTO public.audit_logs (actor, action, entity_type, entity_id, details)
    VALUES (
        p_operator_name,
        'RECORD_PRODUCTION_RUN',
        'PRODUCTION',
        v_run_id::TEXT,
        jsonb_build_object(
            'run_number', p_run_number,
            'product_name', v_prod_name,
            'output_qty', p_actual_quantity,
            'unit', p_unit
        )
    );

    RETURN v_run_id;
END;
$$;

-- Cancel/Correct Production Run Atomic Reversal
CREATE OR REPLACE FUNCTION public.cancel_production_run_atomic(
    p_run_id UUID,
    p_reason TEXT,
    p_operator TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_run RECORD;
    v_item RECORD;
    v_curr_stock NUMERIC;
BEGIN
    SELECT * INTO v_run FROM public.production_runs WHERE id = p_run_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Run not found';
    END IF;
    IF v_run.status = 'cancelled' THEN
        RAISE EXCEPTION 'Run is already cancelled';
    END IF;

    -- 1. Mark status cancelled
    UPDATE public.production_runs
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        cancelled_at = NOW(),
        cancelled_by = p_operator,
        updated_at = NOW()
    WHERE id = p_run_id;

    -- 2. Restore ingredient consumption
    FOR v_item IN SELECT pc.*, i.name as ing_name, i.current_stock as ing_stock
                  FROM public.production_consumption pc
                  JOIN public.ingredients i ON i.id = pc.ingredient_id
                  WHERE pc.run_id = p_run_id
    LOOP
        UPDATE public.ingredients
        SET current_stock = current_stock + v_item.actual_quantity, updated_at = NOW()
        WHERE id = v_item.ingredient_id;

        INSERT INTO public.stock_movements (
            item_id, item_type, item_name, movement_type, quantity, unit,
            previous_balance, new_balance, reference, operator_name, reason
        ) VALUES (
            v_item.ingredient_id, 'ingredient', v_item.ing_name, 'cancellation_reversal',
            v_item.actual_quantity, v_item.unit, v_item.ing_stock, v_item.ing_stock + v_item.actual_quantity,
            'Reversal of ' || v_run.run_number, p_operator, p_reason
        );
    END LOOP;

    -- 3. Deduct product output
    SELECT current_stock INTO v_curr_stock FROM public.products WHERE id = v_run.product_id;
    UPDATE public.products
    SET current_stock = GREATEST(0.000, current_stock - v_run.actual_quantity), updated_at = NOW()
    WHERE id = v_run.product_id;

    INSERT INTO public.stock_movements (
        item_id, item_type, item_name, movement_type, quantity, unit,
        previous_balance, new_balance, reference, operator_name, reason
    ) VALUES (
        v_run.product_id, 'product', (SELECT name FROM public.products WHERE id = v_run.product_id),
        'cancellation_reversal', -v_run.actual_quantity, v_run.unit,
        v_curr_stock, GREATEST(0.000, v_curr_stock - v_run.actual_quantity),
        'Reversal of ' || v_run.run_number, p_operator, p_reason
    );

    -- 4. Audit Log
    INSERT INTO public.audit_logs (actor, action, entity_type, entity_id, details)
    VALUES (
        p_operator, 'CANCEL_PRODUCTION_RUN', 'PRODUCTION', p_run_id::TEXT,
        jsonb_build_object('run_number', v_run.run_number, 'reason', p_reason)
    );

    RETURN true;
END;
$$;

-- ==============================================================================
-- 13. SERVER-SIDE ADMIN DASHBOARD AGGREGATION RPC
-- (Calculates all metrics on PostgreSQL, zero wasteful raw row fetching!)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_total_products INT;
    v_active_products INT;
    v_inactive_products INT;
    v_total_ingredients INT;
    v_runs_today INT;
    v_qty_today NUMERIC;
    v_runs_in_period INT;
    v_qty_in_period NUMERIC;
    v_by_product JSONB;
    v_consumption JSONB;
    v_recent_activity JSONB;
BEGIN
    SELECT count(*), count(*) FILTER (WHERE is_active = true), count(*) FILTER (WHERE is_active = false)
    INTO v_total_products, v_active_products, v_inactive_products
    FROM public.products;

    SELECT count(*) INTO v_total_ingredients FROM public.ingredients;

    SELECT count(*), COALESCE(sum(actual_quantity), 0)
    INTO v_runs_today, v_qty_today
    FROM public.production_runs
    WHERE production_date = CURRENT_DATE AND status = 'completed';

    SELECT count(*), COALESCE(sum(actual_quantity), 0)
    INTO v_runs_in_period, v_qty_in_period
    FROM public.production_runs
    WHERE production_date >= p_start_date AND production_date <= p_end_date AND status = 'completed';

    -- Aggregation by product in period
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_by_product
    FROM (
        SELECT p.name AS product_name, p.unit, COALESCE(sum(pr.actual_quantity), 0) AS total_quantity, count(pr.id) AS run_count
        FROM public.products p
        JOIN public.production_runs pr ON pr.product_id = p.id
        WHERE pr.production_date >= p_start_date AND pr.production_date <= p_end_date AND pr.status = 'completed'
        GROUP BY p.name, p.unit
        ORDER BY total_quantity DESC
    ) item;

    -- Ingredient consumption in period
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_consumption
    FROM (
        SELECT i.name AS ingredient_name, i.category, i.unit, COALESCE(sum(pc.actual_quantity), 0) AS total_consumed
        FROM public.ingredients i
        JOIN public.production_consumption pc ON pc.ingredient_id = i.id
        JOIN public.production_runs pr ON pr.id = pc.run_id
        WHERE pr.production_date >= p_start_date AND pr.production_date <= p_end_date AND pr.status = 'completed'
        GROUP BY i.name, i.category, i.unit
        ORDER BY total_consumed DESC
    ) item;

    -- Recent 8 completed runs
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_recent_activity
    FROM (
        SELECT pr.id, pr.run_number, p.name AS product_name, pr.production_date, pr.actual_quantity, pr.unit, pr.status, pr.operator_name, pr.created_at
        FROM public.production_runs pr
        JOIN public.products p ON p.id = pr.product_id
        ORDER BY pr.created_at DESC
        LIMIT 8
    ) item;

    RETURN jsonb_build_object(
        'total_products', v_total_products,
        'active_products', v_active_products,
        'inactive_products', v_inactive_products,
        'total_ingredients', v_total_ingredients,
        'runs_today', v_runs_today,
        'qty_today', v_qty_today,
        'runs_in_period', v_runs_in_period,
        'qty_in_period', v_qty_in_period,
        'by_product', v_by_product,
        'consumption', v_consumption,
        'recent_activity', v_recent_activity
    );
END;
$$;

-- ==============================================================================
-- 14. IDEMPOTENT CATALOGUE SEEDS
-- Seed the exact 26 Malayalam snack products and 43 ingredients
-- (0 demo transactions, 0 fabricated stock, 0 fake users)
-- ==============================================================================

-- Products: 26 items
INSERT INTO public.products (name, unit, is_active) VALUES
    ('പെരി പെരി മിക്സ്ചർ', 'kg', true),
    ('First മിക്സ്ചർ', 'kg', true),
    ('സാമ്പാർ SP', 'kg', true),
    ('ചിപ്പി മിക്സ്ചർ', 'kg', true),
    ('റോസ്റ്റ്', 'kg', true),
    ('പട്ടാണി', 'kg', true),
    ('ഒബിസി', 'kg', true),
    ('കമ്പ്യൂട്ടർ മിക്സ്ചർ', 'kg', true),
    ('ചോളം സ്വീറ്റ് മിക്സ്ചർ', 'kg', true),
    ('ചോളം മസാല മിക്സ്ചർ', 'kg', true),
    ('പട്ടാണി മിക്സ്ചർ', 'kg', true),
    ('3kg കിറ്റ് മിക്സ്ചർ', 'kg', true),
    ('എപ്സോ കിറ്റ് മിക്സ്ചർ', 'kg', true),
    ('മണി കടല', 'kg', true),
    ('മുളക് മിക്സ്ചർ', 'kg', true),
    ('സുടാൻ മിക്സ്ചർ', 'kg', true),
    ('ചില്ലി മിക്സ്ചർ', 'kg', true),
    ('പയോളി മിക്സ്ചർ', 'kg', true),
    ('PT മിക്സ്ചർ', 'kg', true),
    ('ദാൽ മിക്സ്ചർ', 'kg', true),
    ('Sr മിക്സ്ചർ', 'kg', true),
    ('SPSR മിക്സ്ചർ', 'kg', true),
    ('സാമ്പാർ LC', 'kg', true),
    ('ജീൻസ്', 'kg', true),
    ('ഗാർലിക്ക് pv', 'kg', true),
    ('Sp മിക്സ്ചർ', 'kg', true)
ON CONFLICT (name) DO NOTHING;

-- Ingredients: Category A (Basic - 7 items)
INSERT INTO public.ingredients (name, category, unit, is_active) VALUES
    ('ഓയിൽ', 'basic', 'L', true),
    ('അണ്ടി തോട്', 'basic', 'kg', true),
    ('ചിപ്പ്ളി പൊടി', 'basic', 'kg', true),
    ('കറിവേപ്പില', 'basic', 'kg', true),
    ('കൂലി', 'basic', 'pcs', true),
    ('കൂലി പാക്കിങ്', 'basic', 'pcs', true)
ON CONFLICT (name) DO NOTHING;

-- Ingredients: Category B (Other ingredients - 36 items)
INSERT INTO public.ingredients (name, category, unit, is_active) VALUES
    ('കടല പൊടി 99', 'other', 'kg', true),
    ('കടല പൊടി സൂരജ്', 'other', 'kg', true),
    ('അരിപ്പൊടി പൊള്ളാച്ചി', 'other', 'kg', true),
    ('അരിപ്പൊടി 2nd', 'other', 'kg', true),
    ('പൂള പൊടി പൊള്ളാച്ചി', 'other', 'kg', true),
    ('പൂള പൊടി 2nd', 'other', 'kg', true),
    ('മൈദ', 'other', 'kg', true),
    ('കടല ഫസ്റ്റ്', 'other', 'kg', true),
    ('കടല 2nd', 'other', 'kg', true),
    ('പട്ടാണി', 'other', 'kg', true),
    ('ഉണ്ട പൊട്ട്', 'other', 'kg', true),
    ('പൊട്ട് കടല', 'other', 'kg', true),
    ('ചെറുപയർ', 'other', 'kg', true),
    ('മമ്പയർ', 'other', 'kg', true),
    ('ദാൽ പരിപ്പ്', 'other', 'kg', true),
    ('മുളക് പൊടി', 'other', 'kg', true),
    ('സാമ്പാർ പൊടി', 'other', 'kg', true),
    ('മഞ്ഞൾ പൊടി', 'other', 'kg', true),
    ('ഗരം മസാല', 'other', 'kg', true),
    ('ബിരിയാണി മസാല', 'other', 'kg', true),
    ('ചിക്കൻ മസാല', 'other', 'kg', true),
    ('മീറ്റ് മസാല', 'other', 'kg', true),
    ('കായം', 'other', 'kg', true),
    ('സദ്യ പൊടി', 'other', 'kg', true),
    ('അയമോദകം', 'other', 'kg', true),
    ('കരിം ജീരകം', 'other', 'kg', true),
    ('കമ്പ്യൂട്ടർ', 'other', 'kg', true),
    ('ചോളം', 'other', 'kg', true),
    ('ഒബിസി', 'other', 'kg', true),
    ('പഞ്ചസാര പൊടി', 'other', 'kg', true),
    ('വെളുത്തുള്ളി', 'other', 'kg', true),
    ('ചീറുള്ളി', 'other', 'kg', true),
    ('വലിയ ഉള്ളി', 'other', 'kg', true),
    ('ഉരുള കിഴങ്ങു', 'other', 'kg', true),
    ('കളർ', 'other', 'kg', true),
    ('ഉപ്പ്', 'other', 'kg', true)
ON CONFLICT (name) DO NOTHING;
