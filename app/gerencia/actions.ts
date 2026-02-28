"use server"

import { createClient } from "@/lib/supabase/server"
import { addDays, format, subDays, startOfDay, endOfDay, differenceInMinutes } from "date-fns"
import { es } from "date-fns/locale"
import { unstable_noStore as noStore } from "next/cache"

export type DashboardStats = {
    installationsToday: number
    supportsToday: number
    activeFaults: number
    vehiclesInMaintenance: number
    chartData: any[]
    vehicleStats: {
        total: number
        operational: number
        critical: number
        maintenance: number
    }
}

export async function getDashboardStats(): Promise<DashboardStats> {
    const supabase = await createClient()
    const today = new Date()
    const startOfToday = startOfDay(today).toISOString()
    const endOfToday = endOfDay(today).toISOString()

    // 1. KPI: Installations Today
    const { count: installCount } = await supabase
        .from("cierres")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday)

    // 2. KPI: Supports Today
    const { count: supportCount } = await supabase
        .from("soportes")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday)

    // 3. KPI: Active Faults (Count of actual faults, for the card)
    const { count: faultsCount } = await supabase
        .from("fallas")
        .select("*", { count: 'exact', head: true })
        .neq("estado", "Resuelto")
        .neq("estado", "Descartado")
        .neq("estado", "Reparado")

    // 4. KPI: Maintenance (Just a raw count of 'En Revisión' faults? Or Vehicles? The Label says 'Vehículos en Taller')
    // We will calculate exact vehicle counts below.

    // 5. Fleet Stats Calculation
    // Fetch all vehicles
    const { data: vehicles } = await supabase.from("vehiculos").select("id")

    // Fetch all active faults with vehicle_id and status
    const { data: activeFaultsData } = await supabase
        .from("fallas")
        .select("vehiculo_id, estado")
        .neq("estado", "Resuelto")
        .neq("estado", "Descartado")
        .neq("estado", "Reparado")

    // Process Fleet Stats
    const totalVehicles = vehicles?.length || 0
    let maintenanceVehiclesCount = 0
    let criticalVehiclesCount = 0

    // Set of vehicle IDs that are down
    const downVehicleIds = new Set<string>()

    if (activeFaultsData) {
        // Group by vehicle
        const vehicleStatusMap = new Map<string, Set<string>>()

        activeFaultsData.forEach(f => {
            if (!vehicleStatusMap.has(f.vehiculo_id)) {
                vehicleStatusMap.set(f.vehiculo_id, new Set())
            }
            vehicleStatusMap.get(f.vehiculo_id)?.add(f.estado)
        })

        vehicleStatusMap.forEach((statuses, vehicleId) => {
            downVehicleIds.add(vehicleId)
            // Priority: Maintenance > Critical
            if (statuses.has("En Revisión")) {
                maintenanceVehiclesCount++
            } else {
                criticalVehiclesCount++
            }
        })
    }

    const operationalVehiclesCount = Math.max(0, totalVehicles - downVehicleIds.size)

    // 6. Chart Data (Last 7 Days)
    const chartData = []
    for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i)
        const dateStr = format(date, "yyyy-MM-dd")
        const label = format(date, "EEE", { locale: es })

        const dStart = startOfDay(date).toISOString()
        const dEnd = endOfDay(date).toISOString()

        const { count: iCount } = await supabase.from("cierres").select("*", { count: 'exact', head: true }).gte("created_at", dStart).lte("created_at", dEnd)
        const { count: sCount } = await supabase.from("soportes").select("*", { count: 'exact', head: true }).gte("created_at", dStart).lte("created_at", dEnd)

        chartData.push({
            date: label,
            Instalaciones: iCount || 0,
            Soportes: sCount || 0
        })
    }

    return {
        installationsToday: installCount || 0,
        supportsToday: supportCount || 0,
        activeFaults: faultsCount || 0, // This is total active faults (for the KPI card)
        vehiclesInMaintenance: maintenanceVehiclesCount, // This is unique vehicles
        chartData,
        vehicleStats: {
            total: totalVehicles,
            operational: operationalVehiclesCount,
            critical: criticalVehiclesCount,
            maintenance: maintenanceVehiclesCount
        }
    }
}

// --- NEW FEATURES ---

