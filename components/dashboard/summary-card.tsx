import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import { LucideIcon } from "lucide-react";

interface SummaryItem {
    name: string;
    value: number;
}

interface SummaryCardProps {
    title: string;
    data: SummaryItem[];
    className?: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
}

export function SummaryCard({ title, data, className, action, icon: Icon }: SummaryCardProps) {
    return (
        <div className={cn("relative h-full rounded-[1.25rem] border-[0.75px] border-border p-1", className)}>
            <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
            />
            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-[0.75px] bg-background/80 backdrop-blur-md shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] hover:bg-background/90 transition-colors">

                {/* Header */}
                <div className="px-4 py-3 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                        <h3 className="text-[11px] font-bold font-sans tracking-tight text-foreground uppercase">{title}</h3>
                    </div>
                    {action}
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/50">
                    {data.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                            Sin datos
                        </div>
                    ) : (
                        data.map((item, idx) => (
                            <div key={idx} className="group flex justify-between items-center py-2 px-1 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[75%] uppercase tracking-wide" title={item.name}>
                                    {item.name}
                                </span>
                                <span className="text-[11px] font-bold text-foreground font-sans tracking-tight">
                                    {item.value}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
