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
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { getVentasConfig } from "@/app/actions/ventas";
import { getOperadores, saveOferta } from "@/app/actions/competencia";
import { Loader2 } from "lucide-react";

const TIPOS_NOVEDAD = [
  "Nuevo Plan",
  "Promo Instalación",
  "Ajuste de Precio",
  "Nuevo Operador en la Zona",
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
  const [velocidad, setVelocidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [costoInstalacion, setCostoInstalacion] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [incluyeTv, setIncluyeTv] = useState(false);
  const [detalleTv, setDetalleTv] = useState("");
  const [notas, setNotas] = useState("");

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

  async function handleSubmit() {
    if (!estado || !municipio || !parroquia || !operadorId || !tipoNovedad || !velocidad || !precio) {
      toast({ title: "Faltan datos", description: "Por favor llena los campos requeridos.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await saveOferta({
        operador_id: parseInt(operadorId),
        estado,
        municipio,
        parroquia,
        tipo_novedad: tipoNovedad,
        velocidad_mb: parseInt(velocidad),
        precio_mensual: parseFloat(precio),
        costo_instalacion: costoInstalacion ? parseFloat(costoInstalacion) : 0,
        modalidad_instalacion: modalidad || "Venta de Equipo",
        incluye_tv: incluyeTv,
        detalle_tv: incluyeTv ? detalleTv : undefined,
        notas,
        asesor_nombre: asesor || "Asesor Desconocido",
      });

      toast({ title: "Novedad guardada exitosamente" });
      router.push("/ventas/competencia");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
              <Select value={operadorId} onValueChange={setOperadorId}>
                <SelectTrigger className="w-full h-12 rounded-xl text-base"><SelectValue placeholder="Seleccionar operador..." /></SelectTrigger>
                <SelectContent>
                  {operadores.map((op) => (
                    <SelectItem key={op.id} value={String(op.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: op.color_hex }} />
                        {op.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Velocidad (Mbps)</Label>
                <Input type="number" min="0" placeholder="Ej: 400" value={velocidad} onChange={(e) => setVelocidad(e.target.value)} className="h-12 rounded-xl text-base" />
              </div>
              <div className="space-y-1">
                <Label>Precio ($/mes)</Label>
                <Input type="number" min="0" step="0.01" placeholder="Ej: 25.50" value={precio} onChange={(e) => setPrecio(e.target.value)} className="h-12 rounded-xl text-base" />
              </div>
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
    </PremiumPageLayout>
  );
}
