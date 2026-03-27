"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
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
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Product } from "@/app/almacen/productos/page"

const comboSchema = z.object({
    sku: z.string().min(2, "El SKU debe tener al menos 2 caracteres"),
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    category: z.string().optional(),
    min_stock: z.coerce.number().min(0, "El stock mínimo no puede ser negativo"),
    location: z.string().optional(),
    initial_stock: z.coerce.number().min(0).optional(),
    bundle_items: z.array(z.object({
        child_product_id: z.string(),
        quantity: z.coerce.number().min(1)
    })).default([])
})

interface ComboDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product
    onSave: () => void
}

export function ComboDialog({ open, onOpenChange, product, onSave }: ComboDialogProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    const [availableProducts, setAvailableProducts] = useState<Product[]>([])

    // Load available products for bundle creation
    useEffect(() => {
        const loadProducts = async () => {
            const { data } = await supabase
                .from("inventory_products")
                .select("*")
                .eq("is_bundle", false) // Prevent bundles inside bundles for now to avoid cycles
                .order("name")
            if (data) setAvailableProducts(data)
        }
        if (open) loadProducts()
    }, [open])

    const form = useForm({
        resolver: zodResolver(comboSchema),
        defaultValues: {
            sku: "",
            name: "",
            description: "",
            category: "",
            min_stock: 5,
            location: "",
            initial_stock: 0,
            bundle_items: [],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "bundle_items",
    })

    useEffect(() => {
        if (product) {
            form.reset({
                sku: product.sku,
                name: product.name,
                description: product.description || "",
                category: product.category || "",
                min_stock: product.min_stock,
                location: product.location || "",
                initial_stock: 0,
            })
            // Fetch existing bundle items
            const loadBundleItems = async () => {
                const { data } = await supabase
                    .from("inventory_bundle_items")
                    .select("*")
                    .eq("parent_product_id", product.id)

                if (data) {
                    form.setValue("bundle_items", data.map(item => ({
                        child_product_id: item.child_product_id,
                        quantity: item.quantity
                    })))
                }
            }
            loadBundleItems()
        } else {
            form.reset({
                sku: "",
                name: "",
                description: "",
                category: "",
                min_stock: 5,
                location: "",
                initial_stock: 0,
                bundle_items: [],
            })
        }
    }, [product, form, open, supabase]) // Added dependencies

    const onSubmit = async (values: z.infer<typeof comboSchema>) => {
        setLoading(true)
        try {
            let productId = product?.id

            if (product) {
                // Update
                const { error } = await supabase
                    .from("inventory_products")
                    .update({
                        sku: values.sku,
                        name: values.name,
                        description: values.description,
                        category: values.category,
                        min_stock: values.min_stock,
                        location: values.location,
                        is_bundle: true,
                    })
                    .eq("id", product.id)
                if (error) throw error
            } else {
                // Create
                const { data, error } = await supabase
                    .from("inventory_products")
                    .insert({
                        sku: values.sku,
                        name: values.name,
                        description: values.description,
                        category: values.category,
                        min_stock: values.min_stock,
                        location: values.location,
                        current_stock: values.initial_stock || 0,
                        is_bundle: true,
                    })
                    .select("id")
                    .single()

                if (error) throw error
                productId = data.id
            }

            // Handle Bundle Items
            if (productId) {
                // 1. Delete existing items
                const { error: deleteError } = await supabase
                    .from("inventory_bundle_items")
                    .delete()
                    .eq("parent_product_id", productId)

                if (deleteError) throw deleteError

                // 2. Insert new items
                if (values.bundle_items && values.bundle_items.length > 0) {
                    const itemsToInsert = values.bundle_items.map(item => ({
                        parent_product_id: productId,
                        child_product_id: item.child_product_id,
                        quantity: item.quantity
                    }))

                    const { error: insertError } = await supabase
                        .from("inventory_bundle_items")
                        .insert(itemsToInsert as any)

                    if (insertError) throw insertError
                }
            }

            toast.success(product ? "Combo actualizado" : "Combo creado")
            onSave()
        } catch (error) {
            console.error(error)
            toast.error("No se pudieron guardar los cambios del combo.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>{product ? "Editar Combo" : "Nuevo Combo"}</DialogTitle>
                    <DialogDescription>
                        {product ? "Modifique la receta del combo." : "Defina un nuevo combo de productos."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="sku"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SKU / Código</FormLabel>
                                        <FormControl>
                                            <Input placeholder="CMB-001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ofertas" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Combo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Kit Escolar Básico" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Qué incluye este combo..." className="resize-none" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Bundle Items Section - Always Visible */}
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Receta del Combo</h4>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ child_product_id: "", quantity: 1 })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Item
                                </Button>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="flex items-end gap-3">
                                    <FormField
                                        control={form.control}
                                        name={`bundle_items.${index}.child_product_id`}
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel className={index !== 0 ? "sr-only" : ""}>Producto</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar producto" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {availableProducts.map((p) => (
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.name} (SKU: {p.sku})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`bundle_items.${index}.quantity`}
                                        render={({ field }) => (
                                            <FormItem className="w-24">
                                                <FormLabel className={index !== 0 ? "sr-only" : ""}>Cant.</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} value={(field.value as number) ?? ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                        className="mb-2"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            {fields.length === 0 && (
                                <p className="text-sm text-center text-muted-foreground py-4">
                                    Agregue productos para definir este combo.
                                </p>
                            )}
                        </div>

                        {!product && (
                            <FormField
                                control={form.control}
                                name="initial_stock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stock Inicial (Combos ya armados)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={(field.value as number) ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar Combo"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
