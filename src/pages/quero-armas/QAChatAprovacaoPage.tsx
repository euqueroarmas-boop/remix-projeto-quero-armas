import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  Bot,
  BookOpen,
  Pencil,
  Copy,
  Sparkles,
  Send,
  CornerDownLeft,
} from "lucide-react";

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
  conteudo_corrigido: string | null;
};

type RefineMsg = { role: "user" | "assistant"; content: string };

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");

  // Rejeição com motivo
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectDraft, setRejectDraft] = useState<string>("");

  // Refinamento com IA
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refineMessages, setRefineMessages] = useState<RefineMsg[]>([]);
  const [refineInput, setRefineInput] = useState<string>("");
  const [refineStreaming, setRefineStreaming] = useState(false);
  const refineAbortRef = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("qa_chat_mensagens")
        .select("id, sessao_id, cliente_id, content, fontes, created_at, aprovada_kb, aprovada_em, doc_kb_id, conteudo_corrigido")
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
        conteudo_corrigido: m.conteudo_corrigido ?? null,
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

  const executar = async (
    mensagem_id: string,
    acao: "aprovar" | "rejeitar",
    conteudo_corrigido?: string,
    motivo_rejeicao?: string,
  ) => {
    setPendingId(mensagem_id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-chat-aprovar-resposta", {
        body: {
          mensagem_id,
          acao,
          ...(conteudo_corrigido ? { conteudo_corrigido } : {}),
          ...(motivo_rejeicao ? { motivo_rejeicao } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (acao === "aprovar") {
        toast.success(
          conteudo_corrigido
            ? "Correção salva e aprovada — a IA já consulta essa versão."
            : "Resposta aprovada — a IA já consulta esse conhecimento.",
        );
      }
      else toast.success("Resposta rejeitada — não será usada como referência.");
      setEditingId(null);
      setEditDraft("");
      setRejectingId(null);
      setRejectDraft("");
      await Promise.all([carregar(), carregarContagem()]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na operação");
    } finally {
      setPendingId(null);
    }
  };

  const copiarTudo = async (row: LinhaFila) => {
    const fontesArr = Array.isArray(row.fontes) ? row.fontes : [];
    const fontesTxt = fontesArr
      .map((f: any) => "• " + (f?.titulo_norma || f?.titulo_doc || f?.titulo || "Fonte"))
      .join("\n") || "—";
    const texto = [
      "PERGUNTA DO CLIENTE:",
      row.pergunta,
      "",
      "RESPOSTA DO KLAL:",
      row.content,
      "",
      "FONTES USADAS:",
      fontesTxt,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado — cole no chat para refinar.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const abrirRefinamento = (row: LinhaFila) => {
    setRefiningId(row.id);
    const fontesArr = Array.isArray(row.fontes) ? row.fontes : [];
    const fontesTxt = fontesArr
      .map((f: any) => "• " + (f?.titulo_norma || f?.titulo_doc || f?.titulo || "Fonte"))
      .join("\n") || "—";
    const contextoInicial = [
      `**Pergunta original do cliente:**\n${row.pergunta}`,
      `**Minha resposta original:**\n${row.content}`,
      `**Fontes que usei:**\n${fontesTxt}`,
      "",
      "Diga o que precisa corrigir ou aprofundar — vou tentar de novo.",
    ].join("\n\n");
    setRefineMessages([{ role: "assistant", content: contextoInicial }]);
    setRefineInput("");
  };

  const fecharRefinamento = () => {
    try { refineAbortRef.current?.abort(); } catch { /* noop */ }
    setRefiningId(null);
    setRefineMessages([]);
    setRefineInput("");
    setRefineStreaming(false);
  };

  const enviarRefinamento = async (row: LinhaFila) => {
    const orientacao = refineInput.trim();
    if (!orientacao || refineStreaming) return;

    const historico: RefineMsg[] = [
      { role: "user", content: row.pergunta },
      { role: "assistant", content: row.content },
      { role: "user", content: orientacao },
    ];

    setRefineMessages((prev) => [...prev, { role: "user", content: orientacao }]);
    setRefineInput("");
    setRefineStreaming(true);

    let assistantIndex = -1;
    setRefineMessages((prev) => {
      assistantIndex = prev.length;
      return [...prev, { role: "assistant", content: "" }];
    });

    const controller = new AbortController();
    refineAbortRef.current = controller;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-kb-search-cliente`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)}`,
        },
        body: JSON.stringify({
          query: orientacao,
          historico,
          modo_refinamento: true,
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed?.type === "token" && typeof parsed.content === "string") {
              full += parsed.content;
              setRefineMessages((prev) => {
                const next = [...prev];
                if (assistantIndex >= 0 && next[assistantIndex]) {
                  next[assistantIndex] = { role: "assistant", content: full };
                }
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
      if (!full.trim()) {
        setRefineMessages((prev) => {
          const next = [...prev];
          if (assistantIndex >= 0) next[assistantIndex] = { role: "assistant", content: "(sem resposta)" };
          return next;
        });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Falha ao refinar");
    } finally {
      setRefineStreaming(false);
      refineAbortRef.current = null;
    }
  };

  const usarRespostaRefinada = (conteudo: string) => {
    if (!refiningId) return;
    setEditingId(refiningId);
    setEditDraft(conteudo);
    fecharRefinamento();
    toast.success("Resposta carregada no editor — revise e aprove.");
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
                    {row.cliente_nome ? row.cliente_nome.toUpperCase() : "Cliente"} · {new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
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
                    {editingId === row.id ? (
                      <Textarea
                        value={editDraft}
                        onChange={(e) => {
                          setEditDraft(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        className="text-sm leading-relaxed"
                        style={{ color: "hsl(220 20% 18%)", background: "#fff", borderColor: "hsl(352 33% 80%)" }}
                      />
                    ) : (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg p-3 border"
                        style={{ color: "hsl(220 20% 18%)", background: "hsl(220 14% 98%)", borderColor: "hsl(220 13% 93%)" }}>
                        {row.content}
                      </div>
                    )}
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

                  {row.conteudo_corrigido && (
                    <div className="text-[11px] inline-flex items-center gap-1" style={{ color: "hsl(352 60% 30%)" }}>
                      <Pencil className="h-3 w-3" /> Corrigida pela equipe
                    </div>
                  )}

                  {row.aprovada_kb === null && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
                      {editingId === row.id ? (
                        <>
                          <Button
                            size="sm"
                            disabled={isPending || !editDraft.trim()}
                            onClick={() => executar(row.id, "aprovar", editDraft.trim())}
                            style={{ background: "hsl(150 55% 32%)", color: "#fff" }}
                          >
                            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                            Salvar correção e aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => { setEditingId(null); setEditDraft(""); }}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : rejectingId === row.id ? (
                        <div className="w-full space-y-2">
                          <Textarea
                            value={rejectDraft}
                            onChange={(e) => setRejectDraft(e.target.value)}
                            placeholder="Por que essa resposta está errada? (opcional mas recomendado)"
                            className="text-sm"
                            style={{ background: "#fff", borderColor: "hsl(0 40% 80%)" }}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={() => executar(row.id, "rejeitar", undefined, rejectDraft.trim() || undefined)}
                              style={{ background: "hsl(0 60% 45%)", color: "#fff" }}
                            >
                              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                              Confirmar rejeição
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={() => { setRejectingId(null); setRejectDraft(""); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                            onClick={() => { setEditingId(row.id); setEditDraft(row.content); }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Corrigir e aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => abrirRefinamento(row)}
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Refinar com IA
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => { setRejectingId(row.id); setRejectDraft(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => copiarTudo(row)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            Copiar tudo
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {refiningId === row.id && (
                    <div
                      className="mt-3 rounded-lg border overflow-hidden"
                      style={{ borderColor: "hsl(352 33% 85%)", background: "hsl(352 33% 98%)" }}
                    >
                      <div
                        className="px-3 py-2 border-b flex items-center justify-between"
                        style={{ borderColor: "hsl(352 33% 88%)", background: "hsl(352 33% 96%)" }}
                      >
                        <div className="text-[11px] uppercase tracking-widest flex items-center gap-1.5" style={{ color: "hsl(352 60% 30%)" }}>
                          <Sparkles className="h-3 w-3" />
                          Refinamento com Klal — use este chat para chegar na resposta certa antes de aprovar.
                        </div>
                        <button
                          onClick={fecharRefinamento}
                          className="text-[11px] underline"
                          style={{ color: "hsl(220 10% 45%)" }}
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                        {refineMessages.map((m, i) => (
                          <div
                            key={i}
                            className="rounded-md p-2.5 text-sm whitespace-pre-wrap"
                            style={
                              m.role === "user"
                                ? { background: "hsl(220 14% 96%)", color: "hsl(220 20% 20%)" }
                                : { background: "#fff", color: "hsl(220 20% 18%)", border: "1px solid hsl(220 13% 90%)" }
                            }
                          >
                            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "hsl(220 10% 55%)" }}>
                              {m.role === "user" ? "Equipe" : "Klal"}
                            </div>
                            {m.content || (refineStreaming && i === refineMessages.length - 1 ? "…" : "")}
                            {m.role === "assistant" && i > 0 && m.content.trim() && !refineStreaming && (
                              <div className="pt-2 mt-2 border-t flex" style={{ borderColor: "hsl(220 13% 90%)" }}>
                                <Button
                                  size="sm"
                                  onClick={() => usarRespostaRefinada(m.content)}
                                  style={{ background: "hsl(150 55% 32%)", color: "#fff" }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                  Usar esta resposta
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div
                        className="p-2 border-t flex gap-2"
                        style={{ borderColor: "hsl(352 33% 88%)", background: "#fff" }}
                      >
                        <Input
                          value={refineInput}
                          onChange={(e) => setRefineInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              enviarRefinamento(row);
                            }
                          }}
                          disabled={refineStreaming}
                          placeholder="Ex.: essa resposta está errada sobre o prazo. O correto é 180 dias conforme..."
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={refineStreaming || !refineInput.trim()}
                          onClick={() => enviarRefinamento(row)}
                          style={{ background: "hsl(352 60% 30%)", color: "#fff" }}
                        >
                          {refineStreaming ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="px-3 pb-2 text-[10px] flex items-center gap-1" style={{ color: "hsl(220 10% 55%)" }}>
                        <CornerDownLeft className="h-3 w-3" /> Enter para enviar · Shift+Enter para quebrar linha
                      </div>
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