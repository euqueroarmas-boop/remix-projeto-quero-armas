import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  HeartPulse, Crosshair, Plus, Loader2, Calendar, CheckCircle2,
  AlertTriangle, XCircle, Clock, ShieldCheck, History, Trash2,
} from "lucide-react";
import { useQAAuthContext } from "@/contexts/QAAuthContext";

/* ============================================================
 * Tipos e helpers de status (centralizados)
 * ============================================================ */

export type ExameTipo = "psicologico" | "tiro";

export interface ExameRecord {
  id: string;
  cliente_id: number;
  tipo: ExameTipo;
  data_realizacao: string; // YYYY-MM-DD
  data_vencimento: string;
  observacoes: string | null;
  cadastrado_por: string | null;
  cadastrado_por_nome: string | null;
  created_at: string;
}

export interface ExameComStatus extends ExameRecord {
  dias_restantes: number;
  status: "vigente" | "a_vencer" | "vencido";
}

/** Cálculo único de status — fonte de verdade no front (espelha a view do banco). */
export function computeExameStatus(dataVencimento: string): {
  status: ExameComStatus["status"];
  dias_restantes: number;
} {
  const venc = new Date(dataVencimento + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return { status: "vencido", dias_restantes: dias };
  if (dias <= 45) return { status: "a_vencer", dias_restantes: dias };
  return { status: "vigente", dias_restantes: dias };
}

const TIPO_LABEL: Record<ExameTipo, string> = {
  psicologico: "Exame Psicológico",
  tiro: "Exame de Tiro",
};

const STATUS_BADGE: Record<ExameComStatus["status"], { cls: string; icon: any; label: string }> = {
  vigente: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "VIGENTE" },
  a_vencer: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "A VENCER" },
  vencido: { cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle, label: "VENCIDO" },
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ============================================================
 * Componente principal
 * ============================================================ */

interface Props {
  cliente: { id: number; nome_completo?: string | null };
}

