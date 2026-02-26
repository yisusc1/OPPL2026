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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredVehicles.map((vehicle) => (
                            <Card
                                key={vehicle.id}
                                className="overflow-hidden rounded-[32px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-500 group cursor-pointer relative"
                                onClick={() => handleCardClick(vehicle)}
                            >
                                {/* IMAGE AREA */}
                                <div className="h-44 bg-zinc-50 dark:bg-zinc-950 relative group-hover:scale-105 transition-transform duration-700">
                                    {vehicle.foto_url ? (
                                        <Image
                                            src={vehicle.foto_url}
                                            alt={vehicle.modelo}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                            {vehicle.tipo === 'Moto' ? <Bike size={48} /> :
                                                vehicle.tipo === 'Carga' ? <Truck size={48} /> :
                                                    <Car size={48} />}
                                        </div>
                                    )}

                                    {/* Edit Button - Floating Top Left */}
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="absolute top-4 left-4 h-8 w-8 rounded-full bg-white/90 dark:bg-black/80 hover:bg-white dark:hover:bg-black text-zinc-700 dark:text-zinc-300 shadow-sm backdrop-blur-sm z-20 border border-white/20"
                                        onClick={(e) => handleEdit(e, vehicle)}
                                    >
                                        <Edit size={14} />
                                    </Button>

                                    {/* Status Badge Overlay */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <div className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-full 
                                            backdrop-blur-xl bg-white/80 dark:bg-black/60 border border-white/40 dark:border-white/10 shadow-sm
                                        `}>
                                            <span className={`relative flex h-2.5 w-2.5`}>
                                                {vehicle.computedStatus === 'IN_ROUTE' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${vehicle.computedStatus === 'IN_ROUTE' ? 'bg-green-500' :
                                                        vehicle.computedStatus === 'CRITICAL' ? 'bg-red-500' :
                                                            vehicle.computedStatus === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-zinc-400'
                                                    }`}></span>
                                            </span>
                                            <span className={`text-xs font-semibold tracking-wide ${vehicle.computedStatus === 'IN_ROUTE' ? 'text-green-800 dark:text-green-400' :
                                                    vehicle.computedStatus === 'CRITICAL' ? 'text-red-800 dark:text-red-400' :
                                                        vehicle.computedStatus === 'MAINTENANCE' ? 'text-amber-800 dark:text-amber-400' : 'text-zinc-600 dark:text-zinc-400'
                                                }`}>
                                                {getStatusLabel(vehicle.computedStatus)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Hover Overlay Text */}
                                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center">
                                        <span className="text-white text-xs font-bold tracking-widest uppercase">Ver Detalles</span>
                                    </div>
                                </div>

                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-tight">{vehicle.modelo}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                                    {vehicle.codigo}
                                                </span>
                                                <span className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">{vehicle.placa}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mt-4">
                                        {/* Driver Row */}
                                        <div className="flex items-center gap-3 text-sm bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                                            <div className="p-1.5 bg-white dark:bg-zinc-700 rounded-lg shadow-sm">
                                                <User size={14} className="text-zinc-400 dark:text-zinc-300" />
                                            </div>
                                            <span className={`font-medium truncate ${vehicle.driverName ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400 italic'}`}>
                                                {vehicle.driverName || "Sin conductor asignado"}
                                            </span>
                                        </div>

                                        {/* Fuel & Mileage Grid */}
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border shadow-sm ${getFuelColor(vehicle.current_fuel_level)}`}>
                                                <Fuel size={14} strokeWidth={2.5} />
                                                <span>{vehicle.current_fuel_level ?? 0}%</span>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold border border-zinc-100 dark:border-zinc-700 shadow-sm">
                                                <Gauge size={14} strokeWidth={2.5} className="text-zinc-400" />
                                                <span className="font-mono tracking-tight">{vehicle.kilometraje?.toLocaleString()} km</span>
                                            </div>
                                        </div>

                                        {/* Status Detail Row */}
                                        {vehicle.computedStatus === 'IN_ROUTE' ? (
                                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-900/30 mt-3">
                                                <MapPin size={14} className="animate-bounce" />
                                                <span className="font-medium">Salida: {vehicle.lastExit ? new Date(vehicle.lastExit).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}</span>
                                            </div>
                                        ) : vehicle.computedStatus === 'MAINTENANCE' ? (
                                            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 mt-3">
                                                <Wrench size={14} />
                                                <span className="font-medium">En Mantenimiento</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg mt-3">
                                                <CheckCircle2 size={14} />
                                                <span>Disponible en Galpón</span>
                                            </div>
                                        )}

                                        {/* Faults Mini-Badges */}
                                        {vehicle.faultsSummary && (vehicle.faultsSummary.critical > 0 || vehicle.faultsSummary.high > 0) && (
                                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                                {vehicle.faultsSummary.critical > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                                        {vehicle.faultsSummary.critical} Críticas
                                                    </span>
                                                )}
                                                {vehicle.faultsSummary.high > 0 && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                                                        {vehicle.faultsSummary.high} Altas
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
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
