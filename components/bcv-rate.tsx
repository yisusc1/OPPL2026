"use client";

import { useEffect, useState } from "react";
import { DollarSign, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExchangeRate {
    moneda: string;
    fuente: string;
    nombre: string;
    valor: number;
    fechaActualizacion: string;
}

export function BCVRate() {
    const [rate, setRate] = useState<ExchangeRate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchRate = async () => {
        try {
            setLoading(true);
            setError(false);
            const res = await fetch("https://ve.dolarapi.com/v1/dolares/bcv");
            if (!res.ok) throw new Error("Failed to fetch BCV rate");
            const data: ExchangeRate = await res.json();
            setRate(data);
        } catch (err) {
            console.error("Error fetching BCV rate:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRate();
        // Optional: refresh every 1 hour (3600000 ms)
        const interval = setInterval(fetchRate, 3600000);
        return () => clearInterval(interval);
    }, []);

    if (error) return null; // Don't show anything if it fails, to keep UI clean

    return (
        <div className="flex items-center gap-3 bg-background/60 backdrop-blur-md border border-border shadow-sm rounded-full px-4 py-1.5 w-fit">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
            </div>

            <div className="flex flex-col">
                <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold text-foreground">Tasa BCV:</span>
                    {loading ? (
                        <div className="w-12 h-4 bg-muted animate-pulse rounded"></div>
                    ) : (
                        <span className="font-bold text-emerald-500 tracking-tight">Bs. {rate?.valor.toFixed(2)}</span>
                    )}
                </div>
                {rate && !loading && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground -mt-0.5 font-medium">
                        <Clock className="w-3 h-3" />
                        Actualizado: {new Date(rate.fechaActualizacion).toLocaleDateString("es-VE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                        }).replace(",", " -")}
                    </div>
                )}
            </div>
        </div>
    );
}
