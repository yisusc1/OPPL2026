-- MASTER FIX: Ensure 'serials' column exists in ALL tracking tables
-- Run this script to fix the "400 Bad Request" errors in the Tracking Page

-- 1. Transactions (Main History)
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_serials ON inventory_transactions USING gin (serials);

-- 2. Assignments (Dispatches / Active Usage)
ALTER TABLE inventory_assignment_items
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_inventory_assignment_items_serials ON inventory_assignment_items USING gin (serials);

-- 3. Returns (History of returns)
ALTER TABLE inventory_return_items
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_inventory_return_items_serials ON inventory_return_items USING gin (serials);

-- 4. Verify Inventory Serials Table (Master Status) - just in case
CREATE TABLE IF NOT EXISTS inventory_serials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES inventory_products(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ASSIGNED, RETURNED, LOST, SOLD
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, serial_number)
);
