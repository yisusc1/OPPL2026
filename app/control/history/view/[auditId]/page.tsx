"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuditDetails, updateAndApproveAudit } from "../../../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft, AlertOctagon, CheckCircle2, Box, Save, AlertTriangle, Disc, Wrench } from "lucide-react"

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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function AuditViewPage() {
    const params = useParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>({}) // Changed to string to handle empty state
    const [notes, setNotes] = useState("")
    // Map Serial -> Physical Value
    const [spoolPhysicals, setSpoolPhysicals] = useState<Record<string, string>>({})
    const [showConfirm, setShowConfirm] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const res = await getAuditDetails(params.auditId as string)
                setData(res)
                if (res.notes) setNotes(res.notes)

                // Initialize counts with empty string to force input, unless already saved?
                // For simplified UX, we default to "" so user MUST type 0 if it's 0.
                const initialCounts: any = {}
                res.items?.forEach((item: any) => {
                    if (item.physical_quantity !== undefined && item.physical_quantity !== null) {
                        initialCounts[item.id] = String(item.physical_quantity)
                    } else {
                        initialCounts[item.id] = ""
                    }
                })
                setPhysicalCounts(initialCounts)

                // Initialize Spools
                const initSpools: Record<string, string> = {}
                if (Array.isArray(res.spoolData)) {
                    res.spoolData.forEach((s: any) => {
                        // Assuming the join returns physical_quantity in s (if joined with auditItems) or s.physical_quantity
                        // If spoolData comes from 'inventory_audit_items' joined with serials, it should have it.
                        // Let's assume the backend 'getAuditDetails' maps it.
                        // If not, we might need to check how spoolData is constructed.
                        // Use check:
                        if (s.physical_quantity !== undefined && s.physical_quantity !== null) {
                            initSpools[s.serial_number] = String(s.physical_quantity)
                        } else {
                            initSpools[s.serial_number] = ""
                        }
                    })
                }
                setSpoolPhysicals(initSpools)

            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        if (params.auditId) load()
    }, [params.auditId])

    const handleCountChange = (itemId: string, value: string) => {
        // Validation: Block negatives
        if (value.includes("-")) return
        // Optional: Block non-numeric characters except empty

        setPhysicalCounts(prev => ({
            ...prev,
            [itemId]: value
        }))
    }

    const handleSpoolChange = (serial: string, value: string) => {
        if (value.includes("-")) return
        setSpoolPhysicals(prev => ({
            ...prev,
            [serial]: value
        }))
    }

    const validateAndPrompt = () => {
        // 1. Validate Items
        const missingItems = data.items.filter((item: any) => {
            // Skip spools in this check if they are filtered from physicalCounts logic? 
            // No, physicalCounts includes the items list. Spools are separate in spoolData.
            // We configured items list to Filter OUT "CARRETE" items in the UI loop, 
            // but we must ensure we don't block on them if they exist in `data.items`.
            if (item.product_sku && item.product_sku.includes("CARRETE")) return false // Skip spool items in main list validation

            const val = physicalCounts[item.id]
            return val === "" || val === undefined
        })

        if (missingItems.length > 0) {
            toast.error(`Faltan conteos físicos en ${missingItems.length} materiales.`)
            return
        }

        // 2. Validate Spools
        if (data.spoolData && data.spoolData.length > 0) {
            for (const s of data.spoolData) {
                const val = spoolPhysicals[s.serial_number]
                if (val === "" || val === undefined) {
                    toast.error(`Debes ingresar el conteo para la bobina ${s.serial_number}`)
                    return
                }
            }
        }

        setShowConfirm(true)
    }

    const performSave = async () => {
        try {
            setLoading(true)
            setShowConfirm(false)

            const itemsPayload = data.items.map((item: any) => ({
                id: item.id,
                physical_quantity: Number(physicalCounts[item.id] || 0)
            }))

            // Construct Spool Updates with Full Discrepancy Data
            const spoolUpdates = data.spoolData?.map((s: any) => ({
                serial: s.serial_number,
                physical: Number(spoolPhysicals[s.serial_number] || 0),
                theoretical: s.current_quantity,
                reported: s.reported_quantity
            }))

            await updateAndApproveAudit(params.auditId as string, itemsPayload, notes, spoolUpdates)

            toast.success("Auditoría finalizada correctamente")
            router.push("/control")
        } catch (e: any) {
            toast.error("Error: " + e.message)
            setLoading(false)
        }
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando detalles...</div>

    const isPending = data?.status === 'PENDING'

    // Helper for Spool Rendering
    const renderSpoolCard = (spool: any) => {
        const expected = spool.current_quantity - spool.reported_quantity
        const physical = spoolPhysicals[spool.serial_number] || ""
        const diff = physical !== "" ? (Number(physical) - expected) : 0

        return (
            <div key={spool.serial_number} className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/20 mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                        <Disc size={24} className="text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Control de Bobina</h3>
                        <p className="text-indigo-200 text-sm font-mono">Serial: {spool.serial_number}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-indigo-300 text-[10px] uppercase font-bold mb-1">Stock Inicial</p>
                        <p className="text-2xl font-bold">{spool.current_quantity}m</p>
                    </div>
                    <div>
                        <p className="text-indigo-300 text-[10px] uppercase font-bold mb-1">Consumo Reportado</p>
                        <p className="text-2xl font-bold text-amber-300">-{spool.reported_quantity}m</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2 border border-white/10">
                        <p className="text-indigo-300 text-[10px] uppercase font-bold mb-1">Esperado</p>
                        <p className="text-2xl font-bold">{expected}m</p>
                    </div>
                    <div>
                        <p className="text-indigo-300 text-[10px] uppercase font-bold mb-1">Físico (Real)</p>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min="0"
                                className="h-10 bg-white/10 border-white/20 text-white font-bold text-center text-lg placeholder:text-white/30"
                                placeholder="0"
                                value={physical}
                                onChange={(e) => handleSpoolChange(spool.serial_number, e.target.value)}
                                autoFocus={isPending}
                                disabled={!isPending}
                            />
                        </div>
                        {physical !== "" && (
                            <p className={`text-[10px] mt-1 font-bold ${diff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {diff < 0 ? `Merma: ${Math.abs(diff)}m` : `Sobra: ${diff}m`}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-32">

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="bg-white rounded-3xl shadow-2xl border-none max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-slate-900">
                            ¿Finalizar Auditoría?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500">
                            Esta acción procesará los ajustes de inventario y no podrá deshacerse. Asegúrate de que los conteos físicos sean correctos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
                        <AlertDialogCancel className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={performSave}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-6"
                        >
                            Confirmar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="max-w-3xl mx-auto mb-8">
                <Button onClick={() => router.back()} variant="ghost" className="mb-4 pl-0 hover:bg-transparent hover:text-blue-600">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Historial
                </Button>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900">
                            {isPending ? "Auditoría Pendiente" : "Detalle de Auditoría"}
                        </h1>
                        {isPending && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                                Acción Requerida
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm" suppressHydrationWarning>
                        Realizada el {data?.created_at ? new Date(data.created_at).toLocaleDateString() : '...'} a las {data?.created_at ? new Date(data.created_at).toLocaleTimeString() : '...'}
                    </p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">

                {/* SPOOLS LIST */}
                {Array.isArray(data?.spoolData) && data.spoolData.map(renderSpoolCard)}

                {/* INSTALLATIONS LOG (New) */}
                {data?.installations && data.installations.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-6">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Wrench size={20} className="text-blue-500" />
                                    Actividad del Día
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {data.installations.length} instalaciones registradas en el periodo
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Total Consumido (Hoy)</p>
                                <p className="text-lg font-bold text-slate-700">
                                    {data.installations.reduce((acc: number, curr: any) => acc + (Number(curr.metraje_usado) || 0) + (Number(curr.metraje_desechado) || 0), 0)}m
                                </p>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {data.installations.map((inst: any) => {
                                const used = Number(inst.metraje_usado) || 0
                                const wasted = Number(inst.metraje_desechado) || 0
                                const total = used + wasted
                                const isSupport = inst.type === 'SUPPORT'

                                return (
                                    <div key={inst.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs ${isSupport ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {isSupport ? <Wrench size={16} /> : (inst.tecnico_1 ? inst.tecnico_1.substring(0, 2).toUpperCase() : 'EQ')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">
                                                    {isSupport ? `Soporte: ${inst.causa || "General"}` : (inst.cliente?.nombre || inst.equipo || "Instalación")}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    {inst.cliente?.cedula && <span className="font-mono text-slate-400">{inst.cliente.cedula} •</span>}
                                                    <span>{new Date(inst.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{inst.codigo_carrete || "Sin carrete"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-bold text-slate-900 text-sm">
                                                {total}m
                                            </span>
                                            <div className="flex flex-col text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                                <span>Uso: {used}m</span>
                                                {wasted > 0 && <span className="text-red-400">Merma: {wasted}m</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ITEMS LIST (ACCORDION) */}
                <Accordion type="single" collapsible className="w-full space-y-4">
                    {(() => {
                        const items = data?.items?.filter((item: any) => !item.product_sku?.includes("CARRETE")) || []
                        const groups: Record<string, any[]> = {}

                        items.forEach((item: any) => {
                            const key = item.notes || "Cierre Inicial"
                            if (!groups[key]) groups[key] = []
                            groups[key].push(item)
                        })

                        const sortedGroups = Object.entries(groups).sort((a, b) => {
                            if (a[0] === "Cierre Inicial") return -1
                            if (b[0] === "Cierre Inicial") return 1
                            return a[0].localeCompare(b[0])
                        })

                        // Default Open Last Group by setting defaultValue on Accordion (Note: defaultValue is uncontrolled)
                        // To make it controlled or just set default, we rely on React key or just defaultValue.
                        // Since this rendering is conditional, defaultValue works fine on mount.

                        return sortedGroups.map(([groupName, groupItems]) => (
                            <AccordionItem key={groupName} value={groupName} className="bg-white rounded-3xl border-slate-200 px-6 shadow-sm data-[state=open]:ring-2 data-[state=open]:ring-blue-100 transition-all">
                                <AccordionTrigger className="hover:no-underline py-6">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-3 w-3 rounded-full ${groupName === 'Cierre Inicial' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                        <div className="text-left">
                                            <h2 className="font-bold text-lg text-slate-800">{groupName}</h2>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">{groupItems.length} ítems registrados</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-6 pt-2">
                                    <div className="grid gap-4">
                                        {groupItems.map((item: any, idx: number) => {
                                            const physicalKey = item.id
                                            const physicalValue = physicalCounts[physicalKey] || ""
                                            const diff = physicalValue !== "" ? Number(physicalValue) - item.theoretical_quantity : 0

                                            return (
                                                <div key={item.id} className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex flex-col md:flex-row items-center gap-4">
                                                    {/* INFO */}
                                                    <div className="flex items-center gap-3 flex-1 w-full">
                                                        <div className="h-10 w-10 rounded-xl bg-white text-slate-500 flex items-center justify-center shadow-sm">
                                                            <Box size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-sm text-slate-900">{item.product_name || item.item_name}</h3>
                                                            <p className="text-[10px] text-slate-400 font-mono">{item.product_sku || item.item_sku}</p>
                                                        </div>
                                                    </div>

                                                    {/* STATS & INPUT CONTAINER (Flex Row on Mobile) */}
                                                    <div className="flex items-center justify-between w-full md:w-auto gap-4 border-t md:border-t-0 pt-3 md:pt-0 mt-1 md:mt-0 md:pl-4 md:border-l border-slate-200">

                                                        {/* REPORTED */}
                                                        <div className="text-center">
                                                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Reportado</p>
                                                            <p className="font-medium text-slate-600 text-sm">{item.reported_quantity}</p>
                                                        </div>

                                                        {/* PHYSICAL INPUT */}
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Físico</p>
                                                                <input
                                                                    type="number"
                                                                    className="w-20 text-center font-bold text-base h-9 rounded-lg bg-white border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:outline-none shadow-sm"
                                                                    placeholder="0"
                                                                    value={physicalValue}
                                                                    onFocus={(e) => e.target.select()}
                                                                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                                    autoFocus={isPending && idx === 0 && groupName === "Cierre Inicial"}
                                                                    disabled={!isPending}
                                                                />
                                                            </div>

                                                            {/* STATUS ICON */}
                                                            <div className="w-[30px] flex justify-center">
                                                                {physicalValue !== "" && diff === 0 && (
                                                                    <div className="text-emerald-500 animate-in fade-in zoom-in duration-300">
                                                                        <CheckCircle2 size={20} />
                                                                    </div>
                                                                )}
                                                                {physicalValue !== "" && diff !== 0 && (
                                                                    <div className={`animate-in fade-in zoom-in duration-300 ${diff < 0 ? "text-red-500" : "text-amber-500"}`}>
                                                                        <AlertOctagon size={20} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))
                    })()}
                </Accordion>


                {/* NOTES */}
                <div className="mt-8 bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-slate-400" />
                        Observaciones
                    </h3>
                    {isPending ? (
                        <textarea
                            className="w-full min-h-[100px] p-4 rounded-xl bg-slate-50 border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                            placeholder="Notas finales de la auditoría..."
                            value={notes || ""}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    ) : (
                        <p className="text-sm text-slate-600 italic">
                            {data.notes || "Sin observaciones."}
                        </p>
                    )}
                </div>

                {/* VALIDATION ACTION (Responsive Footer) */}
                {isPending && (
                    <div className="fixed bottom-0 left-0 right-0 py-3 px-4 md:p-6 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
                            <div className="flex-1 hidden md:block">
                                <h4 className="font-bold text-slate-900 text-sm">Finalizar Revisión</h4>
                                <p className="text-xs text-slate-500">Se cerrará la auditoría actual.</p>
                            </div>
                            <Button
                                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 md:h-12 px-6 rounded-xl shadow-lg shadow-blue-500/20 text-sm"
                                onClick={validateAndPrompt}
                                disabled={loading}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Guardar y Finalizar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}
