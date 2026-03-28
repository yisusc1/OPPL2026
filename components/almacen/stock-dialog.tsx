"use client"

import { useState, useEffect } from "react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { Product } from "@/app/almacen/productos/page"

const stockSchema = z.object({
    type: z.enum(["IN", "OUT"]),
    quantity: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
    reason: z.string().min(1, "Debe seleccionar un motivo"), // Category
    reference: z.string().optional(), // Extra details
    assigned_to: z.string().optional(),
    serials: z.string().optional(),
})

interface StockDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product
    onSave: () => void
}

export function StockDialog({ open, onOpenChange, product, onSave }: StockDialogProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const [profiles, setProfiles] = useState<any[]>([])

    useEffect(() => {
        const loadProfiles = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, department, job_title")
                .order("first_name")
            if (data) setProfiles(data)
        }
        loadProfiles()
    }, [])

    const form = useForm({
        resolver: zodResolver(stockSchema),
        defaultValues: {
            type: "IN" as const,
            quantity: 1,
            reason: "",
            reference: "",
            assigned_to: "",
            serials: "",
        },
    })

    const watchType = form.watch("type")
    const watchReason = form.watch("reason")

    // Reset reason when type changes
    useEffect(() => {
        form.setValue("reason", "")
    }, [watchType, form])

    const onSubmit = async (values: z.infer<typeof stockSchema>) => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                toast.error("Error de sesión: No se ha identificado al usuario.")
                setLoading(false)
                return
            }

            // 0. Parse Serials First (Scope Fix)
            let parsedSerials: string[] = []
            if (product.requires_serial) {
                parsedSerials = values.serials
                    ? values.serials.split('\n').map(s => s.trim()).filter(s => s !== '')
                    : []

                if (parsedSerials.length !== values.quantity) {
                    toast.error(`Cantidad de seriales (${parsedSerials.length}) no coincide con la cantidad del movimiento (${values.quantity})`)
                    setLoading(false)
                    return
                }

                // Check for internal duplicates in the list
                const uniqueSet = new Set(parsedSerials)
                if (uniqueSet.size !== parsedSerials.length) {
                    const duplicates = parsedSerials.filter((item, index) => parsedSerials.indexOf(item) !== index)
                    const uniqueDuplicates = Array.from(new Set(duplicates)).join(', ')
                    toast.error(`Error: Ha ingresado seriales repetidos en la lista: ${uniqueDuplicates}`)
                    setLoading(false)
                    return
                }
            }

            // 1. Fetch Fresh Stock & Location
            const { data: freshProd, error: fetchError } = await supabase
                .from("inventory_products")
                .select("current_stock, location")
                .eq("id", product.id)
                .single()

            if (fetchError || !freshProd) throw new Error("Producto no encontrado o error de conexión")

            const currentStock = freshProd.current_stock

            // 2. Strict Serial Validation
            if (product.requires_serial) {
                if (values.type === 'IN') {
                    // Check existence (ANY status including SOLD/LOST)
                    const { data: existing } = await supabase
                        .from("inventory_serials")
                        .select("serial_number, status")
                        .eq("product_id", product.id)
                        .in("serial_number", parsedSerials)

                    if (existing && existing.length > 0) {
                        const duplicates = existing.map(e => `${e.serial_number} (${e.status === 'SOLD' ? 'YA UTILIZADO' : e.status})`)
                        toast.error(`Seriales ya existen en sistema: ${duplicates.join(', ')}`)
                        setLoading(false)
                        return
                    }
                } else if (values.type === 'OUT') {
                    // Check availability
                    const { data: validSerials } = await supabase
                        .from("inventory_serials")
                        .select("serial_number")
                        .eq("product_id", product.id)
                        .eq("status", 'AVAILABLE')
                        .in("serial_number", parsedSerials)

                    const foundCount = validSerials ? validSerials.length : 0
                    if (foundCount !== parsedSerials.length) {
                        const validSet = new Set(validSerials?.map(v => v.serial_number))
                        const missing = parsedSerials.filter(s => !validSet.has(s))
                        toast.error(`Seriales no disponibles: ${missing.join(', ')}`)
                        setLoading(false)
                        return
                    }
                }
            }

            // 3. Calculate New Stock & Validate Negative
            let newStock = currentStock
            if (values.type === 'IN') newStock += values.quantity
            if (values.type === 'OUT') newStock -= values.quantity

            if (newStock < 0) {
                toast.error(`Stock insuficiente. Actual: ${currentStock}, Solicitado: ${values.quantity}`)
                setLoading(false)
                return
            }

            // Construct Final Reason String
            const fullReason = values.reference
                ? `${values.reason} - ${values.reference}`
                : values.reason;

            // 4. Create Transaction Record
            const { error: txError } = await supabase
                .from("inventory_transactions")
                .insert({
                    product_id: product.id,
                    type: values.type,
                    quantity: values.quantity,
                    previous_stock: currentStock,
                    new_stock: newStock,
                    reason: fullReason,
                    user_id: user.id,
                    assigned_to: values.assigned_to || null,
                    serials: parsedSerials,
                })

            if (txError) {
                if (txError.message.includes("serials")) {
                    toast.error("Error de Base de Datos: Falta configuración estructural (serials).")
                } else {
                    toast.error("Error al registrar: " + txError.message)
                }
                setLoading(false)
                return
            }

            // 5. Update Inventory Serials Table
            if (product.requires_serial && parsedSerials.length > 0) {
                if (values.type === 'IN') {
                    const serialRows = parsedSerials.map(s => ({
                        serial_number: s,
                        product_id: product.id,
                        status: 'AVAILABLE',
                        location: freshProd.location
                    }))
                    await supabase.from("inventory_serials").insert(serialRows)
                } else if (values.type === 'OUT') {
                    // Map Outcome Reasons to Status
                    // VENTA, CONSUMO, PROVEEDOR -> SOLD
                    // PERDIDA, GARANTIA -> LOST
                    // DANO_INTERNO -> DAMAGED
                    let newStatus = 'SOLD'
                    if (['PERDIDA', 'GARANTIA_VENCIDA'].includes(values.reason)) {
                        newStatus = 'LOST'
                    } else if (values.reason === 'DAÑO_INTERNO') {
                        newStatus = 'DAMAGED'
                    }

                    await supabase
                        .from("inventory_serials")
                        .update({ status: newStatus })
                        .eq("product_id", product.id)
                        .in("serial_number", parsedSerials)
                }
            }

            // 6. Update Product Stock (And Damaged Stock if applicable)
            const updateProps: any = { current_stock: newStock }
            if (values.reason === 'DAÑO_INTERNO') {
                // If it's internal damage, the 'quantity' moved from current_stock to damaged_stock.
                // freshProd.current_stock (old) -> newStock (calculated as reduced).
                // So we add 'values.quantity' to damaged_stock.
                // NOTE: We need to fetch current damaged_stock first? Or use rpc increment? 
                // Since this is a simple update, let's fetch damaged_stock or Assume 0 if null.
                // Better: Use rpc for atomic update? Or fetch it above. 
                // Let's assume we need to read it. `inventory_products` usually defaults to 0.

                // Fetch damaged_stock just to be safe if not in freshProd
                const { data: damagedCheck } = await supabase.from("inventory_products").select("damaged_stock").eq("id", product.id).single()
                const currentDamaged = damagedCheck?.damaged_stock || 0
                updateProps.damaged_stock = currentDamaged + values.quantity
            }

            const { error: prodError } = await supabase
                .from("inventory_products")
                .update(updateProps)
                .eq("id", product.id)

            if (prodError) throw prodError

            toast.success("Movimiento registrado correctamente")
            onSave()
            onOpenChange(false)
            form.reset()

        } catch (error: any) {
            console.error(error)
            toast.error("No se pudo registrar el movimiento: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Registrar Movimiento</DialogTitle>
                    <DialogDescription>
                        {product.name} (Stock Actual: {product.current_stock})
                        {product.requires_serial && <span className="block text-amber-600 font-semibold mt-1">⚠ Este producto requiere seriales</span>}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Movimiento</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="IN">Entrada (Compra/Devolución)</SelectItem>
                                            <SelectItem value="OUT">Salida (Consumo/Venta/Pérdida)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Dynamic Reason Selection */}
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Motivo de {watchType === 'IN' ? 'Entrada' : 'Salida'}</FormLabel>
                                    {watchType === 'IN' ? (
                                        // Simple Input for IN or maybe specific reasons too? User said "Compra o Devolucion".
                                        // Let's stick to Select for simplicity and standardization if possible, or free text if they want invoices.
                                        // User didn't specify strict reasons for IN. I will provide a Combobox or Select but allow typing? 
                                        // Let's use a Select for consistency with OUT if possible, or just standard text for now as per design safe-bets.
                                        // "Entrada (compra o devolución)" is the type description.
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione motivo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="COMPRA">Compra</SelectItem>
                                                <SelectItem value="DEVOLUCION">Devolución / Reingreso</SelectItem>
                                                <SelectItem value="AJUSTE_INICIAL">Carga Inicial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        // STRICT OUT REASONS
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione motivo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="VENTA">Venta Directa</SelectItem>
                                                <SelectItem value="CONSUMO">Consumo Interno</SelectItem>
                                                <SelectItem value="PROVEEDOR">Devolución a Proveedor</SelectItem>
                                                <SelectItem value="PERDIDA">Pérdida / Robo (Desaparecido)</SelectItem>
                                                <SelectItem value="DAÑO_INTERNO">Reportar Daño (Mover a Bajas)</SelectItem>
                                                <SelectItem value="GARANTIA_VENCIDA">Descontinuado sin Garantía</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Reference / Details */}
                        <FormField
                            control={form.control}
                            name="reference"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Detalle / Referencia (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Factura #123, Ticket #456..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cantidad</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} value={(field.value as number) ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {product.requires_serial && (
                            <FormField
                                control={form.control}
                                name="serials"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Números de Serie (Uno por línea)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={`Ingrese ${form.watch("quantity")} seriales...`}
                                                className="min-h-[100px] max-h-[300px] font-mono resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-zinc-500 text-right">
                                            {(field.value || '').split('\n').filter((l: string) => l.trim().length > 0).length} / {form.watch("quantity")} ingresados
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Assigned To - Optional now, but useful for Consumo */}
                        {watchType === "OUT" && (watchReason === 'CONSUMO' || watchReason === 'VENTA') && (
                            <FormField
                                control={form.control}
                                name="assigned_to"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Entregado a / Responsable (Opcional)</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione empleado (si aplica)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {profiles.map((profile) => (
                                                    <SelectItem key={profile.id} value={profile.id}>
                                                        {profile.first_name} {profile.last_name} ({profile.job_title || "Sin cargo"})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button type="submit" disabled={loading} variant={watchReason === 'PERDIDA' || watchReason === 'GARANTIA_VENCIDA' ? "destructive" : "default"}>
                                {loading ? "Registrando..." : "Confirmar Movimiento"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