export type FleetStatus = {
    id: string
    code: string
    plate: string
    model: string
    // Driver Info
    driver: string | null
    assigned_driver_id: string | null
    driverImg?: string | null
    driverPhone?: string | null
    driverEmail?: string | null
    // Status
    status: 'AVAILABLE' | 'IN_ROUTE' | 'MAINTENANCE' | 'CRITICAL'
    imageUrl?: string
    // Trip Info
    lastExit?: string
    tripDuration?: string | null // NEW: formatted duration
    activeReport?: any
    // Health
    activeFaults: number
    faultsSummary: {
        critical: number
        high: number
        medium: number
        low: number
    }
    // Details
    tipo: string
    año: string
    color: string
    capacidad_tanque: string
    kilometraje: number
    current_fuel_level: number
    last_fuel_update: string
    last_oil_change_km: number
    last_timing_belt_km: number
    last_chain_kit_km: number
    last_wash_date: string
    department: string
}

export async function getFleetStatus(): Promise<FleetStatus[]> {
    noStore()
    const supabase = await createClient()

    // 1. Fetch Vehicles RAW (No Joins to avoid FK errors)
    const { data: vehicles } = await supabase
        .from("vehiculos")
        .select("*")
        .order('codigo')

    if (!vehicles) return []

    // 2. Fetch Active Trips RAW
    const { data: activeTrips } = await supabase
        .from("reportes")
        .select("*")
        .is("km_entrada", null)

    const tripsMap = new Map(activeTrips?.map(t => [t.vehiculo_id, t]))

    // 3. Manual Join Strategy: Collect all Profile IDs involved
    const profileIds = new Set<string>()

    // Collect from Vehicles (Assigned Driver)
    vehicles.forEach(v => {
        if (v.assigned_driver_id) profileIds.add(v.assigned_driver_id)
    })

    // Collect from Active Trips (Current Driver)
    activeTrips?.forEach(t => {
        if (t.user_id) profileIds.add(t.user_id)
    })

    // Fetch All Relevant Profiles in one go
    let profilesMap = new Map<string, any>()
    if (profileIds.size > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, foto_url, phone, email")
            .in("id", Array.from(profileIds))

        profiles?.forEach(p => {
            profilesMap.set(p.id, p)
        })
    }

    // 4. Fetch Active Faults Count
    const { data: faults } = await supabase
        .from("fallas")
        .select("vehiculo_id, prioridad, estado")
        .neq("estado", "Resuelto")
        .neq("estado", "Reparado")
        .neq("estado", "Descartado")

    const faultsSummaryMap = new Map<string, { critical: number, high: number, medium: number, low: number, isMaintenance: boolean }>()

    faults?.forEach(f => {
        const current = faultsSummaryMap.get(f.vehiculo_id) || { critical: 0, high: 0, medium: 0, low: 0, isMaintenance: false }

        // Check for Maintenance Status
        if (f.estado === 'En Revisión') {
            current.isMaintenance = true
        }

        switch (f.prioridad?.toLowerCase()) {
            case 'crítica':
            case 'critica':
                current.critical++
                break
            case 'alta':
                current.high++
                break
            case 'media':
                current.medium++
                break
            default:
                current.low++
        }
        faultsSummaryMap.set(f.vehiculo_id, current)
    })

    // 5. Fetch Latest Mileage
    const { data: mileageData } = await supabase
        .from("vista_ultimos_kilometrajes")
        .select("vehiculo_id, ultimo_kilometraje")

    const mileageMap = new Map(mileageData?.map(m => [m.vehiculo_id, m.ultimo_kilometraje]))

    return vehicles.map(v => {
        const activeTrip = tripsMap.get(v.id)
        const inRoute = !!activeTrip

        const summary = faultsSummaryMap.get(v.id) || { critical: 0, high: 0, medium: 0, low: 0, isMaintenance: false }
        const activeFaults = summary.critical + summary.high + summary.medium + summary.low

        let status: FleetStatus['status'] = 'AVAILABLE'

        if (inRoute) status = 'IN_ROUTE'
        else if (summary.isMaintenance) status = 'MAINTENANCE'
        else if (activeFaults > 0 || v.falla_activa) status = 'CRITICAL'

        // --- RESOLVE DRIVER INFO MANUALLY ---

        // 1. Get Assigned Driver Info
        let assignedDriver = null
        if (v.assigned_driver_id && profilesMap.has(v.assigned_driver_id)) {
            assignedDriver = profilesMap.get(v.assigned_driver_id)
        }

        // 2. Determine Display Driver
        // Default to Assigned Driver
        let displayDriverName = assignedDriver ? `${assignedDriver.first_name} ${assignedDriver.last_name}` : null
        let displayDriverImg = assignedDriver?.foto_url
        let displayDriverPhone = assignedDriver?.phone
        let displayDriverEmail = assignedDriver?.email

        // Override if In Route (Show Current Driver)
        if (inRoute && activeTrip) {
            let tripDriver = null
            if (activeTrip.user_id && profilesMap.has(activeTrip.user_id)) {
                tripDriver = profilesMap.get(activeTrip.user_id)
            }

            if (tripDriver) {
                displayDriverName = `${tripDriver.first_name} ${tripDriver.last_name}`
                displayDriverImg = tripDriver.foto_url
                displayDriverPhone = tripDriver.phone
                displayDriverEmail = tripDriver.email
            } else if (activeTrip.conductor) {
                // Text fallback
                displayDriverName = activeTrip.conductor
            }
        }

        // Calculate Duration
        let tripDuration = null
        if (inRoute && activeTrip?.fecha_salida) {
            const startStr = activeTrip.fecha_salida
            // date-fns difference
            const start = new Date(startStr)
            const now = new Date()
            const diffMins = differenceInMinutes(now, start)

            const hours = Math.floor(diffMins / 60)
            const mins = diffMins % 60
            tripDuration = `${hours}h ${mins}m`
        }

        return {
            id: v.id,
            code: v.codigo,
            plate: v.placa,
            model: v.modelo,
            driver: displayDriverName,
            assigned_driver_id: v.assigned_driver_id,
            driverImg: displayDriverImg,
            driverPhone: displayDriverPhone,
            driverEmail: displayDriverEmail,
            status,
            imageUrl: v.foto_url,
            lastExit: activeTrip?.fecha_salida, // Prioritize trip start time
            tripDuration,
            activeReport: activeTrip,
            activeFaults,
            faultsSummary: summary,
            // Details
            tipo: v.tipo,
            año: v.año,
            color: v.color,
            capacidad_tanque: v.capacidad_tanque,
            kilometraje: Math.max(mileageMap.get(v.id) || 0, v.kilometraje || 0),
            current_fuel_level: v.current_fuel_level,
            last_fuel_update: v.last_fuel_update,
            last_oil_change_km: v.last_oil_change_km,
            last_timing_belt_km: v.last_timing_belt_km,
            last_chain_kit_km: v.last_chain_kit_km,
            last_wash_date: v.last_wash_date,
            department: v.department
        }
    })
}

