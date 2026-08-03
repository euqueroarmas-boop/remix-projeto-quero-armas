import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Lock } from "lucide-react";

const BRAND = "#7A1F2B";
const OSWALD = "'Oswald','Arial Narrow',Arial,sans-serif";
const SP_TZ = "America/Sao_Paulo";

type ProtocoloRow = {
  id: string;
  numero_protocolo: string | null;
  titulo: string | null;
  status: string | null;
  created_at: string;
  last_activity_at: string | null;
  updated_at: string | null;
};

function fmtDMYHM(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: SP_TZ })}, ${d.toLocaleTimeString("pt-BR", {
    timeZone: SP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Protocolos de atendimento do Klal — visão do cliente dentro de Configurações.
 * Somente leitura: lista os protocolos abertos no chat, com data e status.
 */
type MensagemRow = {
  id: string;
  role: string;
  content: string;
  conteudo_corrigido: string | null;
  created_at: string;
};

export default function ProtocolosAtendimentoPanel({
  clienteId,
  onContinuarChat,
}: {
  clienteId?: number | null;
  onContinuarChat?: () => void;
}) {
  const [rows, setRows] = useState<ProtocoloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<ProtocoloRow | null>(null);
  const [msgs, setMsgs] = useState<MensagemRow[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!clienteId) { setLoading(false); return; }
      try {
        const { data } = await (supabase as any)
          .from("qa_chat_sessoes")
          .select("id, numero_protocolo, titulo, status, created_at, updated_at, last_activity_at")
          .eq("cliente_id", clienteId)
          .order("last_activity_at", { ascending: false })
          .limit(50);
        if (alive) setRows((data ?? []) as ProtocoloRow[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteId]);

  // Abre o protocolo em leitura: carrega o histórico daquela sessão.
  const abrirProtocolo = async (p: ProtocoloRow) => {
    setAberto(p);
    setMsgs([]);
    setMsgsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("qa_chat_mensagens")
        .select("id, role, content, conteudo_corrigido, created_at")
        .eq("sessao_id", p.id)
        .order("created_at", { ascending: true })
        .limit(100);
      setMsgs((data ?? []) as MensagemRow[]);
    } finally {
      setMsgsLoading(false);
    }
  };

  return (
    <>
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div
        className="uppercase mb-3"
        style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 12, letterSpacing: "0.18em", color: "#6B6B6B" }}
      >
        Protocolos de atendimento
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-500">Nenhum protocolo de atendimento registrado até agora.</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {rows.map((p) => {
            const ativo = (p.status || "").toLowerCase() === "ativo";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => abrirProtocolo(p)}
                className="w-full text-left rounded-lg border border-slate-200 bg-[#FAFAFA] px-3 py-2 transition-colors hover:bg-slate-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="uppercase truncate"
                    style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", color: "#141414" }}
                  >
                    {p.numero_protocolo || "—"}
                  </span>
                  <span
                    className="uppercase shrink-0 px-2 py-0.5 rounded"
                    style={{
                      fontFamily: OSWALD,
                      fontWeight: 600,
                      fontSize: 9.5,
                      letterSpacing: "0.16em",
                      color: ativo ? "#FFFFFF" : "#6B6B6B",
                      background: ativo ? BRAND : "#EDEDED",
                    }}
                  >
                    {ativo ? "Aberto" : "Encerrado"}
                  </span>
                </div>
                {p.titulo && <div className="text-[11px] text-slate-600 mt-0.5 truncate">{p.titulo}</div>}
                <div className="text-[10.5px] text-slate-500 mt-1">
                  Aberto em {fmtDMYHM(p.created_at)} · Última atividade {fmtDMYHM(p.last_activity_at || p.updated_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>

    {aberto && (
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
        onClick={() => setAberto(null)}
      >
        <div
          className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col"
          style={{ maxHeight: "calc(100dvh - 24px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-slate-100 pr-[56px] relative">
            <div className="min-w-0">
              <div
                className="uppercase truncate"
                style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: "#141414" }}
              >
                {aberto.numero_protocolo || "Protocolo"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[10px] uppercase tracking-wider text-slate-600">
                  {(aberto.status || "").toLowerCase() === "ativo" ? "Aberto" : "Encerrado"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[10px] uppercase tracking-wider text-slate-600">
                  {fmtDMYHM(aberto.created_at)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(null)}
              aria-label="Fechar"
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ background: BRAND }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {msgsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
            ) : msgs.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-6 text-center">Sem mensagens registradas neste protocolo.</p>
            ) : (
              msgs.map((m) => {
                const doCliente = m.role === "user";
                return (
                  <div key={m.id} className={`flex ${doCliente ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[85%] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        borderRadius: 12,
                        background: doCliente ? BRAND : "#F5F5F5",
                        color: doCliente ? "#FFFFFF" : "#1A1A1A",
                      }}
                    >
                      {m.conteudo_corrigido || m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100">
            {(aberto.status || "").toLowerCase() === "ativo" ? (
              <button
                type="button"
                onClick={() => { setAberto(null); onContinuarChat?.(); }}
                className="w-full h-10 rounded-xl text-white uppercase"
                style={{ background: BRAND, fontFamily: OSWALD, fontWeight: 600, fontSize: 12, letterSpacing: "0.14em" }}
              >
                Continuar no chat do Klal
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-[#FAFAFA] border border-slate-200 px-3 py-2.5">
                <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px] text-slate-600">
                  Protocolo encerrado — somente leitura. Abra um novo atendimento no chat do Klal para continuar.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
