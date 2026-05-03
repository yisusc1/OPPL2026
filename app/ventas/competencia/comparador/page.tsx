"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Info, Wifi, Tv, ArrowUpDown, ChevronDown } from "lucide-react";
import { PremiumPageLayout } from "@/components/ui/premium-page-layout";
import { getSnapshotOperador, getOperadores } from "@/app/actions/competencia";
import { Button } from "@/components/ui/button";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";

// Componente para evitar el error de sync de searchParams en Next.js 15+
export default function ComparadorPage({ searchParams }: { searchParams: Promise<{ ops?: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [operadoresInfo, setOperadoresInfo] = useState<any[]>([]);
  const [comparativeData, setComparativeData] = useState<any[]>([]);
  
  // Unwrap searchParams (Next 15 pattern)
  const resolvedParams = use(searchParams);
  const opsParam = resolvedParams.ops;

  useEffect(() => {
    async function loadData() {
      if (!opsParam) {
        setError("No se seleccionaron operadoras para comparar.");
        setLoading(false);
        return;
      }

      const opIds = opsParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      
      if (opIds.length < 2) {
        setError("Se requieren al menos 2 operadoras para comparar.");
        setLoading(false);
        return;
      }

      try {
        const allOps = await getOperadores();
        const selectedOpsInfo = allOps.filter(o => opIds.includes(o.id));
        setOperadoresInfo(selectedOpsInfo);

        const dataPromises = opIds.map(id => getSnapshotOperador(id));
        const snapshots = await Promise.all(dataPromises);

        const combinedData = opIds.map((id, idx) => {
          const info = selectedOpsInfo.find(o => o.id === id);
          return {
            operador_id: id,
            info,
            snapshot: snapshots[idx]
          };
        }).filter(d => d.snapshot !== null); // Filter out operators with no data

        setComparativeData(combinedData);
      } catch (err: any) {
        console.error(err);
        setError("Error al cargar los datos comparativos.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [opsParam]);

  if (loading) {
    return (
      <PremiumPageLayout title="Analizando Operadoras" description="Procesando datos del mercado...">
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
          <p className="text-zinc-500 font-medium animate-pulse">Cruzando información de las operadoras seleccionadas...</p>
        </div>
      </PremiumPageLayout>
    );
  }

  if (error || comparativeData.length === 0) {
    return (
      <PremiumPageLayout title="Comparador" description="Error de análisis">
        <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-6 rounded-2xl border border-red-200 dark:border-red-900/50 text-center mt-10">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-bold text-lg mb-1">No se pudo realizar la comparación</h3>
          <p>{error || "No hay suficientes datos registrados para las operadoras seleccionadas."}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/ventas/competencia')}>Volver</Button>
        </div>
      </PremiumPageLayout>
    );
  }

  // Preparar datos para Scatter Chart (Planes Base y Promociones)
  const scatterData: any[] = [];
  comparativeData.forEach(opData => {
    const color = opData.info.color_hex || "#6b7280";
    
    // Add planes
    opData.snapshot.planes_estandar?.forEach((plan: any) => {
      scatterData.push({
        operadora: opData.info.nombre,
        color: color,
        velocidad: parseFloat(plan.velocidad),
        precio: parseFloat(plan.precio),
        tipo: "Estándar",
        nombrePlan: plan.nombre_plan || `${plan.velocidad} Mbps`
      });
    });

    // Add promos
    opData.snapshot.promociones?.forEach((promo: any) => {
      scatterData.push({
        operadora: opData.info.nombre,
        color: color,
        velocidad: parseFloat(promo.velocidad),
        precio: parseFloat(promo.precio_promo),
        tipo: "Promoción",
        nombrePlan: promo.nombre_plan || `Promo ${promo.velocidad} Mbps`
      });
    });
  });

  // Preparar datos para Bar Chart (Costos de Instalación)
  const instalacionData = comparativeData.map(opData => ({
    name: opData.info.nombre,
    costo: opData.snapshot.instalacion?.costo_base ? parseFloat(opData.snapshot.instalacion.costo_base) : 0,
    fill: opData.info.color_hex || "#6b7280"
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xl">
          <p className="font-bold text-sm mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }}></span>
            {data.operadora}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs mb-2">{data.nombrePlan} ({data.tipo})</p>
          <div className="flex gap-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <span>{data.velocidad} Mbps</span>
            <span>${data.precio}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <PremiumPageLayout 
      title="Comparador de Mercado" 
      description={`Comparando ${comparativeData.length} operadoras en tiempo real.`}
    >
      <div className="mb-6 flex">
        <Button variant="ghost" className="gap-2 text-zinc-500 hover:text-zinc-900 -ml-4" onClick={() => router.back()}>
          <ArrowLeft size={16} /> Volver al panel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        
        {/* Gráfico 1: Dispersión Velocidad vs Precio */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Velocidad vs Precio</h3>
            <p className="text-sm text-zinc-500">Relación costo-beneficio de los planes (Eje X: Velocidad, Eje Y: Precio).</p>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis 
                  type="number" 
                  dataKey="velocidad" 
                  name="Velocidad" 
                  unit=" Mbps" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  type="number" 
                  dataKey="precio" 
                  name="Precio" 
                  unit="$" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} content={<CustomTooltip />} />
                {comparativeData.map((op, idx) => {
                  const opPoints = scatterData.filter(d => d.operadora === op.info.nombre);
                  return (
                    <Scatter 
                      key={idx} 
                      name={op.info.nombre} 
                      data={opPoints} 
                      fill={op.info.color_hex || "#6b7280"}
                      shape="circle"
                      line={opPoints.length > 1 ? { strokeWidth: 2, opacity: 0.3 } : false}
                    />
                  );
                })}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Instalación */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Costos de Instalación</h3>
            <p className="text-sm text-zinc-500">Comparativa del costo base de instalación (sin metraje extra).</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instalacionData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis unit="$" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="costo" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Matriz Comparativa */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Matriz de Prestaciones</h3>
            <p className="text-sm text-zinc-500">Resumen de atributos tecnológicos y servicios adicionales.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Operadora</th>
                  <th className="px-6 py-4">Tecnología Principal</th>
                  <th className="px-6 py-4">Simetría</th>
                  <th className="px-6 py-4">Servicio de TV (IPTV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {comparativeData.map((opData, idx) => {
                  // Determinar prestaciones basadas en el snapshot general
                  const plans = [...(opData.snapshot.planes_estandar || []), ...(opData.snapshot.promociones || [])];
                  
                  // Hay tecnología de fibra si algun plan la tiene
                  const techs = Array.from(new Set(plans.map(p => p.tecnologia).filter(Boolean)));
                  const techString = techs.length > 0 ? techs.join(", ") : "Desconocida";
                  
                  // Simetria
                  const hasSymmetric = plans.some(p => p.es_simetrico);
                  
                  // IPTV
                  const hasIptv = plans.some(p => p.incluye_iptv);

                  return (
                    <tr key={idx} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                          {opData.info.logo_url ? (
                            <img src={opData.info.logo_url} alt="logo" className="w-6 h-6 object-contain" />
                          ) : (
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: opData.info.color_hex }} />
                          )}
                        </div>
                        {opData.info.nombre}
                      </td>
                      <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                        {techString}
                      </td>
                      <td className="px-6 py-4">
                        {hasSymmetric ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 font-medium">
                            <ArrowUpDown size={14} /> Simétrico
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {hasIptv ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 font-medium">
                            <Tv size={14} /> Disponible
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </PremiumPageLayout>
  );
}
