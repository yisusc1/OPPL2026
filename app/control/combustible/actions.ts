"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface FuelLogData {
    ticket_number: string
    fuel_date: Date
    vehicle_id: string
    driver_name: string
    liters: number
    mileage: number
    ticket_url?: string
    notes?: string
}

export async function getVehicles() {
    const supabase = await createClient()
    const { data: vehicles } = await supabase
        .from("vehiculos")
        .select("id, placa, modelo, codigo")
        .order("codigo", { ascending: true })

    if (!vehicles) return []

    // Fetch mileage for all vehicles
    const { data: mileageData } = await supabase
        .from("vista_ultimos_kilometrajes")
        .select("vehiculo_id, ultimo_kilometraje")

    // Merge
    return vehicles.map(v => ({
        ...v,
        kilometraje: mileageData?.find(m => m.vehiculo_id === v.id)?.ultimo_kilometraje || 0
    }))
}

export async function createFuelLog(data: FuelLogData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "No autenticado" }
    }

    try {
        // [NEW] Validate Mileage
        const { data: vehicleMileage, error: mileageError } = await supabase
            .from("vista_ultimos_kilometrajes")
            .select("ultimo_kilometraje")
            .eq("vehiculo_id", data.vehicle_id)
            .single()

        // If no mileage record exists, we assume 0 or allow the entry (it might be the first one)
        const currentKm = vehicleMileage?.ultimo_kilometraje || 0

        if (data.mileage <= currentKm) {
            return {
                success: false,
                error: `El kilometraje ingresado (${data.mileage}) debe ser mayor al actual (${currentKm})`
            }
        }

        const { error } = await supabase.from("fuel_logs").insert({
            ticket_number: data.ticket_number,
            fuel_date: data.fuel_date.toISOString(),
            vehicle_id: data.vehicle_id,
            driver_name: data.driver_name,
            liters: data.liters,
            mileage: data.mileage,
            supervisor_id: user.id,
            ticket_url: data.ticket_url,
            notes: data.notes,
            cost_usd: data.liters * 0.5 // Fixed rate: $0.5 per liter
        })

        if (error) throw error

        revalidatePath("/control/combustible")
        revalidatePath("/gerencia")
        revalidatePath("/transporte")

        // [NEW] Auto-reset vehicle fuel to 100% (Full) on refuel
        const { error: updateError } = await supabase.from("vehiculos").update({
            current_fuel_level: 100,
            last_fuel_update: new Date().toISOString()
        }).eq("id", data.vehicle_id)

        if (updateError) throw updateError

        return { success: true }
    } catch (error: any) {
        console.error("Create Fuel Log Error:", error)
        return { success: false, error: error.message }
    }
}

export async function getFuelLogs(filters?: { startDate?: string, endDate?: string, vehicleId?: string }) {
    const supabase = await createClient()

    let query = supabase
        .from("fuel_logs")
        .select(`
            *,
            vehicle:vehiculos(placa, modelo, codigo),
            supervisor:profiles(first_name, last_name)
        `) // Assuming explicit FK relation or simple join. We might need to check profile relation name.
        // If 'supervisor_id' references auth.users, we join on profiles via id usually.
        // Let's assume 'profiles' has a FK to users, or is the user table extension. 
        // If supervisor_id is auth.users.id, and profiles.id is auth.users.id:
        .order("fuel_date", { ascending: false })

    if (filters?.startDate) {
        query = query.gte("fuel_date", filters.startDate)
    }
    if (filters?.endDate) {
        // Append end of day time to ensure we include records from that day
        query = query.lte("fuel_date", `${filters.endDate} 23:59:59`)
    }
    if (filters?.vehicleId && filters.vehicleId !== "all") {
        query = query.eq("vehicle_id", filters.vehicleId)
    }

    const { data, error } = await query

    if (error) {
        console.error("Get Fuel Logs Error:", error)
        return []
    }

    // Map supervisor name manually if join fails or is complex, but basic join should work if FK exists.
    // However, profiles usually reference auth.users. fuel_logs references auth.users.
    // So fuel_logs.supervisor_id -> profiles.id should work if IDs match.
    // To be safe, we can fetch profiles separately if needed, but let's try strict join first.
    // Actually, explicit foreign key 'fuel_logs_supervisor_id_fkey' points to auth.users.
    // Supabase Postgrest can switch to profiles if profiles.id is FK to auth.users.
    // But usually we need to select `supervisor:profiles(...)` and ensuring `fuel_logs.supervisor_id` matches `profiles.id`.

    return data
}

export async function getVehicleDetailsAction(vehicleId: string) {
    const supabase = await createClient()

    // 1. Get Vehicle & Driver Info
    const { data: vehicle, error: vError } = await supabase
        .from("vehiculos")
        .select(`
            *,
            driver:profiles!assigned_driver_id(first_name, last_name)
        `) // Assuming relation name or using strict join on assigned_driver_id
        .eq("id", vehicleId)
        .single()

    if (vError || !vehicle) {
        console.error("Error fetching vehicle details:", vError)
        return null
    }

    // 2. Get Last Fuel Log
    const { data: lastFuel } = await supabase
        .from("fuel_logs")
        .select("fuel_date, liters, mileage")
        .eq("vehicle_id", vehicleId)
        .order("fuel_date", { ascending: false })
        .limit(1)
        .single()

    return {
        ...vehicle,
        last_fuel: lastFuel || null
    }
}
