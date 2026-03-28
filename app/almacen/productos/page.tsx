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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Link href="/almacen">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl mr-2 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div className="p-3 bg-zinc-900 rounded-xl shadow-lg shadow-zinc-900/10">
                        <Package className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Inventario de Productos</h1>
                        <p className="text-zinc-500">Gestiona el catálogo y stock de productos</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsDispatchDialogOpen(true)} className="gap-2 bg-green-600 text-white hover:bg-green-700">
                        <Package size={16} />
                        Asinar Diario
                    </Button>

                    <Button onClick={handleCreateProduct} className="gap-2 bg-zinc-900 text-white hover:bg-zinc-800">
                        <Plus size={16} />
                        Nuevo Producto
                    </Button>
                </div>
            </div>

            <Card className="border-zinc-200 shadow-sm overflow-hidden rounded-[24px]">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle>Listado de Items</CardTitle>
                        <CardDescription>Total: {filteredProducts.length} productos registrados</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input
                                placeholder="Buscar por nombre o Código..."
                                className="pl-8 bg-white"
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
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-zinc-50">
                            <TableRow>
                                <TableHead className="pl-6">Producto</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead className="text-right">Stock Actual</TableHead>
                                <TableHead className="text-right">En Baja / Garantía</TableHead>
                                <TableHead className="text-right pr-6">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-zinc-500">
                                        Cargando productos...
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-32 text-zinc-500">
                                        No se encontraron productos.
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.map((product) => (
                                <TableRow key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                                    <TableCell className="pl-6">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-zinc-900">{product.name}</span>
                                            <span className="text-xs text-mono text-zinc-500">Código: {product.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal capitalize">
                                            {product.category || "General"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-zinc-600">{product.location || "-"}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className={`font-bold ${product.current_stock < product.min_stock ? "text-orange-600" : "text-zinc-900"}`}>
                                            {product.current_stock}
                                        </div>
                                        {product.current_stock < product.min_stock && (
                                            <span className="text-[10px] text-orange-600 font-medium block mt-0.5">Bajo Stock</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {(product.pending_bajas || 0) > 0 ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                                                <span className="font-bold text-sm">{product.pending_bajas}</span>
                                                <span className="text-[10px] uppercase font-medium">Afectados</span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-300">-</span>
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
            </Card>

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
        </div >
    )
}