export type NotificationItem = {
    id: string
    type: 'FALLA' | 'SALIDA' | 'ENTRADA' | 'REPARACION'
    title: string
    description: string
    timestamp: string
    vehicle_plate: string
    metadata: {
        priority?: string
        status?: string
        driver?: string
        model?: string
    }
}

export async function getNotificationHistory(offset = 0, limit = 50): Promise<NotificationItem[]> {
    noStore()
    const supabase = await createClient()

    // Fetch slightly more than needed to ensure correct merge sorting safety
    const safeLimit = offset + limit

    // 1. Fetch Recent Faults
    const { data: faults } = await supabase
        .from("fallas")
        .select(`
            id,
            created_at,
            descripcion,
            prioridad,
            estado,
            vehiculos (placa, modelo)
        `)
        .order('created_at', { ascending: false })
        .limit(safeLimit)

    // 2. Fetch Recent Trips
    const { data: trips } = await supabase
        .from("reportes")
        .select(`
            id,
            fecha_salida,
            fecha_entrada,
            conductor,
            vehiculo_id,
            vehiculos (placa, modelo)
        `)
        .order('fecha_salida', { ascending: false })
        .limit(safeLimit)

    const notifications: NotificationItem[] = []

    // Map Faults
    faults?.forEach((f: any) => {
        const title = `${f.vehiculos?.modelo} (${f.vehiculos?.placa || '?'})`
        const isResolved = f.estado === 'Reparado' || f.estado === 'Resuelto'

        notifications.push({
            id: `f-${f.id}`,
            // If resolved, treat as REPARACION, otherwise FALLA
            type: isResolved ? 'REPARACION' : 'FALLA',
            title: title,
            description: isResolved ? 'Reparación completada por mecánico' : f.descripcion,
            timestamp: f.created_at, // Ideally we'd use 'updated_at' if available, but created_at is fallback
            vehicle_plate: f.vehiculos?.placa || '???',
            metadata: {
                priority: f.prioridad,
                status: f.estado,
                model: f.vehiculos?.modelo
            }
        })
    })

    // Map Trips (Exits and Entries)
    trips?.forEach((t: any) => {
        const title = `${t.vehiculos?.modelo} (${t.vehiculos?.placa || '?'})`

        // Exit Event
        if (t.fecha_salida) {
            notifications.push({
                id: `s-${t.id}`,
                type: 'SALIDA',
                title: title,
                description: `Conductor: ${t.conductor || 'Desconocido'}`,
                timestamp: t.fecha_salida,
                vehicle_plate: t.vehiculos?.placa || '???',
                metadata: {
                    driver: t.conductor,
                    model: t.vehiculos?.modelo
                }
            })
        }

        // Entry Event (if exists)
        if (t.fecha_entrada) {
            notifications.push({
                id: `e-${t.id}`,
                type: 'ENTRADA',
                title: title,
                description: `Vehículo regresó a base`,
                timestamp: t.fecha_entrada,
                vehicle_plate: t.vehiculos?.placa || '???',
                metadata: {
                    driver: t.conductor,
                    model: t.vehiculos?.modelo
                }
            })
        }
    })

    // Sort, then slice correct page
    return notifications
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit)
}

