"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    subValue?: string;
    className?: string;
}

export function KPICard({ label, value, icon: Icon, subValue, className }: KPICardProps) {
    return (
        <div className={cn(
            "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/50 bg-background/50 p-3 md:p-4 min-h-[90px] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 backdrop-blur-sm",
            className
        )}>
            {/* Top Row: Label & Icon */}
            <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
                {Icon && (
                    <div className="text-muted-foreground/40 transition-colors group-hover:text-yellow-500">
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>

            {/* Bottom: Value */}
            <div className="flex flex-col z-10 w-full">
                <span
                    className={cn(
                        "font-extrabold text-foreground tracking-tight leading-none transition-all",
                        String(value).length > 20 ? "text-base md:text-xl whitespace-normal break-words" :
                            String(value).length > 12 ? "text-lg md:text-2xl whitespace-normal break-words" :
                                "text-3xl md:text-3xl"
                    )}
                    title={String(value)}
                >
                    {value}
                </span>
                {subValue && (
                    <span className="text-[10px] font-medium text-muted-foreground mt-1 truncate">{subValue}</span>
                )}
            </div>

            {/* Subtle Gradient Glow on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-yellow-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
        </div>
    );
}
