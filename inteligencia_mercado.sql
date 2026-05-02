-- Script de creación para el Módulo de Inteligencia de Mercado

-- 1. Tabla de Operadores de la Competencia
CREATE TABLE IF NOT EXISTS operadores_competencia (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    color_hex TEXT DEFAULT '#6b7280',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Ofertas de la Competencia
CREATE TABLE IF NOT EXISTS ofertas_competencia (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES operadores_competencia(id) ON DELETE CASCADE,
    estado TEXT NOT NULL,
    municipio TEXT NOT NULL,
    parroquia TEXT NOT NULL,
    
    tipo_novedad TEXT NOT NULL,
    velocidad_mb INTEGER NOT NULL,
    precio_mensual DECIMAL(10, 2) NOT NULL,
    costo_instalacion DECIMAL(10, 2) DEFAULT 0,
    modalidad_instalacion TEXT,
    incluye_tv BOOLEAN DEFAULT FALSE,
    detalle_tv TEXT,
    
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

-- Políticas de RLS (Opcional, según la configuración de tu DB, puedes habilitarlas)
-- ALTER TABLE operadores_competencia ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ofertas_competencia ENABLE ROW LEVEL SECURITY;
