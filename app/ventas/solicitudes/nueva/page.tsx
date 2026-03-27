"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getVentasConfig, saveSolicitud, getActividadesDelDia } from "@/app/actions/ventas";
import { Loader2, Link2 } from "lucide-react";

// Fuentes cuando se accede DESDE una actividad (la actividad ya está vinculada)
const FUENTES_DESDE_ACTIVIDAD = [
  { value: "Recorrido", label: "Recorrido del Asesor" },
  { value: "Volante", label: "Volante" },
  { value: "Llamada", label: "Llamada Telefónica" },
  { value: "WhatsApp", label: "Mensajería (WhatsApp)" },
  { value: "Referido", label: "Referido / Recomendación" },
  { value: "Stand", label: "Stand Publicitario" },
  { value: "Otro", label: "Otro" },
];

// Fuentes cuando se accede desde el formulario standalone
const FUENTES_STANDALONE = [
  { value: "Actividad", label: "Desde una Actividad" },
  { value: "Llamada", label: "Llamada Telefónica" },
  { value: "WhatsApp", label: "Mensajería (WhatsApp)" },
  { value: "Instagram", label: "Instagram / Redes" },
  { value: "Referido", label: "Referido / Recomendación" },
  { value: "Volante", label: "Volante" },
  { value: "Stand", label: "Stand Publicitario" },
  { value: "Otro", label: "Otro" },
];

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { profile } = useUser();

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Actividad vinculada desde URL
  const urlActividadId = searchParams.get("actividad_id");
  const urlFuenteActividad = searchParams.get("fuente_actividad");
  const isFromActivity = !!urlActividadId;

  // Actividades del día (solo si standalone y elige "Actividad")
  const [actividadesDelDia, setActividadesDelDia] = useState<any[]>([]);
  const [actividadId, setActividadId] = useState<string>(urlActividadId || "");

  // Client data
  const [fechaDisp, setFechaDisp] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [cedulaTipo, setCedulaTipo] = useState("V-");
  const [cedulaNum, setCedulaNum] = useState("");
  const [genero, setGenero] = useState("");
  const [fechaNac, setFechaNac] = useState("");

  // Location
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [parroquia, setParroquia] = useState("");
  const [sector, setSector] = useState("");
  const [direccion, setDireccion] = useState("");

  // Service
  const [tipoServicio, setTipoServicio] = useState("Domiciliario");
  const [plan, setPlan] = useState("");
  const [powerGo, setPowerGo] = useState(false);

  // Contact
  const [telefonoP, setTelefonoP] = useState("");
  const [telefonoS, setTelefonoS] = useState("");
  const [correo, setCorreo] = useState("");
  const [fuente, setFuente] = useState("");
  const promotor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getVentasConfig();
        setConfig(cfg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load activities when "Actividad" fuente is selected (standalone mode only)
  useEffect(() => {
    if (!isFromActivity && fuente === "Actividad" && promotor) {
      (async () => {
        try {
          const acts = await getActividadesDelDia(promotor);
          setActividadesDelDia(acts);
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [fuente, promotor, isFromActivity]);

  const geoHierarchy = config?.geoHierarchy || {};
  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];
  const sectores = estado && municipio && parroquia ? (geoHierarchy[estado]?.[municipio]?.[parroquia] || []).sort() : [];
  const activePlanes = (config?.planes || []).filter((p: any) => p.activo !== false && p.tipo === tipoServicio);

  // Pick the right fuentes list
  const fuentesList = isFromActivity ? FUENTES_DESDE_ACTIVIDAD : FUENTES_STANDALONE;

  async function handleSubmit() {
    if (!nombres || !apellidos || !cedulaNum || !genero || !estado || !municipio || !parroquia || !direccion || !plan || !telefonoP || !fuente || !promotor) {
      toast({ title: "Complete todos los campos obligatorios", variant: "destructive" });
      return;
    }

    if (!isFromActivity && fuente === "Actividad" && !actividadId) {
      toast({ title: "Seleccione la actividad vinculada", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const formData: any = {
        fecha_disponibilidad: fechaDisp || undefined,
        nombres,
        apellidos,
        cedula: cedulaTipo + cedulaNum,
        genero,
        estado,
        municipio,
        parroquia,
        sector: sector || undefined,
        direccion,
        tipo_servicio: tipoServicio,
        plan,
        promotor,
        telefono_principal: telefonoP,
        telefono_secundario: telefonoS || undefined,
        correo: correo || undefined,
        power_go: powerGo,
        fecha_nacimiento: fechaNac || undefined,
        fuente,
      };

      // Link to activity
      if (isFromActivity && urlActividadId) {
        formData.actividad_id = parseInt(urlActividadId);
      } else if (fuente === "Actividad" && actividadId) {
        formData.actividad_id = parseInt(actividadId);
      }

      await saveSolicitud(formData);

      // Generate plain text WhatsApp message (no emojis)
      const todayStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      const formatDate = (d: string) => {
        if (!d) return "";
        const [y, m, dd] = d.split("-");
        return `${dd}/${m}/${y}`;
      };

      let waMsg = `Fecha de solicitud: ${todayStr}\n`;
      waMsg += `Fecha de Disponibilidad: ${fechaDisp ? formatDate(fechaDisp) : ""}\n\n`;
      waMsg += `Nombres: ${nombres} Apellidos: ${apellidos}\n`;
      waMsg += `Cédula/RIF: ${cedulaTipo}${cedulaNum}\n`;
      waMsg += `Estado: ${estado}, Municipio: ${municipio}, Parroquia: ${parroquia}`;
      if (sector) waMsg += `, Sector: ${sector}`;
      waMsg += `, Calle / Casa / Apto: ${direccion}\n`;
      waMsg += `Tipo de Servicio: ${tipoServicio}\n`;
      waMsg += `Plan: ${plan}\n`;
      waMsg += `Promotor/a: ${promotor}\n`;
      waMsg += `Teléfono principal: ${telefonoP}\n`;
      waMsg += `Teléfono secundario: ${telefonoS || telefonoP}\n`;
      waMsg += `Correo Electrónico: ${correo || ""}\n`;
      waMsg += `Power Go: ${powerGo ? "SI" : "NO"}\n`;
      waMsg += `Fuente: ${fuente}`;

      window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, "_blank");

      toast({ title: "Solicitud guardada" });

      if (isFromActivity) {
        router.push("/ventas/actividades");
      } else {
        router.push("/ventas/solicitudes");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PremiumPageLayout title="Nueva Solicitud">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </PremiumPageLayout>
    );
  }

  return (
    <PremiumPageLayout title="Nueva Solicitud" description="Registro de un nuevo prospecto de servicio.">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Vinculación Banner */}
        {isFromActivity && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl">
            <Link2 size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Solicitud vinculada a actividad</p>
              <p className="text-xs text-blue-500">{urlFuenteActividad ? decodeURIComponent(urlFuenteActividad) : `Actividad #${urlActividadId}`}</p>
            </div>
          </div>
        )}

        {/* Meta Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Información de Registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
               <Label className="text-xs text-zinc-500 uppercase">Promotor/a Detectado</Label>
               <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{promotor || "No identificado"}</p>
            </div>
            <div>
              <Label>Fecha de Disponibilidad</Label>
              <Input type="date" value={fechaDisp} onChange={(e) => setFechaDisp(e.target.value)} className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Client Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombres</Label>
                <Input placeholder="Ej: Juan" value={nombres} onChange={(e) => setNombres(e.target.value)} className="mt-1.5 capitalize" />
              </div>
              <div>
                <Label>Apellidos</Label>
                <Input placeholder="Ej: Pérez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="mt-1.5 capitalize" />
              </div>
            </div>
            <div>
              <Label>Cédula / RIF</Label>
              <div className="flex gap-2 mt-1.5">
                <Select value={cedulaTipo} onValueChange={setCedulaTipo}>
                  <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V-">V-</SelectItem>
                    <SelectItem value="E-">E-</SelectItem>
                    <SelectItem value="J-">J-</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="12345678" value={cedulaNum} onChange={(e) => setCedulaNum(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Género</Label>
                <Select value={genero} onValueChange={setGenero}>
                  <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de Nacimiento <span className="text-zinc-400 font-normal">(Opc.)</span></Label>
                <Input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
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
            <div>
              <Label>Dirección (Calle / Casa / Apto)</Label>
              <Textarea placeholder="Ej: Calle 4, Res. Las Rosas, Apto 2-B" value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Detalles del Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Servicio</Label>
                <div className="flex gap-2 mt-1.5">
                  <Button type="button" variant={tipoServicio === "Domiciliario" ? "default" : "outline"} className="flex-1" onClick={() => { setTipoServicio("Domiciliario"); setPlan(""); }}>
                    Domiciliario
                  </Button>
                  <Button type="button" variant={tipoServicio === "Empresarial" ? "default" : "outline"} className="flex-1" onClick={() => { setTipoServicio("Empresarial"); setPlan(""); setPowerGo(false); }}>
                    Empresarial
                  </Button>
                </div>
              </div>
              <div>
                <Label>Power Go</Label>
                <div className="flex items-center gap-3 mt-3">
                  <Switch checked={powerGo} onCheckedChange={setPowerGo} disabled={tipoServicio === "Empresarial"} />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">{powerGo ? "SI" : "NO"}</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Plan a Contratar</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccione plan..." /></SelectTrigger>
                <SelectContent>
                  {activePlanes.length > 0 ? (
                    activePlanes.map((p: any) => {
                      const display = p.nombre + (p.has_tv ? " + TV" : "");
                      return <SelectItem key={p.id} value={display}>{display}</SelectItem>;
                    })
                  ) : (
                    (tipoServicio === "Domiciliario"
                      ? ["400MB", "600MB", "1GB", "400MB + TV", "600MB + TV", "1GB + TV"]
                      : ["50MB", "100MB", "200MB", "Plan Dedicado"]
                    ).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Contacto y Fuente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Teléfono Principal</Label>
                <Input type="tel" placeholder="0414-1234567" value={telefonoP} onChange={(e) => setTelefonoP(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Teléfono Secundario</Label>
                <Input type="tel" placeholder="Opcional" value={telefonoS} onChange={(e) => setTelefonoS(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Correo Electrónico <span className="text-zinc-400 font-normal">(Opcional)</span></Label>
              <Input type="email" placeholder="cliente@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} className="mt-1.5" />
            </div>

            {/* Fuente */}
            <div>
              <Label>{isFromActivity ? "¿Cómo se captó este cliente?" : "¿Cómo se obtuvo este cliente?"}</Label>
              <Select value={fuente} onValueChange={(v) => { setFuente(v); if (v !== "Actividad") setActividadId(""); }}>
                <SelectTrigger className="w-full mt-1.5"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {fuentesList.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Selector — only in standalone mode when "Actividad" is chosen */}
            {!isFromActivity && fuente === "Actividad" && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2">
                <Label className="text-blue-700 dark:text-blue-300 text-xs uppercase font-semibold">Vincular a Actividad del Día</Label>
                {actividadesDelDia.length === 0 ? (
                  <p className="text-xs text-blue-500">No hay actividades registradas hoy. Crea una primero.</p>
                ) : (
                  <Select value={actividadId} onValueChange={setActividadId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar actividad..." /></SelectTrigger>
                    <SelectContent>
                      {actividadesDelDia.map((act: any) => (
                        <SelectItem key={act.id} value={String(act.id)}>
                          {act.tipo} ({act.hora}) - {act.parroquia || "Sin ubicación"}{act.sector ? `, ${act.sector}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="pb-8">
          <Button onClick={handleSubmit} disabled={saving} className="w-full h-12 rounded-xl text-base gap-2">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Guardar y Enviar WhatsApp
          </Button>
        </div>
      </div>
    </PremiumPageLayout>
  );
}
