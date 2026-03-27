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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { Product } from "@/app/almacen/productos/page"

const productSchema = z.object({
    sku: z.string().min(2, "El SKU debe tener al menos 2 caracteres"),
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    category: z.string().optional(),
    min_stock: z.coerce.number().min(0, "El stock mínimo no puede ser negativo"),
    location: z.string().optional(),
    initial_stock: z.coerce.number().min(0).optional(),
    is_bundle: z.boolean().default(false),
    requires_serial: z.boolean().default(false),
    bundle_items: z.array(z.object({
        child_product_id: z.string(),
        quantity: z.coerce.number().min(1)
    })).default([])
})

interface ProductDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product?: Product
    onSave: () => void
}

export function ProductDialog({ open, onOpenChange, product, onSave }: ProductDialogProps) {
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
        resolver: zodResolver(productSchema),
        defaultValues: {
            sku: "",
            name: "",
            description: "",
            category: "",
            min_stock: 5,
            location: "",
            initial_stock: 0,
            is_bundle: false,
            requires_serial: false,
            bundle_items: [],
        },
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
                requires_serial: product.requires_serial || false,
                initial_stock: 0,
            })
        } else {
            form.reset({
                sku: "",
                name: "",
                description: "",
                category: "",
                min_stock: 5,
                location: "",
                requires_serial: false,
                initial_stock: 0,
            })
        }
    }, [product, form, open])

    const onSubmit = async (values: z.infer<typeof productSchema>) => {
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
                        is_bundle: values.is_bundle,
                        requires_serial: values.requires_serial,
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
                        is_bundle: values.is_bundle,
                        requires_serial: values.requires_serial,
                    })
                    .select("id")
                    .single()

                if (error) throw error
                productId = data.id
            }

            toast.success(product ? "Producto actualizado" : "Producto creado")
            onSave()
        } catch (error) {
            console.error(error)
            toast.error("No se pudieron guardar los cambios del producto.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{product ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
                    <DialogDescription>
                        {product ? "Modifique los detalles del producto." : "Complete la información para registrar un nuevo item."}
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
                                            <Input placeholder="COD-001" {...field} />
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
                                            <Input placeholder="General" {...field} />
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
                                    <FormLabel>Nombre del Producto</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Cable UTP Cat6" {...field} />
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
                                        <Textarea placeholder="Detalles adicionales..." className="resize-none" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="min_stock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stock Mínimo</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} value={(field.value as number) ?? ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ubicación</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Pasillo A, Estante 2" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>



                        <FormField
                            control={form.control}
                            name="requires_serial"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Requiere Serial</FormLabel>
                                        <div className="text-sm text-muted-foreground">
                                            Habilita el seguimiento de números de serie para este item.
                                        </div>
                                    </div>
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="initial_stock"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Stock Inicial</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} value={(field.value as number) ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    )
}
