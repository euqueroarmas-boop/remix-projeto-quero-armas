import { useEffect, useState } from "react";
import { ArrowRight, FileInput, Loader2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  QAOperationalSection,
  QAActionCard,
  QAStatusChip,
  QAEmptyState,
} from "@/components/quero-armas/qa-operational";

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

        const origemPromise = origemId
          ? (supabase
              .from("qa_cadastro_publico" as any)
              .select("id, status, created_at, servico_solicitado_id, servico_solicitado_nome, origem")
              .eq("id", origemId)
              .maybeSingle() as any).then((r: any) => r)
          : Promise.resolve({ data: null });
        const outrosPromise = cpfDigits
          ? (supabase
              .from("qa_cadastro_publico" as any)
              .select("id, status, created_at, servico_solicitado_nome")
              .eq("cpf", cpfDigits)
              .order("created_at", { ascending: false })
              .limit(10) as any).then((r: any) => r)
          : Promise.resolve({ data: [] });
        const [origemRes, outrosRes] = await Promise.all([origemPromise, outrosPromise]);
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
      <QAOperationalSection icon={Database} title="Origem do Cliente" status="Carregando" statusTone="info">
        <div className="rounded-xl border bg-white px-3 py-2 flex items-center gap-2 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando origem do cliente…
        </div>
      </QAOperationalSection>
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

  const verBtn = (id: any, label = "Ver cadastro") => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAbrirCadastroPublico(id); }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#E5C2C6] bg-white text-[#7A1F2B] hover:bg-[#FBF3F4] text-[10px] font-bold uppercase tracking-wider"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </button>
  );

  return (
    <QAOperationalSection
      icon={FileInput}
      title="Origem do Cliente"
      status="Auditoria"
      statusTone="info"
    >
      {origem && (
        <QAActionCard
          icon={Database}
          title={origem.servico_solicitado_nome || "Serviço não informado"}
          description={<>Cadastro público de origem · Recebido em <strong>{fmtDate(origem.created_at)}</strong></>}
          status={String(origem.status || "—").toUpperCase()}
          statusTone={origem.status === "aprovado" ? "ok" : origem.status === "pendente_correcao" ? "warn" : "info"}
          actions={verBtn(origem.id)}
        />
      )}

      {outros.length > 0 && (
        <div className="space-y-2">
          <div className="px-1 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-600">
              Outros cadastros do mesmo CPF
            </span>
            <QAStatusChip label={`${outros.length}`} tone="neutral" />
          </div>
          {outros.map((o: any) => (
            <QAActionCard
              key={o.id}
              icon={Database}
              title={o.servico_solicitado_nome || "Serviço não informado"}
              description={fmtDate(o.created_at)}
              status={String(o.status || "—").toUpperCase()}
              statusTone={o.status === "aprovado" ? "ok" : o.status === "pendente_correcao" ? "warn" : "neutral"}
              actions={verBtn(o.id, "Abrir")}
            />
          ))}
        </div>
      )}

      {!origem && outros.length === 0 && (
        <QAEmptyState icon={Database} title="Sem cadastro público vinculado" description="Este cliente não possui registro recebido pelo formulário público." />
      )}
    </QAOperationalSection>
  );
}