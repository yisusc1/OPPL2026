-- Create installations table
CREATE TABLE IF NOT EXISTS public.installations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  fecha date,
  mes text,
  tecnico_1 text,
  tecnico_2 text,
  router text,
  nombre_cliente text,
  cedula text,
  zona text,
  sector text,
  asesor text,
  estatus text,
  plan text,
  power_go text,
  servicio text,
  CONSTRAINT installations_pkey PRIMARY KEY (id)
);

-- Enable RLS for installations
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;

-- Create policy for installations (Allow read for authenticated)
CREATE POLICY "Enable read access for all users" ON public.installations
    FOR SELECT
    USING (true);


-- Create network_nodes table
CREATE TABLE IF NOT EXISTS public.network_nodes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nombre text NOT NULL,
  latitud double precision NOT NULL,
  longitud double precision NOT NULL,
  tipo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT network_nodes_pkey PRIMARY KEY (id)
);

-- Enable RLS for network_nodes
ALTER TABLE public.network_nodes ENABLE ROW LEVEL SECURITY;

-- Create policy for network_nodes (Allow read for authenticated)
CREATE POLICY "Enable read access for all users" ON public.network_nodes
    FOR SELECT
    USING (true);
