import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { ShieldCheck, Package, Disc, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RecepcionClient } from "./client"

export const dynamic = "force-dynamic"

export default async function RecepcionPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    // Fetch AUDITADO assignments
    const { data: assignments } = await supabase
        .from("inventory_assignments")
        .select(`
            id,
            created_at,
            status,
            reference_number,
            assigned_to,
            team_id,
            team:teams(id, name),
            profile:profiles!inventory_assignments_assigned_to_fkey(first_name, last_name),
            items:inventory_assignment_items(
                product_id,
                quantity,
                serials,
                product:inventory_products(sku, name)
            )
        `)
        .eq("status", "AUDITADO")
        .order("created_at", { ascending: false })

    return (
        <PremiumPageLayout title="Recepción de Materiales" description="Cierre físico de combos y recepción de sobrantes.">
            <div className="space-y-6">
                {assignments && assignments.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {assignments.map(assignment => (
                            <RecepcionClient key={assignment.id} assignment={assignment} />
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                        <Package className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Todo al día</h3>
                        <p className="text-zinc-500">No hay combos pendientes por recibir (Estado: AUDITADO).</p>
                    </div>
                )}
            </div>
        </PremiumPageLayout>
    )
}
