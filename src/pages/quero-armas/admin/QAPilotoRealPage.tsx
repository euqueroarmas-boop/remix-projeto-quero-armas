/**
 * Piloto Real Quero Armas — Contratação Assistida pela Equipe
 *
 * Wizard admin que orquestra o fluxo real de venda→contrato→liberação
 * usando SOMENTE Edge Functions oficiais. Nenhum INSERT/UPDATE manual
 * é feito daqui. Todas as ações geram trilha em qa_venda_eventos /
 * qa_pagamento_auditoria / qa_contract_events / qa_processo_eventos.
 *
 * Passos:
 *  1. Selecionar cliente real (qa_clientes)
 *  2. Selecionar serviço (qa_servicos_catalogo)
 *  3. Criar venda (qa-checkout-criar-venda)
 *  4. Aprovar valor (RPC qa_venda_aprovar_valor)
 *  5. Confirmar pagamento manual + comprovante (qa-venda-confirmar-pagamento-manual)
 *  6. Acompanhar contrato → assinatura cliente → liberação
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Search, User, CheckCircle2, Circle, ArrowRight, ArrowLeft, ShieldAlert,
  Upload, FileText, Copy, Check, ExternalLink, RefreshCw, Archive, FlaskConical,
  History, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";

type Cliente = { id: number; id_legado: number | null; nome_completo: string; cpf: string | null; email: string | null; celular: string | null; user_id: string | null };
type Servico = { id: string; slug: string; nome: string; preco: number | null; ativo: boolean };
type Venda = { id: number; id_legado: number | null; cliente_id: number; status: string | null; status_validacao_valor: string | null; cobranca_status: string | null; valor_a_pagar: number | string | null; forma_pagamento: string | null };
type Contrato = { id: string; status: string; venda_id: number; cliente_id: number };
type Processo = { id: string; venda_id: number | null; servico_id: number | null; status: string | null };
type PilotoResumo = {
  venda_id: number;
  id_legado: number | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  valor_a_pagar: number | string | null;
  status: string | null;
  cobranca_status: string | null;
  status_validacao_valor: string | null;
  contrato_status: string | null;
  ultimo_evento: string | null;
  ultimo_evento_at: string | null;
  arquivado?: boolean;
  arquivado_em?: string | null;
};

const PILOTO_LS_KEY = "qa_piloto_ultimo_venda_id";
const PILOTO_SESSION_LS_KEY = "qa_piloto_session_id";

const FORMAS_MANUAL = [
  "PIX", "BOLETO", "CARTÃO DE CRÉDITO", "CARTÃO DE DÉBITO", "DINHEIRO", "TRANSFERÊNCIA", "OUTRO",
] as const;

function money(v: unknown): string {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusDot(state: "done" | "pending" | "current" | "blocked") {
  const map = {
    done: "bg-emerald-500",
    current: "bg-amber-400 animate-pulse",
    pending: "bg-neutral-300",
    blocked: "bg-rose-500",
  } as const;
  return <span className={`inline-block h-2 w-2 rounded-full ${map[state]}`} />;
}

export default function QAPilotoRealPage() {
  const { user, profile } = useQAAuthContext();

  /* ---------- Retomada de piloto (URL / localStorage) ---------- */
  const [hidratando, setHidratando] = useState(false);
  const [hidratado, setHidratado] = useState<{ venda_id: number; via: "url" | "storage" } | null>(null);
  const [resumos, setResumos] = useState<PilotoResumo[]>([]);
  const [carregandoResumos, setCarregandoResumos] = useState(false);
  const [ultimoLocal, setUltimoLocal] = useState<number | null>(null);
  const stepRefs = useRef<Record<string, HTMLElement | null>>({});
  const setStepRef = (key: string) => (el: HTMLElement | null) => { stepRefs.current[key] = el; };
  const staffEmail = useMemo(() => (profile as any)?.email || (user as any)?.email || null, [profile, user]);

  /* ---------- Passo 1: Cliente ---------- */
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidatos, setCandidatos] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const buscarCliente = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const cpfDigits = q.replace(/\D/g, "");
      const filtro = cpfDigits.length >= 6
        ? `cpf.ilike.%${cpfDigits}%`
        : `nome_completo.ilike.%${q}%,email.ilike.%${q}%`;
      const { data, error } = await supabase
        .from("qa_clientes")
        .select("id, id_legado, nome_completo, cpf, email, celular, user_id")
        .neq("status", "excluido_lgpd")
        .or(filtro)
        .order("id", { ascending: false })
        .limit(15);
      if (error) throw error;
      setCandidatos((data ?? []) as Cliente[]);
    } catch (e: any) {
      toast.error(`Falha na busca: ${e?.message || e}`);
    } finally {
      setSearching(false);
    }
  }, [query]);

  /* ---------- Passo 2: Serviço ---------- */
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servico, setServico] = useState<Servico | null>(null);
  const [servicoQ, setServicoQ] = useState("");
  const [carregandoServicos, setCarregandoServicos] = useState(false);

  /* ---------- Passo 2b: Itens adicionais do pacote ---------- */
  type ItemExtra = { servico: Servico; precoStr: string };
  const [itensExtras, setItensExtras] = useState<ItemExtra[]>([]);
  const [extraPickerAberto, setExtraPickerAberto] = useState(false);
  const [extraQ, setExtraQ] = useState("");

  const parseMoney = (s: string): number => {
    const v = (s || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const fmtMoneyInput = (n: number | null | undefined): string =>
    n != null && Number.isFinite(Number(n))
      ? Number(n).toFixed(2).replace(".", ",")
      : "";

  useEffect(() => {
    (async () => {
      setCarregandoServicos(true);
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("id, slug, nome, preco, ativo")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      setServicos((data ?? []) as Servico[]);
      setCarregandoServicos(false);
    })();
  }, []);

  const servicosFiltrados = useMemo(() => {
    const q = servicoQ.trim().toLowerCase();
    if (!q) return servicos.slice(0, 30);
    return servicos.filter((s) => s.nome.toLowerCase().includes(q) || s.slug.includes(q)).slice(0, 30);
  }, [servicos, servicoQ]);

  const servicosExtraFiltrados = useMemo(() => {
    const usados = new Set<string>([servico?.id ?? "", ...itensExtras.map((i) => i.servico.id)]);
    const q = extraQ.trim().toLowerCase();
    const base = servicos.filter((s) => !usados.has(s.id));
    if (!q) return base.slice(0, 30);
    return base.filter((s) => s.nome.toLowerCase().includes(q) || s.slug.includes(q)).slice(0, 30);
  }, [servicos, servico?.id, itensExtras, extraQ]);

  /* ---------- Passo 3: Venda ---------- */
  const [venda, setVenda] = useState<Venda | null>(null);
  const [criandoVenda, setCriandoVenda] = useState(false);

  /* ---------- Auditoria Piloto: sessão + logger ---------- */
  const [pilotoSessionId, setPilotoSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (pilotoSessionId) return;
    let sid: string | null = null;
    try { sid = localStorage.getItem(PILOTO_SESSION_LS_KEY); } catch {}
    if (!sid) {
      sid = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try { localStorage.setItem(PILOTO_SESSION_LS_KEY, sid); } catch {}
    }
    setPilotoSessionId(sid);
  }, [pilotoSessionId]);
  const vendaRef = useRef<Venda | null>(null);
  useEffect(() => { vendaRef.current = venda; }, [venda]);
  const logPilotoEvento = useCallback(async (tipo: string, dados: Record<string, unknown> = {}) => {
    try {
      if (!pilotoSessionId) return;
      const v = vendaRef.current;
      await supabase.from("qa_piloto_eventos").insert({
        piloto_session_id: pilotoSessionId,
        venda_id: v?.id ?? null,
        venda_id_legado: (v as any)?.id_legado ?? null,
        tipo_evento: tipo,
        dados_json: dados as any,
        staff_user_id: user?.id ?? null,
        staff_email: staffEmail,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[piloto-eventos] insert falhou", (e as any)?.message || e);
    }
  }, [pilotoSessionId, user?.id, staffEmail]);
  const backlinkPilotoEventos = useCallback(async (vId: number, vIdLegado: number | null) => {
    try {
      if (!pilotoSessionId) return;
      await supabase
        .from("qa_piloto_eventos")
        .update({ venda_id: vId, venda_id_legado: vIdLegado ?? null })
        .eq("piloto_session_id", pilotoSessionId)
        .is("venda_id", null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[piloto-eventos] backlink falhou", (e as any)?.message || e);
    }
  }, [pilotoSessionId]);

  // piloto_iniciado: dispara uma vez por sessão quando NÃO estamos em piloto restaurado.
  const iniciadoLogadoRef = useRef(false);
  useEffect(() => {
    if (iniciadoLogadoRef.current) return;
    if (!pilotoSessionId) return;
    if (hidratando) return;
    if (venda) return; // Piloto restaurado — não é "iniciado".
    iniciadoLogadoRef.current = true;
    const params = new URLSearchParams(window.location.search);
    logPilotoEvento("piloto_iniciado", {
      origem: "wizard_piloto_real",
      via: params.get("venda_id") || params.get("id_legado") ? "url" : "novo",
    });
  }, [pilotoSessionId, hidratando, venda, logPilotoEvento]);

  // cliente_selecionado / troca de cliente (antes da venda).
  const clienteAnteriorRef = useRef<Cliente | null>(null);
  useEffect(() => {
    if (!pilotoSessionId || hidratando || venda) return;
    const prev = clienteAnteriorRef.current;
    if (cliente && (!prev || prev.id !== cliente.id)) {
      logPilotoEvento("cliente_selecionado", {
        cliente_id: cliente.id,
        cliente_id_legado: cliente.id_legado,
        nome: cliente.nome_completo,
        cpf: cliente.cpf,
        email: cliente.email,
        cliente_anterior: prev ? { cliente_id: prev.id, nome: prev.nome_completo } : null,
      });
    }
    clienteAnteriorRef.current = cliente;
  }, [cliente, pilotoSessionId, hidratando, venda, logPilotoEvento]);

  // servico_principal_selecionado (antes da venda).
  const servicoAnteriorRef = useRef<Servico | null>(null);
  useEffect(() => {
    if (!pilotoSessionId || hidratando || venda) return;
    const prev = servicoAnteriorRef.current;
    if (servico && (!prev || prev.id !== servico.id)) {
      logPilotoEvento("servico_principal_selecionado", {
        servico_id: servico.id,
        slug: servico.slug,
        nome: servico.nome,
        valor_catalogo: servico.preco,
        servico_anterior: prev ? { servico_id: prev.id, slug: prev.slug, nome: prev.nome } : null,
      });
    }
    servicoAnteriorRef.current = servico;
  }, [servico, pilotoSessionId, hidratando, venda, logPilotoEvento]);

  // servico_adicional_adicionado / removido (antes da venda).
  const extrasIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!pilotoSessionId || hidratando || venda) return;
    const atual = new Set(itensExtras.map((i) => i.servico.id));
    const anteriores = extrasIdsRef.current;
    // adições
    for (const it of itensExtras) {
      if (!anteriores.has(it.servico.id)) {
        logPilotoEvento("servico_adicional_adicionado", {
          servico_id: it.servico.id,
          slug: it.servico.slug,
          nome: it.servico.nome,
          valor_catalogo: it.servico.preco,
          preco_aplicado_str: it.precoStr,
        });
      }
    }
    // remoções
    for (const idAnt of anteriores) {
      if (!atual.has(idAnt)) {
        logPilotoEvento("servico_adicional_removido", { servico_id: idAnt });
      }
    }
    extrasIdsRef.current = atual;
  }, [itensExtras, pilotoSessionId, hidratando, venda, logPilotoEvento]);

  /* ---------- Passo 3b: Preço negociado ---------- */
  const TIPOS_AJUSTE = [
    { v: "promocao", l: "Promoção" },
    { v: "negociacao_individual", l: "Negociação individual" },
    { v: "cortesia_parcial", l: "Cortesia parcial" },
    { v: "complemento", l: "Complemento" },
    { v: "correcao", l: "Correção" },
    { v: "outro", l: "Outro" },
  ] as const;
  const [precoAplicadoStr, setPrecoAplicadoStr] = useState<string>("");
  const [tipoAjuste, setTipoAjuste] = useState<string>("negociacao_individual");
  const [motivoPreco, setMotivoPreco] = useState<string>("");
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);
  const [evidenciaPath, setEvidenciaPath] = useState<string | null>(null);
  const [confirmadoPreco, setConfirmadoPreco] = useState<boolean>(false);

  /* ---------- Passo 3c: Modo de exibição do contrato (pacote vs itens) ---------- */
  type ModoExibicao = "itens_separados" | "pacote_fechado";
  const [modoExibicao, setModoExibicao] = useState<ModoExibicao>("itens_separados");
  const [valorFinalPacoteStr, setValorFinalPacoteStr] = useState<string>("");
  const [motivoPacote, setMotivoPacote] = useState<string>("");
  // Como tratar a diferença entre catálogo e valor final do pacote:
  //  - "ajuste_comercial": desconto/acréscimo pactuado nos serviços → distribui proporcional.
  //  - "custo_financeiro_adquirente": diferença é juros/tarifa da máquina → NÃO distribui;
  //    itens mantêm valores originais do catálogo e a diferença é registrada como custo
  //    financeiro da adquirente (não vira preço dos serviços).
  type TipoDiferenca = "ajuste_comercial" | "custo_financeiro_adquirente";
  const [tipoDiferencaPacote, setTipoDiferencaPacote] = useState<TipoDiferenca>("ajuste_comercial");
  const [adquirentePacote, setAdquirentePacote] = useState<string>("");
  const [parcelasPacote, setParcelasPacote] = useState<number>(1);

  // Custos operacionais embutidos no parcelamento (exames, GRU, taxas de terceiros).
  // NÃO são serviços — não entram em qa_itens_venda. Somam ao "valor contratado"
  // do pacote no contrato (Cláusula 1.A) para que 3.2.2 calcule os juros
  // corretamente: juros = valor_bruto_parcelado − (catálogo serviços + embutidos).
  type CustoEmbutido = { descricao: string; valorStr: string };
  const [custosEmbutidos, setCustosEmbutidos] = useState<CustoEmbutido[]>([]);

  // Snapshot da decisão de exibição do contrato (persistida em qa_venda_eventos).
  // Preenchida na hidratação para que o Passo 2 continue mostrando corretamente
  // "pacote fechado" / "itens separados" depois de fechar e reabrir a aba.
  type ExibicaoContratoSnapshot = {
    modo: "itens_separados" | "pacote_fechado";
    valor_final_pacote: number | null;
    ocultar_precos_individuais_no_contrato: boolean;
  } | null;
  const [exibicaoContratoSnap, setExibicaoContratoSnap] = useState<ExibicaoContratoSnapshot>(null);

  // Ao trocar serviço, sugerimos o preço do catálogo como padrão.
  useEffect(() => {
    if (servico) {
      setPrecoAplicadoStr(
        servico.preco != null ? Number(servico.preco).toFixed(2).replace(".", ",") : "",
      );
      setMotivoPreco("");
      setEvidenciaFile(null);
      setEvidenciaPath(null);
      setConfirmadoPreco(false);
      setTipoAjuste("negociacao_individual");
      setItensExtras([]);
      setExtraPickerAberto(false);
      setExtraQ("");
      setModoExibicao("itens_separados");
      setValorFinalPacoteStr("");
      setMotivoPacote("");
      setTipoDiferencaPacote("ajuste_comercial");
      setAdquirentePacote("");
      setParcelasPacote(1);
      setCustosEmbutidos([]);
    }
  }, [servico?.id]);

  // Preço do item principal
  const precoCatalogoPrincipal = servico?.preco != null ? Number(servico.preco) : 0;
  const precoAplicadoPrincipalInput = parseMoney(precoAplicadoStr);
  const temExtras = itensExtras.length > 0;
  const modoPacote = temExtras && modoExibicao === "pacote_fechado";

  // Preços dos itens extras (validação individual) — usados no modo itens_separados
  const extrasAvaliadosBase = itensExtras.map((ie) => {
    const catalogo = ie.servico.preco != null ? Number(ie.servico.preco) : 0;
    const aplicadoInput = parseMoney(ie.precoStr);
    return { ie, catalogo, aplicadoInput };
  });
  const precoCatalogo =
    precoCatalogoPrincipal + extrasAvaliadosBase.reduce((s, e) => s + e.catalogo, 0);

  // Valor final aplicado no pacote (input do modo pacote OU soma no modo separado).
  const valorFinalPacoteNum = parseMoney(valorFinalPacoteStr);
  const somaSeparados = Number.isFinite(precoAplicadoPrincipalInput)
    ? precoAplicadoPrincipalInput +
      extrasAvaliadosBase.reduce((s, e) => s + (Number.isFinite(e.aplicadoInput) ? e.aplicadoInput : NaN), 0)
    : NaN;

  // Modo pacote + custo financeiro: os SERVIÇOS mantêm valores de catálogo.
  // O valor final digitado representa o total efetivamente cobrado no cartão
  // (serviços + juros/tarifa da adquirente). A diferença NÃO entra em qa_itens_venda.
  const modoPacoteCustoFin =
    modoPacote && tipoDiferencaPacote === "custo_financeiro_adquirente";

  // Custos embutidos válidos (descrição + valor > 0). Só fazem sentido no modo
  // pacote + custo financeiro (repasses de terceiros embutidos no parcelamento).
  const custosEmbutidosValidos = modoPacoteCustoFin
    ? custosEmbutidos
        .map((c) => ({ descricao: c.descricao.trim(), valor: parseMoney(c.valorStr) }))
        .filter((c) => c.descricao.length >= 2 && Number.isFinite(c.valor) && c.valor > 0)
    : [];
  const custosEmbutidosTotal = custosEmbutidosValidos.reduce((s, c) => s + c.valor, 0);

  // Valor total dos SERVIÇOS que vai para qa_itens_venda / total da venda.
  //  - pacote + custo_fin: soma dos preços de catálogo (não muda nada nos itens).
  //  - pacote + ajuste_comercial: valor final do pacote (distribuído entre itens).
  //  - separados: soma dos preços aplicados por item.
  const precoAplicadoNum = modoPacote
    ? (modoPacoteCustoFin ? precoCatalogo : valorFinalPacoteNum)
    : somaSeparados;
  const precoValido = Number.isFinite(precoAplicadoNum) && precoAplicadoNum >= 0;

  // Métricas do "valor final pago" pelo cliente (com juros, se houver).
  const valorFinalPagoCliente = modoPacote
    ? valorFinalPacoteNum
    : somaSeparados;
  const temDiferencaPacote =
    modoPacote &&
    Number.isFinite(valorFinalPacoteNum) &&
    Math.abs(valorFinalPacoteNum - precoCatalogo) > 0.0049;
  const diferencaPacoteValor = modoPacote && Number.isFinite(valorFinalPacoteNum)
    ? Number((valorFinalPacoteNum - precoCatalogo).toFixed(2))
    : 0;
  // Juros/tarifa da adquirente = valor final − (catálogo serviços + custos embutidos).
  // Sem embutidos, comportamento anterior (juros = diferença total) é preservado.
  const custoFinanceiroAdquirente = modoPacoteCustoFin && temDiferencaPacote
    ? Number((diferencaPacoteValor - custosEmbutidosTotal).toFixed(2))
    : 0;
  // "Valor contratado" exibido no contrato (Cláusula 1.A.2 e base do 3.2.2):
  // serviços de catálogo + custos operacionais embutidos.
  const valorContratadoPacote = modoPacoteCustoFin
    ? Number((precoCatalogo + custosEmbutidosTotal).toFixed(2))
    : precoCatalogo;
  const valorParcelaPacote =
    modoPacoteCustoFin && parcelasPacote > 0 && Number.isFinite(valorFinalPacoteNum)
      ? Number((valorFinalPacoteNum / parcelasPacote).toFixed(2))
      : 0;

  // Distribuição proporcional (modo pacote) — itens continuam vinculados à venda
  // mas o contrato oculta os preços individuais. Distribuímos proporcionalmente
  // ao catálogo; se catálogo somar 0, distribuímos igualmente. Última posição
  // absorve o arredondamento para casar exatamente com valorFinalPacoteNum.
  const extrasAvaliados = extrasAvaliadosBase.map((e, idx, arr) => {
    if (!modoPacote) {
      return { ...e, aplicado: e.aplicadoInput, valido: Number.isFinite(e.aplicadoInput) };
    }
    // Custo financeiro: mantém preço de catálogo em cada extra.
    if (modoPacoteCustoFin) {
      return { ...e, aplicado: e.catalogo, valido: true };
    }
    // Ajuste comercial: distribui proporcionalmente entre os itens.
    if (!precoValido) return { ...e, aplicado: NaN, valido: false };
    const cats = [precoCatalogoPrincipal, ...arr.map((x) => x.catalogo)];
    const somaCat = cats.reduce((s, v) => s + v, 0);
    const n = cats.length;
    let val: number;
    if (somaCat > 0) {
      val = Number(((e.catalogo / somaCat) * precoAplicadoNum).toFixed(2));
    } else {
      val = Number((precoAplicadoNum / n).toFixed(2));
    }
    return { ...e, aplicado: val, valido: true };
  });
  // Preço aplicado do item principal:
  //  - custo_fin: preço de catálogo do principal (itens não são alterados).
  //  - ajuste_comercial (pacote): resto para casar o total distribuído.
  //  - separado: valor digitado pelo usuário.
  let precoAplicadoPrincipal = precoAplicadoPrincipalInput;
  if (modoPacoteCustoFin) {
    precoAplicadoPrincipal = precoCatalogoPrincipal;
  } else if (modoPacote && precoValido) {
    const somaExtras = extrasAvaliados.reduce((s, e) => s + (e.aplicado || 0), 0);
    precoAplicadoPrincipal = Number((precoAplicadoNum - somaExtras).toFixed(2));
    if (precoAplicadoPrincipal < 0) precoAplicadoPrincipal = 0;
  }

  // "precoDiferente" mantém a semântica antiga: houve mudança no preço APLICADO
  // aos itens em relação ao catálogo — dispara o bloco de negociação (motivo/tipo
  // ajuste/confirmação/evidência). No modo custo_financeiro isso é FALSO, porque
  // os itens continuam com o preço de catálogo.
  const precoDiferente = precoValido && Math.abs(precoAplicadoNum - precoCatalogo) > 0.0049;
  const diferencaValor = precoValido ? Number((precoAplicadoNum - precoCatalogo).toFixed(2)) : 0;
  const percentualDif = precoCatalogo > 0 && precoValido
    ? Number(((diferencaValor / precoCatalogo) * 100).toFixed(2))
    : 0;
  const percentualDifPacote = modoPacote && precoCatalogo > 0 && Number.isFinite(valorFinalPacoteNum)
    ? Number(((diferencaPacoteValor / precoCatalogo) * 100).toFixed(2))
    : 0;
  const motivoOk = motivoPreco.trim().length >= 20;
  const motivoPacoteOk = motivoPacote.trim().length >= 20;
  // No modo pacote_fechado, se o valor final diferir do catálogo, exigimos:
  //   - motivo do pacote (≥20)
  //   - se custo_financeiro: adquirente + parcelas > 0
  const custoFinCamposOk =
    !modoPacoteCustoFin ||
    (adquirentePacote.trim().length >= 2 && parcelasPacote > 0);
  const podeCriarVenda =
    !!cliente && !!servico && precoValido &&
    (modoPacote
      ? (!temDiferencaPacote || (motivoPacoteOk && custoFinCamposOk))
      : (!precoDiferente || (motivoOk && !!tipoAjuste && confirmadoPreco)));


  const uploadEvidencia = useCallback(async () => {
    if (!evidenciaFile || !cliente || !servico) return null;
    const ext = (evidenciaFile.name.split(".").pop() || "bin").toLowerCase();
    const path = `qa/negociacoes/${cliente.id}/${servico.slug}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("paid-contracts").upload(path, evidenciaFile, {
      contentType: evidenciaFile.type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw error;
    setEvidenciaPath(path);
    return path;
  }, [evidenciaFile, cliente, servico]);

  const criarVenda = useCallback(async () => {
    if (!cliente || !servico) return;
    if (!precoValido) { toast.error("Preço aplicado inválido."); return; }
    if (modoPacote && temDiferencaPacote) {
      if (!motivoPacoteOk) { toast.error("Motivo do pacote obrigatório (mín. 20 caracteres)."); return; }
      if (modoPacoteCustoFin) {
        if (adquirentePacote.trim().length < 2) { toast.error("Informe a adquirente do custo financeiro."); return; }
        if (parcelasPacote <= 0) { toast.error("Informe o número de parcelas."); return; }
      }
    } else if (!modoPacote && precoDiferente) {
      if (!motivoOk) { toast.error("Motivo obrigatório (mín. 20 caracteres)."); return; }
      if (!tipoAjuste) { toast.error("Selecione o tipo de ajuste."); return; }
      if (!confirmadoPreco) { toast.error("Confirme explicitamente o preço negociado."); return; }
    }
    setCriandoVenda(true);
    try {
      // Snapshot do modo de exibição do contrato ANTES de criar a venda.
      if (temExtras) {
        await logPilotoEvento("modo_exibicao_contrato_selecionado", {
          modo: modoExibicao,
          ocultar_precos_individuais: modoPacote,
          valor_final_pacote: modoPacote && Number.isFinite(valorFinalPacoteNum) ? valorFinalPacoteNum : null,
          motivo: modoPacote && temDiferencaPacote ? motivoPacote.trim() : null,
          tipo_diferenca: modoPacote && temDiferencaPacote ? tipoDiferencaPacote : null,
          total_catalogo: precoCatalogo,
          custos_embutidos_total: modoPacoteCustoFin && custosEmbutidosTotal > 0 ? custosEmbutidosTotal : null,
          adquirente: modoPacoteCustoFin ? adquirentePacote.trim().toUpperCase() || null : null,
          parcelas: modoPacoteCustoFin ? parcelasPacote : null,
        });
      }
      let evPath = evidenciaPath;
      if (precoDiferente && evidenciaFile && !evPath) {
        try { evPath = await uploadEvidencia(); } catch (e: any) {
          toast.error(`Falha no upload da evidência: ${e?.message || e}`);
          setCriandoVenda(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("qa-checkout-criar-venda", {
        body: {
          cart: [
            {
              servico_id: servico.id,
              slug: servico.slug,
              quantidade: 1,
              preco_negociado: precoAplicadoPrincipal,
            },
            ...extrasAvaliados.map((e) => ({
              servico_id: e.ie.servico.id,
              slug: e.ie.servico.slug,
              quantidade: 1,
              preco_negociado: e.aplicado,
            })),
          ],
          // Piloto Real: vincula a venda ao CLIENTE selecionado no Passo 1,
          // não ao staff que está logado disparando o wizard.
          target_qa_cliente_id: cliente.id,
          identificacao: {
            nome_completo: cliente.nome_completo,
            cpf: cliente.cpf || "",
            email: cliente.email || "",
            celular: cliente.celular || "",
          },
          negociacao: precoDiferente ? {
            motivo: (modoPacote ? motivoPacote.trim() : motivoPreco.trim()),
            tipo_ajuste: modoPacote ? "negociacao_individual" : tipoAjuste,
            evidencia_path: evPath,
            confirmado: true,
            origem: modoPacote
              ? "piloto_real_pacote_fechado"
              : "piloto_real_preco_negociado",
          } : null,
          exibicao_contrato: temExtras ? {
            modo: modoExibicao,
            // Valor final oficial do pacote no contrato:
            //  - custo_fin: preço dos serviços = total do catálogo
            //  - ajuste_comercial: valor negociado (precoAplicadoNum já reflete)
            valor_final_pacote: modoPacote && precoValido
              ? (modoPacoteCustoFin ? valorContratadoPacote : precoAplicadoNum)
              : null,
            ocultar_precos_individuais_no_contrato: modoPacote,
            motivo: modoPacote && temDiferencaPacote ? motivoPacote.trim() : null,
            // Auditoria estendida do pacote fechado.
            tipo_diferenca: modoPacote && temDiferencaPacote ? tipoDiferencaPacote : null,
            total_catalogo_servicos: modoPacote ? precoCatalogo : null,
            valor_total_pago_cliente:
              modoPacote && Number.isFinite(valorFinalPacoteNum) ? valorFinalPacoteNum : null,
            diferenca_valor: modoPacote ? diferencaPacoteValor : null,
            custo_financeiro_adquirente: modoPacoteCustoFin ? custoFinanceiroAdquirente : null,
            adquirente: modoPacoteCustoFin ? adquirentePacote.trim().toUpperCase() || null : null,
            parcelas: modoPacoteCustoFin ? parcelasPacote : null,
            valor_parcela: modoPacoteCustoFin ? valorParcelaPacote : null,
            custos_embutidos: modoPacoteCustoFin && custosEmbutidosValidos.length > 0
              ? custosEmbutidosValidos.map((c) => ({
                  descricao: c.descricao.toUpperCase(),
                  valor: Number(c.valor.toFixed(2)),
                }))
              : null,
            custos_embutidos_total: modoPacoteCustoFin && custosEmbutidosTotal > 0
              ? Number(custosEmbutidosTotal.toFixed(2))
              : null,
          } : null,
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha_criar_venda");
      toast.success(`Venda #${(data as any).venda_id} criada`);
      const novaVendaId = Number((data as any).venda_id);
      const novaVendaIdLegado = (data as any)?.id_legado != null ? Number((data as any).id_legado) : null;
      await backlinkPilotoEventos(novaVendaId, novaVendaIdLegado);
      await logPilotoEvento("venda_criada_checkout_piloto", {
        venda_id: novaVendaId,
        id_legado: novaVendaIdLegado,
        cliente_id: cliente.id,
        cliente_id_legado: cliente.id_legado,
        operador_user_id: user?.id ?? null,
        operador_email: staffEmail,
        itens: [
          { servico_id: servico.id, slug: servico.slug, nome: servico.nome, preco: precoAplicadoPrincipal },
          ...extrasAvaliados.map((e) => ({ servico_id: e.ie.servico.id, slug: e.ie.servico.slug, nome: e.ie.servico.nome, preco: e.aplicado })),
        ],
      });
      await recarregarVenda((data as any).venda_id);
    } catch (e: any) {
      toast.error(`Erro ao criar venda: ${e?.message || e}`);
    } finally {
      setCriandoVenda(false);
    }
  }, [cliente, servico, itensExtras, precoValido, precoDiferente, motivoOk, motivoPacoteOk, confirmadoPreco, evidenciaPath, evidenciaFile, uploadEvidencia, precoAplicadoPrincipal, extrasAvaliados, motivoPreco, tipoAjuste, modoExibicao, modoPacote, modoPacoteCustoFin, valorFinalPacoteNum, motivoPacote, temExtras, temDiferencaPacote, tipoDiferencaPacote, precoCatalogo, diferencaPacoteValor, custoFinanceiroAdquirente, adquirentePacote, parcelasPacote, valorParcelaPacote, valorContratadoPacote, custosEmbutidosValidos, custosEmbutidosTotal, logPilotoEvento, backlinkPilotoEventos, user?.id, staffEmail]);

  const recarregarVenda = useCallback(async (id: number) => {
    const { data } = await supabase
      .from("qa_vendas")
      .select("id, id_legado, cliente_id, status, status_validacao_valor, cobranca_status, valor_a_pagar, forma_pagamento")
      .eq("id", id)
      .maybeSingle();
    if (data) setVenda(data as Venda);
  }, []);

  /* ---------- Passo 4: Aprovar valor ---------- */
  const [aprovando, setAprovando] = useState(false);
  const aprovarValor = useCallback(async () => {
    if (!venda) return;
    setAprovando(true);
    try {
      const { data, error } = await supabase.rpc("qa_venda_aprovar_valor", { p_venda_id: venda.id });
      if (error) throw error;
      toast.success("Valor aprovado (evento registrado)");
      await logPilotoEvento("valor_aprovado_piloto", {
        venda_id: venda.id,
        valor_a_pagar: venda.valor_a_pagar,
        origem: "piloto_real",
      });
      await recarregarVenda(venda.id);
    } catch (e: any) {
      toast.error(`Falha ao aprovar valor: ${e?.message || e}`);
    } finally {
      setAprovando(false);
    }
  }, [venda, recarregarVenda, logPilotoEvento]);

  /* ---------- Passo 5/6: Pagamento Manual + Contrato ---------- */
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);

  const [forma, setForma] = useState<string>("PIX");
  const [parcelas, setParcelas] = useState<number>(1);
  const [observacao, setObservacao] = useState<string>("");
  const [adquirente, setAdquirente] = useState<string>("");
  const [valorBrutoStr, setValorBrutoStr] = useState<string>("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [comprovantePath, setComprovantePath] = useState<string | null>(null);
  const [confirmandoPag, setConfirmandoPag] = useState(false);
  const [confirmacaoContratoAberta, setConfirmacaoContratoAberta] = useState(false);
  const [confirmacaoVinculoMarcada, setConfirmacaoVinculoMarcada] = useState(false);

  // Pré-preenche o Passo 5 quando o Passo 3 configurou custo financeiro do pacote.
  useEffect(() => {
    if (!modoPacoteCustoFin) return;
    if (Number.isFinite(valorFinalPacoteNum) && valorFinalPacoteNum > 0) {
      setValorBrutoStr(valorFinalPacoteNum.toFixed(2).replace(".", ","));
    }
    if (adquirentePacote.trim()) setAdquirente(adquirentePacote.trim().toUpperCase());
    if (parcelasPacote > 0) setParcelas(parcelasPacote);
    setForma("CARTÃO DE CRÉDITO");
  }, [modoPacoteCustoFin, valorFinalPacoteNum, adquirentePacote, parcelasPacote]);

  const uploadComprovante = useCallback(async () => {
    if (!venda || !comprovante) return null;
    const ext = (comprovante.name.split(".").pop() || "bin").toLowerCase();
    const path = `qa/manual-payments/${venda.id}/comprovante-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("paid-contracts").upload(path, comprovante, {
      contentType: comprovante.type || "application/octet-stream",
      upsert: true,
    });
    if (error) throw error;
    setComprovantePath(path);
    return path;
  }, [comprovante, venda]);

  const clienteIdsAceitosContrato = useMemo(() => {
    const ids = [cliente?.id, cliente?.id_legado]
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    return new Set(ids);
  }, [cliente?.id, cliente?.id_legado]);
  const vendaClienteDivergente = !!venda && !!cliente && clienteIdsAceitosContrato.size > 0 && !clienteIdsAceitosContrato.has(Number(venda.cliente_id));
  const contratoClienteDivergente = !!contrato && !!cliente && clienteIdsAceitosContrato.size > 0 && !clienteIdsAceitosContrato.has(Number(contrato.cliente_id));
  const operadorMesmoContratante = !!cliente?.user_id && !!user?.id && cliente.user_id === user.id && profile?.perfil === "administrador";
  const vinculoBloqueado = vendaClienteDivergente || contratoClienteDivergente || operadorMesmoContratante;
  const motivoBloqueioVinculo = vendaClienteDivergente
    ? "A venda está vinculada a um ID de cliente diferente do cliente selecionado."
    : contratoClienteDivergente
      ? "O contrato foi gerado para um ID de cliente diferente do cliente selecionado."
      : operadorMesmoContratante
        ? "O contratante atual é o próprio operador/admin logado, não um cliente externo selecionado."
        : null;

  const confirmarPagamento = useCallback(async (forcarConfirmacao = false) => {
    if (!venda) return;
    if (observacao.trim().length < 20) {
      toast.error("Observação deve ter no mínimo 20 caracteres.");
      return;
    }
    if (!comprovante && !comprovantePath) {
      toast.error("Anexe o comprovante do pagamento.");
      return;
    }
    if (vinculoBloqueado) {
      toast.error("Vínculo do contratante bloqueado. Arquive este piloto e gere uma nova venda para o cliente correto.");
      return;
    }
    if (!forcarConfirmacao) {
      setConfirmacaoVinculoMarcada(false);
      setConfirmacaoContratoAberta(true);
      return;
    }
    setConfirmacaoContratoAberta(false);
    setConfirmandoPag(true);
    try {
      const path = comprovantePath || (await uploadComprovante());
      if (!path) throw new Error("comprovante_upload_falhou");
      const valorBrutoNum = (() => { const n = parseMoney(valorBrutoStr); return Number.isFinite(n) && n > 0 ? n : null; })();
      await logPilotoEvento("pagamento_manual_confirmado_piloto", {
        venda_id: venda.id,
        forma_pagamento: forma,
        parcelas,
        adquirente: adquirente.trim() || null,
        valor_bruto_parcelado: valorBrutoNum,
        valor_parcela: valorBrutoNum && parcelas > 0 ? Number((valorBrutoNum / parcelas).toFixed(2)) : null,
        comprovante_path: path,
        observacao_len: observacao.trim().length,
      });
      await logPilotoEvento("contrato_geracao_iniciada", {
        venda_id: venda.id,
        via: "pipeline_pos_pagamento",
      });
      const { data, error } = await supabase.functions.invoke("qa-venda-confirmar-pagamento-manual", {
        body: {
          venda_id: venda.id,
          forma_pagamento: forma,
          parcelas,
          observacao: observacao.trim(),
          comprovante_path: path,
          adquirente: adquirente.trim() || null,
          valor_bruto_parcelado: (() => {
            const n = parseMoney(valorBrutoStr);
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
        },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha");
      toast.success(
        (data as any)?.ja_estava_pago
          ? "Venda já estava paga. Pipeline reexecutado (idempotente)."
          : "Pagamento confirmado. Contrato sendo gerado…",
      );
      await recarregarVenda(venda.id);
      await recarregarContrato(venda.id);
      setConfirmacaoVinculoMarcada(false);
    } catch (e: any) {
      toast.error(`Falha ao confirmar pagamento: ${e?.message || e}`);
    } finally {
      setConfirmandoPag(false);
    }
  }, [venda, forma, parcelas, observacao, comprovante, comprovantePath, adquirente, valorBrutoStr, uploadComprovante, vinculoBloqueado, logPilotoEvento]);

  /* ---------- Passo 6: Contrato + Liberação ---------- */
  const recarregarContrato = useCallback(async (vendaId: number) => {
    // qa_contracts / qa_processos usam o id_legado da venda (mesmo id que o
    // pipeline pós-pagamento passa para qa-generate-contract). Se a venda
    // ainda não tem id_legado, caímos para o id interno.
    const lookupId = Number((venda as any)?.id_legado ?? vendaId) || vendaId;
    const { data: c } = await supabase
      .from("qa_contracts")
      .select("id, status, venda_id, cliente_id")
      .eq("venda_id", lookupId)
      .maybeSingle();
    setContrato((c as Contrato) ?? null);
    const { data: p } = await supabase
      .from("qa_processos")
      .select("id, venda_id, servico_id, status")
      .eq("venda_id", lookupId);
    setProcessos((p ?? []) as Processo[]);
  }, [venda]);

  useEffect(() => {
    if (!venda) return;
    const t = setInterval(() => {
      recarregarContrato(venda.id);
      recarregarVenda(venda.id);
    }, 6000);
    return () => clearInterval(t);
  }, [venda, recarregarContrato, recarregarVenda]);

  /* ---------- Retomada: hidratação por venda_id / id_legado ---------- */
  // Persistir última venda aberta.
  useEffect(() => {
    if (venda?.id) {
      try { localStorage.setItem(PILOTO_LS_KEY, String(venda.id)); } catch {}
    }
  }, [venda?.id]);

  const hidratarPilotoPorId = useCallback(async (idOuLegado: number) => {
    setHidratando(true);
    try {
      // Busca por id direto; se não achar, tenta id_legado.
      let vRes = await supabase
        .from("qa_vendas")
        .select("id, id_legado, cliente_id, status, status_validacao_valor, cobranca_status, valor_a_pagar, forma_pagamento")
        .eq("id", idOuLegado)
        .maybeSingle();
      if (!vRes.data) {
        vRes = await supabase
          .from("qa_vendas")
          .select("id, id_legado, cliente_id, status, status_validacao_valor, cobranca_status, valor_a_pagar, forma_pagamento")
          .eq("id_legado", idOuLegado)
          .maybeSingle();
      }
      const v = vRes.data as Venda | null;
      if (!v) { toast.error(`Venda ${idOuLegado} não encontrada.`); return; }

      // Cliente
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id, id_legado, nome_completo, cpf, email, celular, user_id")
        .eq("id", v.cliente_id)
        .maybeSingle();
      if (cli) setCliente(cli as Cliente);

      // Itens da venda → montamos shims para servico + itensExtras.
      // qa_itens_venda.venda_id armazena o id_legado da venda (não o id interno).
      const itensLookupId = Number(v.id_legado ?? v.id) || v.id;
      let { data: itens } = await supabase
        .from("qa_itens_venda")
        .select("servico_id, valor, sort_order")
        .eq("venda_id", itensLookupId)
        .order("sort_order", { ascending: true });
      if (!itens || itens.length === 0) {
        // Fallback defensivo: tenta pelo id interno caso alguma venda antiga tenha usado v.id.
        const alt = await supabase
          .from("qa_itens_venda")
          .select("servico_id, valor, sort_order")
          .eq("venda_id", v.id)
          .order("sort_order", { ascending: true });
        itens = alt.data ?? [];
      }
      const servicoIds = (itens ?? []).map((r: any) => r.servico_id).filter(Boolean);
      let nomesById: Record<number, string> = {};
      if (servicoIds.length > 0) {
        const { data: srvs } = await supabase
          .from("qa_servicos")
          .select("id, nome_servico")
          .in("id", servicoIds);
        for (const s of (srvs ?? []) as any[]) nomesById[s.id] = s.nome_servico;
      }
      const shims: Servico[] = (itens ?? []).map((r: any) => ({
        id: `srv-${r.servico_id}`,
        slug: `qa-srv-${r.servico_id}`,
        nome: nomesById[r.servico_id] || `Serviço #${r.servico_id}`,
        preco: r.valor != null ? Number(r.valor) : null,
        ativo: true,
      }));
      if (shims.length > 0) {
        setServico(shims[0]);
        setItensExtras(shims.slice(1).map((s) => ({
          servico: s,
          precoStr: s.preco != null ? Number(s.preco).toFixed(2).replace(".", ",") : "",
        })));
      } else {
        // Não deixa cair no catálogo aberto quando a venda existe mas os itens não foram achados.
        setServico({
          id: `venda-${v.id}`,
          slug: `venda-${v.id_legado ?? v.id}`,
          nome: `Serviços da venda #${v.id_legado ?? v.id}`,
          preco: v.valor_a_pagar != null ? Number(v.valor_a_pagar) : null,
          ativo: true,
        } as Servico);
        setItensExtras([]);
      }

      // Venda + contrato + processos (recarregarContrato usa id_legado).
      setVenda(v);
      // Consulta direta em vez de depender do closure de recarregarContrato.
      const lookupId = Number(v.id_legado ?? v.id) || v.id;
      const { data: c } = await supabase
        .from("qa_contracts")
        .select("id, status, venda_id, cliente_id")
        .eq("venda_id", lookupId)
        .maybeSingle();
      setContrato((c as Contrato) ?? null);
      const { data: p } = await supabase
        .from("qa_processos")
        .select("id, venda_id, servico_id, status")
        .eq("venda_id", lookupId);
      setProcessos((p ?? []) as Processo[]);

      // Detecta arquivamento: venda CANCELADO ou evento venda_arquivada_piloto.
      const statusUp = String(v.status || "").toUpperCase();
      let arq = statusUp === "CANCELADO";
      if (!arq) {
        const { data: evArq } = await supabase
          .from("qa_venda_eventos")
          .select("id")
          .eq("venda_id", v.id)
          .eq("tipo_evento", "venda_arquivada_piloto")
          .limit(1)
          .maybeSingle();
        arq = !!evArq;
      }
      setArquivado(arq);

      // Snapshot do modo de exibição do contrato (evento oficial).
      const { data: evExib } = await supabase
        .from("qa_venda_eventos")
        .select("dados_json, created_at")
        .eq("venda_id", v.id)
        .eq("tipo_evento", "venda_exibicao_contrato_definida")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const dj = (evExib as any)?.dados_json || null;
      if (dj && (dj.modo_exibicao_valor_contrato === "pacote_fechado" || dj.modo_exibicao_valor_contrato === "itens_separados")) {
        setExibicaoContratoSnap({
          modo: dj.modo_exibicao_valor_contrato,
          valor_final_pacote: dj.valor_final_pacote != null ? Number(dj.valor_final_pacote) : null,
          ocultar_precos_individuais_no_contrato: !!dj.ocultar_precos_individuais_no_contrato,
        });
        // Reflete no state local usado pela UI/edição, se ainda editável.
        if (dj.modo_exibicao_valor_contrato === "pacote_fechado") {
          setModoExibicao("pacote_fechado");
          if (dj.valor_final_pacote != null) {
            setValorFinalPacoteStr(Number(dj.valor_final_pacote).toFixed(2).replace(".", ","));
          }
        }
      } else {
        setExibicaoContratoSnap(null);
      }

      toast.success(`Piloto da venda #${v.id} restaurado.`);
    } catch (e: any) {
      toast.error(`Falha ao restaurar piloto: ${e?.message || e}`);
    } finally {
      setHidratando(false);
    }
  }, []);

  // Mount: URL param → hidrata direto. Sem URL → mostra "último local".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("venda_id") || params.get("id_legado");
    if (vid) {
      const n = Number(vid);
      if (Number.isFinite(n) && n > 0) {
        setHidratado({ venda_id: n, via: "url" });
        hidratarPilotoPorId(n);
        return;
      }
    }
    try {
      const ls = localStorage.getItem(PILOTO_LS_KEY);
      const n = ls ? Number(ls) : NaN;
      if (Number.isFinite(n) && n > 0) setUltimoLocal(n);
    } catch {}
  }, [hidratarPilotoPorId]);

  // Scroll automático para o passo atual após hidratação.
  useEffect(() => {
    if (!hidratado || hidratando || !venda) return;
    const id =
      contrato ? "step-contrato"
      : venda.cobranca_status === "confirmada" ? "step-contrato"
      : venda.status_validacao_valor === "aprovado" ? "step-pagamento"
      : "step-valor";
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }, [hidratado, hidratando, venda?.id, venda?.status_validacao_valor, venda?.cobranca_status, contrato?.id]);

  // Lista de pilotos em andamento (não arquivados/cancelados/concluídos).
  const carregarResumos = useCallback(async () => {
    setCarregandoResumos(true);
    try {
      // Coleta candidatos via qa_venda_eventos (origem/tipo piloto).
      const { data: evts } = await supabase
        .from("qa_venda_eventos")
        .select("venda_id, tipo_evento, created_at")
        .or("tipo_evento.ilike.%piloto%,ator.ilike.piloto%,dados_json->>origem.ilike.piloto%")
        .order("created_at", { ascending: false })
        .limit(200);
      const ultimoPorVenda = new Map<number, { tipo: string; when: string }>();
      for (const e of ((evts ?? []) as any[])) {
        if (!e.venda_id) continue;
        if (!ultimoPorVenda.has(e.venda_id)) {
          ultimoPorVenda.set(e.venda_id, { tipo: e.tipo_evento, when: e.created_at });
        }
      }
      const ids = Array.from(ultimoPorVenda.keys()).slice(0, 30);
      if (ids.length === 0) { setResumos([]); return; }
      const { data: vendas } = await supabase
        .from("qa_vendas")
        .select("id, id_legado, cliente_id, valor_a_pagar, status, cobranca_status, status_validacao_valor")
        .in("id", ids);
      const cliIds = Array.from(new Set(((vendas ?? []) as any[]).map((v) => v.cliente_id).filter(Boolean)));
      const { data: clis } = cliIds.length > 0
        ? await supabase.from("qa_clientes").select("id, nome_completo, cpf").in("id", cliIds)
        : { data: [] as any[] } as any;
      const cliMap = new Map<number, { nome_completo: string | null; cpf: string | null }>();
      for (const c of ((clis ?? []) as any[])) cliMap.set(c.id, { nome_completo: c.nome_completo, cpf: c.cpf });

      // Contratos por lookup_id (id_legado ?? id).
      const lookupIds = ((vendas ?? []) as any[]).map((v) => Number(v.id_legado ?? v.id));
      const { data: contratos } = lookupIds.length > 0
        ? await supabase.from("qa_contracts").select("venda_id, status").in("venda_id", lookupIds)
        : { data: [] as any[] } as any;
      const contratoMap = new Map<number, string>();
      for (const c of ((contratos ?? []) as any[])) contratoMap.set(c.venda_id, c.status);

      const linhas: PilotoResumo[] = ((vendas ?? []) as any[])
        .filter((v) =>
          String(v.status || "").toUpperCase() !== "CANCELADO" &&
          String(v.status || "").toUpperCase() !== "CONCLUIDO" &&
          String(v.status || "").toUpperCase() !== "CONCLUÍDO",
        )
        .map((v) => {
          const lookup = Number(v.id_legado ?? v.id);
          const cli = cliMap.get(v.cliente_id);
          const last = ultimoPorVenda.get(v.id);
          return {
            venda_id: v.id,
            id_legado: v.id_legado ?? null,
            cliente_nome: cli?.nome_completo ?? null,
            cliente_cpf: cli?.cpf ?? null,
            valor_a_pagar: v.valor_a_pagar,
            status: v.status,
            cobranca_status: v.cobranca_status,
            status_validacao_valor: v.status_validacao_valor,
            contrato_status: contratoMap.get(lookup) ?? null,
            ultimo_evento: last?.tipo ?? null,
            ultimo_evento_at: last?.when ?? null,
          };
        })
        .sort((a, b) => (a.ultimo_evento_at || "") < (b.ultimo_evento_at || "") ? 1 : -1);
      setResumos(linhas);
    } catch (e: any) {
      toast.error(`Falha ao listar pilotos: ${e?.message || e}`);
    } finally {
      setCarregandoResumos(false);
    }
  }, []);

  useEffect(() => {
    if (!venda && !hidratando && !hidratado) carregarResumos();
  }, [venda, hidratando, hidratado, carregarResumos]);

  const abrirPiloto = useCallback((vendaId: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("venda_id", String(vendaId));
    window.history.replaceState(null, "", url.toString());
    setHidratado({ venda_id: vendaId, via: "url" });
    hidratarPilotoPorId(vendaId);
  }, [hidratarPilotoPorId]);

  const linkContratoCliente = useMemo(() => {
    if (!contrato) return null;
    return `${window.location.origin}/area-do-cliente`;
  }, [contrato]);

  /* ---------- Passo 6b: Upload assistido de contrato assinado (staff) ---------- */
  const [assinado, setAssinado] = useState<File | null>(null);
  const [obsAssinado, setObsAssinado] = useState<string>("");
  const [origemAssinado, setOrigemAssinado] = useState<string>("WhatsApp");
  const [enviandoAssinado, setEnviandoAssinado] = useState(false);

  const enviarContratoAssinadoStaff = useCallback(async () => {
    if (!contrato || !venda) return;
    if (!assinado) { toast.error("Anexe o PDF do contrato assinado."); return; }
    if (obsAssinado.trim().length < 20) { toast.error("Observação mínima de 20 caracteres."); return; }
    setEnviandoAssinado(true);
    try {
      await logPilotoEvento("contrato_upload_assistido_iniciado", {
        contrato_id: contrato.id,
        origem: origemAssinado,
        tamanho_arquivo: assinado.size,
        nome_arquivo: assinado.name,
      });
      const fd = new FormData();
      fd.append("contract_id", contrato.id);
      fd.append("file", assinado);
      fd.append("observacao", obsAssinado.trim());
      fd.append("origem", `piloto_real_staff_assistido:${origemAssinado}`);
      const { data, error } = await supabase.functions.invoke("qa-piloto-upload-contrato-staff", { body: fd });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha_upload_assistido");
      await logPilotoEvento("contrato_validacao_iniciada", {
        contrato_id: contrato.id,
        via: "qa-piloto-upload-contrato-staff",
      });
      toast.success("Contrato enviado (staff-assistido). Validação oficial acionada.");
      setAssinado(null); setObsAssinado("");
      await recarregarContrato(venda.id);
    } catch (e: any) {
      toast.error(`Falha no upload assistido: ${e?.message || e}`);
    } finally {
      setEnviandoAssinado(false);
    }
  }, [contrato, venda, assinado, obsAssinado, origemAssinado, recarregarContrato, logPilotoEvento]);

  /* ---------- Arquivar piloto ---------- */
  const [motivoArq, setMotivoArq] = useState("");
  const [arquivando, setArquivando] = useState(false);
  const [arquivado, setArquivado] = useState(false);
  const [mostrarArq, setMostrarArq] = useState(false);

  const arquivarPiloto = useCallback(async () => {
    if (!venda) return;
    if (motivoArq.trim().length < 20) { toast.error("Motivo obrigatório (mín. 20 caracteres)."); return; }
    if (!confirm("Arquivar este piloto? Nada será apagado, mas venda/contrato/processos ficarão cancelados.")) return;
    setArquivando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-piloto-arquivar", {
        body: { venda_id: venda.id, motivo: motivoArq.trim() },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "falha_arquivar");
      toast.success((data as any)?.ja_arquivada ? "Piloto já estava arquivado." : "Piloto arquivado.");
      await logPilotoEvento("piloto_arquivado", {
        venda_id: venda.id,
        motivo_len: motivoArq.trim().length,
        ja_arquivada: !!(data as any)?.ja_arquivada,
      });
      setArquivado(true);
      await recarregarVenda(venda.id);
      await recarregarContrato(venda.id);
    } catch (e: any) {
      toast.error(`Falha ao arquivar: ${e?.message || e}`);
    } finally {
      setArquivando(false);
    }
  }, [venda, motivoArq, recarregarVenda, recarregarContrato, logPilotoEvento]);

  /* ---------- Observadores de transição (contrato/processos) ---------- */
  const contratoStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const anterior = contratoStatusRef.current;
    const atual = contrato?.status ?? null;
    if (atual && atual !== anterior) {
      if (atual === "validated") {
        logPilotoEvento("contrato_validado", { contrato_id: contrato?.id, status: atual });
      }
    }
    contratoStatusRef.current = atual;
  }, [contrato?.status, contrato?.id, logPilotoEvento]);

  const processosSnapshotRef = useRef<string>("");
  const pilotoConcluidoLogadoRef = useRef(false);
  useEffect(() => {
    if (!processos || processos.length === 0) return;
    const key = processos.map((p) => `${p.id}:${p.status ?? ""}`).sort().join("|");
    if (key === processosSnapshotRef.current) return;
    const anterior = processosSnapshotRef.current;
    processosSnapshotRef.current = key;
    // Só loga transição, não estado inicial da hidratação.
    if (!anterior) return;
    const liberados = processos.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return s && !["pending", "aguardando", "bloqueado", "cancelado"].includes(s);
    });
    if (liberados.length > 0) {
      logPilotoEvento("processo_checklist_liberado", {
        total: processos.length,
        liberados: liberados.length,
        detalhe: processos.map((p) => ({ processo_id: p.id, status: p.status })),
      });
      if (!pilotoConcluidoLogadoRef.current && liberados.length === processos.length && contrato?.status === "validated") {
        pilotoConcluidoLogadoRef.current = true;
        logPilotoEvento("piloto_concluido", {
          venda_id: venda?.id,
          contrato_id: contrato?.id,
          processos: processos.length,
        });
      }
    }
  }, [processos, contrato?.status, contrato?.id, venda?.id, logPilotoEvento]);

  /* ---------- Smoke test ---------- */
  /* ---------- Auditoria (somente leitura) ---------- */
  type AuditRow = {
    fonte: "qa_venda_eventos" | "qa_pagamento_auditoria" | "qa_contract_events" | "qa_processo_eventos" | "qa_piloto_eventos";
    id: string;
    created_at: string;
    tipo: string;
    ator: string | null;
    user_id: string | null;
    ref: string;
    dados: unknown;
  };
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [carregandoAudit, setCarregandoAudit] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const carregarAuditoria = useCallback(async () => {
    if (!venda) return;
    setCarregandoAudit(true);
    try {
      const processoIds = processos.map((p) => p.id);
      const [ve, pa, ce, pe, pil] = await Promise.all([
        supabase
          .from("qa_venda_eventos")
          .select("id, created_at, tipo_evento, ator, user_id, dados_json, venda_id")
          .eq("venda_id", venda.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("qa_pagamento_auditoria")
          .select("id, created_at, campo, valor_anterior, valor_novo, origem, ator, contexto, venda_id")
          .eq("venda_id", venda.id)
          .order("created_at", { ascending: false })
          .limit(200),
        contrato
          ? supabase
              .from("qa_contract_events")
              .select("id, created_at, event_type, event_payload, created_by, contract_id")
              .eq("contract_id", contrato.id)
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null } as any),
        processoIds.length > 0
          ? supabase
              .from("qa_processo_eventos")
              .select("id, created_at, tipo_evento, descricao, dados_json, ator, user_id, processo_id")
              .in("processo_id", processoIds)
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null } as any),
        (() => {
          // qa_piloto_eventos: por venda_id + venda_id_legado + session_id (para eventos pré-venda).
          const lookupLegado = Number((venda as any)?.id_legado ?? venda.id);
          const filtros = [
            `venda_id.eq.${venda.id}`,
            `venda_id_legado.eq.${lookupLegado}`,
          ];
          if (pilotoSessionId) filtros.push(`piloto_session_id.eq.${pilotoSessionId}`);
          return supabase
            .from("qa_piloto_eventos")
            .select("id, created_at, tipo_evento, dados_json, staff_user_id, staff_email, venda_id, venda_id_legado, piloto_session_id")
            .or(filtros.join(","))
            .order("created_at", { ascending: false })
            .limit(400);
        })(),
      ]);
      const rows: AuditRow[] = [];
      for (const r of ((pil as any).data ?? []) as any[]) {
        rows.push({
          fonte: "qa_piloto_eventos",
          id: `pil:${r.id}`,
          created_at: r.created_at,
          tipo: r.tipo_evento,
          ator: r.staff_email ?? null,
          user_id: r.staff_user_id ?? null,
          ref: r.venda_id
            ? `venda #${r.venda_id}`
            : `sessão ${String(r.piloto_session_id || "").slice(0, 8)}`,
          dados: r.dados_json,
        });
      }
      for (const r of (ve.data ?? []) as any[]) {
        rows.push({
          fonte: "qa_venda_eventos",
          id: `ve:${r.id}`,
          created_at: r.created_at,
          tipo: r.tipo_evento,
          ator: r.ator ?? null,
          user_id: r.user_id ?? null,
          ref: `venda #${r.venda_id}`,
          dados: r.dados_json,
        });
      }
      for (const r of (pa.data ?? []) as any[]) {
        rows.push({
          fonte: "qa_pagamento_auditoria",
          id: `pa:${r.id}`,
          created_at: r.created_at,
          tipo: `${r.campo}: ${String(r.valor_anterior ?? "—")} → ${String(r.valor_novo ?? "—")}`,
          ator: r.ator ?? null,
          user_id: null,
          ref: `venda #${r.venda_id} · origem ${r.origem ?? "—"}`,
          dados: r.contexto,
        });
      }
      for (const r of (ce.data ?? []) as any[]) {
        rows.push({
          fonte: "qa_contract_events",
          id: `ce:${r.id}`,
          created_at: r.created_at,
          tipo: r.event_type,
          ator: null,
          user_id: r.created_by ?? null,
          ref: `contrato ${String(r.contract_id).slice(0, 8)}`,
          dados: r.event_payload,
        });
      }
      for (const r of (pe.data ?? []) as any[]) {
        rows.push({
          fonte: "qa_processo_eventos",
          id: `pe:${r.id}`,
          created_at: r.created_at,
          tipo: r.tipo_evento,
          ator: r.ator ?? null,
          user_id: r.user_id ?? null,
          ref: `processo ${String(r.processo_id).slice(0, 8)}${r.descricao ? ` · ${r.descricao}` : ""}`,
          dados: r.dados_json,
        });
      }
      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setAuditRows(rows);
    } catch (e: any) {
      toast.error(`Falha ao carregar auditoria: ${e?.message || e}`);
    } finally {
      setCarregandoAudit(false);
    }
  }, [venda, contrato, processos, pilotoSessionId]);

  useEffect(() => {
    if (venda) carregarAuditoria();
  }, [venda?.id, contrato?.id, processos.length, carregarAuditoria]);

  const [rodandoSmoke, setRodandoSmoke] = useState(false);
  const [smokeResult, setSmokeResult] = useState<any>(null);
  const [smokeCopiado, setSmokeCopiado] = useState(false);
  const copiarSmokeResult = useCallback(async () => {
    if (!smokeResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(smokeResult, null, 2));
      setSmokeCopiado(true);
      toast.success("Resultado do smoke test copiado.");
      setTimeout(() => setSmokeCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, [smokeResult]);
  const rodarSmokeTest = useCallback(async () => {
    if (!confirm("Rodar smoke test? Cria uma venda descartável e arquiva ao final.")) return;
    setRodandoSmoke(true);
    setSmokeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-piloto-smoke-test", { body: {} });
      if (error) throw error;
      setSmokeResult(data);
      toast[(data as any)?.ok ? "success" : "error"]((data as any)?.ok ? "Smoke test OK" : "Smoke test com falhas");
    } catch (e: any) {
      toast.error(`Smoke test falhou: ${e?.message || e}`);
      setSmokeResult({ ok: false, error: e?.message });
    } finally {
      setRodandoSmoke(false);
    }
  }, []);

  /* ---------- Estados derivados p/ checklist ---------- */
  const stepStates = useMemo(() => ({
    cliente: cliente ? "done" as const : "current" as const,
    servico: servico ? "done" as const : cliente ? "current" as const : "pending" as const,
    venda: venda ? "done" as const : (cliente && servico) ? "current" as const : "pending" as const,
    valor: venda?.status_validacao_valor === "aprovado" ? "done" as const : venda ? "current" as const : "pending" as const,
    pagamento: venda?.cobranca_status === "confirmada" ? "done" as const : venda?.status_validacao_valor === "aprovado" ? "current" as const : "pending" as const,
    contrato: contrato ? (["validated","customer_signed"].includes(contrato.status) ? "done" as const : "current" as const) : "pending" as const,
    liberacao: processos.length > 0 ? "done" as const : contrato?.status === "validated" ? "current" as const : "pending" as const,
  }), [cliente, servico, venda, contrato, processos]);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 uppercase">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Coluna principal */}
        <div className="space-y-6">
          <header className="border-b border-neutral-200 pb-4">
            <h1 className="text-xl font-bold tracking-wide">Piloto Real — Contratação Assistida</h1>
            <p className="text-xs text-neutral-600 mt-1 normal-case">
              Fluxo real do sistema, sem atalhos. Todas as ações geram evento em <code>qa_venda_eventos</code>,
              <code> qa_pagamento_auditoria</code> e <code>qa_contract_events</code>.
            </p>
            {arquivado && (
              <div className="mt-3 border border-rose-300 bg-rose-50 text-rose-700 rounded px-3 py-2 text-xs flex items-center gap-2 normal-case">
                <Archive className="h-4 w-4" /> Piloto arquivado. Ações do wizard bloqueadas — apenas visualização/auditoria.
              </div>
            )}
            {hidratando && (
              <div className="mt-3 border border-amber-300 bg-amber-50 text-amber-800 rounded px-3 py-2 text-xs flex items-center gap-2 normal-case">
                <Loader2 className="h-4 w-4 animate-spin" /> Restaurando piloto {hidratado ? `#${hidratado.venda_id}` : ""}…
              </div>
            )}
            {venda && hidratado && !hidratando && (
              <div className="mt-3 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded px-3 py-2 text-xs flex items-center justify-between gap-2 normal-case">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Piloto <strong>#{venda.id}</strong>
                  {venda.id_legado ? <> · legado <code>{String(venda.id_legado)}</code></> : null}
                  {" "}restaurado via {hidratado.via === "url" ? "URL" : "último local"}.
                </span>
                <span className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const dirty =
                        !!motivoPreco || !!evidenciaFile || !!motivoPacote ||
                        !!comprovante || !!assinado || !!valorBrutoStr ||
                        !!precoAplicadoStr || !!valorFinalPacoteStr;
                      if (dirty && !window.confirm("Existem alterações não salvas. Deseja voltar para a lista de pilotos mesmo assim?")) {
                        return;
                      }
                      const url = new URL(window.location.href);
                      url.searchParams.delete("venda_id");
                      url.searchParams.delete("id_legado");
                      // Preserva localStorage do último piloto (apenas sai da visualização).
                      window.location.assign(url.pathname);
                    }}
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Voltar para pilotos em andamento
                  </Button>
                  <button
                    type="button"
                    className="text-[11px] underline hover:no-underline"
                    onClick={() => {
                      try {
                        localStorage.removeItem(PILOTO_LS_KEY);
                        localStorage.removeItem(PILOTO_SESSION_LS_KEY);
                      } catch {}
                      const url = new URL(window.location.href);
                      url.searchParams.delete("venda_id");
                      url.searchParams.delete("id_legado");
                      window.location.assign(url.pathname);
                    }}
                  >
                    Iniciar novo piloto
                  </button>
                </span>
              </div>
            )}
            {venda && vinculoBloqueado && (
              <div className="mt-3 border border-rose-300 bg-rose-50 text-rose-800 rounded px-3 py-2 text-xs normal-case">
                <div className="font-semibold flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" /> Continuação bloqueada por divergência de contratante.
                </div>
                <div className="mt-1">
                  {motivoBloqueioVinculo} Arquive este piloto e crie uma nova venda usando o cliente correto no Passo 1.
                </div>
              </div>
            )}
          </header>

          {/* Retomar piloto em andamento (só quando nenhum piloto foi carregado ainda) */}
          {!venda && !hidratando && (
            <Card title="Retomar Piloto em Andamento" state="pending">
              {ultimoLocal && !hidratado && (
                <div className="mb-3 border border-neutral-200 rounded p-2 flex items-center justify-between text-xs normal-case bg-neutral-50">
                  <span>Último piloto aberto neste navegador: <strong>venda #{ultimoLocal}</strong></span>
                  <Button size="sm" variant="outline" onClick={() => abrirPiloto(ultimoLocal)}>
                    <Play className="h-3 w-3 mr-1" /> Retomar
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-neutral-600 normal-case">
                  Vendas criadas pelo fluxo <code>piloto_real</code> que ainda não foram concluídas ou canceladas.
                </p>
                <Button size="sm" variant="outline" onClick={carregarResumos} disabled={carregandoResumos}>
                  {carregandoResumos ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</>}
                </Button>
              </div>
              {resumos.length === 0 && !carregandoResumos && (
                <p className="text-xs text-neutral-500 normal-case">Nenhum piloto em andamento.</p>
              )}
              {resumos.length > 0 && (
                <div className="max-h-80 overflow-auto border border-neutral-200 rounded">
                  <table className="w-full text-[11px] normal-case">
                    <thead className="bg-neutral-100 text-neutral-600 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1">Venda</th>
                        <th className="text-left px-2 py-1">Cliente</th>
                        <th className="text-left px-2 py-1">Valor</th>
                        <th className="text-left px-2 py-1">Pagto</th>
                        <th className="text-left px-2 py-1">Contrato</th>
                        <th className="text-left px-2 py-1">Último evento</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumos.map((r) => (
                        <tr key={r.venda_id} className="border-t border-neutral-200">
                          <td className="px-2 py-1 whitespace-nowrap">
                            <strong>#{r.venda_id}</strong>
                            {r.id_legado ? <div className="text-[9px] text-neutral-500">leg {String(r.id_legado)}</div> : null}
                          </td>
                          <td className="px-2 py-1">
                            <div className="font-semibold uppercase">{r.cliente_nome || "—"}</div>
                            <div className="text-[9px] text-neutral-500">{r.cliente_cpf || "—"}</div>
                          </td>
                          <td className="px-2 py-1 font-mono">{money(r.valor_a_pagar)}</td>
                          <td className="px-2 py-1">
                            <div>{r.cobranca_status || "—"}</div>
                            <div className="text-[9px] text-neutral-500">{r.status || "—"}</div>
                          </td>
                          <td className="px-2 py-1">{r.contrato_status || "—"}</td>
                          <td className="px-2 py-1">
                            <div>{r.ultimo_evento || "—"}</div>
                            <div className="text-[9px] text-neutral-500">
                              {r.ultimo_evento_at ? new Date(r.ultimo_evento_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-right">
                            <Button size="sm" variant="outline" onClick={() => abrirPiloto(r.venda_id)}>
                              <Play className="h-3 w-3 mr-1" /> Continuar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Passo 1 */}
          <Card id="step-cliente" title="1. Cliente Real" state={stepStates.cliente}>
            {!cliente ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, CPF ou e-mail…"
                    onKeyDown={(e) => e.key === "Enter" && buscarCliente()}
                    className="bg-white border-neutral-300 uppercase"
                  />
                  <Button onClick={buscarCliente} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                  {candidatos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCliente(c)}
                      className="w-full text-left border border-neutral-200 hover:border-emerald-500/60 hover:bg-neutral-50 rounded p-2 text-xs"
                    >
                      <div className="font-semibold flex items-center gap-2">
                        <User className="h-3 w-3" /> {c.nome_completo}
                      </div>
                      <div className="text-neutral-600 normal-case">
                        CPF {c.cpf || "—"} · {c.email || "—"} · {c.celular || "—"}
                      </div>
                    </button>
                  ))}
                  {candidatos.length === 0 && !searching && query && (
                    <p className="text-xs text-neutral-500">Nenhum cliente encontrado.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{cliente.nome_completo}</div>
                  <div className="text-xs text-neutral-600 normal-case">
                    #{cliente.id} · CPF {cliente.cpf} · {cliente.email}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setCliente(null); setVenda(null); setContrato(null); }}>
                  Trocar
                </Button>
              </div>
            )}
          </Card>

          {/* Passo 2 */}
          {cliente && (
            <Card
              id="step-servico"
              title={
                servico
                  ? (itensExtras.length > 0
                      ? `2. Serviços contratados (${1 + itensExtras.length})`
                      : "2. Serviço contratado")
                  : "2. Serviço"
              }
              state={stepStates.servico}
            >
              {!servico ? (
                <>
                  <Input
                    value={servicoQ}
                    onChange={(e) => setServicoQ(e.target.value)}
                    placeholder="Filtrar serviço por nome ou slug…"
                    className="bg-white border-neutral-300 uppercase"
                  />
                  <div className="mt-3 max-h-72 overflow-y-auto space-y-1">
                    {carregandoServicos && <Loader2 className="h-4 w-4 animate-spin" />}
                    {servicosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setServico(s)}
                        className="w-full text-left border border-neutral-200 hover:border-emerald-500/60 hover:bg-neutral-50 rounded p-2 text-xs flex justify-between"
                      >
                        <span>
                          <span className="font-semibold">{s.nome}</span>
                          <span className="text-neutral-500 normal-case"> · {s.slug}</span>
                        </span>
                        <span className="text-emerald-400">{money(s.preco)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // Fonte da verdade do modo de exibição:
                    //  - venda existente: usa snapshot do evento oficial (fallback = local)
                    //  - venda ainda não criada: usa state local (editável no Passo 3)
                    const modoEfetivo: "itens_separados" | "pacote_fechado" =
                      venda
                        ? (exibicaoContratoSnap?.modo ?? (itensExtras.length > 0 ? "itens_separados" : "itens_separados"))
                        : (modoExibicao);
                    const ehPacote = itensExtras.length > 0 && modoEfetivo === "pacote_fechado";
                    const valorFinal = venda
                      ? (exibicaoContratoSnap?.valor_final_pacote ?? Number((venda as any)?.valor_a_pagar))
                      : (Number.isFinite(valorFinalPacoteNum) ? valorFinalPacoteNum : null);
                    const todos = [servico, ...itensExtras.map((i) => i.servico)];
                    const totalSeparados = todos.reduce(
                      (s, sv) => s + (sv?.preco != null ? Number(sv.preco) : 0),
                      0,
                    );

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {itensExtras.length > 0 && (
                              <span className="text-[10px] uppercase tracking-wide bg-neutral-900 text-white rounded-full px-2 py-0.5">
                                {1 + itensExtras.length} serviços no pacote
                              </span>
                            )}
                            <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border ${ehPacote ? "border-amber-400 text-amber-800 bg-amber-50" : "border-neutral-300 text-neutral-700 bg-neutral-50"}`}>
                              Modo: {ehPacote ? "pacote fechado / valor final único" : "itens separados"}
                            </span>
                          </div>
                          {!venda && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setServico(null); setVenda(null); setContrato(null); setItensExtras([]); }}
                            >
                              Trocar
                            </Button>
                          )}
                        </div>

                        <ol className="space-y-1 text-sm">
                          {todos.map((sv, i) => (
                            <li key={`${sv?.id ?? "srv"}-${i}`} className="flex items-start justify-between gap-3 border border-neutral-200 rounded px-2 py-1.5">
                              <div className="flex-1">
                                <div className="font-semibold">
                                  <span className="text-neutral-500 mr-1">{i + 1}.</span>{sv?.nome}
                                </div>
                                <div className="text-[11px] text-neutral-500 normal-case">{sv?.slug}</div>
                              </div>
                              {/* Preço individual: escondido no modo pacote fechado */}
                              {!ehPacote && (
                                <div className="font-mono text-xs text-neutral-700 whitespace-nowrap">
                                  {money(sv?.preco ?? null)}
                                </div>
                              )}
                            </li>
                          ))}
                        </ol>

                        {ehPacote ? (
                          <div className="rounded border border-amber-300 bg-amber-50/60 p-2 text-xs space-y-0.5 normal-case">
                            <div>
                              <span className="text-neutral-600">Valor final do pacote:</span>{" "}
                              <strong className="font-mono">{money(valorFinal)}</strong>
                            </div>
                            <div className="text-neutral-600">
                              Contrato: <strong>preços individuais ocultos</strong>. Auditoria completa no Passo 3.
                            </div>
                          </div>
                        ) : (
                          itensExtras.length > 0 && (
                            <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs flex items-center justify-between normal-case">
                              <span className="text-neutral-600">Total dos serviços:</span>
                              <strong className="font-mono">{money(totalSeparados)}</strong>
                            </div>
                          )
                        )}
                      </>
                    );
                  })()}

                  {/* Itens adicionais do pacote (Piloto Real multi-item) */}
                  {!venda && (
                    <div className="border-t border-neutral-200 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold tracking-wide">
                          Adicionar / editar serviços {itensExtras.length > 0 && <span className="text-neutral-500 normal-case">({itensExtras.length} extras)</span>}
                        </div>
                        {!extraPickerAberto && (
                          <Button size="sm" variant="outline" onClick={() => setExtraPickerAberto(true)}>
                            + Adicionar serviço
                          </Button>
                        )}
                      </div>

                      {itensExtras.length === 0 && !extraPickerAberto && (
                        <p className="text-[11px] text-neutral-500 normal-case">
                          Use quando o cliente contratou mais de um serviço em uma condição única (ex.: Concessão de CR + Curso Operador de Pistola).
                        </p>
                      )}

                      {itensExtras.length > 0 && (
                        <ul className="space-y-2 mb-2">
                          {itensExtras.map((ie, idx) => (
                            <li key={ie.servico.id} className="border border-neutral-200 rounded p-2 flex items-start gap-2">
                              <div className="flex-1 text-xs">
                                <div className="font-semibold">{ie.servico.nome}</div>
                                <div className="text-neutral-500 normal-case">{ie.servico.slug} · catálogo {money(ie.servico.preco)}</div>
                              </div>
                              <div className="w-32">
                                <Label className="text-[10px] text-neutral-500">Preço aplicado</Label>
                                <Input
                                  value={ie.precoStr}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setItensExtras((prev) => prev.map((p, i) => i === idx ? { ...p, precoStr: v } : p));
                                  }}
                                  placeholder="0,00"
                                  className="bg-white border-neutral-300 h-8 font-mono text-xs mt-1"
                                  inputMode="decimal"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setItensExtras((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                Remover
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {extraPickerAberto && (
                        <div className="border border-neutral-200 rounded p-2 bg-neutral-50">
                          <div className="flex items-center gap-2 mb-2">
                            <Input
                              value={extraQ}
                              onChange={(e) => setExtraQ(e.target.value)}
                              placeholder="Filtrar serviço para adicionar…"
                              className="bg-white border-neutral-300 h-8 uppercase text-xs"
                            />
                            <Button size="sm" variant="ghost" onClick={() => { setExtraPickerAberto(false); setExtraQ(""); }}>
                              Fechar
                            </Button>
                          </div>
                          <div className="max-h-56 overflow-y-auto space-y-1">
                            {servicosExtraFiltrados.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  setItensExtras((prev) => [
                                    ...prev,
                                    { servico: s, precoStr: s.preco != null ? fmtMoneyInput(Number(s.preco)) : "" },
                                  ]);
                                  setExtraQ("");
                                  setExtraPickerAberto(false);
                                }}
                                className="w-full text-left border border-neutral-200 hover:border-emerald-500/60 hover:bg-white rounded p-2 text-xs flex justify-between"
                              >
                                <span>
                                  <span className="font-semibold">{s.nome}</span>
                                  <span className="text-neutral-500 normal-case"> · {s.slug}</span>
                                </span>
                                <span className="text-neutral-700">{money(s.preco)}</span>
                              </button>
                            ))}
                            {servicosExtraFiltrados.length === 0 && (
                              <p className="text-[11px] text-neutral-500 normal-case">Sem serviços disponíveis para adicionar.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Passo 3 */}
          {cliente && servico && (
            <Card id="step-venda" title="3. Criar Venda" state={stepStates.venda}>
              {!venda ? (
                <div className="space-y-3">
                  {/* Modo de exibição do contrato — visível apenas em pacote multi-item */}
                  {temExtras && (
                    <div className="rounded border border-amber-300 bg-amber-50/60 p-3 space-y-2">
                      <div className="text-xs font-semibold tracking-wide text-amber-900">
                        Como exibir o valor no contrato? <span className="text-rose-600">*</span>
                      </div>
                      <div className="space-y-2 text-[11px] normal-case">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            className="mt-0.5"
                            name="modo_exibicao"
                            checked={modoExibicao === "itens_separados"}
                            onChange={() => setModoExibicao("itens_separados")}
                          />
                          <span>
                            <strong>Itens separados.</strong> O contrato lista cada serviço com seu preço
                            individual e depois o total. Preços editáveis por item na seção acima.
                          </span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            className="mt-0.5"
                            name="modo_exibicao"
                            checked={modoExibicao === "pacote_fechado"}
                            onChange={() => setModoExibicao("pacote_fechado")}
                          />
                          <span>
                            <strong>Pacote fechado / valor final único.</strong> O contrato lista os serviços
                            contratados <em>sem</em> preço individual e exibe apenas o valor final do pacote e
                            a condição de pagamento. Itens continuam vinculados internamente (cada um gera seu
                            processo/entrega/checklist).
                          </span>
                        </label>
                      </div>

                      {modoPacote && (
                        <div className="border-t border-amber-300 pt-2 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[11px] text-neutral-600">
                                Valor final do pacote (R$) <span className="text-rose-600">*</span>
                              </Label>
                              <Input
                                value={valorFinalPacoteStr}
                                onChange={(e) => setValorFinalPacoteStr(e.target.value)}
                                placeholder="Ex.: 5136,26"
                                className="bg-white border-neutral-300 h-9 mt-1 font-mono"
                                inputMode="decimal"
                              />
                              <p className="text-[10px] text-neutral-500 normal-case mt-1">
                                Total catálogo: {money(precoCatalogo)}. O catálogo NÃO será alterado.
                              </p>
                              {temDiferencaPacote && (
                                <p className={`text-[11px] normal-case mt-1 ${diferencaPacoteValor < 0 ? "text-emerald-600" : "text-amber-700"}`}>
                                  Diferença: {money(diferencaPacoteValor)} ({percentualDifPacote > 0 ? "+" : ""}{percentualDifPacote}%)
                                </p>
                              )}
                            </div>
                            <div className="text-[11px] normal-case">
                              <Label className="text-[11px] text-neutral-600">
                                {modoPacoteCustoFin
                                  ? "Serviços mantidos pelo valor de catálogo"
                                  : temDiferencaPacote
                                    ? "Distribuição interna do ajuste comercial"
                                    : "Distribuição interna (auditoria)"}
                              </Label>
                              <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-neutral-600">
                                {servico && (
                                  <li>• {servico.slug}: {money(precoAplicadoPrincipal)}</li>
                                )}
                                {extrasAvaliados.map((e) => (
                                  <li key={e.ie.servico.id}>• {e.ie.servico.slug}: {money(e.aplicado)}</li>
                                ))}
                              </ul>
                              {modoPacoteCustoFin && (
                                <p className="text-[10px] text-neutral-500 mt-1 normal-case">
                                  Diferença registrada como custo financeiro da adquirente.
                                </p>
                              )}
                            </div>
                          </div>

                          {temDiferencaPacote && (
                            <div className="rounded border border-amber-300 bg-white/60 p-2 space-y-2">
                              <Label className="text-[11px] text-neutral-700 font-semibold">
                                Como tratar a diferença entre catálogo e valor final? <span className="text-rose-600">*</span>
                              </Label>
                              <label className="flex items-start gap-2 cursor-pointer text-[11px] normal-case">
                                <input
                                  type="radio"
                                  className="mt-0.5"
                                  name="tipo_diferenca_pacote"
                                  checked={tipoDiferencaPacote === "ajuste_comercial"}
                                  onChange={() => setTipoDiferencaPacote("ajuste_comercial")}
                                />
                                <span>
                                  <strong>Desconto/acréscimo comercial nos serviços.</strong> A diferença
                                  é distribuída proporcionalmente entre os itens (auditoria interna). O
                                  contrato exibe o valor final do pacote como preço dos serviços.
                                </span>
                              </label>
                              <label className="flex items-start gap-2 cursor-pointer text-[11px] normal-case">
                                <input
                                  type="radio"
                                  className="mt-0.5"
                                  name="tipo_diferenca_pacote"
                                  checked={tipoDiferencaPacote === "custo_financeiro_adquirente"}
                                  onChange={() => setTipoDiferencaPacote("custo_financeiro_adquirente")}
                                />
                                <span>
                                  <strong>Custo financeiro / juros / taxa da adquirente.</strong> Os
                                  serviços mantêm o preço de catálogo; a diferença é registrada como
                                  custo financeiro da adquirente e o contrato deixa isso explícito na
                                  cláusula de pagamento.
                                </span>
                              </label>
                            </div>
                          )}

                          {modoPacoteCustoFin && temDiferencaPacote && (
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[11px] text-neutral-600">Adquirente <span className="text-rose-600">*</span></Label>
                                <Input
                                  value={adquirentePacote}
                                  onChange={(e) => setAdquirentePacote(e.target.value)}
                                  placeholder="Ex.: STONE"
                                  className="bg-white border-neutral-300 h-9 mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px] text-neutral-600">Parcelas <span className="text-rose-600">*</span></Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={24}
                                  value={parcelasPacote}
                                  onChange={(e) => setParcelasPacote(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                                  className="bg-white border-neutral-300 h-9 mt-1 font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px] text-neutral-600">Valor da parcela</Label>
                                <div className="font-mono text-sm mt-2">{money(valorParcelaPacote)}</div>
                              </div>
                              <div className="col-span-3 text-[11px] normal-case text-neutral-600 grid grid-cols-3 gap-3">
                                <div><span className="text-neutral-500">Serviços (catálogo):</span> <span className="font-mono">{money(precoCatalogo)}</span></div>
                                <div><span className="text-neutral-500">Custo financeiro:</span> <span className="font-mono">{money(custoFinanceiroAdquirente)}</span></div>
                                <div><span className="text-neutral-500">Total parcelado:</span> <span className="font-mono">{money(valorFinalPacoteNum)}</span></div>
                              </div>
                            </div>
                          )}

                          {modoPacoteCustoFin && (
                            <div className="rounded border border-neutral-300 bg-white/70 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-[11px] text-neutral-700 font-semibold">
                                  Custos operacionais embutidos no parcelamento
                                </Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px]"
                                  onClick={() =>
                                    setCustosEmbutidos((prev) => [...prev, { descricao: "", valorStr: "" }])
                                  }
                                >
                                  + Adicionar custo
                                </Button>
                              </div>
                              <p className="text-[10px] text-neutral-500 normal-case">
                                Repasses de terceiros pagos pelo cliente e embutidos no parcelamento
                                (ex.: exames psicotécnico/toxicológico, GRU, taxas de despachante). NÃO são
                                serviços da CONTRATADA. Entram na Cláusula 1.A do contrato como custos
                                operacionais somados ao valor contratado, e o cálculo dos juros da
                                adquirente passa a considerar esse total.
                              </p>
                              {custosEmbutidos.length === 0 && (
                                <p className="text-[10px] text-neutral-400 normal-case italic">
                                  Nenhum custo embutido informado.
                                </p>
                              )}
                              {custosEmbutidos.map((c, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                                  <div>
                                    <Label className="text-[10px] text-neutral-500">Descrição</Label>
                                    <Input
                                      value={c.descricao}
                                      onChange={(e) =>
                                        setCustosEmbutidos((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, descricao: e.target.value } : x)),
                                        )
                                      }
                                      placeholder="Ex.: EXAMES PSICO+TOXI / GRU / DESPACHANTE"
                                      className="bg-white border-neutral-300 h-8 mt-1 text-[11px] uppercase"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px] text-neutral-500">Valor (R$)</Label>
                                    <Input
                                      value={c.valorStr}
                                      onChange={(e) =>
                                        setCustosEmbutidos((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, valorStr: e.target.value } : x)),
                                        )
                                      }
                                      placeholder="0,00"
                                      inputMode="decimal"
                                      className="bg-white border-neutral-300 h-8 mt-1 font-mono text-[11px]"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-[11px] text-rose-600 hover:text-rose-700"
                                    onClick={() =>
                                      setCustosEmbutidos((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                  >
                                    Remover
                                  </Button>
                                </div>
                              ))}
                              {custosEmbutidosValidos.length > 0 && (
                                <div className="grid grid-cols-3 gap-3 text-[11px] normal-case border-t border-neutral-200 pt-2">
                                  <div>
                                    <span className="text-neutral-500">Serviços (catálogo):</span>{" "}
                                    <span className="font-mono">{money(precoCatalogo)}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">Custos embutidos:</span>{" "}
                                    <span className="font-mono">{money(custosEmbutidosTotal)}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">Valor contratado (1.A.2):</span>{" "}
                                    <span className="font-mono">{money(valorContratadoPacote)}</span>
                                  </div>
                                  <div className="col-span-3 text-[10px] text-neutral-500">
                                    Juros/tarifa da adquirente = {money(valorFinalPacoteNum)} −{" "}
                                    {money(valorContratadoPacote)} ={" "}
                                    <span className="font-mono">{money(custoFinanceiroAdquirente)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {temDiferencaPacote && (
                            <div>
                              <Label className="text-[11px] text-neutral-600">
                                Motivo/observação do valor do pacote (mín. 20 caracteres) <span className="text-rose-600">*</span>
                              </Label>
                              <Textarea
                                value={motivoPacote}
                                onChange={(e) => setMotivoPacote(e.target.value)}
                                placeholder={
                                  modoPacoteCustoFin
                                    ? "Ex.: PARCELAMENTO EM 18X VIA STONE. DIFERENÇA É JUROS/TARIFA DA ADQUIRENTE, ITENS MANTIDOS PELO CATÁLOGO."
                                    : "Ex.: CONDIÇÃO NEGOCIADA CR + CURSO POP I EM PACOTE FECHADO COM DESCONTO COMERCIAL DE X%."
                                }
                                className="bg-white border-neutral-300 min-h-[70px] normal-case mt-1"
                              />
                              <div className="text-[10px] text-neutral-500 normal-case mt-1">
                                {motivoPacote.trim().length} caracteres
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                    <div className="text-xs font-semibold tracking-wide">
                      Preço aplicado {itensExtras.length > 0 ? "no pacote" : "nesta venda"}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs normal-case">
                      <div>
                        <Label className="text-[11px] text-neutral-500">
                          {itensExtras.length > 0 ? "Total catálogo (pacote)" : "Preço do catálogo"}
                        </Label>
                        <div className="font-mono text-sm mt-1">{money(precoCatalogo)}</div>
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">
                          {itensExtras.length > 0 ? "Total aplicado (pacote)" : "Preço sugerido"}
                        </Label>
                        <div className="font-mono text-sm mt-1">
                          {precoValido ? money(precoAplicadoNum) : money(precoCatalogo)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">
                          {itensExtras.length > 0 ? `Preço item principal (R$)` : "Preço aplicado (R$)"}
                        </Label>
                        <Input
                          value={precoAplicadoStr}
                          onChange={(e) => setPrecoAplicadoStr(e.target.value)}
                          placeholder="0,00"
                          className="bg-white border-neutral-300 h-9 mt-1 font-mono"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                    {itensExtras.length > 0 && (
                      <p className="text-[10px] text-neutral-500 normal-case border-t border-neutral-200 pt-2">
                        Total do pacote = item principal + itens adicionais (preços editáveis na seção acima).
                      </p>
                    )}
                    {precoValido && precoDiferente && (
                      <div className="text-[11px] normal-case border-t border-neutral-200 pt-2">
                        <div className={diferencaValor < 0 ? "text-emerald-600" : "text-amber-600"}>
                          Diferença: {money(diferencaValor)} ({percentualDif > 0 ? "+" : ""}{percentualDif}%)
                        </div>
                      </div>
                    )}
                    {precoValido && precoDiferente && !modoPacote && (
                      <>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <Label className="text-[11px] text-neutral-500">Tipo de ajuste</Label>
                            <select
                              value={tipoAjuste}
                              onChange={(e) => setTipoAjuste(e.target.value)}
                              className="w-full mt-1 bg-white border border-neutral-300 rounded h-9 px-2 text-xs uppercase"
                            >
                              {TIPOS_AJUSTE.map((t) => (
                                <option key={t.v} value={t.v}>{t.l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-neutral-500">Evidência (PDF/JPG/PNG/ZIP/RAR — opcional)</Label>
                            <Input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.zip,.rar,.7z,application/pdf,image/*,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed"
                              onChange={(e) => { setEvidenciaFile(e.target.files?.[0] ?? null); setEvidenciaPath(null); }}
                              className="bg-white border-neutral-300 h-9 mt-1 normal-case"
                            />
                            {evidenciaPath && (
                              <p className="text-[10px] text-emerald-600 normal-case mt-1">Salvo: {evidenciaPath}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-[11px] text-neutral-500">Motivo (mín. 20 caracteres — obrigatório)</Label>
                          <Textarea
                            value={motivoPreco}
                            onChange={(e) => setMotivoPreco(e.target.value)}
                            placeholder="Ex.: CONDIÇÃO NEGOCIADA VIA WHATSAPP EM 18/12/2025 — 18X DE R$285,35, TOTAL R$5.136,26."
                            className="bg-white border-neutral-300 min-h-[70px] normal-case mt-1"
                          />
                          <div className="text-[10px] text-neutral-500 normal-case mt-1">
                            {motivoPreco.trim().length} caracteres
                          </div>
                        </div>
                        <label className="flex items-start gap-2 text-[11px] normal-case cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={confirmadoPreco}
                            onChange={(e) => setConfirmadoPreco(e.target.checked)}
                          />
                          <span>
                            Confirmo que este preço foi acordado com o cliente e que a diferença em relação
                            ao catálogo está justificada. O catálogo NÃO será alterado — apenas esta venda.
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  <Button onClick={criarVenda} disabled={criandoVenda || arquivado || !podeCriarVenda}>
                    {criandoVenda
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…</>
                      : <>Criar venda oficial <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                  {precoDiferente && !podeCriarVenda && (
                    <p className="text-[11px] text-rose-600 normal-case">
                      {modoPacote
                        ? "Informe o motivo do pacote (≥20 caracteres) para prosseguir."
                        : "Preencha motivo (≥20), tipo de ajuste e marque a confirmação para prosseguir."}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm space-y-1">
                  <div>Venda <strong>#{venda.id}</strong> · Status: <strong>{venda.status}</strong></div>
                  <div className="text-xs text-neutral-600 normal-case">
                    Valor: {money(venda.valor_a_pagar)} · Cobrança: {venda.cobranca_status} · Validação: {venda.status_validacao_valor || "pendente"}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Passo 4 */}
          {venda && (
            <Card id="step-valor" title="4. Aprovar Valor" state={stepStates.valor}>
              {venda.status_validacao_valor === "aprovado" ? (
                <p className="text-xs text-emerald-400">Valor aprovado — evento gravado.</p>
              ) : (
                <Button onClick={aprovarValor} disabled={aprovando || arquivado || vinculoBloqueado}>
                  {aprovando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar valor da venda"}
                </Button>
              )}
            </Card>
          )}

          {/* Passo 5 */}
          {venda && venda.status_validacao_valor === "aprovado" && venda.cobranca_status !== "confirmada" && (
            <Card id="step-pagamento" title="5. Registrar Pagamento Manual" state={stepStates.pagamento}>
              <div className={`mb-3 rounded border p-3 text-xs normal-case ${vinculoBloqueado ? "border-rose-300 bg-rose-50 text-rose-800" : "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
                <div className="font-semibold uppercase tracking-wide mb-2">Conferência obrigatória do contratante</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500">Cliente do contrato</div>
                    <div><strong>Nome:</strong> {cliente?.nome_completo || "—"}</div>
                    <div><strong>CPF:</strong> {cliente?.cpf || "—"}</div>
                    <div><strong>E-mail:</strong> {cliente?.email || "—"}</div>
                    <div><strong>ID cliente:</strong> {cliente?.id ?? "—"}</div>
                    <div><strong>ID legado:</strong> {cliente?.id_legado ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500">Operador/staff</div>
                    <div><strong>Nome/e-mail:</strong> {profile?.nome || user?.email || "—"} / {profile?.email || user?.email || "—"}</div>
                    <div><strong>Perfil:</strong> {profile?.perfil || "—"}</div>
                    <div><strong>ID usuário:</strong> {user?.id ? user.id.slice(0, 8) : "—"}</div>
                    <div className="mt-1 font-semibold">O operador/staff NÃO é o contratante.</div>
                  </div>
                </div>
                {vinculoBloqueado && (
                  <div className="mt-2 font-semibold">
                    {motivoBloqueioVinculo} A geração do contrato está bloqueada.
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Forma de pagamento</Label>
                  <select
                    value={forma}
                    onChange={(e) => setForma(e.target.value)}
                    className="w-full mt-1 bg-neutral-50 border border-neutral-300 rounded h-9 px-2 text-sm uppercase"
                  >
                    {FORMAS_MANUAL.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number" min={1} max={24} value={parcelas}
                    onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                    className="bg-neutral-50 border-neutral-300"
                  />
                </div>
              </div>
              {parcelas > 1 && (
                <div className="grid grid-cols-2 gap-3 mt-3 border-t border-neutral-200 pt-3">
                  <div>
                    <Label className="text-xs">Adquirente (Stone, Rede, PagSeguro, Cielo, Asaas…)</Label>
                    <Input
                      value={adquirente}
                      onChange={(e) => setAdquirente(e.target.value)}
                      placeholder="Ex.: STONE"
                      className="bg-white border-neutral-300 uppercase mt-1"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      Valor bruto parcelado (com juros/tarifa) — R$
                    </Label>
                    <Input
                      value={valorBrutoStr}
                      onChange={(e) => setValorBrutoStr(e.target.value)}
                      placeholder="Ex.: 5136,26"
                      className="bg-white border-neutral-300 font-mono mt-1"
                      inputMode="decimal"
                    />
                    <p className="text-[10px] text-neutral-500 normal-case mt-1">
                      Total efetivamente cobrado no cartão (parcelas × valor da parcela). Só preencha se houver juros ou tarifa da adquirente — isso entra no contrato como cláusula 3.2.1/3.2.2.
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <Label className="text-xs">Observação (mín. 20 caracteres — obrigatória)</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: PAGAMENTO PIX RECEBIDO EM 17/07 CONFORME COMPROVANTE ANEXO."
                  className="bg-white border-neutral-300 min-h-[80px] normal-case"
                />
                <div className="text-xs text-neutral-500 normal-case mt-1">{observacao.trim().length} caracteres</div>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Comprovante (PDF/JPG/PNG — obrigatório)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        const name = f.name.toLowerCase();
                        if (/\.(zip|rar|7z)$/i.test(name)) {
                          toast.error("Comprovante de pagamento deve ser PDF/JPG/PNG. Use o campo Evidência (passo 3) para arquivos ZIP/RAR do WhatsApp.");
                          e.target.value = "";
                          setComprovante(null);
                          setComprovantePath(null);
                          return;
                        }
                      }
                      setComprovante(f);
                      setComprovantePath(null);
                    }}
                    className="bg-white border-neutral-300 normal-case"
                  />
                  {comprovantePath && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
                <p className="text-[10px] text-neutral-500 normal-case mt-1">
                  Arquivos ZIP/RAR (export do WhatsApp) devem ser anexados no passo 3 como
                  <strong> Evidência de negociação</strong>, não como comprovante.
                </p>
                {comprovantePath && (
                  <p className="text-xs text-emerald-500 normal-case mt-1">Salvo em: {comprovantePath}</p>
                )}
              </div>
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-500" onClick={() => confirmarPagamento()} disabled={confirmandoPag || arquivado || vinculoBloqueado}>
                {confirmandoPag ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando…</> : <><Upload className="h-4 w-4 mr-2" /> Confirmar pagamento e gerar contrato</>}
              </Button>
              <p className="text-[10px] text-neutral-500 normal-case mt-2">
                Ao confirmar: qa_vendas.status=PAGO, evento imutável em qa_venda_eventos, auditoria em qa_pagamento_auditoria, pipeline
                pós-pagamento canônico (protocolo + qa-generate-contract + notificações).
              </p>
            </Card>
          )}

          {/* Passo 6 */}
          {venda?.cobranca_status === "confirmada" && (
            <Card id="step-contrato" title="6. Contrato · Assinatura · Liberação" state={stepStates.contrato}>
              {vinculoBloqueado && (
                <div className="mb-3 rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 normal-case">
                  <strong>Continuação bloqueada:</strong> {motivoBloqueioVinculo} Use apenas a opção de arquivar piloto abaixo.
                </div>
              )}
              {!contrato ? (
                <div className="flex items-center gap-2 text-xs text-neutral-600 normal-case">
                  <Loader2 className="h-4 w-4 animate-spin" /> Aguardando geração do contrato…
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>Contrato <code className="normal-case">{contrato.id.slice(0, 8)}</code> · Status: <strong>{contrato.status}</strong></div>
                  {linkContratoCliente && (
                    <div className="flex items-center gap-2 normal-case">
                      <Input value={linkContratoCliente} readOnly className="bg-white border-neutral-300 text-xs" />
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(linkContratoCliente); toast.success("Link copiado"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={linkContratoCliente} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-neutral-600 normal-case">
                    O cliente entra no portal, assina digitalmente e faz upload do contrato assinado (qa-upload-signed-contract →
                    qa-validate-customer-signature). Quando o contrato ficar <strong>validated</strong>, o trigger
                    qa_contracts_after_validated_release aciona qa-liberar-servicos-contrato automaticamente.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => venda && recarregarContrato(venda.id)}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Atualizar status
                  </Button>

                  {processos.length > 0 && (
                    <div className="mt-3 border-t border-neutral-200 pt-3">
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Processo(s) criados pela liberação oficial:
                      </div>
                      <ul className="mt-2 space-y-1">
                        {processos.map((p) => (
                          <li key={p.id} className="text-xs normal-case">
                            <FileText className="h-3 w-3 inline mr-1" />
                            <code>{p.id.slice(0, 8)}</code> · status {p.status ?? "—"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Upload assistido pela equipe */}
                  {!arquivado && !vinculoBloqueado && !["validated","customer_signed"].includes(contrato.status) && (
                    <div className="mt-4 border-t border-neutral-200 pt-3 space-y-2">
                      <div className="text-xs font-semibold tracking-wide">
                        Upload assistido pela equipe (WhatsApp / e-mail / presencial)
                      </div>
                      <p className="text-[11px] text-neutral-600 normal-case">
                        Use esta opção apenas quando o cliente enviar o contrato assinado por fora do portal.
                        O envio é marcado como <code>upload_assistido_por_staff=true</code> e cai na MESMA
                        validação oficial (qa-validate-customer-signature). O contrato só chega em <strong>validated</strong> se
                        a validação oficial aprovar.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Origem</Label>
                          <select
                            value={origemAssinado}
                            onChange={(e) => setOrigemAssinado(e.target.value)}
                            className="w-full mt-1 bg-neutral-50 border border-neutral-300 rounded h-9 px-2 text-xs uppercase"
                          >
                            <option>WhatsApp</option>
                            <option>E-mail</option>
                            <option>Presencial</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">PDF assinado (máx. 25MB)</Label>
                          <Input
                            type="file" accept=".pdf"
                            onChange={(e) => setAssinado(e.target.files?.[0] ?? null)}
                            className="bg-white border-neutral-300 normal-case"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Observação (mín. 20 caracteres — obrigatória)</Label>
                        <Textarea
                          value={obsAssinado}
                          onChange={(e) => setObsAssinado(e.target.value)}
                          placeholder="Ex.: CONTRATO ASSINADO RECEBIDO POR WHATSAPP EM 17/07 CONFIRMADO COM O CLIENTE."
                          className="bg-white border-neutral-300 min-h-[70px] normal-case"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={enviarContratoAssinadoStaff}
                        disabled={enviandoAssinado || !assinado}
                        className="bg-amber-600 hover:bg-amber-500"
                      >
                        {enviandoAssinado
                          ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando…</>
                          : <><Upload className="h-4 w-4 mr-1" /> Enviar contrato assinado (staff-assistido)</>}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Arquivar Piloto */}
          {venda && (
            <Card title={arquivado ? "Piloto Arquivado" : "Arquivar Piloto"} state={arquivado ? "blocked" : "pending"}>
              {arquivado ? (
                <p className="text-xs text-rose-400 normal-case">
                  Piloto arquivado. Novas ações do wizard estão bloqueadas — apenas visualização/auditoria.
                </p>
              ) : !mostrarArq ? (
                <Button size="sm" variant="outline" onClick={() => setMostrarArq(true)} className="border-rose-400 text-rose-600 hover:bg-rose-50">
                  <Archive className="h-4 w-4 mr-1" /> Arquivar piloto
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-neutral-600 normal-case">
                    Nada será apagado. Venda/itens ficam CANCELADO, contrato recebe <code>arquivado_em</code>,
                    processos (se existirem) ficam <code>cancelado</code>, e um evento imutável <code>venda_arquivada_piloto</code> é registrado.
                  </p>
                  <Label className="text-xs">Motivo (mín. 20 caracteres — obrigatório)</Label>
                  <Textarea
                    value={motivoArq}
                    onChange={(e) => setMotivoArq(e.target.value)}
                    placeholder="Ex.: TESTE ENCERRADO — CLIENTE DESISTIU E VAI RECONTRATAR NO FLUXO NORMAL."
                    className="bg-white border-neutral-300 min-h-[70px] normal-case"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setMostrarArq(false); setMotivoArq(""); }}>Cancelar</Button>
                    <Button size="sm" onClick={arquivarPiloto} disabled={arquivando} className="bg-rose-600 hover:bg-rose-500">
                      {arquivando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar arquivamento"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Auditoria (somente leitura) */}
          {venda && (
            <Card title="Auditoria do Piloto (somente leitura)" state="pending">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-neutral-600 normal-case">
                  Eventos vinculados a esta venda
                  {contrato ? `, contrato ${contrato.id.slice(0, 8)}` : ""}
                  {processos.length > 0 ? ` e ${processos.length} processo(s)` : ""}.
                  Fontes: <code>qa_venda_eventos</code>, <code>qa_pagamento_auditoria</code>,
                  <code> qa_contract_events</code>, <code>qa_processo_eventos</code>.
                </p>
                <Button size="sm" variant="outline" onClick={carregarAuditoria} disabled={carregandoAudit}>
                  {carregandoAudit ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" /> Atualizar</>}
                </Button>
              </div>
              {auditRows.length === 0 && !carregandoAudit && (
                <p className="text-xs text-neutral-500 normal-case">Nenhum evento ainda.</p>
              )}
              <div className="max-h-[420px] overflow-auto border border-neutral-200 rounded">
                <table className="w-full text-[11px] normal-case">
                  <thead className="bg-neutral-100 text-neutral-600 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1">Data/Hora</th>
                      <th className="text-left px-2 py-1">Fonte</th>
                      <th className="text-left px-2 py-1">Tipo</th>
                      <th className="text-left px-2 py-1">Ator</th>
                      <th className="text-left px-2 py-1">Referência</th>
                      <th className="text-left px-2 py-1">Dados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((r) => {
                      const dt = new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
                      const isOpen = !!expandido[r.id];
                      const dadosStr = r.dados ? JSON.stringify(r.dados) : "";
                      const preview = dadosStr.length > 80 ? dadosStr.slice(0, 80) + "…" : dadosStr;
                      return (
                        <tr key={r.id} className="border-t border-neutral-200 align-top">
                          <td className="px-2 py-1 whitespace-nowrap">{dt}</td>
                          <td className="px-2 py-1"><code className="text-[10px]">{r.fonte}</code></td>
                          <td className="px-2 py-1 font-semibold">{r.tipo}</td>
                          <td className="px-2 py-1">
                            {r.ator || "—"}
                            {r.user_id && <div className="text-[9px] text-neutral-500">{r.user_id.slice(0, 8)}</div>}
                          </td>
                          <td className="px-2 py-1">{r.ref}</td>
                          <td className="px-2 py-1">
                            {dadosStr ? (
                              <button
                                type="button"
                                onClick={() => setExpandido((p) => ({ ...p, [r.id]: !isOpen }))}
                                className="text-left text-neutral-700 hover:text-neutral-900"
                              >
                                {isOpen ? (
                                  <pre className="text-[10px] bg-neutral-50 border border-neutral-200 rounded p-2 max-w-[420px] whitespace-pre-wrap break-all">
                                    {JSON.stringify(r.dados, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-neutral-500">{preview || "—"}</span>
                                )}
                              </button>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar Checklist */}
        <aside className="border border-neutral-200 rounded bg-white p-4 h-fit sticky top-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3 tracking-wide">Checklist do Piloto</h2>
          <ol className="space-y-2 text-xs">
            <ChecklistItem state={stepStates.cliente} label="Cliente real selecionado" />
            <ChecklistItem state={stepStates.servico} label="Serviço escolhido no catálogo" />
            <ChecklistItem state={stepStates.venda} label="Venda + itens criados (checkout oficial)" />
            <ChecklistItem state={stepStates.valor} label="Valor aprovado (RPC oficial)" />
            <ChecklistItem state={stepStates.pagamento} label="Pagamento manual confirmado + comprovante" />
            <ChecklistItem state={stepStates.contrato} label="Contrato gerado / assinado / validado" />
            <ChecklistItem state={stepStates.liberacao} label="Processo + checklist liberados" />
          </ol>
          <div className="mt-4 border-t border-neutral-200 pt-3 text-[10px] text-neutral-500 normal-case leading-relaxed">
            <ShieldAlert className="h-3 w-3 inline mr-1 text-amber-400" />
            Fluxo baseado em Lei 10.826/03, Dec. 11.615/23, Dec. 12.345/24 e IN 201/311.
            Nenhum passo faz UPDATE manual solto — tudo passa por RPC/Edge oficial.
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-3">
            <h3 className="text-xs font-semibold tracking-wide mb-2 flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-emerald-400" /> Smoke Test
            </h3>
            <p className="text-[10px] text-neutral-500 normal-case mb-2">
              Cria venda descartável, chama confirmação manual 2x, valida idempotência e arquiva. Rode antes de cliente real.
            </p>
            <Button size="sm" variant="outline" onClick={rodarSmokeTest} disabled={rodandoSmoke} className="w-full">
              {rodandoSmoke ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Rodando…</> : "Executar smoke test"}
            </Button>
            {smokeResult && (
              <div className="mt-2 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-neutral-600">Resultado</span>
                  <button
                    type="button"
                    onClick={copiarSmokeResult}
                    title="Copiar resultado"
                    className="inline-flex items-center gap-1 text-[10px] text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded px-1.5 py-0.5 bg-white"
                  >
                    {smokeCopiado ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {smokeCopiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <pre className="text-[9px] bg-neutral-100 border border-neutral-200 rounded p-2 max-h-64 overflow-auto normal-case">
                  {JSON.stringify(smokeResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={confirmacaoContratoAberta} onOpenChange={(open) => { setConfirmacaoContratoAberta(open); if (!open) setConfirmacaoVinculoMarcada(false); }}>
        <DialogContent className="max-w-md bg-white border-neutral-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wide">Confirmar cliente do contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs normal-case text-neutral-700">
            <div className="rounded border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-[10px] uppercase text-neutral-500 mb-1">Cliente do contrato</div>
              <div><strong>Nome:</strong> {cliente?.nome_completo || "—"}</div>
              <div><strong>CPF:</strong> {cliente?.cpf || "—"}</div>
              <div><strong>E-mail:</strong> {cliente?.email || "—"}</div>
              <div><strong>ID cliente:</strong> {cliente?.id ?? "—"}</div>
              <div><strong>ID legado:</strong> {cliente?.id_legado ?? "—"}</div>
            </div>
            <div className="rounded border border-amber-300 bg-amber-50 p-3">
              <div className="text-[10px] uppercase text-amber-800 mb-1">Operador/staff</div>
              <div><strong>Nome/e-mail:</strong> {profile?.nome || user?.email || "—"} / {profile?.email || user?.email || "—"}</div>
              <div><strong>Perfil:</strong> {profile?.perfil || "—"}</div>
              <div><strong>ID usuário:</strong> {user?.id ? user.id.slice(0, 8) : "—"}</div>
              <div className="mt-2 font-semibold text-amber-900">O operador/staff NÃO é o contratante.</div>
            </div>
            {vinculoBloqueado ? (
              <div className="rounded border border-rose-300 bg-rose-50 p-3 text-rose-800 font-semibold">
                {motivoBloqueioVinculo} Arquive este piloto e gere uma nova venda para o cliente correto.
              </div>
            ) : (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmacaoVinculoMarcada}
                  onChange={(e) => setConfirmacaoVinculoMarcada(e.target.checked)}
                />
                <span>
                  Confirmo que o contrato será gerado para o cliente acima e que o operador/staff não é o contratante.
                </span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirmacaoContratoAberta(false)} disabled={confirmandoPag}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => confirmarPagamento(true)}
              disabled={confirmandoPag || !confirmacaoVinculoMarcada || vinculoBloqueado}
            >
              {confirmandoPag ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando…</> : "Confirmar e gerar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ id, title, state, children }: { id?: string; title: string; state: "done" | "pending" | "current" | "blocked"; children: React.ReactNode }) {
  return (
    <section id={id} className="border border-neutral-200 rounded bg-white p-4 shadow-sm scroll-mt-4">
      <div className="flex items-center gap-2 mb-3">
        {statusDot(state)}
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChecklistItem({ state, label }: { state: "done" | "pending" | "current" | "blocked"; label: string }) {
  const Icon = state === "done" ? CheckCircle2 : Circle;
  const color = state === "done" ? "text-emerald-500" : state === "current" ? "text-amber-400" : "text-neutral-600";
  return (
    <li className={`flex items-center gap-2 normal-case ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </li>
  );
}