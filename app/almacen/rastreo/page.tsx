"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { CardContent } from "@/components/ui/card"
import { Search, Loader2, ArrowRight, ArrowLeft, Package, User, RotateCcw, Truck, AlertTriangle, Calendar } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type TimelineEvent = {
    date: string
    type: 'IN' | 'OUT' | 'ADJUST' | 'ASSIGNMENT' | 'RETURN'
    description: string
    user?: string
    details?: string
    status?: string
    received_by?: string
    receiver_id?: string
    data?: any
}

export default function SerialTrackingPage() {
    const [serial, setSerial] = useState("")
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [events, setEvents] = useState<TimelineEvent[]>([])
    const [productName, setProductName] = useState("")

    const supabase = createClient()

    const [serialStatus, setSerialStatus] = useState<any>(null)
    const [activeAssignment, setActiveAssignment] = useState<any>(null)
    const [showHistory, setShowHistory] = useState(false)

    const handleSearch = async () => {
        if (!serial.trim()) return
        setLoading(true)
        setSearched(true)
        setEvents([])
        setSerialStatus(null)
        setActiveAssignment(null)
        setShowHistory(false)
        setProductName("")

        try {
            const searchTerm = serial.trim()

            // 0. Search Data Master (Current Status)
            const { data: masterData } = await supabase
                .from("inventory_serials")
                .select("*, inventory_products(name)")
                .eq("serial_number", searchTerm)
                .maybeSingle()

            if (masterData) {
                setSerialStatus(masterData)
                if (masterData.inventory_products?.name) setProductName(masterData.inventory_products.name)
            }

            // 1. Fetch History via RPC
            const { data: historyData, error: historyError } = await supabase
                .rpc('get_serial_history', { search_term: searchTerm })
                .order('created_at', { ascending: false })

            if (historyError) throw historyError

            // 2. Process Timeline
            const processedTimeline: TimelineEvent[] = (historyData || []).map((item: any) => {
                const det = item.details

                const common = {
                    date: item.created_at,
                    id: item.id
                }

                if (item.source_type === 'TRANSACTION') {
                    return {
                        ...common,
                        type: det.type, // IN, OUT, ADJUST
                        description: det.reason || (det.type === 'IN' ? 'Entrada / Compra' : 'Movimiento Stock'),
                        user: (det.user_first_name || det.user_last_name) ? `${det.user_first_name} ${det.user_last_name}` : 'Sistema',
                        details: `Stock: ${det.previous_stock} -> ${det.new_stock}`,
                        data: det // Keep raw data if needed
                    }
                } else if (item.source_type === 'ASSIGNMENT') {
                    // Format user name ensuring no "undefined"
                    const assignedName = (det.assigned_first_name || det.assigned_last_name)
                        ? `${det.assigned_first_name} ${det.assigned_last_name}`
                        : 'Sin asignar'

                    return {
                        ...common,
                        type: 'ASSIGNMENT',
                        description: `Asignado: ${det.code}`,
                        user: assignedName,
                        details: det.assigned_department || 'Personal',
                        status: det.status,
                        // Add receiver info
                        received_by: det.received_by,
                        receiver_id: det.receiver_id,
                        data: det
                    }
                } else { // RETURN
                    const returnUser = (det.user_first_name || det.user_last_name)
                        ? `${det.user_first_name} ${det.user_last_name}`
                        : 'Sistema'

                    return {
                        ...common,
                        type: 'RETURN',
                        description: `Devuelto (${det.condition === 'GOOD' ? 'Buen Estado' : det.condition === 'CONSUMED' ? 'Consumido/Instalado' : det.condition === 'MISSING' ? 'Pérdida/Extravío' : 'Dañado'})`,
                        user: returnUser,
                        details: det.notes,
                        data: det
                    }
                }
            }) as TimelineEvent[]

            // 3. Update Status Card (Active Assignment)
            if (masterData && masterData.status === 'ASSIGNED') {
                // Find the MOST RECENT assignment
                const latestAssign = processedTimeline.find(e => e.type === 'ASSIGNMENT')

                if (latestAssign && latestAssign.data) {
                    setActiveAssignment({
                        code: latestAssign.data.code,
                        created_at: latestAssign.date,
                        profiles: {
                            first_name: latestAssign.data.assigned_first_name,
                            last_name: latestAssign.data.assigned_last_name,
                            department: latestAssign.data.assigned_department
                        }
                    })
                }
            }

            setEvents(processedTimeline)

            if (!masterData && processedTimeline.length === 0) {
                toast.info("No se encontró historial ni registro activo para este serial.")
            }

        } catch (error) {
            console.error(error)
            toast.error("Error al buscar el serial")
        } finally {
            setLoading(false)
        }
    }

    return (
        <PremiumPageLayout 
            title="Rastreo de Seriales" 
            description="Busca la historia completa de un item específico"
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="space-y-8">

            <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                <div className="p-1 bg-muted border-b border-border"></div>
                <CardContent className="p-6">
                    <div className="flex gap-2 max-w-xl mx-auto">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Ingrese Número de Serie..."
                                className="pl-10 h-11 text-lg font-mono bg-background"
                                value={serial}
                                onChange={(e) => setSerial(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button size="lg" onClick={handleSearch} disabled={loading} className="h-11 px-8 gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : "Rastrear"}
                        </Button>
                    </div>
                    {/* Status Card Snippet */}
                    {serialStatus && (
                        <div
                            onClick={() => setShowHistory(!showHistory)}
                            className={`mt-8 p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border cursor-pointer hover:shadow-md transition-all
                            ${serialStatus.status === 'AVAILABLE' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                    serialStatus.status === 'ASSIGNED' ? 'bg-blue-500/10 border-blue-500/20' :
                                        'bg-muted/50 border-border'}
                        `}>
                            <div className="flex items-start gap-4">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0
                                    ${serialStatus.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-600' :
                                        serialStatus.status === 'ASSIGNED' ? 'bg-blue-500/20 text-blue-600' :
                                            'bg-muted text-muted-foreground'}
                                `}>
                                    <Package size={24} />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        {(() => {
                                            // Smart Status Logic
                                            let displayStatus = serialStatus.status
                                            let displayClass = 'bg-zinc-500'
                                            let displayText = serialStatus.status

                                            // Check latest history event for context if SOLD
                                            if (serialStatus.status === 'SOLD') {
                                                const lastEvent = events[0] // Events are ordered desc
                                                if (lastEvent) {
                                                    const desc = lastEvent.description.toUpperCase()
                                                    if (desc.includes('PERDIDA') || desc.includes('ROBO')) {
                                                        displayStatus = 'LOST'
                                                        displayClass = 'bg-red-500'
                                                        displayText = 'PÉRDIDA (CERRADO)'
                                                    } else if (desc.includes('BAJA') || desc.includes('DESCONTINUADO')) {
                                                        displayStatus = 'DISPOSED'
                                                        displayClass = 'bg-red-500'
                                                        displayText = 'BAJA / DESECHO'
                                                    } else if (desc.includes('CONSUMO') || desc.includes('INSTALADO')) {
                                                        displayStatus = 'CONSUMED'
                                                        displayClass = 'bg-blue-500'
                                                        displayText = 'CONSUMIDO / INSTALADO'
                                                    } else {
                                                        displayClass = 'bg-gray-500'
                                                        displayText = 'VENDIDO / SALIDA'
                                                    }
                                                } else {
                                                    displayText = 'VENDIDO / SALIDA'
                                                }
                                            } else if (serialStatus.status === 'AVAILABLE') {
                                                displayClass = 'bg-emerald-500'
                                                displayText = 'EN STOCK'
                                            } else if (serialStatus.status === 'ASSIGNED') {
                                                displayClass = 'bg-blue-500'
                                                displayText = 'EN USO'
                                            } else if (serialStatus.status === 'LOST') {
                                                displayClass = 'bg-red-500'
                                                displayText = 'PÉRDIDA (ACTIVA)'
                                            } else if (serialStatus.status === 'DAMAGED') {
                                                displayClass = 'bg-orange-500'
                                                displayText = 'DAÑADO'
                                            }

                                            return (
                                                <Badge className={`text-sm px-3 py-0.5 ${displayClass}`}>
                                                    {displayText}
                                                </Badge>
                                            )
                                        })()}
                                        <span className="text-muted-foreground text-sm">|</span>
                                        <span className="text-muted-foreground font-mono font-medium">{serialStatus.serial_number}</span>
                                    </div>

                                    <h3 className="text-xl font-bold text-foreground">{serialStatus.inventory_products?.name || "Producto desconocido"}</h3>

                                    {activeAssignment ? (
                                        <div className="mt-3 space-y-2 text-sm bg-background/60 p-3 rounded-lg border border-border min-w-[300px]">
                                            <div className="flex items-center gap-2 text-foreground">
                                                <User size={14} className="text-blue-500" />
                                                <span className="font-semibold">
                                                    {activeAssignment.profiles?.first_name} {activeAssignment.profiles?.last_name}
                                                </span>
                                                <span className="text-muted-foreground text-xs">({activeAssignment.profiles?.department || 'Técnico'})</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Truck size={14} className="text-blue-500" />
                                                <span>Despacho: <span className="font-mono text-foreground">{activeAssignment.code}</span></span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground text-xs pt-1 border-t border-border">
                                                <Calendar size={12} />
                                                {new Date(activeAssignment.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (serialStatus.status === 'ASSIGNED' && (
                                        <div className="mt-2 text-xs text-orange-500 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                                            Sin detalles de asignación disponibles.
                                        </div>
                                    ))}

                                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                        {showHistory ? "Ocultar historial" : "Click para ver historial completo"} <ArrowRight size={10} className={showHistory ? "-rotate-90 transition-transform" : "rotate-90 transition-transform"} />
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </PremiumCard>

            {(searched && (showHistory || !serialStatus)) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {!serialStatus && productName && (
                        <div className="flex items-center gap-2 text-xl font-semibold text-foreground px-2">
                            <Package className="text-blue-500" />
                            Producto: <span className="text-blue-600">{productName}</span>
                            <span className="text-xs text-muted-foreground font-normal ml-2">(Registro Histórico)</span>
                        </div>
                    )}

                    {events.length > 0 ? (
                        <div className="relative border-l-2 border-border ml-4 space-y-8 pb-4">
                            {events.map((event, index) => (
                                <div key={index} className="relative pl-8">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background shadow-sm
                                        ${event.type === 'IN' ? 'bg-green-500' :
                                            event.type === 'OUT' || event.type === 'ASSIGNMENT' ? 'bg-blue-500' :
                                                event.type === 'RETURN' ? 'bg-purple-500' : 'bg-muted-foreground'}
                                    `} />

                                    <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className={`font-mono text-xs
                                                            ${event.type === 'IN' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                                event.type === 'OUT' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                                    event.type === 'ASSIGNMENT' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                        event.type === 'RETURN' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                                                            'bg-muted text-foreground'}
                                                        `}>
                                                            {event.type === 'IN' ? 'ENTRADA' :
                                                                event.type === 'OUT' ? 'SALIDA' :
                                                                    event.type === 'ASSIGNMENT' ? 'DESPACHO' :
                                                                        event.type === 'RETURN' ? 'DEVOLUCIÓN' :
                                                                            event.type === 'ADJUST' ? 'AJUSTE' :
                                                                                event.type}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground font-medium">
                                                            {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-foreground">{event.description}</h3>
                                                </div>
                                                {event.status && (
                                                    <Badge variant="secondary" className={event.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}>
                                                        {event.status === 'ACTIVE' ? 'Activo' : event.status}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-muted/50 p-3 rounded-lg border border-border">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-background rounded-full border border-border text-muted-foreground">
                                                        <User size={16} />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Responsable</span>
                                                        <span className="text-sm font-medium text-foreground">{event.user}</span>
                                                    </div>
                                                </div>

                                                {event.details && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-background rounded-full border border-border text-muted-foreground">
                                                            <AlertTriangle size={16} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Detalles</span>
                                                            <span className="text-sm font-medium text-foreground">{event.details}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Receiver Info Display */}
                                                {(event.received_by || event.receiver_id) && (
                                                    <div className="col-span-1 sm:col-span-2 mt-2 pt-2 border-t border-border flex items-center gap-3">
                                                        <div className="p-2 bg-orange-500/10 rounded-full border border-orange-500/20 text-orange-500">
                                                            <Truck size={16} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-orange-500 uppercase font-bold tracking-wider">Recibido por (Tercero)</span>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-sm font-medium text-foreground">{event.received_by || "Desconocido"}</span>
                                                                {event.receiver_id && (
                                                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ID: {event.receiver_id}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </PremiumCard>
                                </div>
                            ))}
                        </div>
                    ) : (
                        !serialStatus && (
                            <div className="text-center py-12 bg-muted/50 rounded-2xl border border-dashed border-border">
                                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium text-foreground">Serial no encontrado</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                                    No hay registros de este número de serie en el sistema. Verifique que esté escrito correctamente.
                                </p>
                            </div>
                        )
                    )}
                </div>
            )}
            </div>
        </PremiumPageLayout>
    )
}
