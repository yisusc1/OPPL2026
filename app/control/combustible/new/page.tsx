"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Upload, Loader2, Save, ArrowLeft, Fuel, Car, Gauge, User, FileText, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { VehicleSelector } from "@/components/vehicle-selector"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Checkbox } from "@/components/ui/checkbox"

import { createFuelLog, getVehicles, getVehicleDetailsAction } from "../actions"
import Link from "next/link"

// Imports for Premium Style
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"
import { Suspense } from "react"

// Schema remains the same
const formSchema = z.object({
    ticket_number: z.string().min(1, "Número de ticket requerido"),
    fuel_date: z.date({
        required_error: "Fecha requerida",
    }),
    vehicle_id: z.string().min(1, "Seleccione un vehículo"),
    driver_name: z.string().min(1, "Nombre del conductor requerido"),
    liters: z.coerce.number().min(0.01, "Litros deben ser mayor a 0"),
    mileage: z.coerce.number().min(0, "Kilometraje requerido"),
    ticket_url: z.string().optional(),
    notes: z.string().optional(),
    forceCorrection: z.boolean().optional()
})

function NewFuelLogContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [vehicles, setVehicles] = useState<any[]>([])
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [vehiclesLoaded, setVehiclesLoaded] = useState(false)

    // [NEW] State for detailed scanned info
    const [scannedVehicle, setScannedVehicle] = useState<any>(null)

    // [NEW] States for Force Correction
    const [requiresCorrection, setRequiresCorrection] = useState(false)
    const [systemKmInfo, setSystemKmInfo] = useState<number | null>(null)

    const supabase = createClient()

    // 1. Load list of vehicles for manual selection fallback
    useEffect(() => {
        const loadInitialData = async () => {
            const data = await getVehicles()
            setVehicles(data)
            setVehiclesLoaded(true)
        }
        loadInitialData()
    }, [])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ticket_number: "",
            driver_name: "",
            liters: 0,
            mileage: 0,
            ticket_url: "",
            notes: "",
            forceCorrection: false
        },
    })

    // 2. Handle URL Params (SCAN MODE)
    useEffect(() => {
        const pVehicleId = searchParams.get('vehicleId')

        async function loadScannedDetails(id: string) {
            try {
                const details = await getVehicleDetailsAction(id)
                if (details) {
                    setScannedVehicle(details)
                    // Auto-fill form
                    form.setValue("vehicle_id", details.id)
                    form.setValue("mileage", 0) // Reset to 0 force user input

                    if (details.driver) {
                        const dName = `${details.driver.first_name} ${details.driver.last_name}`
                        form.setValue("driver_name", dName)
                    }
                }
            } catch (err) {
                console.error("Error loading scanned details", err)
            }
        }

        if (pVehicleId) {
            loadScannedDetails(pVehicleId)
        } else {
            // Optional: Handle pre-fill driver name if manual
            const pDriverName = searchParams.get('driverName')
            if (pDriverName) {
                form.setValue("driver_name", pDriverName)
            }
        }
    }, [searchParams, form])

    const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('fuel-receipts')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('fuel-receipts')
                .getPublicUrl(filePath)

            form.setValue("ticket_url", publicUrl)
            toast.success("Imagen cargada correctamente")
        } catch (error: any) {
            console.error(error)
            toast.error("Error subiendo imagen")
        } finally {
            setUploading(false)
        }
    }

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const res = await createFuelLog(values)
            if (res.success) {
                toast.success("Registro guardado correctamente")
                router.push("/control/combustible")
            } else {
                if (res.requiresCorrection) {
                    setRequiresCorrection(true)
                    setSystemKmInfo(res.currentSystemKm)
                    toast.error("Discrepancia de Kilometraje detectada.")
                } else {
                    toast.error("Error: " + res.error)
                }
            }
        } catch (error) {
            toast.error("Error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <PremiumPageLayout title="Nuevo Registro" description="Carga de combustible">
            <div className="max-w-3xl mx-auto space-y-6">
                <Link href="/control/combustible" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                    <ArrowLeft size={16} className="mr-2" />
                    Volver al Panel
                </Link>

                {/* SCAN SUMMARY CARD */}
                {scannedVehicle && (
                    <PremiumCard className="p-6 bg-blue-500/10 border-blue-500/20">
                        <div className="flex gap-4 items-start mb-4">
                            <div className="h-12 w-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
                                <Car size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground leading-tight">{scannedVehicle.modelo}</h2>
                                <p className="text-muted-foreground font-mono text-sm">{scannedVehicle.placa} • {scannedVehicle.codigo}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Conductor</p>
                                <p className="font-semibold text-foreground text-sm truncate">
                                    {scannedVehicle.driver ? `${scannedVehicle.driver.first_name} ${scannedVehicle.driver.last_name}` : 'Sin Asignar'}
                                </p>
                            </div>
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Km Actual</p>
                                <p className="font-semibold text-foreground text-sm">
                                    {scannedVehicle.kilometraje?.toLocaleString() || 0}
                                </p>
                            </div>
                        </div>

                        {scannedVehicle.last_fuel && (
                            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Última Carga</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-foreground font-semibold">{format(new Date(scannedVehicle.last_fuel.fuel_date), "dd/MM/yy HH:mm")}</span>
                                    <span className="text-muted-foreground">{scannedVehicle.last_fuel.liters}L</span>
                                </div>
                            </div>
                        )}
                    </PremiumCard>
                )}

                <PremiumCard className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            {/* Ticket Info Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="ticket_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-muted-foreground">N# Ticket</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <FileText className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                                    <Input placeholder="Ej. A-123456" className="pl-10 h-12 rounded-xl bg-white/5 border-white/10 text-foreground" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="fuel_date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-muted-foreground">Fecha y Hora</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full h-12 rounded-xl pl-3 text-left font-normal bg-white/5 border-white/10 text-foreground hover:bg-white/10 hover:text-white",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "dd/MM/yyyy HH:mm")
                                                            ) : (
                                                                <span>Seleccione fecha</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 border-white/10 bg-zinc-950" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                        className="bg-zinc-950 text-white"
                                                    />
                                                    <div className="p-3 border-t border-white/10">
                                                        <Input
                                                            type="time"
                                                            className="w-full bg-white/5 border-white/10 text-white"
                                                            onChange={(e) => {
                                                                const date = field.value || new Date()
                                                                const [hours, minutes] = e.target.value.split(':')
                                                                date.setHours(parseInt(hours))
                                                                date.setMinutes(parseInt(minutes))
                                                                field.onChange(date)
                                                            }}
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* CONDITIONAL RENDERING: Manual Select only if NOT scanned */}
                            {!scannedVehicle && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="vehicle_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormItem>
                                                    <VehicleSelector
                                                        vehicles={vehicles}
                                                        selectedVehicleId={field.value}
                                                        onSelect={(v) => {
                                                            field.onChange(v?.id)
                                                        }}
                                                        label="Vehículo"
                                                    />
                                                    <FormMessage />
                                                </FormItem>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="driver_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-muted-foreground">Conductor</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                                        <Input placeholder="Nombre del chofer" className="pl-10 h-12 rounded-xl bg-white/5 border-white/10 text-foreground" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            {/* Consumption Data */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="liters"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-muted-foreground">Litros</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Fuel className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                                    <Input type="number" step="0.01" className="pl-10 h-12 rounded-xl font-bold text-lg bg-white/5 border-white/10 text-foreground" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="mileage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-muted-foreground">Nuevo Kilometraje</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Gauge className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                                    <Input type="number" className="pl-10 h-12 rounded-xl font-bold text-lg bg-white/5 border-white/10 text-foreground" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Upload Receipt */}
                            <div className="space-y-2">
                                <FormLabel className="text-muted-foreground">Foto del Ticket / Recibo</FormLabel>
                                <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-white/5 transition-colors bg-white/5">
                                    {form.watch("ticket_url") ? (
                                        <div className="relative w-full max-w-xs aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-sm">
                                            <img src={form.getValues("ticket_url")} alt="Ticket" className="object-cover w-full h-full" />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="absolute top-2 right-2 rounded-full"
                                                onClick={() => form.setValue("ticket_url", "")}
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Upload size={28} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-base font-semibold text-foreground">Tomar Foto</p>
                                                <p className="text-sm text-muted-foreground">Ticket o Recibo</p>
                                            </div>
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={onUpload}
                                                disabled={uploading}
                                            />
                                        </>
                                    )}
                                    {uploading && <Loader2 className="animate-spin text-blue-500" />}
                                </div>
                            </div>

                            {/* [NEW] FORCE CORRECTION ALERT */}
                            {requiresCorrection && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-4 items-start">
                                    <div className="shrink-0 mt-0.5">
                                        <ShieldAlert className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-red-500 mb-1">¡Alerta de Kilometraje Inconsistente!</h4>
                                        <p className="text-sm text-red-200 mb-4">
                                            El kilometraje ingresado ({form.getValues('mileage')}) es menor al registrado en el sistema ({systemKmInfo}).
                                            ¿Deseas forzar la corrección y reescribir el historial a partir de este punto? (Requiere ser supervisor).
                                        </p>
                                        <FormField
                                            control={form.control}
                                            name="forceCorrection"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 text-white">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                            className="border-white/20 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-sm cursor-pointer hover:underline text-red-200 hover:text-red-100">
                                                        Sí, confirmo y deseo FORZAR la corrección del kilometraje de la FLOTA.
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <Button type="submit" size="lg" className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 text-white" disabled={loading || uploading}>
                                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-5 w-5" /> Guardar Registro</>}
                                </Button>
                            </div>

                        </form>
                    </Form>
                </PremiumCard>
            </div>
        </PremiumPageLayout>
    )
}

export default function NewFuelLogPage() {
    return (
        <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Cargando formulario...</div>}>
            <NewFuelLogContent />
        </Suspense>
    )
}
