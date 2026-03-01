"use client";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { useRouter } from "next/navigation";

interface PremiumPageLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
    showBack?: boolean;
}

export function PremiumPageLayout({
    children,
    title,
    description,
    showBack = true,
}: PremiumPageLayoutProps) {
    const router = useRouter();

    return (
        <div className="relative min-h-screen w-full overflow-y-auto bg-background selection:bg-primary/20">
            {/* Floating top navigation bar */}
            <div className="fixed top-4 left-0 right-0 z-50 flex items-center justify-between px-4 pointer-events-none">
                {/* Left: Back / Home buttons */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {showBack && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => router.back()}
                            className="rounded-full bg-background/60 backdrop-blur-md border-[0.75px] border-border shadow-sm hover:bg-background/90 transition-colors"
                            aria-label="Volver"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push("/")}
                        className="rounded-full bg-background/60 backdrop-blur-md border-[0.75px] border-border shadow-sm hover:bg-background/90 transition-colors"
                        aria-label="Inicio"
                    >
                        <Home className="h-4 w-4" />
                    </Button>
                </div>

                {/* Right: Theme toggle */}
                <div className="pointer-events-auto">
                    <ModeToggle />
                </div>
            </div>

            <div className="relative z-40 mx-auto max-w-7xl px-4 py-8 md:py-12 lg:py-16">
                {(title || description) && (
                    <div className="mb-8 md:mb-12 pt-10">
                        {title && (
                            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p className="mt-4 text-muted-foreground md:text-lg">
                                {description}
                            </p>
                        )}
                    </div>
                )}

                {children}
            </div>

            <div className="fixed inset-0 z-0 pointer-events-none">
                <BackgroundPaths />
            </div>
        </div>
    );
}
