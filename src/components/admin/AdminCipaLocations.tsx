import { useState, useEffect, useCallback } from "react";
import { adminQuery } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { MapPin, Star, RefreshCw, ExternalLink, Loader2, Navigation } from "lucide-react";
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
  const [selected, setSelected] = useState<CipaLocation | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const results = await adminQuery([
        {
          table: "cipa_locations",
          select: "*",
          order: { column: "captured_at", ascending: false },
          limit: 200,
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

  const openMap = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const isUnavailable = (loc: CipaLocation) => loc.latitude === 0 && loc.longitude === 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Geolocalização CIPA"
        subtitle={`${locations.length} registros capturados`}
        icon={MapPin}
        actions={
          <Button size="sm" variant="outline" onClick={fetchLocations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {/* Priority cards */}
      {priorities.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-500 flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-500" /> Localizações Prioritárias
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {priorities.map(loc => (
              <Card key={loc.id} className="bg-card border-border ring-1 ring-primary/40">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
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
                    <span className="text-[10px] text-muted-foreground">{fmt(loc.captured_at)}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openMap(loc.latitude, loc.longitude)}>
                      <ExternalLink className="w-3 h-3" /> Mapa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Selected detail */}
      {selected && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Detalhe do Registro
              <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => setSelected(null)}>Fechar</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Pessoa:</span> {selected.person_label}</div>
              <div><span className="text-muted-foreground">Dispositivo:</span> {selected.device_name}</div>
              <div><span className="text-muted-foreground">Latitude:</span> <span className="font-mono">{selected.latitude}</span></div>
              <div><span className="text-muted-foreground">Longitude:</span> <span className="font-mono">{selected.longitude}</span></div>
              <div><span className="text-muted-foreground">Precisão:</span> {selected.accuracy ? `±${Math.round(selected.accuracy)}m` : "N/A"}</div>
              <div><span className="text-muted-foreground">Captura:</span> {fmt(selected.captured_at)}</div>
            </div>
            {!isUnavailable(selected) && (
              <div className="pt-2">
                <iframe
                  title="Mapa"
                  className="w-full h-48 rounded border border-border"
                  src={`https://maps.google.com/maps?q=${selected.latitude},${selected.longitude}&z=15&output=embed`}
                  loading="lazy"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {loading && locations.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : locations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma localização registrada.</p>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Lat / Lng</TableHead>
                  <TableHead className="text-xs">Precisão</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map(loc => (
                  <TableRow key={loc.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(loc)}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{fmt(loc.captured_at)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        {loc.is_priority && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        {loc.person_label || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isUnavailable(loc) ? (
                        <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400">Capturado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {isUnavailable(loc) ? "—" : `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {loc.accuracy ? `±${Math.round(loc.accuracy)}m` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isUnavailable(loc) && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={(e) => { e.stopPropagation(); openMap(loc.latitude, loc.longitude); }}>
                          <ExternalLink className="w-3 h-3" /> Mapa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
