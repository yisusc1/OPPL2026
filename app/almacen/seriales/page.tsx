import { createClient } from "@/lib/supabase/server"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Box } from "lucide-react"
import { SerialListClient } from "./client-list"

export default async function SerializedStockPage() {
    const supabase = await createClient()

    // Fetch ALL serials to allow tracking
    const { data: serials, error } = await supabase
        .from("inventory_serials")
        .select(`
            serial_number, 
            status, 
            created_at,
            product:inventory_products(name, sku)
        `)
        .order("created_at", { ascending: false })

    if (error) {
        console.error("Error fetching serials:", error)
    }

    // Group by Product for summary of AVAILABLE items only
    const summary: Record<string, number> = {}
    serials?.forEach((s: any) => {
        if (s.status === 'AVAILABLE') {
            const key = s.product?.name || "Desconocido"
            summary[key] = (summary[key] || 0) + 1
        }
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 font-bold tracking-wider">DISPONIBLE</Badge>
            case 'ASSIGNED': return <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500 font-bold tracking-wider">ASIGNADO</Badge>
            case 'SOLD': return <Badge variant="outline" className="border-muted bg-muted text-muted-foreground font-bold tracking-wider">VENDIDO</Badge>
            case 'RETURNED': return <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500 font-bold tracking-wider">DEVUELTO</Badge>
            default: return <Badge variant="outline" className="border-border bg-muted text-muted-foreground font-bold tracking-wider">{status}</Badge>
        }
    }

    return (
        <PremiumPageLayout 
            title="Stock Serializado" 
            description="Listado completo de seriales y su estado actual."
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: SUMMARY (AVAILABLE ONLY) */}
                <div className="lg:col-span-1 space-y-6">
                    <PremiumCard className="p-0 overflow-hidden text-foreground">
                        <CardHeader className="bg-muted/30 border-b border-border py-4">
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <Box size={20} className="text-emerald-500" />
                                Disponibles en Almacén
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <div className="space-y-4">
                                {Object.entries(summary).map(([name, count]) => (
                                    <div key={name} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                                        <span className="text-sm font-semibold text-foreground">{name}</span>
                                        <Badge variant="secondary" className="bg-background border-border text-foreground font-bold">
                                            {count} unid.
                                        </Badge>
                                    </div>
                                ))}
                                {Object.keys(summary).length === 0 && (
                                    <p className="text-muted-foreground text-center py-4">No hay items disponibles.</p>
                                )}
                            </div>
                        </CardContent>
                    </PremiumCard>
                </div>

                {/* RIGHT COLUMN: LIST ALL */}
                <div className="lg:col-span-2">
                    <PremiumCard className="p-0 overflow-hidden h-auto">
                        <CardHeader className="bg-muted/30 border-b border-border">
                            <div className="flex justify-between items-center text-foreground">
                                <CardTitle className="text-lg">Todos los Seriales</CardTitle>
                                <Badge variant="default" className="font-medium">
                                    {serials?.length || 0} Total
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <SerialListClient serials={serials || []} />
                        </CardContent>
                    </PremiumCard>
                </div>
            </div>
        </PremiumPageLayout>
    )
}