export default function ClienteExames({ cliente }: Props) {
  const { user } = useQAAuthContext();
  const [exames, setExames] = useState<ExameComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ExameTipo | null>(null);

  const [novo, setNovo] = useState<Record<ExameTipo, { data: string; obs: string }>>({
    psicologico: { data: todayISO(), obs: "" },
    tiro: { data: todayISO(), obs: "" },
  });

  const load = useCallback(async () => {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_exames_cliente" as any)
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("data_realizacao", { ascending: false });
      if (error) throw error;
      const enriched: ExameComStatus[] = (data || []).map((e: any) => ({
        ...e,
        ...computeExameStatus(e.data_vencimento),
      }));
      setExames(enriched);
    } catch (err) {
      console.error("[ClienteExames] load:", err);
      toast.error("Falha ao carregar exames");
    } finally {
      setLoading(false);
    }
  }, [cliente?.id]);

  useEffect(() => { void load(); }, [load]);

  const salvar = async (tipo: ExameTipo) => {
    const { data, obs } = novo[tipo];
    if (!data) {
      toast.error("Informe a data de realização do exame");
      return;
    }
    setSaving(tipo);
    try {
      const venc = new Date(data + "T00:00:00");
      venc.setDate(venc.getDate() + 365);
      const payload = {
        cliente_id: cliente.id,
        tipo,
        data_realizacao: data,
        data_vencimento: venc.toISOString().slice(0, 10),
        observacoes: obs?.trim() || null,
        cadastrado_por: user?.id || null,
        cadastrado_por_nome: user?.email || null,
      };
      const { error } = await supabase.from("qa_exames_cliente" as any).insert(payload);
      if (error) throw error;
      toast.success(`${TIPO_LABEL[tipo]} registrado`);
      setNovo((p) => ({ ...p, [tipo]: { data: todayISO(), obs: "" } }));
      await load();
    } catch (err: any) {
      console.error("[ClienteExames] insert:", err);
      toast.error(err?.message || "Falha ao salvar exame");
    } finally {
      setSaving(null);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este lançamento do histórico?")) return;
    try {
      const { error } = await supabase.from("qa_exames_cliente" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Lançamento removido");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao remover");
    }
  };

  const examesPorTipo = (tipo: ExameTipo) =>
    exames.filter((e) => e.tipo === tipo);

  const vigenteMaisRecente = (tipo: ExameTipo): ExameComStatus | null => {
    const lista = examesPorTipo(tipo);
    return lista[0] || null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-lg shadow-sm">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Exames Médico-Periciais</h3>
            <p className="text-[11px] text-slate-500">Histórico imutável · Validade 365 dias · Alertas automáticos</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <ExameCard
            tipo="psicologico"
            icon={HeartPulse}
            color="violet"
            historico={examesPorTipo("psicologico")}
            vigente={vigenteMaisRecente("psicologico")}
            novo={novo.psicologico}
            setNovo={(v) => setNovo((p) => ({ ...p, psicologico: v }))}
            saving={saving === "psicologico"}
            onSalvar={() => salvar("psicologico")}
            onRemover={remover}
          />
          <ExameCard
            tipo="tiro"
            icon={Crosshair}
            color="orange"
            historico={examesPorTipo("tiro")}
            vigente={vigenteMaisRecente("tiro")}
            novo={novo.tiro}
            setNovo={(v) => setNovo((p) => ({ ...p, tiro: v }))}
            saving={saving === "tiro"}
            onSalvar={() => salvar("tiro")}
            onRemover={remover}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Card por tipo de exame
 * ============================================================ */

const COLOR_MAP = {
  violet: {
    headerBg: "from-violet-500 to-purple-600",
    accent: "text-violet-700",
    ring: "ring-violet-200",
  },
  orange: {
    headerBg: "from-orange-500 to-amber-600",
    accent: "text-orange-700",
    ring: "ring-orange-200",
  },
} as const;

interface CardProps {
  tipo: ExameTipo;
  icon: any;
  color: keyof typeof COLOR_MAP;
  historico: ExameComStatus[];
  vigente: ExameComStatus | null;
  novo: { data: string; obs: string };
  setNovo: (v: { data: string; obs: string }) => void;
  saving: boolean;
  onSalvar: () => void;
  onRemover: (id: string) => void;
}

function ExameCard({ tipo, icon: Icon, color, historico, vigente, novo, setNovo, saving, onSalvar, onRemover }: CardProps) {
  const c = COLOR_MAP[color];

  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`bg-gradient-to-r ${c.headerBg} px-4 py-3 flex items-center gap-2.5`}>
        <Icon className="h-4 w-4 text-white" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">{TIPO_LABEL[tipo]}</span>
        {vigente && (
          <Badge className={`ml-auto text-[9px] ${STATUS_BADGE[vigente.status].cls} border`}>
            {STATUS_BADGE[vigente.status].label}
          </Badge>
        )}
      </div>

      {/* Vigente em destaque */}
      {vigente && (
        <div className={`px-4 py-3 bg-slate-50 border-b border-slate-200`}>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Lançamento mais recente
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600">
                Realizado: <span className="font-bold text-slate-900">{fmtDate(vigente.data_realizacao)}</span>
              </div>
              <div className="text-xs text-slate-600">
                Vence em: <span className="font-bold text-slate-900">{fmtDate(vigente.data_vencimento)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black ${c.accent}`}>
                {vigente.dias_restantes < 0 ? Math.abs(vigente.dias_restantes) : vigente.dias_restantes}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">
                {vigente.dias_restantes < 0 ? "dias atrás" : "dias restantes"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form de novo lançamento */}
      <div className="p-4 space-y-3 border-b border-slate-200">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Registrar novo exame
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Data de realização
            </label>
            <Input
              type="date"
              value={novo.data}
              max={todayISO()}
              onChange={(e) => setNovo({ ...novo, data: e.target.value })}
              className="bg-white text-xs h-9 mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">
              Observações (opcional)
            </label>
            <Textarea
              value={novo.obs}
              onChange={(e) => setNovo({ ...novo, obs: e.target.value })}
              rows={2}
              placeholder="Ex.: clínica, profissional responsável, etc."
              className="bg-white text-xs mt-1 resize-none"
            />
          </div>
          <Button
            onClick={onSalvar}
            disabled={saving}
            className={`w-full bg-gradient-to-r ${c.headerBg} text-white hover:opacity-90 h-9 text-xs font-bold uppercase tracking-wider`}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            Lançar Exame
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div className="p-4">
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-2.5 flex items-center gap-1.5">
          <History className="h-3 w-3" /> Histórico ({historico.length})
        </div>
        {historico.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">Nenhum lançamento ainda</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {historico.map((e, idx) => {
              const sb = STATUS_BADGE[e.status];
              const SIcon = sb.icon;
              const isLatest = idx === 0;
              return (
                <div
                  key={e.id}
                  className={`border rounded-lg p-2.5 ${isLatest ? `border-slate-300 ring-1 ${c.ring} bg-slate-50` : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={`text-[8px] ${sb.cls} border`}>
                          <SIcon className="h-2.5 w-2.5 mr-0.5" /> {sb.label}
                        </Badge>
                        {isLatest && (
                          <Badge className="text-[8px] bg-blue-50 text-blue-700 border-blue-200 border">
                            ATUAL
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-700">
                        <Clock className="h-3 w-3 inline mr-1 text-slate-400" />
                        Realizado <span className="font-bold">{fmtDate(e.data_realizacao)}</span>
                        {" · "}vence <span className="font-bold">{fmtDate(e.data_vencimento)}</span>
                      </div>
                      {e.observacoes && (
                        <div className="mt-1 text-[10px] text-slate-500 italic line-clamp-2">{e.observacoes}</div>
                      )}
                      {e.cadastrado_por_nome && (
                        <div className="mt-1 text-[9px] text-slate-400 uppercase tracking-wider">
                          por {e.cadastrado_por_nome}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemover(e.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
