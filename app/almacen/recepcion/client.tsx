"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PremiumCard } from "@/components/ui/premium-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Info, Box, AlertTriangle, ShieldCheck, Copy } from "lucide-react"
import { closeAssignmentWithMovement } from "../actions"

export function RecepcionClient({ assignment }: { assignment: any }) {
    const [loading, setLoading] = useState(false)
    const [counts, setCounts] = useState<Record<string, number>>({})

    const handleCountChange = (productId: string, val: string) => {
        const num = parseInt(val, 10)
        setCounts(prev => ({
            ...prev,
            [productId]: isNaN(num) ? 0 : num
        }))
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const returnItems = assignment.items.map((item: any) => {
                const qty = counts[item.product_id] || 0
                return {
                    productId: item.product_id,
                    quantity: qty,
                    condition: 'GOOD', // Assuming returned to stock. Unsalvageable is handled differently if needed
                    serials: item.serials, // By default returning the serials associated, though tech used some...
                    // Wait, if tech used ONU serials, those SHOULD have been removed from assignment, 
                    // OR we just free up the unused ones. We'll free up all associated with this item that are still here.
                }
            })

            const res = await closeAssignmentWithMovement(assignment.id, returnItems)

            if (res.success) {
                toast.success("Asignación cerrada y materiales ingresados al inventario.")
            } else {
                toast.error(res.error || "Error al procesar recepción.")
            }
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const title = assignment.team ? assignment.team.name : `${assignment.profile?.first_name} ${assignment.profile?.last_name}`

    return (
        <PremiumCard className="p-6">
            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                            <ShieldCheck size={12} /> Auditado
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">#{assignment.code || assignment.id.substring(0, 8)}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(assignment.code || assignment.id.substring(0, 8));
                                    toast.success("Código copiado");
                                }}
                                title="Copiar código"
                            >
                                <Copy size={10} />
                            </Button>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold">{title}</h3>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                    <Info size={16} />
                    <p>Cuenta físicamente los materiales sobrantes devueltos.</p>
                </div>

                <div className="grid gap-3">
                    {assignment.items.map((item: any) => {
                        const isCarrete = item.product.sku.includes("CARRETE")
                        const qty = counts[item.product_id] === undefined ? 0 : counts[item.product_id]
                        return (
                            <div key={item.product_id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <p className="font-bold text-sm flex items-center gap-2">
                                        <Box size={14} className="text-zinc-400" />
                                        {item.product.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Entregados originalmente: {item.quantity}</p>
                                </div>
                                <div className="w-24">
                                    <Label className="sr-only">Cantidad Devuelta</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            value={counts[item.product_id] === undefined ? "" : counts[item.product_id]}
                                            onChange={(e) => handleCountChange(item.product_id, e.target.value)}
                                            className="text-center font-bold"
                                            placeholder="0"
                                        />
                                        {isCarrete && <span className="text-xs text-muted-foreground">m</span>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-500/20"
            >
                {loading ? "Procesando..." : "Confirmar Recepción y Cerrar"}
            </Button>
        </PremiumCard>
    )
}
