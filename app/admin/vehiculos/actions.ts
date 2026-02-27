"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from '@supabase/supabase-js' // [NEW] For Admin Bypass
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from 'next/cache' // [NEW]

export type AdminVehicle = {
    id: string
    created_at: string
    codigo: string
    placa: string
    modelo: string
    año: string
    color: string
    tipo: string
    capacidad_tanque: string
    department?: string
    estado: 'Disponible' | 'En Uso' | 'Mantenimiento' | 'Fuera de Servicio'
    kilometraje: number
    ultimo_mantenimiento?: string
    foto_url?: string
    current_fuel_level?: number
    last_fuel_update?: string
    last_oil_change_km?: number
    last_timing_belt_km?: number
    last_chain_kit_km?: number
    last_wash_date?: string
    assigned_driver_id?: string
    // Computed / Extended fields
    activeReport?: any
    computedStatus: 'AVAILABLE' | 'IN_ROUTE' | 'MAINTENANCE' | 'CRITICAL'
    driverName?: string | null
    lastExit?: string
    faultsSummary?: {
        critical: number
        high: number
        medium: number
        low: number
    }
}

export async function getAdminFleetVehicles(): Promise<AdminVehicle[]> {
    noStore()
    const supabase = await createClient()

    // 1. Fetch Vehicles with Driver Profile
    const { data: vehicles, error } = await supabase
        .from("vehiculos")
        .select(`
            *,
            assigned_driver:profiles(first_name, last_name)
        `)
        .order('modelo')

    if (error || !vehicles) {
        console.error("Error fetching vehicles:", error)
        return []
    }

    // 2. Fetch Active Trips (Salida without Entrada)
    const { data: activeTrips } = await supabase
        .from("reportes")
        .select("*")
        .is("km_entrada", null)

    const tripsMap = new Map(activeTrips?.map(t => [t.vehiculo_id, t]))
    const tripsDateMap = new Map(activeTrips?.map(t => [t.vehiculo_id, t.fecha_salida]))

    // 3. Fetch Active Faults for status computation
    const { data: faults } = await supabase
        .from("fallas")
        .select("vehiculo_id, prioridad, estado")
        .neq("estado", "Resuelto")
        .neq("estado", "Reparado")
        .neq("estado", "Descartado")

    const faultsSummaryMap = new Map<string, { critical: number, high: number, medium: number, low: number, isMaintenance: boolean }>()

    faults?.forEach(f => {
        const current = faultsSummaryMap.get(f.vehiculo_id) || { critical: 0, high: 0, medium: 0, low: 0, isMaintenance: false }
        if (f.estado === 'En Revisión') current.isMaintenance = true

        switch (f.prioridad?.toLowerCase()) {
            case 'crítica':
            case 'critica': current.critical++; break;
            case 'alta': current.high++; break;
            case 'media': current.medium++; break;
            default: current.low++;
        }
        faultsSummaryMap.set(f.vehiculo_id, current)
    })

    // 4. Fetch Latest Mileage from View (The robust source)
    const { data: mileageData } = await supabase
        .from("vista_ultimos_kilometrajes")
        .select("vehiculo_id, ultimo_kilometraje")

    const mileageMap = new Map(mileageData?.map(m => [m.vehiculo_id, m.ultimo_kilometraje]))

    // 5. Map and Merge
    return vehicles.map(v => {
        // Compute Mileage: Max(View, Table)
        const computedMileage = Math.max(mileageMap.get(v.id) || 0, v.kilometraje || 0)

        // Compute Status
        const activeTrip = tripsMap.get(v.id)
        const inRoute = !!activeTrip
        const summary = faultsSummaryMap.get(v.id) || { critical: 0, high: 0, medium: 0, low: 0, isMaintenance: false }
        const activeFaultsCount = summary.critical + summary.high + summary.medium + summary.low

        let computedStatus: AdminVehicle['computedStatus'] = 'AVAILABLE'
        if (inRoute) computedStatus = 'IN_ROUTE'
        else if (summary.isMaintenance) computedStatus = 'MAINTENANCE'
        else if (activeFaultsCount > 0 || v.falla_activa) computedStatus = 'CRITICAL'

        // Also respect the manual 'estado' if it's 'Mantenimiento' or 'Fuera de Servicio' essentially overriding Available?
        // Actually, the request is to be EQUAL to the Live Fleet panel, so we trust the computed status more for display.
        // But we keep the original 'estado' for the form.

        return {
            ...v,
            kilometraje: computedMileage, // OVERWRITE with correct mileage
            activeReport: activeTrip,
            computedStatus,
            driverName: v.assigned_driver ? `${v.assigned_driver.first_name} ${v.assigned_driver.last_name}` : null,
            lastExit: tripsDateMap.get(v.id),
            faultsSummary: summary
        }
    })
}

