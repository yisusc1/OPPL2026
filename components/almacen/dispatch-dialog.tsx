"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Save, X, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { validateSerial } from "@/app/almacen/actions"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

// Schema
const dispatchSchema = z.object({
    assigned_to: z.string().min(1, "Debe seleccionar un equipo/técnico"),
    is_third_party: z.boolean().default(false),
    received_by: z.string().optional(),
    receiver_id: z.string().optional(),
    template_name: z.string().optional(), // For saving new template
    save_as_template: z.boolean().default(false),
    items: z.array(z.object({
        product_id: z.string().min(1, "Seleccione producto"),
        quantity: z.coerce.number().min(1),
        requires_serial: z.boolean().default(false),
        serials: z.array(z.object({
            value: z.string().min(1, "Serial requerido")
        })).optional()
    })).min(1, "Agregue al menos un item")
}).refine(data => {
    if (data.is_third_party) {
        return !!data.received_by && !!data.receiver_id;
    }
    return true;
}, {
    message: "Debe ingresar Nombre y Documento del receptor",
    path: ["received_by"] // Attach error to received_by
});



interface DispatchDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: () => void
    title?: string
    codePrefix?: string
}

// ...

interface Product {
    id: string
    name: string
    current_stock: number
    requires_serial: boolean
}

interface Profile {
    id: string
    first_name: string
    last_name: string
    department: string
}

interface Template {
    id: string
    name: string
    items: any[]
}

