"use client";

import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

interface PremiumCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function PremiumCard({ children, className, onClick }: PremiumCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "relative h-full rounded-[1.25rem] border-[0.75px] border-border p-1 transition-colors",
                onClick && "cursor-pointer",
                className
            )}
        >
            <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
            />
            <div className="relative flex h-full flex-col justify-between gap-4 overflow-hidden rounded-xl border-[0.75px] bg-background/80 backdrop-blur-md p-4 shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] md:p-5 hover:bg-background/90 transition-colors">
                {children}
            </div>
        </div>
    );
}
