"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// 1. RESET INVENTORY (Keeps Products)
export async function resetInventoryAction() {
    try {
        const supabase = await createClient()

        // 1. Delete Transactions
        const { error: tError } = await supabase.from("inventory_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        if (tError) throw tError

        // 2. Delete Returns components
        await supabase.from("inventory_return_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("inventory_returns").delete().neq("id", "00000000-0000-0000-0000-000000000000")

        // 3. Delete Assignments components
        await supabase.from("inventory_assignment_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("inventory_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000")

        // 4. Update Stock to 0
        const { error: pError } = await supabase
            .from("inventory_products")
            .update({ current_stock: 0 })
            .neq("id", "00000000-0000-0000-0000-000000000000")

        if (pError) throw pError

        // 5. Reset Serials
        await supabase.from("inventory_serials").delete().neq("serial_number", "00000_IGNORE")

        revalidatePath("/almacen")
        revalidatePath("/admin/database")
        return { success: true }
    } catch (error: any) {
        console.error("Reset Inventory Error:", error)
        return { success: false, error: error.message }
    }
}

// 2. RESET OPERATIONS 
export async function resetOperationsAction() {
    try {
        // [FIX] Use Service Role Key to BYPASS RLS
        // Standard user token might not have permission to delete Other Users' reports/assignments.
        const cookieStore = await cookies()
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY

        let supabase
        if (key) {
            supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                key,
                { cookies: { getAll: () => [], setAll: () => { } } }
            )
        } else {
            // [CRITICAL] If key is missing, throw error so user knows why it failed.
            // Falling back to user client won't work for global wipe.
            throw new Error("Clave Maestra de Admin no configurada (SUPABASE_SERVICE_ROLE_KEY). No se puede reiniciar.")
        }

        // 1. Audits & Reports (Child Tables)
        await supabase.from("inventory_audits").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("technician_daily_reports").delete().neq("id", 0)

        // 2. Activity Data
        await supabase.from("soportes").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("cierres").delete().neq("id", 0)
        await supabase.from("revisiones").delete().neq("id", "00000000-0000-0000-0000-000000000000")

        // 3. Assignments (Asignaciones)
        // Must delete items first, then headers.
        await supabase.from("inventory_assignment_items").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        await supabase.from("inventory_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000")

        // 4. Clients (Users said "Borra clientes")
        await supabase.from("clientes").delete().neq("id", "00000000-0000-0000-0000-000000000000")

        // 5. Serials (User requested removal)
        // This might kill stock tracking, but it's what they asked for "Reiniciar Operaciones -> inventory_serials"
        await supabase.from("inventory_serials").delete().neq("serial_number", "00000_IGNORE")

        // 4. Try RPC as backup? No, manual should suffice.
        // const { error: rpcError } = await supabase.rpc('reset_operations_v2')
        // if (rpcError) throw rpcError

        revalidatePath("/tecnicos")
        revalidatePath("/admin/database")
        return { success: true }
    } catch (error: any) {
        console.error("Reset Operations Error:", error)
        return { success: false, error: error.message }
    }
}

// 3. RESET FULE LOGS (Keeps Vehicles)
export async function resetFuelLogsAction() {
    try {
        const supabase = await createClient()

        // Delete all logs
        const { error } = await supabase
            .from("fuel_logs")
            .delete()
            .neq("id", 0) // Delete all

        if (error) throw error

        revalidatePath("/control/combustible")
        revalidatePath("/admin/database")
        return { success: true }
    } catch (error: any) {
        console.error("Reset Fuel Error:", error)
        return { success: false, error: error.message }
    }
}
