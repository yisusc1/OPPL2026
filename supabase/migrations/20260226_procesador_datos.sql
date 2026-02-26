-- --------------------------------------------------------
-- Tablas para el Modulo: Procesador de Datos (Instalaciones)
-- --------------------------------------------------------

-- Tabla 1: Configuración Global (Acumulados)
CREATE TABLE IF NOT EXISTS public.config_totales (
    id BIGINT PRIMARY KEY,
    valle INT NOT NULL DEFAULT 0,
    propatria INT NOT NULL DEFAULT 0,
    la_vega INT NOT NULL DEFAULT 0,
    tejerias INT NOT NULL DEFAULT 0,
    coche INT NOT NULL DEFAULT 0,
    mes_acumulado INT NOT NULL DEFAULT 0,
    mes_actual TEXT NOT NULL DEFAULT 'Febrero',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar la fila de configuración por defecto (id = 1) si no existe
INSERT INTO public.config_totales (id, valle, propatria, la_vega, tejerias, coche, mes_acumulado, mes_actual)
VALUES (1, 0, 0, 0, 0, 0, 0, 'Febrero')
ON CONFLICT (id) DO NOTHING;


-- Tabla 2: Historial de Reportes Consolidados
CREATE TABLE IF NOT EXISTS public.historial_reportes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reporte TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla 3: Instalaciones (Base de Datos en Crudo)
CREATE TABLE IF NOT EXISTS public.installations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha DATE,
  mes TEXT,
  tecnico_1 TEXT,
  tecnico_2 TEXT,
  router TEXT,
  nombre_cliente TEXT,
  cedula TEXT,
  zona TEXT,
  sector TEXT,
  asesor TEXT,
  estatus TEXT,
  plan TEXT,
  power_go TEXT,
  servicio TEXT
);

-- --------------------------------------------------------
-- Políticas de Seguridad de Nivel de Fila (RLS)
-- Opcional: Descomentar si requieres proteger estas tablas a usuarios autenticados
-- --------------------------------------------------------

-- ALTER TABLE public.config_totales ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.historial_reportes ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Permitir select a autenticados" ON public.config_totales FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Permitir update a autenticados" ON public.config_totales FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "Permitir insert a autenticados" ON public.config_totales FOR INSERT TO authenticated WITH CHECK (true);

-- CREATE POLICY "Permitir select historial" ON public.historial_reportes FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Permitir insert historial" ON public.historial_reportes FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Permitir delete historial" ON public.historial_reportes FOR DELETE TO authenticated USING (true);
