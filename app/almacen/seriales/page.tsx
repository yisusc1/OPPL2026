import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Box, QrCode } from "lucide-react"
import Link from "next/link"

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
            case 'AVAILABLE': return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold tracking-wider">DISPONIBLE</Badge>
            case 'ASSIGNED': return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-bold tracking-wider">ASIGNADO</Badge>
            case 'SOLD': return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 font-bold tracking-wider">VENDIDO</Badge>
            case 'RETURNED': return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-bold tracking-wider">DEVUELTO</Badge>
            default: return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 font-bold tracking-wider">{status}</Badge>
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto mb-10">
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/almacen" className="p-2 -ml-2 rounded-full hover:bg-slate-200/50 transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stock Serializado</h1>
                </div>
                <p className="text-slate-500">Listado completo de seriales y su estado actual.</p>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: SUMMARY (AVAILABLE ONLY) */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Box size={20} className="text-emerald-600" />
                                Disponibles en Almacén
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(summary).map(([name, count]) => (
                                    <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-sm font-semibold text-slate-700">{name}</span>
                                        <Badge variant="secondary" className="bg-white border-slate-200 text-slate-900 font-bold">
                                            {count} unid.
                                        </Badge>
                                    </div>
                                ))}
                                {Object.keys(summary).length === 0 && (
                                    <p className="text-slate-400 text-center py-4">No hay items disponibles.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: LIST ALL */}
                <div className="lg:col-span-2">
                    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg">Todos los Seriales</CardTitle>
                                <Badge className="bg-slate-900 text-white hover:bg-slate-800 border-none">
                                    {serials?.length || 0} Total
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
                                {serials && serials.length > 0 ? (
                                    serials.map((serial: any) => (
                                        <div key={serial.serial_number} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                                                    <QrCode size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 font-mono text-lg tracking-wide">{serial.serial_number}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-blue-600">{serial.product?.sku}</span>
                                                        <span className="text-xs text-slate-400">•</span>
                                                        <span className="text-xs text-slate-500">{serial.product?.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {getStatusBadge(serial.status)}
                                                <p className="text-[10px] text-slate-300 mt-1">
                                                    Ingreso: {new Date(serial.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-slate-400">
                                        <QrCode size={48} className="mx-auto mb-3 opacity-20" />
                                        <p>No se encontraron seriales en el sistema.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
