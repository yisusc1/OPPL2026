"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PremiumContent } from "@/components/ui/premium-content"
import { Key, Lock, Save, X } from "lucide-react"
import { toast } from "sonner"
import { changePassword } from "./actions"

export function ChangePassword() {
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden")
            return
        }

        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setLoading(true)
        try {
            const result = await changePassword(password)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Contraseña actualizada correctamente")
                setIsEditing(false)
                setPassword("")
                setConfirmPassword("")
            }
        } catch (error) {
            toast.error("Error al actualizar la contraseña")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {!isEditing ? (
                <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="w-full justify-start h-12 rounded-xl border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                    <Key className="mr-3 text-muted-foreground" size={18} />
                    Cambiar Contraseña
                </Button>
            ) : (
                <form onSubmit={handleSubmit} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Lock size={16} className="text-primary" />
                            Nueva Contraseña
                        </h4>
                        <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditing(false)} className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500">
                            <X size={16} />
                        </Button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Confirmar Contraseña</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full h-10 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full gap-2 h-10">
                        <Save size={16} /> {loading ? "Guardando..." : "Actualizar Contraseña"}
                    </Button>
                </form>
            )}
        </div>
    )
}
