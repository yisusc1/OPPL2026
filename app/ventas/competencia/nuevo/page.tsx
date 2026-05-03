
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getOperadores, saveOfertasBatch, saveOperador, getSnapshotOperador, updateOperador, deleteOperador, deleteOfertaZona, getUniqueServiceNames } from "@/app/actions/competencia";
import { Loader2, Plus, Trash2, Info, PlusCircle, CheckCircle2, Edit2, Copy, AlertTriangle } from "lucide-react";

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
  nombre_plan?: string;
  velocidad: string;
  velocidad_subida?: string;
  es_simetrico?: boolean;
  tecnologia?: string;
  precio: string;
  incluye_iptv?: boolean;
  servicios: ServicioAdicional[];
}

interface PromoActiva {
  nombre_plan?: string;
  velocidad: string;
  velocidad_subida?: string;
  es_simetrico?: boolean;
  tecnologia?: string;
  precio_promo: string;
  precio_regular: string;
  duracion_meses: string;
  fecha_fin: string;
  incluye_iptv?: boolean;
  servicios: ServicioAdicional[];
}

interface OpcionInstalacion {
  equipo: string;
  precio: string;
}

export default function NuevaOfertaCompetencia() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOperador = searchParams.get("operador");
  const urlEstado = searchParams.get("estado");
  const urlMunicipio = searchParams.get("municipio");
  const urlParroquia = searchParams.get("parroquia");
  const { toast } = useToast();
  const { profile } = useUser();
  const asesor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  const [operadores, setOperadores] = useState<any[]>([]);

  // Form State
  const [estado, setEstado] = useState(urlEstado || "");
  const [municipio, setMunicipio] = useState(urlMunicipio || "");
  const [parroquia, setParroquia] = useState(urlParroquia || "");
  const [operadorId, setOperadorId] = useState(urlOperador || "");
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
  const [editingOpId, setEditingOpId] = useState<number | null>(null);
  const [newOpName, setNewOpName] = useState("");
  const [newOpColor, setNewOpColor] = useState("#3b82f6");
  const [newOpLogo, setNewOpLogo] = useState("");
  const [savingOp, setSavingOp] = useState(false);

  // Import Promo State
  const [isImportPromoModalOpen, setIsImportPromoModalOpen] = useState(false);
  const [nationalPromos, setNationalPromos] = useState<PromoActiva[]>([]);
  const [loadingNationalPromos, setLoadingNationalPromos] = useState(false);

  // Autocomplete & Zone Delete
  const [serviceNameSuggestions, setServiceNameSuggestions] = useState<string[]>([]);
  const [deletingZone, setDeletingZone] = useState(false);
  const hasExistingData = planes.length > 0 || promos.length > 0;

  useEffect(() => {
    Promise.all([getVentasConfig(), getOperadores(), getUniqueServiceNames()])
      .then(([config, ops, srvNames]) => {
        setGeoHierarchy(config.geoHierarchy);
        setOperadores(ops);
        setServiceNameSuggestions(srvNames);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Error crítico cargando datos iniciales:", e);
        setLoading(false);
        toast({ title: "Error cargando datos", description: e.message || "Verifica la conexión con la base de datos.", variant: "destructive" });
      });
  }, []);

  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];

  // Snapshot Loading Effect
  useEffect(() => {
    async function fetchSnapshot() {
      if (!operadorId) return;
      
      setLoadingSnapshot(true);
      try {
        if (!estado || !municipio || !parroquia) {
          const snapNacional = await getSnapshotOperador(parseInt(operadorId), "Nacional", "Todos", "Todas");
          if (snapNacional) {
             setPlanes(snapNacional.planes_estandar || []);
          } else {
             setPlanes([]);
          }
          setPromos([]);
          setCostoBaseInstalacion("");
          setModalidad("");
          setMetraje("");
          setOpcionesInstalacion([]);
          setLoadingSnapshot(false);
          return;
        }

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
      setPlanes([{ nombre_plan: "", velocidad: "", velocidad_subida: "", es_simetrico: true, tecnologia: "FTTH", precio: "", incluye_iptv: false, servicios: [] }]);
      setPromos([]);
      setCostoBaseInstalacion("");
      setModalidad("");
      setMetraje("");
      setOpcionesInstalacion([]);
    }
  }, [estado, municipio, parroquia, operadorId, tipoNovedad]);

  // PLANES HANDLERS
  const addPlan = () => setPlanes([...planes, { nombre_plan: "", velocidad: "", velocidad_subida: "", es_simetrico: true, tecnologia: "FTTH", precio: "", incluye_iptv: false, servicios: [] }]);
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
  const addPromo = () => setPromos([...promos, { nombre_plan: "", velocidad: "", velocidad_subida: "", es_simetrico: true, tecnologia: "FTTH", precio_promo: "", precio_regular: "", duracion_meses: "", fecha_fin: "", incluye_iptv: false, servicios: [] }]);
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

  const handleOpenImportPromoModal = async () => {
    if (!operadorId) {
      toast({ title: "Falta operador", description: "Selecciona un operador primero", variant: "destructive" });
      return;
    }
    setIsImportPromoModalOpen(true);
    setLoadingNationalPromos(true);
    try {
      const snap = await getSnapshotOperador(parseInt(operadorId));
      if (snap && snap.promociones) {
        // Extraer únicas
        const unique = [];
        const seen = new Set();
        for (const p of snap.promociones) {
          const key = `${p.nombre_plan}-${p.velocidad}-${p.precio_promo}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(p);
          }
        }
        setNationalPromos(unique);
      } else {
        setNationalPromos([]);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Error al cargar promociones", variant: "destructive" });
    } finally {
      setLoadingNationalPromos(false);
    }
  };

  const handleImportPromo = (promo: PromoActiva) => {
    setPromos([...promos, { ...promo }]);
    setIsImportPromoModalOpen(false);
    toast({ title: "Promoción Importada", description: `Se añadió: ${promo.nombre_plan || promo.velocidad+'Mbps'}` });
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
    const missing = [];
    if (!estado) missing.push("Estado");
    if (!municipio) missing.push("Municipio");
    if (!parroquia) missing.push("Parroquia");
    if (!operadorId) missing.push("Operador");
    if (!tipoNovedad) missing.push("Tipo de Novedad");

    if (missing.length > 0) {
      const msg = `Faltan campos: ${missing.join(", ")}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({ title: "Faltan datos", description: msg, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const ofertasToInsert: any[] = [];

      // Procesar Planes Estándar
      for (const p of planes) {
        const vel = p.velocidad?.toString().trim();
        const pre = p.precio?.toString().trim();
        if (vel && pre) {
          ofertasToInsert.push({
            operador_id: parseInt(operadorId),
            estado, municipio, parroquia,
            tipo_novedad: tipoNovedad,
            velocidad_mb: parseInt(vel) || 0,
            velocidad_subida: p.velocidad_subida ? parseInt(p.velocidad_subida) : null,
            nombre_plan: p.nombre_plan || null,
            tecnologia: p.tecnologia || "FTTH",
            es_simetrico: p.es_simetrico !== undefined ? p.es_simetrico : true,
            incluye_iptv: p.incluye_iptv || false,
            precio_mensual: parseFloat(pre) || 0,
            es_promocion: false,
            servicios_adicionales: p.servicios.filter(s => s.nombre?.trim()),
            costo_instalacion: parseFloat(costoBaseInstalacion) || 0,
            modalidad_instalacion: modalidad || "Venta de Equipo",
            instalacion_metraje: metraje ? parseInt(metraje) : null,
            instalacion_opciones: opcionesInstalacion.filter(o => o.equipo?.trim() && o.precio?.trim()),
            notas,
            asesor_nombre: asesor || "Asesor Desconocido",
          });
        }
      }

      // Procesar Promociones
      for (const p of promos) {
        const vel = p.velocidad?.toString().trim();
        const pre = p.precio_promo?.toString().trim();
        if (vel && pre) {
          ofertasToInsert.push({
            operador_id: parseInt(operadorId),
            estado, municipio, parroquia,
            tipo_novedad: tipoNovedad,
            velocidad_mb: parseInt(vel) || 0,
            velocidad_subida: p.velocidad_subida ? parseInt(p.velocidad_subida) : null,
            nombre_plan: p.nombre_plan || null,
            tecnologia: p.tecnologia || "FTTH",
            es_simetrico: p.es_simetrico !== undefined ? p.es_simetrico : true,
            incluye_iptv: p.incluye_iptv || false,
            precio_mensual: parseFloat(pre) || 0,
            precio_regular: p.precio_regular ? parseFloat(p.precio_regular) : null,
            duracion_promo_meses: p.duracion_meses ? parseInt(p.duracion_meses) : null,
            fecha_fin_promo: p.fecha_fin || null,
            es_promocion: true,
            servicios_adicionales: p.servicios.filter(s => s.nombre?.trim()),
            costo_instalacion: parseFloat(costoBaseInstalacion) || 0,
            modalidad_instalacion: modalidad || "Venta de Equipo",
            instalacion_metraje: metraje ? parseInt(metraje) : null,
            instalacion_opciones: opcionesInstalacion.filter(o => o.equipo?.trim() && o.precio?.trim()),
            notas,
            asesor_nombre: asesor || "Asesor Desconocido",
          });
        }
      }

      // Fallback: si no hay planes/promos válidos, guardar un registro base con notas e instalación
      if (ofertasToInsert.length === 0) {
        ofertasToInsert.push({
          operador_id: parseInt(operadorId),
          estado, municipio, parroquia,
          tipo_novedad: tipoNovedad,
          velocidad_mb: 0,
          precio_mensual: 0,
          es_promocion: false,
          servicios_adicionales: [],
          costo_instalacion: parseFloat(costoBaseInstalacion) || 0,
          modalidad_instalacion: modalidad || "Venta de Equipo",
          instalacion_metraje: metraje ? parseInt(metraje) : null,
          instalacion_opciones: opcionesInstalacion.filter(o => o.equipo?.trim() && o.precio?.trim()),
          notas,
          asesor_nombre: asesor || "Asesor Desconocido",
        });
      }

      console.log(`[competencia-form] Enviando ${ofertasToInsert.length} registro(s)...`);
      const result = await saveOfertasBatch(ofertasToInsert);
      
      if (!result.success) {
        const errMsg = result.error || "Error desconocido al guardar";
        console.error("[competencia-form] Error del servidor:", errMsg);
        alert(`Error al guardar: ${errMsg}`);
        toast({ title: "Error al guardar", description: errMsg, variant: "destructive" });
        return;
      }
      
      console.log("[competencia-form] Guardado exitoso:", result.data);
      toast({ title: "Éxito", description: `${ofertasToInsert.length} registro(s) guardados correctamente.` });
      router.push("/ventas/competencia");
    } catch (error: any) {
      console.error("[competencia-form] Error inesperado:", error);
      alert(`Error inesperado: ${error.message}`);
      toast({ title: "Error al guardar", description: error.message || "Error desconocido", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOperador() {
    if (!newOpName) return toast({ title: "Nombre requerido", variant: "destructive" });
    setSavingOp(true);
    try {
      if (editingOpId) {
        const data = await updateOperador(editingOpId, newOpName, newOpColor, newOpLogo || undefined);
        toast({ title: "Operador actualizado" });
        setOperadores(operadores.map(o => o.id === editingOpId ? data : o).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } else {
        const data = await saveOperador(newOpName, newOpColor, newOpLogo || undefined);
        toast({ title: "Operador registrado" });
        setOperadores([...operadores, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setOperadorId(String(data.id));
      }
      setIsOperadorModalOpen(false);
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
      setOperadores(operadores.filter(o => o.id !== editingOpId));
      if (operadorId === String(editingOpId)) {
        setOperadorId("");
      }
      setIsOperadorModalOpen(false);
      setNewOpName(""); setNewOpColor("#3b82f6"); setNewOpLogo(""); setEditingOpId(null);
    } catch (error: any) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
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

  const iosSelect = "border-0 bg-transparent shadow-none h-auto p-0 text-base font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-0 [&>svg]:text-zinc-300 dark:[&>svg]:text-zinc-600";
  const iosInput = "border-0 bg-transparent shadow-none h-auto p-0 text-base font-semibold text-zinc-900 dark:text-zinc-100 focus-visible:ring-0 placeholder:text-zinc-300 dark:placeholder:text-zinc-600";
  const iosLabel = "text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1";
  const iosCard = "bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 overflow-hidden";
  const iosDivider = "border-t border-zinc-100 dark:border-zinc-800 ml-4";
  const iosVDivider = "w-px bg-zinc-100 dark:bg-zinc-800 my-3";
  const iosSection = "text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1 mb-2";

  return (
    <PremiumPageLayout title="Estudio de Mercado" description="Actualiza o registra un nuevo Snapshot de la competencia.">
      <div className="max-w-2xl mx-auto space-y-8 pb-24">

        {/* ─── DATOS BASE ─── */}
        <section>
          <p className={iosSection}>Datos Base</p>
          <div className={iosCard}>
            <div className="px-4 py-3.5">
              <p className={iosLabel}>Estado</p>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); }}>
                <SelectTrigger className={iosSelect}><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className={iosDivider} />
            <div className="flex">
              <div className="flex-1 px-4 py-3.5">
                <p className={iosLabel}>Municipio</p>
                <Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); }} disabled={!estado}>
                  <SelectTrigger className={iosSelect}><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className={iosVDivider} />
              <div className="flex-1 px-4 py-3.5">
                <p className={iosLabel}>Parroquia</p>
                <Select value={parroquia} onValueChange={setParroquia} disabled={!municipio}>
                  <SelectTrigger className={iosSelect}><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className={iosDivider} />
            <div className="px-4 py-3.5">
              <p className={iosLabel}>Operador</p>
              {urlOperador ? (
                <div className="flex items-center gap-2">
                  {(() => {
                    const op = operadores.find(o => String(o.id) === operadorId);
                    if (!op) return <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Cargando...</span>;
                    return (
                      <>
                        {op.logo_url ? <img src={op.logo_url} alt={op.nombre} className="w-5 h-5 object-contain rounded-sm" /> : <div className="w-3 h-3 rounded-full" style={{ backgroundColor: op.color_hex }} />}
                        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{op.nombre}</span>
                      </>
                    );
                  })()}
                  <button onClick={() => {
                    const op = operadores.find(o => String(o.id) === operadorId);
                    if (op) {
                      setEditingOpId(op.id); setNewOpName(op.nombre); setNewOpColor(op.color_hex); setNewOpLogo(op.logo_url || ""); setIsOperadorModalOpen(true);
                    }
                  }} className="ml-auto w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Edit2 size={14} className="text-zinc-500" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Select value={operadorId} onValueChange={setOperadorId}>
                    <SelectTrigger className={`${iosSelect} flex-1`}><SelectValue placeholder="Operador..." /></SelectTrigger>
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
                  <button onClick={() => { setEditingOpId(null); setNewOpName(""); setNewOpColor("#3b82f6"); setNewOpLogo(""); setIsOperadorModalOpen(true); }} className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Plus size={14} className="text-zinc-500" /></button>
                  {operadorId && (
                    <button onClick={() => {
                      const op = operadores.find(o => String(o.id) === operadorId);
                      if (op) {
                        setEditingOpId(op.id); setNewOpName(op.nombre); setNewOpColor(op.color_hex); setNewOpLogo(op.logo_url || ""); setIsOperadorModalOpen(true);
                      }
                    }} className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Edit2 size={14} className="text-zinc-500" /></button>
                  )}
                </div>
              )}
            </div>
            <div className={iosDivider} />
            <div className="px-4 py-3.5">
              <p className={iosLabel}>Tipo de Novedad</p>
              <Select value={tipoNovedad} onValueChange={setTipoNovedad}>
                <SelectTrigger className={iosSelect}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{TIPOS_NOVEDAD.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {loadingSnapshot && (<><div className={iosDivider} /><div className="flex items-center gap-2 px-4 py-3.5 text-zinc-400 text-sm animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /> Cargando datos previos...</div></>)}
          </div>
        </section>

        {!isSoloNotas && (
          <>
            <section>
              <p className={iosSection}>Promociones Activas</p>
              <div className="space-y-3">
                {promos.map((promo, idx) => (
                  <div key={idx} className={`${iosCard} relative group`}>
                    <button onClick={() => removePromo(idx)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} className="text-rose-500" /></button>
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Nombre del Plan</p>
                        <Input value={promo.nombre_plan || ""} onChange={(e) => updatePromo(idx, "nombre_plan", e.target.value)} className={iosInput} placeholder="Ej. ThunderLIFE" />
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Tecnología</p>
                        <Select value={promo.tecnologia || "FTTH"} onValueChange={(v) => updatePromo(idx, "tecnologia", v)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["FTTH", "FTTH GPON", "XGS-PON", "Fibra Óptica", "Fibra / HFC", "HFC", "Microondas", "ADSL"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Velocidad Bajada</p>
                        <Input type="number" value={promo.velocidad} onChange={(e) => updatePromo(idx, "velocidad", e.target.value)} className={iosInput} placeholder="Ej. 100" />
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Velocidad Subida</p>
                        <Input type="number" value={promo.velocidad_subida || ""} onChange={(e) => updatePromo(idx, "velocidad_subida", e.target.value)} className={iosInput} placeholder="Ej. 50" />
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Simétrico?</p>
                        <Select value={promo.es_simetrico ? "si" : "no"} onValueChange={(v) => updatePromo(idx, "es_simetrico", v === "si" ? true : false as any)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Incluye IPTV?</p>
                        <Select value={promo.incluye_iptv ? "si" : "no"} onValueChange={(v) => updatePromo(idx, "incluye_iptv", v === "si" ? true : false as any)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-1">Precio Promo $</p>
                        <Input type="number" step="0.01" value={promo.precio_promo} onChange={(e) => updatePromo(idx, "precio_promo", e.target.value)} className={`${iosInput} font-black`} placeholder="0.00" />
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Precio Regular $</p>
                        <Input type="number" step="0.01" value={promo.precio_regular} onChange={(e) => updatePromo(idx, "precio_regular", e.target.value)} className={iosInput} placeholder="0.00" />
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Duración (Meses)</p>
                        <Input type="number" value={promo.duracion_meses} onChange={(e) => updatePromo(idx, "duracion_meses", e.target.value)} className={iosInput} placeholder="3" />
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="px-4 py-3.5">
                      <p className={iosLabel}>Válida Hasta</p>
                      <Input type="date" value={promo.fecha_fin} onChange={(e) => updatePromo(idx, "fecha_fin", e.target.value)} className={iosInput} />
                    </div>
                    {/* Servicios */}
                    {promo.servicios.length > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
                    {promo.servicios.length > 0 && (
                      <div className="bg-zinc-50/50 dark:bg-zinc-800/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-4 pt-3 pb-1">Servicios Incluidos</p>
                        {promo.servicios.map((srv, sIdx) => (
                          <div key={sIdx}>
                            {sIdx > 0 && <div className={iosDivider} />}
                            <div className="flex items-center px-4 py-2.5 gap-3">
                              <Input list="srv-names-list" placeholder="Ej. Salud Integral" value={srv.nombre} onChange={(e) => updatePromoServicio(idx, sIdx, "nombre", e.target.value)} className={`${iosInput} text-sm flex-1`} />
                              <Input placeholder="$0" value={srv.costo} onChange={(e) => updatePromoServicio(idx, sIdx, "costo", e.target.value)} className={`${iosInput} text-sm w-14 text-right`} />
                              <Input placeholder="Detalle" value={srv.condicion} onChange={(e) => updatePromoServicio(idx, sIdx, "condicion", e.target.value)} className={`${iosInput} text-sm w-20 text-zinc-500`} />
                              <button onClick={() => removePromoServicio(idx, sIdx)} className="shrink-0 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-zinc-100 dark:border-zinc-800" />
                    <button onClick={() => addPromoServicio(idx)} className="w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-1.5"><PlusCircle size={14} /> Añadir Servicio</button>
                  </div>
                ))}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <button onClick={addPromo} className="flex-1 py-3.5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-500 transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Añadir Nueva Promo</button>
                  <button onClick={handleOpenImportPromoModal} className="flex-1 py-3.5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/30 text-sm font-semibold text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center justify-center gap-2"><Copy size={16} /> Importar Existente</button>
                </div>
              </div>
            </section>

            <section>
              <p className={iosSection}>Planes Estándar</p>
              <div className="space-y-3">
                {planes.map((plan, idx) => (
                  <div key={idx} className={`${iosCard} relative group`}>
                    <button onClick={() => removePlan(idx)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} className="text-rose-500" /></button>
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Nombre del Plan</p>
                        <Input value={plan.nombre_plan || ""} onChange={(e) => updatePlan(idx, "nombre_plan", e.target.value)} className={iosInput} placeholder="Ej. NetUno 400" />
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Tecnología</p>
                        <Select value={plan.tecnologia || "FTTH"} onValueChange={(v) => updatePlan(idx, "tecnologia", v)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["FTTH", "FTTH GPON", "XGS-PON", "Fibra Óptica", "Fibra / HFC", "HFC", "Microondas", "ADSL"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Velocidad Bajada</p>
                        <Input type="number" value={plan.velocidad} onChange={(e) => updatePlan(idx, "velocidad", e.target.value)} className={iosInput} placeholder="Ej. 100" />
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Velocidad Subida</p>
                        <Input type="number" value={plan.velocidad_subida || ""} onChange={(e) => updatePlan(idx, "velocidad_subida", e.target.value)} className={iosInput} placeholder="Ej. 50" />
                      </div>
                    </div>
                    <div className={iosDivider} />
                    <div className="flex">
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Simétrico?</p>
                        <Select value={plan.es_simetrico ? "si" : "no"} onValueChange={(v) => updatePlan(idx, "es_simetrico", v === "si" ? true : false as any)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Incluye IPTV?</p>
                        <Select value={plan.incluye_iptv ? "si" : "no"} onValueChange={(v) => updatePlan(idx, "incluye_iptv", v === "si" ? true : false as any)}>
                          <SelectTrigger className={iosSelect}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className={iosVDivider} />
                      <div className="flex-1 px-4 py-3.5">
                        <p className={iosLabel}>Precio Mensual $</p>
                        <Input type="number" step="0.01" value={plan.precio} onChange={(e) => updatePlan(idx, "precio", e.target.value)} className={`${iosInput} font-black`} placeholder="0.00" />
                      </div>
                    </div>
                    {plan.servicios.length > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
                    {plan.servicios.length > 0 && (
                      <div className="bg-zinc-50/50 dark:bg-zinc-800/30">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-4 pt-3 pb-1">Servicios Incluidos</p>
                        {plan.servicios.map((srv, sIdx) => (
                          <div key={sIdx}>
                            {sIdx > 0 && <div className={iosDivider} />}
                            <div className="flex items-center px-4 py-2.5 gap-3">
                              <Input list="srv-names-list" placeholder="Ej. NetUno Go" value={srv.nombre} onChange={(e) => updatePlanServicio(idx, sIdx, "nombre", e.target.value)} className={`${iosInput} text-sm flex-1`} />
                              <Input placeholder="$0" value={srv.costo} onChange={(e) => updatePlanServicio(idx, sIdx, "costo", e.target.value)} className={`${iosInput} text-sm w-14 text-right`} />
                              <Input placeholder="Detalle" value={srv.condicion} onChange={(e) => updatePlanServicio(idx, sIdx, "condicion", e.target.value)} className={`${iosInput} text-sm w-20 text-zinc-500`} />
                              <button onClick={() => removePlanServicio(idx, sIdx)} className="shrink-0 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-zinc-100 dark:border-zinc-800" />
                    <button onClick={() => addPlanServicio(idx)} className="w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-1.5"><PlusCircle size={14} /> Añadir Servicio</button>
                  </div>
                ))}
                <button onClick={addPlan} className="w-full py-3.5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-500 transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Añadir Plan Estándar</button>
              </div>
            </section>

            <section>
              <p className={iosSection}>Instalación y Equipos</p>
              <div className={iosCard}>
                <div className="flex">
                  <div className="flex-1 px-4 py-3.5">
                    <p className={iosLabel}>Costo Base ($)</p>
                    <Input type="number" step="0.01" value={costoBaseInstalacion} onChange={(e) => setCostoBaseInstalacion(e.target.value)} className={iosInput} placeholder="0.00" />
                  </div>
                  <div className={iosVDivider} />
                  <div className="flex-1 px-4 py-3.5">
                    <p className={iosLabel}>Modalidad</p>
                    <Select value={modalidad} onValueChange={setModalidad}>
                      <SelectTrigger className={iosSelect}><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                      <SelectContent>{MODALIDADES_INSTALACION.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={iosDivider} />
                <div className="px-4 py-3.5">
                  <p className={iosLabel}>Metraje Incluido (mts)</p>
                  <Input type="number" value={metraje} onChange={(e) => setMetraje(e.target.value)} className={iosInput} placeholder="Ej. 30" />
                </div>
                {opcionesInstalacion.length > 0 && <div className="border-t border-zinc-100 dark:border-zinc-800" />}
                {opcionesInstalacion.length > 0 && (
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/30">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-4 pt-3 pb-1">Opciones de Equipo</p>
                    {opcionesInstalacion.map((opcion, idx) => (
                      <div key={idx}>
                        {idx > 0 && <div className={iosDivider} />}
                        <div className="flex items-center px-4 py-2.5 gap-3">
                          <Input placeholder="Ej. Módem WiFi" value={opcion.equipo} onChange={(e) => updateInstOpcion(idx, "equipo", e.target.value)} className={`${iosInput} text-sm flex-1`} />
                          <Input type="number" placeholder="$0" value={opcion.precio} onChange={(e) => updateInstOpcion(idx, "precio", e.target.value)} className={`${iosInput} text-sm w-20 text-right`} />
                          <button onClick={() => removeInstOpcion(idx)} className="shrink-0 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-zinc-100 dark:border-zinc-800" />
                <button onClick={addInstOpcion} className="w-full px-4 py-2.5 text-xs font-semibold text-primary hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-center gap-1.5"><PlusCircle size={14} /> Añadir Opción</button>
              </div>
            </section>
          </>
        )}

        <section>
          <p className={iosSection}>Observaciones</p>
          <div className={iosCard}>
            <div className="px-4 py-3.5">
              <Textarea placeholder="Notas u observaciones generales..." value={notas} onChange={(e) => setNotas(e.target.value)} className="border-0 bg-transparent shadow-none resize-none text-base text-zinc-900 dark:text-zinc-100 focus-visible:ring-0 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 min-h-[80px] p-0" />
            </div>
          </div>
        </section>

        <div className="sticky bottom-6 z-10 pt-4 space-y-2">
          {hasExistingData && estado && municipio && parroquia && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!operadorId || !estado || !municipio || !parroquia) return;
                const opName = operadores.find((o: any) => o.id === parseInt(operadorId))?.nombre || "esta operadora";
                const confirm = window.confirm(`¿Eliminar toda la presencia de ${opName} en ${parroquia}, ${municipio}?\n\nEsto borrará todas las promociones, instalación y notas de esta zona específica. Los planes estándar nacionales NO se verán afectados.`);
                if (!confirm) return;
                setDeletingZone(true);
                try {
                  await deleteOfertaZona(parseInt(operadorId), estado, municipio, parroquia);
                  toast({ title: "Zona eliminada", description: `Se eliminó la presencia en ${parroquia}, ${municipio}.` });
                  router.push("/ventas/competencia");
                } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                } finally {
                  setDeletingZone(false);
                }
              }}
              disabled={deletingZone || saving}
              className="w-full h-12 rounded-2xl text-sm font-semibold border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 gap-2"
            >
              {deletingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Eliminar Presencia en esta Zona
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={saving} className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Guardar
          </Button>
        </div>
      </div>
      
      {/* Dialog: Nueva Operadora */}
      <Dialog open={isOperadorModalOpen} onOpenChange={setIsOperadorModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-lg font-bold">{editingOpId ? "Editar Operadora" : "Nueva Operadora"}</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className={iosCard}>
              <div className="px-4 py-3.5">
                <p className={iosLabel}>Nombre *</p>
                <Input placeholder="Ej. Fibex, Inter, Netuno..." value={newOpName} onChange={(e) => setNewOpName(e.target.value)} className={iosInput} autoFocus />
              </div>
              <div className={iosDivider} />
              <div className="px-4 py-3.5">
                <p className={iosLabel}>Color de Marca</p>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={newOpColor} onChange={(e) => setNewOpColor(e.target.value)} className="h-8 w-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer bg-transparent p-0.5" />
                  <span className="font-mono text-sm text-zinc-500">{newOpColor}</span>
                </div>
              </div>
              <div className={iosDivider} />
              <div className="px-4 py-3.5">
                <p className={iosLabel}>URL del Logo <span className="font-normal normal-case tracking-normal text-zinc-300 dark:text-zinc-600">(opcional)</span></p>
                <Input placeholder="https://ejemplo.com/logo.png" value={newOpLogo} onChange={(e) => setNewOpLogo(e.target.value)} className={`${iosInput} text-sm`} />
              </div>
            </div>
            {newOpName && (
              <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                {newOpLogo ? <img src={newOpLogo} alt="preview" className="w-8 h-8 object-contain rounded-md" /> : <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: newOpColor }} />}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{newOpName}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between px-5 pb-5">
            {editingOpId ? (
              <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2" onClick={handleDeleteOperador} disabled={savingOp}>
                <Trash2 size={18} />
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOperadorModalOpen(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={handleSaveOperador} disabled={savingOp || !newOpName} className="rounded-xl gap-2">
                {savingOp ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingOpId ? <Edit2 size={16} /> : <Plus size={16} />)}
                {editingOpId ? "Guardar Cambios" : "Crear Operadora"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Importar Promoción Existente */}
      <Dialog open={isImportPromoModalOpen} onOpenChange={setIsImportPromoModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-lg font-bold">Importar Promoción Existente</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            {loadingNationalPromos ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Buscando promociones nacionales...</span>
              </div>
            ) : nationalPromos.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                No se encontraron promociones previas registradas para este operador.
              </div>
            ) : (
              <div className="space-y-2">
                {nationalPromos.map((p, idx) => (
                  <div key={idx} onClick={() => handleImportPromo(p)} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors flex justify-between items-center group">
                    <div>
                      {p.nombre_plan && <p className="text-[10px] font-bold text-amber-500 uppercase">{p.nombre_plan}</p>}
                      <div className="flex items-end gap-2">
                        <span className="font-black text-zinc-900 dark:text-zinc-100">{p.velocidad} Mbps</span>
                        <span className="text-xs text-zinc-500 font-medium mb-0.5">{p.tecnologia}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">${p.precio_promo}</span>
                      <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"><Copy size={10} /> Copiar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setIsImportPromoModalOpen(false)} className="rounded-xl w-full">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Datalist para Autocompletado de Servicios */}
      <datalist id="srv-names-list">
        {serviceNameSuggestions.map((name, i) => (
          <option key={i} value={name} />
        ))}
      </datalist>
    </PremiumPageLayout>
  );
}
