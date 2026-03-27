"use client";

import Link from "next/link";
import { ArrowLeft, Layers, Loader2, MapPin, Search, Navigation, MousePointerClick, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, MapPopup, useMap } from "@/components/ui/map";
import { useEffect, useState, useRef, useMemo } from "react";
import { fetchNetworkNodes, type NetworkNode } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const mapStyles = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
};

const NODE_COLORS = {
    manga96_empalme: "#fbbf24", // amber-400
    manga48_nap: "#facc15",     // yellow-400
    default: "#a3a3a3"          // neutral-400
};

// Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function MapAutoFitter({ nodes }: { nodes: NetworkNode[] }) {
    const { map, isLoaded } = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (!isLoaded || !map || nodes.length === 0 || hasFitted.current) return;

        const lats = nodes.map(n => n.latitud);
        const lngs = nodes.map(n => n.longitud);
        const validLats = lats.filter(l => l !== 0);
        const validLngs = lngs.filter(l => l !== 0);

        if (validLats.length === 0 || validLngs.length === 0) return;

        const minLat = Math.min(...validLats);
        const maxLat = Math.max(...validLats);
        const minLng = Math.min(...validLngs);
        const maxLng = Math.max(...validLngs);

        if (minLat === maxLat && minLng === maxLng) {
            map.flyTo({ center: [minLng, minLat], zoom: 15 });
            hasFitted.current = true;
            return;
        }

        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 100, duration: 1000 });
        hasFitted.current = true;
    }, [isLoaded, map, nodes]);

    return null;
}

function NetworkNodesLayer({ nodes, onNodeClick }: { nodes: NetworkNode[], onNodeClick: (node: NetworkNode) => void }) {
    const { map, isLoaded } = useMap();
    const sourceId = "network-nodes-source";
    const layerId = "network-nodes-layer";

    const geojson = useMemo(() => ({
        type: "FeatureCollection" as const,
        features: nodes.map(node => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [node.longitud, node.latitud] },
            properties: {
                id: node.id,
                nombre: node.nombre,
                tipo: node.tipo,
                colorCategory: (node.tipo?.toLowerCase() || "").match(/manga 96|empalme/)
                    ? "orange" : (node.tipo?.toLowerCase() || "").match(/manga 48|nap/)
                        ? "cyan" : "default"
            }
        }))
    }), [nodes]);

    useEffect(() => {
        if (!isLoaded || !map) return;

        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: "geojson", data: geojson });
        } else {
            (map.getSource(sourceId) as any).setData(geojson);
        }

        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: "circle",
                source: sourceId,
                paint: {
                    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6, 18, 12],
                    "circle-color": ["match", ["get", "colorCategory"], "orange", NODE_COLORS.manga96_empalme, "cyan", NODE_COLORS.manga48_nap, NODE_COLORS.default],
                    "circle-stroke-width": 1,
                    "circle-stroke-color": "#ffffff",
                    "circle-opacity": 0.8
                }
            });

            map.on("click", layerId, (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    const { id, nombre, tipo } = feature.properties as any;
                    const [lng, lat] = (feature.geometry as any).coordinates;
                    onNodeClick({ id, nombre, tipo, longitud: lng, latitud: lat });
                }
            });

            map.on("mouseenter", layerId, () => map.getCanvas().style.cursor = "pointer");
            map.on("mouseleave", layerId, () => map.getCanvas().style.cursor = "");
        }
    }, [isLoaded, map, geojson, onNodeClick]);

    return null;
}

function CoverageLayer({ userLocation, targetNode, distance }: { userLocation: { lat: number, lng: number } | null, targetNode: NetworkNode | null, distance: number | null }) {
    const { map, isLoaded } = useMap();
    const sourceId = "coverage-source";
    const lineLayerId = "coverage-line";
    const userPointLayerId = "coverage-user-point";

    const isFeasible = distance !== null && distance <= 400;

    useEffect(() => {
        if (!isLoaded || !map || !userLocation) return;

        const geojson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
                    properties: { type: "user" }
                },
                ...(targetNode ? [{
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: [[userLocation.lng, userLocation.lat], [targetNode.longitud, targetNode.latitud]] },
                    properties: { type: "line" }
                }] : [])
            ]
        };

        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: "geojson", data: geojson as any });
        } else {
            (map.getSource(sourceId) as any).setData(geojson);
        }

        if (!map.getLayer(lineLayerId)) {
            map.addLayer({
                id: lineLayerId,
                type: "line",
                source: sourceId,
                filter: ["==", "type", "line"],
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                    "line-color": isFeasible ? "#22c55e" : "#ef4444",
                    "line-width": 4,
                    "line-dasharray": [2, 1]
                }
            });
        } else {
            map.setPaintProperty(lineLayerId, "line-color", isFeasible ? "#22c55e" : "#ef4444");
        }

        if (!map.getLayer(userPointLayerId)) {
            map.addLayer({
                id: userPointLayerId,
                type: "circle",
                source: sourceId,
                filter: ["==", "type", "user"],
                paint: {
                    "circle-radius": 8,
                    "circle-color": "#3b82f6",
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#ffffff"
                }
            });
        }
    }, [isLoaded, map, userLocation, targetNode, distance, isFeasible]);

    return null;
}

