"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Send, Plus, Trash2, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { VehicleSelector, Vehicle } from "@/components/vehicle-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { revalidateGerencia } from "@/app/transporte/actions"
import type { ChecklistItem } from "@/components/vehicle-form-dialog"

type Reporte = {
    id: string
    vehiculo_id: string
    km_salida: number
    conductor: string
    departamento: string
    created_at: string
    vehiculos: {
        modelo: string
        placa: string
        codigo: string
        tipo: string
        odometro_averiado?: boolean
    }
}

type EntradaFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    onSuccess?: () => void
}

export function EntradaFormDialog({ isOpen, onClose, initialVehicleId, onSuccess }: EntradaFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [reporteId, setReporteId] = useState("")
    const [kmEntrada, setKmEntrada] = useState("")
    const [selectedReport, setSelectedReport] = useState<Reporte | null>(null)
    const [gasolina, setGasolina] = useState("Full")
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")
    const router = useRouter()
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
    const [checks, setChecks] = useState<Record<string, boolean>>({})

    // Fault Reporting State
    const [faultsToAdd, setFaultsToAdd] = useState<string[]>([])
    const [newFaultText, setNewFaultText] = useState("")

    useEffect(() => {
        if (isOpen) {
            setStep('form')
            loadPendingReports().then((data) => {
                if (initialVehicleId && data) {
                    const matchingReport = data.find((r: any) => r.vehiculo_id === initialVehicleId)
                    if (matchingReport) {
                        setReporteId(matchingReport.id)
                        setSelectedReport(matchingReport as unknown as Reporte)
                        // Load checklist items for this vehicle
                        loadChecklistForVehicle(matchingReport.vehiculo_id)
                    }
                }
            })
        }
    }, [isOpen, initialVehicleId])

    async function loadChecklistForVehicle(vehicleId: string) {
        const supabase = createClient()
        const { data: items } = await supabase
            .from('vehicle_checklist_items')
            .select('*')
            .eq('vehicle_id', vehicleId)
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

    async function loadPendingReports() {
        const supabase = createClient()
        const { data } = await supabase
            .from('reportes')
            .select(`
                id, 
                vehiculo_id,
                km_salida, 
                conductor,
                departamento,
                created_at,
                vehiculos ( modelo, placa, codigo, tipo, department, odometro_averiado )
            `)
            .is('km_entrada', null)
            .order('created_at', { ascending: false })

        // @ts-ignore
        if (data) setReportes(data)
        return data
    }

    function handleReportChange(value: string) {
        setReporteId(value)
        const report = reportes.find(r => r.id === value) || null
        setSelectedReport(report)
        if (report) {
            loadChecklistForVehicle(report.vehiculo_id)
        } else {
            setChecklistItems([])
            setChecks({})
        }
    }

    const toggleCheck = (key: string) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!reporteId || !kmEntrada) {
            toast.error("Complete todos los campos obligatorios")
            return
        }

        const km = parseInt(kmEntrada)
        // @ts-ignore
        const veh = selectedReport?.vehiculos
        const isBrokenOdometer = (Array.isArray(veh) ? veh[0] : veh)?.odometro_averiado || false

        if (!isBrokenOdometer && selectedReport && km <= selectedReport.km_salida) {
            toast.error(`Error: El KM de entrada (${km}) debe ser mayor al de salida (${selectedReport.km_salida})`)
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('reportes')
                .update({
                    km_entrada: km,
                    gasolina_entrada: gasolina,

                    // Legacy boolean fields
                    aceite_entrada: checks.aceite || false,
                    agua_entrada: checks.agua || false,
                    gato_entrada: checks.gato || false,
                    cruz_entrada: checks.cruz || false,
                    triangulo_entrada: checks.triangulo || false,
                    caucho_entrada: checks.caucho || false,
                    carpeta_entrada: checks.carpeta || false,
                    casco_entrada: checks.casco || false,
                    luces_entrada: checks.luces || false,
                    herramientas_entrada: checks.herramientas || false,
                    onu_entrada: checks.onu ? 1 : 0,
                    ups_entrada: checks.ups ? 1 : 0,
                    escalera_entrada: checks.escalera || false,

                    // Dynamic checklist data
                    checklist_data: JSON.stringify({
                        type: 'entrada',
                        items: checklistItems.map(item => ({
                            key: item.key,
                            label: item.label,
                            category: item.category,
                            checked: checks[item.key] || false
                        }))
                    }),
                })
                .eq('id', reporteId)

            if (error) throw error

            // [NEW] Update Vehicle Fuel Level
            const fuelMap: Record<string, number> = {
                "Full": 100,
                "3/4": 75,
                "1/2": 50,
                "1/4": 25,
                "Reserva": 10
            }
            const fuelLevel = fuelMap[gasolina] || 0

            // We update the vehicle directly
            if (selectedReport?.vehiculo_id) {
                await supabase.from('vehiculos').update({
                    current_fuel_level: fuelLevel,
                    kilometraje: km,
                    last_fuel_update: new Date().toISOString()
                }).eq('id', selectedReport.vehiculo_id)
            }

            // Force Dashboard Refresh
            await revalidateGerencia()

            // Insert explicit faults into fallas table
            if (faultsToAdd.length > 0 && selectedReport?.vehiculo_id) {
                const faultsInsert = faultsToAdd.map(desc => ({
                    vehiculo_id: selectedReport.vehiculo_id,
                    descripcion: `[Reporte Entrada] ${desc}`,
                    tipo_falla: 'Mecánica',
                    prioridad: 'Media',
                    estado: 'Pendiente',
                    created_at: new Date().toISOString()
                }))
                await supabase.from('fallas').insert(faultsInsert)
            }

            toast.success("Entrada registrada correctamente")

            // WhatsApp Integration
            if (selectedReport) {
                const text = formatEntradaText(km)
                setWhatsappText(text)
                setStep('success')
            }
            // ----------------------------

            router.refresh()
            // onClose()
            if (onSuccess) onSuccess() // [NEW] Trigger refresh in parent

            // Reset form
            setReporteId("")
            setKmEntrada("")
            setSelectedReport(null)
            setGasolina("Full")
            setChecklistItems([])
            setChecks({})
            setFaultsToAdd([])
            setNewFaultText("")

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar entrada")
        } finally {
            setLoading(false)
        }
    }

    // Dynamic WhatsApp text generator
    const formatEntradaText = (kmEntradaVal: number) => {
        const check = (val: boolean) => val ? '✅' : '❌'

        if (!selectedReport) return ''

        const fechaSalidaObj = new Date(selectedReport.created_at)
        const fechaEntradaObj = new Date()
        const fechaEntrada = fechaEntradaObj.toLocaleDateString()
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        // @ts-ignore
        const vData = selectedReport.vehiculos
        const vehiculo = Array.isArray(vData) ? vData[0] : vData
        const vehiculoNombre = vehiculo ? vehiculo.modelo : 'Desconocido'
        const kmRecorrido = kmEntradaVal - Number(selectedReport.km_salida)

        let msg = `*Reporte de Entrada*\n\n`
        msg += `Fecha (Entrada): ${fechaEntrada}\n`
        msg += `Hora (Salida): ${horaSalida}\n`
        msg += `Hora (Entrada): ${horaEntrada}\n\n`
        msg += `Conductor: ${selectedReport.conductor}\n`
        msg += `Departamento: ${selectedReport.departamento}\n\n`
        msg += `Vehículo: ${vehiculoNombre}\n`
        if (vehiculo?.placa) msg += `Placa: ${vehiculo.placa}\n`
        msg += `Kilometraje (Salida): ${selectedReport.km_salida}\n`
        msg += `Kilometraje (Entrada): ${kmEntradaVal}\n`
        msg += `Kilometraje Recorrido: ${kmRecorrido}\n`
        msg += `Nivel de Gasolina: ${gasolina}\n\n`

        const categories = ['TECNICO', 'SEGURIDAD', 'EQUIPOS']
        const categoryLabels: Record<string, string> = {
            TECNICO: 'Chequeo Técnico',
            SEGURIDAD: 'Herramientas',
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
            faultsToAdd.forEach(f => msg += `- ${f}\n`)
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
        TECNICO: 'Chequeo Técnico (Llegada)',
        SEGURIDAD: 'Herramientas (Verificar devolución)',
        EQUIPOS: 'Equipos Asignados'
    }


    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
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
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Entrada Registrada!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">El vehículo ha sido recibido correctamente.</p>
                        </div>

                        <div className="w-full space-y-3 pt-4">
                            <Button
                                onClick={() => window.location.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                                className="w-full h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                            >
                                <Send size={24} className="mr-2" />
                                <span className="text-white">Reportar en WhatsApp</span>
                            </Button>
                            <Button onClick={onClose} variant="ghost" className="w-full text-slate-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-white/5">
                                Cerrar y Volver
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="bg-white dark:bg-zinc-900 p-6 pb-4 border-b border-zinc-100 dark:border-white/5">
                            <DialogTitle className="text-2xl font-bold text-center text-zinc-900 dark:text-white">Registrar Entrada</DialogTitle>
                            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">Cierre de ruta y novedades</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <VehicleSelector
                                        vehicles={reportes.map(r => ({
                                            id: r.vehiculo_id,
                                            placa: r.vehiculos.placa,
                                            modelo: r.vehiculos.modelo,
                                            codigo: r.vehiculos.codigo,
                                            tipo: r.vehiculos.tipo,
                                        }))}
                                        selectedVehicleId={selectedReport?.vehiculo_id}
                                        onSelect={(v) => {
                                            if (v) {
                                                const r = reportes.find(rep => rep.vehiculo_id === v.id)
                                                if (r) handleReportChange(r.id)
                                            } else {
                                                setReporteId("")
                                                setSelectedReport(null)
                                            }
                                        }}
                                        label="Vehículo en Ruta"
                                    />
                                    {selectedReport && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
                                            Conductor: {selectedReport.conductor} • Salida: {selectedReport.km_salida.toLocaleString()} km
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Kilometraje Llegada</Label>
                                    <Input
                                        type="number"
                                        value={kmEntrada}
                                        onChange={e => setKmEntrada(e.target.value)}
                                        className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                                        placeholder={selectedReport ? `> ${selectedReport.km_salida}` : "0"}
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
                                                            <Label htmlFor={`e_${item.key}`} className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">{item.label}</Label>
                                                            <Switch id={`e_${item.key}`} checked={checks[item.key] || false} onCheckedChange={() => toggleCheck(item.key)} />
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
                                {loading ? "Registrando..." : "Confirmar Entrada"}
                            </Button>
                            <Button variant="ghost" onClick={onClose} className="w-full rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5">
                                Cancelar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
