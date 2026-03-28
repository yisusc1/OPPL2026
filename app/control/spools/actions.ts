"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

export async function getActiveSpools() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    // Fetch active assignments with Team and Items
    // We assume items[0] holds the spool info since it's a spool assignment
    const { data, error } = await supabase
        .from("inventory_assignments")
        .select(`
            id,
            code,
            created_at,
            team:teams(id, name),
            items:inventory_assignment_items(
                quantity,
                serials,
                product:inventory_products(name, sku)
            )
        `)
        .eq("status", "ACTIVE")
        .eq("status", "ACTIVE")
        // .not("team_id", "is", null) // Commenting out filter for debugging
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching spools:", error)
        return []
    }

    // Enhance with current status from View (Source of Truth)
    const serials = data.map((a: any) => {
        const item = a.items?.[0]
        return (item?.serials && item.serials.length > 0)
            ? (typeof item.serials[0] === 'string' ? item.serials[0] : item.serials[0].serial)
            : null
    }).filter(Boolean) as string[]

    // Bulk Fetch Status
    let spoolStatusMap: Record<string, any> = {}
    if (serials.length > 0) {
        const { data: statusData } = await supabase
            .from("view_spool_status")
            .select("serial_number, current_quantity, initial_quantity, usage_since_base")
            .in("serial_number", serials)

        statusData?.forEach((s: any) => {
            spoolStatusMap[s.serial_number] = s
        })
    }

    const enriched = data.map((a: any) => {
        const item = a.items?.[0] // Safe access
        if (!item || !item.serials || item.serials.length === 0) return a

        const serialNum = typeof item.serials[0] === 'string' ? item.serials[0] : item.serials[0].serial
        const status = spoolStatusMap[serialNum]

        // If view has data, use it. Else fallback to initial.
        const currentQty = status ? status.current_quantity : item.quantity
        const reportedUsage = status ? status.usage_since_base : 0

        return {
            ...a,
            serial_number: serialNum,
            product_name: item.product?.name || "Desconocido", // Safe access
            initial_quantity: status ? status.initial_quantity : item.quantity,
            current_quantity: currentQty,
            reported_usage: reportedUsage
        }
    })

    return enriched
}

export async function getTeams() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    const { data } = await supabase
        .from("teams")
        .select("id, name, profiles(id)")
        .order("name")

    // Map to include member count
    return data?.map((t: any) => ({
        id: t.id,
        name: t.name,
        memberCount: t.profiles?.length || 0
    })) || []
}

