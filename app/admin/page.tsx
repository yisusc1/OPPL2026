"use client"

import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid"
import { UserCog, ShieldCheck, LayoutGrid, Database } from "lucide-react"
import Image from "next/image"

const adminSections = [
    {
        name: "Gestión de Módulos",
        description: "Habilitar o deshabilitar paneles del sistema.",
        href: "/admin/configuracion",
        cta: "Configurar",
        icon: LayoutGrid,
        className: "col-span-1 md:col-span-2",
        bg: "/admin-modules.png",
    },
    {
        name: "Gestión de Usuarios",
        description: "Roles, departamentos y permisos de acceso.",
        href: "/admin/usuarios",
        cta: "Gestionar",
        icon: UserCog,
        className: "col-span-1",
        bg: "/admin-users.png",
    },
    {
        name: "Flota Vehicular",
        description: "Vehículos, mantenimiento y asignaciones.",
        href: "/admin/vehiculos",
        cta: "Ver Flota",
        icon: ShieldCheck,
        className: "col-span-1",
        bg: "/admin-fleet.png",
    },
    {
        name: "Base de Datos",
        description: "Limpieza y reseteo para testing.",
        href: "/admin/database",
        cta: "Administrar",
        icon: Database,
        className: "col-span-1 md:col-span-2",
        bg: "/admin-database.png",
    },
]

export default function AdminDashboard() {
    return (
        <PremiumPageLayout
            title="Panel de Administración"
            description="Configuración global del sistema y accesos."
        >
            <BentoGrid>
                {adminSections.map((s) => (
                    <BentoCard
                        key={s.name}
                        name={s.name}
                        description={s.description}
                        href={s.href}
                        cta={s.cta}
                        Icon={s.icon}
                        className={`${s.className} !bg-zinc-950`}
                        background={
                            <div className="absolute inset-0">
                                <Image
                                    src={s.bg}
                                    alt={s.name}
                                    fill
                                    className="object-cover opacity-55 group-hover:opacity-70 transition-all duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/30 to-transparent" />
                            </div>
                        }
                    />
                ))}
            </BentoGrid>
        </PremiumPageLayout>
    )
}
