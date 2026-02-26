"use client";

import { BackgroundPaths } from "@/components/ui/background-paths";
import { ModeToggle } from "@/components/mode-toggle";

interface PremiumPageLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
    showBack?: boolean;
}

export function PremiumPageLayout({
    children,
    title,
    description
}: PremiumPageLayoutProps) {
    return (
        <div className="relative min-h-screen w-full overflow-y-auto bg-background selection:bg-primary/20">
            <div className="fixed top-4 right-4 z-50">
                <ModeToggle />
            </div>

            <div className="relative z-40 mx-auto max-w-7xl px-4 py-8 md:py-12 lg:py-16">
                {(title || description) && (
                    <div className="mb-8 md:mb-12">
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
