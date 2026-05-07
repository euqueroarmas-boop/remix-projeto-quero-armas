import { useEffect, useState } from "react";
import { ArrowRight, FileInput, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  cliente: any;
  onAbrirCadastroPublico: (id: string | number) => void;
}

/**
 * FASE 2A — Bloco discreto "Origem do cliente".
 * Aparece apenas se o cliente tem vínculo com `qa_cadastro_publico`.
 * Mostra cadastro público de origem + outros cadastros do mesmo CPF
 * como auditoria — sem duplicar cliente.
 */
export default function OrigemClienteCadastroPublico({ cliente, onAbrirCadastroPublico }: Props) {
  const [loading, setLoading] = useState(true);
  const [origem, setOrigem] = useState<any>(null);
  const [outros, setOutros] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const cpfDigits = String(cliente?.cpf || "").replace(/\D/g, "");
        const origemId = (cliente as any)?.cadastro_publico_id ?? null;

        const queries: Promise<any>[] = [];
        if (origemId) {
          queries.push(
            supabase
              .from("qa_cadastro_publico" as any)
              .select("id, status, created_at, servico_solicitado_id, servico_solicitado_nome, origem")
              .eq("id", origemId)
              .maybeSingle()
          );
        } else {
          queries.push(Promise.resolve({ data: null }));
        }

        if (cpfDigits) {
          queries.push(
            supabase
              .from("qa_cadastro_publico" as any)
              .select("id, status, created_at, servico_solicitado_nome")
              .eq("cpf", cpfDigits)
              .order("created_at", { ascending: false })
              .limit(10)
          );
        } else {
          queries.push(Promise.resolve({ data: [] }));
        }

        const [origemRes, outrosRes] = await Promise.all(queries);
        if (cancel) return;
        setOrigem(origemRes?.data ?? null);
        const lista = (outrosRes?.data ?? []).filter((c: any) => c.id !== (origemRes?.data?.id ?? origemId));
        setOutros(lista);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [cliente?.id, cliente?.cpf, (cliente as any)?.cadastro_publico_id]);

  if (loading) {
    return (
      <div className="qa-card p-3 flex items-center gap-2 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando origem do cliente…
      </div>
    );
  }

  if (!origem && outros.length === 0) return null;

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
    } catch { return "—"; }
  };

  return (
    <div className="qa-card p-3 md:p-4 border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "hsl(220 20% 92%)" }}>
          <FileInput className="h-3 w-3 text-slate-600" />
        </div>
        <h3 className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-600">
          Origem do cliente — Auditoria
        </h3>
      </div>

      {origem && (
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-2 mb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Cadastro público de origem</div>
              <div className="text-[12px] font-semibold text-slate-800 truncate">
                {origem.servico_solicitado_nome || "Serviço não informado"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Recebido em {fmtDate(origem.created_at)} · Status: <span className="font-bold uppercase">{String(origem.status || "—")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAbrirCadastroPublico(origem.id)}
              className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#E5C2C6] bg-white text-[#7A1F2B] hover:bg-[#FBF3F4] font-bold uppercase tracking-wider"
            >
              Ver cadastro público <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {outros.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Outros cadastros públicos do mesmo CPF ({outros.length})
          </div>
          <div className="space-y-1">
            {outros.map((o: any) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onAbrirCadastroPublico(o.id)}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 hover:border-[#E5C2C6] hover:bg-[#FBF3F4] text-left"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-700 truncate">
                    {o.servico_solicitado_nome || "Serviço não informado"}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {fmtDate(o.created_at)} · {String(o.status || "—").toUpperCase()}
                  </div>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}