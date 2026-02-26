"use server"

import { createClient } from "@/lib/supabase/server"
import { unstable_noStore as noStore } from "next/cache"

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
