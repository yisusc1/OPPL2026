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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/user-provider";
import { getVentasConfig, saveActividad } from "@/app/actions/ventas";
import { getSystemSettings } from "@/app/admin/settings-actions";
import { Loader2, FlaskConical } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "Visita a Condominio", label: "🏢 Visita a Condominio" },
  { value: "Recorrido (Solo)", label: "🚶 Recorrido (Solo)" },
  { value: "Recorrido con Instaladores", label: "🚐 Recorrido con Instaladores" },
  { value: "Recorrido con Distribución", label: "📦 Recorrido con Distribución" },
  { value: "Stand Publicitario", label: "🎪 Stand Publicitario" },
  { value: "Iglu Publicitario", label: "🛖 Iglu Publicitario" },
  { value: "Caravana", label: "📣 Caravana" },
];

export default function NuevaActividadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUser();
  const asesor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  const [geoHierarchy, setGeoHierarchy] = useState<Record<string, Record<string, Record<string, string[]>>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autofillEnabled, setAutofillEnabled] = useState(false);

  // Form state
  const [tipo, setTipo] = useState("");
  const [captados, setCaptados] = useState("");
  const [volantes, setVolantes] = useState("");
  const [condominio, setCondominio] = useState("");
  const [notas, setNotas] = useState("");
  const [contactoTelefonico, setContactoTelefonico] = useState(false);
  const [llamadasInfo, setLlamadasInfo] = useState("");

  // Geo state
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const config = await getVentasConfig();
        setGeoHierarchy(config.geoHierarchy);
        // Check autofill setting
        const sys = await getSystemSettings();
        setAutofillEnabled(sys["AUTOFILL_ENABLED"] === true);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];
  const sectores = estado && municipio && parroquia ? (geoHierarchy[estado]?.[municipio]?.[parroquia] || []).sort() : [];

  function handleAutofill() {
    const types = ACTIVITY_TYPES.map(t => t.value);
    setTipo(types[Math.floor(Math.random() * types.length)]);
    setCaptados(String(Math.floor(Math.random() * 5) + 1));
    setVolantes(String(Math.floor(Math.random() * 20)));
    setCondominio("Res. Los Samanes");
    setNotas("Actividad de prueba autogenerada");
    // Fill first available location
    const firstEstado = estados[0];
    if (firstEstado) {
      setEstado(firstEstado);
      const muns = Object.keys(geoHierarchy[firstEstado] || {}).sort();
      if (muns[0]) {
        setMunicipio(muns[0]);
        const pars = Object.keys(geoHierarchy[firstEstado]?.[muns[0]] || {}).sort();
        if (pars[0]) {
          setParroquia(pars[0]);
          const secs = (geoHierarchy[firstEstado]?.[muns[0]]?.[pars[0]] || []).sort();
          if (secs[0]) setSector(secs[0]);
        }
      }
    }
    toast({ title: "Formulario llenado con datos de prueba" });
  }

  async function handleSubmit(addAnother: boolean) {
    if (!tipo) {
      toast({ title: "Seleccione un tipo de actividad", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      // Guardar hora en formato 24h para Supabase (la conversión a 12h se hace en ventas.ts para Google Sheets)
      const hora = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      await saveActividad({
        fecha: now.toISOString().split("T")[0],
        hora: hora,
        asesor,
        tipo,
        clientes_captados: parseInt(captados) || 0,
        volantes: parseInt(volantes) || 0,
        llamadas_info: contactoTelefonico ? (parseInt(llamadasInfo) || 0) : 0,
        llamadas_agenda: 0, // Ahora se cuenta dinámicamente desde las solicitudes
        estado: estado || "N/A",
        municipio: municipio || "N/A",
        parroquia: parroquia || "N/A",
        sector: sector || undefined,
        condominio: condominio || undefined,
        notas: notas || undefined,
      });

      toast({ title: "✓ Actividad guardada" });

      if (addAnother) {
        setTipo("");
        setCaptados("");
        setVolantes("");
        setCondominio("");
        setNotas("");
        setContactoTelefonico(false);
        setLlamadasInfo("");
        setEstado("");
        setMunicipio("");
        setParroquia("");
        setSector("");
      } else {
        router.push("/ventas/actividades");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PremiumPageLayout title="Nueva Actividad">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout title="Nueva Actividad" description={`Asesor: ${asesor}`}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Section 1: General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo de Actividad</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="w-full mt-1.5">
                  <SelectValue placeholder="Seleccionar actividad..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Metrics */}
        {tipo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Métricas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone Contact Toggle */}
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contacto Telefónico</p>
                  <p className="text-xs text-zinc-500">¿Recibiste llamadas en esta zona?</p>
                </div>
                <Switch checked={contactoTelefonico} onCheckedChange={setContactoTelefonico} />
              </div>

              {contactoTelefonico && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label>Llamadas Info</Label>
                    <Input type="number" min={0} placeholder="0" value={llamadasInfo} onChange={(e) => setLlamadasInfo(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
              )}

              {tipo === "Visita a Condominio" && (
                <div>
                  <Label>Nombre del Condominio</Label>
                  <Input placeholder="Ej. Res. Las Rosas" value={condominio} onChange={(e) => setCondominio(e.target.value)} className="mt-1.5" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Clientes Captados</Label>
                  <Input type="number" min={0} placeholder="0" value={captados} onChange={(e) => setCaptados(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Volantes Entregados</Label>
                  <Input type="number" min={0} placeholder="0" value={volantes} onChange={(e) => setVolantes(e.target.value)} className="mt-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Location */}
        {tipo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Ubicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estado</Label>
                  <Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); setSector(""); }}>
                    <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Municipio</Label>
                  <Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); setSector(""); }} disabled={!estado}>
                    <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Parroquia</Label>
                  <Select value={parroquia} onValueChange={(v) => { setParroquia(v); setSector(""); }} disabled={!municipio}>
                    <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sector</Label>
                  <Select value={sector} onValueChange={setSector} disabled={!parroquia}>
                    <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>{sectores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Notes */}
        {tipo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Detalles o incidencias extra..." value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {tipo && (
          <div className="flex flex-col gap-3 pt-2 pb-8">
            <Button onClick={() => handleSubmit(false)} disabled={saving} className="w-full h-12 rounded-xl text-base gap-2">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Guardar y Finalizar
            </Button>
            <Button onClick={() => handleSubmit(true)} disabled={saving} variant="outline" className="w-full h-12 rounded-xl text-base">
              Añadir Otra Actividad
            </Button>
          </div>
        )}
      </div>

      {autofillEnabled && (
        <button
          type="button"
          onClick={handleAutofill}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all hover:scale-105 active:scale-95"
        >
          <FlaskConical size={18} />
          Auto-llenar
        </button>
      )}
    </PremiumPageLayout>
  );
}
