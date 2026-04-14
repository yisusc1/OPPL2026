"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

interface AssignmentDetailsDialogProps {
    code: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AssignmentDetailsDialog({ code, open, onOpenChange }: AssignmentDetailsDialogProps) {
    const [loading, setLoading] = useState(false)
    const [assignment, setAssignment] = useState<any>(null)
    const [copied, setCopied] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (open && code) {
            loadAssignment(code)
        } else {
            setAssignment(null)
        }
    }, [open, code])

    const loadAssignment = async (code: string) => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from("inventory_assignments")
                .select(`
                    *,
                    inventory_assignment_items (
                        id,
                        quantity,
                        serials,
                        inventory_products (name)
                    ),
                    returns:inventory_returns (
                        id,
                        created_at,
                        notes,
                        items:inventory_return_items (
                            id,
                            quantity,
                            condition,
                            serials, 
                            product:inventory_products (name)
                        )
                    )
                `)
                .eq("code", code)
                .maybeSingle()

            if (error) throw error

            if (data) {
                // Manually fetch the assignee profile to avoid PostgREST foreign key errors
                if (data.assigned_to) {
                    const { data: profData } = await supabase
                        .from("profiles")
                        .select("first_name, last_name, department, job_title")
                        .eq("id", data.assigned_to)
                        .maybeSingle()
                    
                    if (profData) {
                        data.assignee = profData
                    }
                }

                // Map items to match expected format
                const mappedItems = data.inventory_assignment_items.map((i: any) => ({
                    ...i,
                    product_name: i.inventory_products?.name,
                    serials: typeof i.serials === 'string' ? JSON.parse(i.serials) : (i.serials || [])
                }))

                // Map returns to match expected format
                const mappedReturns = (data.returns || []).map((r: any) => ({
                    ...r,
                    items: r.items.map((ri: any) => ({
                        ...ri,
                        product_name: ri.product?.name,
                        serials: typeof ri.serials === 'string' ? JSON.parse(ri.serials) : (ri.serials || [])
                    }))
                }))

                setAssignment({
                    ...data,
                    items: mappedItems,
                    returns: mappedReturns
                })
            }
        } catch (error) {
            console.error("Error loading assignment:", error)
        } finally {
            setLoading(false)
        }
    }

    if (!code) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Detalle de Despacho: {code}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => {
                                if (code) {
                                    navigator.clipboard.writeText(code)
                                    setCopied(true)
                                    toast.success("Código copiado")
                                    setTimeout(() => setCopied(false), 2000)
                                }
                            }}
                        >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        Historial completo de asignación y retornos.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                    </div>
                ) : assignment ? (
                    <div className="mt-4 space-y-6">
                        {/* Header Info */}
                        <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border dark:border-zinc-800">
                            <div>
                                <p className="text-sm font-semibold">Estado Actual</p>
                                <p className="text-xs text-zinc-500 dark:text-muted-foreground">{new Date(assignment.created_at).toLocaleString()}</p>
                            </div>
                            <Badge
                                variant="outline"
                                className={
                                    assignment.status === 'ACTIVE' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50" :
                                        assignment.status === 'RETURNED' ? "bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 border-green-200 dark:border-emerald-800/50" :
                                            "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50"
                                }
                            >
                                {assignment.status === 'ACTIVE' ? 'En Uso' : assignment.status === 'RETURNED' ? 'Devuelto' : 'Parcial'}
                            </Badge>
                        </div>

                        {/* Third Party Receiver Info */}
                        {(assignment.received_by || assignment.receiver_id) && (
                            <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg border border-orange-100 dark:border-orange-900/50">
                                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-1">Entregado a Tercero / Conductor</p>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-orange-900 dark:text-orange-200 font-medium">{assignment.received_by || "Sin Nombre"}</span>
                                    <span className="text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded text-xs">
                                        ID: {assignment.receiver_id || "N/A"}
                                    </span>
                                </div>
                            </div>
                        )}
                        
                        {/* Assignee Info (Internal Technician) */}
                        {assignment.assignee && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">Asignado a (Equipo / Técnico Interno)</p>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-blue-900 dark:text-blue-200 font-medium">{assignment.assignee.first_name} {assignment.assignee.last_name}</span>
                                    {assignment.assignee.department && (
                                        <span className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded text-xs font-medium border border-blue-200 dark:border-blue-800/50">
                                            {assignment.assignee.department}
                                        </span>
                                    )}
                                </div>
                                {assignment.assignee.job_title && (
                                    <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">{assignment.assignee.job_title}</p>
                                )}
                            </div>
                        )}

                        {/* Despacho Original */}
                        <div>
                            <h4 className="text-sm font-medium border-b pb-2 mb-3 flex items-center justify-between">
                                <span>Materiales Entregados</span>
                            </h4>
                            <div className="grid gap-3">
                                {assignment.items.map((item: any) => (
                                    <div key={item.id} className="flex flex-col gap-1 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium text-sm">{item.product_name}</p>
                                            <span className="font-bold text-foreground">x{item.quantity}</span>
                                        </div>
                                        {item.serials && item.serials.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.serials.map((serial: string, idx: number) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs px-2 py-1 bg-background dark:border-zinc-800 hover:bg-muted">
                                                        {serial}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Devoluciones */}
                        {(assignment.returns && assignment.returns.length > 0) && (
                            <div>
                                <h4 className="text-sm font-medium border-b dark:border-zinc-800 pb-2 mb-3 text-blue-700 dark:text-blue-400">Devoluciones Registradas</h4>
                                <div className="space-y-4">
                                    {assignment.returns.map((ret: any) => (
                                        <div key={ret.id} className="relative pl-4 border-l-2 border-blue-200 dark:border-blue-800/50">
                                            <div className="mb-2 flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Devolución del {new Date(ret.created_at).toLocaleDateString()}</p>
                                                    {ret.notes && <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">"{ret.notes}"</p>}
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                {ret.items.map((ritem: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col gap-1 text-sm bg-blue-50/50 dark:bg-blue-950/30 p-2 rounded">
                                                        <div className="flex justify-between items-center w-full">
                                                            <span>{ritem.product_name}</span>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className={`text-xs ${ritem.condition === 'GOOD' ? 'bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 border-green-200 dark:border-emerald-800/50' :
                                                                    ritem.condition === 'MISSING' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' :
                                                                        ritem.condition === 'CONSUMED' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' :
                                                                            'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50'
                                                                    }`}>
                                                                    {ritem.condition === 'GOOD' ? 'Buen Estado' :
                                                                        ritem.condition === 'CONSUMED' ? 'Consumido/Instalado' :
                                                                            ritem.condition === 'MISSING' ? 'Pérdida/Extravío' : 'Dañado'}
                                                                </Badge>
                                                                <span className="font-bold">x{ritem.quantity}</span>
                                                            </div>
                                                        </div>
                                                        {ritem.serials && ritem.serials.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {ritem.serials.map((serial: string, sIdx: number) => (
                                                                    <Badge key={sIdx} variant="secondary" className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800/50">
                                                                        {serial}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        No se encontró información para el código {code}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
