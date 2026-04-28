import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Inbox, RefreshCw, CheckCircle2, Clock, User, Phone, Mail,
  Calendar, Loader2, AlertTriangle, ExternalLink,
} from "lucide-react";

interface PendingRow {
  id: string;
  cliente_id: number;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  observacoes_admin: string | null;
  cliente?: {
    nome_completo: string;
    cpf: string | null;
    email: string | null;
    celular: string | null;
  };
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}

function diasDesde(d: string | null): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default function QAContratacoesPendentesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: procs, error } = await supabase
        .from("qa_processos")
        .select(
          "id, cliente_id, servico_nome, status, pagamento_status, data_criacao, observacoes_admin"
        )
        .eq("pagamento_status", "aguardando")
        .order("data_criacao", { ascending: false })
        .limit(200);
      if (error) throw error;

      const list = (procs ?? []) as PendingRow[];
      const ids = [...new Set(list.map((p) => p.cliente_id))];
      if (ids.length > 0) {
        const { data: clientes } = await supabase
          .from("qa_clientes")
          .select("id, nome_completo, cpf, email, celular")
          .in("id", ids);
        const map = new Map((clientes ?? []).map((c: any) => [c.id, c]));
        list.forEach((p) => (p.cliente = map.get(p.cliente_id)));
      }
      setRows(list);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const confirmarPagamento = async (row: PendingRow) => {
    if (
      !window.confirm(
        `Confirmar pagamento de "${row.servico_nome}" do cliente ${row.cliente?.nome_completo || row.cliente_id}?\n\nIsso libera a Central de Documentos para o cliente.`
      )
    )
      return;
    setConfirmingId(row.id);
    try {
      const { error } = await supabase
        .from("qa_processos")
        .update({
          pagamento_status: "confirmado",
          status: "aguardando_documentos",
          data_validacao: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;

      // Dispara notificação ao cliente
      supabase.functions
        .invoke("qa-processo-notificar", {
          body: { processo_id: row.id, evento: "pagamento_confirmado" },
        })
        .catch((e) => console.warn("[notif pagamento]", e));

      toast.success("Pagamento confirmado e cliente notificado.");
      await carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">
            ADMIN · QUERO ARMAS
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 uppercase tracking-tight mt-0.5">
            Contratações pendentes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Processos aguardando validação manual de pagamento.
          </p>
        </div>
        <button
          onClick={carregar}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-6 w-6 mx-auto text-slate-400 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <div className="text-sm font-bold text-slate-700 uppercase">
            Nenhuma contratação pendente
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tudo em dia. Novas contratações aparecem aqui automaticamente.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-wider font-bold text-amber-700 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            <AlertTriangle className="h-3 w-3" /> {rows.length} processo(s) aguardando pagamento
          </div>

          {rows.map((p) => {
            const dias = diasDesde(p.data_criacao);
            const urgente = dias >= 2;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border p-4 md:p-5 ${urgente ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                        {formatDateTime(p.data_criacao)}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${urgente ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {dias === 0 ? "HOJE" : `${dias}D ATRÁS`}
                      </span>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-slate-900 uppercase mt-1">
                      {p.servico_nome}
                    </h3>

                    <div className="mt-2.5 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-bold uppercase">
                          {p.cliente?.nome_completo || `Cliente #${p.cliente_id}`}
                        </span>
                      </div>
                      {p.cliente?.cpf && (
                        <div className="text-slate-500">CPF {p.cliente.cpf}</div>
                      )}
                      {p.cliente?.celular && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <a
                            href={`https://wa.me/${p.cliente.celular.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline"
                          >
                            {p.cliente.celular}
                          </a>
                        </div>
                      )}
                      {p.cliente?.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <a
                            href={`mailto:${p.cliente.email}`}
                            className="text-blue-700 hover:underline truncate"
                          >
                            {p.cliente.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {p.observacoes_admin && (
                      <div className="mt-2 text-[11px] text-slate-500 italic">
                        {p.observacoes_admin}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-stretch gap-2 md:min-w-[200px]">
                    <button
                      onClick={() => confirmarPagamento(p)}
                      disabled={confirmingId === p.id}
                      className="flex-1 h-10 px-4 rounded-lg text-xs uppercase tracking-wider font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {confirmingId === p.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar pagamento
                        </>
                      )}
                    </button>
                    <a
                      href={`/processos?processo=${p.id}`}
                      className="h-9 px-3 rounded-lg text-[11px] uppercase tracking-wider font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="h-3 w-3" /> Ver processo
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}