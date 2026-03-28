"use client";

import Link from "next/link";
import { ClipboardList, FileText, ArrowRight, ShieldX } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { useUser } from "@/components/providers/user-provider";

const SUPERVISOR_TITLES = ["Gerente", "Coordinador"];

export default function VentasPage() {
  const { profile, isLoading } = useUser();

  // Check access: must be in Comercialización OR have manual 'ventas' role
  const isComercializacion = profile?.department === "Comercialización";
  const hasVentasRole = Array.isArray(profile?.roles) && profile.roles.includes("ventas");
  const hasAccess = isComercializacion || hasVentasRole;
  const isSupervisor = SUPERVISOR_TITLES.includes(profile?.job_title || "");

  const modules = [
    {
      title: "Actividades",
      description: isSupervisor
        ? "Reporte diario del equipo completo de ventas."
        : "Reporte diario de visitas, recorridos y captación de clientes.",
      icon: ClipboardList,
      href: "/ventas/actividades",
      accent: "blue",
    },
    {
      title: "Solicitudes",
      description: isSupervisor
        ? "Registro y supervisión de prospectos del equipo."
        : "Registro de prospectos y ventas de servicios de fibra.",
      icon: FileText,
      href: "/ventas/solicitudes",
      accent: "violet",
    },
  ];

  const accentStyles: Record<string, { iconBg: string; iconColor: string }> = {
    blue: {
      iconBg: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    violet: {
      iconBg: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
  };

  if (isLoading) {
    return (
      <PremiumPageLayout title="Ventas" description="Cargando...">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-primary" />
        </div>
      </PremiumPageLayout>
    );
  }

  if (!hasAccess) {
    return (
      <PremiumPageLayout title="Ventas" description="">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="font-bold text-xl text-zinc-900 dark:text-zinc-100">Acceso Restringido</h2>
          <p className="text-sm text-zinc-500 max-w-xs">
            Este módulo es exclusivo del departamento de <strong>Comercialización</strong>. Si necesitas acceso, contacta a un administrador.
          </p>
        </div>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout
      title="Ventas"
      description={
        isSupervisor
          ? `Vista de Supervisor · ${profile?.job_title}`
          : "Gestión de actividades comerciales y solicitudes de servicio."
      }
    >
      {isSupervisor && (
        <div className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-semibold">👁 Vista Supervisor:</span> Puedes ver y filtrar los registros de todo el equipo.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => {
          const style = accentStyles[mod.accent];
          return (
            <Link key={mod.title} href={mod.href} className="group block">
              <div className="h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-[0.06] transition-opacity transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0">
                  <mod.icon size={96} strokeWidth={1} />
                </div>
                <div className="flex flex-col h-full justify-between relative z-10">
                  <div className={`w-14 h-14 rounded-xl ${style.iconBg} ${style.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <mod.icon size={28} />
                  </div>
                  <div>
                    <h2 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 mb-2">{mod.title}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{mod.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                    <span>Entrar</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </PremiumPageLayout>
  );
}
