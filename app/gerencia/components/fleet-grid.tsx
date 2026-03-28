"use client"

import { Car, Truck, AlertTriangle, MapPin, User, CheckCircle2, Bike, Fuel, Gauge, Activity } from "lucide-react"
import type { FleetStatus } from "../actions"
import { useState } from "react"
import { VehicleDetailsDialog } from "@/components/vehicle-details-dialog"

export function FleetGrid({ vehicles }: { vehicles: FleetStatus[] }) {
    const [selectedVehicle, setSelectedVehicle] = useState<FleetStatus | null>(null)

    const getStatusConfig = (status: FleetStatus['status']) => {
        switch (status) {
            case 'IN_ROUTE': return { label: "En Ruta", dot: "bg-green-500", text: "text-green-400", badge: "bg-green-500/20 border-green-500/30 text-green-400", pulse: true }
            case 'CRITICAL': return { label: "Falla Activa", dot: "bg-red-500", text: "text-red-400", badge: "bg-red-500/20 border-red-500/30 text-red-400", pulse: true }
            case 'MAINTENANCE': return { label: "En Taller", dot: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-500/20 border-amber-500/30 text-amber-400", pulse: false }
            default: return { label: "En Galpón", dot: "bg-zinc-500", text: "text-zinc-400", badge: "bg-zinc-500/20 border-zinc-500/30 text-zinc-400", pulse: false }
        }
    }

    const getFuelColor = (level: number) => {
        if (level < 25) return 'text-red-400 bg-red-500/10 border-red-500/20'
        if (level < 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vehicles.map((vehicle) => {
                    const status = getStatusConfig(vehicle.status)
                    const hasFaults = vehicle.faultsSummary && (vehicle.faultsSummary.critical > 0 || vehicle.faultsSummary.high > 0)

                    return (
                        <div
                            key={vehicle.id}
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer h-64 bg-zinc-900"
                            style={{
                                boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)"
                            }}
                        >
                            {/* Background image */}
                            {vehicle.imageUrl ? (
                                <img
                                    src={vehicle.imageUrl}
                                    alt={vehicle.model}
                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                    <Truck size={64} className="text-zinc-700" />
                                </div>
                            )}

                            {/* Dark gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/5" />

                            {/* Status badge — top right */}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/50 border border-white/10">
                                <span className="relative flex h-2 w-2">
                                    {status.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.dot} opacity-75`} />}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dot}`} />
                                </span>
                                <span className="text-xs font-semibold text-white">{status.label}</span>
                            </div>

                            {/* Fault badge — top left */}
                            {hasFaults && (
                                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
                                    <AlertTriangle size={10} className="text-red-400" />
                                    <span className="text-[10px] font-bold text-red-400">
                                        {vehicle.faultsSummary.critical > 0 ? `${vehicle.faultsSummary.critical} Crít.` : `${vehicle.faultsSummary.high} Alta`}
                                    </span>
                                </div>
                            )}

                            {/* Bottom info */}
                            <div className="absolute bottom-0 inset-x-0 p-4">
                                {/* Vehicle icon */}
                                <div className="mb-2 transition-all duration-300 group-hover:-translate-y-1">
                                    {vehicle.tipo === 'Moto'
                                        ? <Bike size={20} className="text-white/60" />
                                        : <Car size={20} className="text-white/60" />
                                    }
                                </div>

                                {/* Model + plate */}
                                <h3 className="font-bold text-lg text-white leading-tight">{vehicle.model}</h3>
                                <p className="text-zinc-400 text-xs font-mono mb-3">{vehicle.plate} · {vehicle.code}</p>

                                {/* Fuel + km + driver row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${getFuelColor(vehicle.current_fuel_level)}`}>
                                        <Fuel size={10} />
                                        {vehicle.current_fuel_level}%
                                    </div>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                                        <Gauge size={10} />
                                        {vehicle.kilometraje?.toLocaleString()} km
                                    </div>
                                    {vehicle.driver && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-zinc-400 bg-white/5 border border-white/10 truncate max-w-[120px]">
                                            <User size={10} />
                                            <span className="truncate">{vehicle.driver.split(' ')[0]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.03] pointer-events-none" />
                        </div>
                    )
                })}
            </div>

            {selectedVehicle && (
                <VehicleDetailsDialog
                    isOpen={!!selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    vehicle={{
                        ...selectedVehicle,
                        codigo: selectedVehicle.code,
                        modelo: selectedVehicle.model,
                        placa: selectedVehicle.plate,
                        foto_url: selectedVehicle.imageUrl,
                    } as any}
                    readonly={true}
                />
            )}
        </>
    )
}
