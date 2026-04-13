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

        revalidatePath("/tecnicos")
        return { success: true }
    } catch (error: any) {
        console.error("Reset Operations Error:", error)
        return { success: false, error: error.message }
    }
}

export async function closeAssignmentWithMovement(assignmentId: string, returnItems: { productId: string, quantity: number, condition: string, serials?: string[] }[]) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Validate Assignment
        const { data: assignment, error: assignError } = await supabase
            .from("inventory_assignments")
            .select("*")
            .eq("id", assignmentId)
            .single()

        if (assignError || !assignment) throw new Error("Asignación no encontrada")

        // 2. Create Return Record
        const { data: returnRecord, error: returnError } = await supabase
            .from("inventory_returns")
            .insert({
                assignment_id: assignmentId,
                notes: "Cierre de combo y recepción final",
                user_id: user?.id
            })
            .select()
            .single()

        if (returnError) throw returnError

        // 3. Process Items & Create Transactions
        const returnItemsToInsert = []
        const transactions = []

        for (const item of returnItems) {
            // A. Insert into return_items
            returnItemsToInsert.push({
                return_id: returnRecord.id,
                product_id: item.productId,
                quantity: item.quantity,
                condition: item.condition,
                serials: item.serials || []
            })

            // B. If condition is GOOD (Salvable), we must IN it back to Inventory
            if (item.condition === 'GOOD' && item.quantity > 0) {
                transactions.push({
                    product_id: item.productId,
                    type: 'IN', // Receiving returned unused materials
                    quantity: item.quantity,
                    reason: `Retorno de Combo: ${assignment.code || assignmentId.substring(0, 8)}`,
                    received_by: user?.email || 'Almacen',
                    receiver_id: user?.id,
                    serials: item.serials || []
                })

                // C. Free up Serials if applicable
                if (item.serials && item.serials.length > 0) {
                    await supabase
                        .from("inventory_serials")
                        .update({ status: 'AVAILABLE' })
                        .in("serial_number", item.serials)
                }
            }
        }

        if (returnItemsToInsert.length > 0) {
            await supabase.from("inventory_return_items").insert(returnItemsToInsert)
        }

        if (transactions.length > 0) {
            // This triggers the DB trigger to update `current_stock`
            const { error: txError } = await supabase.from("inventory_transactions").insert(transactions)
            if (txError) throw txError
        }

        // 4. Close Assignment!
        await supabase
            .from("inventory_assignments")
            .update({ status: "CLOSED" })
            .eq("id", assignmentId)

        revalidatePath("/almacen")
        return { success: true }
    } catch (error: any) {
        console.error("Close Assignment Error:", error)
        return { success: false, error: error.message }
    }
}
