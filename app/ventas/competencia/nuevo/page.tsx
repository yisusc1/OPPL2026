"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOperadores, saveOfertasBatch, saveOperador } from "@/app/actions/competencia";
import { Loader2, Plus, Trash2 } from "lucide-react";

const TIPOS_NOVEDAD = [
  "Nuevo Plan",
  "Promo Instalación",
  "Ajuste de Precio",
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

export default function NuevaOfertaCompetencia() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUser();
  const asesor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  const [operadores, setOperadores] = useState<any[]>([]);

  // Form State
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [tipoNovedad, setTipoNovedad] = useState("");
  const [planes, setPlanes] = useState([{ velocidad: "", precio: "" }]);
  const [costoInstalacion, setCostoInstalacion] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [incluyeTv, setIncluyeTv] = useState(false);
  const [detalleTv, setDetalleTv] = useState("");
  const [notas, setNotas] = useState("");

  // New Operator State
  const [isOperadorModalOpen, setIsOperadorModalOpen] = useState(false);
  const [newOpName, setNewOpName] = useState("");
  const [newOpColor, setNewOpColor] = useState("#3b82f6"); // Default blue
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

  const updatePlan = (index: number, field: string, value: string) => {
    const newPlanes = [...planes];
    newPlanes[index] = { ...newPlanes[index], [field]: value };
    setPlanes(newPlanes);
  };

  const removePlan = (index: number) => {
    if (planes.length > 1) {
      setPlanes(planes.filter((_, i) => i !== index));
    }
  };

  const addPlan = () => {
    setPlanes([...planes, { velocidad: "", precio: "" }]);
  };

  async function handleSubmit() {
    const validPlanes = planes.filter((p) => p.velocidad && p.precio);
    if (!estado || !municipio || !parroquia || !operadorId || !tipoNovedad || validPlanes.length === 0) {
      toast({ title: "Faltan datos", description: "Llena los campos requeridos y al menos un plan completo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const ofertasToInsert = validPlanes.map((p) => ({
        operador_id: parseInt(operadorId),
        estado,
        municipio,
        parroquia,
        tipo_novedad: tipoNovedad,
        velocidad_mb: parseInt(p.velocidad),
        precio_mensual: parseFloat(p.precio),
        costo_instalacion: costoInstalacion ? parseFloat(costoInstalacion) : 0,
        modalidad_instalacion: modalidad || "Venta de Equipo",
        incluye_tv: incluyeTv,
        detalle_tv: incluyeTv ? detalleTv : undefined,
        notas,
        asesor_nombre: asesor || "Asesor Desconocido",
      }));

      await saveOfertasBatch(ofertasToInsert);

      toast({ title: "Novedades guardadas exitosamente" });
      router.push("/ventas/competencia");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOperador() {
    if (!newOpName) {
      toast({ title: "Nombre requerido", variant: "destructive" });
      return;
    }
    setSavingOp(true);
    try {
      const data = await saveOperador(newOpName, newOpColor, newOpLogo || undefined);
      toast({ title: "Operador registrado exitosamente" });
      
      // Update local state without reloading everything
      const updatedOps = [...operadores, data].sort((a, b) => a.nombre.localeCompare(b.nombre));
      setOperadores(updatedOps);
      setOperadorId(String(data.id));
      
      setIsOperadorModalOpen(false);
      setNewOpName("");
      setNewOpColor("#3b82f6");
      setNewOpLogo("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingOp(false);
    }
  }

  if (loading) {
    return (
      <PremiumPageLayout title="Reportar Novedad">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout title="Reportar Novedad" description="Actualiza los planes de la competencia en tu zona actual.">
      <div className="max-w-xl mx-auto space-y-6 pb-20">
        
        {/* Sección: Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); }}>
                <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Municipio</Label>
              <Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); }} disabled={!estado}>
                <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Parroquia</Label>
              <Select value={parroquia} onValueChange={setParroquia} disabled={!municipio}>
                <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                <SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sección: Novedad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Detalles de la Oferta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Operador de la Competencia</Label>
              <div className="flex gap-2">
                <Select value={operadorId} onValueChange={setOperadorId}>
                  <SelectTrigger className="flex-1 h-12 rounded-xl text-base"><SelectValue placeholder="Seleccionar operador..." /></SelectTrigger>
                  <SelectContent>
                    {operadores.map((op) => (
                      <SelectItem key={op.id} value={String(op.id)}>
                        <div className="flex items-center gap-2">
                          {op.logo_url ? (
                            <img src={op.logo_url} alt={op.nombre} className="w-4 h-4 object-contain rounded-sm" />
                          ) : (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: op.color_hex }} />
                          )}
                          {op.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl shrink-0 border-dashed border-2" 
                  onClick={() => setIsOperadorModalOpen(true)}
                >
                  <Plus className="text-zinc-500" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Tipo de Novedad</Label>
              <Select value={tipoNovedad} onValueChange={setTipoNovedad}>
                <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_NOVEDAD.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-zinc-500">Planes Ofertados</Label>
              </div>
              
              <div className="space-y-3">
                {planes.map((plan, index) => (
                  <div key={index} className="flex gap-2 items-end bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Velocidad (Mbps)</Label>
                      <Input type="number" min="0" placeholder="Ej: 400" value={plan.velocidad} onChange={(e) => updatePlan(index, "velocidad", e.target.value)} className="h-10 rounded-lg" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Precio ($/mes)</Label>
                      <Input type="number" min="0" step="0.01" placeholder="Ej: 25.50" value={plan.precio} onChange={(e) => updatePlan(index, "precio", e.target.value)} className="h-10 rounded-lg" />
                    </div>
                    {planes.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removePlan(index)} className="h-10 w-10 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg">
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <Button variant="outline" onClick={addPlan} className="w-full mt-3 h-10 rounded-xl gap-2 border-dashed text-primary">
                <Plus size={16} /> Añadir otro plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sección: Instalación y Extras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Instalación y Extras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Costo Instalación ($)</Label>
                <Input type="number" min="0" step="0.01" placeholder="Ej: 40" value={costoInstalacion} onChange={(e) => setCostoInstalacion(e.target.value)} className="h-12 rounded-xl text-base" />
              </div>
              <div className="space-y-1">
                <Label>Modalidad</Label>
                <Select value={modalidad} onValueChange={setModalidad}>
                  <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Venta..." /></SelectTrigger>
                  <SelectContent>
                    {MODALIDADES_INSTALACION.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 mt-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">¿Incluye TV?</p>
                <p className="text-xs text-zinc-500">Activa si el plan cuenta con servicio de TV</p>
              </div>
              <Switch checked={incluyeTv} onCheckedChange={setIncluyeTv} />
            </div>

            {incluyeTv && (
              <div className="space-y-1 mt-2">
                <Label>Detalle de TV (Opcional)</Label>
                <Input placeholder="Ej: Básico, 60 Canales, App Android..." value={detalleTv} onChange={(e) => setDetalleTv(e.target.value)} className="h-12 rounded-xl text-base" />
              </div>
            )}
            
            <div className="space-y-1 pt-2">
              <Label>Notas u Observaciones</Label>
              <Textarea 
                placeholder="Ej: Requieren pagar 2 meses por adelantado..." 
                value={notas} 
                onChange={(e) => setNotas(e.target.value)} 
                className="rounded-xl resize-none text-base min-h-[100px]" 
              />
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-6 z-10 pt-4">
          <Button onClick={handleSubmit} disabled={saving} className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Guardar Novedad
          </Button>
        </div>
      </div>

      {/* Modal para Crear Operador */}
      <Dialog open={isOperadorModalOpen} onOpenChange={setIsOperadorModalOpen}>
        <DialogContent className="sm:max-w-md mx-4 rounded-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la Empresa</Label>
              <Input 
                placeholder="Ej. Intercable..." 
                value={newOpName} 
                onChange={(e) => setNewOpName(e.target.value)} 
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div className="space-y-2">
              <Label>Color de la Marca</Label>
              <div className="flex gap-3">
                <Input 
                  type="color" 
                  value={newOpColor} 
                  onChange={(e) => setNewOpColor(e.target.value)} 
                  className="h-12 w-16 p-1 cursor-pointer rounded-xl"
                />
                <Input 
                  type="text" 
                  value={newOpColor} 
                  onChange={(e) => setNewOpColor(e.target.value)} 
                  className="h-12 flex-1 rounded-xl uppercase font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL del Logo (Opcional)</Label>
              <Input 
                type="url" 
                placeholder="https://ejemplo.com/logo.png" 
                value={newOpLogo} 
                onChange={(e) => setNewOpLogo(e.target.value)} 
                className="h-12 rounded-xl text-base"
              />
              <p className="text-[10px] text-zinc-500">
                Puedes dejarlo en blanco y se usará la inicial con el color elegido.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsOperadorModalOpen(false)} className="w-full h-12 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSaveOperador} disabled={savingOp} className="w-full h-12 rounded-xl gap-2">
              {savingOp && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar y Seleccionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PremiumPageLayout>
  );
}
