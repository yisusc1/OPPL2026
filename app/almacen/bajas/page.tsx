"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
        <PremiumPageLayout 
            title="Bajas y Garantías" 
            description="Gestión de productos dañados, perdidos o para descarte"
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="space-y-6 pb-20">
                <div className="flex justify-end gap-2 mb-6">
                    <Button variant="outline" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto..."
                    className="pl-9 bg-background"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((product) => (
                    <PremiumCard key={product.product_id}
                        wrapperClassName="cursor-pointer group"
                        className="border-destructive/20 shadow-sm transition-all overflow-hidden bg-destructive/5 hover:bg-destructive/10 !border-l-4 !border-l-destructive"
                        onClick={() => setSelectedProduct(product)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge variant="outline" className="mb-2 border-destructive/20 text-destructive bg-destructive/10">
                                        {product.product_sku}
                                    </Badge>
                                    <CardTitle className="text-lg leading-tight text-foreground">{product.product_name}</CardTitle>
                                </div>
                                <div className="h-10 w-10 bg-destructive/10 rounded-full flex items-center justify-center shrink-0 text-destructive">
                                    <AlertOctagon size={20} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mt-4">
                                <div className="text-sm text-muted-foreground">
                                    Total Afectado
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-sm font-medium text-destructive">
                                        {Number(product.damaged_count) + Number(product.lost_count)} Total
                                    </div>
                                    <div className="text-xs text-muted-foreground/70">
                                        {Number(product.damaged_count)} Dañados • {Number(product.lost_count)} Perdidos
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Package size={12} />
                                    {product.requires_serial ? "Serializado" : "Control Numérico"}
                                </span>
                                <span className="text-destructive font-medium flex items-center gap-1">
                                    Procesar Salida <ArrowLeft className="rotate-180" size={10} />
                                </span>
                            </div>
                        </CardContent>
                    </PremiumCard>
                ))}

                {filtered.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
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
        </PremiumPageLayout>
    )
}
