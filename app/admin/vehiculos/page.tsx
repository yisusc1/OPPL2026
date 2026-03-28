"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Plus, Car, Calendar, Gauge, AlertCircle, Search, Edit, Trash2, Fuel, Wrench, Bike, Truck, MapPin, CheckCircle2, User, Activity, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { VehicleFormDialog } from "@/components/vehicle-form-dialog"
import { VehicleDetailsDialog } from "@/components/vehicle-details-dialog"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"
import { getAdminFleetVehicles, type AdminVehicle } from "./actions"
import { Card, CardContent } from "@/components/ui/card"

export default function AdminVehiculosPage() {
    const [vehicles, setVehicles] = useState<AdminVehicle[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Dialogs
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [editingVehicle, setEditingVehicle] = useState<AdminVehicle | null>(null)
    const [selectedVehicle, setSelectedVehicle] = useState<AdminVehicle | null>(null)

    const router = useRouter()

    useEffect(() => {
        loadVehicles()
    }, [])

    async function loadVehicles() {
        setLoading(true)
        try {
            const data = await getAdminFleetVehicles()
            setVehicles(data)
        } catch (error) {
            toast.error('Error al cargar la flota')
        } finally {
            setLoading(false)
        }
    }

    const filteredVehicles = vehicles.filter(v =>
        v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreate = () => {
        setEditingVehicle(null)
        setIsFormOpen(true)
    }

    const handleEdit = (e: React.MouseEvent, vehicle: AdminVehicle) => {
        e.stopPropagation() // Prevent card click
        setEditingVehicle(vehicle)
        setIsFormOpen(true)
    }

    const handleCardClick = (vehicle: AdminVehicle) => {
        setSelectedVehicle(vehicle)
        setIsDetailsOpen(true)
    }

    const handleSuccess = () => {
        setIsFormOpen(false)
        loadVehicles()
        toast.success(editingVehicle ? 'Vehículo actualizado' : 'Vehículo registrado')
    }

    const getStatusLabel = (status: AdminVehicle['computedStatus']) => {
        switch (status) {
            case 'IN_ROUTE': return "En Ruta"
            case 'CRITICAL': return "Falla Activa"
            case 'MAINTENANCE': return "En Taller"
            default: return "En Galpón"
        }
    }

    const getFuelColor = (level?: number) => {
        if (level === undefined) return 'bg-zinc-50 text-zinc-400 border-zinc-100'
        if (level < 25) return 'bg-red-50 text-red-700 border-red-100'
        if (level < 50) return 'bg-amber-50 text-amber-700 border-amber-100'
        return 'bg-blue-50 text-blue-700 border-blue-100' // Using Blue instead of green for fuel to differentiate from Route status
    }

    return (
        <PremiumPageLayout title="Gestión de Flota" description="Administración y control operativo del parque automotor">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* TOOLBAR */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-3 text-muted-foreground" size={18} />
                        <Input
                            placeholder="Buscar por placa, modelo o código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-11 pl-12 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <Button onClick={handleCreate} className="w-full md:w-auto rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                        <Plus size={18} className="mr-2" />
                        Nuevo Vehículo
                    </Button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-primary mb-4" />
                        <p className="font-medium animate-pulse">Sincronizando flota...</p>
                    </div>
                ) : filteredVehicles.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50">
                        <Car size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No se encontraron vehículos</h3>
                        <p className="max-w-sm mx-auto mt-1 text-sm">Prueba ajustando tu búsqueda o registra un nuevo vehículo en la flota.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredVehicles.map((vehicle) => {
                            const statusConfig = (() => {
                                switch (vehicle.computedStatus) {
                                    case 'IN_ROUTE': return { label: "En Ruta", dot: "bg-green-500", pulse: true }
                                    case 'CRITICAL': return { label: "Falla Activa", dot: "bg-red-500", pulse: true }
                                    case 'MAINTENANCE': return { label: "En Taller", dot: "bg-amber-500", pulse: false }
                                    default: return { label: "En Galpón", dot: "bg-zinc-500", pulse: false }
                                }
                            })()

                            const fuelColor = (() => {
                                const l = vehicle.current_fuel_level
                                if (l === undefined) return 'text-zinc-400 bg-white/5 border-white/10'
                                if (l < 25) return 'text-red-400 bg-red-500/10 border-red-500/20'
                                if (l < 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            })()

                            const hasFaults = vehicle.faultsSummary &&
                                (vehicle.faultsSummary.critical > 0 || vehicle.faultsSummary.high > 0)

                            return (
                                <div
                                    key={vehicle.id}
                                    onClick={() => handleCardClick(vehicle)}
                                    className="group relative overflow-hidden rounded-2xl cursor-pointer h-64 bg-zinc-900"
                                    style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.3)" }}
                                >
                                    {/* Background image */}
                                    {vehicle.foto_url ? (
                                        <Image
                                            src={vehicle.foto_url}
                                            alt={vehicle.modelo}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                            {vehicle.tipo === 'Moto' ? <Bike size={64} className="text-zinc-700" /> :
                                                vehicle.tipo === 'Carga' ? <Truck size={64} className="text-zinc-700" /> :
                                                    <Car size={64} className="text-zinc-700" />}
                                        </div>
                                    )}

                                    {/* Dark gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                                    {/* Edit button — top left */}
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="absolute top-2 left-2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm border border-white/10"
                                        onClick={(e) => handleEdit(e, vehicle)}
                                    >
                                        <Edit size={13} />
                                    </Button>

                                    {/* Status badge — top right */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/50 border border-white/10 z-10">
                                        <span className="relative flex h-2 w-2">
                                            {statusConfig.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.dot} opacity-75`} />}
                                            <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.dot}`} />
                                        </span>
                                        <span className="text-xs font-semibold text-white">{statusConfig.label}</span>
                                    </div>

                                    {/* Faults badge */}
                                    {hasFaults && (
                                        <div className="absolute top-11 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-sm z-10">
                                            <AlertTriangle size={9} className="text-red-400" />
                                            <span className="text-[10px] font-bold text-red-400">
                                                {vehicle.faultsSummary!.critical > 0 ? `${vehicle.faultsSummary!.critical} Crít` : `${vehicle.faultsSummary!.high} Alta`}
                                            </span>
                                        </div>
                                    )}

                                    {/* Bottom info */}
                                    <div className="absolute bottom-0 inset-x-0 p-3">
                                        <div className="mb-1 transition-all duration-300 group-hover:-translate-y-1">
                                            {vehicle.tipo === 'Moto'
                                                ? <Bike size={18} className="text-white/60" />
                                                : vehicle.tipo === 'Carga'
                                                    ? <Truck size={18} className="text-white/60" />
                                                    : <Car size={18} className="text-white/60" />}
                                        </div>
                                        <h3 className="font-bold text-base text-white leading-tight">{vehicle.modelo}</h3>
                                        <p className="text-zinc-400 text-[11px] font-mono mb-2">
                                            <span className="bg-white/10 px-1 py-0.5 rounded mr-1">{vehicle.codigo}</span>
                                            {vehicle.placa}
                                        </p>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${fuelColor}`}>
                                                <Fuel size={9} />
                                                {vehicle.current_fuel_level ?? 0}%
                                            </div>
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                                                <Gauge size={9} />
                                                {vehicle.kilometraje?.toLocaleString()} km
                                            </div>
                                            {vehicle.driverName && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-zinc-400 bg-white/5 border border-white/10 truncate max-w-[100px]">
                                                    <User size={9} />
                                                    <span className="truncate">{vehicle.driverName.split(' ')[0]}</span>
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
                )}
            </div>

            <VehicleFormDialog
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onVehicleSaved={handleSuccess}
                vehicleToEdit={editingVehicle as any} // Cast safely as AdminVehicle is superset
            />

            <VehicleDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                vehicle={selectedVehicle as any}
                onUpdate={loadVehicles}
            // Admin can update from Details? Typically yes, allowing edit trigger from within details if supported
            />
        </PremiumPageLayout>
    )
}
