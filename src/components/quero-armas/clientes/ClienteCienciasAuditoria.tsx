// ============================================================================
// Ciências e aceites — auditoria permanente do que o cliente declarou ter lido.
//
// Regra do usuário (09/08/2026): tudo o que o cliente aceita na área dele fica
// no cadastro como dado permanente, com carimbo de conexão (IP, dispositivo,
// idioma, data/hora) e o TEXTO INTEGRAL que estava na tela — mais o hash
// SHA-256 desse texto, que prova que nada foi alterado depois.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, ChevronDown, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ciencia {
  id: string;
  termo_codigo: string;
  termo_versao: string;
  termo_titulo: string;
  termo_texto: string;
  termo_hash: string;
  aceito_em: string;
  ip: string | null;
  user_agent: string | null;
  accept_language: string | null;
  referer: string | null;
  origem: string;
  metadados: Record<string, any> | null;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function ClienteCienciasAuditoria({ cliente }: { cliente: any }) {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<Ciencia[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!cliente?.id) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const { data } = await supabase
        .from("qa_cliente_ciencias" as any)
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("aceito_em", { ascending: false });
      if (vivo) {
        setItens(((data as any[]) ?? []) as Ciencia[]);
        setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [cliente?.id]);

  const baixar = (c: Ciencia) => {
    const linhas = [
      "COMPROVANTE DE CIÊNCIA — QUERO ARMAS",
      "",
      `CLIENTE: ${String(cliente?.nome ?? "").toUpperCase()}`,
      `CPF: ${cliente?.cpf ?? "—"}`,
      `TERMO: ${c.termo_titulo} (${c.termo_codigo} · ${c.termo_versao})`,
      `ACEITO EM: ${dataHora(c.aceito_em)} (HORÁRIO DE BRASÍLIA)`,
      `IP: ${c.ip ?? "—"}`,
      `DISPOSITIVO: ${c.user_agent ?? "—"}`,
      `IDIOMA: ${c.accept_language ?? "—"}`,
      `ORIGEM: ${c.origem}`,
      `HASH SHA-256 DO TEXTO: ${c.termo_hash}`,
      "",
      "TEXTO INTEGRAL EXIBIDO AO CLIENTE:",
      "",
      c.termo_texto,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([linhas], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ciencia-${c.termo_codigo}-${c.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const vazio = useMemo(() => !carregando && itens.length === 0, [carregando, itens]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando ciências…
      </div>
    );
  }

  if (vazio) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
          Nenhuma ciência registrada
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Assim que o cliente aceitar um termo na área dele, o registro aparece aqui com o
          carimbo da conexão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {itens.map((c) => {
        const expandido = aberto === c.id;
        return (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setAberto(expandido ? null : c.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7A1F2B]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold uppercase text-slate-800">
                  {c.termo_titulo}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {dataHora(c.aceito_em)} · IP {c.ip ?? "—"} · versão {c.termo_versao}
                </span>
              </span>
              {expandido
                ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
            </button>

            {expandido && (
              <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                <dl className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Origem", c.origem],
                    ["Idioma", c.accept_language ?? "—"],
                    ["Referer", c.referer ?? "—"],
                    ["Dispositivo", c.user_agent ?? "—"],
                    ["Hash SHA-256", c.termo_hash],
                    ...Object.entries(c.metadados ?? {}).map(([k, v]) => [k, String(v ?? "—")]),
                  ].map(([rotulo, valor]) => (
                    <div key={String(rotulo)} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {String(rotulo)}
                      </dt>
                      <dd className="break-all text-[12px] text-slate-700">{String(valor)}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Texto integral exibido ao cliente
                  </p>
                  <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700">
                    {c.termo_texto}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={() => baixar(c)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar comprovante
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}