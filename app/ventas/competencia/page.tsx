"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, MapPin, Tv, Zap, ExternalLink, Radar } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOfertasRecientes, getHistorialOperador } from "@/app/actions/competencia";
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
    // Load offers initially and whenever filters change
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
      const data = await getHistorialOperador(oferta.operador_id, oferta.estado, oferta.municipio, oferta.parroquia);
      setHistorial(data);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al cargar historial", variant: "destructive" });
    } finally {
      setLoadingHistorial(false);
    }
  }

  const latestPlansMap = new Map();
  historial.forEach(h => {
    if (!latestPlansMap.has(h.velocidad_mb)) {
      latestPlansMap.set(h.velocidad_mb, {
        ...h,
        previous_price: null
      });
    } else {
      const current = latestPlansMap.get(h.velocidad_mb);
      if (current.previous_price === null && current.precio_mensual !== h.precio_mensual) {
        current.previous_price = h.precio_mensual;
      }
    }
  });
  
  const currentPlans = Array.from(latestPlansMap.values()).sort((a, b) => a.velocidad_mb - b.velocidad_mb);

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
            
            let alertBadge = null;
            if (oferta.fecha_fin_promo && !oferta.isEmpty) {
              const diff = differenceInDays(new Date(oferta.fecha_fin_promo), new Date());
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
                            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${oferta.precio_mensual}</span>
                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">/ mes</span>
                          </>
                        )}
                      </div>

                      {!oferta.isEmpty && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <Zap size={16} className="text-amber-500" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{oferta.velocidad_mb} Mbps</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <ExternalLink size={16} className="text-blue-500" />
                            <span>Instalación: ${oferta.costo_instalacion || "0"}</span>
                          </div>
                          {oferta.incluye_tv && (
                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <Tv size={16} className="text-violet-500" />
                              <span>Incluye TV</span>
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
                    {oferta.isEmpty ? "Registrar nueva oferta" : "Ver todo el historial de planes"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer: Historial de Operador */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-2xl px-4 pb-8">
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
                Consulta la información de este operador en la zona.
              </DrawerDescription>
            </DrawerHeader>

            <Tabs defaultValue="oferta" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-zinc-100 dark:bg-zinc-800/50">
                <TabsTrigger value="oferta">Oferta Actual</TabsTrigger>
                <TabsTrigger value="historial">Historial ({historial.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="oferta" className="space-y-4 mt-0 outline-none">
                {selectedOperador?.isEmpty ? (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
                    <Radar className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">Sin datos de oferta</h3>
                    <p className="text-sm text-zinc-500 mb-4">No se han registrado planes para esta operadora aquí.</p>
                    <Link href="/ventas/competencia/nuevo">
                      <Button variant="outline" className="w-full text-zinc-700 dark:text-zinc-300">Registrar primera oferta</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                    <div className="flex justify-between items-center mb-6">
                      <Badge className="bg-emerald-500">{selectedOperador?.tipo_novedad}</Badge>
                      <span className="text-xs font-semibold text-zinc-500">
                        {selectedOperador?.created_at ? format(new Date(selectedOperador.created_at), "dd MMM yyyy", { locale: es }) : ""}
                      </span>
                    </div>
                    
                    <h4 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wider">Planes Disponibles</h4>
                    <div className="space-y-3 mb-6">
                      {currentPlans.map(plan => (
                        <div key={plan.id} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <Zap size={18} className="text-amber-500" />
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">{plan.velocidad_mb} Mbps</span>
                            </div>
                            {plan.previous_price !== null && (
                              <span className="text-[10px] font-medium text-zinc-400 line-through ml-7">
                                Antes ${plan.previous_price}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {plan.previous_price !== null && plan.precio_mensual < plan.previous_price && (
                              <span className="text-[10px] uppercase font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                ¡Bajó!
                              </span>
                            )}
                            {plan.previous_price !== null && plan.precio_mensual > plan.previous_price && (
                              <span className="text-[10px] uppercase font-black text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-0.5 rounded-full">
                                Subió
                              </span>
                            )}
                            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100">${plan.precio_mensual}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 mb-2">
                      <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                          <ExternalLink size={20} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Instalación</p>
                          <p className="font-bold">${selectedOperador?.costo_instalacion || "0"} <span className="text-sm font-medium text-zinc-500">({selectedOperador?.modalidad_instalacion || "Venta"})</span></p>
                        </div>
                      </div>

                      {selectedOperador?.incluye_tv && (
                        <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                            <Tv size={20} className="text-violet-500" />
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Televisión</p>
                            <p className="font-bold">{selectedOperador?.detalle_tv || "Incluida en el plan"}</p>
                          </div>
                        </div>
                      )}

                      {(selectedOperador?.duracion_promo_meses || selectedOperador?.fecha_fin_promo) && (
                        <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300 mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                            <Radar size={20} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-amber-600 dark:text-amber-500 font-medium uppercase tracking-wider">Condiciones Especiales</p>
                            {selectedOperador?.duracion_promo_meses && (
                              <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Beneficio válido por {selectedOperador.duracion_promo_meses} meses.</p>
                            )}
                            {selectedOperador?.fecha_fin_promo && (
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                Oferta disponible hasta: {format(new Date(selectedOperador.fecha_fin_promo), "dd MMM yyyy", { locale: es })}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {selectedOperador?.notas && (
                      <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">Notas del Asesor</p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">"{selectedOperador.notas}"</p>
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
                            <p className="text-zinc-500 text-xs">Plan</p>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{hist.velocidad_mb} Mbps por ${hist.precio_mensual}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-xs">Instalación</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              ${hist.costo_instalacion || 0}
                            </p>
                          </div>
                          {hist.notas && (
                            <div className="col-span-2 mt-1 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                              <p className="text-zinc-500 text-xs italic line-clamp-2">"{hist.notas}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <DrawerFooter className="px-0 pt-4">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">Cerrar</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </PremiumPageLayout>
  );
}
