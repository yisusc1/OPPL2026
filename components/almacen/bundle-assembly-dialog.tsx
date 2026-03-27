"use client"

import { useEffect, useState } from "react"
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
import { toast } from "sonner"
import type { Product } from "@/app/almacen/productos/page"
import { Package, AlertTriangle } from "lucide-react"

const assemblySchema = z.object({
    quantity: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
})

interface BundleAssemblyDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product
    onSave: () => void
}

type BundleItem = {
    id: string
    quantity: number
    child_product: {
        id: string
        name: string
        sku: string
        current_stock: number
    }
}

export function BundleAssemblyDialog({ open, onOpenChange, product, onSave }: BundleAssemblyDialogProps) {
    const [loading, setLoading] = useState(false)
    const [recipe, setRecipe] = useState<BundleItem[]>([])
    const [maxPossible, setMaxPossible] = useState(0)
    const supabase = createClient()

    const form = useForm({
        resolver: zodResolver(assemblySchema),
        defaultValues: {
            quantity: 1,
        },
    })

    useEffect(() => {
        if (open && product) {
            loadRecipe()
            form.reset({ quantity: 1 })
        }
    }, [open, product])

    const loadRecipe = async () => {
        try {
            const { data, error } = await supabase
                .from("inventory_bundle_items")
                .select(`
                    id,
                    quantity,
                    child_product:inventory_products!child_product_id (
                        id,
                        name,
                        sku,
                        current_stock
                    )
                `)
                .eq("parent_product_id", product.id)

            if (error) throw error

            const items = data as any[]
            setRecipe(items)

            // Calculate max possible assembly
            if (items.length > 0) {
                const limits = items.map(item => Math.floor(item.child_product.current_stock / item.quantity))
                setMaxPossible(Math.min(...limits))
            } else {
                setMaxPossible(0)
            }

        } catch (error) {
            console.error("Error loading recipe:", error)
            toast.error("Error al cargar componentes del combo")
        }
    }

    const onSubmit = async (values: z.infer<typeof assemblySchema>) => {
        if (values.quantity > maxPossible) {
            toast.error(`Solo puedes armar hasta ${maxPossible} combos con el stock actual.`)
            return
        }

        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user found")

            // 1. Process Stock Out for Children
            for (const item of recipe) {
                const qtyNeeded = item.quantity * values.quantity
                const newChildStock = item.child_product.current_stock - qtyNeeded

                // Update Child Stock
                const { error: updateError } = await supabase
                    .from("inventory_products")
                    .update({ current_stock: newChildStock })
                    .eq("id", item.child_product.id)

                if (updateError) throw updateError

                // Log Child Transaction
                const { error: txError } = await supabase
                    .from("inventory_transactions")
                    .insert({
                        product_id: item.child_product.id,
                        type: 'OUT',
                        quantity: qtyNeeded,
                        previous_stock: item.child_product.current_stock,
                        new_stock: newChildStock,
                        reason: `Armado de Combo: ${product.name} (x${values.quantity})`,
                        user_id: user.id
                    })

                if (txError) throw txError
            }

            // 2. Process Stock In for Bundle (Parent)
            const newParentStock = product.current_stock + values.quantity

            // Update Parent Stock
            const { error: parentUpdateError } = await supabase
                .from("inventory_products")
                .update({ current_stock: newParentStock })
                .eq("id", product.id)

            if (parentUpdateError) throw parentUpdateError

            // Log Parent Transaction
            const { error: parentTxError } = await supabase
                .from("inventory_transactions")
                .insert({
                    product_id: product.id,
                    type: 'IN',
                    quantity: values.quantity,
                    previous_stock: product.current_stock,
                    new_stock: newParentStock,
                    reason: `Armado de partes`,
                    user_id: user.id
                })

            if (parentTxError) throw parentTxError

            toast.success(`Se han armado ${values.quantity} combos exitosamente`)
            onSave()
        } catch (error) {
            console.error("Error assembling bundle:", error)
            toast.error("Error al armar el combo")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Armar Combo: {product.name}
                    </DialogTitle>
                    <DialogDescription>
                        Descuenta stock de los componentes para aumentar el stock del combo.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <h4 className="text-sm font-medium mb-3">Receta y Disponibilidad</h4>
                    <div className="space-y-2 border rounded-md p-3 bg-zinc-50 max-h-[200px] overflow-y-auto">
                        {recipe.map((item) => {
                            const needed = item.quantity * (form.watch("quantity") as number)
                            const hasStock = item.child_product.current_stock >= needed
                            return (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.child_product.name}</span>
                                        <span className="text-zinc-500 text-xs">SKU: {item.child_product.sku}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className={hasStock ? "text-green-600" : "text-red-600 font-bold"}>
                                            {needed} / {item.child_product.current_stock}
                                        </div>
                                        <span className="text-xs text-zinc-400">Requerido / Disp.</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 text-blue-800 rounded-md">
                        <span className="text-sm font-medium">Máximo posible a armar:</span>
                        <span className="text-lg font-bold">{maxPossible} unidades</span>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cantidad a Armar</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} value={(field.value as number) ?? ''} max={maxPossible > 0 ? maxPossible : 1} />
                                    </FormControl>
                                    {maxPossible === 0 && (
                                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            No hay stock suficiente de componentes.
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={loading || maxPossible === 0}>
                                {loading ? "Procesando..." : "Confirmar Armado"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
