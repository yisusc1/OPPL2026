"use client"

import { PremiumCard } from "@/components/ui/premium-card"
import { Fuel, DollarSign, Truck, Bike } from "lucide-react"
import type { FuelAnalyticsData } from "../actions"
import { Badge } from "@/components/ui/badge"

export function FuelAnalytics({ data }: { data: FuelAnalyticsData[] }) {
    // Calculate totals
    const totalLiters = data.reduce((acc, curr) => acc + curr.totalLiters, 0)
    const totalCost = data.reduce((acc, curr) => acc + curr.totalCost, 0)

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PremiumCard className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Fuel size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Litros Consumidos</p>
                            <h3 className="text-3xl font-black text-foreground">{totalLiters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L</h3>
                        </div>
                    </div>
                </PremiumCard>
                <PremiumCard className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Costo Estimado</p>
                            <h3 className="text-3xl font-black text-foreground">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        </div>
                    </div>
                </PremiumCard>
            </div>

            {/* Data Table */}
            <PremiumCard className="overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-foreground">Consumo por Vehículo</h3>
                    <p className="text-sm text-muted-foreground">Desglose de combustible y costos operativos asociados a la flota.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Vehículo</th>
                                <th className="p-4 font-bold">Placa</th>
                                <th className="p-4 font-bold text-right">Litros Consumidos</th>
                                <th className="p-4 font-bold text-right">Costo Estimado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                        No hay registros de combustible disponibles.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr key={item.vehicleId} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
                                                    {item.model.toLowerCase().includes('moto') ? <Bike size={16} /> : <Truck size={16} />}
                                                </div>
                                                <span className="font-bold text-foreground">{item.model}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="font-mono bg-white/5 text-muted-foreground">
                                                {item.plate}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 font-bold text-foreground">
                                                <Fuel size={14} className="text-blue-500" />
                                                {item.totalLiters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-black text-emerald-500">
                                                ${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </PremiumCard>
        </div>
    )
}
