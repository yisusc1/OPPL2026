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

    revalidatePath('/transporte');
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
