"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PremiumContent } from "@/components/ui/premium-content"
import { CircleUser, Mail, Shield, Save, Edit2, X } from "lucide-react"
import { toast } from "sonner"
import { updateProfileData } from "./actions"

type ProfileProps = {
    profile: any
    email: string
}

export function ProfileDetails({ profile, email }: ProfileProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        national_id: profile?.national_id || profile?.cedula || "",
        phone: profile?.phone || "",
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const result = await updateProfileData(formData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Perfil actualizado correctamente")
                setIsEditing(false)
            }
        } catch (error) {
            toast.error("Error al actualizar el perfil")
        } finally {
            setLoading(false)
        }
    }

    return (
        <PremiumContent className="p-0 overflow-hidden h-full">
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <CircleUser className="text-primary" size={20} />
                    Información Personal
                </h3>
                {!isEditing ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 gap-1">
                        <Edit2 size={14} /> Editar
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-8 gap-1 text-red-500 hover:text-red-600">
                        <X size={14} /> Cancelar
                    </Button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</label>
                            <input
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                                className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido</label>
                            <input
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                                className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cédula</label>
                        <input
                            name="national_id"
                            value={formData.national_id}
                            onChange={handleChange}
                            required
                            className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</label>
                        <input
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full gap-2 mt-2">
                        <Save size={16} /> {loading ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </form>
            ) : (
                <div className="p-6 space-y-6">
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre Completo</label>
                        <div className="text-foreground font-medium p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent">
                            {profile?.first_name || profile?.last_name
                                ? `${profile?.first_name || ''} ${profile?.last_name || ''}`
                                : '(No registrado)'}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificación</label>
                        <div className="text-foreground font-medium p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent">
                            {profile?.national_id || profile?.cedula || '(No registrado)'}
                            {profile?.phone && <span className="text-muted-foreground ml-2">| {profile.phone}</span>}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correo Electrónico</label>
                        <div className="text-foreground font-medium p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent flex items-center gap-2">
                            <Mail size={16} className="text-muted-foreground" />
                            {email}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rol de Sistema</label>
                        <div className="text-foreground font-medium p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-transparent flex items-center gap-2">
                            <Shield size={16} className="text-muted-foreground" />
                            {profile?.roles?.[0] || profile?.role || 'User'}
                        </div>
                    </div>
                </div>
            )}
        </PremiumContent>
    )
}
