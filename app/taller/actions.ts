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

        // 1. Fetch Maintenance Config FIRST to resolve custom name
        const isCustomUUID = data.service_type.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        let configQuery = supabase.from('vehicle_maintenance_configs').select('*').eq('vehicle_id', data.vehicle_id)
        if (isCustomUUID) {
            configQuery = configQuery.eq('id', data.service_type)
        } else {
            configQuery = configQuery.eq('service_type', data.service_type)
        }
        const { data: configRows } = await configQuery
        const targetConfig = (configRows && configRows.length > 0) ? configRows[0] : null

        // 2. Determine log service type and enrich notes with custom name
        let logServiceType = data.service_type
        let resolvedName = ''
        if (targetConfig) {
            if (targetConfig.service_type === 'OIL_CHANGE') resolvedName = 'Cambio de Aceite'
            else if (targetConfig.service_type === 'WASH') resolvedName = 'Lavado y Aspirado'
            else if (targetConfig.service_type === 'TIMING_BELT') resolvedName = 'Correa de Tiempo'
            else if (targetConfig.service_type === 'CHAIN_KIT') resolvedName = 'Kit de Arrastre'
            else resolvedName = targetConfig.custom_name || 'Servicio Personalizado'
        }

        if (isCustomUUID) {
            logServiceType = 'OTHER'
        }

        // Build final notes: prepend the resolved service name
        const finalNotes = resolvedName
            ? `${resolvedName}${data.notes ? ' - ' + data.notes : ''}`
            : (data.notes || 'Mantenimiento Preventivo')

        // 3. Insert Log
        const { error: logError } = await supabase.from('maintenance_logs').insert({
            vehicle_id: data.vehicle_id,
            service_type: logServiceType,
            mileage: data.mileage,
            notes: finalNotes,
            performed_by: data.performed_by,
            cost: totalCost,
            labor_cost: data.labor_cost || 0,
            parts_cost: data.parts_cost || 0,
            parts_used: data.parts_used || "",
            service_date: new Date().toISOString()
        })

        if (logError) throw logError

        // 4. Update Maintenance Config last_service_value
        if (targetConfig) {
            const newValue = targetConfig.is_time_based ? new Date().getTime() : data.mileage
            const { error: updateError } = await supabase
                .from('vehicle_maintenance_configs')
                .update({ last_service_value: newValue })
                .eq('id', targetConfig.id)
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
