"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface SortableCardProps {
    id: string;
    children: React.ReactNode;
    className?: string;
}

export function SortableCard({ id, children, className }: SortableCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto", // Ensure dragged item is on top
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "relative transition-shadow h-full",
                isDragging ? "opacity-50" : "", // Visual feedback for dragging
                className
            )}
        >
            {children}
        </div>
    );
}
