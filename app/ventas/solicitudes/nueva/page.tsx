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
import { getSystemSettings, getTvLabel } from "@/app/admin/settings-actions";
import { Loader2, Link2, FlaskConical, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DrumDatePicker } from "@/components/ui/drum-date-picker";

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
  const [autofillEnabled, setAutofillEnabled] = useState(false);
  const [tvLabel, setTvLabel] = useState("TV");

  // Actividad vinculada desde URL
  const urlActividadId = searchParams.get("actividad_id");
  const urlFuenteActividad = searchParams.get("fuente_actividad");
  const isFromActivity = !!urlActividadId;

  // Actividades del día (solo si standalone y elige "Actividad")
  const [actividadesDelDia, setActividadesDelDia] = useState<any[]>([]);
  const [actividadId, setActividadId] = useState<string>(urlActividadId || "");

  // Client data
  const [fechaDisp, setFechaDisp] = useState(format(new Date(), "yyyy-MM-dd"));
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
  const [incluyeTv, setIncluyeTv] = useState(false);

  // Contact
  const [telefonoP, setTelefonoP] = useState("");
  const [telefonoS, setTelefonoS] = useState("");
  const [correo, setCorreo] = useState("");
  const [fuente, setFuente] = useState("");
  const promotor = profile ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "";

  useEffect(() => {
    (async () => {
      try {
        const [cfg, sys, tvLab] = await Promise.all([
          getVentasConfig(),
          getSystemSettings(),
          getTvLabel()
        ]);
        setConfig(cfg);
        setAutofillEnabled(sys["AUTOFILL_ENABLED"] === true);
        setTvLabel(tvLab);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load activities for linking (always load when we have a promotor in standalone mode)
  useEffect(() => {
    if (!isFromActivity && promotor) {
      (async () => {
        try {
          const acts = await getActividadesDelDia(promotor);
          setActividadesDelDia(acts);
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [promotor, isFromActivity]);

  const geoHierarchy = config?.geoHierarchy || {};
  const estados = Object.keys(geoHierarchy).sort();
  const municipios = estado ? Object.keys(geoHierarchy[estado] || {}).sort() : [];
  const parroquias = estado && municipio ? Object.keys(geoHierarchy[estado]?.[municipio] || {}).sort() : [];
  const sectores = estado && municipio && parroquia ? (geoHierarchy[estado]?.[municipio]?.[parroquia] || []).sort() : [];
  const activePlanes = (config?.planes || []).filter((p: any) => p.activo !== false && p.tipo === tipoServicio);

  // Pick the right fuentes list
  const fuentesList = isFromActivity ? FUENTES_DESDE_ACTIVIDAD : FUENTES_STANDALONE;

  async function handleSubmit() {
    if (!fechaDisp || !nombres || !apellidos || !cedulaNum || !genero || !fechaNac || !estado || !municipio || !parroquia || !sector || !direccion || !tipoServicio || !plan || !telefonoP || !correo || !fuente || !promotor) {
      toast({ title: "Complete todos los campos obligatorios", description: "Todos los campos a excepción del teléfono secundario son requeridos.", variant: "destructive" });
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
        power_go: incluyeTv,
        fecha_nacimiento: fechaNac || undefined,
        fuente,
      };

      // Link to activity
      if (isFromActivity && urlActividadId) {
        formData.actividad_id = parseInt(urlActividadId);
      } else if (actividadId) {
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
      waMsg += `${tvLabel}: ${incluyeTv ? "SI" : "NO"}\n`;
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
              <Label className="mb-2 block text-[13px]">Fecha de Disponibilidad</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background h-11 rounded-lg">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaDisp ? format(parseISO(fechaDisp), "PPP", { locale: es }) : <span className="text-muted-foreground">Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-4 z-[9999]" align="start">
                  <DrumDatePicker value={fechaDisp} onChange={setFechaDisp} minDate={new Date()} />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Client Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Datos del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Nombres</Label>
                <Input placeholder="Ej: Juan" value={nombres} onChange={(e) => setNombres(e.target.value)} className="h-11 rounded-lg capitalize" />
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Apellidos</Label>
                <Input placeholder="Ej: Pérez" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="h-11 rounded-lg capitalize" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-[13px]">Cédula / RIF</Label>
              <div className="flex gap-2">
                <Select value={cedulaTipo} onValueChange={setCedulaTipo}>
                  <SelectTrigger className="w-[85px] shrink-0 h-11 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V-">V-</SelectItem>
                    <SelectItem value="E-">E-</SelectItem>
                    <SelectItem value="J-">J-</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="12345678" value={cedulaNum} onChange={(e) => setCedulaNum(e.target.value)} className="flex-1 h-11 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Género</Label>
                <Select value={genero} onValueChange={setGenero}>
                  <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Fecha de Nacimiento <span className="text-muted-foreground">(Opc.)</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-background h-11 rounded-lg">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaNac ? format(parseISO(fechaNac), "PPP", { locale: es }) : <span className="text-muted-foreground">Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-4 z-[9999]" align="start">
                    <DrumDatePicker value={fechaNac} onChange={setFechaNac} maxYear={new Date().getFullYear()} />
                  </PopoverContent>
                </Popover>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Estado</Label>
                <Select value={estado} onValueChange={(v) => { setEstado(v); setMunicipio(""); setParroquia(""); setSector(""); }}>
                  <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Municipio</Label>
                <Select value={municipio} onValueChange={(v) => { setMunicipio(v); setParroquia(""); setSector(""); }} disabled={!estado}>
                  <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Parroquia</Label>
                <Select value={parroquia} onValueChange={(v) => { setParroquia(v); setSector(""); }} disabled={!municipio}>
                  <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{parroquias.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Sector</Label>
                <Select value={sector} onValueChange={setSector} disabled={!parroquia}>
                  <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                  <SelectContent>{sectores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Dirección (Calle / Casa / Apto)</Label>
              <Textarea placeholder="Ej: Calle 4, Res. Las Rosas, Apto 2-B" value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={3} className="mt-2 rounded-lg resize-none" />
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Detalles del Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="w-full">
                <Label className="mb-2 block text-[13px]">Tipo de Servicio</Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="button" variant={tipoServicio === "Domiciliario" ? "default" : "outline"} className="flex-1 h-12 rounded-xl" onClick={() => { setTipoServicio("Domiciliario"); setPlan(""); }}>
                    Domiciliario
                  </Button>
                  <Button type="button" variant={tipoServicio === "Empresarial" ? "default" : "outline"} className="flex-1 h-12 rounded-xl" onClick={() => { setTipoServicio("Empresarial"); setPlan(""); }}>
                    Empresarial
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-border/60 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">{tvLabel}</Label>
                  <p className="text-xs text-muted-foreground">Incluir servicio de {tvLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{incluyeTv ? "SÍ" : "NO"}</span>
                  <Switch checked={incluyeTv} onCheckedChange={setIncluyeTv} />
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-[13px]">Plan a Contratar</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue placeholder="Seleccione plan..." /></SelectTrigger>
                <SelectContent>
                  {activePlanes.length > 0 ? (
                    activePlanes.map((p: any) => {
                      const display = p.nombre + (p.has_tv ? ` + ${tvLabel}` : "");
                      return <SelectItem key={p.id} value={display}>{display}</SelectItem>;
                    })
                  ) : (
                    (tipoServicio === "Domiciliario"
                      ? ["400MB", "600MB", "1GB", `400MB + ${tvLabel}`, `600MB + ${tvLabel}`, `1GB + ${tvLabel}`]
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Telf. Principal</Label>
                <Input type="tel" placeholder="0414-1234567" value={telefonoP} onChange={(e) => setTelefonoP(e.target.value)} className="h-11 rounded-lg" />
              </div>
              <div className="flex flex-col justify-end min-w-0">
                <Label className="mb-2 truncate text-[13px]">Telf. Opcional</Label>
                <Input type="tel" placeholder="Opcional" value={telefonoS} onChange={(e) => setTelefonoS(e.target.value)} className="h-11 rounded-lg" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-[13px]">Correo Electrónico</Label>
              <Input type="email" placeholder="cliente@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} className="h-11 rounded-lg" />
            </div>

            {/* Fuente */}
            <div>
              <Label>{isFromActivity ? "¿Cómo se captó este cliente?" : "¿Cómo se obtuvo este cliente?"}</Label>
              <Select value={fuente} onValueChange={(v) => { setFuente(v); if (v !== "Actividad") setActividadId(""); }}>
                <SelectTrigger className="w-full mt-2 h-11 rounded-lg"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {fuentesList.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Selector — in standalone mode, optional for all fuentes */}
            {!isFromActivity && fuente && actividadesDelDia.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2">
                <Label className="text-blue-700 dark:text-blue-300 text-xs uppercase font-semibold">
                  {fuente === "Actividad" ? "Vincular a Actividad del Día (obligatorio)" : "Vincular a Actividad del Día (opcional)"}
                </Label>
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
              </div>
            )}
            {!isFromActivity && fuente === "Actividad" && actividadesDelDia.length === 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl">
                <p className="text-xs text-blue-500">No hay actividades registradas hoy. Crea una primero.</p>
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

      {autofillEnabled && (
        <button
          type="button"
          onClick={() => {
            const nombres_test = ["Carlos", "María", "José", "Ana", "Pedro", "Laura", "Miguel", "Sofía"];
            const apellidos_test = ["Gómez", "Rodríguez", "López", "Martínez", "Hernández", "Pérez", "García"];
            const n = nombres_test[Math.floor(Math.random() * nombres_test.length)];
            const a = apellidos_test[Math.floor(Math.random() * apellidos_test.length)];
            setNombres(n);
            setApellidos(a);
            setCedulaNum(String(Math.floor(Math.random() * 20000000) + 10000000));
            setGenero(Math.random() > 0.5 ? "M" : "F");
            setFechaNac("1990-05-15");
            setFechaDisp(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
            setDireccion("Av. Principal, Edif. Test, Piso 3");
            setTelefonoP("0414" + String(Math.floor(Math.random() * 9000000) + 1000000));
            setCorreo(`${n.toLowerCase()}.${a.toLowerCase()}@test.com`);
            setFuente(isFromActivity ? "Recorrido" : "Llamada");
            setPlan("");
            // Fill first available location
            const gh = config?.geoHierarchy || {};
            const est = Object.keys(gh).sort();
            if (est[0]) {
              setEstado(est[0]);
              const muns = Object.keys(gh[est[0]] || {}).sort();
              if (muns[0]) {
                setMunicipio(muns[0]);
                const pars = Object.keys(gh[est[0]]?.[muns[0]] || {}).sort();
                if (pars[0]) {
                  setParroquia(pars[0]);
                  const secs = (gh[est[0]]?.[muns[0]]?.[pars[0]] || []).sort();
                  if (secs[0]) setSector(secs[0]);
                }
              }
            }
            toast({ title: "Formulario llenado con datos de prueba" });
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-amber-500 text-white font-semibold shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-all hover:scale-105 active:scale-95"
        >
          <FlaskConical size={18} />
          Auto-llenar
        </button>
      )}
    </PremiumPageLayout>
  );
}
