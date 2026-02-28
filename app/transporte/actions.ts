'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// --- FASE 1: SALIDA ---
// Helper to parse fuel text to percentage
function parseFuelLevel(fuelString: string): number {
    if (!fuelString) return 0;
    const s = fuelString.toString().toLowerCase().trim();
    if (s === 'full') return 100;
    if (s === '3/4') return 75;
    if (s === '1/2') return 50;
    if (s === '1/4') return 25;
    if (s === 'reserva') return 10;

    // Fallback for direct "50%" or number strings
    return parseInt(s.replace('%', '')) || 0;
}

// --- FASE 1: SALIDA ---
export async function crearSalida(formData: FormData) {
    const supabase = await createClient();

    // [NEW] Get Current User to track owner
    const { data: { user } } = await supabase.auth.getUser();

    const rawData = {
        // [NEW] Save User ID
        user_id: user?.id,

        vehiculo_id: formData.get('vehiculo_id'),
        conductor: formData.get('conductor'),
        departamento: formData.get('departamento'),
        fecha_salida: new Date().toISOString(),

        // Datos Operativos
        km_salida: Number(formData.get('km_salida')),
        gasolina_salida: formData.get('gasolina_salida'),
        observaciones_salida: formData.get('observaciones_salida'),

        // Chequeo Técnico
        aceite_salida: formData.get('aceite_salida') === 'on',
        agua_salida: formData.get('agua_salida') === 'on',

        // Seguridad (Carros)
        carpeta_salida: formData.get('carpeta_salida') === 'on',
        gato_salida: formData.get('gato_salida') === 'on',
        cruz_salida: formData.get('cruz_salida') === 'on',
        triangulo_salida: formData.get('triangulo_salida') === 'on',
        caucho_salida: formData.get('caucho_salida') === 'on',

        // Dispositivos (Instalación)
        onu_salida: formData.get('onu_salida') === 'on' ? 1 : 0,
        ups_salida: formData.get('ups_salida') === 'on' ? 1 : 0,
        escalera_salida: formData.get('escalera_salida') === 'on',
    };

    // [NEW] Hard Limit Validation (300km)
    // We need to fetch the last mileage to validate strictly even for FormData actions
    const { data: lastKmData } = await supabase
        .from('vista_ultimos_kilometrajes')
        .select('ultimo_kilometraje')
        .eq('vehiculo_id', rawData.vehiculo_id)
        .single();

    const lastKm = lastKmData?.ultimo_kilometraje || 0;
    const kmSalida = Number(rawData.km_salida);

    // Fetch vehicle status for odometer break check
    const { data: vData } = await supabase.from('vehiculos').select('odometro_averiado').eq('id', rawData.vehiculo_id).single();
    const isBroken = vData?.odometro_averiado || false;

    if (!isBroken) {
        if (kmSalida <= lastKm) {
            return { success: false, error: `El kilometraje (${kmSalida}) debe ser mayor al actual (${lastKm}).` };
        }
        // [MODIFIED] Allow initialization if lastKm is 0
        if (lastKm > 0 && kmSalida > lastKm + 300) {
            return { success: false, error: `Error: El kilometraje ingresado (${kmSalida}) excede el límite de 300km respecto al anterior (${lastKm}). Verifica si hay un error de escritura.` };
        }
    }

    const { data, error } = await supabase.from('reportes').insert(rawData).select().single();
    if (error) {
        return { success: false, error: error.message };
    }

    // [NEW] Update Vehicle Fuel Level AND Mileage
    const fuelString = rawData.gasolina_salida?.toString() || '';
    const fuelLevel = parseFuelLevel(fuelString);

    const { error: updateError } = await supabase.from('vehiculos').update({
        current_fuel_level: fuelLevel,
        kilometraje: rawData.km_salida, // Update mileage on exit
        last_fuel_update: new Date().toISOString()
    }).eq('id', rawData.vehiculo_id);

    revalidatePath('/transporte');
    revalidatePath('/gerencia'); // [NEW] Revalidate Administration Panel
    return { success: true, data };
}

