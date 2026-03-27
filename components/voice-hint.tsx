"use client"
import { cn } from "@/lib/utils"; // Assuming you have a utils for merging classes
import { useVoice } from "./voice-provider";

interface VoiceHintProps {
    children: React.ReactNode;
    command: string; // The command to display (e.g., "Taller")
    className?: string;
    side?: "top" | "bottom" | "left" | "right";
}

export function VoiceHint({ children, command, className, side = "top" }: VoiceHintProps) {
    const { isVoiceActive } = useVoice();

    return (
        <div className={cn("relative group", className)}>
            {children}

            {/* Hint Bubble - Visible only when voice is active */}
            <div className={cn(
                "absolute pointer-events-none z-50 whitespace-nowrap bg-black/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 shadow-xl transition-all duration-500 ease-out flex items-center gap-1",
                isVoiceActive
                    ? "opacity-100 scale-100 translate-y-0"
                    : "opacity-0 scale-90 translate-y-2",

                // Positioning
                side === "top" && "-top-3 left-1/2 -translate-x-1/2",
                side === "bottom" && "-bottom-3 left-1/2 -translate-x-1/2",
                side === "left" && "top-1/2 -translate-y-1/2 -left-2 -translate-x-full",
                side === "right" && "top-1/2 -translate-y-1/2 -right-2 translate-x-full"
            )}>
                <span className="text-green-400 text-xs">●</span>
                "{command}"
            </div>
        </div>
    );
}