export type MileageSource = {
    type: 'fuel_log' | 'report_entry' | 'report_exit' | 'legacy' | 'unknown';
    id: string;
    vehicleId: string; // [NEW] Added for robust updates
    currentValue: number;
    date: string;
    description: string;
}

export async function getMileageSource(vehicleId: string, currentTotalMileage: number): Promise<MileageSource | null> {
    const supabase = await createClient()

    // 1. Check Fuel Logs
    const { data: fuelLog } = await supabase
        .from('fuel_logs')
        .select('id, mileage, created_at, fuel_date')
        .eq('vehicle_id', vehicleId)
        .eq('mileage', currentTotalMileage)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (fuelLog) {
        return {
            type: 'fuel_log',
            id: fuelLog.id,
            currentValue: fuelLog.mileage,
            date: fuelLog.fuel_date || fuelLog.created_at,
            description: 'Carga de Combustible',
            vehicleId: vehicleId
        }
    }

    // 2. Check Reports (Entry)
    const { data: entryReport } = await supabase
        .from('reportes')
        .select('id, km_entrada, fecha_entrada, created_at')
        .eq('vehiculo_id', vehicleId)
        .eq('km_entrada', currentTotalMileage)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (entryReport) {
        return {
            type: 'report_entry',
            id: entryReport.id,
            currentValue: entryReport.km_entrada,
            date: entryReport.fecha_entrada || entryReport.created_at,
            description: 'Reporte de Entrada',
            vehicleId: vehicleId
        }
    }

    // 3. Check Reports (Exit)
    const { data: exitReport } = await supabase
        .from('reportes')
        .select('id, km_salida, fecha_salida, created_at')
        .eq('vehiculo_id', vehicleId)
        .eq('km_salida', currentTotalMileage)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (exitReport) {
        return {
            type: 'report_exit',
            id: exitReport.id,
            currentValue: exitReport.km_salida,
            date: exitReport.fecha_salida || exitReport.created_at,
            description: 'Reporte de Salida',
            vehicleId: vehicleId
        }
    }

    // 4. Check Master Vehicle Record (Fallback)
    const { data: vehicle } = await supabase
        .from('vehiculos')
        .select('id, kilometraje, updated_at')
        .eq('id', vehicleId)
        .eq('kilometraje', currentTotalMileage)
        .single()

    if (vehicle) {
        return {
            type: 'legacy', // Or 'master_record'
            id: vehicle.id,
            currentValue: vehicle.kilometraje,
            date: vehicle.updated_at,
            description: 'Registro Maestro (Vehículos)',
            vehicleId: vehicleId // Actually vehicle.id is the same
        }
    }

    return {
        type: 'unknown',
        id: vehicleId,
        currentValue: currentTotalMileage,
        date: new Date().toISOString(),
        description: 'Origen Desconocido (Forzar Corrección)',
        vehicleId: vehicleId
    }
}

export async function correctMileage(source: MileageSource, newValue: number) {
    // 1. Standard Client (for Auth Check if needed, but we are in Server Action)
    // We already trust the caller (Admin UI).

    // 2. Admin Client (Bypass RLS)
    // We need this because fuel_logs might belong to other users (drivers) and standard Admin user might not have Update RLS on them.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY")
        return { success: false, error: "Configuration Error: Missing Service Key" }
    }

    const supabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // [NUCLEAR OPTION] Force Consistency
    // Instead of just fixing one record, we fix the ecosystem to ensure the View (MAX) returns 'newValue'.

    try {
        // 1. Update Master Record (The Truth)
        if (source.vehicleId) {
            await supabase.from('vehiculos').update({ kilometraje: newValue }).eq('id', source.vehicleId)
        }

        // 2. Clamp Fuel Logs
        // Any log greater than newValue is obviously wrong (or from the future), so we flatten it.
        await supabase
            .from('fuel_logs')
            .update({ mileage: newValue })
            .eq('vehicle_id', source.vehicleId)
            .gt('mileage', newValue)

        // 3. Clamp Entry Reports
        await supabase
            .from('reportes')
            .update({ km_entrada: newValue })
            .eq('vehiculo_id', source.vehicleId)
            .gt('km_entrada', newValue)

        // 4. Clamp Exit Reports
        await supabase
            .from('reportes')
            .update({ km_salida: newValue })
            .eq('vehiculo_id', source.vehicleId)
            .gt('km_salida', newValue)

        // 5. [NEW] Clamp Maintenance Logs (Likely the missing piece causing View persistence)
        await supabase
            .from('maintenance_logs')
            .update({ mileage: newValue })
            .eq('vehicle_id', source.vehicleId)
            .gt('mileage', newValue)

        revalidatePath('/admin/vehiculos')
        revalidatePath('/control/combustible')
        revalidatePath('/transporte')
        revalidatePath('/gerencia')

        return { success: true }

    } catch (error: any) {
        console.error("Error correcting mileage (Aggressive):", error)
        return { success: false, error: error.message }
    }
}
