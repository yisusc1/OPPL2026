import { cn } from "@/lib/utils"

interface EllielLogoProps {
    className?: string
    /** Size in px for the icon width (height auto-scales) */
    iconSize?: number
    /** Font size for the text in rem */
    textSize?: string
    /** Layout direction */
    layout?: "stacked" | "horizontal"
}

export function EllielLogo({
    className,
    iconSize = 56,
    textSize = "text-2xl",
    layout = "stacked",
}: EllielLogoProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-3",
                layout === "stacked" && "flex-col gap-2",
                className
            )}
        >
            {/* Icon: 3 stacked right-pointing chevrons */}
            <svg
                width={iconSize}
                height={iconSize * 0.75}
                viewBox="0 0 56 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-foreground"
            >
                {/* Top chevron – widest */}
                <polygon
                    points="0,0 40,0 56,7 40,14 0,14"
                    className="fill-current"
                />
                {/* Middle chevron */}
                <polygon
                    points="0,18 38,18 52,25 38,32 0,32"
                    className="fill-current"
                />
                {/* Bottom chevron – narrowest */}
                <polygon
                    points="0,36 32,36 44,42 32,42 0,42"
                    className="fill-current"
                />
            </svg>

            {/* Text: "Ellie" + yellow "|" */}
            <div className={cn("font-black tracking-tight leading-none", textSize)}>
                <span className="text-foreground">Ellie</span>
                <span className="text-yellow-400">|</span>
            </div>
        </div>
    )
}
