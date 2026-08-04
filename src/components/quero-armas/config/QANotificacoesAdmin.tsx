import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bell, Loader2, CheckCircle2, Search, Plus, AlertTriangle, Info, RefreshCw, Trash2,
} from "lucide-react";

type NotificacaoRow = {
  id: string;
  cliente_id: number;
  categoria: string;
  urgencia: "urgente" | "normal";
  titulo: string;
  mensagem: string;
  link: string | null;
  origem: "auto" | "manual";
  ativa: boolean;
  created_at: string;
  expira_em: string | null;
  cliente_nome?: string;
};

type ClienteBusca = { id: number; nome_completo: string; cpf: string | null };
type ProcessoOpcao = { id: string; servico_nome: string | null; status: string | null };
type DocumentoOpcao = { id: string; tipo_documento: string | null; nome_documento: string | null };

const CATEGORIA_LABEL: Record<string, string> = {
  contrato_pendente: "Contrato pendente",
  exame_psicologico: "Exame psicológico",
  exame_tiro: "Exame de tiro",
  cr: "CR",
  craf: "CRAF",
  gte: "GTE",
  autorizacao_compra: "Autorização de compra",
  cadastro_atualizado: "Cadastro atualizado",
  custom: "Manual",
};

/**
 * Rótulo → coluna em qa_clientes. Espelha ROTULO_CAMPO da função
 * qa-cliente-atualizar-cadastro. Permite mostrar, na tela da equipe, o que o
 * cliente efetivamente escreveu em cada campo antes de excluir o aviso.
 */
const ROTULO_PARA_COLUNA: Record<string, string> = {
  "Nome": "nome_completo",
  "Nome completo": "nome_completo",
  "Data de nascimento": "data_nascimento",
  "Sexo": "sexo",
  "Estado civil": "estado_civil",
  "Nacionalidade": "nacionalidade",
  "Naturalidade — município": "naturalidade_municipio",
  "Naturalidade — UF": "naturalidade_uf",
  "Naturalidade": "naturalidade",
  "Nome da mãe": "nome_mae",
  "Nome do pai": "nome_pai",
  "Celular": "celular",
  "CEP": "cep",
  "Logradouro": "endereco",
  "Número": "numero",
  "Complemento": "complemento",
  "Bairro": "bairro",
  "Cidade": "cidade",
  "Estado (UF)": "estado",
  "Profissão": "profissao",
  "Escolaridade": "escolaridade",
  "RG / CIN": "rg",
  "Órgão emissor do RG": "emissor_rg",
  "UF do emissor do RG": "uf_emissor_rg",
  "Data de expedição do RG": "expedicao_rg",
  "Tipo do documento de identidade": "tipo_documento_identidade",
  "Título de eleitor": "titulo_eleitor",
};

