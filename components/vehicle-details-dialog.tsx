"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, Car, Bike, Truck, Calendar, Droplets, Gauge, MapPin, Hash, CreditCard, Fuel, AlertTriangle, Wrench, User, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

type Vehicle = {
    id: string
    codigo: string
    placa: string
    modelo: string
    año: string
    color: string
    tipo: string
    capacidad_tanque: string
    foto_url?: string
    department?: string
    kilometraje?: number
    current_fuel_level?: number
    last_fuel_update?: string
    last_oil_change_km?: number
    last_timing_belt_km?: number
    last_chain_kit_km?: number
    last_wash_date?: string
    assigned_driver_id?: string
    falla_activa?: {
        prioridad: string
        tipo_falla: string
    }
    activeReport?: any // [NEW]
    maintenance_configs?: {
        id: string
        service_type: string
        custom_name?: string
        interval_value: number
        is_time_based: boolean
        last_service_value: number
    }[]
}

type Fault = {
    id: string
    descripcion: string
    tipo_falla: string
    prioridad: string
    estado: string
    created_at: string
}

type VehicleDetailsDialogProps = {
    isOpen: boolean
    onClose: () => void
    vehicle: Vehicle | null
    onUpdate?: () => void
    readonly?: boolean
}

import { DriverSelector, Driver } from "./driver-selector"

