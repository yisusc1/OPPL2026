"use client";

import { useState } from "react";
import { Check, ChevronDown, Filter, X, Search } from "lucide-react";
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
    const [searchTerm, setSearchTerm] = useState("");
    const count = selectedItems.length;
    const isActive = count > 0;

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant={isActive ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                        "h-8 rounded-lg px-3 text-xs border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm font-medium",
                        isActive
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "bg-white dark:bg-zinc-900/50 md:hover:bg-zinc-100 dark:md:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    )}
                >
                    {title}
                    {count > 0 && (
                        <span className="ml-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px] text-white font-bold">
                            {count}
                        </span>
                    )}
                    <ChevronDown className={cn("ml-1.5 h-3.5 w-3.5 opacity-50 transition-transform", isActive && "opacity-100")} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl custom-scrollbar" onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        placeholder={`Buscar...`}
                        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>

                <div className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="p-3 text-xs text-center text-muted-foreground">No se encontraron resultados</div>
                    ) : (
                        filteredItems.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={item}
                                checked={selectedItems.includes(item)}
                                onCheckedChange={() => onChange(item)}
                                onSelect={(e) => e.preventDefault()}
                                className="text-xs cursor-pointer rounded-md focus:bg-zinc-100 dark:focus:bg-zinc-800/50 focus:text-foreground pl-8 py-2"
                            >
                                <span className="truncate">{item}</span>
                            </DropdownMenuCheckboxItem>
                        ))
                    )}
                </div>

                {isActive && (
                    <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 sticky bottom-0 z-10">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs h-7 justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-md"
                            onClick={(e) => {
                                e.preventDefault();
                                selectedItems.forEach(i => onChange(i)); // Deselect all
                                setSearchTerm("");
                            }}
                        >
                            <X className="w-3 h-3 mr-1" />
                            Limpiar seleccion
                        </Button>
                    </div>
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
                items={statuses.length > 0 ? statuses : ["Activo", "Pendiente", "Cancelado"].sort()}
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
