"use client"

import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { ArrowLeft, UserCog, ShieldCheck, LayoutGrid, ArrowRight, Database } from "lucide-react"
import Link from "next/link"

export default function AdminDashboard() {
    return (
        <PremiumPageLayout
            title="Panel de Administración"
            description="Configuración global del sistema y accesos."
        >
            <div className="mb-6">
                <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ArrowLeft size={20} />
                    <span>Volver al inicio</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* GESTION DE MODULOS */}
                <Link href="/admin/configuracion" className="block md:col-span-2 lg:col-span-1">
                    <PremiumCard className="h-full">
                        <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
                            <div className="flex items-start justify-between">
                                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                    <LayoutGrid size={32} />
                                </div>
                                <ArrowRight className="text-muted-foreground" size={20} />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-foreground mb-2">Gestión de Módulos</h3>
                                <p className="text-muted-foreground text-sm">Habilitar o deshabilitar paneles del sistema.</p>
                            </div>
                        </div>
                    </PremiumCard>
                </Link>

                {/* USUARIOS */}
                <Link href="/admin/usuarios" className="block">
                    <PremiumCard className="h-full">
                        <div className="flex flex-col h-full gap-4">
                            <div className="p-3 w-fit rounded-xl bg-primary/10 text-primary">
                                <UserCog size={24} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-foreground text-lg">Gestión de Usuarios</h3>
                                <p className="text-sm text-muted-foreground">Roles, departamentos y permisos de acceso.</p>
                            </div>
                        </div>
                    </PremiumCard>
                </Link>

                {/* VEHICULOS */}
                <Link href="/admin/vehiculos" className="block">
                    <PremiumCard className="h-full">
                        <div className="flex flex-col h-full gap-4">
                            <div className="p-3 w-fit rounded-xl bg-primary/10 text-primary">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-foreground text-lg">Flota Vehicular</h3>
                                <p className="text-sm text-muted-foreground">Coches, mantenimiento y asignaciones.</p>
                            </div>
                        </div>
                    </PremiumCard>
                </Link>

                {/* DATABASE TOOLS */}
                <Link href="/admin/database" className="block">
                    <PremiumCard className="h-full">
                        <div className="flex flex-col h-full gap-4">
                            <div className="p-3 w-fit rounded-xl bg-primary/10 text-primary">
                                <Database size={24} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-foreground text-lg">Base de Datos</h3>
                                <p className="text-sm text-muted-foreground">Limpieza y reseteo para testing.</p>
                            </div>
                        </div>
                    </PremiumCard>
                </Link>

            </div>
        </PremiumPageLayout>
    )
}