export type AdvancedStats = {
    fuelEfficiency: { vehicle: string, kmPerLiter: number }[]
    materialWaste: { item: string, avgPerInstall: number }[] // placeholder
    productivity: { team: string, installs: number }[]
}

export async function getAdvancedStats(): Promise<AdvancedStats> {
    const supabase = await createClient()

    // 1. Fuel Efficiency (Simple avg for demo)
    const { data: logs } = await supabase
        .from("fuel_logs")
        .select("liters, mileage, vehicle:vehiculos(placa)")
        .limit(50)

    // Group by vehicle -> Calculate Delta KM / Liters
    // Complex calculation req previous mileage. 
    // Simply returning mock-ish or raw data for chart.
    // Let's return raw "Liters filled" for now as proxy.

    // 2. Productivity (Installations count by Technician)
    // We need to join users.
    const { data: closures } = await supabase
        .from("cierres")
        .select("tecnico_id") // ID only

    // Count
    const techMap = new Map()
    closures?.forEach(c => {
        // This is ID. We need names.
        techMap.set(c.tecnico_id, (techMap.get(c.tecnico_id) || 0) + 1)
    })

    // Fetch names
    const productivity: { team: string, installs: number }[] = []
    if (techMap.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", Array.from(techMap.keys()))
        profiles?.forEach(p => {
            productivity.push({
                team: `${p.first_name}`,
                installs: techMap.get(p.id) || 0
            })
        })
    }

    return {
        fuelEfficiency: [], // TODO: refine
        materialWaste: [
            { item: "Conectores", avgPerInstall: 2.2 },
            { item: "Tensores", avgPerInstall: 2.0 },
            { item: "Patchcords", avgPerInstall: 1.05 }
        ],
        productivity: productivity.sort((a, b) => b.installs - a.installs).slice(0, 5)
    }
}

export type FuelAnalyticsData = {
    vehicleId: string
    plate: string
    model: string
    totalLiters: number
    totalCost: number
}

export async function getFuelAnalytics(costPerLiter: number = 0.50): Promise<FuelAnalyticsData[]> {
    noStore()
    const supabase = await createClient()

    // Fetch fuel logs with vehicle details
    const { data: logs, error } = await supabase
        .from("fuel_logs")
        .select(`
            liters,
            vehicle_id,
            vehicle:vehiculos(placa, modelo)
        `)

    if (error || !logs) {
        console.error("Error fetching fuel logs for analytics:", error)
        return []
    }

    const aggregated = new Map<string, FuelAnalyticsData>()

    logs.forEach((log: any) => {
        const vId = log.vehicle_id
        if (!vId) return

        const amount = Number(log.liters) || 0
        if (!aggregated.has(vId)) {
            const plate = log.vehicle?.placa || 'N/A'
            const model = log.vehicle?.modelo || 'Desconocido'
            aggregated.set(vId, {
                vehicleId: vId,
                plate,
                model,
                totalLiters: 0,
                totalCost: 0
            })
        }

        const current = aggregated.get(vId)!
        current.totalLiters += amount
        // Update total cost based on accumulated liters
        current.totalCost = current.totalLiters * costPerLiter
    })

    // Sort by total liters descending
    return Array.from(aggregated.values()).sort((a, b) => b.totalLiters - a.totalLiters)
}
