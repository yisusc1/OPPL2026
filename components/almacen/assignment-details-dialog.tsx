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
import { Loader2 } from "lucide-react"

interface AssignmentDetailsDialogProps {
    code: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AssignmentDetailsDialog({ code, open, onOpenChange }: AssignmentDetailsDialogProps) {
    const [loading, setLoading] = useState(false)
    const [assignment, setAssignment] = useState<any>(null)
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
                    <DialogTitle>Detalle de Despacho: {code}</DialogTitle>
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
                        <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border">
                            <div>
                                <p className="text-sm font-semibold">Estado Actual</p>
                                <p className="text-xs text-zinc-500">{new Date(assignment.created_at).toLocaleString()}</p>
                            </div>
                            <Badge
                                variant="outline"
                                className={
                                    assignment.status === 'ACTIVE' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        assignment.status === 'RETURNED' ? "bg-green-50 text-green-700 border-green-200" :
                                            "bg-orange-50 text-orange-700 border-orange-200"
                                }
                            >
                                {assignment.status === 'ACTIVE' ? 'En Uso' : assignment.status === 'RETURNED' ? 'Devuelto' : 'Parcial'}
                            </Badge>
                        </div>

                        {/* Third Party Receiver Info */}
                        {(assignment.received_by || assignment.receiver_id) && (
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                <p className="text-xs font-semibold text-orange-800 mb-1">Entregado a Tercero / Conductor</p>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-orange-900 font-medium">{assignment.received_by || "Sin Nombre"}</span>
                                    <span className="text-orange-700 bg-orange-100 px-2 py-0.5 rounded text-xs">
                                        ID: {assignment.receiver_id || "N/A"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Despacho Original */}
                        <div>
                            <h4 className="text-sm font-medium border-b pb-2 mb-3 flex items-center justify-between">
                                <span>Materiales Entregados</span>
                            </h4>
                            <div className="grid gap-3">
                                {assignment.items.map((item: any) => (
                                    <div key={item.id} className="flex flex-col gap-1 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium text-sm">{item.product_name}</p>
                                            <span className="font-bold text-zinc-900">x{item.quantity}</span>
                                        </div>
                                        {item.serials && item.serials.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.serials.map((serial: string, idx: number) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs px-2 py-1 bg-white border-zinc-200 hover:bg-zinc-50">
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
                                <h4 className="text-sm font-medium border-b pb-2 mb-3 text-blue-700">Devoluciones Registradas</h4>
                                <div className="space-y-4">
                                    {assignment.returns.map((ret: any) => (
                                        <div key={ret.id} className="relative pl-4 border-l-2 border-blue-200">
                                            <div className="mb-2 flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-semibold text-blue-600">Devolución del {new Date(ret.created_at).toLocaleDateString()}</p>
                                                    {ret.notes && <p className="text-xs text-zinc-500 italic">"{ret.notes}"</p>}
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                {ret.items.map((ritem: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col gap-1 text-sm bg-blue-50/50 p-2 rounded">
                                                        <div className="flex justify-between items-center w-full">
                                                            <span>{ritem.product_name}</span>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="outline" className={`text-xs ${ritem.condition === 'GOOD' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                    ritem.condition === 'MISSING' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                        ritem.condition === 'CONSUMED' ? 'bg-zinc-100 text-zinc-700 border-zinc-200' :
                                                                            'bg-orange-50 text-orange-700 border-orange-200'
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
                                                                    <Badge key={sIdx} variant="secondary" className="text-xs px-2 py-1 bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200">
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
