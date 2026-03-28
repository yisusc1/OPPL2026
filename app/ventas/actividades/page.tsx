"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Send, CheckCircle2, ClipboardList, Users,
  FileText, MapPin, Building2, NotebookPen, History, CalendarDays, ChevronDown
} from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/user-provider";
import {
  getActividades,
  deleteActividad,
  getSolicitudesPorActividades,
  cerrarJornada,
  autoCerrarActividadesAntiguas,
  getHistorialActividades,
} from "@/app/actions/ventas";

const SUPERVISOR_TITLES = ["Gerente", "Coordinador"];

// Format "HH:MM:SS" or "HH:MM" to readable time
function formatHora(hora: string) {
  if (!hora) return "";
  if (hora.includes("a.") || hora.includes("p.")) return hora;
  const parts = hora.split(":");
  let h = parseInt(parts[0]);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "p. m." : "a. m.";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

function formatFechaVE(fechaStr: string) {
  const [y, m, d] = fechaStr.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

// Venezuela today (client-side approximation using offset)
function getVenezuelaTodayClient(): string {
  const now = new Date();
  const vzNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Caracas" }));
  return vzNow.toISOString().split("T")[0];
}

export default function ActividadesPage() {
  const { toast } = useToast();
  const { profile, isLoading: isUserLoading } = useUser();
  const [actividades, setActividades] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filterAsesor, setFilterAsesor] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState("hoy");
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  const todayStr = getVenezuelaTodayClient();
  const currentAsesor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";
  const isSupervisor = SUPERVISOR_TITLES.includes(profile?.job_title || "");

  useEffect(() => {
    if (profile) {
      loadActividades();
      // Auto-close old activities (Venezuela timezone handled server-side)
      if (!isSupervisor && currentAsesor) {
        autoCerrarActividadesAntiguas(currentAsesor).catch(console.error);
      }
    }
  }, [profile]);

  async function loadActividades(asesorFilter?: string) {
    setLoading(true);
    try {
      const asesor = isSupervisor ? (asesorFilter || undefined) : currentAsesor;
      const fecha = isSupervisor ? undefined : todayStr;
      const cerrada = isSupervisor ? undefined : false;
      const data = await getActividades(asesor, fecha, cerrada);
      setActividades(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistorial() {
    setLoadingHistorial(true);
    try {
      const asesor = isSupervisor ? (filterAsesor || undefined) : currentAsesor;
      const data = await getHistorialActividades(asesor);
      setHistorial(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistorial(false);
    }
  }

  // Load historial when tab switches to it
  useEffect(() => {
    if (activeTab === "historial" && historial.length === 0) {
      loadHistorial();
    }
  }, [activeTab]);

  async function handleDelete(id: number) {
    try {
      await deleteActividad(id);
      setActividades((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Actividad eliminada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleCierreJornada() {
    if (actividades.length === 0) return;
    setGeneratingReport(true);

    try {
      // Filtrar estrictamente solo las solicitudes de las actividades abiertas en este momento
      const actividadesIds = actividades.map(a => a.id);
      const solicitudes = await getSolicitudesPorActividades(actividadesIds);
      const date = new Date().toLocaleDateString("es-ES");

      let totalCap = 0, totalVol = 0, totalLlamInfo = 0;
      actividades.forEach((a) => {
        totalCap += a.clientes_captados || 0;
        totalVol += a.volantes || 0;
        totalLlamInfo += a.llamadas_info || 0;
      });
      const totalLlamAgenda = solicitudes.filter((s: any) => s.fuente === "Llamada").length;

      // Plain text report — no emojis
      let msg = `REPORTE DIARIO\n`;
      msg += `Fecha: ${date}\n`;
      msg += `Asesor: ${currentAsesor}\n\n`;

      msg += `RESUMEN\n`;
      msg += `Solicitudes confirmadas: ${solicitudes.length}\n`;
      msg += `Clientes captados:  ${totalCap}\n`;
      if (totalVol > 0) msg += `Volantes entregados:   ${totalVol}\n`;
      if (totalLlamInfo > 0) msg += `Llamadas (info):  ${totalLlamInfo}\n`;
      if (totalLlamAgenda > 0) msg += `Llamadas (agenda):  ${totalLlamAgenda}\n`;

      msg += `\nACTIVIDADES (${actividades.length})\n`;
      actividades.forEach((act, i) => {
        msg += `\n  ${i + 1}. ${act.tipo} (${formatHora(act.hora)})\n`;

        const locParts = [];
        if (act.estado && act.estado !== "N/A") locParts.push(act.estado);
        if (act.municipio && act.municipio !== "N/A") locParts.push(act.municipio);
        if (act.parroquia && act.parroquia !== "N/A") locParts.push(act.parroquia);
        if (act.sector) locParts.push("sector " + act.sector);
        if (locParts.length > 0) msg += `  Ubicación: ${locParts.join(", ")}\n`;

        if (act.condominio) msg += `  Condominio: ${act.condominio}\n`;
        msg += `  Clientes captados:  ${act.clientes_captados || 0}\n`;
        msg += `  Solicitudes enviadas: ${act.solicitudes_count || 0}\n`;
        if ((act.volantes || 0) > 0) msg += `  Volantes entregados: ${act.volantes}\n`;

        const actLlamadasAgenda = solicitudes.filter((s: any) => s.actividad_id === act.id && s.fuente === "Llamada").length;

        if ((act.llamadas_info || 0) > 0 || actLlamadasAgenda > 0) {
          msg += `  Llamadas recibidas:\n`;
          if (act.llamadas_info > 0) msg += `    Buscaban info:  ${act.llamadas_info}\n`;
          if (actLlamadasAgenda > 0) msg += `    Para agendar:  ${actLlamadasAgenda}\n`;
        }

        if (act.notas) msg += `  Obs: ${act.notas}\n`;
      });

      if (solicitudes.length > 0) {
        msg += `\nSOLICITUDES (${solicitudes.length})\n`;
        solicitudes.forEach((sol: any, i: number) => {
          msg += `  ${i + 1}. ${sol.nombres} ${sol.apellidos} - ${sol.cedula} - ${sol.telefono_principal}\n`;
        });
      }

      // 1. Open WhatsApp
      window.open(`https://wa.me/?text=${encodeURIComponent(msg.trim())}`, "_blank");

      // 2. Mark activities as closed
      const result = await cerrarJornada(currentAsesor, todayStr);

      // 3. Move closed activities out of "Hoy" view
      setActividades([]);
      // Reset historial so it reloads when switched to
      setHistorial([]);

      toast({ title: `Jornada cerrada — ${result.cerradas} actividades archivadas` });
    } catch (e: any) {
      toast({ title: "Error generando reporte", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  }

  function buildLocationStr(act: any) {
    const parts = [];
    if (act.estado && act.estado !== "N/A") parts.push(act.estado);
    if (act.municipio && act.municipio !== "N/A") parts.push(act.municipio);
    if (act.parroquia && act.parroquia !== "N/A") parts.push(act.parroquia);
    if (act.sector) parts.push(act.sector);
    return parts.join(" > ");
  }

  // Group historial by fecha
  const historialGrouped: Record<string, any[]> = {};
  historial.forEach((act) => {
    const key = act.fecha;
    if (!historialGrouped[key]) historialGrouped[key] = [];
    historialGrouped[key].push(act);
  });
  const historialDates = Object.keys(historialGrouped).sort((a, b) => b.localeCompare(a));

  function toggleDate(fecha: string) {
    setExpandedDates((prev) =>
      prev.includes(fecha) ? prev.filter((d) => d !== fecha) : [...prev, fecha]
    );
  }

  // ── Render helpers ──

  function renderActivityCard(act: any, showDelete: boolean) {
    const locStr = buildLocationStr(act);
    return (
      <div key={act.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-tight">{act.tipo}</h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatHora(act.hora)} · {new Date(act.fecha).toLocaleDateString("es-ES")}
              {isSupervisor && <span className="ml-2 text-violet-500 font-semibold">{act.asesor}</span>}
            </p>
          </div>
          {showDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600">
                  <Trash2 size={15} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(act.id)}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Body */}
        <div className="px-5 pb-3 space-y-1.5">
          {locStr && (
            <div className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>{locStr}</span>
            </div>
          )}
          {act.condominio && (
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Building2 size={14} className="shrink-0 text-blue-500" />
              <span>{act.condominio}</span>
            </div>
          )}
          {act.notas && (
            <div className="flex items-start gap-2 text-sm text-zinc-500 italic">
              <NotebookPen size={14} className="mt-0.5 shrink-0 text-zinc-400" />
              <span>{act.notas}</span>
            </div>
          )}
        </div>

        {/* Metrics bar */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 flex items-center gap-3 flex-wrap border-t border-zinc-100 dark:border-zinc-800">
          <Badge variant="outline" className="text-xs">
            {act.clientes_captados || 0} captados
          </Badge>
          {(act.volantes || 0) > 0 && (
            <Badge variant="outline" className="text-xs">
              {act.volantes} volantes
            </Badge>
          )}
          <Badge
            variant={act.solicitudes_count > 0 ? "default" : "outline"}
            className={`text-xs ${act.solicitudes_count > 0 ? "bg-blue-600 hover:bg-blue-700" : ""}`}
          >
            <FileText size={12} className="mr-1" /> {act.solicitudes_count || 0} solicitudes
          </Badge>

          {showDelete && !isSupervisor && (
            <Link href={`/ventas/solicitudes/nueva?actividad_id=${act.id}&fuente_actividad=${encodeURIComponent(act.tipo)}`} className="ml-auto">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                <Plus size={14} /> Solicitud
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <PremiumPageLayout
      title="Actividades"
      description={
        isSupervisor
          ? "Vista de Supervisor - Todo el equipo"
          : currentAsesor ? `Asesor: ${currentAsesor}` : "Reporte diario de actividades de campo."
      }
    >
      {/* Supervisor Filter */}
      {isSupervisor && (
        <div className="flex gap-2 mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 shrink-0">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Filtrar por Asesor</span>
          </div>
          <Input
            placeholder="Nombre del asesor (vacío para ver todos)..."
            value={filterAsesor}
            onChange={(e) => setFilterAsesor(e.target.value)}
            className="flex-1 h-9"
          />
          <Button size="sm" onClick={() => { loadActividades(filterAsesor || undefined); if (activeTab === "historial") loadHistorial(); }} className="shrink-0">
            Filtrar
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="hoy" className="gap-1.5">
            <CalendarDays size={15} /> Hoy
            {actividades.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{actividades.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5">
            <History size={15} /> Historial
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Hoy ── */}
        <TabsContent value="hoy">
          {/* New Activity Button */}
          {currentAsesor && !isSupervisor && (
            <Link href="/ventas/actividades/nueva">
              <Button className="w-full mb-6 h-12 text-base gap-2 rounded-xl" size="lg">
                <Plus size={20} /> Añadir Actividad
              </Button>
            </Link>
          )}

          {isUserLoading || (loading && actividades.length === 0) ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-primary" />
            </div>
          ) : !currentAsesor ? (
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <ClipboardList className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">No se pudo identificar tu perfil</p>
            </div>
          ) : actividades.length === 0 ? (
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
              <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">No hay actividades abiertas</h3>
              <p className="text-sm text-zinc-500">
                {isSupervisor ? "Sin actividades con este filtro." : "Añade una actividad para comenzar tu reporte diario."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1 mb-4">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                  {isSupervisor ? `Total: ${actividades.length} actividades` : `Hoy (${actividades.length})`}
                </h3>
              </div>

              <div className="space-y-4 mb-6">
                {actividades.map((act) => renderActivityCard(act, true))}
              </div>

              {/* Cierre de Jornada */}
              {!isSupervisor && (
                <div className="flex flex-col gap-3 pb-6">
                  <Button
                    onClick={handleCierreJornada}
                    disabled={generatingReport}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 h-14 rounded-xl text-base font-bold"
                  >
                    {generatingReport ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send size={18} />
                    )}
                    Cierre de Jornada
                  </Button>
                  <p className="text-xs text-center text-zinc-400">
                    Archiva las actividades del día, genera el reporte completo y lo envía por WhatsApp.
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── TAB: Historial ── */}
        <TabsContent value="historial">
          {loadingHistorial ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-primary" />
            </div>
          ) : historialDates.length === 0 ? (
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
              <History className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
              <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">Sin historial</h3>
              <p className="text-sm text-zinc-500">Las jornadas cerradas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historialDates.map((fecha) => {
                const acts = historialGrouped[fecha];
                const isExpanded = expandedDates.includes(fecha);
                const totalCap = acts.reduce((sum: number, a: any) => sum + (a.clientes_captados || 0), 0);
                const totalSol = acts.reduce((sum: number, a: any) => sum + (a.solicitudes_count || 0), 0);
                const totalVol = acts.reduce((sum: number, a: any) => sum + (a.volantes || 0), 0);

                return (
                  <div key={fecha} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                    {/* Date Summary Header */}
                    <button
                      onClick={() => toggleDate(fecha)}
                      className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors text-left"
                    >
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 capitalize">
                          {formatFechaVE(fecha)}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{acts.length} actividades</Badge>
                          <Badge variant="outline" className="text-xs">{totalCap} captados</Badge>
                          {totalSol > 0 && (
                            <Badge className="text-xs bg-blue-600 hover:bg-blue-700">
                              {totalSol} solicitudes
                            </Badge>
                          )}
                          {totalVol > 0 && (
                            <Badge variant="outline" className="text-xs">{totalVol} volantes</Badge>
                          )}
                          {isSupervisor && (
                            <span className="text-xs text-violet-500 font-medium">
                              {[...new Set(acts.map((a: any) => a.asesor))].join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        size={20}
                        className={`text-zinc-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Expanded Activities */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-3">
                        {acts.map((act: any) => renderActivityCard(act, false))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PremiumPageLayout>
  );
}
