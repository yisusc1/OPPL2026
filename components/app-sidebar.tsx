"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useUser } from "@/components/providers/user-provider"
import { EllielLogo } from "@/components/ui/elliel-logo"
import {
  LayoutDashboard,
  Home,
  Package,
  Truck,
  Wrench,
  PenTool,
  Users,
  ShieldCheck,
  UserCircle,
  Briefcase,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoutButton } from "@/components/ui/logout-button"

// Modules definitions mapped to roles
// Some titles and URLs reflect the structure viewed in current app logic
type NavItem = {
  title: string
  url?: string
  icon: any
  roles: string[]
  items?: { title: string; url: string; roles?: string[] }[]
}

const modules: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["Gerente", "Admin", "Coordinador"] },
  { 
    title: "Ventas", 
    icon: Home, 
    roles: ["Gerente", "Asesor", "Coordinador", "Admin"],
    items: [
      { title: "Dashboard Ventas", url: "/ventas" },
      { title: "Actividades", url: "/ventas/actividades" },
      { title: "Solicitudes", url: "/ventas/solicitudes" },
    ]
  },
  {
    title: "Almacén",
    icon: Package,
    roles: ["Gerente", "Admin", "Logistica", "Almacen"],
    items: [
      { title: "Dashboard Almacén", url: "/almacen" },
      { title: "Productos", url: "/almacen/productos" },
      { title: "Rastreo", url: "/almacen/rastreo" },
      { title: "Seriales", url: "/almacen/seriales" },
      { title: "Asignaciones", url: "/almacen/historial-asignaciones" },
      { title: "Bajas", url: "/almacen/bajas" },
      { title: "Historial", url: "/almacen/historial" }
    ]
  },
  { title: "Transporte", url: "/transporte", icon: Truck, roles: ["Gerente", "Admin", "Logistica", "Chofer"] },
  { title: "Instalaciones", url: "/instalaciones", icon: Wrench, roles: ["Gerente", "Admin", "Coordinador", "Técnico"] },
  { title: "Taller", url: "/taller", icon: PenTool, roles: ["Gerente", "Admin", "Taller"] },
  {
    title: "Control",
    icon: Briefcase,
    roles: ["Gerente", "Admin", "Controlaría"],
    items: [
      { title: "Dashboard Control", url: "/control" },
      { title: "Auditoría", url: "/control/audit" },
      { title: "Combustible", url: "/control/combustible" },
      { title: "Reportes", url: "/control/report" },
      { title: "Spools", url: "/control/spools" },
      { title: "Historial", url: "/control/history" }
    ]
  },
  {
    title: "Administrador",
    icon: Users,
    roles: ["Gerente", "Admin"],
    items: [
      { title: "Dashboard Admin", url: "/admin" },
      { title: "Usuarios", url: "/admin/users" },
      { title: "Gestión de Planes", url: "/admin/planes" },
      { title: "Configuración", url: "/admin/settings" }
    ]
  },
  { title: "Perfil y Ajustes", url: "/perfil", icon: UserCircle, roles: ["ALL"] }
]

export function AppSidebar() {
  const { profile } = useUser()
  const pathname = usePathname()

  if (!profile) return null

  const userRole = profile.job_title || "Asesor"

  // Filter modules based on if the user role is present in the module's roles list
  // Note: Adjust the job_title strings to match exactly what you use in DB.
  const allowedModules = modules.filter(m => 
    m.roles.includes("ALL") || 
    m.roles.some(r => userRole.toLowerCase().includes(r.toLowerCase()))
  )

  return (
    <Sidebar className="border-r border-border/40 shadow-sm">
      <SidebarHeader className="h-16 flex items-center justify-center px-4 border-b border-border/40 bg-zinc-50 dark:bg-zinc-900/40">
        <EllielLogo width={80} className="mt-1" />
      </SidebarHeader>
      
      <SidebarContent className="bg-zinc-50 dark:bg-zinc-900/40 px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Panel de Control
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {allowedModules.map((item) => {
                const isGroupActive = item.url ? pathname.startsWith(item.url) : (item.items?.some(sub => pathname.startsWith(sub.url)) || false)
                
                if (item.items && item.items.length > 0) {
                  return (
                    <Collapsible
                      key={item.title}
                      defaultOpen={isGroupActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer w-full flex items-center justify-between ${
                              isGroupActive 
                              ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold' 
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon size={18} className={isGroupActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'} />
                              <span>{item.title}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90 text-zinc-400" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="mt-1">
                            {item.items.map((subItem) => {
                              const isSubActive = pathname === subItem.url || pathname.startsWith(subItem.url + "/")
                              return (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton 
                                    asChild 
                                    isActive={isSubActive}
                                    className={`h-9 px-3 rounded-md text-sm font-medium transition-colors ${
                                      isSubActive 
                                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400' 
                                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
                                    }`}
                                  >
                                    <Link href={subItem.url} className="w-full">
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isGroupActive}
                      className={`h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                        isGroupActive 
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Link href={item.url!} className="flex items-center gap-3">
                        <item.icon size={18} className={isGroupActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex flex-col gap-3">
           <div className="flex flex-col bg-white dark:bg-zinc-950 p-3 rounded-xl border border-border/40 shadow-sm">
             <span className="text-sm font-bold text-foreground truncate">
               {profile.first_name} {profile.last_name || ""}
             </span>
             <span className="text-xs text-muted-foreground truncate font-medium mt-0.5">
               {profile.job_title}
             </span>
           </div>
           <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