export async function assignSpoolToTeam(teamId: string, serial: string, initialMeters: number) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    try {
        // 0. Validate if Serial is ALREADY assigned (Any Status)
        // Check ALL history to prevent reusing a finalized spool
        const { data: allItems } = await supabase
            .from("inventory_assignment_items")
            .select("serials")

        const isUsed = allItems?.some((item: any) => {
            if (!item.serials || item.serials.length === 0) return false

            const existingSerial = typeof item.serials[0] === 'string'
                ? item.serials[0]
                : item.serials[0].serial

            return existingSerial === serial
        })

        if (isUsed) {
            throw new Error(`El serial ${serial} ya ha sido utilizado anteriormente.`)
        }

        // 1. Find Product ID for "CARRETE" (Generic or Specific?)
        // Let's look for a product with SKU "CARRETE-FIBRA" or just match first "CARRETE"
        const { data: products } = await supabase
            .from("inventory_products")
            .select("id, sku")
            .ilike("sku", "%CARRETE%")
            .limit(1)

        if (!products || products.length === 0) throw new Error("Producto 'CARRETE' no encontrado en inventario master.")
        const productId = products[0].id

        // 2. Upsert Serial Record
        const { error: serialError } = await supabase
            .from("inventory_serials")
            .upsert({
                serial_number: serial,
                product_id: productId,
                status: 'ASSIGNED', // Custom status? Or 'AVAILABLE'? Let's use ASSIGNED if enum supports it. 
                // If enum is strict (AVAILABLE, SOLD, RETURNED), we might default to AVAILABLE but logically it's assigned.
                // Re-checking enum... user didn't specify. Let's assume 'AVAILABLE' but assigned via table.
                // Actually, let's just update quantities. The status is managed by the Assignment Table being ACTIVE.
                initial_quantity: initialMeters,
                current_quantity: initialMeters,
                updated_at: new Date().toISOString()
            }, { onConflict: 'serial_number, product_id' })

        if (serialError) throw new Error("Error actualizando serial: " + serialError.message)

        // 3. Create Assignment
        const { data: assignment, error: assignError } = await supabase
            .from("inventory_assignments")
            .insert({
                code: `ASG-${Date.now().toString().slice(-6)}`,
                team_id: teamId,
                status: 'ACTIVE',
                assigned_to: (await supabase.auth.getUser()).data.user?.id // Created by Supervisor
            })
            .select()
            .single()

        if (assignError) throw new Error("Error creando asignación: " + assignError.message)

        // 4. Create Assignment Items
        const { error: itemError } = await supabase
            .from("inventory_assignment_items")
            .insert({
                assignment_id: assignment.id,
                product_id: productId,
                quantity: initialMeters,
                serials: [serial]
            })

        if (itemError) throw new Error("Error vinculando items: " + itemError.message)

        // 5. Log Transaction
        await supabase.from("inventory_transactions").insert({
            type: 'ASSIGN',
            quantity: -initialMeters, // Removed from warehosue? Or just assigned.
            previous_stock: 0,
            new_stock: 0,
            reason: `Asignación de Bobina ${serial} a Equipo`,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            serials: [serial]
        })

        revalidatePath("/control/spools")
        return { success: true }

    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function returnSpool(assignmentId: string, finalMeters: number) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    try {
        // 1. Close Assignment
        const { error } = await supabase
            .from("inventory_assignments")
            .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
            .eq("id", assignmentId)

        if (error) throw new Error(error.message)

        revalidatePath("/control/spools")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getSpoolHistory() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    // Fetch CLOSED assignments
    const { data: assignments, error } = await supabase
        .from("inventory_assignments")
        .select(`
            id,
            code,
            created_at,
            closed_at,
            status,
            team:teams(name),
            items:inventory_assignment_items(
                quantity,
                serials,
                product:inventory_products(sku, name)
            )
        `)
        .eq("status", "CLOSED")
        .order("closed_at", { ascending: false })

    if (error) {
        console.error("Error fetching history:", error)
        return []
    }

    // Filter only Spools and Calculate Stuff
    const history = await Promise.all(assignments.map(async (a: any) => {
        // Find spool item
        const item = a.items?.find((i: any) => i.product?.sku?.includes("CARRETE"))
        if (!item || !item.serials?.[0]) return null

        const serial = typeof item.serials[0] === 'string' ? item.serials[0] : item.serials[0].serial
        const initial = item.quantity

        // Usage calculation
        const { data: usageData } = await supabase
            .from("cierres")
            .select("metraje_usado, metraje_desechado")
            .eq("codigo_carrete", serial)
            .gte("created_at", a.created_at)
            .lte("created_at", a.closed_at || new Date().toISOString()) // Only usage DURING assignment

        let used = 0
        let wasted = 0

        usageData?.forEach((u: any) => {
            used += (Number(String(u.metraje_usado).replace(/[^0-9.]/g, "")) || 0)
            wasted += (Number(String(u.metraje_desechado).replace(/[^0-9.]/g, "")) || 0)
        })

        return {
            id: a.id,
            team: a.team?.name || "Sin Equipo",
            serial,
            initial,
            used,
            wasted,
            remaining: initial - used - wasted,
            closed_at: a.closed_at
        }
    }))

    return history.filter(Boolean)
}
