"use server"

import { createClient } from "@/lib/supabase/server"

export type IntegrityIssue = {
    type: 'CRITICAL' | 'WARNING' | 'INFO'
    title: string
    description: string
    entityId?: string
    table?: string
}

export async function runIntegrityCheck(): Promise<IntegrityIssue[]> {
    const supabase = await createClient()
    const issues: IntegrityIssue[] = []

    try {
        // 1. Check Negative Stock
        const { data: negStock } = await supabase
            .from("inventory_products")
            .select("id, name, current_stock")
            .lt("current_stock", 0)

        if (negStock) {
            negStock.forEach(p => {
                issues.push({
                    type: 'CRITICAL',
                    title: 'Stock Negativo',
                    description: `El producto "${p.name}" tiene stock de ${p.current_stock}.`,
                    entityId: p.id,
                    table: 'inventory_products'
                })
            })
        }

        // 2. Check Fuel Logs without Vehicle
        // (Assuming Left Join or similar, but simplified check: logs where vehicle_id is null or not found)
        // Checks referential integrity if not enforced by DB FK

        // 3. Check Mileage Inconsistency
        // Complex query. We'll simplify: Find logs where mileage < previous log for same vehicle.
        // This is hard in pure Supabase API efficiently without Window Functions in SQL.
        // We'll skip complex one for now or use a View if available.

        // 4. Orphaned Users (Profiles without Roles)
        const { data: noRoles } = await supabase
            .from("profiles")
            .select("id, email, roles")
            .is("roles", null) // or empty array logic if needed

        if (noRoles) {
            noRoles.forEach(p => {
                issues.push({
                    type: 'WARNING',
                    title: 'Usuario sin Roles',
                    description: `El usuario ${p.email} no tiene roles definidos.`,
                    entityId: p.id,
                    table: 'profiles'
                })
            })
        }

        return issues

    } catch (error) {
        console.error("Integrity Check Error:", error)
        return [{ type: 'CRITICAL', title: 'Error de Ejecución', description: 'Falló el análisis de integridad.' }]
    }
}
