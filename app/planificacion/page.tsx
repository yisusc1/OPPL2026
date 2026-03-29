"use client";

import dynamic from 'next/dynamic';
import { Toaster } from 'sonner';

// Dynamic import to avoid SSR issues with drag-and-drop
const PlanificacionBoard = dynamic(
    () => import('@/components/planificacion/PlanificacionBoard').then(mod => ({ default: mod.PlanificacionBoard })),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground text-sm">Cargando panel de planificación...</p>
                </div>
            </div>
        ),
    }
);

export default function PlanificacionPage() {
    return (
        <>
            <PlanificacionBoard />
            <Toaster richColors position="bottom-right" />
        </>
    );
}
