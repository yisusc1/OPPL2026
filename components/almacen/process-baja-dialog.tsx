"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, RotateCcw, BoxSelect, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

const bajaSchema = z.object({
    action: z.enum(["DISPOSAL", "VENDOR_RETURN", "LOSS_FINAL"]),
    quantity: z.coerce.number().min(1, "Cantidad requerida"),
    notes: z.string().min(5, "Justifique la salida"),
    selected_serials: z.array(z.string()).optional()
})

interface ProcessBajaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: any
    details: any[] // Serial details
    onSuccess: () => void
}

export function ProcessBajaDialog({ open, onOpenChange, product, details, onSuccess }: ProcessBajaDialogProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const maxQty = (product?.damaged_count || 0) + (product?.lost_count || 0)

    const form = useForm({
        resolver: zodResolver(bajaSchema),
        defaultValues: {
            action: "DISPOSAL" as const,
            quantity: 1,
            notes: "",
            selected_serials: []
        },
    })

    const onSubmit = async (values: any) => {
        if (values.quantity > maxQty) {
            toast.error("Stock Insuficiente: No tiene tantos productos dañados para procesar.")
            setLoading(false)
            return
        }

        if (product.requires_serial && values.selected_serials.length !== values.quantity) {
            // If manual quantity input vs checkbox mismatch?
            // Ideally we disable quantity input for serials and rely on checklist length
            if (values.selected_serials.length === 0) {
                toast.error("Faltan Seriales: Debe seleccionar los números de serie específicos.")
                setLoading(false)
                return
            }
        }

        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            // 1. Log Transaction
            let reasonText = ""
            let receiverText = ""
            if (values.action === 'DISPOSAL') {
                reasonText = `BAJA - Descontinuado: ${values.notes}`
                receiverText = 'Destrucción/Baja'
            } else if (values.action === 'VENDOR_RETURN') {
                reasonText = `DEV PROVEEDOR: ${values.notes}`
                receiverText = 'Proveedor Garantía'
            } else if (values.action === 'LOSS_FINAL') {
                reasonText = `PERDIDA CONFIRMADA: ${values.notes}`
                receiverText = 'No Identificado / Robo'
            }

            await supabase.from("inventory_transactions").insert({
                product_id: product.product_id,
                type: 'OUT',
                quantity: values.quantity,
                previous_stock: 0, // Not really tracking 'damaged' in main stock flow, so 0 or null?
                new_stock: 0,
                reason: reasonText,
                assigned_to: null,
                received_by: receiverText
            })

            // 2. Reduce Stock / Update Serials
            if (product.requires_serial) {
                // Update specific serials to SOLD (effectively removes them from Active/Bajas inventory)
                await supabase.from("inventory_serials")
                    .update({ status: 'SOLD' })
                    .eq("product_id", product.product_id)
                    .in("serial_number", values.selected_serials)
            } else {
                // Reduce damaged_stock
                const newDamaged = (product.damaged_count || 0) - values.quantity
                if (newDamaged < 0) throw new Error("Stock negativo")

                await supabase.from("inventory_products")
                    .update({ damaged_stock: newDamaged })
                    .eq("id", product.product_id)
            }

            toast.success("Salida procesada correctamente")
            onSuccess()
            onOpenChange(false)
            form.reset()

        } catch (error: any) {
            console.error(error)
            toast.error("No se pudo procesar la baja: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" />
                        Procesar Baja / Garantía
                    </DialogTitle>
                    <DialogDescription>
                        {product?.product_name} • {product?.damaged_count} unidades reportadas
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="action"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Salida</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="DISPOSAL">Descontinuar / Dar de Baja (Basura)</SelectItem>
                                            <SelectItem value="VENDOR_RETURN">Devolución a Proveedor (Garantía)</SelectItem>
                                            <SelectItem value="LOSS_FINAL">Formalizar Pérdida / Robo (Cerrar)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />

                        {product?.requires_serial ? (
                            <FormField
                                control={form.control}
                                name="selected_serials"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Seleccione Seriales ({field.value?.length || 0})</FormLabel>
                                        <ScrollArea className="h-[200px] border rounded-md p-2">
                                            <div className="space-y-2">
                                                {details.map((s, idx) => (
                                                    <div key={idx} className="flex items-center space-x-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.value?.includes(s.serial)}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked
                                                                const current = field.value || []
                                                                if (checked) {
                                                                    const newVal = [...current, s.serial]
                                                                    field.onChange(newVal)
                                                                    form.setValue("quantity", newVal.length)
                                                                } else {
                                                                    const newVal = current.filter((x: string) => x !== s.serial)
                                                                    field.onChange(newVal)
                                                                    form.setValue("quantity", newVal.length)
                                                                }
                                                            }}
                                                            className="h-4 w-4 rounded border-zinc-300"
                                                        />
                                                        <span className="text-sm font-mono">{s.serial}</span>
                                                        <span className="text-[10px] bg-zinc-100 px-1 rounded text-zinc-500">
                                                            {s.status === 'LOST' ? 'PERDIDO' : s.status === 'DAMAGED' ? 'DAÑADO' : s.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cantidad a procesar</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} max={maxQty} {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nota / Justificación</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Ej. Equipo obsoleto, no tiene reparación..." {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                                {loading ? "Procesando..." : "Confirmar Salida"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
