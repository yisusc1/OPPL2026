-- ============================================================
-- Vehicle Checklist Items: configurable per-vehicle check items
-- ============================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS vehicle_checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('TECNICO', 'SEGURIDAD', 'EQUIPOS')),
    label TEXT NOT NULL,
    key TEXT NOT NULL,
    is_default BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: no duplicate keys per vehicle
ALTER TABLE vehicle_checklist_items ADD CONSTRAINT uq_vehicle_checklist_key UNIQUE (vehicle_id, key);

-- 2. Disable RLS (matches project pattern)
ALTER TABLE vehicle_checklist_items DISABLE ROW LEVEL SECURITY;

-- 3. Add checklist_data JSONB column to reportes
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS checklist_data JSONB;

-- 4. Populate default items for existing vehicles
-- For each vehicle, insert defaults based on tipo
INSERT INTO vehicle_checklist_items (vehicle_id, category, label, key, is_default, sort_order)
SELECT v.id, item.category, item.label, item.key, true, item.sort_order
FROM vehiculos v
CROSS JOIN (
    -- Universal items
    VALUES 
        ('TECNICO', 'Nivel de Aceite', 'aceite', 1),
        ('TECNICO', 'Agua / Refrigerante', 'agua', 2),
        ('SEGURIDAD', 'Gato Hidráulico', 'gato', 3),
        ('SEGURIDAD', 'Llave Cruz', 'cruz', 4),
        ('SEGURIDAD', 'Triángulo', 'triangulo', 5),
        ('SEGURIDAD', 'Caucho Repuesto', 'caucho', 6),
        ('SEGURIDAD', 'Carpeta / Permisos', 'carpeta', 7),
        ('EQUIPOS', 'ONU / Router', 'onu', 8),
        ('EQUIPOS', 'Mini-UPS', 'ups', 9),
        ('EQUIPOS', 'Escalera', 'escalera', 10)
) AS item(category, label, key, sort_order)
WHERE v.tipo != 'Moto'
ON CONFLICT (vehicle_id, key) DO NOTHING;

-- Moto-specific items
INSERT INTO vehicle_checklist_items (vehicle_id, category, label, key, is_default, sort_order)
SELECT v.id, item.category, item.label, item.key, true, item.sort_order
FROM vehiculos v
CROSS JOIN (
    VALUES 
        ('TECNICO', 'Nivel de Aceite', 'aceite', 1),
        ('SEGURIDAD', 'Casco', 'casco', 2),
        ('SEGURIDAD', 'Luces', 'luces', 3),
        ('SEGURIDAD', 'Herramientas Básicas', 'herramientas', 4)
) AS item(category, label, key, sort_order)
WHERE v.tipo = 'Moto'
ON CONFLICT (vehicle_id, key) DO NOTHING;
