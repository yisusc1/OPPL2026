"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Upload, Camera, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEPARTMENTS } from "@/lib/constants"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type AdminVehicleMaintenanceConfig = {
    id?: string
    vehicle_id?: string
    service_type: string
    custom_name?: string
    interval_value: number
    is_time_based: boolean
    last_service_value: number
}

type Vehicle = {
    id?: string
    codigo: string
    placa: string
    modelo: string
    año: string
    color: string
    tipo: string
    capacidad_tanque: string
    foto_url?: string
    department?: string
    assigned_driver_id?: string | null
    maintenance_configs?: AdminVehicleMaintenanceConfig[]
}

type Profile = {
    id: string
    first_name: string
    last_name: string
    cedula: string
}

type VehicleFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    onVehicleSaved: () => void
    vehicleToEdit?: Vehicle | null
}

const SERVICE_TYPES = [
    { value: 'OIL_CHANGE', label: 'Cambio de Aceite' },
    { value: 'TIMING_BELT', label: 'Correa de Tiempo' },
    { value: 'CHAIN_KIT', label: 'Kit de Arrastre' },
    { value: 'WASH', label: 'Lavado y Aspirado' },
    { value: 'CUSTOM', label: 'Personalizado' },
]

export function VehicleFormDialog({ isOpen, onClose, onVehicleSaved, vehicleToEdit }: VehicleFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [drivers, setDrivers] = useState<Profile[]>([])
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [formData, setFormData] = useState<Vehicle>({
        codigo: "",
        placa: "",
        modelo: "",
        año: "",
        color: "",
        tipo: "Carga",
        capacidad_tanque: "",
        foto_url: "",
        department: "",
        assigned_driver_id: null
    })
    const [maintenanceConfigs, setMaintenanceConfigs] = useState<AdminVehicleMaintenanceConfig[]>([])

    useEffect(() => {
        if (isOpen) {
            fetchDrivers()
        }
    }, [isOpen])

    async function fetchDrivers() {
        const supabase = createClient()
        const { data } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, cedula')
            .order('first_name')

        if (data) {
            setDrivers(data)
        }
    }

    useEffect(() => {
        if (vehicleToEdit) {
            setFormData({
                id: vehicleToEdit.id,
                codigo: vehicleToEdit.codigo || "",
                placa: vehicleToEdit.placa || "",
                modelo: vehicleToEdit.modelo || "",
                año: vehicleToEdit.año || "",
                color: vehicleToEdit.color || "",
                tipo: vehicleToEdit.tipo || "Carga",
                capacidad_tanque: vehicleToEdit.capacidad_tanque || "",
                foto_url: vehicleToEdit.foto_url || "",
                department: vehicleToEdit.department || "",
                assigned_driver_id: vehicleToEdit.assigned_driver_id || null
            })
            if (vehicleToEdit.foto_url) {
                setPhotoPreview(vehicleToEdit.foto_url)
            } else {
                setPhotoPreview(null)
            }
            // Load existing configs
            setMaintenanceConfigs(vehicleToEdit.maintenance_configs || [])
        } else {
            // Reset for new creation
            setFormData({
                codigo: "",
                placa: "",
                modelo: "",
                año: "",
                color: "",
                tipo: "Carga",
                capacidad_tanque: "",
                foto_url: "",
                department: "",
                assigned_driver_id: null
            })
            setPhotoPreview(null)
            // Default Configs
            setMaintenanceConfigs([
                { service_type: 'OIL_CHANGE', interval_value: 5000, is_time_based: false, last_service_value: 0 },
                { service_type: 'WASH', interval_value: 15, is_time_based: true, last_service_value: Date.now() }
            ])
        }
    }, [vehicleToEdit, isOpen])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            const objectUrl = URL.createObjectURL(file)
            setPhotoPreview(objectUrl)
        }
    }

    const uploadPhoto = async (file: File): Promise<string | null> => {
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('vehiculos')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from('vehiculos').getPublicUrl(filePath)
            return data.publicUrl
        } catch (error) {
            console.error('Error uploading photo:', error)
            toast.error('Error al subir la imagen')
            return null
        }
    }

    const addConfig = () => {
        setMaintenanceConfigs([
            ...maintenanceConfigs,
            { service_type: 'CUSTOM', custom_name: '', interval_value: 5000, is_time_based: false, last_service_value: 0 }
        ])
    }

    const removeConfig = (index: number) => {
        const newConfigs = [...maintenanceConfigs]
        newConfigs.splice(index, 1)
        setMaintenanceConfigs(newConfigs)
    }

    const updateConfig = (index: number, field: keyof AdminVehicleMaintenanceConfig, value: any) => {
        const newConfigs = [...maintenanceConfigs]
        newConfigs[index] = { ...newConfigs[index], [field]: value }
        setMaintenanceConfigs(newConfigs)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = createClient()
            let finalFotoUrl = formData.foto_url

            // Upload new photo if selected
            if (fileInputRef.current?.files?.[0]) {
                const url = await uploadPhoto(fileInputRef.current.files[0])
                if (url) finalFotoUrl = url
            }

            const dataToSave = {
                codigo: formData.codigo,
                placa: formData.placa,
                modelo: formData.modelo,
                año: formData.año,
                color: formData.color,
                tipo: formData.tipo,
                capacidad_tanque: formData.capacidad_tanque,
                foto_url: finalFotoUrl,
                department: formData.department,
                assigned_driver_id: formData.assigned_driver_id
            }

            let vehicleId = vehicleToEdit?.id;
            let error;

            if (vehicleId) {
                // Update
                const { error: updateError } = await supabase
                    .from("vehiculos")
                    .update(dataToSave)
                    .eq("id", vehicleId)
                error = updateError
            } else {
                // Insert
                const { data: newVehicle, error: insertError } = await supabase
                    .from("vehiculos")
                    .insert(dataToSave)
                    .select("id")
                    .single()
                error = insertError
                if (newVehicle) {
                    vehicleId = newVehicle.id
                }
            }

            if (error) throw error

            // Save Maintenance Configs
            if (vehicleId) {
                // 1. Delete existing configs for this vehicle
                await supabase.from("vehicle_maintenance_configs").delete().eq("vehicle_id", vehicleId)

                // 2. Insert new configs
                if (maintenanceConfigs.length > 0) {
                    const configsToInsert = maintenanceConfigs.map(c => ({
                        vehicle_id: vehicleId,
                        service_type: c.service_type,
                        custom_name: c.service_type === 'CUSTOM' ? c.custom_name : null,
                        interval_value: c.interval_value,
                        is_time_based: c.is_time_based,
                        last_service_value: c.last_service_value
                    }))

                    const { error: configsError } = await supabase
                        .from("vehicle_maintenance_configs")
                        .insert(configsToInsert)

                    if (configsError) {
                        console.error("Error saving maintenance configs:", configsError)
                        toast.error("El vehículo se guardó, pero hubo un error con sus configuraciones de mantenimiento.")
                    }
                }
            }

            toast.success(vehicleToEdit ? "Vehículo actualizado" : "Vehículo creado")
            onVehicleSaved()
            onClose()
        } catch (error) {
            console.error("Error saving vehicle:", error)
            toast.error("Error al guardar el vehículo")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl rounded-[32px] border-none shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden max-h-[90vh] flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-6 pt-6 px-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                        {vehicleToEdit ? "Editar Vehículo" : "Nuevo Vehículo"}
                    </CardTitle>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </CardHeader>

                <CardContent className="p-6 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* PHOTO UPLOAD */}
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div
                                className="relative w-40 h-40 rounded-3xl bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center cursor-pointer overflow-hidden group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {photoPreview ? (
                                    <Image
                                        src={photoPreview}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="text-center text-zinc-400 dark:text-zinc-500">
                                        <Camera size={32} className="mx-auto mb-2" />
                                        <span className="text-xs font-medium">Subir Foto</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload className="text-white" size={24} />
                                </div>
                            </div>
                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoSelect} />
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">JPG, PNG, WEBP (Max 5MB)</p>
                        </div>

                        {/* BASIC INFORMATION */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Información Básica</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Código</label>
                                    <Input name="codigo" value={formData.codigo} onChange={handleChange} required placeholder="Ej. C-01" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Placa</label>
                                    <Input name="placa" value={formData.placa} onChange={handleChange} required placeholder="Ej. AB123CD" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Modelo</label>
                                    <Input name="modelo" value={formData.modelo} onChange={handleChange} required placeholder="Ej. Toyota" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Año</label>
                                    <Input name="año" value={formData.año} onChange={handleChange} placeholder="2024" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Color</label>
                                    <Input name="color" value={formData.color} onChange={handleChange} placeholder="Blanco" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Capacidad Tanque</label>
                                    <Input name="capacidad_tanque" value={formData.capacidad_tanque} onChange={handleChange} placeholder="Liters" className="bg-zinc-50 dark:bg-zinc-800" />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Tipo de Vehículo</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Particular', 'Carga', 'Moto'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, tipo: type })}
                                                className={`h-10 rounded-xl font-medium border text-sm transition-all ${formData.tipo === type
                                                    ? 'bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 border-black dark:border-zinc-100'
                                                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 hover:dark:bg-zinc-700'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Departamento</label>
                                    <Select value={formData.department} onValueChange={(val) => setFormData({ ...formData, department: val })}>
                                        <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>
                                            {DEPARTMENTS.map((dept) => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 pl-1">Conductor Habitual</label>
                                    <Select value={formData.assigned_driver_id || "none"} onValueChange={(val) => setFormData({ ...formData, assigned_driver_id: val === "none" ? null : val })}>
                                        <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800"><SelectValue placeholder="Seleccionar Conductor" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none"><span className="text-zinc-400 italic">Sin conductor asignado</span></SelectItem>
                                            {drivers.map((driver) => (
                                                <SelectItem key={driver.id} value={driver.id}>
                                                    {driver.first_name} {driver.last_name} ({driver.cedula})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* MAINTENANCE CONFIGURATION */}
                        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Mantenimiento Preventivo</h3>
                                <Button type="button" variant="outline" size="sm" onClick={addConfig} className="gap-2 text-xs h-8 rounded-lg">
                                    <Plus size={14} /> Añadir Regla
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {maintenanceConfigs.map((config, index) => (
                                    <div key={index} className="flex flex-col gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/50">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-zinc-500">Servicio</Label>
                                                        <Select value={config.service_type} onValueChange={(val) => updateConfig(index, 'service_type', val)}>
                                                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {config.service_type === 'CUSTOM' && (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-zinc-500">Nombre Personalizado</Label>
                                                            <Input
                                                                className="h-9 text-xs"
                                                                value={config.custom_name || ''}
                                                                onChange={(e) => updateConfig(index, 'custom_name', e.target.value)}
                                                                placeholder="Ej. Revisión Extintor"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 items-end">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-zinc-500">Frecuencia (Cada...)</Label>
                                                        <div className="flex bg-white dark:bg-black rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-xs border-0 rounded-none focus-visible:ring-0 w-24"
                                                                value={config.interval_value}
                                                                onChange={(e) => updateConfig(index, 'interval_value', Number(e.target.value))}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateConfig(index, 'is_time_based', !config.is_time_based)}
                                                                className="bg-zinc-100 dark:bg-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border-l border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                                            >
                                                                {config.is_time_based ? 'Días' : 'Km'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeConfig(index)}
                                                className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors mt-5"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {maintenanceConfigs.length === 0 && (
                                    <div className="text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 dark:text-zinc-400 text-sm">
                                        No hay reglas de mantenimiento configuradas.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-black dark:bg-zinc-100 text-white dark:text-zinc-900 text-lg font-semibold rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all"
                            >
                                {loading ? "Guardando..." : (vehicleToEdit ? "Guardar Cambios" : "Crear Vehículo")}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
