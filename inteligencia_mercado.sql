-- Script de creación para el Módulo de Inteligencia de Mercado

-- 1. Tabla de Operadores de la Competencia
CREATE TABLE IF NOT EXISTS operadores_competencia (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    color_hex TEXT DEFAULT '#6b7280',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la tabla ya fue creada previamente, ejecuta esto:
-- ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Tabla de Ofertas de la Competencia
CREATE TABLE IF NOT EXISTS ofertas_competencia (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES operadores_competencia(id) ON DELETE CASCADE,
    estado TEXT NOT NULL,
    municipio TEXT NOT NULL,
    parroquia TEXT NOT NULL,
    
    tipo_novedad TEXT NOT NULL,
    velocidad_mb INTEGER,
    precio_mensual DECIMAL(10, 2),
    
    -- Nuevos campos para Promos y Servicios Dinámicos
    es_promocion BOOLEAN DEFAULT FALSE,
    precio_regular DECIMAL(10, 2),
    servicios_adicionales JSONB DEFAULT '[]'::jsonb,
    
    -- Campos antiguos de instalación (mantenidos por compatibilidad temporal)
    costo_instalacion DECIMAL(10, 2) DEFAULT 0,
    modalidad_instalacion TEXT,
    incluye_tv BOOLEAN DEFAULT FALSE,
    detalle_tv TEXT,
    
    -- Nuevos campos de Instalación Avanzada
    instalacion_opciones JSONB DEFAULT '[]'::jsonb,
    instalacion_metraje INTEGER,
    
    duracion_promo_meses INTEGER,
    fecha_fin_promo DATE,
    
    notas TEXT,
    fecha_reporte DATE DEFAULT CURRENT_DATE,
    asesor_nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para mejorar el rendimiento de las consultas en el Dashboard
CREATE INDEX IF NOT EXISTS idx_ofertas_competencia_zona ON ofertas_competencia(estado, municipio, parroquia);
CREATE INDEX IF NOT EXISTS idx_ofertas_competencia_operador ON ofertas_competencia(operador_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_competencia_fecha ON ofertas_competencia(fecha_reporte DESC);

-- 4. Inserción de Operadores Base (Evitar duplicados con ON CONFLICT)
INSERT INTO operadores_competencia (nombre, color_hex) VALUES 
('Fibex', '#0047AB'),
('Inter', '#FF0000'),
('Netuno', '#00A859'),
('NetLife', '#FFD700'),
('Thundernet', '#800080')
ON CONFLICT (nombre) DO NOTHING;

-- Si ya habías creado las tablas antes de esta actualización, ejecuta estas líneas en Supabase SQL Editor:
-- ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS es_promocion BOOLEAN DEFAULT FALSE;
-- ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS precio_regular DECIMAL(10, 2);
-- ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS servicios_adicionales JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS instalacion_opciones JSONB DEFAULT '[]'::jsonb;
-- ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS instalacion_metraje INTEGER;

-- Fix: Si velocidad_mb fue creada como NOT NULL, corregir:
-- ALTER TABLE ofertas_competencia ALTER COLUMN velocidad_mb DROP NOT NULL;
-- ALTER TABLE ofertas_competencia ALTER COLUMN precio_mensual DROP NOT NULL;

-- Políticas de RLS (Opcional, según la configuración de tu DB, puedes habilitarlas)
-- ALTER TABLE operadores_competencia ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ofertas_competencia ENABLE ROW LEVEL SECURITY;
