import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, ArrowRight, History, Plus, AlertTriangle, ArrowUpRight, ArrowDownRight, ArrowLeft, Search, Box, QrCode, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { DashboardActions } from "@/components/almacen/dashboard-actions"
import { RecentTransactions } from "@/components/almacen/recent-transactions"
import { DesktopModeToggle } from "@/components/desktop-mode-toggle"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

interface Product {
    id: string
    name: string
    sku: string
    current_stock: number
    min_stock: number
}

interface Transaction {
    id: string
    type: 'IN' | 'OUT' | 'ADJUST'
    quantity: number
    reason: string
    created_at: string
    inventory_products: {
        name: string
    } | null
}

export default async function WarehouseDashboard() {
    const supabase = await createClient()

    // Fetch stats
    const { count: productsCount } = await supabase
        .from("inventory_products")
        .select("*", { count: "exact", head: true })

    // Low stock items - Fetching all to filter by dynamic min_stock
    const { data: allProducts } = await supabase
        .from("inventory_products")
        .select("id, name, sku, current_stock, min_stock")

    const lowStockItems = (allProducts as Product[] | null)?.filter(
        item => item.current_stock <= item.min_stock
    ).slice(0, 5) || []

    // Recent transactions
    const { data: recentTransactions } = await supabase
        .from("inventory_transactions")
        .select("*, inventory_products(name)")
        .order("created_at", { ascending: false })
        .limit(5)

    const typedTransactions = (recentTransactions || []) as unknown as Transaction[]

    // Combos Asignados stats (Assignments)
    // Filter out 'ASG-' (Supervisor Spools)
    const { count: assignmentsCount } = await supabase
        .from("inventory_assignments")
        .select("*", { count: "exact", head: true })
        .not("code", "ilike", "ASG-%")

    const totalBundles = assignmentsCount || 0

    // Movimientos Hoy stats
    const today = new Date().toISOString().split('T')[0]
    const { count: dailyMovementsCount } = await supabase
        .from("inventory_transactions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today)

    return (
        <PremiumPageLayout title="Almacén Central" description="Gestión integral de inventario, stock y movimientos logísticos.">

            <div className="max-w-7xl mx-auto space-y-8">
                {/* SUB NAVIGATION */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <Link href="/almacen/productos">
                        <Button variant="ghost" className="rounded-xl h-10 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground">
                            <Box size={16} className="mr-2" />
                            Productos
                        </Button>
                    </Link>
                    <Link href="/almacen/historial">
                        <Button variant="ghost" className="rounded-xl h-10 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground">
                            <History size={16} className="mr-2" />
                            Historial
                        </Button>
                    </Link>
                    <Link href="/almacen/rastreo">
                        <Button variant="ghost" className="rounded-xl h-10 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-blue-500">
                            <Search size={16} className="mr-2" />
                            Rastreo
                        </Button>
                    </Link>
                    <Link href="/almacen/seriales">
                        <Button variant="ghost" className="rounded-xl h-10 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-purple-500">
                            <QrCode size={16} className="mr-2" />
                            Seriales
                        </Button>
                    </Link>
                    <div className="ml-auto">
                        <DashboardActions />
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link href="/almacen/productos" className="block h-full group">
                        <PremiumCard className="h-full relative overflow-hidden group-hover:-translate-y-1 transition-all duration-300">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                <Package size={100} />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Productos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-foreground">{productsCount || 0}</div>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">Items registrados</p>
                            </CardContent>
                        </PremiumCard>
                    </Link>

                    <Link href="/almacen/historial-asignaciones" className="block h-full group">
                        <PremiumCard className="h-full relative overflow-hidden group-hover:-translate-y-1 transition-all duration-300 hover:border-blue-500/50">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                <Package size={100} className="text-blue-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-500">Asignaciones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-blue-600">{totalBundles}</div>
                                <p className="text-xs text-blue-400 mt-2 font-medium">Combos entregados</p>
                            </CardContent>
                        </PremiumCard>
                    </Link>

                    <Link href="/almacen/productos?view=low_stock" className="block h-full group">
                        <PremiumCard className="h-full relative overflow-hidden group-hover:-translate-y-1 transition-all duration-300 hover:border-amber-500/50">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                <AlertTriangle size={100} className="text-amber-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-500">Stock Crítico</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-amber-600">{(allProducts as Product[] | null)?.filter(p => p.current_stock <= p.min_stock).length || 0}</div>
                                <p className="text-xs text-amber-500 mt-2 font-medium">Requieren atención</p>
                            </CardContent>
                        </PremiumCard>
                    </Link>

                    <Link href="/almacen/historial?date=today" className="block h-full group">
                        <PremiumCard className="h-full relative overflow-hidden group-hover:-translate-y-1 transition-all duration-300">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                <History size={100} />
                            </div>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Movimientos Hoy</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-foreground">{dailyMovementsCount || 0}</div>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">Transacciones</p>
                            </CardContent>
                        </PremiumCard>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Low Stock List */}
                    <PremiumCard className="overflow-hidden p-0">
                        <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                                <AlertTriangle size={20} className="text-amber-500" />
                                Alertas de Reposición
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-white/5">
                                {lowStockItems.length > 0 ? (
                                    lowStockItems.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground">{item.name}</span>
                                                <span className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-amber-500 text-lg">{item.current_stock}</span>
                                                <span className="text-[10px] uppercase text-muted-foreground font-bold block">Unidades</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                                        <CheckCircle2 size={48} className="text-muted-foreground/20 mb-2" />
                                        <p>Inventario Saludable</p>
                                    </div>
                                )}
                            </div>
                            {lowStockItems.length > 0 && (
                                <div className="p-3 bg-white/5 border-t border-white/5 text-center">
                                    <Link href="/almacen/productos?view=low_stock" className="text-xs font-bold text-blue-500 hover:underline">
                                        Ver todos
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </PremiumCard>

                    {/* Recent Transactions */}
                    <PremiumCard className="overflow-hidden p-0">
                        <CardHeader className="border-b border-white/5 bg-white/5 pb-4">
                            <CardTitle className="text-lg text-foreground">Últimos Movimientos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Keep RecentTransactions but wrap it if needed or it handles its own styles? 
                                 It seems RecentTransactions likely uses Table component. 
                                 We might need to verify if it looks good dark mode. 
                                 Assuming standard shadcn Table, it should adapt to theme.
                             */}
                            <RecentTransactions transactions={typedTransactions} />
                        </CardContent>
                    </PremiumCard>
                </div>
            </div>
        </PremiumPageLayout>
    )
}
