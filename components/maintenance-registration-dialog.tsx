"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { Droplets, Gauge, Bike, Command, Loader2, Car, Timer, AlertTriangle } from "lucide-react"
import { registerMaintenance, reportFault } from "@/app/taller/actions"
import { toast } from "sonner"

type Vehicle = {
    id: string
    placa: string
    modelo: string
    tipo: string
    kilometraje?: number
    maintenance_configs?: {
        id: string
        service_type: string
        custom_name?: string
        interval_value: number
        is_time_based: boolean
    }[]
}

interface MaintenanceRegistrationDialogProps {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    initialServiceType?: string // [NEW] Pre-select service
    lockServiceType?: boolean   // [NEW] Prevent changing service
    lockVehicle?: boolean // [NEW]
    onSuccess?: () => void
}

export function MaintenanceRegistrationDialog({
    isOpen,
    onClose,
    initialVehicleId,
    initialServiceType,
    lockServiceType = false,
    lockVehicle = false, // [NEW]
    onSuccess
}: MaintenanceRegistrationDialogProps) {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [loadingVehicles, setLoadingVehicles] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // Tab State
    const [activeTab, setActiveTab] = useState<'maintenance' | 'fault'>('maintenance')

    // Form State
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
    const [serviceType, setServiceType] = useState<string>("")
    const [mileage, setMileage] = useState<string>("")
    const [notes, setNotes] = useState("")
    const [faultPriority, setFaultPriority] = useState("Media") // For Fault Report
    const [faultType, setFaultType] = useState("Mecánica") // For Fault Report
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            loadVehicles()
            resetForm()
        }
    }, [isOpen, initialVehicleId, initialServiceType, lockVehicle, lockServiceType])

    async function loadVehicles() {
        setLoadingVehicles(true)
        const supabase = createClient()

        // Fetch vehicles and current mileage
        const { data: vData } = await supabase.from('vehiculos').select('id, placa, modelo, tipo')
        const { data: kData } = await supabase.from('vista_ultimos_kilometrajes').select('*')
        const { data: configsData } = await supabase.from('vehicle_maintenance_configs').select('*')

        if (vData) {
            const merged = vData.map(v => {
                const vConfigs = configsData?.filter(c => c.vehicle_id === v.id) || []
                return {
                    ...v,
                    kilometraje: kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0,
                    maintenance_configs: vConfigs
                }
            })
            setVehicles(merged)

            // Handle Pre-selection
            if (initialVehicleId) {
                const preselected = merged.find(v => v.id === initialVehicleId)
                if (preselected) {
                    setSelectedVehicle(preselected)
                    setMileage(preselected.kilometraje?.toString() || "")
                }
            }
        }
        setLoadingVehicles(false)
    }

    function resetForm() {
        if (!initialVehicleId && !lockVehicle) setSelectedVehicle(null)

        // Handle Service Type Pre-selection
        if (initialServiceType) {
            setServiceType(initialServiceType)
        } else {
            setServiceType("")
        }

        setNotes("")
        setFaultPriority("Media")
        setFaultType("Mecánica")
        setSearchTerm("")
        setActiveTab('maintenance')
    }

    const filteredVehicles = vehicles.filter(v =>
        v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchTerm.toLowerCase())
    )

    async function handleSubmit() {
        if (!selectedVehicle) return

        if (activeTab === 'maintenance' && (!serviceType || !mileage)) {
            toast.error("Complete todos los campos requeridos")
            return
        }

        if (activeTab === 'fault' && !notes) {
            toast.error("Describa la falla")
            return
        }

        const currentKm = selectedVehicle.kilometraje || 0
        const newKm = parseFloat(mileage)

        if (serviceType !== 'WASH' && newKm < currentKm) {
            toast.error(`El kilometraje no puede ser menor al actual (${currentKm} km)`)
            return
        }

        setIsSubmitting(true)

        setIsSubmitting(true)

        let result
        if (activeTab === 'fault') {
            result = await reportFault({
                vehicle_id: selectedVehicle!.id,
                description: notes || "Sin descripción",
                priority: faultPriority,
                fault_type: faultType
            })
        } else {
            result = await registerMaintenance({
                vehicle_id: selectedVehicle!.id,
                service_type: serviceType,
                mileage: parseFloat(mileage),
                notes,
                performed_by: 'Mecánico'
            })
        }

        setIsSubmitting(false)

        if (result.success) {
            toast.success(activeTab === 'fault' ? "Falla reportada correctamente" : "Mantenimiento registrado correctamente")
            if (onSuccess) onSuccess()
            onClose()
        } else {
            toast.error("Error al registrar: " + result.error)
        }
    }

    // ServiceCard component is no longer used directly in the render loop, but the definition is kept if needed elsewhere.
    const ServiceCard = ({ id, label, icon: Icon, color }: any) => (
        <div
            onClick={() => setServiceType(id)}
            className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 text-center h-24
                ${serviceType === id
                    ? `bg-${color}-50 border-${color}-500 text-${color}-700 ring-1 ring-${color}-500`
                    : `bg-white border-zinc-200 hover:border-${color}-200 hover:bg-${color}-50/50`
                }
            `}
        >
            <Icon size={24} className={serviceType === id ? `text-${color}-600` : `text-zinc-400`} />
            <span className={`text-xs font-bold ${serviceType === id ? `text-${color}-900` : `text-zinc-600`}`}>
                {label}
            </span>
        </div>
    )

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md bg-zinc-50 dark:bg-zinc-950 p-0 gap-0 overflow-hidden border-none rounded-3xl text-foreground">
                <div className="p-6 pb-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-white">Registrar Mantenimiento</DialogTitle>
                        <DialogDescription className="text-zinc-500 dark:text-zinc-400">Seleccione el vehículo y el tipo de servicio realizado.</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {/* 1. Vehicle Selection */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Vehículo</Label>
                        {!selectedVehicle ? (
                            <div className="relative">
                                <SearchInput
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    placeholder="Buscar placa o modelo..."
                                />
                                <div className="mt-2 max-h-40 overflow-y-auto border border-zinc-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-900 divide-y divide-zinc-50 dark:divide-white/5 shadow-sm">
                                    {loadingVehicles ? (
                                        <div className="p-4 text-center text-zinc-400 text-sm">Cargando...</div>
                                    ) : filteredVehicles.length === 0 ? (
                                        <div className="p-4 text-center text-zinc-400 text-sm">No se encontraron vehículos</div>
                                    ) : (
                                        filteredVehicles.map(v => (
                                            <div
                                                key={v.id}
                                                onClick={() => {
                                                    setSelectedVehicle(v)
                                                    setMileage(v.kilometraje?.toString() || "")
                                                }}
                                                className="p-3 hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer flex justify-between items-center transition-colors"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm text-zinc-900 dark:text-white">{v.modelo}</div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{v.placa}</div>
                                                </div>
                                                <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded-md">
                                                    {(v.kilometraje || 0).toLocaleString()} km
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                                        <Car size={18} className="text-zinc-500 dark:text-zinc-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-white">{selectedVehicle.modelo}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedVehicle.placa}</div>
                                    </div>
                                </div>
                                {!lockVehicle && activeTab !== 'fault' && (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedVehicle(null)}
                                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                                        Cambiar
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. Toggle Mode (Only if vehicle selected) */}
                    {selectedVehicle && (
                        <div className="bg-zinc-100 dark:bg-white/5 p-1 rounded-xl flex gap-1">
                            <button
                                onClick={() => setActiveTab('maintenance')}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'maintenance' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                            >
                                Mantenimiento
                            </button>
                            <button
                                onClick={() => setActiveTab('fault')}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'fault' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                            >
                                Registrar Falla
                            </button>
                        </div>
                    )}

                    {/* 3. Content based on Tab */}
                    {selectedVehicle && activeTab === 'maintenance' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tipo de Servicio</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {(() => {
                                    const configs = selectedVehicle.maintenance_configs || []
                                    const options = configs.map(config => {
                                        let icon = Command;
                                        let label = config.custom_name || "Mantenimiento";

                                        if (config.service_type === 'OIL_CHANGE') { icon = Droplets; label = "Cambio de Aceite"; }
                                        else if (config.service_type === 'TIMING_BELT') { icon = Timer; label = "Correa de Tiempo"; }
                                        else if (config.service_type === 'CHAIN_KIT') { icon = Bike; label = "Kit de Arrastre"; }
                                        else if (config.service_type === 'WASH') { icon = Droplets; label = "Lavado y Aspirado"; }

                                        return { id: config.id, label, icon }
                                    });

                                    if (options.length === 0) {
                                        return <div className="col-span-2 text-center text-zinc-500 text-xs py-4 border border-dashed rounded-xl border-zinc-200 dark:border-white/10">Este vehículo no tiene mantenimientos configurados. Configurelos en el panel de Administración.</div>
                                    }

                                    return options.map((service) => {
                                        const isSelected = serviceType === service.id || (initialServiceType && service.id === initialServiceType)
                                        const isDisabled = lockServiceType && initialServiceType !== service.id

                                        if (isDisabled && !isSelected) return null

                                        // Auto-select if predefined
                                        if (isSelected && serviceType !== service.id && !lockServiceType) {
                                            setTimeout(() => setServiceType(service.id), 0)
                                        }

                                        return (
                                            <button
                                                key={service.id}
                                                onClick={() => !lockServiceType && setServiceType(service.id)}
                                                disabled={lockServiceType}
                                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all
                                                    ${isSelected
                                                        ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-white/10 text-zinc-900 dark:text-white'
                                                        : 'border-zinc-100 dark:border-white/5 bg-white dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:border-zinc-200 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/10'
                                                    }
                                                    ${lockServiceType ? 'cursor-default opacity-70' : ''}
                                                `}
                                            >
                                                <service.icon size={24} className={isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'} />
                                                <span className="font-medium text-sm text-center leading-tight">{service.label}</span>
                                            </button>
                                        )
                                    })
                                })()}
                            </div>
                        </div>
                    )}

                    {selectedVehicle && activeTab === 'fault' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tipo de Falla</Label>
                                    <Select value={faultType} onValueChange={setFaultType}>
                                        <SelectTrigger className="h-11 rounded-xl bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Mecánica">Mecánica</SelectItem>
                                            <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                                            <SelectItem value="Cauchos">Cauchos</SelectItem>
                                            <SelectItem value="Carrocería">Carrocería</SelectItem>
                                            <SelectItem value="Otro">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Prioridad</Label>
                                    <Select value={faultPriority} onValueChange={setFaultPriority}>
                                        <SelectTrigger className="h-11 rounded-xl bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Baja">Baja</SelectItem>
                                            <SelectItem value="Media">Media</SelectItem>
                                            <SelectItem value="Alta">Alta</SelectItem>
                                            <SelectItem value="Crítica">Crítica</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* 4. Common Details */}
                    {selectedVehicle && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {activeTab === 'maintenance' && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Kilometraje Actual</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            value={mileage}
                                            onChange={(e) => setMileage(e.target.value)}
                                            className="pl-10 font-mono font-bold bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                                        />
                                        <div className="absolute left-3 top-2.5 text-zinc-400">
                                            <Gauge size={16} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-zinc-400">
                                        Registrado: {(selectedVehicle.kilometraje || 0).toLocaleString()} km
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                    {activeTab === 'fault' ? 'Descripción del Problema' : 'Notas (Opcional)'}
                                </Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={activeTab === 'fault' ? "Describa detalladamente la falla..." : "Detalles adicionales del servicio..."}
                                    className="resize-none h-24 bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-white/5 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5">Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedVehicle || (activeTab === 'maintenance' && (!serviceType || !mileage)) || (activeTab === 'fault' && !notes)}
                        className="bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {activeTab === 'fault' ? 'Reportar Falla' : 'Registrar Servicio'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SearchInput({ value, onChange, placeholder }: any) {
    return (
        <div className="relative">
            <Command className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500" size={16} />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="pl-9 h-10 bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
        </div>
    )
}
