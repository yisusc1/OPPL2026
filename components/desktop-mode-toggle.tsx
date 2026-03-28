"use client"

import { Monitor, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function DesktopModeToggle() {
    const [isDesktopMode, setIsDesktopMode] = useState(false)

    const toggleMode = () => {
        const meta = document.querySelector("meta[name=viewport]")
        if (!meta) return

        if (!isDesktopMode) {
            // Switch to DESKTOP (Force 1024px width)
            meta.setAttribute("content", "width=1024, initial-scale=0.5") // Scale down to fit? Or just width.
            // Usually width=1024 is enough, browser scales it.
            // Let's try width=1280 for wider grid.
            meta.setAttribute("content", "width=1280")
            setIsDesktopMode(true)
            toast.success("Vista de PC activada")
        } else {
            // Revert to MOBILE (Responsive)
            meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1")
            setIsDesktopMode(false)
            toast.success("Vista Móvil activada")
        }
    }

    // Optional: Auto-detect if user previously set it?
    // skipping for simplicity.

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleMode}
            className="rounded-full text-slate-400 hover:text-slate-900 transition-colors flex"
        >
            {isDesktopMode ? <Smartphone size={20} /> : <Monitor size={20} />}
        </Button>
    )
}

// Update: "hidden md:flex" -> Hidden on Mobile? No.
// We want it visible on Mobile (to switch to PC).
// So default "flex", "md:hidden" (Hidden on PC).
// Correct class: "flex md:hidden"
