// ============================================================================
// PAINEL DE E-MAILS — visão completa dos disparos feitos para clientes.
// Deduplicado por message_id (um e-mail = uma linha, com o último status).
// Fonte: RPCs `qa_email_painel`, `qa_email_painel_facetas`, `qa_email_disparos_resumo`.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BORDO = "#7A1F2B";
const VERDE = "#166534";
const AMBAR = "#8A6100";
const PAGINA = 50;

interface Linha {
  message_id: string;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  assunto: string | null;
  created_at: string;
  resolvido_por_message_id?: string | null;
  total_filtrado: number;
}

const PRESETS = [
  { k: "24h", label: "ÚLTIMAS 24H", horas: 24 },
  { k: "7d", label: "7 DIAS", horas: 24 * 7 },
  { k: "30d", label: "30 DIAS", horas: 24 * 30 },
  { k: "tudo", label: "TUDO", horas: 0 },
] as const;

const corStatus = (s: string | null) => {
  const v = String(s ?? "").toLowerCase();
  if (v === "sent") return { cor: VERDE, fundo: "#EAF5EE" };
  if (["dlq", "failed", "bounced", "complained"].includes(v)) return { cor: BORDO, fundo: "#F7ECEE" };
  if (v === "suppressed") return { cor: AMBAR, fundo: "#FBF3E2" };
  return { cor: "#4A4A4A", fundo: "#F2F2F2" };
};

