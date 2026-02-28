"use client"

import { PremiumCard } from "@/components/ui/premium-card"
import { Activity, ShieldCheck, Zap, TrendingUp, Briefcase } from "lucide-react"
import type { DashboardMetrics } from "@/lib/dashboard-data"

export function BusinessMetrics({ metrics }: { metrics: DashboardMetrics }) {
    const {
        totalSolicitudes,
        powerGoCount,
        maxVentas,
        topAsesor,
        nuevosServicios,
        diasLaborados
    } = metrics.counters

    return (
        <div className="space-y-6">
            <PremiumCard className="overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-foreground">Métricas de Negocio</h3>
                    <p className="text-sm text-muted-foreground">Rendimiento general de instalaciones y ventas.</p>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Nuevos Servicios */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Activity size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nuevos Servicios</p>
                            <h4 className="text-2xl font-black text-foreground">{nuevosServicios}</h4>
                        </div>
                    </div>

                    {/* Total Cierres */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Cierres</p>
                            <h4 className="text-2xl font-black text-foreground">{totalSolicitudes}</h4>
                        </div>
                    </div>

                    {/* Power Go */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <Zap size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Power Go</p>
                            <h4 className="text-2xl font-black text-foreground">{powerGoCount}</h4>
                        </div>
                    </div>

                    {/* Días Laborados */}
                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                            <Briefcase size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Días Trabajados</p>
                            <h4 className="text-2xl font-black text-foreground">{diasLaborados}</h4>
                        </div>
                    </div>

                    {/* Max Ventas & Top Asesor (Spans 2 cols on mobile if needed, or just 1) */}
                    <div className="sm:col-span-2 flex items-center gap-4 p-4 bg-gradient-to-r from-yellow-500/10 to-transparent rounded-2xl border border-yellow-500/20">
                        <div className="h-12 w-12 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <div className="flex-1 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Top Asesor</p>
                                <h4 className="text-lg font-bold text-foreground">{topAsesor}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Max Ventas</p>
                                <h4 className="text-3xl font-black text-yellow-500">{maxVentas}</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </PremiumCard>
        </div>
    )
}