export function VehicleDetailsDialog({ isOpen, onClose, vehicle, onUpdate, readonly = false }: VehicleDetailsDialogProps) {
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [assigning, setAssigning] = useState(false)
    const [faults, setFaults] = useState<Fault[]>([])
    const [loadingFaults, setLoadingFaults] = useState(false)
    const [maintenanceConfigs, setMaintenanceConfigs] = useState<any[]>([])

    // Transfer Confirmation State
    const [pendingDriver, setPendingDriver] = useState<any>(null)
    const [transferDialogOpen, setTransferDialogOpen] = useState(false)

    useEffect(() => {
        if (isOpen && vehicle) {
            loadFaults()
            loadDrivers()
            loadMaintenanceConfigs()
        }
    }, [isOpen, vehicle])

    async function loadMaintenanceConfigs() {
        if (!vehicle) return
        const supabase = createClient()
        const { data } = await supabase
            .from('vehicle_maintenance_configs')
            .select('*')
            .eq('vehicle_id', vehicle.id)
        setMaintenanceConfigs(data || [])
    }

    async function loadFaults() {
        if (!vehicle) return
        setLoadingFaults(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('fallas')
            .select('*')
            .eq('vehiculo_id', vehicle.id)
            .neq('estado', 'Descartado')
            .order('created_at', { ascending: false })

        if (data) setFaults(data)
        setLoadingFaults(false)
    }

    async function loadDrivers() {
        const supabase = createClient()

        // 1. Fetch profiles
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')

        // 2. Fetch active vehicle assignments
        const { data: vehicles } = await supabase
            .from('vehiculos')
            .select('id, modelo, placa, assigned_driver_id')
            .not('assigned_driver_id', 'is', null)

        if (profiles) {
            const driversList = profiles // Showing all profiles to match Form behavior and avoid invisible assigned drivers


            // Map current vehicle to driver
            const driversWithStatus = driversList.map((d: any) => {
                const assigned = vehicles?.find((v: any) => v.assigned_driver_id === d.id)
                return { ...d, currentVehicle: assigned }
            })

            setDrivers(driversWithStatus)
        }
    }

    async function handleAssignDriver(d: Driver | null) {
        if (!vehicle) return;

        // If null selected, unassign
        if (!d) {
            executeAssignment('none')
            return
        }

        const driverId = d.id

        // Check availability
        const selectedDriver = drivers.find(dr => dr.id === driverId)

        // Logic for Transfer
        if (selectedDriver?.currentVehicle && selectedDriver.currentVehicle.id !== vehicle.id) {
            setPendingDriver(selectedDriver)
            setTransferDialogOpen(true)
            return
        }

        // Proceed with Assignment directly if no conflict
        executeAssignment(driverId)
    }

    async function executeAssignment(driverId: string, isTransfer = false) {
        if (!vehicle) return

        if (isTransfer && pendingDriver) {
            setAssigning(true)
            const supabase = createClient()
            // 1. Unassign from old vehicle
            const { error: unassignError } = await supabase
                .from('vehiculos')
                .update({ assigned_driver_id: null })
                .eq('id', pendingDriver.currentVehicle.id)

            if (unassignError) {
                console.error("Error unassigning:", unassignError)
                toast.error("Error al desvincular vehículo anterior")
                setAssigning(false)
                return
            }
        }

        setAssigning(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('vehiculos')
            .update({ assigned_driver_id: driverId === 'none' ? null : driverId })
            .eq('id', vehicle.id)

        setAssigning(false)
        if (error) {
            console.error(error)
            alert("Error al asignar conductor")
        } else {
            toast.success(isTransfer ? "Traslado realizado con éxito" : "Conductor asignado")
            if (onUpdate) onUpdate()
            onClose()
        }
    }

    const getIcon = (tipo: string) => {
        switch (tipo?.toLowerCase()) {
            case 'moto': return <Bike size={24} />;
            case 'carga': return <Truck size={24} />;
            default: return <Car size={24} />;
        }
    }

    const getPriorityColor = (prioridad: string) => {
        switch (prioridad) {
            case 'Crítica': return 'bg-red-100 text-red-700 border-red-200';
            case 'Alta': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    }

    if (!isOpen || !vehicle) return null

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-none rounded-[32px] shadow-2xl max-h-[90vh] flex flex-col focus:outline-none">

                    {/* Scrollable Content Container */}
                    <div className="overflow-y-auto custom-scrollbar flex flex-col">

                        {/* Top Section: Image & Key Info */}
                        <div className="w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col">
                            <div className="relative w-full aspect-video bg-zinc-200 dark:bg-zinc-800">
                                {vehicle.foto_url ? (
                                    <Image
                                        src={vehicle.foto_url}
                                        alt={vehicle.modelo}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-zinc-300 dark:text-zinc-700">
                                        {getIcon(vehicle.tipo)}
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                                    {getIcon(vehicle.tipo)}
                                    {vehicle.tipo}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 bg-black/20 hover:bg-black/40 text-white rounded-full z-10"
                                    onClick={onClose}
                                >
                                    <X size={20} />
                                </Button>
                            </div>

                            <div className="p-6">
                                <div className="mb-6">
                                    <DialogTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{vehicle.modelo}</DialogTitle>
                                    <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-mono text-lg">{vehicle.placa}</DialogDescription>
                                </div>

                                {/* Driver Assignment Section - NEW */}
                                <div className="mb-6">
                                    {readonly ? (
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700">
                                            <div className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase mb-2">Conductor Asignado</div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-300">
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                                                        {drivers.find(d => d.id === vehicle.assigned_driver_id)?.first_name} {drivers.find(d => d.id === vehicle.assigned_driver_id)?.last_name || "Sin Asignar"}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        {vehicle.assigned_driver_id ? "Conductor Oficial" : "Vehículo sin conductor"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="w-full">
                                                <DriverSelector
                                                    drivers={drivers}
                                                    selectedDriverId={vehicle.assigned_driver_id}
                                                    onSelect={handleAssignDriver}
                                                    loading={assigning}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Department display */}
                                {
                                    vehicle.department && (
                                        <div className="mb-6 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 flex items-center justify-between">
                                            <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Departamento</span>
                                            <span className="font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm text-sm">
                                                {vehicle.department}
                                            </span>
                                        </div>
                                    )
                                }

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
                                        <div className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase mb-1">Kilometraje</div>
                                        <div className="text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-1">
                                            <MapPin size={14} className="text-blue-500" />
                                            {(vehicle.kilometraje || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
                                        <div className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase mb-1">Código</div>
                                        <div className="text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-1">
                                            <Hash size={14} className="text-purple-500" />
                                            {vehicle.codigo}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm mb-6 flex justify-between items-center">
                                    <span className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Nivel de Combustible</span>
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${(vehicle.current_fuel_level || 0) <= 25 ? "bg-red-50 text-red-600 border border-red-100" :
                                        (vehicle.current_fuel_level || 0) <= 50 ? "bg-yellow-50 text-yellow-700 border border-yellow-100" :
                                            "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        }`}>
                                        <Fuel size={16} />
                                        <span>{vehicle.current_fuel_level || 0}%</span>
                                    </div>
                                </div>


                                {/* ACTIVE REPORT SECTION [NEW] */}
                                {vehicle.activeReport && (
                                    <div className="mb-6 bg-blue-50/50 dark:bg-blue-950/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                                                <MapPin size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-blue-900 dark:text-blue-100 text-sm">Reporte de Salida Activo</h3>
                                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                                    Salida: {new Date(vehicle.activeReport.fecha_salida).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Key Metrics */}
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-white dark:bg-zinc-900/50 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Conductor</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm block truncate">{vehicle.activeReport.conductor}</span>
                                            </div>
                                            <div className="bg-white dark:bg-zinc-900/50 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Km Salida</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm block">{vehicle.activeReport.km_salida} km</span>
                                            </div>
                                        </div>

                                        {/* Checklist */}
                                        <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm overflow-hidden">
                                            <div className="bg-blue-50/30 dark:bg-blue-950/30 px-4 py-2 border-b border-blue-100 dark:border-blue-900/30">
                                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Verificación de Salida</span>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-4">
                                                {/* COMMON */}
                                                <CheckItem label="Aceite" checked={vehicle.activeReport.aceite_salida} />

                                                {/* CAR SPECIFIC (Agua, Safety) */}
                                                {!vehicle.tipo?.toLowerCase().includes('moto') && !vehicle.modelo?.toLowerCase().includes('moto') && (
                                                    <>
                                                        <CheckItem label="Agua / Refr." checked={vehicle.activeReport.agua_salida} />
                                                        <CheckItem label="Caucho" checked={vehicle.activeReport.caucho_salida} />
                                                        <CheckItem label="Gato" checked={vehicle.activeReport.gato_salida} />
                                                        <CheckItem label="Triángulo" checked={vehicle.activeReport.triangulo_salida} />
                                                        <CheckItem label="Cruz" checked={vehicle.activeReport.cruz_salida} />
                                                        <CheckItem label="Carpeta" checked={vehicle.activeReport.carpeta_salida} />
                                                    </>
                                                )}

                                                {/* MOTO SPECIFIC */}
                                                {(vehicle.tipo?.toLowerCase().includes('moto') || vehicle.modelo?.toLowerCase().includes('moto')) && (
                                                    <>
                                                        <CheckItem label="Casco" checked={vehicle.activeReport.casco_salida} />
                                                        <CheckItem label="Luces" checked={vehicle.activeReport.luces_salida} />
                                                        <CheckItem label="Herramientas" checked={vehicle.activeReport.herramientas_salida} />
                                                    </>
                                                )}

                                                {/* TECH STUFF - Only for Soporte/Instalación AND NOT MOTO */}
                                                {(vehicle.department === 'Soporte' || vehicle.department === 'Instalación') && !vehicle.tipo?.toLowerCase().includes('moto') && !vehicle.modelo?.toLowerCase().includes('moto') && (
                                                    <>
                                                        <CheckItem label="ONU" checked={vehicle.activeReport.onu_salida === 1} />
                                                        <CheckItem label="UPS" checked={vehicle.activeReport.ups_salida === 1} />
                                                        <CheckItem label="Escalera" checked={vehicle.activeReport.escalera_salida} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Dynamic Maintenance Section */}
                                <div className="mt-6 mb-6">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                        <Wrench className="text-zinc-400" size={16} />
                                        Mantenimiento Preventivo
                                    </h3>

                                    <div className="space-y-4">
                                        {maintenanceConfigs && maintenanceConfigs.length > 0 ? (
                                            maintenanceConfigs.map((config, index) => {
                                                // Icon & Label Mapping
                                                let Icon = Wrench;
                                                let iconColor = "text-purple-500";
                                                let label = config.custom_name || "Mantenimiento";

                                                if (config.service_type === 'OIL_CHANGE') { Icon = Droplets; iconColor = "text-amber-500"; label = "Cambio de Aceite"; }
                                                else if (config.service_type === 'TIMING_BELT') { Icon = Gauge; iconColor = "text-blue-500"; label = "Correa de Tiempo"; }
                                                else if (config.service_type === 'CHAIN_KIT') { Icon = Bike; iconColor = "text-zinc-600 dark:text-zinc-400"; label = "Kit de Arrastre"; }
                                                else if (config.service_type === 'WASH') { Icon = Droplets; iconColor = "text-cyan-500"; label = "Lavado y Aspirado"; }

                                                const isTimeBased = config.is_time_based;

                                                return (
                                                    <div key={config.id || index} className="bg-white dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700 shadow-sm">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Icon size={16} className={iconColor} />
                                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                                                            </div>
                                                            <span className="text-xs text-zinc-400 font-mono">
                                                                Último: {config.last_service_value ? (
                                                                    isTimeBased
                                                                        ? new Date(Number(config.last_service_value)).toLocaleDateString()
                                                                        : Number(config.last_service_value).toLocaleString() + ' km'
                                                                ) : 'N/A'}
                                                            </span>
                                                        </div>

                                                        {config.last_service_value ? (() => {
                                                            if (isTimeBased) {
                                                                const lastService = new Date(Number(config.last_service_value))
                                                                const today = new Date()
                                                                const diffTime = Math.abs(today.getTime() - lastService.getTime())
                                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                                                // Progress based on interval
                                                                const intervalDays = config.interval_value || 15
                                                                const progress = Math.min(100, (diffDays / intervalDays) * 100)
                                                                const remainingDays = Math.max(0, intervalDays - diffDays)

                                                                const statusColor = progress >= 100 ? 'bg-red-500' : progress >= 75 ? 'bg-yellow-500' : 'bg-cyan-500'

                                                                return (
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1.5">
                                                                            <span className="text-zinc-500 dark:text-zinc-400">Hace: {diffDays} días</span>
                                                                            <span className={`font-bold ${progress >= 100 ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                                                                {remainingDays > 0 ? `${remainingDays} días restantes` : 'Vencido'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                                                                                style={{ width: `${progress}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )
                                                            } else {
                                                                // Mileage based
                                                                if (!vehicle.kilometraje) return <div className="text-xs text-zinc-400 italic">Kilometraje de vehículo desconocido</div>

                                                                const interval = config.interval_value || 5000
                                                                const driven = vehicle.kilometraje - Number(config.last_service_value)
                                                                const progress = Math.min(100, (driven / interval) * 100)
                                                                const remaining = Math.max(0, interval - driven)
                                                                const statusColor = progress >= 100 ? 'bg-red-500' : progress >= 75 ? 'bg-yellow-500' : 'bg-emerald-500'

                                                                return (
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1.5">
                                                                            <span className="text-zinc-500 dark:text-zinc-400">Recorrido: {driven.toLocaleString()} km</span>
                                                                            <span className={`font-bold ${progress >= 100 ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                                                                {remaining > 0 ? `${remaining.toLocaleString()} km restantes` : 'Vencido'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-500 ${statusColor}`}
                                                                                style={{ width: `${progress}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )
                                                            }
                                                        })() : (
                                                            <div className="text-xs text-zinc-400 italic">Sin información de servicio</div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="text-center p-4 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-400 text-xs">
                                                No hay configuraciones de mantenimiento.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {
                                    vehicle.last_fuel_update && (
                                        <p className="text-[10px] text-zinc-400 text-right mb-6 pr-1">
                                            Combustible actualizado: {new Date(vehicle.last_fuel_update).toLocaleString()}
                                        </p>
                                    )
                                }

                                <div className="grid grid-cols-3 gap-4 text-sm border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                    <div>
                                        <span className="block text-zinc-400 text-xs mb-1">Año</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{vehicle.año || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-zinc-400 text-xs mb-1">Color</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{vehicle.color || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-zinc-400 text-xs mb-1">Tanque</span>
                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{vehicle.capacidad_tanque || '-'} L</span>
                                    </div>
                                </div>
                            </div >
                        </div >

                        {/* Bottom Section: Faults History */}
                        < div className="w-full p-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800" >
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                                <Wrench className="text-zinc-400" size={20} />
                                Historial de Fallas
                            </h3>

                            <div className="space-y-3">
                                {loadingFaults ? (
                                    <div className="text-center py-6 text-zinc-400 text-sm">Cargando historial...</div>
                                ) : faults.length === 0 ? (
                                    <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                        <div className="mx-auto w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-2">
                                            <Wrench size={18} />
                                        </div>
                                        <h4 className="text-zinc-900 dark:text-zinc-100 font-medium text-sm">Sin fallas reportadas</h4>
                                    </div>
                                ) : (
                                    faults.map((fault) => (
                                        <div key={fault.id} className="group p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all bg-zinc-50/50 dark:bg-zinc-900/50">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex gap-2 items-center">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(fault.prioridad)}`}>
                                                        {fault.prioridad}
                                                    </span>
                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${fault.estado === 'Pendiente' ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300' :
                                                        fault.estado === 'En Revisión' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                            fault.estado === 'Reparado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                                'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                                                        }`}>
                                                        {fault.estado}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-zinc-400 font-mono">
                                                    {new Date(fault.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mb-1">{fault.tipo_falla}</h4>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{fault.descripcion}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div >
                    </div >
                </DialogContent >
            </Dialog >

            <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-zinc-900">
                            Confirmar Traslado
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-500">
                            {pendingDriver && (
                                <span className="block mt-2 bg-amber-50 text-amber-900 p-4 rounded-xl border border-amber-200">
                                    <span className="font-bold">{pendingDriver.first_name}</span> actualmente tiene asignado el vehículo:
                                    <br />
                                    <span className="font-bold text-lg mt-1 block">{pendingDriver.currentVehicle.modelo}</span>
                                    <span className="text-xs font-mono uppercase opacity-75">{pendingDriver.currentVehicle.placa}</span>
                                    <br /><br />
                                    ¿Deseas desvincularlo de su unidad actual y asignarlo a este vehículo?
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-xl bg-black text-white hover:bg-zinc-800"
                            onClick={() => {
                                executeAssignment(pendingDriver.id, true)
                                setTransferDialogOpen(false)
                            }}
                        >
                            Confirmar Traslado
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function CheckItem({ label, checked }: { label: string, checked: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`
                w-5 h-5 rounded-full flex items-center justify-center text-[10px] border
                ${checked ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/20 text-red-400 dark:text-red-400 border-red-100 dark:border-red-900/30'}
            `}>
                {checked ? <CheckCircle2 size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </div>
            <span className={`text-xs font-medium ${checked ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'}`}>{label}</span>
        </div>
    )
}
