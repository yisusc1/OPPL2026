"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function validateSerial(serial: string, productId: string) {
    const supabase = await createClient()

    // Check if serial exists and is available
    const { data, error } = await supabase
        .from("inventory_serials")
        .select("status")
        .eq("serial_number", serial)
        .eq("product_id", productId)
        .single()

    if (error || !data) {
        return { valid: false, message: "No encontrado" }
    }

    if (data.status !== 'AVAILABLE') {
        return { valid: false, message: `Estado: ${data.status}` }
    }

    return { valid: true, message: "Disponible" }
}

export async function resetInventoryAction() {
    try {
        const supabase = await createClient()

        // 1. Delete Transactions
        const { error: tError } = await supabase.from("inventory_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        if (tError) throw tError

        // 2. Delete Returns components (MUST be before Assignments due to FK)
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
        return { success: true }
    } catch (error: any) {
        console.error("Reset Inventory Error:", error)
        return { success: false, error: error.message }
    }
}

export async function resetOperationsAction() {
    try {
        const supabase = await createClient()

        // Use RPC to bypass RLS and ensure complete deletion of all operational data
        // This handles: cierres, asignaciones, clientes, returns, and resets serials.
        const { error: rpcError } = await supabase.rpc('reset_operations_v2')

        if (rpcError) throw rpcError

        revalidatePath("/tecnicos")
        return { success: true }
    } catch (error: any) {
        console.error("Reset Operations Error:", error)
        return { success: false, error: error.message }
    }
}