export default function MapPage() {
    const [nodes, setNodes] = useState<NetworkNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [loading, setLoading] = useState(true);

    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [coverageNode, setCoverageNode] = useState<NetworkNode | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [checkingCoverage, setCheckingCoverage] = useState(false);

    // Manual Search State
    const [searchMode, setSearchMode] = useState<"gps" | "manual">("gps");
    const [manualLat, setManualLat] = useState("");
    const [manualLng, setManualLng] = useState("");

    // UI State
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchNetworkNodes();
                setNodes(data);
            } catch (e) {
                console.error("Error loading nodes:", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const performFeasibilityCheck = (lat: number, lng: number) => {
        setUserLocation({ lat, lng });

        let minDist = Infinity;
        let nearest: NetworkNode | null = null;

        nodes.forEach(node => {
            const d = calculateDistance(lat, lng, node.latitud, node.longitud);
            if (d < minDist) {
                minDist = d;
                nearest = node;
            }
        });

        setDistance(minDist);
        setCoverageNode(nearest);
        setCheckingCoverage(false);
        if (nearest) setSelectedNode(nearest);
        // Optional: auto-collapse on mobile if needed, but not forcing it yet
    };

    const handleGpsSearch = () => {
        if (!navigator.geolocation) {
            alert("Geolocalización no soportada.");
            return;
        }
        setCheckingCoverage(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                performFeasibilityCheck(pos.coords.latitude, pos.coords.longitude);
                setManualLat(pos.coords.latitude.toFixed(6));
                setManualLng(pos.coords.longitude.toFixed(6));
            },
            (err) => {
                console.error("Error GPS", err);
                alert("Error obteniendo ubicación.");
                setCheckingCoverage(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const handleManualSearch = () => {
        const lat = parseFloat(manualLat);
        const lng = parseFloat(manualLng);
        if (isNaN(lat) || isNaN(lng)) {
            alert("Coordenadas inválidas");
            return;
        }
        setCheckingCoverage(true);
        setTimeout(() => performFeasibilityCheck(lat, lng), 500);
    };

    const getNodeColor = (type: string) => {
        const t = (type || "").toLowerCase();
        if (t.includes('manga 96') || t.includes('empalme')) return "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]";
        if (t.includes('manga 48') || t.includes('nap')) return "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]";
        return "bg-neutral-400";
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-background">
            {/* Header / Controls */}
            <div className="absolute top-4 left-4 right-4 md:right-auto md:w-auto z-10 flex flex-col gap-2 pointer-events-none transition-all duration-300">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <Link href="/">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border-border hover:bg-background/90 shadow-sm">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border border-border shadow-sm flex-1 md:flex-none justify-between md:justify-start">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold uppercase tracking-wider">Mapa de Red</span>
                        </div>
                        {loading && <Loader2 className="w-3 h-3 animate-spin ml-2 text-muted-foreground" />}
                        {!loading && <span className="text-xs text-muted-foreground ml-2">({nodes.length})</span>}
                    </div>
                </div>

                {/* Coverage Checker UI - Collapsible & Responsive */}
                <div className="bg-background/90 backdrop-blur-md rounded-2xl border border-border shadow-xl flex flex-col w-full md:w-[320px] pointer-events-auto overflow-hidden transition-all duration-300">
                    <div
                        className="flex items-center justify-between p-3 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Herramientas</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                    </div>

                    {!isCollapsed && (
                        <div className="p-3 pt-0 flex flex-col gap-3 animate-in slide-in-from-top-2 fade-in duration-200">
                            <Tabs defaultValue="gps" className="w-full" onValueChange={(v) => setSearchMode(v as any)}>
                                <TabsList className="grid w-full grid-cols-2 h-9">
                                    <TabsTrigger value="gps" className="text-xs"><Navigation className="w-3 h-3 mr-1.5" /> GPS</TabsTrigger>
                                    <TabsTrigger value="manual" className="text-xs"><MousePointerClick className="w-3 h-3 mr-1.5" /> Manual</TabsTrigger>
                                </TabsList>

                                <TabsContent value="gps" className="mt-3">
                                    <div className="text-xs text-muted-foreground mb-3 text-center px-2">
                                        Usa tu ubicación actual para verificar cobertura.
                                    </div>
                                    <Button
                                        onClick={handleGpsSearch}
                                        disabled={checkingCoverage || loading}
                                        className={cn("w-full h-10 gap-2 font-semibold shadow-sm transition-all",
                                            searchMode === 'gps' && distance !== null && distance <= 400 ? "bg-green-600 hover:bg-green-700 text-white" :
                                                searchMode === 'gps' && distance !== null ? "bg-red-600 hover:bg-red-700 text-white" : ""
                                        )}
                                    >
                                        {checkingCoverage ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                                        {checkingCoverage ? "Calculando..." : "Usar mi Ubicación"}
                                    </Button>
                                </TabsContent>

                                <TabsContent value="manual" className="mt-3 space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="lat" className="text-[10px] uppercase text-muted-foreground font-bold">Latitud</Label>
                                            <Input
                                                id="lat"
                                                placeholder="10.4..."
                                                className="h-9 text-xs font-mono"
                                                value={manualLat}
                                                onChange={(e) => setManualLat(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="lng" className="text-[10px] uppercase text-muted-foreground font-bold">Longitud</Label>
                                            <Input
                                                id="lng"
                                                placeholder="-66.9..."
                                                className="h-9 text-xs font-mono"
                                                value={manualLng}
                                                onChange={(e) => setManualLng(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleManualSearch}
                                        disabled={checkingCoverage || loading || !manualLat || !manualLng}
                                        className={cn("w-full h-10 gap-2 font-semibold shadow-sm transition-all",
                                            searchMode === 'manual' && distance !== null && distance <= 400 ? "bg-green-600 hover:bg-green-700 text-white" :
                                                searchMode === 'manual' && distance !== null ? "bg-red-600 hover:bg-red-700 text-white" : ""
                                        )}
                                    >
                                        <Search className="w-4 h-4" />
                                        Verificar Coordenadas
                                    </Button>
                                </TabsContent>
                            </Tabs>

                            {distance !== null && coverageNode && (
                                <div className="bg-popover/50 rounded-lg p-3 text-sm animate-in fade-in slide-in-from-top-2 border border-border/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-muted-foreground">Estado:</span>
                                        <span className={cn("font-bold px-2 py-0.5 rounded text-[10px] uppercase",
                                            distance <= 400 ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                        )}>
                                            {distance <= 400 ? "FACTIBLE" : "NO FACTIBLE"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-muted-foreground">Distancia:</span>
                                        <span className="font-mono font-medium">{Math.round(distance)}m</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Caja:</span>
                                        <span className="font-medium truncate max-w-[120px]" title={coverageNode.nombre}>{coverageNode.nombre}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Map
                center={[-66.905, 10.467]}
                zoom={14}
                styles={mapStyles}
                dragPan={true}
                scrollZoom={true}
                doubleClickZoom={true}
            >
                <MapAutoFitter nodes={nodes} />
                <NetworkNodesLayer nodes={nodes} onNodeClick={setSelectedNode} />
                <CoverageLayer userLocation={userLocation} targetNode={coverageNode} distance={distance} />

                {selectedNode && (
                    <MapPopup
                        longitude={selectedNode.longitud}
                        latitude={selectedNode.latitud}
                        onClose={() => setSelectedNode(null)}
                        className="p-0 border-none bg-transparent shadow-none"
                        closeButton={false}
                    >
                        <div className="bg-popover/90 backdrop-blur-xl border border-border rounded-xl p-4 shadow-2xl min-w-[200px]">
                            <h4 className="font-bold text-base mb-1 text-foreground">{selectedNode.nombre}</h4>
                            <div className="flex items-center gap-2 mb-3">
                                <div className={cn("w-2 h-2 rounded-full", getNodeColor(selectedNode.tipo).split(' ')[0])} />
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{selectedNode.tipo}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                                <div>
                                    <span className="block opacity-50 text-[10px] uppercase">Latitud</span>
                                    <span className="font-mono text-foreground">{selectedNode.latitud.toFixed(5)}</span>
                                </div>
                                <div>
                                    <span className="block opacity-50 text-[10px] uppercase">Longitud</span>
                                    <span className="font-mono text-foreground">{selectedNode.longitud.toFixed(5)}</span>
                                </div>
                            </div>
                        </div>
                    </MapPopup>
                )}
            </Map>
            <style jsx global>{`
                .maplibregl-popup-content {
                    background: transparent !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .maplibregl-popup-tip {
                    display: none !important;
                }
            `}</style>
        </div>
    );
}