// --- FASE 2: ENTRADA ---
export async function registrarEntrada(formData: FormData) {
    const supabase = await createClient();
    const reporte_id = formData.get('reporte_id') as string;

    // Fetch Report to validate ranges
    const { data: currentReport } = await supabase.from('reportes').select('km_salida, vehiculo_id, vehiculos(odometro_averiado)').eq('id', reporte_id).single();
    if (!currentReport) return { success: false, error: "Reporte no encontrado" };

    const kmEntrada = Number(formData.get('km_entrada'));
    // @ts-ignore
    const isBroken = currentReport.vehiculos?.odometro_averiado || false;

    if (!isBroken) {
        if (kmEntrada <= currentReport.km_salida) {
            return { success: false, error: `El KM de entrada debe ser mayor al de salida (${currentReport.km_salida}).` };
        }
        if (kmEntrada > currentReport.km_salida + 300) {
            return { success: false, error: `Error: El recorrido (${kmEntrada - currentReport.km_salida} km) excede el límite permitido de 300km.` };
        }
    }

    const updateData = {
        fecha_entrada: new Date().toISOString(),

        // Datos Operativos
        km_entrada: Number(formData.get('km_entrada')),
        gasolina_entrada: formData.get('gasolina_entrada'),
        observaciones_entrada: formData.get('observaciones_entrada'),

        // Chequeo Técnico (Re-chequeo)
        aceite_entrada: formData.get('aceite_entrada') === 'on',
        agua_entrada: formData.get('agua_entrada') === 'on',

        // Seguridad (Re-chequeo)
        carpeta_entrada: formData.get('carpeta_entrada') === 'on',
        gato_entrada: formData.get('gato_entrada') === 'on',
        cruz_entrada: formData.get('cruz_entrada') === 'on',
        triangulo_entrada: formData.get('triangulo_entrada') === 'on',
        caucho_entrada: formData.get('caucho_entrada') === 'on',

        // Dispositivos (Re-chequeo)
        onu_entrada: formData.get('onu_entrada') === 'on' ? 1 : 0,
        ups_entrada: formData.get('ups_entrada') === 'on' ? 1 : 0,
        // La escalera la chequeamos también al entrar por seguridad
        escalera_entrada: formData.get('escalera_entrada') === 'on',
    };

    const { data, error } = await supabase.from('reportes').update(updateData).eq('id', reporte_id).select().single();
    if (error) {
        return { success: false, error: error.message };
    }

    // [NEW] Update Vehicle Fuel Level AND Mileage with Text Parsing
    if (updateData.gasolina_entrada) {
        const fuelLevel = parseFuelLevel(updateData.gasolina_entrada.toString());
        // Fetch vehicle_id from the report data (we selected it above)
        if (data && data.vehiculo_id) {
            await supabase.from('vehiculos').update({
                current_fuel_level: fuelLevel,
                kilometraje: updateData.km_entrada, // Update mileage on entry
                last_fuel_update: new Date().toISOString()
            }).eq('id', data.vehiculo_id);
        }
    }

    // [NEW] Auto-Generate Fault: Filter Trivial Observations
    const obsEntrada = updateData.observaciones_entrada?.toString() || '';
    const trivialKeywords = ['ninguna', 'ninguno', 'todo bien', 'ok', 'sin novedad', 'nada', 'n/a', 'bien', 'fino', 'sin observaciones'];

    const isTrivial = trivialKeywords.some(keyword =>
        obsEntrada.toLowerCase().trim() === keyword ||
        obsEntrada.toLowerCase().trim() === keyword + '.' // Handle simple punctuation
    );

    if (obsEntrada.trim().length > 3 && !isTrivial) {
        // Create Fault
        await supabase.from('fallas').insert({
            vehiculo_id: data.vehiculo_id, // Get from updated report data
            descripcion: `[Reporte Entrada] ${obsEntrada}`,
            tipo_falla: 'Mecánica', // Default
            prioridad: 'Media',
            estado: 'Pendiente',
            created_at: new Date().toISOString()
        });
    }

    revalidatePath('/transporte');
    revalidatePath('/taller'); // Update Taller
    revalidatePath('/gerencia'); // [NEW] Revalidate Administration Panel
    return { success: true, data };
}

export async function revalidateGerencia() {
    revalidatePath('/gerencia');
}

// [NEW] Helper Action for Client Components
export async function updateVehicleFuel(vehicleId: string, fuelText: string, kilometraje?: number) {
    const supabase = await createClient();
    const fuelLevel = parseFuelLevel(fuelText);

    const updatePayload: any = {
        current_fuel_level: fuelLevel,
        last_fuel_update: new Date().toISOString()
    };

    if (kilometraje !== undefined) {
        updatePayload.kilometraje = kilometraje;
    }

    const { error } = await supabase.from('vehiculos').update(updatePayload).eq('id', vehicleId);

    if (error) {
        console.error("Error updating vehicle stats:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/transporte');
    revalidatePath('/gerencia');
    return { success: true };
}

// [NEW] Assign Vehicle to Driver (Securely via RPC)
export async function assignVehicleToDriver(vehicleId: string) {
    const supabase = await createClient();

    // Call the RPC function logic
    const { error } = await supabase.rpc('assign_vehicle_to_me', {
        target_vehicle_id: vehicleId
    });

    if (error) {
        console.error("Error signing vehicle (RPC):", error);
        return { success: false, error: error.message };
    }

    // [DEBUG] Verify the change stuck
    const { data: verifyData } = await supabase
        .from('vehiculos')
        .select('assigned_driver_id')
        .eq('id', vehicleId)
        .single();

    // Check if the user ID matches (Supabase user ID from auth.getUser())
    const { data: { user } } = await supabase.auth.getUser();

    if (verifyData?.assigned_driver_id !== user?.id) {
        console.error("Verification Failed: DB did not update.", verifyData);
        return { success: false, error: "La base de datos no confirmó el cambio. (RLS Error?)" };
    }

    revalidatePath('/transporte');
    return { success: true };
}

// [NEW] Fetch Active Faults for a Vehicle
export async function getActiveFaults(vehicleId: string) {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from('fallas')
            .select('descripcion, created_at, estado')
            .eq('vehiculo_id', vehicleId)
            .in('estado', ['Pendiente', 'En Revisión'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching active faults:", error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error("Exception fetching active faults:", err);
        return [];
    }
}
