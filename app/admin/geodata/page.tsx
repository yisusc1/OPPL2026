"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, MapPin, Loader2, ArrowLeft, ChevronRight, Home, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";
import { addGeodata } from "@/app/actions/ventas";

type Level = 0 | 1 | 2 | 3; // Estado, Municipio, Parroquia, Sector

export default function AdminGeodataPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geodata, setGeodata] = useState<any[]>([]);
  
  // Navigation State
  const [level, setLevel] = useState<Level>(0);
  const [selection, setSelection] = useState({
    estado: "",
    municipio: "",
    parroquia: ""
  });

  // Form input
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    loadGeodata();
  }, []);

  async function loadGeodata() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("geodata_config")
        .select("*")
        .order("estado")
        .order("municipio")
        .order("parroquia")
        .order("sector");
      if (error) throw error;
      setGeodata(data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Data Filtering
  const states = useMemo(() => Array.from(new Set(geodata.map(g => g.estado))).filter(Boolean), [geodata]);
  
  const municipalities = useMemo(() => {
    if (level < 1) return [];
    return Array.from(new Set(geodata.filter(g => g.estado === selection.estado).map(g => g.municipio))).filter(Boolean);
  }, [geodata, selection.estado, level]);

  const parishes = useMemo(() => {
    if (level < 2) return [];
    return Array.from(new Set(geodata.filter(g => g.estado === selection.estado && g.municipio === selection.municipio).map(g => g.parroquia))).filter(Boolean);
  }, [geodata, selection.estado, selection.municipio, level]);

  const sectors = useMemo(() => {
    if (level < 3) return [];
    return Array.from(new Set(geodata.filter(g => g.estado === selection.estado && g.municipio === selection.municipio && g.parroquia === selection.parroquia).map(g => g.sector))).filter(Boolean);
  }, [geodata, selection.estado, selection.municipio, selection.parroquia, level]);

  const currentItems = level === 0 ? states : level === 1 ? municipalities : level === 2 ? parishes : sectors;

  // Actions
  async function handleAdd() {
    if (!newItem.trim()) return;
    setSaving(true);
    try {
      const payload: any = { ...selection };
      if (level === 0) payload.estado = newItem;
      else if (level === 1) payload.municipio = newItem;
      else if (level === 2) payload.parroquia = newItem;
      else payload.sector = newItem;

      // Validate uniqueness in current view
      if (currentItems.includes(newItem)) {
        throw new Error("Este item ya existe en esta ubicación.");
      }

      await addGeodata(payload);
      toast({ title: `✓ ${level === 0 ? "Estado" : level === 1 ? "Municipio" : level === 2 ? "Parroquia" : "Sector"} agregado` });
      setNewItem("");
      loadGeodata();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemValue: string) {
    if (!confirm(`¿Estás seguro de eliminar "${itemValue}"? Se eliminarán todas las entradas asociadas a este nivel.`)) return;
    
    try {
      const supabase = createClient();
      let query = supabase.from("geodata_config").delete();
      
      if (level === 0) query = query.eq("estado", itemValue);
      else if (level === 1) query = query.eq("estado", selection.estado).eq("municipio", itemValue);
      else if (level === 2) query = query.eq("estado", selection.estado).eq("municipio", selection.municipio).eq("parroquia", itemValue);
      else query = query.eq("estado", selection.estado).eq("municipio", selection.municipio).eq("parroquia", selection.parroquia).eq("sector", itemValue);

      const { error } = await query;
      if (error) throw error;

      toast({ title: "Eliminado con éxito" });
      loadGeodata();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const navigateTo = (item: string) => {
    if (level === 0) {
      setSelection({ ...selection, estado: item });
      setLevel(1);
    } else if (level === 1) {
      setSelection({ ...selection, municipio: item });
      setLevel(2);
    } else if (level === 2) {
      setSelection({ ...selection, parroquia: item });
      setLevel(3);
    }
    setNewItem("");
  };

  const getLevelName = (l: Level) => ["Estados", "Municipios", "Parroquias", "Sectores"][l];

  return (
    <PremiumPageLayout 
        title="Gestión de Localidades" 
        description="Explora y administra la jerarquía geográfica de ventas."
    >
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center gap-2 text-sm text-zinc-500 overflow-x-auto pb-2">
            <Link href="/admin">
                <Button variant="ghost" size="sm" className="gap-2 shrink-0">
                    <ArrowLeft size={14} /> Admin
                </Button>
            </Link>
            <ChevronRight size={14} className="shrink-0" />
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLevel(0)}
                className={level === 0 ? "text-zinc-900 font-bold dark:text-zinc-100" : ""}
            >
                Ventas
            </Button>
            {level >= 1 && (
                <>
                    <ChevronRight size={14} className="shrink-0" />
                    <Button variant="ghost" size="sm" onClick={() => setLevel(1)} className={level === 1 ? "text-zinc-900 font-bold dark:text-zinc-100" : ""}>
                        {selection.estado}
                    </Button>
                </>
            )}
            {level >= 2 && (
                <>
                    <ChevronRight size={14} className="shrink-0" />
                    <Button variant="ghost" size="sm" onClick={() => setLevel(2)} className={level === 2 ? "text-zinc-900 font-bold dark:text-zinc-100" : ""}>
                        {selection.municipio}
                    </Button>
                </>
            )}
            {level >= 3 && (
                <>
                    <ChevronRight size={14} className="shrink-0" />
                    <Button variant="ghost" size="sm" className="font-bold text-zinc-900 dark:text-zinc-100">
                        {selection.parroquia}
                    </Button>
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Creation */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-50 dark:bg-zinc-900/50 border-dashed">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Añadir en {selection.parroquia || selection.municipio || selection.estado || "Ventas"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-zinc-400">Nuevo {getLevelName(level).slice(0, -1)}</Label>
                        <Input 
                            placeholder={`Nombre del ${getLevelName(level).slice(0, -1)}...`} 
                            value={newItem} 
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <Button onClick={handleAdd} disabled={saving || !newItem.trim()} className="w-full gap-2 rounded-xl h-11">
                        {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus size={18} />}
                        Guardar
                    </Button>
                </CardContent>
            </Card>

            <div className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hidden lg:block">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                    <LayoutGrid size={18} />
                    <span className="text-xs font-medium">Instrucciones</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Navega haciendo click en las tarjetas. Puedes añadir sub-niveles dentro de cada categoría seleccionada. La eliminación es permanente.
                </p>
            </div>
        </div>

        {/* Browser Grid */}
        <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {getLevelName(level)} <span className="text-zinc-400 font-normal text-sm">({currentItems.length})</span>
                </h3>
            </div>

            {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
                    <Loader2 className="animate-spin h-8 w-8 text-zinc-700" />
                    <span className="text-sm">Cargando jerarquía...</span>
                </div>
            ) : currentItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-800 p-8 text-center">
                    <MapPin className="h-10 w-10 text-zinc-200 dark:text-zinc-800 mb-3" />
                    <p className="text-sm text-zinc-500">No hay {getLevelName(level).toLowerCase()} registrados aquí.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {currentItems.map((item) => (
                        <div 
                            key={item}
                            className="group relative flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer overflow-hidden"
                            onClick={() => level < 3 && navigateTo(item)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                                    {level === 3 ? <MapPin size={16} /> : <Home size={16} />}
                                </div>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">
                                    {item}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item);
                                    }}
                                >
                                    <Trash2 size={14} />
                                </Button>
                                {level < 3 && <ChevronRight size={14} className="text-zinc-400 mr-1" />}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </PremiumPageLayout>
  );
}
