"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, AlertCircle, Bot, Mic, MicOff } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getSystemSettings, toggleGeminiEnabled, toggleVoiceEnabled } from "../settings-actions"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumContent } from "@/components/ui/premium-content"

export default function AdminConfigModulesPage() {
    const [settings, setSettings] = useState<Record<string, boolean>>({})
    const [systemSettings, setSystemSettings] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [tableExists, setTableExists] = useState(true)

    useEffect(() => {
        loadSettings()
    }, [])

    async function loadSettings() {
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('app_settings').select('*')

            if (error) {
                if (error.code === '42P01') {
                    setTableExists(false)
                }
                console.error("Config load error:", error)
            }

            const currentSettings: Record<string, boolean> = {}
            INITIAL_MODULES_CONFIG.forEach(m => {
                currentSettings[m.key] = m.default
            })

            if (data) {
                data.forEach((item: any) => {
                    currentSettings[item.key] = item.value
                })
            }

            setSettings(currentSettings)

            const sys = await getSystemSettings()
            setSystemSettings(sys)

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const supabase = createClient()

            if (!tableExists) {
                toast.error("Error: Tabla 'app_settings' no existe en DB.")
                return
            }

            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value,
                label: INITIAL_MODULES_CONFIG.find(m => m.key === key)?.label
            }))

            const { error } = await supabase.from('app_settings').upsert(updates)

            if (error) throw error

            toast.success("Configuración guardada")
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }

    const toggle = (key: string) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Cargando configuración...</p>
            </div>
        </div>
    )

    return (
        <PremiumPageLayout
            title="Gestión de Módulos"
            description="Habilita o deshabilita secciones del sistema."
        >
            <div className="mb-6">
                <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ArrowLeft size={20} />
                    <span>Volver al Panel</span>
                </Link>
            </div>

            <div className="max-w-4xl mx-auto space-y-8">

                {!tableExists && (
                    <PremiumContent className="border-amber-500/50 bg-amber-500/10">
                        <div className="flex items-center gap-2 text-amber-500 font-bold mb-4">
                            <AlertCircle />
                            <span>Configuración de Base de Datos Necesaria</span>
                        </div>
                        <p className="text-sm text-foreground mb-4">
                            Para usar esta función, ejecuta el siguiente comando SQL en Supabase:
                        </p>
                        <pre className="bg-background/50 p-4 rounded-xl border border-border text-xs font-mono overflow-auto text-foreground">
                            {`create table if not exists app_settings (
    key text primary key,
    value boolean default true,
    label text
);

alter table app_settings enable row level security;
create policy "Public Read" on app_settings for select using (true);
create policy "Admin Update" on app_settings for all using (true);`}
                        </pre>
                    </PremiumContent>
                )}

                {/* SYSTEM AI SETTINGS */}
                <PremiumContent>
                    <div className="flex items-center gap-4 mb-6 border-b border-border/40 pb-4">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Inteligencia Artificial</h2>
                            <p className="text-muted-foreground">Control global del modelo de lenguaje y voz.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* GEMINI */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background/40 hover:bg-background/60 border border-border/50 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 h-2 w-2 rounded-full ${systemSettings["GEMINI_ENABLED"] !== false ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`}></div>
                                <div>
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                        Activar Linky (AI Assistant)
                                    </div>
                                    <div className="text-xs text-muted-foreground max-w-sm mt-1">
                                        Si se desactiva, el asistente no consumirá cuota de API.
                                    </div>
                                </div>
                            </div>
                            <Switch
                                onCheckedChange={async () => {
                                    const newValue = !systemSettings["GEMINI_ENABLED"];
                                    setSystemSettings(prev => ({ ...prev, "GEMINI_ENABLED": newValue }))

                                    try {
                                        await toggleGeminiEnabled()
                                        toast.success("Estado de IA actualizado")
                                    } catch (e) {
                                        toast.error("Error al actualizar")
                                        loadSettings()
                                    }
                                }}
                            />
                        </div>

                        {/* VOICE */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-background/40 hover:bg-background/60 border border-border/50 transition-colors">
                            <div className="flex items-start gap-3">
                                <div className={`mt-2 h-8 w-8 rounded-full flex items-center justify-center ${systemSettings["VOICE_ENABLED"] !== false ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {systemSettings["VOICE_ENABLED"] !== false ? <Mic size={16} /> : <MicOff size={16} />}
                                </div>
                                <div>
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                        Interfaz de Voz
                                    </div>
                                    <div className="text-xs text-muted-foreground max-w-sm mt-1">
                                        Ocultar botón flotante y desactivar escucha.
                                    </div>
                                </div>
                            </div>
                            <Switch
                                checked={systemSettings["VOICE_ENABLED"] !== false}
                                onCheckedChange={async () => {
                                    const newValue = !systemSettings["VOICE_ENABLED"];
                                    setSystemSettings(prev => ({ ...prev, "VOICE_ENABLED": newValue }))
                                    try {
                                        await toggleVoiceEnabled()
                                        toast.success("Interfaz de voz actualizada.")
                                    } catch (e) {
                                        toast.error("Error al actualizar")
                                        loadSettings()
                                    }
                                }}
                            />
                        </div>
                    </div>
                </PremiumContent>

                {/* MODULE VISIBILITY */}
                <PremiumContent>
                    <div className="mb-6 border-b border-border/40 pb-4">
                        <h2 className="text-xl font-bold text-foreground">Visibilidad de Paneles</h2>
                        <p className="text-muted-foreground">Los paneles deshabilitados se ocultarán del menú principal.</p>
                    </div>

                    <div className="space-y-4">
                        {INITIAL_MODULES_CONFIG.map((module) => (
                            <div key={module.key} className="flex items-center justify-between p-4 rounded-lg bg-background/40 hover:bg-background/60 border border-border/50 transition-colors">
                                <div>
                                    <div className="font-semibold text-foreground">{module.label}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{module.path}</div>
                                </div>
                                <Switch
                                    checked={settings[module.key]}
                                    onCheckedChange={() => toggle(module.key)}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !tableExists}
                            className="h-12 px-8 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                        >
                            {saving ? "Guardando..." : "Guardar Cambios"}
                            <Save size={18} className="ml-2" />
                        </Button>
                    </div>
                </PremiumContent>

            </div>
        </PremiumPageLayout>
    )
}
