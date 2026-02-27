"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// [UPDATED] Interface to match new columns
type MaintenanceData = {
    vehicle_id: string
    service_type: string
    mileage: number
    notes?: string
    performed_by?: string
    // New fields
    cost?: number      // Legacy total cost (optional)
    labor_cost?: number
    parts_cost?: number
    parts_used?: string
}

export async function registerMaintenance(data: MaintenanceData) {
    const supabase = await createClient()

    try {
        // [New] Calculate total if not provided
        const totalCost = data.cost || ((data.labor_cost || 0) + (data.parts_cost || 0))

        // [NEW] Validate Integrity (300km Rule)
        // Fetch current status
        const { data: vStatus } = await supabase.from('vehiculos').select('odometro_averiado').eq('id', data.vehicle_id).single()
        const isBroken = vStatus?.odometro_averiado || false

        const { data: lastKmData } = await supabase.from('vista_ultimos_kilometrajes').select('ultimo_kilometraje').eq('vehiculo_id', data.vehicle_id).single()
        const currentKm = lastKmData?.ultimo_kilometraje || 0

        if (!isBroken) {
            if (data.mileage < currentKm) {
                return { success: false, error: `El kilometraje (${data.mileage}) no puede ser menor al actual (${currentKm}).` }
            }
            // [MODIFIED] Allow initialization if currentKm is 0
            if (currentKm > 0 && data.mileage > currentKm + 300) {
                return { success: false, error: `Error: El kilometraje excede el límite de 300km respecto al actual. Verifica si hay un cero de más.` }
            }
        }

        // 1. Insert Log
        const { error: logError } = await supabase.from('maintenance_logs').insert({
            vehicle_id: data.vehicle_id,
            service_type: data.service_type,
            mileage: data.mileage,
            notes: data.notes,
            performed_by: data.performed_by,
            cost: totalCost,
            labor_cost: data.labor_cost || 0,
            parts_cost: data.parts_cost || 0,
            parts_used: data.parts_used || "",
            service_date: new Date().toISOString()
        })

        if (logError) throw logError

        // 2. Update Vehicle Columns based on Service Type
        let updateData: any = {}

        if (data.service_type === 'OIL_CHANGE') {
            updateData.last_oil_change_km = data.mileage
        } else if (data.service_type === 'TIMING_BELT') {
            updateData.last_timing_belt_km = data.mileage
        } else if (data.service_type === 'CHAIN_KIT') {
            updateData.last_chain_kit_km = data.mileage
        } else if (data.service_type === 'WASH') {
            updateData.last_wash_date = new Date().toISOString()
        }

        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
                .from('vehiculos')
                .update(updateData)
                .eq('id', data.vehicle_id)

            if (updateError) throw updateError
        }

        revalidatePath('/taller')
        revalidatePath('/admin/vehiculos')

        return { success: true }
    } catch (error: any) {
        console.error('Maintenance Registration Error:', error)
        return { success: false, error: error.message }
    }
}

export async function reportFault(data: {
    vehicle_id: string
    description: string
    priority: string
    fault_type: string
}) {
    const supabase = await createClient()

    try {
        const { error } = await supabase.from('fallas').insert({
            vehiculo_id: data.vehicle_id,
            descripcion: data.description,
            prioridad: data.priority,
            tipo_falla: data.fault_type,
            estado: 'Pendiente',
            created_at: new Date().toISOString()
        })

        if (error) throw error

        revalidatePath('/taller')
        return { success: true }
    } catch (error: any) {
        console.error('Report Fault Error:', error)
        return { success: false, error: error.message }
    }
}

export async function resolveFault(id: string) {
    const supabase = await createClient()

    try {
        const { data: updatedFault, error } = await supabase
            .from('fallas')
            .update({
                estado: 'Reparado',
                fecha_solucion: new Date().toISOString()
            })
            .eq('id', id)
            .select('descripcion, vehiculo_id') // [NEW] Fetch data to check type
            .single()

        if (error) throw error

        // [NEW] Automatic Odometer Fix (Circuit Breaker)
        if (updatedFault && updatedFault.descripcion.includes('Falla de Odómetro')) {
            await supabase.from('vehiculos')
                .update({ odometro_averiado: false })
                .eq('id', updatedFault.vehiculo_id)
        }

        revalidatePath('/taller')
        return { success: true }
    } catch (error: any) {
        console.error('Resolve Fault Error:', error)
        return { success: false, error: error.message }
    }
}
