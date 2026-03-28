
import { Suspense } from "react"
import { AlertTriangle, LayoutGrid, Car, Users, Wrench, Zap, Droplets, DollarSign, Medal, TrendingUp, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getDashboardStats, getFleetStatus, getMonthlyMetrics } from "./actions"
import { RealtimeNotifications } from "./components/realtime-notifications"
import { FleetGrid } from "./components/fleet-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

export const dynamic = "force-dynamic"

export default async function GerenciaDashboard() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    const [stats, fleet, monthly] = await Promise.all([
        getDashboardStats(),
        getFleetStatus(),
        getMonthlyMetrics(),
    ])

    const capitalize = (s: string) => s ? s.charAt(0) + s.slice(1).toLowerCase() : s

    return (
        <PremiumPageLayout title="Tablero de Gerencia" description="Resumen operativo y control de flota">
            <RealtimeNotifications />

            <div className="max-w-7xl mx-auto space-y-8">
                <Tabs defaultValue="summary" className="w-full">
                    {/* TABS */}
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
                    </TabsList>

                    {/* === RESUMEN TAB === */}
                    <TabsContent value="summary" className="space-y-8 focus:outline-none mt-0">

                        {/* ── MONTH HEADER ── */}
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-lg font-bold text-foreground capitalize">
                                {capitalize(monthly.monthLabel)} — Métricas del Mes
                            </h2>
                        </div>

                        {/* ── FLEET STATUS PILLS ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <PremiumCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><AlertTriangle size={18} /></div>
                                    <div>
                                        <div className="text-2xl font-bold">{stats.activeFaults}</div>
                                        <div className="text-xs text-muted-foreground">Fallas activas</div>
                                    </div>
                                </div>
                            </PremiumCard>
                            <PremiumCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><Wrench size={18} /></div>
                                    <div>
                                        <div className="text-2xl font-bold">{stats.vehiclesInMaintenance}</div>
                                        <div className="text-xs text-muted-foreground">Veh. en taller</div>
                                    </div>
                                </div>
                            </PremiumCard>
                            <PremiumCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><Car size={18} /></div>
                                    <div>
                                        <div className="text-2xl font-bold">{fleet.filter(v => v.status === 'IN_ROUTE').length}</div>
                                        <div className="text-xs text-muted-foreground">En ruta ahora</div>
                                    </div>
                                </div>
                            </PremiumCard>
                            <PremiumCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><Car size={18} /></div>
                                    <div>
                                        <div className="text-2xl font-bold">{fleet.filter(v => v.status === 'AVAILABLE').length}</div>
                                        <div className="text-xs text-muted-foreground">Disponibles</div>
                                    </div>
                                </div>
                            </PremiumCard>
                        </div>

                        {/* ── INSTALACIONES + POWER GO + FUEL ── */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><TrendingUp size={18} /></div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instalaciones</span>
                                </div>
                                <div className="text-4xl font-bold text-foreground">{monthly.totalInstallations}</div>
                                <div className="text-xs text-muted-foreground mt-1">Total en {capitalize(monthly.monthLabel)}</div>
                            </PremiumCard>

                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><Zap size={18} /></div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">TV</span>
                                </div>
                                <div className="text-4xl font-bold text-foreground">{monthly.powerGoCount}</div>
                                <div className="text-xs text-muted-foreground mt-1">Vendidas este mes</div>
                            </PremiumCard>

                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-foreground/5 rounded-xl text-muted-foreground"><Droplets size={18} /></div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Combustible</span>
                                </div>
                                <div className="text-3xl font-bold text-foreground">{monthly.fuelTotalLiters.toFixed(1)} L</div>
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <DollarSign size={12} />
                                    Estimado: ${monthly.fuelEstimatedCost.toFixed(2)}
                                </div>
                            </PremiumCard>
                        </div>

                        {/* ── TOP RANKINGS ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* TOP 4 TECNICOS */}
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Medal size={16} className="text-muted-foreground" />
                                    <h3 className="font-bold text-sm text-foreground">Top 4 Técnicos</h3>
                                    <span className="ml-auto text-xs text-muted-foreground">{capitalize(monthly.monthLabel)}</span>
                                </div>
                                {monthly.topTechnicians.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin datos este mes</p>
                                ) : (
                                    <div className="space-y-3">
                                        {monthly.topTechnicians.map((t, i) => (
                                            <div key={t.name} className="flex items-center gap-3">
                                                <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 bg-foreground/5 text-muted-foreground">{i + 1}</span>
                                                <span className="flex-1 text-sm font-medium text-foreground truncate capitalize">{t.name.toLowerCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 rounded-full bg-foreground/10 w-20 overflow-hidden">
                                                        <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round((t.count / (monthly.topTechnicians[0]?.count || 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground w-6 text-right">{t.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </PremiumCard>

                            {/* TOP 3 ASESORES */}
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Users size={16} className="text-muted-foreground" />
                                    <h3 className="font-bold text-sm text-foreground">Top 3 Asesores</h3>
                                    <span className="ml-auto text-xs text-muted-foreground">{capitalize(monthly.monthLabel)}</span>
                                </div>
                                {monthly.topAdvisors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin datos este mes</p>
                                ) : (
                                    <div className="space-y-3">
                                        {monthly.topAdvisors.map((a, i) => (
                                            <div key={a.name} className="flex items-center gap-3">
                                                <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 bg-foreground/5 text-muted-foreground">{i + 1}</span>
                                                <span className="flex-1 text-sm font-medium text-foreground truncate capitalize">{a.name.toLowerCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 rounded-full bg-foreground/10 w-20 overflow-hidden">
                                                        <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round((a.count / (monthly.topAdvisors[0]?.count || 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground w-6 text-right">{a.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </PremiumCard>

                            {/* TOP 5 ZONAS */}
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin size={16} className="text-muted-foreground" />
                                    <h3 className="font-bold text-sm text-foreground">Top 5 Zonas</h3>
                                    <span className="ml-auto text-xs text-muted-foreground">{capitalize(monthly.monthLabel)}</span>
                                </div>
                                {monthly.topZones.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin datos este mes</p>
                                ) : (
                                    <div className="space-y-3">
                                        {monthly.topZones.map((z, i) => (
                                            <div key={z.name} className="flex items-center gap-3">
                                                <span className="w-5 text-xs font-bold text-muted-foreground text-right shrink-0">{i + 1}</span>
                                                <span className="flex-1 text-sm font-medium text-foreground truncate capitalize">{z.name.toLowerCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 rounded-full bg-foreground/10 w-20 overflow-hidden">
                                                        <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round((z.count / (monthly.topZones[0]?.count || 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground w-6 text-right">{z.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </PremiumCard>

                            {/* TOP 5 SECTORES CON MÁS INSTALACIONES */}
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin size={16} className="text-muted-foreground" />
                                    <h3 className="font-bold text-sm text-foreground">Top 5 Sectores</h3>
                                    <span className="ml-auto text-xs text-muted-foreground">{capitalize(monthly.monthLabel)}</span>
                                </div>
                                {monthly.allSectors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin datos este mes</p>
                                ) : (
                                    <div className="space-y-3">
                                        {monthly.allSectors.slice(0, 5).map((s, i) => (
                                            <div key={s.name} className="flex items-center gap-3">
                                                <span className="w-5 text-xs font-bold text-muted-foreground text-right shrink-0">{i + 1}</span>
                                                <span className="flex-1 text-sm font-medium text-foreground truncate capitalize">{s.name.toLowerCase()}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 rounded-full bg-foreground/10 w-20 overflow-hidden">
                                                        <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round((s.count / (monthly.allSectors[0]?.count || 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground w-6 text-right">{s.count}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </PremiumCard>
                        </div>

                        {/* ── DISTRITO CAPITAL SECTOR BREAKDOWN ── */}
                        {monthly.distritoCapitalSectors.length > 0 && (
                            <PremiumCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin size={16} className="text-rose-500" />
                                    <h3 className="font-bold text-sm text-foreground">Sectores — Distrito Capital</h3>
                                    <span className="ml-auto text-xs text-muted-foreground">{capitalize(monthly.monthLabel)}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {monthly.distritoCapitalSectors.map(s => (
                                        <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                            <span className="text-xs text-foreground capitalize truncate">{s.name.toLowerCase()}</span>
                                            <span className="text-xs font-bold text-rose-400 ml-2 shrink-0">{s.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </PremiumCard>
                        )}

                    </TabsContent>

                    {/* === FLOTA TAB === */}
                    <TabsContent value="fleet" className="focus:outline-none mt-0">
                        <div className="mb-8">
                            <PremiumContent>
                                <FleetGrid vehicles={fleet} />
                            </PremiumContent>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PremiumPageLayout>
    )
}
