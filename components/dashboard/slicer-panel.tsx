"use client";

import { Check, ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface FilterDropdownProps {
    title: string;
    items: string[];
    selectedItems: string[];
    onChange: (item: string) => void;
}

function FilterDropdown({ title, items, selectedItems, onChange }: FilterDropdownProps) {
    const count = selectedItems.length;
    const isActive = count > 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={isActive ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                        "h-7 rounded-full px-3 text-xs border-dashed transition-all",
                        isActive
                            ? "bg-primary/10 border-primary/50 text-foreground font-semibold"
                            : "bg-background/50 border-border md:hover:bg-muted/50 text-muted-foreground"
                    )}
                >
                    {title}
                    {count > 0 && (
                        <span className="ml-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground font-bold">
                            {count}
                        </span>
                    )}
                    <ChevronDown className={cn("ml-1 h-3 w-3 opacity-50 transition-transform", isActive && "opacity-100")} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px] bg-popover/95 backdrop-blur-md">
                <DropdownMenuLabel className="text-xs font-bold uppercase text-muted-foreground">{title}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {items.map((item) => (
                        <DropdownMenuCheckboxItem
                            key={item}
                            checked={selectedItems.includes(item)}
                            onCheckedChange={() => onChange(item)}
                            className="text-xs cursor-pointer focus:bg-accent focus:text-accent-foreground"
                        >
                            {item}
                        </DropdownMenuCheckboxItem>
                    ))}
                </div>
                {isActive && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs h-6 justify-center text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                    e.preventDefault();
                                    selectedItems.forEach(i => onChange(i)); // Deselect all
                                }}
                            >
                                Limpiar filtros
                            </Button>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface FilterState {
    advisors: string[];
    zones: string[];
    statuses: string[];
    months: string[];
    sectors: string[];
    technicians: string[];
}

interface SlicerPanelProps {
    advisors: string[];
    zones: string[];
    sectors: string[];
    statuses?: string[];
    months?: string[];
    technicians?: string[];
    currentFilters: FilterState;
    onFilterChange: (type: keyof FilterState, value: string) => void;
}

export function SlicerPanel({ advisors, zones, sectors, statuses = [], months = [], technicians = [], currentFilters, onFilterChange }: SlicerPanelProps) {

    const handleToggle = (type: keyof FilterState, item: string) => {
        onFilterChange(type, item);
    };

    // Helper to clear all filters
    const clearAll = () => {
        // This functionality needs parent support effectively, but UI-wise we can hide it or implement individual clears
    };

    const hasActiveFilters = Object.values(currentFilters).some(arr => arr.length > 0);

    return (
        <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {/* Label - minimal or removed based on preference. Let's keep a tiny muted icon */}
            <div className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-muted/50 border border-border/50 shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            <FilterDropdown
                title="Mes"
                items={months.length > 0 ? months : ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]}
                selectedItems={currentFilters.months}
                onChange={(item) => handleToggle('months', item)}
            />

            <FilterDropdown
                title="Estatus"
                items={statuses.length > 0 ? statuses : ["Activo", "Pendiente", "Cancelado"]}
                selectedItems={currentFilters.statuses}
                onChange={(item) => handleToggle('statuses', item)}
            />

            <FilterDropdown
                title="Asesor"
                items={advisors}
                selectedItems={currentFilters.advisors}
                onChange={(item) => handleToggle('advisors', item)}
            />

            <FilterDropdown
                title="Técnico"
                items={technicians}
                selectedItems={currentFilters.technicians}
                onChange={(item) => handleToggle('technicians', item)}
            />

            <FilterDropdown
                title="Zona"
                items={zones}
                selectedItems={currentFilters.zones}
                onChange={(item) => handleToggle('zones', item)}
            />

            <FilterDropdown
                title="Sector"
                items={sectors}
                selectedItems={currentFilters.sectors}
                onChange={(item) => handleToggle('sectors', item)}
            />

            {/* Placeholder for "Clear All" or active filter chips if we wanted to expand */}
            <div className="flex-1" />
        </div>
    );
}
