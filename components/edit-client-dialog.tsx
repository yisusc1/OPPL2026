"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, User, CreditCard, Box, Router, Save } from "lucide-react"
import { toast } from "sonner"

type Client = {
    id: string
    nombre: string
    cedula: string
    direccion: string
    plan: string
    equipo?: string
    onu?: string
}

type EditClientDialogProps = {
    isOpen: boolean
    onClose: () => void
    onClientUpdated: () => void
    client: Client | null
}

export function EditClientDialog({ isOpen, onClose, onClientUpdated, client }: EditClientDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        nombre: "",
        cedula: "",
        plan: "",
        equipo: "",
        onu: "",
    })

    // Load client data when dialog opens
    useEffect(() => {
        if (client && isOpen) {
            setFormData({
                nombre: client.nombre || "",
                cedula: client.cedula || "",
                plan: client.plan || "",
                equipo: client.equipo || "",
                onu: client.onu || "",
            })
        }
    }, [client, isOpen])

    const planes = [
        "400MB Residencial",
        "600MB Residencial",
        "800MB Residencial",
        "400MB Empresarial",
        "600MB Empresarial",
        "800MB Empresarial",
        "1GB Empresarial",
    ]

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value } = e.target

        if (name === "onu") {
            // Force uppercase and remove non-alphanumeric characters
            value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
        }

        setFormData({
            ...formData,
            [name]: value,
        })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!client) return

        setLoading(true)

        try {
            const supabase = createClient()
            const { error } = await supabase
                .from("clientes")
                .update({
                    nombre: formData.nombre,
                    cedula: formData.cedula,
                    plan: formData.plan,
                    equipo: formData.equipo,
                    onu: formData.onu,
                })
                .eq("id", client.id)

            if (error) throw error

            onClientUpdated()
            onClose()
            toast.success("Cliente actualizado exitosamente")
        } catch (error) {
            console.error("Error updating client:", error)
            toast.error("Error al actualizar el cliente")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const inputClasses = "w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border-0 rounded-2xl text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium selection:bg-zinc-200 dark:selection:bg-zinc-700"
    const labelClasses = "block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 pl-1"
    const iconClasses = "absolute left-4 top-[38px] text-zinc-400 dark:text-zinc-500"

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg rounded-[32px] border-0 shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden ring-1 ring-white/10">
                <CardHeader className="flex flex-row items-center justify-between pb-2 pt-8 px-8 border-b border-zinc-50 dark:border-zinc-900">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Editar Cliente</CardTitle>
                        <p className="text-sm text-zinc-500 font-medium">Actualiza los datos del cliente</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </CardHeader>
                <CardContent className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <label className={labelClasses}>Nombre Completo</label>
                            <User size={20} className={iconClasses} />
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleChange}
                                required
                                className={inputClasses}
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>

                        <div className="relative">
                            <label className={labelClasses}>Cédula</label>
                            <CreditCard size={20} className={iconClasses} />
                            <input
                                type="text"
                                name="cedula"
                                value={formData.cedula}
                                onChange={handleChange}
                                required
                                className={inputClasses}
                                placeholder="V-12345678"
                            />
                        </div>

                        <div className="relative">
                            <label className={labelClasses}>Plan</label>
                            <Box size={20} className={iconClasses} />
                            <div className="relative">
                                <select
                                    name="plan"
                                    value={formData.plan}
                                    onChange={handleChange}
                                    required
                                    className={`${inputClasses} appearance-none cursor-pointer`}
                                >
                                    <option value="" className="text-zinc-400">Seleccionar Plan...</option>
                                    {planes.map((plan) => (
                                        <option key={plan} value={plan}>
                                            {plan}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-[24px] bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Router size={16} />
                                </div>
                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Datos de Conexión</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Equipo</label>
                                    <input
                                        type="text"
                                        name="equipo"
                                        value={formData.equipo}
                                        onChange={handleChange}
                                        required
                                        className="w-full h-12 px-4 bg-white dark:bg-zinc-900 border-0 rounded-xl text-zinc-900 dark:text-zinc-100 text-center font-bold shadow-sm"
                                        placeholder="A"
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>ONU</label>
                                    <input
                                        type="text"
                                        name="onu"
                                        value={formData.onu}
                                        onChange={handleChange}
                                        required
                                        maxLength={6}
                                        className="w-full h-12 px-4 bg-white dark:bg-zinc-900 border-0 rounded-xl text-zinc-900 dark:text-zinc-100 text-center font-bold font-mono tracking-widest shadow-sm"
                                        placeholder="123456"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-14 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-lg font-bold rounded-2xl shadow-xl shadow-zinc-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? "Guardando..." : (
                                    <>
                                        <Save size={20} />
                                        Guardar Cambios
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
