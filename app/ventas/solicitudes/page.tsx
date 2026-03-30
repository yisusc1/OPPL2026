"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Search, Send, Phone, Mail, MapPin } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUser } from "@/components/providers/user-provider";
import { getSolicitudes } from "@/app/actions/ventas";
import { getTvLabel } from "@/app/admin/settings-actions";

function buildWaMessage(sol: any, tvLabel: string) {
  const todayStr = new Date(sol.fecha_solicitud).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatDate = (d: string) => {
    if (!d) return "";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  let msg = `Fecha de solicitud: ${todayStr}\n`;
  msg += `Fecha de Disponibilidad: ${sol.fecha_disponibilidad ? formatDate(sol.fecha_disponibilidad) : ""}\n\n`;
  msg += `Nombres: ${sol.nombres} Apellidos: ${sol.apellidos}\n`;
  msg += `Cédula/RIF: ${sol.cedula}\n`;
  msg += `Estado: ${sol.estado}, Municipio: ${sol.municipio}, Parroquia: ${sol.parroquia}`;
  if (sol.sector) msg += `, Sector: ${sol.sector}`;
  msg += `, Calle / Casa / Apto: ${sol.direccion || ""}\n`;
  msg += `Tipo de Servicio: ${sol.tipo_servicio}\n`;
  msg += `Plan: ${sol.plan}\n`;
  msg += `Promotor/a: ${sol.promotor}\n`;
  msg += `Teléfono principal: ${sol.telefono_principal}\n`;
  msg += `Teléfono secundario: ${sol.telefono_secundario || sol.telefono_principal}\n`;
  msg += `Correo Electrónico: ${sol.correo || ""}\n`;
  msg += `${tvLabel}: ${sol.power_go ? "SI" : "NO"}\n`;
  msg += `Fuente: ${sol.fuente || ""}`;
  return msg;
}

export default function SolicitudesPage() {
  const { profile } = useUser();
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tvLabel, setTvLabel] = useState("TV");

  const promotor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  useEffect(() => {
    if (promotor) loadData();
  }, [promotor]);

  async function loadData(searchTerm?: string) {
    setLoading(true);
    try {
      const [data, tvLab] = await Promise.all([
        getSolicitudes({
          promotor,
          search: searchTerm || undefined,
        }),
        getTvLabel()
      ]);
      setSolicitudes(data);
      setTvLabel(tvLab);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!promotor) return;
    const timeout = setTimeout(() => loadData(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  function handleSendWa(sol: any) {
    const msg = buildWaMessage(sol, tvLabel);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <PremiumPageLayout title="Solicitudes" description={`Historial de solicitudes de ${promotor}`}>
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Link href="/ventas/solicitudes/nueva" className="flex-shrink-0">
          <Button className="w-full sm:w-auto h-11 gap-2 rounded-xl" size="lg">
            <Plus size={18} /> Nueva Solicitud
          </Button>
        </Link>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-primary" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
          <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">No hay solicitudes</h3>
          <p className="text-sm text-zinc-500">Crea una nueva solicitud para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 px-1">{solicitudes.length} solicitudes encontradas</p>
          {solicitudes.map((sol) => {
            const isExpanded = expandedId === sol.id;

            return (
              <div
                key={sol.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden"
              >
                {/* Summary row — always visible */}
                <div
                  className="p-5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : sol.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                        {sol.nombres} {sol.apellidos}
                      </h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {sol.cedula} · {sol.telefono_principal}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {new Date(sol.fecha_solicitud).toLocaleDateString("es-ES")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sol.estatus_planificacion && (
                      <Badge variant="outline" className={
                        sol.estatus_planificacion === 'pendiente' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0' :
                        sol.estatus_planificacion === 'agendado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0' :
                        sol.estatus_planificacion === 'instalada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0' :
                        sol.estatus_planificacion === 'reagendada' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0' :
                        sol.estatus_planificacion === 'cancelada' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0' : ''
                      }>
                        {sol.estatus_planificacion.charAt(0).toUpperCase() + sol.estatus_planificacion.slice(1)}
                      </Badge>
                    )}
                    <Badge variant="outline">{sol.plan}</Badge>
                    <Badge variant="outline">{sol.tipo_servicio}</Badge>
                    {sol.power_go && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 border-0">{tvLabel}</Badge>}
                    <span className="text-xs text-zinc-400">
                      {sol.parroquia}{sol.sector ? `, ${sol.sector}` : ""}
                    </span>
                    {sol.actividad_id && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800 text-xs">
                        Vinculada
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <div>
                        <span className="text-zinc-400">Cédula:</span>
                        <span className="ml-2 text-zinc-900 dark:text-zinc-100 font-medium">{sol.cedula}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Género:</span>
                        <span className="ml-2 text-zinc-900 dark:text-zinc-100">{sol.genero}</span>
                      </div>
                      <div className="col-span-2 flex items-start gap-1.5">
                        <MapPin size={14} className="mt-0.5 text-zinc-400 shrink-0" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {sol.estado} {'>'} {sol.municipio} {'>'} {sol.parroquia}{sol.sector ? ` > ${sol.sector}` : ""}
                        </span>
                      </div>
                      {sol.direccion && (
                        <div className="col-span-2">
                          <span className="text-zinc-400">Dirección:</span>
                          <span className="ml-2 text-zinc-700 dark:text-zinc-300">{sol.direccion}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-zinc-400" />
                        <span className="text-zinc-900 dark:text-zinc-100">{sol.telefono_principal}</span>
                      </div>
                      {sol.telefono_secundario && (
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-zinc-400" />
                          <span className="text-zinc-700 dark:text-zinc-300">{sol.telefono_secundario}</span>
                        </div>
                      )}
                      {sol.correo && (
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Mail size={14} className="text-zinc-400" />
                          <span className="text-zinc-700 dark:text-zinc-300">{sol.correo}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-400">Plan:</span>
                        <span className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">{sol.plan}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Tipo:</span>
                        <span className="ml-2 text-zinc-700 dark:text-zinc-300">{sol.tipo_servicio}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">{tvLabel}:</span>
                        <span className="ml-2 text-zinc-700 dark:text-zinc-300">{sol.power_go ? "SI" : "NO"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Fuente:</span>
                        <span className="ml-2 text-zinc-700 dark:text-zinc-300">{sol.fuente}</span>
                      </div>

                      {sol.estatus_planificacion && sol.estatus_planificacion !== 'pendiente' && (
                        <div className="col-span-2 pt-3 mt-1 border-t border-zinc-200 dark:border-zinc-800">
                          <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-2">Detalles de Instalación</h5>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                            <div>
                                <span className="text-zinc-400">Estatus:</span>
                                <span className="ml-2 font-medium capitalize text-zinc-900 dark:text-zinc-100">{sol.estatus_planificacion}</span>
                            </div>
                            {sol.fecha_instalacion && (
                                <div>
                                    <span className="text-zinc-400">Asignado para:</span>
                                    <span className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">{new Date(sol.fecha_instalacion + 'T12:00:00').toLocaleDateString("es-ES")}</span>
                                </div>
                            )}
                            {sol.motivo_reprogramacion && (
                                <div className="col-span-2">
                                    <span className="text-zinc-400">Motivo:</span>
                                    <span className="ml-2 font-medium text-orange-600 dark:text-orange-400">{sol.motivo_reprogramacion}</span>
                                </div>
                            )}
                            {sol.notas_reprogramacion && (
                                <div className="col-span-2">
                                    <span className="text-zinc-400">Notas:</span>
                                    <span className="ml-2 text-zinc-700 dark:text-zinc-300">{sol.notas_reprogramacion}</span>
                                </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* WA Re-send button */}
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleSendWa(sol); }}
                      variant="outline"
                      className="w-full mt-3 h-10 gap-2 rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                    >
                      <Send size={16} /> Enviar a WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PremiumPageLayout>
  );
}
