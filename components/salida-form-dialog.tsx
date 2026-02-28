"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Car, CheckCircle, Send, X, Plus, Trash2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { VehicleSelector, Vehicle } from "@/components/vehicle-selector"
import { updateVehicleFuel } from "@/app/transporte/actions"
import type { ChecklistItem } from "@/components/vehicle-form-dialog"

// Use Vehicle type from component but extend if needed or just use it
// The local type had 'department', let's extend
interface Vehiculo extends Vehicle {
    department?: string
}

type SalidaFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    onSuccess?: () => void
}

export function SalidaFormDialog({ isOpen, onClose, initialVehicleId, onSuccess }: SalidaFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")

    // Form State
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [vehiculoId, setVehiculoId] = useState("")
    const [selectedVehicle, setSelectedVehicle] = useState<Vehiculo | null>(null)
    const [kmSalida, setKmSalida] = useState("")
    const [conductor, setConductor] = useState("")
    const [departamento, setDepartamento] = useState("")
    const [gasolina, setGasolina] = useState("Full")
    const [lastKm, setLastKm] = useState<number | null>(null)

    // Fault Reporting State
    const [faultsToAdd, setFaultsToAdd] = useState<string[]>([])
    const [newFaultText, setNewFaultText] = useState("")
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
    const [checks, setChecks] = useState<Record<string, boolean>>({})

    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            setStep('form') // Reset step on open
            loadVehicles().then((loadedVehicles) => {
                if (initialVehicleId && loadedVehicles) {
                    const found = loadedVehicles.find(v => v.id === initialVehicleId)
                    if (found) handleVehicleChange(found)
                }
            })
        }
    }, [isOpen, initialVehicleId])

    async function loadVehicles() {
        const supabase = createClient()

        // 1. Get User Profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data: profile } = await supabase
            .from('profiles')
            .select('department, roles, first_name, last_name') // [UPDATED] Fetch names
            .eq('id', user.id)
            .single()

        const userDept = profile?.department

        // [NEW] Auto-fill Conductor Name
        if (profile?.first_name || profile?.last_name) {
            const fullName = `${profile.first_name || ''} ${profile.last_name || ''} `.trim()
            setConductor(fullName)
        }

        // 2. Get Vehicles
        const { data: allVehicles } = await supabase.from('vehiculos').select('*').order('codigo')
        const { data: busyReports } = await supabase.from('reportes').select('vehiculo_id').is('km_entrada', null)
        const { data: kData } = await supabase.from('vista_ultimos_kilometrajes').select('*')

        const busyIds = new Set(busyReports?.map(r => r.vehiculo_id))

        // Check if user is Mechanic
        const isMechanic = Array.isArray(profile?.roles) && profile.roles.some((r: string) => r.toLowerCase() === 'mecánico' || r.toLowerCase() === 'mecanico')

        const available = allVehicles?.filter(v => {
            if (busyIds.has(v.id)) return false

            // [NEW] Mechanics see all vehicles
            if (isMechanic) return true

            // Filter by department if set
            if (v.department && userDept) {
                return v.department === userDept
            }

            if (!v.department) return true

            return false
        }).map(v => ({
            ...v,
            kilometraje: Math.max(
                kData?.find(k => k.vehiculo_id === v.id)?.ultimo_kilometraje || 0,
                v.kilometraje || 0
            )
        })) || []

        setVehiculos(available)

        // Auto-select department in form if user has one
        if (userDept) setDepartamento(userDept)

        return available
    }

    async function handleVehicleChange(selected: Vehicle | null) {
        if (!selected) {
            setVehiculoId("")
            setSelectedVehicle(null)
            setLastKm(null)
            setChecklistItems([])
            setChecks({})
            return
        }

        const value = selected.id
        setVehiculoId(value)
        // @ts-ignore
        setSelectedVehicle(selected)

        // @ts-ignore
        if (selected.department) {
            // @ts-ignore
            setDepartamento(selected.department)
        }

        // Load mileage from best source
        const supabase = createClient()
        const { data: viewKm } = await supabase
            .from('vista_ultimos_kilometrajes')
            .select('ultimo_kilometraje')
            .eq('vehiculo_id', value)
            .single()

        const { data: vehData } = await supabase
            .from('vehiculos')
            .select('kilometraje')
            .eq('id', value)
            .single()

        const viewValue = viewKm?.ultimo_kilometraje || 0
        const masterValue = vehData?.kilometraje || 0
        const bestKm = Math.max(viewValue, masterValue, selected.kilometraje || 0)
        setLastKm(bestKm)

        // Load checklist items for this vehicle
        const { data: items } = await supabase
            .from('vehicle_checklist_items')
            .select('*')
            .eq('vehicle_id', value)
            .order('sort_order')

        if (items && items.length > 0) {
            setChecklistItems(items)
            const initialChecks: Record<string, boolean> = {}
            items.forEach(i => { initialChecks[i.key] = false })
            setChecks(initialChecks)
        } else {
            setChecklistItems([])
            setChecks({})
        }
    }

    const toggleCheck = (key: string) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!vehiculoId || !kmSalida || !conductor || !departamento) {
            toast.error("Complete todos los campos obligatorios")
            return
        }

        const km = parseInt(kmSalida)
        if (lastKm !== null && km < lastKm) {
            toast.error(`El kilometraje no puede ser menor al anterior(${lastKm} km)`)
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()

            // [FIX] Ensure user_id is included so the dashboard can find the active trip
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("Sesión no válida")
                return
            }

            const { error } = await supabase
                .from('reportes')
                .insert({
                    user_id: user.id,
                    vehiculo_id: vehiculoId,
                    km_salida: km,
                    conductor,
                    departamento,
                    gasolina_salida: gasolina,

                    // Legacy boolean fields for backward compat
                    aceite_salida: checks.aceite || false,
                    agua_salida: checks.agua || false,
                    gato_salida: checks.gato || false,
                    cruz_salida: checks.cruz || false,
                    triangulo_salida: checks.triangulo || false,
                    caucho_salida: checks.caucho || false,
                    carpeta_salida: checks.carpeta || false,
                    casco_salida: checks.casco || false,
                    luces_salida: checks.luces || false,
                    herramientas_salida: checks.herramientas || false,
                    onu_salida: checks.onu ? 1 : 0,
                    ups_salida: checks.ups ? 1 : 0,
                    escalera_salida: checks.escalera || false,

                    // Dynamic checklist data
                    checklist_data: JSON.stringify({
                        type: 'salida',
                        items: checklistItems.map(item => ({
                            key: item.key,
                            label: item.label,
                            category: item.category,
                            checked: checks[item.key] || false
                        }))
                    }),

                    created_at: new Date().toISOString()
                })

            if (error) throw error

            // Insert explicit faults into fallas table
            if (faultsToAdd.length > 0) {
                const faultsInsert = faultsToAdd.map(desc => ({
                    vehiculo_id: vehiculoId,
                    descripcion: `[Reporte Salida] ${desc} `,
                    tipo_falla: 'Mecánica',
                    prioridad: 'Media',
                    estado: 'Pendiente',
                    created_at: new Date().toISOString()
                }))
                await supabase.from('fallas').insert(faultsInsert)
            }

            // Update Vehicle Fuel Level AND Mileage
            await updateVehicleFuel(vehiculoId, gasolina, km)

            toast.success("Salida registrada correctamente")

            // WhatsApp Integration
            const text = formatSalidaText()

            setWhatsappText(text)
            setStep('success')
            router.refresh()
            if (onSuccess) onSuccess() // [NEW] Trigger refresh in parent
            // ----------------------------

            // Reset
            setVehiculoId("")
            setSelectedVehicle(null)
            setKmSalida("")
            setConductor("")
            setDepartamento("")
            setGasolina("Full")
            setLastKm(null)
            setChecklistItems([])
            setChecks({})
            setFaultsToAdd([])
            setNewFaultText("")

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar salida")
        } finally {
            setLoading(false)
        }
    }

    // Dynamic WhatsApp text generator
    const formatSalidaText = () => {
        const check = (val: boolean) => val ? '✅' : '❌'
        const vehiculoNombre = selectedVehicle ? selectedVehicle.modelo : 'Desconocido'
        const fecha = new Date().toLocaleDateString()
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        let msg = `*Reporte de Salida*\n\n`
        msg += `Fecha: ${fecha}\n`
        msg += `Hora: ${hora}\n\n`
        msg += `Conductor: ${conductor}\n`
        msg += `Departamento: ${departamento}\n\n`
        msg += `Vehículo: ${vehiculoNombre}\n`
        if (selectedVehicle?.placa) msg += `Placa: ${selectedVehicle.placa}\n`
        msg += `Kilometraje (Salida): ${kmSalida}\n`
        msg += `Nivel de Gasolina: ${gasolina}\n\n`

        // Group items by category
        const categories = ['TECNICO', 'SEGURIDAD', 'EQUIPOS']
        const categoryLabels: Record<string, string> = {
            TECNICO: 'Chequeo Técnico',
            SEGURIDAD: 'Seguridad y Herramientas',
            EQUIPOS: 'Equipos Asignados'
        }

        categories.forEach(cat => {
            const catItems = checklistItems.filter(i => i.category === cat)
            if (catItems.length > 0) {
                msg += `*${categoryLabels[cat]}:*\n`
                catItems.forEach(item => {
                    msg += `${item.label}: ${check(checks[item.key] || false)}\n`
                })
                msg += `\n`
            }
        })

        if (faultsToAdd.length > 0) {
            msg += `*Fallas Reportadas:*\n`
            faultsToAdd.forEach(f => msg += `\u274C ${f}\n`)
            msg += `\n`
        }

        return msg
    }

    // Group checklist items by category for rendering
    const groupedItems = checklistItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
    }, {} as Record<string, ChecklistItem[]>)

    const categoryLabelsMap: Record<string, string> = {
        TECNICO: 'Chequeo Técnico',
        SEGURIDAD: 'Seguridad y Herramientas',
        EQUIPOS: 'Equipos Asignados'
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            // Prevent closing if in success step unless explicitly closed by button
            if (!open && step === 'success') return
            onClose()
        }}>
            <DialogContent
                onInteractOutside={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                onEscapeKeyDown={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                className="sm:max-w-xl rounded-[32px] border-none shadow-2xl max-h-[90vh] flex flex-col p-0 focus:outline-none bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-foreground"
            >

                {step === 'success' ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 bg-white dark:bg-zinc-900 h-full min-h-[400px]">
                        <div className="h-20 w-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-500 animate-in zoom-in spin-in-3">
                            <CheckCircle size={40} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Salida Registrada!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">El vehículo ha sido despachado correctamente.</p>
                        </div>

                        <div className="w-full space-y-3 pt-4">
                            <Button
                                onClick={() => window.location.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                                className="w-full h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                            >
                                <Send size={24} className="mr-2" />
                                Reportar en WhatsApp
                            </Button >
                            <Button onClick={onClose} variant="ghost" className="w-full text-slate-400 dark:text-slate-500">
                                Cerrar y Volver
                            </Button>
                        </div >
                    </div >
                ) : (
                    <>
                        <DialogHeader className="bg-white dark:bg-zinc-900 p-6 pb-4 border-b border-zinc-100 dark:border-white/5">
                            <DialogTitle className="text-2xl font-bold text-center text-zinc-900 dark:text-white">Registrar Salida</DialogTitle>
                            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">Complete el formulario de pre-operación</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <VehicleSelector
                                        vehicles={vehiculos}
                                        selectedVehicleId={vehiculoId}
                                        onSelect={handleVehicleChange}
                                        label="Vehículo Disponible"
                                    />
                                    {lastKm !== null && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-right">Anterior: {lastKm.toLocaleString()} km</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Kilometraje Actual</Label>
                                    <Input
                                        type="number"
                                        value={kmSalida}
                                        onChange={e => setKmSalida(e.target.value)}
                                        className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                                        placeholder={lastKm ? `> ${lastKm}` : "0"}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Nivel de Gasolina</Label>
                                    <Select value={gasolina} onValueChange={setGasolina}>
                                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Full">Full</SelectItem>
                                            <SelectItem value="3/4">3/4</SelectItem>
                                            <SelectItem value="1/2">1/2</SelectItem>
                                            <SelectItem value="1/4">1/4</SelectItem>
                                            <SelectItem value="Reserva">Reserva</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Conductor (Auto-asignado)</Label>
                                    <Input
                                        value={conductor}
                                        readOnly
                                        className="h-12 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/5 cursor-not-allowed focus-visible:ring-0"
                                        placeholder="Cargando identidad..."
                                    />
                                </div>

                                <div className="space-y-2 col-span-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Departamento/Uso</Label>
                                    <Select value={departamento} onValueChange={setDepartamento}>
                                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                            <SelectValue placeholder="Seleccione el destino" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Instalación">Instalación</SelectItem>
                                            <SelectItem value="Afectaciones">Afectaciones</SelectItem>
                                            <SelectItem value="Distribución">Distribución</SelectItem>
                                            <SelectItem value="Comercialización">Comercialización</SelectItem>
                                            <SelectItem value="Transporte">Transporte</SelectItem>
                                            <SelectItem value="Operaciones">Operaciones</SelectItem>
                                            <SelectItem value="Administración">Administración</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Dynamic Checks section */}
                            {checklistItems.length > 0 && (
                                <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-100 dark:border-white/5 shadow-sm space-y-6">
                                    {['TECNICO', 'SEGURIDAD', 'EQUIPOS'].map(cat => {
                                        const items = groupedItems[cat]
                                        if (!items || items.length === 0) return null
                                        return (
                                            <div key={cat}>
                                                <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    {categoryLabelsMap[cat]}
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {items.map(item => (
                                                        <div key={item.key} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                            <Label htmlFor={item.key} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">{item.label}</Label>
                                                            <Switch id={item.key} checked={checks[item.key] || false} onCheckedChange={() => toggleCheck(item.key)} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Explicit Fault Reporting Section */}
                            <div className="bg-zinc-50/50 dark:bg-white/[0.02] p-5 rounded-[24px] border border-zinc-100 dark:border-white/5 space-y-4">
                                <h4 className="text-sm font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    Reportar Fallas
                                </h4>

                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newFaultText}
                                            onChange={(e) => setNewFaultText(e.target.value)}
                                            placeholder="Ej: Luz de freno quemada..."
                                            className="bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus-visible:ring-zinc-400"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    if (newFaultText.trim()) {
                                                        setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                                        setNewFaultText("")
                                                    }
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                if (newFaultText.trim()) {
                                                    setFaultsToAdd([...faultsToAdd, newFaultText.trim()])
                                                    setNewFaultText("")
                                                }
                                            }}
                                            className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black rounded-xl aspect-square p-0 w-12 shrink-0"
                                        >
                                            <Plus size={20} />
                                        </Button>
                                    </div>

                                    {faultsToAdd.length > 0 && (
                                        <div className="space-y-2">
                                            {faultsToAdd.map((fault, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-white/5 p-3 rounded-xl border border-zinc-100 dark:border-white/10 shadow-sm animate-in slide-in-from-top-1">
                                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{fault}</span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => setFaultsToAdd(prev => prev.filter((_, i) => i !== idx))}
                                                        className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="bg-white dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-white/5 flex-col sm:flex-col gap-2">
                            <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-lg shadow-lg shadow-black/10">
                                {loading ? "Registrando..." : "Confirmar Salida"}
                            </Button>
                            <Button variant="ghost" onClick={onClose} className="w-full rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5">
                                Cancelar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent >
        </Dialog >
    )
}
