"use client";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Map as MapIcon,
  LayoutDashboard,
  ShieldCheck,
  Package,
  Settings,
  Users2,
  Headphones,
  Wrench,
  Truck,
  Activity,
  ShoppingBag,
  CalendarRange,
  Network,
  UserCog,
  Headset,
  Cpu,
  Zap
} from "lucide-react";
import { useUser } from "@/components/providers/user-provider";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { INITIAL_MODULES_CONFIG } from "@/lib/constants";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

export default function Home() {
  const { hasRole, isAdmin, isLoading: isUserLoading, profile } = useUser();
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Initialize with defaults
        const settings: Record<string, boolean> = {};
        INITIAL_MODULES_CONFIG.forEach(m => settings[m.key] = m.default);

        const supabase = createClient();
        const { data, error } = await supabase.from('app_settings').select('*');

        if (data && !error) {
          data.forEach((item: any) => {
            settings[item.key] = item.value;
          });
        }
        setEnabledModules(settings);
      } catch (e) {
        console.error("Error loading module settings", e);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  const dept = profile?.department;

  const canAccess = (roleKey: string, deptName?: string) => {
    if (isAdmin) return true;
    if (hasRole(roleKey as any)) return true;
    if (deptName && dept === deptName) {
      if (hasRole('chofer') && roleKey !== 'transporte') return false;
      return true;
    }
    return false;
  };

  const isModuleEnabled = (key: string) => {
    return enabledModules[key] !== false;
  };

  if (isUserLoading || loadingSettings) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Cargando panel...</p>
        </div>
      </div>
    );
  }

  const userName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'Usuario';

  // Define modules data
  const allModules = [
    {
      key: "module_map",
      title: "Mapa",
      description: "Mapa interactivo de infraestructura de red.",
      icon: MapIcon,
      href: "/map",
      cta: "Ver Mapa",
      bgImage: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=60&w=500", // Map/Abstract
      className: "col-span-1 md:col-span-2", // Feature item
      show: isModuleEnabled("module_map") && (isAdmin || hasRole("mapa"))
    },
    {
      key: "module_dashboard",
      title: "Dashboard",
      description: "Métricas y estadísticas en tiempo real.",
      icon: LayoutDashboard,
      href: "/dashboard",
      cta: "Ver Dashboard",
      bgImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=60&w=500", // Data/Charts
      className: "col-span-1",
      show: isModuleEnabled("module_dashboard") && (isAdmin || hasRole("dashboard"))
    },
    {
      key: "module_tecnicos",
      title: "Instalaciones",
      description: "Gestión de instalaciones de fibra óptica.",
      icon: Wrench,
      href: "/tecnicos",
      cta: "Gestionar",
      bgImage: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=60&w=500", // Tech/Work
      className: "col-span-1",
      show: isModuleEnabled("module_tecnicos") && canAccess("tecnico", "Instalación")
    },
    {
      key: "module_procesador",
      title: "Procesador de Datos",
      description: "Control de reportes diarios de instalaciones.",
      icon: Zap,
      href: "/instalaciones",
      cta: "Procesar",
      bgImage: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=60&w=500", // Chips/Tech
      className: "col-span-1",
      show: isModuleEnabled("module_procesador") && (isAdmin || hasRole("procesador") || canAccess("tecnico", "Instalación") || (profile?.job_title && (profile.job_title.toLowerCase().includes('gerente'))))
    },
    {
      key: "module_transporte",
      title: "Transporte",
      description: "Control de flota y salidas.",
      icon: Truck,
      href: "/transporte",
      cta: "Ver Flota",
      bgImage: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=60&w=500", // Truck/Road
      className: "col-span-1",
      show: isModuleEnabled("module_transporte") && (canAccess("transporte", "Transporte") || hasRole("chofer"))
    },
    {
      key: "admin_panel",
      title: "Administración",
      description: "Gestión de usuarios y configuración.",
      icon: Settings,
      href: "/admin",
      cta: "Administrar",
      bgImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=60&w=500", // Office/Building
      className: "col-span-1",
      show: isAdmin
    },
    {
      key: "module_control",
      title: "Auditoría",
      description: "Fiscalización y control de calidad.",
      icon: ShieldCheck,
      href: "/control",
      cta: "Auditar",
      bgImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=60&w=500", // Audit/Paperwork
      className: "col-span-1",
      show: isModuleEnabled("module_control") && canAccess("auditoria")
    },
    {
      key: "module_gerencia",
      title: "Gerencia",
      description: "Informes gerenciales y KPI.",
      icon: Activity,
      href: "/gerencia",
      cta: "Ver Informes",
      bgImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=60&w=500", // Business/Charts
      className: "col-span-1",
      show: isModuleEnabled("module_gerencia") && (isAdmin || hasRole("gerencia") || (profile?.job_title && (profile.job_title.toLowerCase().includes('gerente') || profile.job_title.toLowerCase().includes('admin'))))
    },
    {
      key: "module_almacen",
      title: "Almacén",
      description: "Control de inventario y stock.",
      icon: Package,
      href: "/almacen",
      cta: "Inventario",
      bgImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=60&w=500", // Warehouse
      className: "col-span-1",
      show: isModuleEnabled("module_almacen") && canAccess("almacen", "Almacén")
    },
    // The other empty modules (rrhh, soporte, comercializacion, etc) have been removed
    // Adding other modules with simple patterns if not high priority
    {
      key: "module_taller",
      title: "Taller Mecánico",
      description: "Mantenimiento y reparación.",
      icon: Wrench,
      href: "/taller",
      cta: "Entrar",
      bgImage: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&q=60&w=500", // Mechanic
      className: "col-span-1",
      show: isModuleEnabled("module_taller") && canAccess("taller", "Taller")
    },
    {
      key: "module_combustible",
      title: "Combustible",
      description: "Control de cargas de gasolina.",
      icon: Truck,
      href: "/control/combustible",
      cta: "Controlar",
      bgImage: "https://images.unsplash.com/photo-1527018601619-a508a2be00cd?auto=format&fit=crop&q=60&w=500", // Gas Station
      className: "col-span-1",
      show: isModuleEnabled("module_combustible") && (canAccess("combustible") || (hasRole("supervisor") && dept === "Transporte"))
    },
    {
      key: "user_profile",
      title: "Mi Perfil",
      description: "Información de cuenta.",
      icon: UserCog,
      href: "/perfil",
      cta: "Ver Perfil",
      bgImage: "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&q=60&w=500", // Abstract Profile
      className: "col-span-1",
      show: true
    }
  ];

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-background selection:bg-primary/20">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <div className="relative z-40 mx-auto max-w-7xl px-4 py-12 md:py-20 lg:py-24">
        <div className="mb-8 md:mb-12 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Panel de Control
          </h1>
          <p className="mt-4 text-muted-foreground md:text-lg">
            Bienvenido, {userName}
          </p>
        </div>

        <BentoGrid>
          {allModules.filter(m => m.show).map((module) => (
            <BentoCard
              key={module.key}
              name={module.title}
              className={module.className || "col-span-1"}
              background={
                <div className="absolute inset-0 w-full h-full">
                  <img
                    src={module.bgImage} // fallback to a gradient if needed in future
                    alt=""
                    className="h-full w-full object-cover opacity-90 dark:opacity-30 transition-opacity group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent dark:from-black dark:via-black/40 dark:to-transparent" />
                </div>
              }
              Icon={module.icon}
              description={module.description}
              href={module.href}
              cta={module.cta}
            />
          ))}
        </BentoGrid>
      </div>

      <div className="fixed inset-0 z-0 pointer-events-none">
        <BackgroundPaths />
      </div>
    </div>
  );
}

