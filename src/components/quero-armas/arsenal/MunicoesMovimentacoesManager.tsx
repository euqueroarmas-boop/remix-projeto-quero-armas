import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Minus,
  Boxes,
  Loader2,
  CalendarClock,
  History,
  ChevronDown,
  ChevronRight,
  Paperclip,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { calcularValidadeMunicao } from "@/lib/quero-armas/municaoValidade";
import { getStatusValidade, type CorStatus } from "@/lib/quero-armas/statusUnificado";

type MotivoSaida =
  | "treino"
  | "competicao"
  | "baixa_ajuste"
  | "transferencia"
  | "legitima_defesa"
  | "outro";

const MOTIVO_LABEL: Record<MotivoSaida, string> = {
  treino: "TREINO",
  competicao: "COMPETIÇÃO",
  baixa_ajuste: "BAIXA / AJUSTE",
  transferencia: "TRANSFERÊNCIA / REGULARIZAÇÃO",
  legitima_defesa: "OCORRÊNCIA DE LEGÍTIMA DEFESA",
  outro: "OUTRO",
};

interface Movimentacao {
  id: string;
  cliente_id: number;
  tipo: "ENTRADA" | "SAIDA";
  calibre: string;
  marca: string | null;
  lote: string | null;
  quantidade: number;
  data_movimentacao: string;
  data_fabricacao: string | null;
  data_validade: string | null;
  motivo: string | null;
  observacao: string | null;
  documento_url: string | null;
  documento_nome: string | null;
  created_at: string;
}

interface Saldo {
  cliente_id: number;
  calibre: string;
  marca: string;
  lote: string;
  data_fabricacao: string | null;
  data_validade: string | null;
  saldo: number;
  total_entradas: number;
  total_saidas: number;
  ultima_movimentacao: string | null;
}

interface Props {
  clienteId: number;
  onChange?: (totals: { total: number; byCalibre: { calibre: string; quantidade: number }[] }) => void;
}

const COMMON_CALIBRES = [
  "9MM", ".380", ".40", ".45 ACP", "10MM", ".25 ACP", ".32 ACP", "9X21", ".357 SIG",
  ".38", ".357", ".44 MAGNUM", ".44 SPECIAL", ".22 MAGNUM",
  ".22LR", ".22 CURTO", ".17 HMR",
  ".223", "5.56", ".308", "7.62X51", "7.62X39", "7.62X63 (.30-06)", ".300 BLACKOUT",
  ".30-30", ".338 LAPUA", ".338 MAGNUM", ".50 BMG", ".416",
  "CAL .12", "CAL .16", "CAL .20", "CAL .24", "CAL .28", "CAL .32", "CAL .36", "CAL .410",
  ".243 WIN", ".270 WIN", "7MM REM MAG", "6.5 CREEDMOOR",
];

const TONE_BG: Record<CorStatus, string> = {
  verde: "bg-emerald-50 text-emerald-700 border-emerald-200",
  azul: "bg-[#FBF3F4] text-[#7A1F2B] border-[#E5C2C6]",
  amarelo: "bg-amber-50 text-amber-700 border-amber-200",
  laranja: "bg-orange-50 text-orange-700 border-orange-200",
  vermelho: "bg-red-50 text-red-700 border-red-200",
  cinza: "bg-slate-50 text-slate-500 border-slate-200",
};

function applyDateMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function brToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : iso;
}
function isoToBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function loteKey(s: Pick<Saldo, "calibre" | "marca" | "lote">) {
  return `${s.calibre}|${s.marca || ""}|${s.lote || ""}`;
}

