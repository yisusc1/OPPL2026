
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, MapPin, Tv, Zap, ExternalLink, Radar, Flame, ArrowRight } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOfertasRecientes, getHistorialOperador, getSnapshotOperador } from "@/app/actions/competencia";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

export default function CompetenciaDashboard() {
  const { toast } = useToast();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingOfertas, setLoadingOfertas] = useState(false);
  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  
  // Filtros
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  
  const [ofertas, setOfertas] = useState<any[]>([]);
  
  // Drawer state
  const [selectedOperador, setSelectedOperador] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getVentasConfig().then((config) => {
      setGeoHierarchy(config.geoHierarchy);
      setLoadingConfig(false);
    }).catch(e => {
      console.error(e);
      setLoadingConfig(false);
      toast({ title: "Error cargando ubicaciones", variant: "destructive" });
    });
  }, []);

  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];

  useEffect(() => {
    loadOfertas(estado, municipio, parroquia);
  }, [estado, municipio, parroquia]);

  async function loadOfertas(e?: string, m?: string, p?: string) {
    setLoadingOfertas(true);
    try {
      const data = await getOfertasRecientes(e, m, p);
      setOfertas(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Error cargando ofertas", variant: "destructive" });
    } finally {
      setLoadingOfertas(false);
    }
  }

  async function openOperadorDetails(oferta: any) {
    if (oferta.isEmpty) {
      window.location.href = "/ventas/competencia/nuevo";
      return;
    }
    setSelectedOperador(oferta);
    setDrawerOpen(true);
    setLoadingHistorial(true);
    try {
      const [histData, snapData] = await Promise.all([
        getHistorialOperador(oferta.operador_id, oferta.estado, oferta.municipio, oferta.parroquia),
        getSnapshotOperador(oferta.operador_id, oferta.estado, oferta.municipio, oferta.parroquia)
      ]);
      setHistorial(histData);
      setSnapshot(snapData);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al cargar historial", variant: "destructive" });
    } finally {
      setLoadingHistorial(false);
    }
  }

  // Pre-calcular el plan más barato y la mejor promo para la tarjeta
  const getBestPrices = (oferta: any) => {
    let bestPlan = null;
    let bestPromo = null;
    
    // Asumimos que getOfertasRecientes devuelve la fila más barata. 
    // Pero si hay promo, tomaremos los datos. 
    // Debido a que getOfertasRecientes agrupa por operador, puede devolver un solo plan. 
    // Para simplificar, usamos lo que devuelve la oferta base:
    return {
      precio: oferta.precio_mensual,
      velocidad: oferta.velocidad_mb,
      es_promocion: oferta.es_promocion,
      fecha_fin: oferta.fecha_fin_promo
    };
  };

  return (
    <PremiumPageLayout 
      title="Inteligencia de Mercado" 
      description="Consulta y actualiza las ofertas de la competencia en campo."
    >
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); }}>
              <SelectTrigger className="border-0 focus:ring-0 h-12 text-base shadow-none"><SelectValue placeholder="Estado..." /></SelectTrigger>
              <SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); }} disabled={!estado}>
              <SelectTrigger className="border-0 focus:ring-0 h-12 text-base shadow-none"><SelectValue placeholder="Municipio..." /></SelectTrigger>
              <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Select value={parroquia} onValueChange={setParroquia} disabled={!municipio}>
              <SelectTrigger className="border-0 focus:ring-0 h-12 text-base shadow-none"><SelectValue placeholder="Parroquia..." /></SelectTrigger>
              <SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Link href="/ventas/competencia/nuevo" className="md:w-auto">
          <Button className="w-full md:w-auto h-14 md:h-full gap-2 rounded-xl text-base px-6">
            <Plus size={18} /> Reportar Novedad
          </Button>
        </Link>
      </div>

      {!loadingOfertas && ofertas.length === 0 ? (
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-900/40 p-12 text-center">
          <Radar className="w-10 h-10 mx-auto text-emerald-400 dark:text-emerald-600 mb-3" />
          <h3 className="text-emerald-900 dark:text-emerald-100 font-medium mb-1">No hay datos</h3>
          <p className="text-sm text-emerald-600 dark:text-emerald-400/70 mb-4">
            Aún no se han reportado ofertas de la competencia aquí.
          </p>
          <Link href="/ventas/competencia/nuevo">
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              Ser el primero en reportar
            </Button>
          </Link>
        </div>
      ) : loadingOfertas ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-zinc-700 border-t-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ofertas.map((oferta) => {
            const opName = oferta.operadores_competencia?.nombre || "Desconocido";
            const opColor = oferta.operadores_competencia?.color_hex || "#6b7280";
            const opLogo = oferta.operadores_competencia?.logo_url || "";
            
            const best = getBestPrices(oferta);
            
            let alertBadge = null;
            if (best.fecha_fin && !oferta.isEmpty) {
              const diff = differenceInDays(new Date(best.fecha_fin), new Date());
              if (diff < 0) {
                alertBadge = <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2 py-1.5 uppercase text-center w-full border-b border-rose-200 dark:border-rose-800">⚠️ Promo Expirada</div>;
              } else if (diff <= 7) {
                alertBadge = <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-1.5 uppercase text-center w-full border-b border-amber-200 dark:border-amber-800">⚠️ Caduca en {diff} {diff === 1 ? 'día' : 'días'}</div>;
              }
            }

            return (
              <div 
                key={oferta.id} 
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => openOperadorDetails(oferta)}
              >
                <div className="h-2 w-full" style={{ backgroundColor: opColor }} />
                {alertBadge}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opColor }} />
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{opName}</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase text-zinc-500">
                      {oferta.created_at ? format(new Date(oferta.created_at), "dd MMM", { locale: es }) : "N/A"}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-end gap-2 mb-4">
                        {oferta.isEmpty ? (
                          <span className="text-xl font-semibold text-zinc-400 dark:text-zinc-500 py-1">Sin planes reportados</span>
                        ) : (
                          <>
                            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${best.precio}</span>
                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">/ mes</span>
                          </>
                        )}
                      </div>

                      {!oferta.isEmpty && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <Zap size={16} className="text-amber-500" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{best.velocidad} Mbps</span>
                          </div>
                          {best.es_promocion && (
                            <div className="flex items-center gap-2 text-sm text-amber-600">
                              <Flame size={16} />
                              <span className="font-bold">¡En Promoción!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {opLogo && (
                      <div className="shrink-0 flex items-center justify-center p-2">
                        <img src={opLogo} alt={opName} className="w-20 h-20 object-contain drop-shadow-sm" />
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full flex justify-center py-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-400 group-hover:text-primary transition-colors">
                    {oferta.isEmpty ? "Registrar nueva oferta" : "Ver catálogo completo de " + opName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer: Detalles Completos del Operador */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-3xl px-4 pb-8 overflow-y-auto max-h-[80vh] scrollbar-thin">
            <DrawerHeader className="px-0 pt-6">
              <DrawerTitle className="text-2xl font-black flex items-center gap-2">
                {selectedOperador?.operadores_competencia?.logo_url ? (
                  <img src={selectedOperador.operadores_competencia.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-md" />
                ) : (
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: selectedOperador?.operadores_competencia?.color_hex || '#ccc' }}
                  />
                )}
                {selectedOperador?.operadores_competencia?.nombre} en {parroquia || "el país"}
              </DrawerTitle>
              <DrawerDescription>
                Información detallada de la oferta comercial de esta operadora.
              </DrawerDescription>
            </DrawerHeader>

            <Tabs defaultValue="oferta" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-zinc-100 dark:bg-zinc-800/50">
                <TabsTrigger value="oferta">Oferta Actual</TabsTrigger>
                <TabsTrigger value="historial">Historial Novedades</TabsTrigger>
              </TabsList>

              <TabsContent value="oferta" className="mt-0 outline-none">
                {loadingHistorial ? (
                  <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>
                ) : !snapshot || selectedOperador?.isEmpty ? (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
                    <Radar className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">Sin datos de oferta</h3>
                    <p className="text-sm text-zinc-500 mb-4">No se han registrado planes completos para esta operadora.</p>
                    <Link href="/ventas/competencia/nuevo">
                      <Button variant="outline" className="w-full text-zinc-700 dark:text-zinc-300">Registrar primera oferta</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header: Fecha y Novedad */}
                    <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Última Novedad</span>
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedOperador.tipo_novedad}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">Fecha Reporte</span>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {selectedOperador.created_at ? format(new Date(selectedOperador.created_at), "dd MMM yyyy", { locale: es }) : ""}
                        </span>
                      </div>
                    </div>

                    {/* Promociones Activas */}
                    {snapshot.promociones && snapshot.promociones.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                          <Flame size={16} /> Promociones Activas
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {snapshot.promociones.map((promo: any, idx: number) => (
                            <div key={idx} className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
                              <div className="absolute -right-4 -top-4 opacity-5">
                                <Flame size={100} />
                              </div>
                              <div className="flex justify-between items-start relative z-10 mb-2">
                                <div className="flex items-center gap-2">
                                  <Zap size={20} className="text-amber-500" />
                                  <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{promo.velocidad} <span className="text-sm">Mbps</span></span>
                                </div>
                                <div className="text-right">
                                  {promo.precio_regular && (
                                    <p className="text-xs text-zinc-400 line-through">Antes ${promo.precio_regular}</p>
                                  )}
                                  <p className="text-2xl font-black text-amber-600">${promo.precio_promo}</p>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mb-4">
                                {promo.duracion_meses && (
                                  <Badge variant="outline" className="bg-white/50 dark:bg-black/20 text-amber-700 border-amber-300 font-bold">
                                    Por {promo.duracion_meses} meses
                                  </Badge>
                                )}
                                {promo.fecha_fin && (
                                  <Badge variant="outline" className="bg-white/50 dark:bg-black/20 text-amber-700 border-amber-300">
                                    Hasta {format(new Date(promo.fecha_fin), "dd/MMM/yy", { locale: es })}
                                  </Badge>
                                )}
                              </div>

                              {promo.servicios && promo.servicios.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-900/50 space-y-1">
                                  <p className="text-[10px] font-bold text-amber-700/70 uppercase">Servicios Incluidos:</p>
                                  {promo.servicios.map((srv: any, sIdx: number) => (
                                    <div key={sIdx} className="flex justify-between items-center text-sm">
                                      <span className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {srv.nombre}
                                      </span>
                                      <span className="text-amber-700 dark:text-amber-400 font-semibold text-xs">
                                        {srv.condicion || (srv.costo === "0" ? "Gratis" : `$${srv.costo}`)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Planes Estándar */}
                    {snapshot.planes_estandar && snapshot.planes_estandar.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                          Catálogo de Planes Base
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {snapshot.planes_estandar.map((plan: any, idx: number) => (
                            <div key={idx} className="bg-white dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row justify-between md:items-center gap-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                  <Zap className="text-zinc-400" />
                                </div>
                                <div>
                                  <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{plan.velocidad} <span className="text-sm font-medium text-zinc-500">Mbps</span></p>
                                  <p className="text-lg font-bold text-primary">${plan.precio} <span className="text-sm font-medium text-zinc-500">/ mes</span></p>
                                </div>
                              </div>
                              
                              {plan.servicios && plan.servicios.length > 0 && (
                                <div className="bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-sm md:min-w-[200px]">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Incluye:</p>
                                  <div className="space-y-1">
                                    {plan.servicios.map((srv: any, sIdx: number) => (
                                      <div key={sIdx} className="flex justify-between items-center gap-2">
                                        <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{srv.nombre}</span>
                                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-xs whitespace-nowrap">
                                          {srv.condicion || (srv.costo === "0" || !srv.costo ? "Incluido" : `+$${srv.costo}`)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instalación */}
                    {snapshot.instalacion && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <ExternalLink size={16} /> Costos de Instalación
                        </h4>
                        <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col md:flex-row gap-6">
                          
                          <div className="flex-1 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-900 dark:text-blue-100 font-medium">Costo Base ({snapshot.instalacion.modalidad || "Venta"})</span>
                              <span className="text-xl font-black text-blue-700 dark:text-blue-400">${snapshot.instalacion.costo_base || "0"}</span>
                            </div>
                            
                            {snapshot.instalacion.metraje && (
                              <div className="flex justify-between items-center border-t border-blue-200/50 dark:border-blue-800/50 pt-2">
                                <span className="text-sm text-blue-700/80 dark:text-blue-300/80">Metraje de cable incluido</span>
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 hover:bg-blue-200">{snapshot.instalacion.metraje} metros</Badge>
                              </div>
                            )}
                          </div>

                          {snapshot.instalacion.opciones && snapshot.instalacion.opciones.length > 0 && (
                            <div className="flex-1 border-t md:border-t-0 md:border-l border-blue-200/50 dark:border-blue-800/50 pt-4 md:pt-0 md:pl-6 space-y-2">
                              <p className="text-[10px] font-bold text-blue-700/70 uppercase">Opciones de Equipo:</p>
                              {snapshot.instalacion.opciones.map((op: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm bg-white dark:bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                  <span className="font-medium text-blue-900 dark:text-blue-100">{op.equipo}</span>
                                  <span className="font-bold text-blue-700 dark:text-blue-400">${op.precio}</span>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>
                      </div>
                    )}
                    
                    {snapshot.notas_anteriores && (
                      <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Notas y Observaciones</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">"{snapshot.notas_anteriores}"</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historial" className="mt-0 outline-none">
                {loadingHistorial ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
                  </div>
                ) : historial.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-sm">
                    No hay historial previo registrado para este operador.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-4 scrollbar-thin">
                    {historial.map((hist, index) => (
                      <div key={hist.id} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-3">
                          <Badge className={index === 0 ? "bg-emerald-500" : "bg-zinc-500"}>
                            {hist.tipo_novedad}
                          </Badge>
                          <span className="text-xs text-zinc-500 font-medium">
                            {format(new Date(hist.created_at), "dd/MM/yyyy")}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Tipo</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{hist.es_promocion ? "Promo Temporal" : "Plan Estándar"}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Plan Modificado</p>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{hist.velocidad_mb} Mbps por ${hist.precio_mensual}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Instalación</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">${hist.costo_instalacion}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>
    </PremiumPageLayout>
  );
}
