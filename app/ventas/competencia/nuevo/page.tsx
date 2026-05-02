
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOperadores, saveOfertasBatch, saveOperador, getSnapshotOperador } from "@/app/actions/competencia";
import { Loader2, Plus, Trash2, Info, PlusCircle, CheckCircle2 } from "lucide-react";

const TIPOS_NOVEDAD = [
  "Actualización General",
  "Expansión (Llegó a esta zona)",
  "Corte de Servicio General",
  "Otro"
];

const MODALIDADES_INSTALACION = [
  "Venta de Equipo",
  "Comodato",
  "Alquiler",
  "Gratis"
];

// Tipos
interface ServicioAdicional {
  nombre: string;
  costo: string;
  condicion: string;
}

interface PlanEstandar {
  velocidad: string;
  precio: string;
  servicios: ServicioAdicional[];
}

interface PromoActiva {
  velocidad: string;
  precio_promo: string;
  precio_regular: string;
  duracion_meses: string;
  fecha_fin: string;
  servicios: ServicioAdicional[];
}

interface OpcionInstalacion {
  equipo: string;
  precio: string;
}

export default function NuevaOfertaCompetencia() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUser();
  const asesor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  const [operadores, setOperadores] = useState<any[]>([]);

  // Form State
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [tipoNovedad, setTipoNovedad] = useState("Actualización General");

  // Bloque A: Planes y Promos
  const [planes, setPlanes] = useState<PlanEstandar[]>([]);
  const [promos, setPromos] = useState<PromoActiva[]>([]);

  // Bloque B: Instalación
  const [costoBaseInstalacion, setCostoBaseInstalacion] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [metraje, setMetraje] = useState("");
  const [opcionesInstalacion, setOpcionesInstalacion] = useState<OpcionInstalacion[]>([]);
  
  const [notas, setNotas] = useState("");

  // New Operator State
  const [isOperadorModalOpen, setIsOperadorModalOpen] = useState(false);
  const [newOpName, setNewOpName] = useState("");
  const [newOpColor, setNewOpColor] = useState("#3b82f6");
  const [newOpLogo, setNewOpLogo] = useState("");
  const [savingOp, setSavingOp] = useState(false);

  useEffect(() => {
    Promise.all([getVentasConfig(), getOperadores()])
      .then(([config, ops]) => {
        setGeoHierarchy(config.geoHierarchy);
        setOperadores(ops);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "Error cargando datos", variant: "destructive" });
      });
  }, []);

  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];

  // Snapshot Loading Effect
  useEffect(() => {
    async function fetchSnapshot() {
      if (!estado || !municipio || !parroquia || !operadorId) return;
      
      setLoadingSnapshot(true);
      try {
        const snap = await getSnapshotOperador(parseInt(operadorId), estado, municipio, parroquia);
        if (snap) {
          setPlanes(snap.planes_estandar || []);
          setPromos(snap.promociones || []);
          
          if (snap.instalacion) {
            setCostoBaseInstalacion(snap.instalacion.costo_base || "");
            setModalidad(snap.instalacion.modalidad || "");
            setMetraje(snap.instalacion.metraje || "");
            setOpcionesInstalacion(snap.instalacion.opciones || []);
          }
        } else {
          setPlanes([]);
          setPromos([]);
          setCostoBaseInstalacion("");
          setModalidad("");
          setMetraje("");
          setOpcionesInstalacion([]);
        }
      } catch (error) {
        console.error("Error fetching snapshot:", error);
      } finally {
        setLoadingSnapshot(false);
      }
    }
    
    if (tipoNovedad !== "Expansión (Llegó a esta zona)") {
      fetchSnapshot();
    } else {
      setPlanes([{ velocidad: "", precio: "", servicios: [] }]);
      setPromos([]);
      setCostoBaseInstalacion("");
      setModalidad("");
      setMetraje("");
      setOpcionesInstalacion([]);
    }
  }, [estado, municipio, parroquia, operadorId, tipoNovedad]);

  // PLANES HANDLERS
  const addPlan = () => setPlanes([...planes, { velocidad: "", precio: "", servicios: [] }]);
  const updatePlan = (idx: number, field: keyof PlanEstandar, val: string) => {
    const arr = [...planes];
    arr[idx] = { ...arr[idx], [field]: val };
    setPlanes(arr);
  };
  const removePlan = (idx: number) => setPlanes(planes.filter((_, i) => i !== idx));

  const addPlanServicio = (planIdx: number) => {
    const arr = [...planes];
    arr[planIdx].servicios.push({ nombre: "", costo: "", condicion: "" });
    setPlanes(arr);
  };
  const updatePlanServicio = (planIdx: number, srvIdx: number, field: keyof ServicioAdicional, val: string) => {
    const arr = [...planes];
    arr[planIdx].servicios[srvIdx] = { ...arr[planIdx].servicios[srvIdx], [field]: val };
    setPlanes(arr);
  };
  const removePlanServicio = (planIdx: number, srvIdx: number) => {
    const arr = [...planes];
    arr[planIdx].servicios = arr[planIdx].servicios.filter((_, i) => i !== srvIdx);
    setPlanes(arr);
  };

  // PROMOS HANDLERS
  const addPromo = () => setPromos([...promos, { velocidad: "", precio_promo: "", precio_regular: "", duracion_meses: "", fecha_fin: "", servicios: [] }]);
  const updatePromo = (idx: number, field: keyof PromoActiva, val: string) => {
    const arr = [...promos];
    arr[idx] = { ...arr[idx], [field]: val };
    setPromos(arr);
  };
  const removePromo = (idx: number) => setPromos(promos.filter((_, i) => i !== idx));

  const addPromoServicio = (promoIdx: number) => {
    const arr = [...promos];
    arr[promoIdx].servicios.push({ nombre: "", costo: "", condicion: "" });
    setPromos(arr);
  };
  const updatePromoServicio = (promoIdx: number, srvIdx: number, field: keyof ServicioAdicional, val: string) => {
    const arr = [...promos];
    arr[promoIdx].servicios[srvIdx] = { ...arr[promoIdx].servicios[srvIdx], [field]: val };
    setPromos(arr);
  };
  const removePromoServicio = (promoIdx: number, srvIdx: number) => {
    const arr = [...promos];
    arr[promoIdx].servicios = arr[promoIdx].servicios.filter((_, i) => i !== srvIdx);
    setPromos(arr);
  };

  // INSTALACION OPCIONES HANDLERS
  const addInstOpcion = () => setOpcionesInstalacion([...opcionesInstalacion, { equipo: "", precio: "" }]);
  const updateInstOpcion = (idx: number, field: keyof OpcionInstalacion, val: string) => {
    const arr = [...opcionesInstalacion];
    arr[idx] = { ...arr[idx], [field]: val };
    setOpcionesInstalacion(arr);
  };
  const removeInstOpcion = (idx: number) => setOpcionesInstalacion(opcionesInstalacion.filter((_, i) => i !== idx));

  async function handleSubmit() {
    if (!estado || !municipio || !parroquia || !operadorId || !tipoNovedad) {
      toast({ title: "Faltan datos", description: "Llena los campos requeridos.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const ofertasToInsert = [];

      const validPlanes = planes.filter(p => p.velocidad && p.precio);
      for (const p of validPlanes) {
        ofertasToInsert.push({
          operador_id: parseInt(operadorId),
          estado, municipio, parroquia,
          tipo_novedad: tipoNovedad,
          velocidad_mb: parseInt(p.velocidad),
          precio_mensual: parseFloat(p.precio),
          es_promocion: false,
          servicios_adicionales: p.servicios.filter(s => s.nombre), 
          costo_instalacion: costoBaseInstalacion ? parseFloat(costoBaseInstalacion) : 0,
          modalidad_instalacion: modalidad || "Venta de Equipo",
          instalacion_metraje: metraje ? parseInt(metraje) : null,
          instalacion_opciones: opcionesInstalacion.filter(o => o.equipo && o.precio), 
          notas,
          asesor_nombre: asesor || "Asesor Desconocido",
        });
      }

      const validPromos = promos.filter(p => p.velocidad && p.precio_promo);
      for (const p of validPromos) {
        ofertasToInsert.push({
          operador_id: parseInt(operadorId),
          estado, municipio, parroquia,
          tipo_novedad: tipoNovedad,
          velocidad_mb: parseInt(p.velocidad),
          precio_mensual: parseFloat(p.precio_promo),
          precio_regular: p.precio_regular ? parseFloat(p.precio_regular) : null,
          duracion_promo_meses: p.duracion_meses ? parseInt(p.duracion_meses) : null,
          fecha_fin_promo: p.fecha_fin || null,
          es_promocion: true,
          servicios_adicionales: p.servicios.filter(s => s.nombre), 
          costo_instalacion: costoBaseInstalacion ? parseFloat(costoBaseInstalacion) : 0,
          modalidad_instalacion: modalidad || "Venta de Equipo",
          instalacion_metraje: metraje ? parseInt(metraje) : null,
          instalacion_opciones: opcionesInstalacion.filter(o => o.equipo && o.precio), 
          notas,
          asesor_nombre: asesor || "Asesor Desconocido",
        });
      }

      if (ofertasToInsert.length === 0) {
        ofertasToInsert.push({
          operador_id: parseInt(operadorId),
          estado, municipio, parroquia,
          tipo_novedad: tipoNovedad,
          notas,
          asesor_nombre: asesor || "Asesor Desconocido",
        });
      }

      await saveOfertasBatch(ofertasToInsert);
      toast({ title: "Datos registrados exitosamente" });
      router.push("/ventas/competencia");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOperador() {
    if (!newOpName) return toast({ title: "Nombre requerido", variant: "destructive" });
    setSavingOp(true);
    try {
      const data = await saveOperador(newOpName, newOpColor, newOpLogo || undefined);
      toast({ title: "Operador registrado" });
      setOperadores([...operadores, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setOperadorId(String(data.id));
      setIsOperadorModalOpen(false);
      setNewOpName(""); setNewOpColor("#3b82f6"); setNewOpLogo("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingOp(false);
    }
  }

  if (loading) return (
    <PremiumPageLayout title="Reportar Inteligencia">
      <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>
    </PremiumPageLayout>
  );

  const isSoloNotas = ["Corte de Servicio General", "Otro"].includes(tipoNovedad);

  return (
    <PremiumPageLayout title="Inteligencia de Mercado" description="Actualiza o registra un nuevo Snapshot de la competencia.">
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        
        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Datos Base</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1"><Label>Estado</Label><Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); }}><SelectTrigger className="h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Municipio</Label><Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); }} disabled={!estado}><SelectTrigger className="h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Parroquia</Label><Select value={parroquia} onValueChange={setParroquia} disabled={!municipio}><SelectTrigger className="h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-1">
                <Label>Operador</Label>
                <div className="flex gap-2">
                  <Select value={operadorId} onValueChange={setOperadorId}>
                    <SelectTrigger className="flex-1 h-12 rounded-xl text-base"><SelectValue placeholder="Operador..." /></SelectTrigger>
                    <SelectContent>
                      {operadores.map((op) => (
                        <SelectItem key={op.id} value={String(op.id)}>
                          <div className="flex items-center gap-2">
                            {op.logo_url ? <img src={op.logo_url} alt={op.nombre} className="w-4 h-4 object-contain rounded-sm" /> : <div className="w-3 h-3 rounded-full" style={{ backgroundColor: op.color_hex }} />}
                            {op.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={() => setIsOperadorModalOpen(true)}><Plus className="text-zinc-500" /></Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Tipo de Novedad</Label>
                <Select value={tipoNovedad} onValueChange={setTipoNovedad}>
                  <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{TIPOS_NOVEDAD.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {loadingSnapshot && <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 rounded-xl text-sm animate-pulse border border-zinc-100 dark:border-zinc-800"><Loader2 className="w-4 h-4 animate-spin" /> Cargando datos previos...</div>}
          </CardContent>
        </Card>

        {!isSoloNotas && (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm uppercase tracking-wider text-zinc-500 flex items-center gap-2">📋 Promociones Activas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {promos.map((promo, idx) => (
                  <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border relative group">
                    <Button variant="ghost" size="icon" onClick={() => removePromo(idx)} className="absolute top-2 right-2 h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></Button>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      <div className="space-y-1 col-span-2 md:col-span-1"><Label className="text-[10px] uppercase">Velocidad (Mbps)</Label><Input type="number" value={promo.velocidad} onChange={(e) => updatePromo(idx, "velocidad", e.target.value)} className="h-10 bg-white dark:bg-zinc-900" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Precio Promo $</Label><Input type="number" step="0.01" value={promo.precio_promo} onChange={(e) => updatePromo(idx, "precio_promo", e.target.value)} className="h-10 bg-white dark:bg-zinc-900 font-bold" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase">Precio Regular $</Label><Input type="number" step="0.01" value={promo.precio_regular} onChange={(e) => updatePromo(idx, "precio_regular", e.target.value)} className="h-10 bg-white dark:bg-zinc-900" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase">Duración (Meses)</Label><Input type="number" value={promo.duracion_meses} onChange={(e) => updatePromo(idx, "duracion_meses", e.target.value)} className="h-10 bg-white dark:bg-zinc-900" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase">Válida Hasta</Label><Input type="date" value={promo.fecha_fin} onChange={(e) => updatePromo(idx, "fecha_fin", e.target.value)} className="h-10 bg-white dark:bg-zinc-900" /></div>
                    </div>
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-xs font-semibold text-zinc-500">Servicios Incluidos en Promo</Label>
                      {promo.servicios.map((srv, sIdx) => (
                        <div key={sIdx} className="flex flex-col md:flex-row gap-2 items-center bg-white dark:bg-zinc-900 p-2 rounded-xl border">
                          <Input placeholder="Ej. Salud Integral" value={srv.nombre} onChange={(e) => updatePromoServicio(idx, sIdx, "nombre", e.target.value)} className="h-9 text-sm" />
                          <Input placeholder="Costo (ej. 0 o 7)" value={srv.costo} onChange={(e) => updatePromoServicio(idx, sIdx, "costo", e.target.value)} className="h-9 text-sm w-full md:w-32" />
                          <Input placeholder="Detalle (ej. Gratis)" value={srv.condicion} onChange={(e) => updatePromoServicio(idx, sIdx, "condicion", e.target.value)} className="h-9 text-sm w-full md:w-32" />
                          <Button variant="ghost" size="icon" onClick={() => removePromoServicio(idx, sIdx)} className="h-9 w-9 text-rose-400 shrink-0"><Trash2 size={14}/></Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addPromoServicio(idx)} className="h-8 text-xs gap-1"><PlusCircle size={14}/> Añadir Servicio</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addPromo} className="w-full border-dashed"><Plus size={16} className="mr-2" /> Añadir Promoción</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm uppercase tracking-wider text-zinc-500 flex items-center gap-2">📋 Planes Estándar</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {planes.map((plan, idx) => (
                  <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border relative group">
                    <Button variant="ghost" size="icon" onClick={() => removePlan(idx)} className="absolute top-2 right-2 h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></Button>
                    <div className="grid grid-cols-2 gap-4 mb-4 md:pr-10">
                      <div className="space-y-1"><Label className="text-[10px] uppercase">Velocidad (Mbps)</Label><Input type="number" value={plan.velocidad} onChange={(e) => updatePlan(idx, "velocidad", e.target.value)} className="h-10 bg-white dark:bg-zinc-900" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase">Precio Mensual $</Label><Input type="number" step="0.01" value={plan.precio} onChange={(e) => updatePlan(idx, "precio", e.target.value)} className="h-10 bg-white dark:bg-zinc-900 font-bold" /></div>
                    </div>
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <Label className="text-xs font-semibold text-zinc-500">Servicios Incluidos</Label>
                      {plan.servicios.map((srv, sIdx) => (
                        <div key={sIdx} className="flex flex-col md:flex-row gap-2 items-center bg-white dark:bg-zinc-900 p-2 rounded-xl border">
                          <Input placeholder="Ej. NetUno Go" value={srv.nombre} onChange={(e) => updatePlanServicio(idx, sIdx, "nombre", e.target.value)} className="h-9 text-sm" />
                          <Input placeholder="Costo (ej. 7)" value={srv.costo} onChange={(e) => updatePlanServicio(idx, sIdx, "costo", e.target.value)} className="h-9 text-sm w-full md:w-32" />
                          <Input placeholder="Detalle" value={srv.condicion} onChange={(e) => updatePlanServicio(idx, sIdx, "condicion", e.target.value)} className="h-9 text-sm w-full md:w-32" />
                          <Button variant="ghost" size="icon" onClick={() => removePlanServicio(idx, sIdx)} className="h-9 w-9 text-rose-400 shrink-0"><Trash2 size={14}/></Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => addPlanServicio(idx)} className="h-8 text-xs gap-1"><PlusCircle size={14}/> Añadir Servicio</Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addPlan} className="w-full border-dashed"><Plus size={16} className="mr-2" /> Añadir Plan Estándar</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm uppercase tracking-wider text-zinc-500 flex items-center gap-2">🛠️ Instalación y Equipos</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1"><Label className="text-xs">Costo Base ($)</Label><Input type="number" step="0.01" value={costoBaseInstalacion} onChange={(e) => setCostoBaseInstalacion(e.target.value)} className="h-10" /></div>
                  <div className="space-y-1"><Label className="text-xs">Modalidad</Label><Select value={modalidad} onValueChange={setModalidad}><SelectTrigger className="h-10"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent>{MODALIDADES_INSTALACION.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-xs">Metraje Incluido (mts)</Label><Input type="number" value={metraje} onChange={(e) => setMetraje(e.target.value)} className="h-10" /></div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-xs font-semibold">Opciones Dinámicas de Equipo</Label>
                  {opcionesInstalacion.map((opcion, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-zinc-50 p-2 rounded-xl border">
                      <Input placeholder="Ej. Módem WiFi" value={opcion.equipo} onChange={(e) => updateInstOpcion(idx, "equipo", e.target.value)} className="h-10 bg-white" />
                      <Input type="number" placeholder="Precio $" value={opcion.precio} onChange={(e) => updateInstOpcion(idx, "precio", e.target.value)} className="h-10 w-32 bg-white" />
                      <Button variant="ghost" size="icon" onClick={() => removeInstOpcion(idx)} className="h-10 w-10 text-rose-500 shrink-0"><Trash2 size={16}/></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addInstOpcion} className="border-dashed gap-2"><PlusCircle size={14}/> Añadir Opción</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Notas</CardTitle></CardHeader>
          <CardContent><Textarea placeholder="Observaciones generales..." value={notas} onChange={(e) => setNotas(e.target.value)} className="rounded-xl resize-none text-base min-h-[100px]" /></CardContent>
        </Card>

        <div className="sticky bottom-6 z-10 pt-4">
          <Button onClick={handleSubmit} disabled={saving} className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Guardar
          </Button>
        </div>
      </div>
      
      {/* Dialog: Nueva Operadora */}
      <Dialog open={isOperadorModalOpen} onOpenChange={setIsOperadorModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nueva Operadora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nombre de la Operadora *</Label>
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOperadorModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSaveOperador} disabled={savingOp || !newOpName} className="rounded-xl gap-2">
              {savingOp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
              Crear Operadora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PremiumPageLayout>
  );
}
