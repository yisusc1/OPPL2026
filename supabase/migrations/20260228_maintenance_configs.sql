-- 1. Create table for maintenance configurations
CREATE TABLE public.vehicle_maintenance_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.vehiculos(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL, -- Ej: 'OIL_CHANGE', 'WASH', 'TIMING_BELT', 'CHAIN_KIT', 'CUSTOM'
    custom_name VARCHAR(100), -- Used if service_type = 'CUSTOM'
    interval_value INTEGER NOT NULL, -- Distance in km or Time in days
    is_time_based BOOLEAN DEFAULT FALSE, -- FALSE = km, TRUE = days
    last_service_value NUMERIC, -- Last service km or epoch/date
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index for faster queries
CREATE INDEX idx_vehicle_maintenance_configs_vehicle_id ON public.vehicle_maintenance_configs(vehicle_id);

-- 3. Enable RLS
ALTER TABLE public.vehicle_maintenance_configs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
CREATE POLICY "Enable read access for all users" ON public.vehicle_maintenance_configs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.vehicle_maintenance_configs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.vehicle_maintenance_configs
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.vehicle_maintenance_configs
    FOR DELETE USING (true);

-- 5. Trigger for updated_at
CREATE TRIGGER update_vehicle_maintenance_configs_modtime
    BEFORE UPDATE ON public.vehicle_maintenance_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 6. Optional: Migrate existing default limits for current vehicles to the new table
DO $$ 
DECLARE 
    v RECORD;
    has_chain_or_gear BOOLEAN;
    is_moto BOOLEAN;
    last_oil NUMERIC;
    last_belt NUMERIC;
    last_chain NUMERIC;
    last_wash NUMERIC;
BEGIN 
    FOR v IN SELECT id, tipo, modelo, last_oil_change_km, last_timing_belt_km, last_chain_kit_km, last_wash_date FROM public.vehiculos 
    LOOP
        -- Determine vehicle properties based on the Taller page rules
        is_moto := (v.tipo ILIKE '%moto%' OR v.modelo ILIKE '%moto%');
        has_chain_or_gear := (v.modelo ILIKE '%HILUX%' OR v.modelo ILIKE '%TRITON%' OR v.modelo ILIKE '%DONFENG%' OR v.modelo ILIKE '%RICH%' OR v.modelo ILIKE '%NKR%');
        
        -- Defaults
        last_oil := COALESCE(v.last_oil_change_km, 0);
        last_belt := COALESCE(v.last_timing_belt_km, 0);
        last_chain := COALESCE(v.last_chain_kit_km, 0);
        
        -- Default to now if never washed
        IF v.last_wash_date IS NOT NULL THEN
            last_wash := EXTRACT(EPOCH FROM v.last_wash_date::timestamp) * 1000;
        ELSE
            -- Assuming never washed => 0
            last_wash := 0; 
        END IF;

        -- 6.1 Insert Oil Change 
        INSERT INTO public.vehicle_maintenance_configs 
            (vehicle_id, service_type, interval_value, is_time_based, last_service_value)
        VALUES 
            (v.id, 'OIL_CHANGE', CASE WHEN is_moto THEN 2000 ELSE 5000 END, FALSE, last_oil);

        -- 6.2 Insert Timing Belt (If applies)
        IF NOT is_moto AND NOT has_chain_or_gear THEN
            INSERT INTO public.vehicle_maintenance_configs 
                (vehicle_id, service_type, interval_value, is_time_based, last_service_value)
            VALUES 
                (v.id, 'TIMING_BELT', 50000, FALSE, last_belt);
        END IF;

        -- 6.3 Insert Chain Kit (If moto)
        IF is_moto THEN
            INSERT INTO public.vehicle_maintenance_configs 
                (vehicle_id, service_type, interval_value, is_time_based, last_service_value)
            VALUES 
                (v.id, 'CHAIN_KIT', 20000, FALSE, last_chain);
        END IF;

        -- 6.4 Insert Wash
        INSERT INTO public.vehicle_maintenance_configs 
            (vehicle_id, service_type, interval_value, is_time_based, last_service_value)
        VALUES 
            (v.id, 'WASH', 15, TRUE, last_wash);
            
    END LOOP;
END $$;
