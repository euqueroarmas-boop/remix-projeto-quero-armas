import { useState, useEffect } from "react";
import { adminQuerySingle } from "@/lib/adminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";

interface RiskItem {
  key: string;
  count: number;
  type: string;
}

export default function AdminRiskMonitor() {
  const [failedIPs, setFailedIPs] = useState<RiskItem[]>([]);
  const [failedUsers, setFailedUsers] = useState<RiskItem[]>([]);
  const [invalidTokens, setInvalidTokens] = useState(0);
  const [deniedAccess, setDeniedAccess] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const [failedRes, tokenRes, deniedRes] = await Promise.all([
        adminQuerySingle({
          table: "security_events",
          select: "ip_address, user_id, event_type",
          filters: [
            { column: "event_type", op: "eq", value: "login_failed" },
            { column: "created_at", op: "gte", value: since },
          ],
        }),
        adminQuerySingle({
          table: "security_events",
          select: "id",
          count: true,
          limit: 0,
          filters: [
            { column: "event_type", op: "eq", value: "invalid_token" },
            { column: "created_at", op: "gte", value: since },
          ],
        }),
        adminQuerySingle({
          table: "security_events",
          select: "id",
          count: true,
          limit: 0,
          filters: [
            { column: "event_type", op: "eq", value: "unauthorized_access" },
            { column: "created_at", op: "gte", value: since },
          ],
        }),
      ]);

      const ipMap: Record<string, number> = {};
      const userMap: Record<string, number> = {};
      ((failedRes.data as any[]) || []).forEach((e: any) => {
        if (e.ip_address) ipMap[e.ip_address] = (ipMap[e.ip_address] || 0) + 1;
        if (e.user_id) userMap[e.user_id] = (userMap[e.user_id] || 0) + 1;
      });

      setFailedIPs(Object.entries(ipMap).map(([key, count]) => ({ key, count, type: "IP" })).sort((a, b) => b.count - a.count).slice(0, 10));
      setFailedUsers(Object.entries(userMap).map(([key, count]) => ({ key, count, type: "User" })).sort((a, b) => b.count - a.count).slice(0, 10));
      setInvalidTokens(tokenRes.count || 0);
      setDeniedAccess(deniedRes.count || 0);
    } catch (err) {
      console.error("Risk monitor fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const cards = [
    { title: "Logins Falhos (24h)", value: failedIPs.reduce((s, i) => s + i.count, 0), color: "text-yellow-400" },
    { title: "Tokens Inválidos (24h)", value: invalidTokens, color: "text-orange-400" },
    { title: "Acessos Negados (24h)", value: deniedAccess, color: "text-red-400" },
    { title: "IPs Suspeitos", value: failedIPs.filter((i) => i.count >= 5).length, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-primary" />
          <h2 className="font-heading font-bold text-lg">Monitor de Risco</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Card key={c.title}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{c.title}</p>
                  <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {failedIPs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">IPs com mais tentativas falhadas (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {failedIPs.map((ip) => (
                    <div key={ip.key} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm font-mono text-foreground">{ip.key}</span>
                      <span className={`text-sm font-bold ${ip.count >= 5 ? "text-red-400" : ip.count >= 3 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {ip.count} tentativa{ip.count > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {failedUsers.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Usuários com mais falhas (24h)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {failedUsers.map((u) => (
                    <div key={u.key} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="text-sm font-mono text-foreground truncate max-w-[200px]">{u.key}</span>
                      <span className={`text-sm font-bold ${u.count >= 5 ? "text-red-400" : "text-yellow-400"}`}>
                        {u.count} falha{u.count > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {failedIPs.length === 0 && failedUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <Shield size={40} className="text-emerald-400 opacity-50" />
              <p className="text-sm">Nenhuma atividade de risco detectada nas últimas 24 horas</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
