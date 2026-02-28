"use client";

import { useEffect, useState } from "react";
import { DollarSign, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { scrapeBCVRate, ExchangeRate, forceRevalidateRates } from "@/app/actions/bcv-scraper";
import { scrapeBinanceRate, BinanceRate } from "@/app/actions/binance-scraper";

export function BCVRate() {
    const [rate, setRate] = useState<ExchangeRate | null>(null);
    const [binanceRate, setBinanceRate] = useState<BinanceRate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadRates = async (force = false) => {
        try {
            setLoading(true);
            setError(false);

            if (!force) {
                const cached = localStorage.getItem("dashboard_exchange_rates");
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        // 86400000 = 24 hours
                        if (Date.now() - parsed.timestamp < 86400000) {
                            setRate(parsed.bcv);
                            setBinanceRate(parsed.binance);
                            setLoading(false);
                            return;
                        }
                    } catch (e) {
                        console.error("Failed to parse cached rates", e);
                    }
                }
            } else {
                // Manually dropping Next.js cache so the next calls actually hit the servers
                await forceRevalidateRates();
            }

            const [bcvData, binanceData] = await Promise.all([
                scrapeBCVRate(),
                scrapeBinanceRate()
            ]);

            if (!bcvData) throw new Error("Failed to fetch BCV rate");
            setRate(bcvData);

            if (binanceData) {
                setBinanceRate(binanceData);
            }

            localStorage.setItem("dashboard_exchange_rates", JSON.stringify({
                timestamp: Date.now(),
                bcv: bcvData,
                binance: binanceData
            }));
        } catch (err) {
            console.error("Error fetching rates:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRates();
    }, []);

    if (error) {
        return (
            <div className="flex items-center gap-3 bg-red-500/10 backdrop-blur-md border border-red-500/20 shadow-sm rounded-full px-4 py-1.5 w-fit">
                <span className="text-xs text-red-500 font-medium">Error al cargar tasa BCV</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            {/* BCV Rate */}
            <div
                onClick={() => loadRates(true)}
                className={cn(
                    "flex items-center gap-3 bg-background/60 backdrop-blur-md border border-border shadow-sm rounded-full px-4 py-1.5 w-fit",
                    "cursor-pointer hover:bg-muted/50 transition-colors group"
                )}
                title="Haz clic para actualizar"
            >
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

            {/* Binance Rate */}
            {binanceRate && !error && (
                <div
                    onClick={() => loadRates(true)}
                    className={cn(
                        "flex items-center gap-3 bg-background/60 backdrop-blur-md border border-border shadow-sm rounded-full px-4 py-1.5 w-fit",
                        "cursor-pointer hover:bg-muted/50 transition-colors group"
                    )}
                    title="Haz clic para actualizar"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500">
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2 text-sm">
                            <span className="font-semibold text-foreground">Binance P2P:</span>
                            {loading ? (
                                <div className="w-12 h-4 bg-muted animate-pulse rounded"></div>
                            ) : (
                                <span className="font-bold text-yellow-500 tracking-tight">Bs. {binanceRate?.price.toFixed(2)}</span>
                            )}
                        </div>
                        {binanceRate && !loading && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground -mt-0.5 font-medium">
                                <Clock className="w-3 h-3" />
                                Actualizado: Ahora
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
