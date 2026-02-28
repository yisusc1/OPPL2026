
import { Suspense } from "react"
import { AlertCircle, Activity, TrendingUp, Users, Wrench, AlertTriangle, LayoutGrid, BarChart3, Car, MapPin, Truck, Bike } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getDashboardStats, getFleetStatus, getAdvancedStats, getFuelAnalytics } from "./actions"
import { RealtimeNotifications } from "./components/realtime-notifications"
import { FleetGrid } from "./components/fleet-grid"
import { FuelAnalytics } from "./components/fuel-analytics"
import { BusinessMetrics } from "./components/business-metrics"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchInstallations } from "@/lib/dashboard-data"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

export const dynamic = "force-dynamic"

export default async function GerenciaDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    // TODO: Add Role Check (Admin/Manager only)

    // Parallel Data Fetching
    const [stats, fleet, advanced, fuelData, dashboardData] = await Promise.all([
        getDashboardStats(),
        getFleetStatus(),
        getAdvancedStats(),
        getFuelAnalytics(),
        fetchInstallations()
    ])

    return (
        <PremiumPageLayout title="Tablero de Gerencia" description="Resumen operativo y control de flota">
            <RealtimeNotifications />

            <div className="max-w-7xl mx-auto space-y-8">
                <Tabs defaultValue="summary" className="w-full">
                    {/* SCROLLABLE TABS LIST FOR MOBILE */}
                    <TabsList className="bg-zinc-100/80 dark:bg-zinc-800/80 backdrop-blur-md p-1.5 rounded-full border-0 mb-8 flex h-14 items-center gap-1 w-full overflow-x-auto no-scrollbar justify-start md:justify-center">
                        <TabsTrigger value="summary" className="rounded-full px-6 h-11 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-500 font-medium transition-all hover:text-zinc-700 flex-shrink-0">
                            <LayoutGrid size={18} className="mr-2" /> Resumen
                        </TabsTrigger>
                        <TabsTrigger value="fleet" className="rounded-full px-6 h-11 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-500 font-medium transition-all hover:text-zinc-700 flex-shrink-0">
                            <Car size={18} className="mr-2" /> Flota en Vivo
                            {fleet.some(v => v.status === 'IN_ROUTE') && (
                                <span className="ml-2 flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-full px-6 h-11 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-500 font-medium transition-all hover:text-zinc-700 flex-shrink-0">
                            <BarChart3 size={18} className="mr-2" /> Analítica
                        </TabsTrigger>
                    </TabsList>

                    {/* === RESUMEN TAB === */}
                    <TabsContent value="summary" className="space-y-8 focus:outline-none mt-0">
                        {/* KPI CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <PremiumCard className="p-6 transition-all duration-500 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl text-foreground group-hover:bg-green-500/20 group-hover:text-green-500 transition-colors"><Activity /></div>
                                    <span className="text-xs font-bold bg-green-500/20 text-green-500 px-2.5 py-1 rounded-full border border-green-500/20">Hoy</span>
                                </div>
                                <div className="text-4xl font-bold text-foreground tracking-tight">{stats.installationsToday}</div>
                                <div className="text-sm text-muted-foreground font-medium mt-2">Instalaciones Realizadas</div>
                            </PremiumCard>

                            <PremiumCard className="p-6 transition-all duration-500 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl text-foreground group-hover:bg-blue-500/20 group-hover:text-blue-500 transition-colors"><Wrench /></div>
                                    <span className="text-xs font-bold bg-blue-500/20 text-blue-500 px-2.5 py-1 rounded-full border border-blue-500/20">Hoy</span>
                                </div>
                                <div className="text-4xl font-bold text-foreground tracking-tight">{stats.supportsToday}</div>
                                <div className="text-sm text-muted-foreground font-medium mt-2">Soportes Realizados</div>
                            </PremiumCard>

                            <PremiumCard className="p-6 transition-all duration-500 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl text-foreground group-hover:bg-red-500/20 group-hover:text-red-500 transition-colors"><AlertTriangle /></div>
                                    {stats.activeFaults > 0 && <span className="text-xs font-bold bg-red-500/20 text-red-500 px-2.5 py-1 rounded-full border border-red-500/20 animate-pulse">Atención</span>}
                                </div>
                                <div className="text-4xl font-bold text-foreground tracking-tight">{stats.activeFaults}</div>
                                <div className="text-sm text-muted-foreground font-medium mt-2">Fallas de Vehículos Activas</div>
                            </PremiumCard>

                            <PremiumCard className="p-6 transition-all duration-500 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl text-foreground group-hover:bg-amber-500/20 group-hover:text-amber-500 transition-colors"><TrendingUp /></div>
                                </div>
                                <div className="text-4xl font-bold text-foreground tracking-tight">{stats.vehiclesInMaintenance}</div>
                                <div className="text-sm text-muted-foreground font-medium mt-2">Vehículos en Taller</div>
                            </PremiumCard>
                        </div>

                        {/* === MINIMALIST FLEET SUMMARY === */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* ACTIVE / EN RUTA */}
                            <PremiumCard className="p-8 relative overflow-hidden group transition-all duration-500">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <MapPin size={120} className="text-green-500" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-4 bg-green-500/10 rounded-2xl text-green-500 shadow-sm"><Truck size={24} /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground">En Ruta</h3>
                                            <p className="text-muted-foreground font-medium text-sm">Vehículos activos actualmente</p>
                                        </div>
                                    </div>
                                    <div className="text-5xl font-bold text-foreground mb-8 tracking-tighter">
                                        {fleet.filter(v => v.status === 'IN_ROUTE').length}
                                    </div>

                                    <div className="space-y-3">
                                        {fleet.filter(v => v.status === 'IN_ROUTE').length > 0 ? (
                                            fleet.filter(v => v.status === 'IN_ROUTE').map(v => (
                                                <div key={v.id} className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 shadow-sm hover:scale-[1.02] transition-transform">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shadow-inner">
                                                            {v.tipo === 'Moto' ? <Bike size={18} /> : <Car size={18} />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground text-sm leading-tight">{v.model}</span>
                                                            <span className="text-xs text-muted-foreground font-mono mt-0.5">{v.plate}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-xl border border-green-500/20">
                                                        {v.driver?.split(' ')[0]}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground italic text-sm">Ningún vehículo en ruta.</p>
                                        )}
                                    </div>
                                </div>
                            </PremiumCard>

                            {/* GARAGE / EN GALPON */}
                            <PremiumCard className="p-8 relative overflow-hidden group transition-all duration-500">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Car size={120} className="text-zinc-500" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-4 bg-zinc-500/10 rounded-2xl text-zinc-500 shadow-sm"><Car size={24} /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground">En Galpón</h3>
                                            <p className="text-muted-foreground font-medium text-sm">Vehículos disponibles o en taller</p>
                                        </div>
                                    </div>
                                    <div className="text-5xl font-bold text-foreground mb-8 tracking-tighter">
                                        {fleet.filter(v => v.status !== 'IN_ROUTE').length}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-zinc-500/5 rounded-[24px] border border-zinc-500/10 text-center flex flex-col justify-center hover:bg-zinc-500/10 transition-colors">
                                            <span className="block text-3xl font-bold text-foreground">{fleet.filter(v => v.status === 'AVAILABLE').length}</span>
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mt-1">Disponibles</span>
                                        </div>
                                        <div className="p-4 bg-amber-500/5 rounded-[24px] border border-amber-500/10 text-center flex flex-col justify-center hover:bg-amber-500/10 transition-colors">
                                            <span className="block text-3xl font-bold text-amber-500">{fleet.filter(v => v.status === 'MAINTENANCE').length}</span>
                                            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider mt-1">Taller</span>
                                        </div>
                                    </div>

                                    {/* Maintenance List */}
                                    {fleet.filter(v => v.status === 'MAINTENANCE').length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-xs font-bold text-amber-500 uppercase mb-1">Vehículos en Revisión</p>
                                            {fleet.filter(v => v.status === 'MAINTENANCE').map(v => (
                                                <div key={v.id} className="flex items-center justify-between p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-amber-500">{v.tipo === 'Moto' ? <Bike size={14} /> : <Car size={14} />}</span>
                                                        <span className="font-bold text-foreground text-xs">{v.model}</span>
                                                    </div>
                                                    <span className="text-[10px] font-mono font-bold text-amber-500 bg-white/5 px-1.5 py-0.5 rounded-md border border-amber-500/10">
                                                        {v.plate}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </PremiumCard>
                        </div>
                    </TabsContent>

                    {/* === FLOTA TAB === */}
                    <TabsContent value="fleet" className="focus:outline-none mt-0">
                        {/* Banner Removed */}
                        <div className="mb-8">
                            <PremiumContent>
                                <FleetGrid vehicles={fleet} />
                            </PremiumContent>
                        </div>
                    </TabsContent>

                    {/* === ANALITICA TAB === */}
                    <TabsContent value="analytics" className="focus:outline-none mt-0">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Left Column: Business Metrics */}
                            <div>
                                <BusinessMetrics metrics={dashboardData} />
                            </div>

                            {/* Right Column: Fuel Analytics */}
                            <div>
                                <FuelAnalytics data={fuelData} />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PremiumPageLayout>
    )
}
