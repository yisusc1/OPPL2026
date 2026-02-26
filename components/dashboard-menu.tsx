"use client"

import Link from "next/link"
import {
    Wrench, Truck, ShieldCheck, UserCog, Package, Settings,
    Headset, CalendarRange, Network, Activity, Users2, Cpu, FileText, ShoppingBag,
    LayoutGrid, Zap
} from "lucide-react"
import { useUser } from "@/components/providers/user-provider"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"
import { VoiceHint } from "@/components/voice-hint"

export function DashboardMenu() {
    const { hasRole, isAdmin, isLoading: isUserLoading, profile } = useUser()
    const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({})
    const [loadingSettings, setLoadingSettings] = useState(true)

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Initialize with defaults
                const settings: Record<string, boolean> = {}
                INITIAL_MODULES_CONFIG.forEach(m => settings[m.key] = m.default)

                const supabase = createClient()
                const { data, error } = await supabase.from('app_settings').select('*')

                if (data && !error) {
                    data.forEach((item: any) => {
                        settings[item.key] = item.value
                    })
                }
                setEnabledModules(settings)
            } catch (e) {
                console.error("Error loading module settings", e)
            } finally {
                setLoadingSettings(false)
            }
        }
        loadSettings()
    }, [])

    if (isUserLoading || loadingSettings) {
        return <div className="text-center text-zinc-500 py-10">Cargando panel...</div>
    }

    const dept = profile?.department

    const canAccess = (roleKey: string, deptName?: string) => {
        if (isAdmin) return true
        if (hasRole(roleKey as any)) return true
        if (deptName && dept === deptName) {
            if (hasRole('chofer') && roleKey !== 'transporte') return false
            return true
        }
        return false
    }

    const isModuleEnabled = (key: string) => {
        return enabledModules[key] !== false
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* TECNICOS (Instalación) */}
            {isModuleEnabled("module_tecnicos") && canAccess("tecnico", "Instalación") && (
                <VoiceHint command="Mis Tareas" side="top">
                    <Link
                        href="/tecnicos"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Wrench size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Wrench size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Instalaciones</h2>
                                <p className="text-zinc-500 font-medium">Gestión de instalaciones de fibra óptica.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* SOPORTE TECNICO */}
            {isModuleEnabled("module_soporte") && canAccess("soporte", "Soporte Técnico") && (
                <VoiceHint command="Soporte" side="top">
                    <Link
                        href="/soporte"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Headset size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Headset size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Soporte Técnico</h2>
                                <p className="text-zinc-500 font-medium">Tickets y atención operativa remota.</p>
                            </div>
                            <div className="flex items-center text-indigo-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* PLANIFICACION */}
            {isModuleEnabled("module_planificacion") && canAccess("planificacion", "Planificación") && (
                <VoiceHint command="Planificación" side="top">
                    <Link
                        href="/planificacion"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <CalendarRange size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-600 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                                <CalendarRange size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Planificación</h2>
                                <p className="text-zinc-500 font-medium">Agendas, citas y gestión de clientes.</p>
                            </div>
                            <div className="flex items-center text-pink-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* DISTRIBUCION */}
            {isModuleEnabled("module_distribucion") && canAccess("distribucion", "Distribución") && (
                <VoiceHint command="Distribución" side="top">
                    <Link
                        href="/distribucion"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-cyan-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Network size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                                <Network size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Distribución</h2>
                                <p className="text-zinc-500 font-medium">Redes, empalmes y mantenimiento.</p>
                            </div>
                            <div className="flex items-center text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* AFECTACIONES */}
            {isModuleEnabled("module_afectaciones") && canAccess("afectaciones", "Afectaciones") && (
                <VoiceHint command="Afectaciones" side="top">
                    <Link
                        href="/afectaciones"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Activity size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                                <Activity size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Afectaciones</h2>
                                <p className="text-zinc-500 font-medium">Gestión de fallas masivas y reportes.</p>
                            </div>
                            <div className="flex items-center text-red-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* COMERCIALIZACION */}
            {isModuleEnabled("module_comercializacion") && canAccess("comercializacion", "Comercialización") && (
                <VoiceHint command="Comercialización" side="top">
                    <Link
                        href="/comercializacion"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <ShoppingBag size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <ShoppingBag size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Comercialización</h2>
                                <p className="text-zinc-500 font-medium">Ventas y asesores comerciales.</p>
                            </div>
                            <div className="flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}


            {/* TRANSPORTE / CHOFER */}
            {isModuleEnabled("module_transporte") && (canAccess("transporte", "Transporte") || hasRole("chofer")) && (
                <VoiceHint command="Transporte" side="top">
                    <Link
                        href="/transporte"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Truck size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Truck size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Transporte</h2>
                                <p className="text-zinc-500 font-medium">Control de flota y salidas de vehículos.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* TALLER CARD */}
            {isModuleEnabled("module_taller") && canAccess("taller", "Taller") && (
                <VoiceHint command="Taller" side="top">
                    <Link
                        href="/taller"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Wrench size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Wrench size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Taller Mecánico</h2>
                                <p className="text-zinc-500 font-medium">Gestión de fallas y mantenimiento.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Ir al Taller <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* ALMACEN CARD */}
            {isModuleEnabled("module_almacen") && canAccess("almacen", "Almacén") && (
                <VoiceHint command="Inventario" side="top">
                    <Link
                        href="/almacen"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Package size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Package size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Almacén</h2>
                                <p className="text-zinc-500 font-medium">Control de inventario, productos y stock.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Ir al Almacén <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* SUPERVISOR AUDITORIA */}
            {isModuleEnabled("module_control") && canAccess("auditoria") && (
                <VoiceHint command="Auditoría" side="top">
                    <Link
                        href="/control"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <ShieldCheck size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <ShieldCheck size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Auditoría</h2>
                                <p className="text-zinc-500 font-medium">Fiscalización de material y vehículos por técnico.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Iniciar Auditoría <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* COMBUSTIBLE */}
            {isModuleEnabled("module_combustible") && (canAccess("combustible") || (hasRole("supervisor") && dept === "Transporte")) && (
                <VoiceHint command="Combustible" side="top">
                    <Link
                        href="/control/combustible"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <FileText size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                <FileText size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Combustible</h2>
                                <p className="text-zinc-500 font-medium">Control de cargas de gasolina y QR.</p>
                            </div>
                            <div className="flex items-center text-orange-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Ver Combustible <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* RRHH */}
            {isModuleEnabled("module_rrhh") && canAccess("rrhh", "Recursos Humanos") && (
                <VoiceHint command="RRHH" side="top">
                    <Link
                        href="/rrhh"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-rose-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Users2 size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                <Users2 size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">RRHH</h2>
                                <p className="text-zinc-500 font-medium">Gestión de personal y nómina.</p>
                            </div>
                            <div className="flex items-center text-rose-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* TECNOLOGICO */}
            {isModuleEnabled("module_tecnologico") && canAccess("tecnologico", "Tecnológico") && (
                <VoiceHint command="Tecnológico" side="top">
                    <Link
                        href="/tecnologico"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Cpu size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                                <Cpu size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Tecnológico</h2>
                                <p className="text-zinc-500 font-medium">Sistemas e integraciones.</p>
                            </div>
                            <div className="flex items-center text-slate-800 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}


            {/* ADMIN GENERAL (Only Admin) */}
            {isAdmin && (
                <VoiceHint command="Configuración" side="top">
                    <Link
                        href="/admin"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-zinc-300 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Settings size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Settings size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Panel Admin</h2>
                                <p className="text-zinc-500 font-medium">Configuración global y ajustes del sistema.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Configurar <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}


            {/* GERENCIA (New) */}
            {(isAdmin || (profile?.job_title && (profile.job_title.toLowerCase().includes('gerente') || profile.job_title.toLowerCase().includes('admin')))) && (
                <VoiceHint command="Gerencia" side="top">
                    <Link
                        href="/gerencia"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Activity size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-900 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Activity size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Gerencia</h2>
                                <p className="text-zinc-500 font-medium">Tablero de control y resumen operativo.</p>
                            </div>
                            <div className="flex items-center text-zinc-900 font-semibold group-hover:translate-x-2 transition-transform">
                                Acceder <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* PROCESADOR DE DATOS (Instalaciones) */}
            {(isAdmin || canAccess("tecnico", "Instalación")) && (
                <VoiceHint command="Procesador" side="top">
                    <Link
                        href="/instalaciones"
                        className="group relative overflow-hidden bg-white rounded-[32px] p-8 border border-zinc-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 block"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Zap size={120} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Zap size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 mb-2">Procesador de Datos</h2>
                                <p className="text-zinc-500 font-medium">Control de reportes diarios de instalaciones.</p>
                            </div>
                            <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                                Procesar <span className="ml-2">→</span>
                            </div>
                        </div>
                    </Link>
                </VoiceHint>
            )}

            {/* MI PERFIL */}
            <VoiceHint command="Mi Perfil" side="top" className="md:col-span-2">
                <Link
                    href="/perfil"
                    className="group relative overflow-hidden bg-zinc-900 rounded-[32px] p-8 border border-zinc-800 shadow-sm hover:shadow-xl hover:border-zinc-700 transition-all duration-300 block"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <UserCog size={120} className="text-white" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-colors">
                                <UserCog size={28} />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Mi Perfil</h2>
                            <p className="text-zinc-400 font-medium">Ver información de cuenta y roles asignados.</p>
                        </div>
                        <div className="flex items-center text-white font-semibold group-hover:translate-x-2 transition-transform">
                            Ver Perfil <span className="ml-2">→</span>
                        </div>
                    </div>
                </Link>
            </VoiceHint>


        </div>
    )
}