export function MunicoesMovimentacoesManager({ clienteId, onChange }: Props) {
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openHist, setOpenHist] = useState<string | null>(null);
  const [showSaida, setShowSaida] = useState<{ calibre: string; marca: string; lote: string } | null>(null);

  const [formEntrada, setFormEntrada] = useState({
    calibre: "9MM",
    marca: "",
    lote: "",
    quantidade: "",
    data_fabricacao: "",
    data_validade: "",
    observacao: "",
  });
  const [fileEntrada, setFileEntrada] = useState<File | null>(null);

  const [formSaida, setFormSaida] = useState({
    quantidade: "",
    motivo: "treino" as MotivoSaida,
    observacao: "",
  });
  const [fileSaida, setFileSaida] = useState<File | null>(null);

  const reload = async () => {
    setLoading(true);
    const [sResp, mResp] = await Promise.all([
      supabase
        .from("qa_municoes_saldos" as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("calibre", { ascending: true }),
      supabase
        .from("qa_municoes_movimentacoes" as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_movimentacao", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (sResp.error || mResp.error) {
      toast.error("Erro ao carregar munições.");
      setLoading(false);
      return;
    }
    const sList = ((sResp.data as any) ?? []) as Saldo[];
    const mList = ((mResp.data as any) ?? []) as Movimentacao[];
    setSaldos(sList);
    setMovs(mList);
    setLoading(false);
    if (onChange) {
      const map = new Map<string, number>();
      sList.forEach((s) => {
        if (s.saldo > 0) map.set(s.calibre, (map.get(s.calibre) ?? 0) + s.saldo);
      });
      const byCalibre = Array.from(map.entries()).map(([calibre, quantidade]) => ({ calibre, quantidade }));
      const total = byCalibre.reduce((a, b) => a + b.quantidade, 0);
      onChange({ total, byCalibre });
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const handleEntrada = async () => {
    const qtd = parseInt(formEntrada.quantidade, 10);
    if (!formEntrada.calibre.trim() || !Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe calibre e quantidade válida.");
      return;
    }
    let isoFab: string | null = null;
    let isoVal: string | null = null;
    if (formEntrada.data_fabricacao.trim()) {
      isoFab = brToIso(formEntrada.data_fabricacao.trim());
      if (!isoFab) {
        toast.error("Data de fabricação inválida (use DD/MM/AAAA).");
        return;
      }
    }
    if (formEntrada.data_validade.trim()) {
      isoVal = brToIso(formEntrada.data_validade.trim());
      if (!isoVal) {
        toast.error("Validade inválida (use DD/MM/AAAA).");
        return;
      }
    }
    setSaving(true);
    let documento_url: string | null = null;
    let documento_nome: string | null = null;
    if (fileEntrada) {
      const safeName = fileEntrada.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
      const path = `clientes/${clienteId}/municoes/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("qa-documentos").upload(path, fileEntrada, {
        cacheControl: "3600", upsert: false, contentType: fileEntrada.type || undefined,
      });
      if (up.error) {
        setSaving(false);
        toast.error("Falha ao enviar anexo: " + up.error.message);
        return;
      }
      documento_url = path;
      documento_nome = fileEntrada.name;
    }
    const { error } = await supabase.from("qa_municoes_movimentacoes" as any).insert({
      cliente_id: clienteId,
      tipo: "ENTRADA",
      calibre: formEntrada.calibre.trim().toUpperCase(),
      marca: formEntrada.marca.trim().toUpperCase() || null,
      lote: formEntrada.lote.trim().toUpperCase() || null,
      quantidade: qtd,
      data_fabricacao: isoFab,
      data_validade: isoVal,
      observacao: formEntrada.observacao.trim() || null,
      documento_url,
      documento_nome,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao registrar entrada.");
      return;
    }
    toast.success("Entrada registrada.");
    setFormEntrada({
      calibre: "9MM", marca: "", lote: "", quantidade: "",
      data_fabricacao: "", data_validade: "", observacao: "",
    });
    setFileEntrada(null);
    reload();
  };

  const handleSaida = async () => {
    if (!showSaida) return;
    const qtd = parseInt(formSaida.quantidade, 10);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe quantidade válida.");
      return;
    }
    if (formSaida.motivo === "outro" && !formSaida.observacao.trim()) {
      toast.error("Para motivo OUTRO, observação é obrigatória.");
      return;
    }
    setSaving(true);
    let documento_url: string | null = null;
    let documento_nome: string | null = null;
    if (fileSaida) {
      const safeName = fileSaida.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
      const path = `clientes/${clienteId}/municoes/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("qa-documentos").upload(path, fileSaida, {
        cacheControl: "3600", upsert: false, contentType: fileSaida.type || undefined,
      });
      if (up.error) {
        setSaving(false);
        toast.error("Falha ao enviar anexo: " + up.error.message);
        return;
      }
      documento_url = path;
      documento_nome = fileSaida.name;
    }
    const { error } = await supabase.from("qa_municoes_movimentacoes" as any).insert({
      cliente_id: clienteId,
      tipo: "SAIDA",
      calibre: showSaida.calibre,
      marca: showSaida.marca || null,
      lote: showSaida.lote || null,
      quantidade: qtd,
      motivo: formSaida.motivo,
      observacao: formSaida.observacao.trim() || null,
      documento_url,
      documento_nome,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erro ao registrar saída (saldo insuficiente?).");
      return;
    }
    toast.success("Saída registrada.");
    setShowSaida(null);
    setFormSaida({ quantidade: "", motivo: "treino", observacao: "" });
    setFileSaida(null);
    reload();
  };

  const movsPorLote = useMemo(() => {
    const byKey = new Map<string, Movimentacao[]>();
    for (const m of movs) {
      const k = `${m.calibre}|${m.marca || ""}|${m.lote || ""}`;
      const arr = byKey.get(k) ?? [];
      arr.push(m);
      byKey.set(k, arr);
    }
    return byKey;
  }, [movs]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Boxes className="h-4 w-4 text-[#7A1F2B]" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
            Estoque de Munições — Movimentações
          </div>
          <div className="text-[10px] text-slate-400">
            Registre entradas e saídas. O saldo é calculado automaticamente por calibre/lote.
          </div>
        </div>
      </div>

      {/* Form de ENTRADA */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          <Plus className="h-3 w-3" /> Registrar Entrada
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <select
            value={formEntrada.calibre}
            onChange={(e) => setFormEntrada((f) => ({ ...f, calibre: e.target.value }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-mono text-slate-700"
          >
            {COMMON_CALIBRES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            type="text" placeholder="Marca"
            value={formEntrada.marca}
            onChange={(e) => setFormEntrada((f) => ({ ...f, marca: e.target.value.toUpperCase() }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] uppercase text-slate-700"
          />
          <input
            type="text" placeholder="Lote"
            value={formEntrada.lote}
            onChange={(e) => setFormEntrada((f) => ({ ...f, lote: e.target.value.toUpperCase() }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] uppercase text-slate-700"
          />
          <input
            type="number" min={1} placeholder="Quantidade"
            value={formEntrada.quantidade}
            onChange={(e) => setFormEntrada((f) => ({ ...f, quantidade: e.target.value }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
          />
          <input
            type="text" inputMode="numeric" maxLength={10}
            placeholder="Fab. DD/MM/AAAA"
            value={formEntrada.data_fabricacao}
            onChange={(e) => setFormEntrada((f) => ({ ...f, data_fabricacao: applyDateMask(e.target.value) }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-mono text-slate-700"
          />
          <input
            type="text" inputMode="numeric" maxLength={10}
            placeholder="Val. DD/MM/AAAA (auto)"
            value={formEntrada.data_validade}
            onChange={(e) => setFormEntrada((f) => ({ ...f, data_validade: applyDateMask(e.target.value) }))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-mono text-slate-700"
          />
          <Button
            onClick={handleEntrada}
            disabled={saving}
            className="h-9 bg-emerald-700 px-3 text-[10px] uppercase tracking-wider text-white hover:bg-emerald-800"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Entrada
          </Button>
        </div>
        <input
          type="text" placeholder="Observação (opcional)"
          value={formEntrada.observacao}
          onChange={(e) => setFormEntrada((f) => ({ ...f, observacao: e.target.value }))}
          className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
        />
        <label className="mt-2 flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-[11px] text-slate-600 hover:border-[#7A1F2B]/40">
          <Paperclip className="h-3.5 w-3.5" />
          {fileEntrada ? <span className="truncate">{fileEntrada.name}</span> : "Anexar nota fiscal / comprovante (opcional)"}
          <input
            type="file" className="hidden"
            accept="image/*,application/pdf"
            onChange={(e) => setFileEntrada(e.target.files?.[0] ?? null)}
          />
          {fileEntrada && (
            <button type="button" onClick={(e) => { e.preventDefault(); setFileEntrada(null); }} className="ml-auto text-slate-400 hover:text-red-500">
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
        <div className="mt-1.5 text-[10px] text-slate-500">
          Validade padrão = fabricação + 60 meses (preenchida automaticamente se em branco).
        </div>
      </div>

      {/* Saldos por lote */}
      <div className="mt-3 space-y-1.5">
        {loading ? (
          <div className="py-6 text-center text-[11px] text-slate-400">Carregando...</div>
        ) : saldos.filter((s) => s.saldo !== 0).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">
            Nenhum lote em estoque. Registre uma entrada acima.
          </div>
        ) : (
          saldos
            .filter((s) => s.saldo !== 0)
            .map((s) => {
              const key = loteKey(s);
              const v = calcularValidadeMunicao(s.data_fabricacao);
              const validadeOverride = s.data_validade && !s.data_fabricacao
                ? getStatusValidade(s.data_validade, "MUNICAO")
                : null;
              const status = validadeOverride ?? v.status;
              const validadeStr = s.data_validade
                ? `VAL ${isoToBr(s.data_validade)}`
                : v.sem_data
                  ? "SEM DATA"
                  : `VAL ${isoToBr(v.data_validade)}`;
              const isOpen = openHist === key;
              const histArr = movsPorLote.get(key) ?? [];
              return (
                <div key={key} className="rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#FBF3F4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#7A1F2B]">
                        {s.calibre}
                      </span>
                      <span className="font-mono text-[14px] font-semibold text-slate-800">
                        {s.saldo.toLocaleString("pt-BR")}
                      </span>
                      {s.marca && <span className="text-[10px] uppercase text-slate-500">· {s.marca}</span>}
                      {s.lote && <span className="text-[10px] uppercase text-slate-500">· LOTE {s.lote}</span>}
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TONE_BG[status.cor]}`}
                        title={s.data_fabricacao ? `Fabricação ${isoToBr(s.data_fabricacao)}` : "Sem data de fabricação"}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {validadeStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setShowSaida({ calibre: s.calibre, marca: s.marca, lote: s.lote })}
                        className="h-7 border-[#7A1F2B]/30 bg-white px-2 text-[10px] uppercase tracking-wider text-[#7A1F2B] hover:bg-[#FBF3F4]"
                      >
                        <Minus className="mr-1 h-3 w-3" /> Saída
                      </Button>
                      <button
                        type="button"
                        onClick={() => setOpenHist(isOpen ? null : key)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Histórico"
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        <History className="h-3 w-3" /> Histórico ({histArr.length})
                      </div>
                      <div className="space-y-1">
                        {histArr.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                m.tipo === "ENTRADA" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                              }`}>
                                {m.tipo === "ENTRADA" ? "+" : "−"} {m.quantidade}
                              </span>
                              <span className="font-mono text-slate-600">{isoToBr(m.data_movimentacao)}</span>
                              {m.motivo && <span className="text-[10px] uppercase text-slate-500">· {MOTIVO_LABEL[m.motivo as MotivoSaida] ?? m.motivo}</span>}
                              {m.observacao && <span className="text-[10px] italic text-slate-500">"{m.observacao}"</span>}
                            </div>
                            {m.documento_url && (
                              <a href={m.documento_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#7A1F2B]">
                                <Paperclip className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Modal SAÍDA */}
      {showSaida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B]">Registrar Saída</div>
                <div className="text-[12px] font-semibold text-slate-700">
                  {showSaida.calibre}{showSaida.marca && ` · ${showSaida.marca}`}{showSaida.lote && ` · LOTE ${showSaida.lote}`}
                </div>
              </div>
              <button onClick={() => setShowSaida(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="number" min={1} placeholder="Quantidade"
                value={formSaida.quantidade}
                onChange={(e) => setFormSaida((f) => ({ ...f, quantidade: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700"
              />
              <select
                value={formSaida.motivo}
                onChange={(e) => setFormSaida((f) => ({ ...f, motivo: e.target.value as MotivoSaida }))}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] uppercase text-slate-700"
              >
                {(Object.keys(MOTIVO_LABEL) as MotivoSaida[]).map((k) => (
                  <option key={k} value={k}>{MOTIVO_LABEL[k]}</option>
                ))}
              </select>
              <textarea
                placeholder={formSaida.motivo === "outro" ? "Observação OBRIGATÓRIA" : "Observação (opcional)"}
                value={formSaida.observacao}
                onChange={(e) => setFormSaida((f) => ({ ...f, observacao: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700"
              />
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-[11px] text-slate-600 hover:border-[#7A1F2B]/40">
                <Paperclip className="h-3.5 w-3.5" />
                {fileSaida ? <span className="truncate">{fileSaida.name}</span> : "Anexar comprovante (opcional)"}
                <input
                  type="file" className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFileSaida(e.target.files?.[0] ?? null)}
                />
                {fileSaida && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setFileSaida(null); }} className="ml-auto text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowSaida(null)} className="h-9 text-[11px] uppercase">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaida}
                  disabled={saving}
                  className="h-9 bg-[#7A1F2B] text-[11px] uppercase text-white hover:bg-[#641722]"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
                  Confirmar Saída
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}