import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrainCircuit, CheckCircle2, XCircle, Loader2, MessageCircle, Bot, BookOpen } from "lucide-react";

type Filtro = "pendentes" | "todos";

type LinhaFila = {
  id: string;
  sessao_id: string;
  cliente_id: number;
  content: string;
  fontes: any;
  created_at: string;
  aprovada_kb: boolean | null;
  aprovada_em: string | null;
  doc_kb_id: string | null;
  pergunta: string;
  sessao_titulo: string | null;
  cliente_nome: string | null;
};

function chipFontes(fontes: any): { label: string; kind: "legislacao" | "documento" | "aprendizado" }[] {
  if (!Array.isArray(fontes)) return [];
  return fontes.slice(0, 6).map((f: any) => {
    const titulo = f?.titulo_norma || f?.titulo_doc || "Fonte";
    if (typeof titulo === "string" && titulo.startsWith("QA: ")) {
      return { label: "Resposta anterior aprovada", kind: "aprendizado" };
    }
    if (f?.tipo === "legislacao") return { label: titulo, kind: "legislacao" };
    return { label: titulo, kind: "documento" };
  });
}

export default function QAChatAprovacaoPage() {
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [linhas, setLinhas] = useState<LinhaFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendentesCount, setPendentesCount] = useState(0);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("qa_chat_mensagens")
        .select("id, sessao_id, cliente_id, content, fontes, created_at, aprovada_kb, aprovada_em, doc_kb_id")
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filtro === "pendentes") query = query.is("aprovada_kb", null);

      const { data: msgs, error } = await query;
      if (error) throw error;

      const sessaoIds = Array.from(new Set((msgs ?? []).map((m) => m.sessao_id)));
      const clienteIds = Array.from(new Set((msgs ?? []).map((m) => m.cliente_id)));

      const [{ data: sessoes }, { data: clientes }] = await Promise.all([
        sessaoIds.length
          ? supabase.from("qa_chat_sessoes").select("id, titulo").in("id", sessaoIds)
          : Promise.resolve({ data: [] as any[] }),
        clienteIds.length
          ? supabase.from("qa_clientes").select("id, nome_completo").in("id", clienteIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const sessMap = new Map((sessoes ?? []).map((s: any) => [s.id, s.titulo]));
      const cliMap = new Map((clientes ?? []).map((c: any) => [c.id, c.nome_completo]));

      // Pergunta = user anterior na mesma sessão
      const perguntasByMsg = new Map<string, string>();
      if (sessaoIds.length) {
        const { data: userMsgs } = await supabase
          .from("qa_chat_mensagens")
          .select("id, sessao_id, content, created_at")
          .eq("role", "user")
          .in("sessao_id", sessaoIds)
          .order("created_at", { ascending: true });

        const bySessao = new Map<string, { created_at: string; content: string }[]>();
        for (const u of userMsgs ?? []) {
          const arr = bySessao.get(u.sessao_id) ?? [];
          arr.push({ created_at: u.created_at, content: u.content });
          bySessao.set(u.sessao_id, arr);
        }
        for (const m of msgs ?? []) {
          const arr = bySessao.get(m.sessao_id) ?? [];
          let candidato = "";
          for (const u of arr) {
            if (u.created_at < m.created_at) candidato = u.content;
            else break;
          }
          perguntasByMsg.set(m.id, candidato);
        }
      }

      const rows: LinhaFila[] = (msgs ?? []).map((m: any) => ({
        id: m.id,
        sessao_id: m.sessao_id,
        cliente_id: m.cliente_id,
        content: m.content,
        fontes: m.fontes,
        created_at: m.created_at,
        aprovada_kb: m.aprovada_kb,
        aprovada_em: m.aprovada_em,
        doc_kb_id: m.doc_kb_id,
        pergunta: perguntasByMsg.get(m.id) || "Pergunta não localizada",
        sessao_titulo: sessMap.get(m.sessao_id) ?? null,
        cliente_nome: cliMap.get(m.cliente_id) ?? null,
      }));
      setLinhas(rows);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao carregar fila");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  const carregarContagem = useCallback(async () => {
    const { count } = await supabase
      .from("qa_chat_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("role", "assistant")
      .is("aprovada_kb", null);
    setPendentesCount(count ?? 0);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarContagem(); }, [carregarContagem]);

  useEffect(() => {
    const channel = supabase
      .channel("qa_chat_aprovacao_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_chat_mensagens" },
        () => { carregarContagem(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregarContagem]);

  const executar = async (mensagem_id: string, acao: "aprovar" | "rejeitar") => {
    setPendingId(mensagem_id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-chat-aprovar-resposta", {
        body: { mensagem_id, acao },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (acao === "aprovar") toast.success("Resposta aprovada — a IA já consulta esse conhecimento.");
      else toast.success("Resposta rejeitada — não será usada como referência.");
      await Promise.all([carregar(), carregarContagem()]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na operação");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="qa-scope max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(352 33% 96%)", color: "hsl(352 60% 30%)" }}
          >
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold uppercase tracking-wide" style={{ color: "hsl(220 20% 15%)" }}>
              Aprendizado da IA
            </h1>
            <p className="text-xs" style={{ color: "hsl(220 10% 50%)" }}>
              Respostas aprovadas viram conhecimento consultável nas próximas perguntas.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFiltro("pendentes")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide border transition-colors`}
            style={
              filtro === "pendentes"
                ? { background: "hsl(352 60% 30%)", color: "#fff", borderColor: "hsl(352 60% 30%)" }
                : { background: "#fff", color: "hsl(220 20% 30%)", borderColor: "hsl(220 13% 88%)" }
            }
          >
            Pendentes {pendentesCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold"
                style={{ background: filtro === "pendentes" ? "rgba(255,255,255,0.25)" : "hsl(352 60% 30%)", color: "#fff" }}>
                {pendentesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFiltro("todos")}
            className="px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide border transition-colors"
            style={
              filtro === "todos"
                ? { background: "hsl(352 60% 30%)", color: "#fff", borderColor: "hsl(352 60% 30%)" }
                : { background: "#fff", color: "hsl(220 20% 30%)", borderColor: "hsl(220 13% 88%)" }
            }
          >
            Todos
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: "hsl(220 10% 50%)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fila…
        </div>
      ) : linhas.length === 0 ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "hsl(220 13% 91%)", background: "#fff" }}>
          <BrainCircuit className="h-8 w-8 mx-auto mb-3" style={{ color: "hsl(220 10% 60%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 45%)" }}>
            {filtro === "pendentes" ? "Nenhuma resposta pendente de aprovação." : "Nenhuma resposta encontrada."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {linhas.map((row) => {
            const chips = chipFontes(row.fontes);
            const isPending = pendingId === row.id;
            return (
              <article
                key={row.id}
                className="rounded-xl border overflow-hidden"
                style={{ background: "#fff", borderColor: "hsl(220 13% 91%)" }}
              >
                <header className="px-4 py-2.5 flex flex-wrap items-center gap-2 justify-between border-b"
                  style={{ borderColor: "hsl(220 13% 93%)", background: "hsl(220 14% 98%)" }}>
                  <div className="text-[11px] uppercase tracking-widest" style={{ color: "hsl(220 10% 55%)" }}>
                    {row.cliente_nome ? row.cliente_nome.toUpperCase() : "Cliente"} · {new Date(row.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                    {row.aprovada_kb === true && (
                      <span className="inline-flex items-center gap-1" style={{ color: "hsl(150 60% 30%)" }}>
                        <CheckCircle2 className="h-3 w-3" /> Aprovada
                      </span>
                    )}
                    {row.aprovada_kb === false && (
                      <span className="inline-flex items-center gap-1" style={{ color: "hsl(0 60% 45%)" }}>
                        <XCircle className="h-3 w-3" /> Rejeitada
                      </span>
                    )}
                    {row.aprovada_kb === null && (
                      <span className="inline-flex items-center gap-1" style={{ color: "hsl(35 80% 40%)" }}>
                        Pendente
                      </span>
                    )}
                  </div>
                </header>

                <div className="p-4 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: "hsl(220 10% 55%)" }}>
                      <MessageCircle className="h-3 w-3" /> Pergunta do cliente
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(220 20% 20%)" }}>
                      {row.pergunta}
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: "hsl(220 10% 55%)" }}>
                      <Bot className="h-3 w-3" /> Resposta da IA
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg p-3 border"
                      style={{ color: "hsl(220 20% 18%)", background: "hsl(220 14% 98%)", borderColor: "hsl(220 13% 93%)" }}>
                      {row.content}
                    </div>
                  </div>

                  {chips.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest mb-1.5 flex items-center gap-1.5" style={{ color: "hsl(220 10% 55%)" }}>
                        <BookOpen className="h-3 w-3" /> Fontes usadas
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map((c, i) => (
                          <span key={i}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
                            style={
                              c.kind === "aprendizado"
                                ? { background: "hsl(352 33% 97%)", color: "hsl(352 60% 30%)", borderColor: "hsl(352 33% 88%)" }
                                : c.kind === "legislacao"
                                ? { background: "hsl(220 14% 96%)", color: "hsl(220 30% 25%)", borderColor: "hsl(220 13% 88%)" }
                                : { background: "#fff", color: "hsl(220 20% 30%)", borderColor: "hsl(220 13% 88%)" }
                            }
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {row.aprovada_kb === null && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => executar(row.id, "aprovar")}
                        style={{ background: "hsl(150 55% 32%)", color: "#fff" }}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                        Aprovar e aprender
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => executar(row.id, "rejeitar")}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}