export function DispatchDialog({ open, onOpenChange, onSave, title = "Nueva Salida / Despacho", codePrefix = "DES" }: DispatchDialogProps) {
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const [products, setProducts] = useState<Product[]>([])
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [templates, setTemplates] = useState<Template[]>([])

    const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null) // New State

    const form = useForm({
        resolver: zodResolver(dispatchSchema),
        defaultValues: {
            assigned_to: "",
            is_third_party: false,
            received_by: "",
            receiver_id: "",
            template_name: "",
            save_as_template: false,
            items: [],
        },
    })

    // Serial Validation State
    const [serialStatus, setSerialStatus] = useState<Record<string, { valid: boolean | null, loading: boolean }>>({})

    const checkSerial = async (serial: string, productId: string, key: string) => {
        if (!serial) {
            setSerialStatus(prev => ({ ...prev, [key]: { valid: null, loading: false } }))
            return
        }

        // 1. Check for Duplicates in current form
        const allItems = form.getValues("items")
        let count = 0
        allItems.forEach(item => {
            item.serials?.forEach(s => {
                if (s.value === serial) count++
            })
        })

        if (count > 1) {
            setSerialStatus(prev => ({ ...prev, [key]: { valid: false, loading: false } }))
            return
        }

        setSerialStatus(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }))

        try {
            const result = await validateSerial(serial, productId)
            setSerialStatus(prev => ({ ...prev, [key]: { valid: result.valid, loading: false } }))
        } catch (e) {
            setSerialStatus(prev => ({ ...prev, [key]: { valid: false, loading: false } }))
        }
    }

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "items",
    })

    // Load Data
    useEffect(() => {
        if (!open) return

        const fetchData = async () => {
            // Get Current User
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setCurrentUserId(user.id)

            // Products
            const { data: prodData } = await supabase
                .from("inventory_products")
                .select("id, name, sku, current_stock, requires_serial")
                .eq("is_bundle", false)
                .order("name")
            setProducts(prodData || [])

            // Profiles (Technicians)
            const { data: profData } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, department")
                .order("first_name")
            setProfiles(profData || [])

            // Templates
            const { data: templData } = await supabase
                .from("inventory_combo_templates")
                .select(`
                    id, 
                    name, 
                    inventory_combo_template_items (
                        product_id,
                        quantity
                    )
                `)

            if (templData) {
                const formattedTemplates = templData.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    items: t.inventory_combo_template_items
                }))
                setTemplates(formattedTemplates)
            }
        }
        fetchData()
    }, [open])

    // Handle Template Selection
    const handleLoadTemplate = (templateId: string) => {
        setLoadedTemplateId(templateId)
        const template = templates.find(t => t.id === templateId)
        if (!template) return

        // Pre-fill name for editing
        form.setValue("template_name", template.name)

        // Map template items to form items
        // Note: We need to check requires_serial for each product
        const newItems = template.items.map(ti => {
            const product = products.find(p => p.id === ti.product_id)
            const count = ti.quantity
            const serials = product?.requires_serial
                ? Array(count).fill({ value: "" })
                : []

            return {
                product_id: ti.product_id,
                quantity: ti.quantity,
                requires_serial: product?.requires_serial || false,
                serials: serials
            }
        })

        // This replaces current items
        form.setValue("items", newItems)
    }

    const handleClearTemplate = () => {
        setLoadedTemplateId(null)
        form.setValue("template_name", "")
        form.setValue("items", [])
        toast.info("Plantilla removida y campos limpiados")
    }

    const handleDeleteTemplate = async () => {
        if (!loadedTemplateId) return

        if (!confirm("¿Está seguro de eliminar esta plantilla?")) return

        try {
            const { error } = await supabase
                .from("inventory_combo_templates")
                .delete()
                .eq("id", loadedTemplateId)

            if (error) throw error
            if (error) {
                console.error(error)
                toast.error("No se pudo eliminar la plantilla guardada.")
                return
            }

            toast.success("Plantilla eliminada")
            setTemplates(prev => prev.filter(t => t.id !== loadedTemplateId))
            setLoadedTemplateId(null)
            form.setValue("template_name", "")
        } catch (error) {
            console.error(error)
            toast.error("No se pudo eliminar la plantilla guardada.")
        }
    }

    // Handle Product Selection change (to update requires_serial)
    const handleProductChange = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId)
        if (!product) return

        const currentQty = form.getValues(`items.${index}.quantity`) || 1
        const serials = product.requires_serial
            ? Array(currentQty).fill({ value: "" })
            : []

        update(index, {
            ...form.getValues(`items.${index}`),
            product_id: productId,
            requires_serial: product.requires_serial,
            serials: serials as any
        })
    }

    // Handle Quantity Change (to resize serials array)
    const handleQuantityChange = (index: number, qty: number) => {
        const item = form.getValues(`items.${index}`)
        if (!item.requires_serial) {
            update(index, { ...item, quantity: qty })
            return
        }

        const currentSerials = item.serials || []
        let newSerials = [...currentSerials]

        if (qty > currentSerials.length) {
            // Add empty slots
            const toAdd = qty - currentSerials.length
            newSerials = [...newSerials, ...Array(toAdd).fill({ value: "" })]
        } else if (qty < currentSerials.length) {
            // Remove slots
            newSerials = newSerials.slice(0, qty)
        }

        update(index, { ...item, quantity: qty, serials: newSerials })
    }

    const onSubmit = async (values: z.infer<typeof dispatchSchema>) => {
        setLoading(true)
        try {
            // 0. Validate Stock and Serials
            for (const item of values.items) {
                const product = products.find(p => p.id === item.product_id)
                if (!product) continue

                // Check Stock
                if (item.quantity > product.current_stock) {
                    toast.error(`Stock insuficiente para ${product.name}. Disponible: ${product.current_stock}`)
                    setLoading(false)
                    return
                }

                // Check Serials
                if (item.requires_serial && item.serials) {
                    for (const serialObj of item.serials) {
                        const serial = serialObj.value
                        if (!serial) continue

                        const validation = await validateSerial(serial, item.product_id)
                        if (!validation.valid) {
                            toast.error(`Serial inválido: ${serial} - ${validation.message}`)
                            setLoading(false)
                            return
                        }
                    }
                }
            }

            // 1. Prepare Data for RPC
            const code = `${codePrefix}-${Date.now().toString().slice(-6)}`

            const rpcItems = values.items.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                requires_serial: item.requires_serial,
                serials: item.serials?.map(s => s.value) || []
            }))

            const payload = {
                p_assigned_to: values.assigned_to,
                p_code: code,
                p_received_by: values.is_third_party ? values.received_by : null,
                p_receiver_id: values.is_third_party ? values.receiver_id : null,
                p_items: rpcItems
            }

            // 2. Call Atomic RPC
            const { data, error } = await supabase.rpc('create_dispatch_transaction_v2', payload)

            if (error) throw error

            // 2. Update Product
            await supabase
                .from("inventory_products")


            // 3. Save Template if requested
            // 3. Save Template if requested
            if (values.save_as_template && values.template_name) {
                // Check if overwriting
                let templateId = loadedTemplateId

                // If name changed, treat as new unless we match another existing one by name
                // Actually, simplify: If ID exists, overwrite that ID. If name changed, rename it.
                // But if user wants 'Save As New', they should clear the loaded ID (we need a 'Clear' or just logic based on name?)
                // Strategy: Check if name matches an EXISTING template to allow overwrite by name (more flexible)
                const existingTemplate = templates.find(t => t.name.toLowerCase() === values.template_name?.toLowerCase())

                if (existingTemplate) {
                    if (!confirm(`Ya existe una plantilla llamada "${existingTemplate.name}". ¿Desea sobrescribirla?`)) {
                        setLoading(false)
                        return
                    }
                    templateId = existingTemplate.id

                    // Delete old items first
                    await supabase.from("inventory_combo_template_items").delete().eq("template_id", templateId)
                } else {
                    // New Template
                    const { data: tmpl, error: tmplError } = await supabase
                        .from("inventory_combo_templates")
                        .insert({ name: values.template_name })
                        .select("id")
                        .single()

                    if (tmplError) throw tmplError
                    templateId = tmpl.id
                }

                if (templateId) {
                    const tmplItems = values.items.map(i => ({
                        template_id: templateId,
                        product_id: i.product_id,
                        quantity: i.quantity
                    }))
                    await supabase.from("inventory_combo_template_items").insert(tmplItems)
                }
            }

            toast.success(`Despacho creado: ${code}`)
            form.reset({
                assigned_to: "",
                items: [{ product_id: "", quantity: 1, requires_serial: false }]
            })
            onSave()
        } catch (error) {
            console.error(error)
            toast.error("Falló la creación del despacho. Por favor, revise los datos e intente de nuevo.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Cree un combo diario para un equipo técnico.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="assigned_to"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Equipo / Técnico Responsable</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {profiles.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.first_name} {p.last_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Third Party Receiver Toggle */}
                            <FormField
                                control={form.control}
                                name="is_third_party"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-start space-x-2 space-y-0 h-10 mt-8">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="cursor-pointer">
                                                ¿Entrega a tercero / conductor?
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Third Party Details */}
                        {form.watch("is_third_party") && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 border border-orange-100 rounded-md">
                                <FormField
                                    control={form.control}
                                    name="received_by"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-orange-900">Recibido Por (Nombre)</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Nombre del receptor/conductor" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="receiver_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-orange-900">Documento / ID</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Cédula o ID" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <FormItem>
                            <FormLabel>Cargar Plantilla (Opcional)</FormLabel>
                            <div className="flex gap-2">
                                <Select
                                    value={loadedTemplateId || ""}
                                    onValueChange={handleLoadTemplate}
                                >
                                    <FormControl>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Seleccionar plantilla..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {templates.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {loadedTemplateId && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={handleClearTemplate}
                                            title="Descartar plantilla (Limpiar items)"
                                            className="text-zinc-500 hover:text-zinc-900"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={handleDeleteTemplate}
                                            title="Eliminar plantilla permanentemente"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </FormItem>


                        <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Materiales</h4>
                            </div>

                            {fields.map((field, index) => {
                                const isSerial = form.getValues(`items.${index}.requires_serial`)
                                const qty = (form.watch(`items.${index}.quantity`) || 0) as number

                                return (
                                    <div key={field.id} className="p-3 bg-white rounded-md border space-y-3">
                                        <div className="flex items-end gap-3">
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.product_id`}
                                                render={({ field: pField }) => (
                                                    <FormItem className="flex-1">
                                                        <FormLabel className="text-xs">Producto</FormLabel>
                                                        <Select
                                                            onValueChange={(val) => {
                                                                pField.onChange(val)
                                                                handleProductChange(index, val)
                                                            }}
                                                            defaultValue={pField.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Seleccionar..." />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {products.map((p) => (
                                                                    <SelectItem key={p.id} value={p.id}>
                                                                        {p.name} (Stock: {p.current_stock})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field: qField }) => (
                                                    <FormItem className="w-24">
                                                        <FormLabel className="text-xs">Cant.</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                className="h-9"
                                                                {...qField}
                                                                value={(qField.value as number) ?? ''}
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value) || 0
                                                                    qField.onChange(val)
                                                                    handleQuantityChange(index, val)
                                                                }}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                className="h-9 w-9 text-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Dynamic Serial Inputs */}
                                        {isSerial && qty > 0 && (
                                            <div className="pl-4 border-l-2 border-blue-200 space-y-2">
                                                <p className="text-xs font-semibold text-blue-600">Ingrese Seriales:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Array.from({ length: qty }).map((_, sIndex) => {
                                                        const serialKey = `${index}-${sIndex}`
                                                        const status = serialStatus[serialKey] || { valid: null, loading: false }

                                                        return (
                                                            <div key={`${field.id}-serial-${sIndex}`} className="relative">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`items.${index}.serials.${sIndex}.value`}
                                                                    render={({ field: sField }) => (
                                                                        <div className="relative">
                                                                            <Input
                                                                                {...sField}
                                                                                placeholder={`Serial #${sIndex + 1}`}
                                                                                className={`h-8 text-xs pr-8 ${status.valid === true ? 'border-green-500 focus-visible:ring-green-500' :
                                                                                    status.valid === false ? 'border-red-500 focus-visible:ring-red-500' : ''
                                                                                    }`}
                                                                                onBlur={(e) => {
                                                                                    sField.onBlur()
                                                                                    checkSerial(e.target.value, form.getValues(`items.${index}.product_id`), serialKey)
                                                                                }}
                                                                            />
                                                                            <div className="absolute right-2 top-1.5 pointer-events-none">
                                                                                {status.loading ? (
                                                                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                                                                ) : status.valid === true ? (
                                                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                                ) : status.valid === false ? (
                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-center mt-4 mb-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => append({ product_id: "", quantity: 1, requires_serial: false })}
                                className="w-full border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 text-zinc-600"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Agregar Item
                            </Button>
                        </div>

                        {/* Save Template Option */}
                        <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-lg">
                            <FormField
                                control={form.control}
                                name="save_as_template"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-medium cursor-pointer">
                                            Guardar esta configuración como nueva Plantilla
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                            {form.watch("save_as_template") && (
                                <FormField
                                    control={form.control}
                                    name="template_name"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input placeholder="Nombre de la plantilla (ej. Kit Instalación Fibra)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                                {loading ? "Procesando..." : "Confirmar Despacho"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form >
            </DialogContent >
        </Dialog >
    )
}
