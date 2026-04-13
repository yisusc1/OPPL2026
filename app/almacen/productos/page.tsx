"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Search, Plus, Filter, MoreHorizontal, Edit, Trash2, ArrowUpDown, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StockDialog } from "@/components/almacen/stock-dialog"
import { ProductDialog } from "@/components/almacen/product-dialog"
import { ComboDialog } from "@/components/almacen/combo-dialog"
import { DispatchDialog } from "@/components/almacen/dispatch-dialog"
import { BundleAssemblyDialog } from "@/components/almacen/bundle-assembly-dialog"
import { toast } from "sonner"

import { useSearchParams } from "next/navigation"

export type Product = {
    id: string
    sku: string
    name: string
    description?: string
    category?: string
    current_stock: number
    min_stock: number
    location?: string
    is_bundle?: boolean
    requires_serial?: boolean
    created_at: string
    pending_bajas?: number // Added for display
}

export default function ProductsPage() {
    const searchParams = useSearchParams()
    const viewParam = searchParams.get("view")

    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [showLowStockOnly, setShowLowStockOnly] = useState(viewParam === "low_stock")

    // Update filter if param changes
    useEffect(() => {
        if (viewParam === "low_stock") {
            setShowLowStockOnly(true)
        }
    }, [viewParam])

    // Dialog states
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
    const [isComboDialogOpen, setIsComboDialogOpen] = useState(false)
    const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false)
    const [isStockDialogOpen, setIsStockDialogOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined)
    const [selectedForAssembly, setSelectedForAssembly] = useState<Product | undefined>(undefined)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [assemblyOpen, setAssemblyOpen] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        loadProducts()
    }, [])

    const loadProducts = async () => {
        try {
            const [productsResult, damagedResult] = await Promise.all([
                supabase.from("inventory_products").select("*").order("created_at", { ascending: false }),
                supabase.rpc('get_damaged_products')
            ])

            if (productsResult.error) throw productsResult.error

            const damagedMap = new Map()
            if (damagedResult.data) {
                damagedResult.data.forEach((d: any) => {
                    damagedMap.set(d.product_id, (Number(d.damaged_count) || 0) + (Number(d.lost_count) || 0))
                })
            }

            const merged = (productsResult.data || []).map(p => ({
                ...p,
                pending_bajas: damagedMap.get(p.id) || 0
            }))

            setProducts(merged)
        } catch (error) {
            console.error("Error loading products:", error)
            toast.error("Error al cargar productos")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar este producto?")) return

        try {
            const { error } = await supabase
                .from("inventory_products")
                .delete()
                .eq("id", id)

            if (error) throw error

            setProducts(prev => prev.filter(p => p.id !== id))
            toast.success("Producto eliminado")
        } catch (error) {
            console.error("Error deleting product:", error)
            toast.error("Error al eliminar producto")
        }
    }

    const handleEdit = (product: Product) => {
        setSelectedProduct(product)
        if (product.is_bundle) {
            setIsComboDialogOpen(true)
        } else {
            setIsProductDialogOpen(true)
        }
    }

    const handleCreateProduct = () => {
        setSelectedProduct(undefined)
        setIsProductDialogOpen(true)
    }

    const handleCreateCombo = () => {
        setSelectedProduct(undefined)
        setIsComboDialogOpen(true)
    }

    const handleStockMovement = (product: Product) => {
        setSelectedProduct(product)
        setIsStockDialogOpen(true)
    }

    const handleSave = () => {
        loadProducts() // Refresh list
        setIsProductDialogOpen(false)
        setIsComboDialogOpen(false)
        setIsDispatchDialogOpen(false)
        setIsStockDialogOpen(false)
    }

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchTerm.toLowerCase())

        if (showLowStockOnly) {
            return matchesSearch && product.current_stock <= product.min_stock
        }
        return matchesSearch
    })

    return (
        <PremiumPageLayout 
            title="Inventario de Productos" 
            description="Gestiona el catálogo y stock de productos"
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="space-y-6">
                <div className="flex justify-end gap-2 mb-6">
                    <Button onClick={() => setIsDispatchDialogOpen(true)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                        <Package size={16} />
                        Asignar Diario
                    </Button>

                    <Button onClick={handleCreateProduct} variant="default" className="gap-2">
                        <Plus size={16} />
                        Nuevo Producto
                    </Button>
                </div>

            <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                <CardHeader className="bg-muted/50 border-b border-border flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 py-4 px-6">
                    <div className="space-y-1">
                        <CardTitle className="text-foreground">Listado de Items</CardTitle>
                        <CardDescription>Total: {filteredProducts.length} productos registrados</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por código..."
                                className="pl-9 bg-background"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button
                            variant={showLowStockOnly ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                            className={showLowStockOnly ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" : ""}
                        >
                            <Filter size={16} className="mr-2" />
                            Stock Bajo
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="pl-6 text-muted-foreground">Producto</TableHead>
                                <TableHead className="text-muted-foreground">Categoría</TableHead>
                                <TableHead className="text-muted-foreground">Ubicación</TableHead>
                                <TableHead className="text-right text-muted-foreground">Stock Actual</TableHead>
                                <TableHead className="text-right text-muted-foreground">En Baja / Garantía</TableHead>
                                <TableHead className="text-right pr-6 text-muted-foreground">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                                        Cargando productos...
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                                        No se encontraron productos.
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.map((product) => (
                                <TableRow key={product.id} className="border-border hover:bg-muted/50 transition-colors">
                                    <TableCell className="pl-6">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-foreground">{product.name}</span>
                                            <span className="text-xs text-mono text-muted-foreground">Cód: {product.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal capitalize bg-muted text-foreground">
                                            {product.category || "General"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">{product.location || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={`font-bold ${product.current_stock < product.min_stock ? "text-orange-500" : "text-foreground"}`}>
                                            {product.current_stock}
                                        </div>
                                        {product.current_stock < product.min_stock && (
                                            <span className="text-[10px] text-orange-500 font-medium block mt-0.5">Bajo Stock</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {(product.pending_bajas || 0) > 0 ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                                <span className="font-bold text-sm">{product.pending_bajas}</span>
                                                <span className="text-[10px] uppercase font-medium">Afectados</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/30">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleStockMovement(product)}>
                                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                                    Movimiento Stock
                                                </DropdownMenuItem>
                                                {product.is_bundle && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedForAssembly(product)
                                                            setAssemblyOpen(true)
                                                        }}
                                                    >
                                                        <Package size={14} className="mr-2" />
                                                        Armar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-red-600 focus:text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </PremiumCard>

            <ProductDialog
                open={isProductDialogOpen}
                onOpenChange={setIsProductDialogOpen}
                product={selectedProduct}
                onSave={handleSave}
            />

            <ComboDialog
                open={isComboDialogOpen}
                onOpenChange={setIsComboDialogOpen}
                product={selectedProduct}
                onSave={handleSave}
            />

            <DispatchDialog
                open={isDispatchDialogOpen}
                onOpenChange={setIsDispatchDialogOpen}
                onSave={handleSave}
            />

            {
                selectedProduct && (
                    <StockDialog
                        open={isStockDialogOpen}
                        onOpenChange={setIsStockDialogOpen}
                        product={selectedProduct}
                        onSave={handleSave}
                    />
                )
            }

            {
                selectedForAssembly && (
                    <BundleAssemblyDialog
                        open={assemblyOpen}
                        onOpenChange={setAssemblyOpen}
                        product={selectedForAssembly}
                        onSave={() => {
                            setAssemblyOpen(false)
                            loadProducts()
                        }}
                    />
                )
            }
            </div>
        </PremiumPageLayout>
    )
}

