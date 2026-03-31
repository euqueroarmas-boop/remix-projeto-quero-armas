import { useState, useEffect, useCallback } from "react";
import { adminQuery } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/admin/ui/AdminPrimitives";

interface CipaLocation {
  id: string;
  person_label: string;
  device_name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
  created_at: string;
  is_priority: boolean;
  priority_order: number;
}

export default function AdminCipaLocations() {
  const [locations, setLocations] = useState<CipaLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        {
          table: "cipa_locations",
          select: "*",
          order: { column: "captured_at", ascending: false },
          limit: 100,
        },
      ]);
      const data = (results[0]?.data as CipaLocation[]) || [];
      setLocations(data);
    } catch (e) {
      console.error("Failed to fetch cipa_locations", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const priorities = locations.filter(l => l.is_priority).sort((a, b) => a.priority_order - b.priority_order);
  const others = locations.filter(l => !l.is_priority);

  const openMap = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const LocationCard = ({ loc, isPriority }: { loc: CipaLocation; isPriority?: boolean }) => (
    <Card className={`bg-card border-border ${isPriority ? "ring-1 ring-primary/40" : ""}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPriority && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
            <span className="font-semibold text-sm">{loc.person_label || "Sem nome"}</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {loc.accuracy ? `±${Math.round(loc.accuracy)}m` : "—"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
        </p>
        <p className="text-xs text-muted-foreground">{loc.device_name}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">{formatTime(loc.captured_at)}</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openMap(loc.latitude, loc.longitude)}>
            <ExternalLink className="w-3 h-3" /> Mapa
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Geolocalização CIPA"
        subtitle={`${locations.length} registros capturados`}
        icon={MapPin}
        action={
          <Button size="sm" variant="outline" onClick={fetchLocations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {loading && locations.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : (
        <>
          {/* Priority block */}
          {priorities.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-500 flex items-center gap-2">
                <Star className="w-4 h-4 fill-amber-500" /> Localizações Prioritárias
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {priorities.map(loc => (
                  <LocationCard key={loc.id} loc={loc} isPriority />
                ))}
              </div>
            </div>
          )}

          {/* All locations */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
            {others.length === 0 && priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma localização registrada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {others.map(loc => (
                  <LocationCard key={loc.id} loc={loc} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