const FALHAS = ["dlq", "failed", "bounced", "complained"];

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function QAEmailsPainelPage() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["k"]>("7d");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [template, setTemplate] = useState("");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [resumo, setResumo] = useState({ total: 0, hoje: 0, falhas: 0 });
  const [carregando, setCarregando] = useState(true);

  const janela = useMemo(() => {
    if (de || ate) {
      return {
        desde: de ? new Date(`${de}T00:00:00`).toISOString() : null,
        ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : null,
      };
    }
    const p = PRESETS.find((x) => x.k === preset)!;
    if (!p.horas) return { desde: null, ate: null };
    return { desde: new Date(Date.now() - p.horas * 3600_000).toISOString(), ate: null };
  }, [preset, de, ate]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.rpc("qa_email_painel" as any, {
      _desde: janela.desde,
      _ate: janela.ate,
      _template: template || null,
      _status: status || null,
      _busca: busca.trim() || null,
      _limite: PAGINA,
      _offset: pagina * PAGINA,
    });
    setLinhas(((data as any[]) ?? []) as Linha[]);
    setCarregando(false);
  }, [janela, template, status, busca, pagina]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    (async () => {
      const [{ data: fac }, { data: res }] = await Promise.all([
        supabase.rpc("qa_email_painel_facetas" as any),
        supabase.rpc("qa_email_disparos_resumo" as any),
      ]);
      const f = (Array.isArray(fac) ? fac[0] : fac) as any;
      setTemplates((f?.templates ?? []) as string[]);
      setStatuses((f?.statuses ?? []) as string[]);
      const r = (Array.isArray(res) ? res[0] : res) as any;
      if (r) setResumo({ total: Number(r.total ?? 0), hoje: Number(r.hoje ?? 0), falhas: Number(r.falhas ?? 0) });
    })();
  }, []);

  const total = linhas[0]?.total_filtrado ?? 0;
  const paginas = Math.max(1, Math.ceil(Number(total) / PAGINA));

  const exportar = () => {
    const csv = [
      ["DATA/HORA", "TEMPLATE", "DESTINATARIO", "ASSUNTO", "STATUS", "ERRO"],
      ...linhas.map((l) => [
        dataHora(l.created_at), l.template_name ?? "", l.recipient_email ?? "",
        l.assunto ?? "", l.status ?? "", l.error_message ?? "",
      ]),
    ]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "emails-disparados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cardsResumo = [
    { label: "TOTAL DE E-MAILS", v: resumo.total, cor: "#0A0A0A" },
    { label: "ENVIADOS HOJE", v: resumo.hoje, cor: VERDE },
    { label: "FALHARAM", v: resumo.falhas, cor: BORDO },
    { label: "NO FILTRO ATUAL", v: Number(total), cor: "#0A0A0A" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" style={{ color: BORDO }} />
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-900">E-mails disparados</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={carregar} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 hover:border-slate-400">
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </button>
          <button type="button" onClick={exportar} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 hover:border-slate-400">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {cardsResumo.map((c) => (
          <div key={c.label} className="rounded-sm border border-[#E4E4E4] bg-white px-3 py-2">
            <div className="text-[18px] font-bold tabular-nums leading-none" style={{ color: c.cor }}>{c.v}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.k}
            type="button"
            onClick={() => { setPreset(p.k); setDe(""); setAte(""); setPagina(0); }}
            className={`rounded-full border px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ${
              !de && !ate && preset === p.k ? "border-[#7A1F2B] text-[#7A1F2B]" : "border-slate-200 text-slate-500"
            }`}
          >
            {p.label}
          </button>
        ))}
        <input type="date" value={de} onChange={(e) => { setDe(e.target.value); setPagina(0); }}
          className="h-9 rounded-lg border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400" />
        <span className="text-[10.5px] font-medium uppercase text-slate-400">até</span>
        <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPagina(0); }}
          className="h-9 rounded-lg border border-slate-200 px-2 text-[11px] outline-none focus:border-slate-400" />

        <select value={template} onChange={(e) => { setTemplate(e.target.value); setPagina(0); }}
          className="h-9 rounded-lg border border-slate-200 px-2 text-[11px] uppercase outline-none focus:border-slate-400">
          <option value="">TODOS OS TIPOS</option>
          {templates.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>

        <select value={status} onChange={(e) => { setStatus(e.target.value); setPagina(0); }}
          className="h-9 rounded-lg border border-slate-200 px-2 text-[11px] uppercase outline-none focus:border-slate-400">
          <option value="">TODOS OS STATUS</option>
          <option value="falha_pendente">FALHA PENDENTE</option>
          <option value="falha_resolvida">FALHA JÁ REENVIADA</option>
          {statuses.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
            placeholder="BUSCAR DESTINATÁRIO"
            className="h-9 w-[240px] max-w-full rounded-lg border border-slate-200 pl-7 pr-3 text-[11px] uppercase tracking-wider outline-none focus:border-slate-400" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[11px] uppercase tracking-wider text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando
          </div>
        ) : linhas.length === 0 ? (
          <div className="py-10 text-center text-[11px] uppercase tracking-wider text-slate-400">Nenhum e-mail no filtro</div>
        ) : (
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                {["DATA/HORA", "TIPO", "DESTINATÁRIO", "ASSUNTO", "STATUS"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const reenviado = FALHAS.includes(String(l.status ?? "").toLowerCase()) && Boolean(l.resolvido_por_message_id);
                const c = reenviado ? { cor: VERDE, fundo: "#EAF5EE" } : corStatus(l.status);
                return (
                  <tr key={l.message_id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2 text-[10.5px] font-medium tabular-nums text-slate-700 whitespace-nowrap">{dataHora(l.created_at)}</td>
                    <td className="px-3 py-2 text-[10.5px] font-medium uppercase text-slate-700">{l.template_name ?? "—"}</td>
                    <td className="px-3 py-2 text-[10.5px] font-medium text-slate-600">{l.recipient_email ?? "—"}</td>
                    <td className="px-3 py-2 text-[10.5px] font-medium text-slate-600 max-w-[320px] truncate" title={l.assunto ?? ""}>{l.assunto || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: c.cor, background: c.fundo }}>
                        {reenviado ? "REENVIADO" : (l.status ?? "—")}
                      </span>
                      {l.error_message && !reenviado && (
                        <div className="mt-1 max-w-[280px] truncate text-[9.5px] font-medium" style={{ color: BORDO }} title={l.error_message}>
                          {l.error_message}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-500">
          PÁGINA {pagina + 1} DE {paginas} · {Number(total)} E-MAIL(S)
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 disabled:opacity-40">
            Anterior
          </button>
          <button type="button" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 disabled:opacity-40">
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}