/** Extrai os rótulos citados na mensagem "…foi atualizada: A, B." */
function rotulosDaMensagem(mensagem: string): string[] {
  const corpo = mensagem.split(":").slice(1).join(":");
  if (!corpo) return [];
  return corpo
    .replace(/\.$/, "")
    .split(/·|,/)
    .map((p) => p.split("→")[0].split(":")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export default function QANotificacoesAdmin() {
  const [notificacoes, setNotificacoes] = useState<NotificacaoRow[]>([]);
  // Valores atuais no cadastro dos clientes citados em avisos de cadastro.
  const [cadastroAtual, setCadastroAtual] = useState<Record<number, Record<string, any>>>({});
  const [carregando, setCarregando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  // Criação manual
  const [buscaCliente, setBuscaCliente] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<ClienteBusca[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null);
  const [processos, setProcessos] = useState<ProcessoOpcao[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoOpcao[]>([]);
  const [referenciaTipo, setReferenciaTipo] = useState<"nenhuma" | "processo" | "documento">("nenhuma");
  const [referenciaId, setReferenciaId] = useState<string>("");
  const [form, setForm] = useState({ titulo: "", mensagem: "", link: "", urgencia: "normal" as "urgente" | "normal" });
  const [isTeste, setIsTeste] = useState(false);
  // Prazo de exibição: até que a exigência seja cumprida (padrão) ou por
  // um período determinado (24h, 7d, 30d, data específica).
  const [prazoTipo, setPrazoTipo] = useState<"ate_resolver" | "24h" | "7d" | "30d" | "data">("ate_resolver");
  const [prazoData, setPrazoData] = useState<string>("");
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("qa_notificacoes_cliente" as any)
        .select("id, cliente_id, categoria, urgencia, titulo, mensagem, link, origem, ativa, created_at, expira_em")
        .eq("ativa", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as unknown as NotificacaoRow[];
      const clienteIds = [...new Set(rows.map((r) => r.cliente_id))];
      const { data: clientes } = clienteIds.length
        ? await supabase.from("qa_clientes" as any).select("id, nome_completo").in("id", clienteIds)
        : { data: [] as any[] };
      const nomeMap = new Map(((clientes ?? []) as any[]).map((c) => [c.id, c.nome_completo]));
      setNotificacoes(rows.map((r) => ({ ...r, cliente_nome: nomeMap.get(r.cliente_id) ?? `Cliente #${r.cliente_id}` })));

      // Para avisos de cadastro, carrega o registro completo do cliente para
      // exibir o que está gravado hoje em cada campo citado.
      const idsCadastro = [...new Set(rows.filter((r) => r.categoria === "cadastro_atualizado").map((r) => r.cliente_id))];
      if (idsCadastro.length) {
        const { data: full } = await supabase.from("qa_clientes" as any).select("*").in("id", idsCadastro);
        const mapa: Record<number, Record<string, any>> = {};
        for (const c of ((full ?? []) as any[])) mapa[c.id] = c;
        setCadastroAtual(mapa);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar notificações: " + (e?.message || ""));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const termo = buscaCliente.trim();
    if (termo.length < 3) { setResultadosBusca([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, cpf")
        .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%`)
        .limit(8);
      setResultadosBusca((data ?? []) as unknown as ClienteBusca[]);
    }, 300);
    return () => clearTimeout(t);
  }, [buscaCliente]);

  useEffect(() => {
    if (!clienteSelecionado) { setProcessos([]); setDocumentos([]); return; }
    (async () => {
      const [{ data: procs }, { data: docs }] = await Promise.all([
        supabase.from("qa_processos" as any).select("id, servico_nome, status").eq("cliente_id", clienteSelecionado.id).limit(50),
        supabase.from("qa_documentos_cliente" as any).select("id, tipo_documento, nome_documento").eq("qa_cliente_id", clienteSelecionado.id).limit(50),
      ]);
      setProcessos((procs ?? []) as unknown as ProcessoOpcao[]);
      setDocumentos((docs ?? []) as unknown as DocumentoOpcao[]);
    })();
  }, [clienteSelecionado]);

  async function resolverManualmente(id: string) {
    setResolvendo(id);
    try {
      const { error } = await supabase
        .from("qa_notificacoes_cliente" as any)
        .update({ ativa: false, resolvida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Notificação marcada como resolvida");
      setNotificacoes((prev) => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao resolver");
    } finally {
      setResolvendo(null);
    }
  }

  async function excluirNotificacao(id: string) {
    if (!confirm("Excluir esta notificação de forma definitiva? Ela deixará de aparecer para o cliente imediatamente.")) return;
    setExcluindo(id);
    try {
      const { error } = await supabase
        .from("qa_notificacoes_cliente" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Notificação excluída");
      setNotificacoes((prev) => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    } finally {
      setExcluindo(null);
    }
  }

  async function criarNotificacaoManual() {
    if (!clienteSelecionado) { toast.error("Selecione um cliente"); return; }
    if (!form.titulo.trim() || !form.mensagem.trim()) { toast.error("Título e mensagem são obrigatórios"); return; }
    setCriando(true);
    try {
      const refTabela = referenciaTipo === "processo" ? "qa_processos" : referenciaTipo === "documento" ? "qa_documentos_cliente" : null;
      const refId = referenciaTipo === "nenhuma" ? crypto.randomUUID() : referenciaId;
      if (referenciaTipo !== "nenhuma" && !referenciaId) { toast.error("Selecione o processo/documento de referência"); setCriando(false); return; }
      let expira_em: string | null = null;
      const agora = Date.now();
      if (prazoTipo === "24h") expira_em = new Date(agora + 24 * 60 * 60 * 1000).toISOString();
      else if (prazoTipo === "7d") expira_em = new Date(agora + 7 * 24 * 60 * 60 * 1000).toISOString();
      else if (prazoTipo === "30d") expira_em = new Date(agora + 30 * 24 * 60 * 60 * 1000).toISOString();
      else if (prazoTipo === "data") {
        if (!prazoData) { toast.error("Escolha a data limite de exibição"); setCriando(false); return; }
        expira_em = new Date(prazoData + "T23:59:59-03:00").toISOString();
      }
      const { error } = await supabase.from("qa_notificacoes_cliente" as any).insert({
        cliente_id: clienteSelecionado.id,
        categoria: "custom",
        urgencia: form.urgencia,
        titulo: form.titulo.trim(),
        mensagem: form.mensagem.trim(),
        link: form.link.trim() || null,
        referencia_tabela: refTabela,
        referencia_id: refId,
        origem: "manual",
        ativa: true,
        expira_em,
        is_teste: isTeste,
      });
      if (error) throw error;
      toast.success(
        isTeste
          ? "Notificação de TESTE criada — aparece apenas 1x no portal do cliente"
          : "Notificação criada — já aparece no portal do cliente"
      );
      setClienteSelecionado(null);
      setBuscaCliente("");
      setForm({ titulo: "", mensagem: "", link: "", urgencia: "normal" });
      setReferenciaTipo("nenhuma");
      setReferenciaId("");
      setPrazoTipo("ate_resolver");
      setPrazoData("");
      setIsTeste(false);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar notificação");
    } finally {
      setCriando(false);
    }
  }

  const categorias = ["todas", ...Object.keys(CATEGORIA_LABEL)];
  const listaFiltrada = filtroCategoria === "todas" ? notificacoes : notificacoes.filter((n) => n.categoria === filtroCategoria);

  return (
    <div className="space-y-5">
      {/* Lista de notificações ativas */}
      <div className="qa-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
              Notificações ativas ({listaFiltrada.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="h-8 text-[11px] rounded-md border px-2 bg-white"
              style={{ borderColor: "hsl(220 13% 91%)" }}
            >
              {categorias.map((c) => (
                <option key={c} value={c}>{c === "todas" ? "Todas as categorias" : CATEGORIA_LABEL[c]}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={carregar} className="h-8 text-[11px] gap-1">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </Button>
          </div>
        </div>

        {carregando ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : listaFiltrada.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "hsl(220 10% 62%)" }}>Nenhuma notificação ativa nessa categoria.</p>
        ) : (
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
            {listaFiltrada.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: "hsl(220 13% 91%)" }}>
                {n.urgencia === "urgente"
                  ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  : <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>{n.cliente_nome}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-slate-50 text-slate-600 border-slate-200">
                      {CATEGORIA_LABEL[n.categoria] || n.categoria}
                    </span>
                    {n.origem === "manual" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-purple-50 text-purple-700 border-purple-200">manual</span>
                    )}
                  </div>
                  <p className="text-[12px] font-medium mt-0.5" style={{ color: "hsl(220 20% 25%)" }}>{n.titulo}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>{n.mensagem}</p>
                  <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 70%)" }}>
                    Criada: {fmt(n.created_at)}
                    {n.expira_em ? ` · Expira: ${fmt(n.expira_em)}` : " · Sem prazo (até resolver)"}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm" variant="ghost"
                    disabled={resolvendo === n.id}
                    onClick={() => resolverManualmente(n.id)}
                    className="text-[11px] gap-1 h-7 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                  >
                    {resolvendo === n.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Resolver
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    disabled={excluindo === n.id}
                    onClick={() => excluirNotificacao(n.id)}
                    className="text-[11px] gap-1 h-7 text-red-700 hover:text-red-800 hover:bg-red-50"
                  >
                    {excluindo === n.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Criar notificação manual */}
      <div className="qa-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Plus className="h-4 w-4" style={{ color: "hsl(352 60% 30%)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 45%)" }}>
            Criar notificação manual
          </span>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "hsl(220 10% 62%)" }}>
          Para casos que não se encaixam nas regras automáticas (contrato, exames, CR/CRAF/GTE, autorização) —
          atrele a um processo ou documento já existente do cliente, se aplicável.
        </p>

        <div className="space-y-3">
          <div className="relative">
            <Label className="text-[10px] uppercase mb-1 block">Cliente</Label>
            {clienteSelecionado ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-slate-50" style={{ borderColor: "hsl(220 13% 91%)" }}>
                <span className="text-xs font-medium">{clienteSelecionado.nome_completo}</span>
                <button onClick={() => { setClienteSelecionado(null); setBuscaCliente(""); }} className="text-[11px] text-slate-500 hover:text-slate-800">
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar por nome ou CPF (mín. 3 caracteres)"
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                {resultadosBusca.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    {resultadosBusca.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setClienteSelecionado(c); setResultadosBusca([]); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex flex-col"
                      >
                        <span className="font-medium">{c.nome_completo}</span>
                        {c.cpf && <span className="text-[10px] text-slate-400">{c.cpf}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {clienteSelecionado && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Atrelar a (opcional)</Label>
              <div className="flex gap-2">
                <select
                  value={referenciaTipo}
                  onChange={(e) => { setReferenciaTipo(e.target.value as any); setReferenciaId(""); }}
                  className="h-9 text-xs rounded-md border px-2 bg-white"
                  style={{ borderColor: "hsl(220 13% 91%)" }}
                >
                  <option value="nenhuma">Nenhum (notificação avulsa)</option>
                  <option value="processo">Processo</option>
                  <option value="documento">Documento do Arsenal</option>
                </select>
                {referenciaTipo === "processo" && (
                  <select value={referenciaId} onChange={(e) => setReferenciaId(e.target.value)} className="h-9 text-xs rounded-md border px-2 bg-white flex-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <option value="">Selecione o processo</option>
                    {processos.map((p) => <option key={p.id} value={p.id}>{p.servico_nome || p.id} ({p.status})</option>)}
                  </select>
                )}
                {referenciaTipo === "documento" && (
                  <select value={referenciaId} onChange={(e) => setReferenciaId(e.target.value)} className="h-9 text-xs rounded-md border px-2 bg-white flex-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <option value="">Selecione o documento</option>
                    {documentos.map((d) => <option key={d.id} value={d.id}>{d.nome_documento || d.tipo_documento || d.id}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Urgência</Label>
              <select
                value={form.urgencia}
                onChange={(e) => setForm((f) => ({ ...f, urgencia: e.target.value as any }))}
                className="h-9 w-full text-xs rounded-md border px-2 bg-white"
                style={{ borderColor: "hsl(220 13% 91%)" }}
              >
                <option value="normal">Normal</option>
                <option value="urgente">Urgente (reaparece a cada 10min até resolver)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Link (opcional)</Label>
              <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="/area-do-cliente/..." className="h-9 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} className="h-9 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Mensagem</Label>
            <textarea
              value={form.mensagem}
              onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-xs resize-y"
              style={{ borderColor: "hsl(220 13% 91%)" }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Prazo de exibição</Label>
              <select
                value={prazoTipo}
                onChange={(e) => setPrazoTipo(e.target.value as any)}
                className="h-9 w-full text-xs rounded-md border px-2 bg-white"
                style={{ borderColor: "hsl(220 13% 91%)" }}
              >
                <option value="ate_resolver">Até que a exigência seja cumprida (padrão)</option>
                <option value="24h">Por 24 horas</option>
                <option value="7d">Por 7 dias</option>
                <option value="30d">Por 30 dias</option>
                <option value="data">Até data específica</option>
              </select>
              <p className="text-[10px] mt-1" style={{ color: "hsl(220 10% 62%)" }}>
                Após o prazo, a notificação some do portal do cliente automaticamente.
              </p>
            </div>
            {prazoTipo === "data" && (
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Data limite</Label>
                <Input
                  type="date"
                  value={prazoData}
                  onChange={(e) => setPrazoData(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}
          </div>

          <div
            className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
            style={{ borderColor: isTeste ? "hsl(38 92% 50%)" : "hsl(220 13% 91%)", background: isTeste ? "hsl(48 100% 96%)" : "white" }}
          >
            <input
              id="notif-teste"
              type="checkbox"
              checked={isTeste}
              onChange={(e) => setIsTeste(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="notif-teste" className="text-[11px] leading-relaxed cursor-pointer" style={{ color: "hsl(220 20% 25%)" }}>
              <span className="font-semibold uppercase">Notificação de teste</span> — aparece <strong>apenas 1 vez</strong> no
              portal do cliente e é desativada automaticamente após a primeira exibição. Use para validar template e envio sem
              deixar aviso residual na tela do cliente.
            </label>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={criarNotificacaoManual}
              disabled={criando}
              className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-9"
            >
              {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Criar notificação
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
