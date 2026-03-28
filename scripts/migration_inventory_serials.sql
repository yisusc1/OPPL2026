-- Create table for tracking individual serials status
CREATE TYPE serial_status AS ENUM ('AVAILABLE', 'ASSIGNED', 'LOST', 'SOLD', 'RETURNED');

CREATE TABLE IF NOT EXISTS inventory_serials (
    serial_number TEXT NOT NULL,
    product_id UUID REFERENCES inventory_products(id) ON DELETE CASCADE,
    status serial_status DEFAULT 'AVAILABLE',
    location TEXT, -- Optional: Specific warehouse location
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (serial_number, product_id) -- Composite PK: A serial can exist for different products (technically possible, though rare)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_inventory_serials_status ON inventory_serials(status);
CREATE INDEX IF NOT EXISTS idx_inventory_serials_product_id ON inventory_serials(product_id);

-- RLS
ALTER TABLE inventory_serials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to authenticated" ON inventory_serials
    FOR ALL TO authenticated USING (true);
