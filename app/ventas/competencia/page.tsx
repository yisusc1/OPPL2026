
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Zap, ExternalLink, Radar, Loader2, Settings2, Plus, Edit2, Trash2, Tv, Wrench, MapPin, X } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOfertasRecientes, getHistorialOperador, getSnapshotOperador, getOperadores, saveOperador, updateOperador, deleteOperador } from "@/app/actions/competencia";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/components/providers/user-provider";

export default function CompetenciaDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, isAdmin } = useUser();
  const isCoordinador = profile?.job_title?.toLowerCase().includes("coordinador") || false;
  const canEditOperators = isAdmin || isCoordinador;
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingOfertas, setLoadingOfertas] = useState(false);
  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  
  // Filtros Geográficos
  const [filterEstado, setFilterEstado] = useState("");
  const [filterMunicipio, setFilterMunicipio] = useState("");
  const [filterParroquia, setFilterParroquia] = useState("");
  const filterEstados = Object.keys(geoHierarchy).sort();
  const filterMunicipios = filterEstado ? Object.keys(geoHierarchy[filterEstado] || {}).sort() : [];
  const filterParroquias = filterEstado && filterMunicipio ? Object.keys(geoHierarchy[filterEstado]?.[filterMunicipio] || {}).sort() : [];
  const hasGeoFilter = !!(filterEstado || filterMunicipio || filterParroquia);

  // Ofertas
  const [ofertas, setOfertas] = useState<any[]>([]);
  
  // Drawer state
  const [selectedOperador, setSelectedOperador] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

  // Gestión de Operadoras
  const [operadores, setOperadores] = useState<any[]>([]);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<number | null>(null);
  const [newOpName, setNewOpName] = useState("");
  const [newOpColor, setNewOpColor] = useState("#3b82f6");
  const [newOpLogo, setNewOpLogo] = useState("");
  const [savingOp, setSavingOp] = useState(false);

  useEffect(() => {
    Promise.all([getVentasConfig(), getOperadores()])
      .then(([config, ops]) => {
        setGeoHierarchy(config.geoHierarchy);
        setOperadores(ops);
        setLoadingConfig(false);
      })
      .catch(e => {
        console.error(e);
        setLoadingConfig(false);
        toast({ title: "Error cargando configuración", variant: "destructive" });
      });
  }, []);

  useEffect(() => {
    loadOfertas();
  }, [filterEstado, filterMunicipio, filterParroquia]);

  async function loadOfertas() {
    setLoadingOfertas(true);
    try {
      const data = await getOfertasRecientes(
        filterEstado || undefined,
        filterMunicipio || undefined,
        filterParroquia || undefined
      );
      setOfertas(data);
    } catch (error) {
      console.error(error);
      toast({ title: "Error cargando ofertas", variant: "destructive" });
    } finally {
      setLoadingOfertas(false);
    }
  }

  function navigateToOperador(oferta: any) {
    const params = new URLSearchParams();
    params.set("operador", String(oferta.operador_id));
    router.push(`/ventas/competencia/nuevo?${params.toString()}`);
  }

  async function openOperadorDetails(oferta: any) {
    setSelectedOperador(oferta);
    setDrawerOpen(true);
    setLoadingHistorial(true);
    try {
      const [histData, snapData] = await Promise.all([
        getHistorialOperador(oferta.operador_id),
        getSnapshotOperador(oferta.operador_id)
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

  async function handleSaveOperador() {
    if (!newOpName) return toast({ title: "Nombre requerido", variant: "destructive" });
    setSavingOp(true);
    try {
      if (editingOpId) {
        const data = await updateOperador(editingOpId, newOpName, newOpColor, newOpLogo || undefined);
        toast({ title: `Operadora "${data.nombre}" actualizada` });
        setOperadores(prev => prev.map(o => o.id === editingOpId ? data : o).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } else {
        const data = await saveOperador(newOpName, newOpColor, newOpLogo || undefined);
        toast({ title: `Operadora "${data.nombre}" creada` });
        setOperadores(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setIsOpModalOpen(false);
      setNewOpName(""); setNewOpColor("#3b82f6"); setNewOpLogo(""); setEditingOpId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingOp(false);
    }
  }

  async function handleDeleteOperador() {
    if (!editingOpId) return;
    
    const confirmName = prompt(`Esta operadora contiene información registrada.\n¿Seguro que desea eliminarla?\n\nEscriba el nombre exacto "${newOpName}" para confirmar:`);
    if (confirmName !== newOpName) {
      if (confirmName !== null) toast({ title: "Nombre incorrecto", description: "La operadora no fue eliminada.", variant: "destructive" });
      return;
    }
    
    setSavingOp(true);
    try {
      await deleteOperador(editingOpId);
      toast({ title: `Operadora eliminada exitosamente.` });
      setOperadores(prev => prev.filter(o => o.id !== editingOpId));
      setIsOpModalOpen(false);
      setNewOpName(""); setNewOpColor("#3b82f6"); setNewOpLogo(""); setEditingOpId(null);
      // Reload ofertas since the deleted operator might be selected or on the screen
      loadOfertas();
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } finally {
      setSavingOp(false);
    }
  }

  // Pre-calcular el plan más barato y la mejor promo para la tarjeta
  const getBestPrices = (oferta: any) => {
    return {
      precio: oferta.min_precio || oferta.precio_mensual || 0,
      velocidad: oferta.max_velocidad || oferta.velocidad_mb || 0,
      es_promocion: oferta.es_promocion,
      fecha_fin: oferta.fecha_fin_promo,
      todas_inst: oferta.todas_inst || []
    };
  };

  // Agrupar Zonas (Promos, Instalación, Notas)
  const groupedZones = useMemo(() => {
    if (!snapshot) return {};
    
    const zones: Record<string, { promos: any[], instalacion: any, notas: string }> = {};

    const initZone = (item: any) => {
      const key = `${item.estado} - ${item.municipio}`;
      if (!zones[key]) {
        zones[key] = {
          promos: [],
          instalacion: item.instalacion || null,
          notas: item.notas_anteriores || ""
        };
      }
      return key;
    };

    if (snapshot.promociones) {
      snapshot.promociones.forEach((promo: any) => {
        const key = initZone(promo);
        
        const promoKey = `${promo.nombre_plan}-${promo.velocidad}-${promo.precio_promo}`;
        const existing = zones[key].promos.find((p: any) => `${p.nombre_plan}-${p.velocidad}-${p.precio_promo}` === promoKey);
        
        if (existing) {
          if (!existing.parroquias) existing.parroquias = [existing.parroquia];
          if (!existing.parroquias.includes(promo.parroquia)) {
            existing.parroquias.push(promo.parroquia);
          }
        } else {
          promo.parroquias = [promo.parroquia];
          zones[key].promos.push(promo);
        }
      });
    }

    if (snapshot.planes_estandar) {
      snapshot.planes_estandar.forEach((plan: any) => {
        initZone(plan);
      });
    }

    return zones;
  }, [snapshot]);

  // Deduplicar Planes Estándar a nivel global
  const uniquePlanesEstandar = useMemo(() => {
    if (!snapshot?.planes_estandar) return [];
    const seen = new Set();
    return snapshot.planes_estandar.filter((plan: any) => {
      const key = `${plan.velocidad}-${plan.precio}-${plan.nombre_plan || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [snapshot]);

  return (
    <PremiumPageLayout 
      title="Estudio de Mercado" 
      description="Consulta y actualiza las ofertas de la competencia en campo."
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {canEditOperators && (
            <Button className="h-14 px-4 rounded-xl shadow-sm text-sm" onClick={() => {
              setEditingOpId(null);
              setNewOpName("");
              setNewOpColor("#3b82f6");
              setNewOpLogo("");
              setIsOpModalOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Registrar
            </Button>
          )}
          <Button
            variant={isCompareMode ? "default" : "outline"}
            className={`h-14 gap-2 rounded-2xl text-base px-4 w-full transition-colors ${
              isCompareMode 
                ? "bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/20" 
                : "border-zinc-200 dark:border-zinc-700"
            }`}
            onClick={() => {
              setIsCompareMode(!isCompareMode);
              if (isCompareMode) setSelectedForCompare([]); // Clear on exit
            }}
          >
            <Radar size={18} /> {isCompareMode ? "Cancelar" : "Comparar"}
          </Button>
        </div>

        {/* Filtros Geográficos */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-zinc-400" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Filtrar por zona</span>
            </div>
            {hasGeoFilter && (
              <button
                onClick={() => { setFilterEstado(""); setFilterMunicipio(""); setFilterParroquia(""); }}
                className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium transition-colors"
              >
                <X size={12} /> Limpiar
              </button>
            )}
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs text-zinc-400 font-medium shrink-0 w-20">Estado</span>
              <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setFilterMunicipio(""); setFilterParroquia(""); }}>
                <SelectTrigger className="h-9 text-xs border-0 bg-transparent shadow-none px-0 justify-end gap-1 font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-0 [&>svg]:text-zinc-400">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {filterEstados.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs text-zinc-400 font-medium shrink-0 w-20">Municipio</span>
              <Select value={filterMunicipio} onValueChange={(v) => { setFilterMunicipio(v); setFilterParroquia(""); }} disabled={!filterEstado}>
                <SelectTrigger className="h-9 text-xs border-0 bg-transparent shadow-none px-0 justify-end gap-1 font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-0 [&>svg]:text-zinc-400 disabled:opacity-30">
                  <SelectValue placeholder={filterEstado ? "Seleccionar..." : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {filterMunicipios.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs text-zinc-400 font-medium shrink-0 w-20">Parroquia</span>
              <Select value={filterParroquia} onValueChange={(v) => setFilterParroquia(v)} disabled={!filterMunicipio}>
                <SelectTrigger className="h-9 text-xs border-0 bg-transparent shadow-none px-0 justify-end gap-1 font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-0 [&>svg]:text-zinc-400 disabled:opacity-30">
                  <SelectValue placeholder={filterMunicipio ? "Seleccionar..." : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {filterParroquias.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {!loadingOfertas && ofertas.length === 0 ? (
        <div className="bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center">
          {hasGeoFilter ? (
            <>
              <MapPin className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-600 mb-3" />
              <h3 className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">Sin presencia en esta zona</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400/70">
                Ninguna operadora tiene registros en la ubicación seleccionada.
              </p>
            </>
          ) : (
            <>
              <Radar className="w-10 h-10 mx-auto text-emerald-400 dark:text-emerald-600 mb-3" />
              <h3 className="text-emerald-900 dark:text-emerald-100 font-medium mb-1">No hay datos</h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-400/70">
                Selecciona una operadora para registrar su primera oferta.
              </p>
            </>
          )}
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
              const bestDate = new Date(best.fecha_fin);
              if (!isNaN(bestDate.getTime())) {
                const diff = differenceInDays(bestDate, new Date());
                if (diff < 0) {
                  alertBadge = <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2 py-1.5 uppercase text-center w-full border-b border-rose-200 dark:border-rose-800">⚠️ Promo Expirada</div>;
                } else if (diff <= 7) {
                  alertBadge = <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-1.5 uppercase text-center w-full border-b border-amber-200 dark:border-amber-800">⚠️ Caduca en {diff} {diff === 1 ? 'día' : 'días'}</div>;
                }
              }
            }

            const isSelected = selectedForCompare.includes(oferta.operador_id);

            return (
              <div 
                key={oferta.id} 
                className={`bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm overflow-hidden transition-all cursor-pointer group relative ${
                  isSelected 
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md" 
                    : "border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
                onClick={() => {
                  if (isCompareMode) {
                    if (isSelected) {
                      setSelectedForCompare(prev => prev.filter(id => id !== oferta.operador_id));
                    } else {
                      setSelectedForCompare(prev => [...prev, oferta.operador_id]);
                    }
                  } else {
                    oferta.isEmpty ? navigateToOperador(oferta) : openOperadorDetails(oferta);
                  }
                }}
              >
                {isCompareMode && (
                  <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors z-10 ${
                    isSelected ? "bg-indigo-500 border-indigo-500 text-white" : "border-zinc-300 dark:border-zinc-600"
                  }`}>
                    {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                )}
                {alertBadge}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opColor }} />
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{opName}</h3>
                      {canEditOperators && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const op = oferta.operadores_competencia;
                            if (op) {
                              setEditingOpId(op.id);
                              setNewOpName(op.nombre);
                              setNewOpColor(op.color_hex || "#3b82f6");
                              setNewOpLogo(op.logo_url || "");
                              setIsOpModalOpen(true);
                            }
                          }} 
                          className="ml-2 w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar Operadora"
                        >
                          <Edit2 size={12} className="text-zinc-500" />
                        </button>
                      )}
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
                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 mr-1">Desde</span>
                            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${best.precio}</span>
                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">/ mes</span>
                          </>
                        )}
                      </div>

                      {!oferta.isEmpty && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <Zap size={16} className="text-amber-500" />
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">Hasta {best.velocidad} Mbps</span>
                          </div>
                          {best.todas_inst.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <Wrench size={16} className="text-zinc-400" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 text-[13px]">
                                Instalación: {best.todas_inst.length > 1 ? "Varía por zona" : `$${best.todas_inst[0]}`}
                              </span>
                            </div>
                          )}
                          {oferta.incluye_tv && (
                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                              <Tv size={16} className="text-indigo-400" />
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 text-[13px]">
                                Incluye IPTV
                              </span>
                            </div>
                          )}
                          {best.es_promocion && (
                            <div className="flex items-center gap-2 text-sm text-zinc-500 pt-1">
                              <Radar size={16} />
                              <span className="font-bold uppercase tracking-wider text-[10px]">En Promoción</span>
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
                    {oferta.isEmpty ? "Registrar oferta de " + opName : "Ver catálogo de " + opName}
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
                <div className="flex items-center gap-2">
                  {selectedOperador?.operadores_competencia?.nombre} a nivel nacional
                  {canEditOperators && selectedOperador?.operadores_competencia && (
                    <button onClick={() => {
                      const op = selectedOperador.operadores_competencia;
                      setEditingOpId(op.id);
                      setNewOpName(op.nombre);
                      setNewOpColor(op.color_hex || "#3b82f6");
                      setNewOpLogo(op.logo_url || "");
                      setIsOpModalOpen(true);
                    }} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ml-2">
                      <Edit2 size={16} className="text-zinc-500" />
                    </button>
                  )}
                </div>
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
                    <Button variant="outline" className="w-full text-zinc-700 dark:text-zinc-300" onClick={() => { setDrawerOpen(false); navigateToOperador(selectedOperador); }}>Registrar primera oferta</Button>
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

                    {/* Planes Estándar Globales */}
                    {uniquePlanesEstandar.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <h4 className="text-[12px] font-medium text-zinc-500 uppercase tracking-widest ml-1 mb-1">
                          Catálogo de Planes Base
                        </h4>
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden shadow-sm">
                          {uniquePlanesEstandar.map((plan: any, idx: number) => (
                            <div key={idx} className={`p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 ${idx !== uniquePlanesEstandar.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800/60' : ''}`}>
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
                                  <Zap className="text-white" size={20} />
                                </div>
                                <div>
                                  {plan.nombre_plan && <p className="text-[11px] font-semibold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase mb-0.5">{plan.nombre_plan}</p>}
                                  <div className="flex items-end gap-1.5">
                                    <p className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{plan.velocidad} <span className="text-[15px] font-medium text-zinc-500">Mbps</span></p>
                                    {plan.velocidad_subida && <p className="text-[11px] font-medium text-zinc-400 mb-[2px]">({plan.velocidad_subida} Mbps subida)</p>}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col md:items-end gap-2">
                                <div className="flex items-center gap-2">
                                  {plan.tecnologia && <Badge variant="outline" className="text-[10px] bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-medium px-2 py-0 h-5 rounded-md shadow-sm">{plan.tecnologia}</Badge>}
                                  {plan.es_simetrico && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 font-medium px-2 py-0 h-5 rounded-md shadow-sm">Simétrico</Badge>}
                                  {plan.incluye_iptv && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800 font-medium px-2 py-0 h-5 rounded-md shadow-sm">IPTV</Badge>}
                                </div>
                                <p className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">${plan.precio} <span className="text-[15px] font-medium text-zinc-500">/ mes</span></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Zonas Activas (Promociones, Instalación, Notas) */}
                    {Object.keys(groupedZones).filter(zone => zone !== "Nacional - Todos").length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-[12px] font-medium text-zinc-500 uppercase tracking-widest ml-1 mb-1">
                          Detalles por Zona
                        </h4>
                        <Accordion type="single" collapsible className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden shadow-sm">
                          {Object.entries(groupedZones).filter(([zone]) => zone !== "Nacional - Todos").map(([zone, data]: [string, any], idx: number, arr) => (
                            <AccordionItem key={idx} value={`zone-${idx}`} className={`border-b-0 ${idx !== arr.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800/60' : ''}`}>
                              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
                                    <span className="text-[16px]">📍</span>
                                  </div>
                                  <span className="font-semibold text-[15px] text-zinc-900 dark:text-zinc-100">{zone}</span>
                                  {data.promos.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 shadow-none font-medium text-[10px] rounded-md px-1.5 py-0 h-5">{data.promos.length} {data.promos.length === 1 ? 'Promo' : 'Promos'}</Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-5 pb-5 pt-0 space-y-6">
                                {/* Promociones */}
                                {data.promos.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                    {data.promos.map((promo: any, pIdx: number) => (
                                      <div key={pIdx} className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 relative overflow-hidden">
                                        <div className="flex justify-between items-start relative z-10 mb-3">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 dark:border-zinc-700/50">
                                              <Zap className="text-amber-500" size={18} />
                                            </div>
                                            <div>
                                              {promo.nombre_plan && <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{promo.nombre_plan}</p>}
                                              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{promo.velocidad} <span className="text-[13px] font-medium text-zinc-500">Mbps</span></p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            {promo.precio_regular && (
                                              <p className="text-[10px] text-zinc-400 line-through mb-0.5">Antes ${promo.precio_regular}</p>
                                            )}
                                            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">${promo.precio_promo}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                          {promo.duracion_meses && (
                                            <Badge variant="outline" className="text-[9px] bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 font-semibold px-1.5 py-0 h-4 rounded shadow-sm">
                                              Por {promo.duracion_meses} meses
                                            </Badge>
                                          )}
                                          {promo.fecha_fin && (
                                            <Badge variant="outline" className="text-[9px] bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 px-1.5 py-0 h-4 rounded shadow-sm">
                                              Hasta {format(new Date(promo.fecha_fin), "dd/MMM", { locale: es })}
                                            </Badge>
                                          )}
                                          {promo.tecnologia && (
                                            <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800 font-medium px-1.5 py-0 h-4 rounded shadow-sm">
                                              {promo.tecnologia}
                                            </Badge>
                                          )}
                                          {promo.es_simetrico && (
                                            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 font-medium px-1.5 py-0 h-4 rounded shadow-sm">
                                              Simétrico
                                            </Badge>
                                          )}
                                        </div>

                                        {promo.parroquias && promo.parroquias.length > 0 && (
                                          <div className="flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mb-3 leading-tight">
                                            <span className="shrink-0 mt-[2px]">📍</span>
                                            <span><span className="font-semibold text-zinc-600 dark:text-zinc-300">Aplica en:</span> {promo.parroquias.join(", ")}</span>
                                          </div>
                                        )}

                                        {promo.servicios && promo.servicios.length > 0 && (
                                          <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5">
                                            {promo.servicios.map((srv: any, sIdx: number) => (
                                              <div key={sIdx} className="flex justify-between items-center text-[13px]">
                                                <span className="font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                                                  <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /> {srv.nombre}
                                                </span>
                                                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                                                  {srv.condicion || (srv.costo === "0" ? "Gratis" : `$${srv.costo}`)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[13px] text-zinc-400 italic px-2 pt-2">No hay promociones activas en esta zona.</div>
                                )}

                                {/* Instalación de la Zona */}
                                {data.instalacion && (
                                  <div className="space-y-2 mt-4">
                                    <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest ml-1">
                                      Instalación y Equipos
                                    </h4>
                                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60">
                                      <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/80">
                                        <span className="text-[13px] text-zinc-500 font-medium">Modalidad Base</span>
                                        <span className="text-[13px] text-zinc-900 dark:text-zinc-100 font-semibold">{data.instalacion.modalidad || "Venta de Equipo"}</span>
                                      </div>
                                      <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/80">
                                        <span className="text-[13px] text-zinc-500 font-medium">Costo de Instalación</span>
                                        <span className="text-[14px] text-indigo-600 dark:text-indigo-400 font-bold">${data.instalacion.costo_base || "0"}</span>
                                      </div>
                                      {data.instalacion.metraje && (
                                        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/80">
                                          <span className="text-[13px] text-zinc-500 font-medium">Metraje Incluido</span>
                                          <span className="text-[13px] text-zinc-900 dark:text-zinc-100 font-medium">{data.instalacion.metraje}m</span>
                                        </div>
                                      )}
                                      {data.instalacion.opciones && data.instalacion.opciones.length > 0 && (
                                        <div className="px-4 py-3 bg-zinc-50/50 dark:bg-zinc-900/30">
                                          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Opciones Adicionales</p>
                                          <div className="space-y-1.5">
                                            {data.instalacion.opciones.map((op: any, i: number) => (
                                              <div key={i} className="flex justify-between items-center text-[13px]">
                                                <span className="text-zinc-600 dark:text-zinc-400 font-medium">{op.equipo}</span>
                                                <span className="text-zinc-900 dark:text-zinc-100 font-semibold">${op.precio}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Notas de la Zona */}
                                {data.notas && (
                                  <div className="mt-4 p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-widest mb-1">Notas / Observaciones</p>
                                    <p className="text-[13px] text-amber-800 dark:text-amber-200/80 leading-relaxed">"{data.notas}"</p>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
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
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Ubicación</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1">📍 {hist.estado}, {hist.municipio}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Tipo</p>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{hist.es_promocion ? "Promo Temporal" : "Plan Estándar"}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 text-[10px] uppercase font-bold">Plan Modificado</p>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{hist.velocidad_mb} Mbps por ${hist.precio_mensual}</p>
                          </div>
                          <div>
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

            {/* Botón Actualizar */}
            <div className="pt-6 pb-2">
              <Button 
                className="w-full h-14 rounded-2xl text-base font-bold gap-2"
                onClick={() => { setDrawerOpen(false); navigateToOperador(selectedOperador); }}
              >
                <ExternalLink size={18} /> Actualizar Información
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Dialog: Nueva Operadora / Editar Operadora */}
      <Dialog open={isOpModalOpen} onOpenChange={setIsOpModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingOpId ? "Editar Operadora" : "Registrar Nueva Operadora"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej. Fibex, Inter, Netuno..."
                value={newOpName}
                onChange={(e) => setNewOpName(e.target.value)}
                className="h-11 rounded-xl text-base"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Color de marca</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newOpColor}
                  onChange={(e) => setNewOpColor(e.target.value)}
                  className="h-11 w-16 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer bg-transparent p-1"
                />
                <Input
                  placeholder="#3b82f6"
                  value={newOpColor}
                  onChange={(e) => setNewOpColor(e.target.value)}
                  className="h-11 rounded-xl font-mono text-sm flex-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>URL del Logo <span className="text-zinc-400 font-normal">(opcional)</span></Label>
              <Input
                placeholder="https://ejemplo.com/logo.png"
                value={newOpLogo}
                onChange={(e) => setNewOpLogo(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
            </div>
            {newOpName && (
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                {newOpLogo ? (
                  <img src={newOpLogo} alt="preview" className="w-8 h-8 object-contain rounded-md" />
                ) : (
                  <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: newOpColor }} />
                )}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{newOpName}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editingOpId ? (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2" onClick={handleDeleteOperador} disabled={savingOp}>
                <Trash2 size={18} />
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpModalOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleSaveOperador} disabled={savingOp || !newOpName} className="rounded-xl gap-2">
                {savingOp ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingOpId ? <Edit2 size={16} /> : <Plus size={16} />)}
                {editingOpId ? "Guardar Cambios" : "Crear Operadora"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Bar for Compare Mode */}
      {isCompareMode && selectedForCompare.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span className="font-medium">{selectedForCompare.length} seleccionadas</span>
            <Button 
              className="rounded-full bg-indigo-500 hover:bg-indigo-600 text-white border-0 px-6 h-10"
              onClick={() => router.push(`/ventas/competencia/comparador?ops=${selectedForCompare.join(',')}`)}
            >
              <Radar className="mr-2 h-4 w-4" /> Analizar
            </Button>
          </div>
        </div>
      )}
    </PremiumPageLayout>
  );
}
