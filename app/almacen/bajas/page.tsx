"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ArrowLeft, Package, AlertOctagon, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ProcessBajaDialog } from "@/components/almacen/process-baja-dialog"

export default function BajasPage() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<any>(null)

    const supabase = createClient()

    const loadData = async () => {
        setLoading(true)
        const { data, error } = await supabase.rpc('get_damaged_products')
        if (error) {
            console.error(error)
        } else {
            setProducts(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const filtered = products.filter(p =>
        p.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.product_sku.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto min-h-screen pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/almacen">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl mr-2 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Bajas y Garantías</h1>
                        <p className="text-zinc-500">Gestión de productos dañados, perdidos o para descarte</p>
                    </div>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input
                    placeholder="Buscar producto..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((product) => (
                    <Card key={product.product_id}
                        className="group overflow-hidden border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer bg-red-50/10 border-l-4 border-l-red-500"
                        onClick={() => setSelectedProduct(product)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge variant="outline" className="mb-2 border-red-200 text-red-700 bg-red-50">
                                        {product.product_sku}
                                    </Badge>
                                    <CardTitle className="text-lg leading-tight">{product.product_name}</CardTitle>
                                </div>
                                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center shrink-0 text-red-600">
                                    <AlertOctagon size={20} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mt-4">
                                <div className="text-sm text-zinc-500">
                                    Total Afectado
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-sm font-medium text-red-600">
                                        {Number(product.damaged_count) + Number(product.lost_count)} Total
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                        {Number(product.damaged_count)} Dañados • {Number(product.lost_count)} Perdidos
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                                <span className="flex items-center gap-1">
                                    <Package size={12} />
                                    {product.requires_serial ? "Serializado" : "Control Numérico"}
                                </span>
                                <span className="text-red-500 font-medium flex items-center gap-1">
                                    Procesar Salida <ArrowLeft className="rotate-180" size={10} />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filtered.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-zinc-400">
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="opacity-50" />
                        </div>
                        <p>No hay productos reportados como dañados.</p>
                    </div>
                )}
            </div>

            {/* Dialog */}
            {selectedProduct && (
                <ProcessBajaDialog
                    open={!!selectedProduct}
                    onOpenChange={(open) => !open && setSelectedProduct(null)}
                    product={selectedProduct}
                    details={selectedProduct.details}
                    onSuccess={() => {
                        loadData()
                        setSelectedProduct(null)
                    }}
                />
            )}
        </div>
    )
}
