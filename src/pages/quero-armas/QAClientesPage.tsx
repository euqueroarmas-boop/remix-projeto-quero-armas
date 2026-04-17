import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, User, Phone, Mail, MapPin, FileText, Shield, ChevronLeft,
  Loader2, Eye, Plus, Crosshair, Edit, Trash2, Download, FileDown,
  ChevronDown, ChevronUp, Save, X, CheckCircle, TrendingUp, KeyRound, PenTool,
  HeartPulse,
} from "lucide-react";

import { toast } from "sonner";
import ClienteFormModal from "@/components/quero-armas/clientes/ClienteFormModal";
import ClienteOverview from "@/components/quero-armas/clientes/ClienteOverview";
import { CrafModal, GteModal, CrModal, VendaModal, FiliacaoModal, DeleteConfirm } from "@/components/quero-armas/clientes/SubEntityModals";
import { exportClientes, exportCrafs, exportGtes, exportCr, exportVendas } from "@/components/quero-armas/clientes/ClienteExport";
import ClienteAcessoPortal from "@/components/quero-armas/clientes/ClienteAcessoPortal";
import ClientePecas from "@/components/quero-armas/clientes/ClientePecas";
import ClienteExames from "@/components/quero-armas/clientes/ClienteExames";
import { getClienteFK, getVendaFK } from "@/components/quero-armas/clientes/clientFK";

const formatCpf = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length !== 11) return v;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const normalizeRgInput = (v: string | null | undefined): string => {
  const raw = (v ?? "").toUpperCase().replace(/[^0-9X]/g, "");
  const hasVerifierX = raw.endsWith("X");
  const digits = raw.replace(/X/g, "");
  return hasVerifierX ? `${digits.slice(0, 8)}X` : digits.slice(0, 9);
};

const maskRg = (v: string | null | undefined): string => {
  const d = normalizeRgInput(v);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
};

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface Cliente {
  id: number; id_legado: number; nome_completo: string; cpf: string; rg: string; emissor_rg: string;
  uf_emissor_rg?: string;
  data_nascimento: string; naturalidade: string; nacionalidade: string; nome_mae: string; nome_pai: string;
  estado_civil: string; profissao: string; email: string; celular: string; endereco: string; numero: string;
  bairro: string; cep: string; cidade: string; estado: string; observacao: string; complemento: string;
  status: string; cliente_lions: boolean; created_at: string; escolaridade?: string; titulo_eleitor?: string;
  endereco2?: string; numero2?: string; bairro2?: string; cep2?: string; cidade2?: string; estado2?: string;
  complemento2?: string; pais?: string; pais2?: string; expedicao_rg?: string;
}

interface CadastroPublico {
  id: string;
  nome_completo: string;
  cpf: string;
  rg?: string | null;
  emissor_rg?: string | null;
  data_nascimento?: string | null;
  telefone_principal?: string | null;
  telefone_secundario?: string | null;
  email?: string | null;
  nome_mae?: string | null;
  nome_pai?: string | null;
  estado_civil?: string | null;
  nacionalidade?: string | null;
  profissao?: string | null;
  observacoes?: string | null;
  end1_cep?: string | null;
  end1_logradouro?: string | null;
  end1_numero?: string | null;
  end1_complemento?: string | null;
  end1_bairro?: string | null;
  end1_cidade?: string | null;
  end1_estado?: string | null;
  tem_segundo_endereco?: boolean | null;
  end2_tipo?: string | null;
  end2_cep?: string | null;
  end2_logradouro?: string | null;
  end2_numero?: string | null;
  end2_complemento?: string | null;
  end2_bairro?: string | null;
  end2_cidade?: string | null;
  end2_estado?: string | null;
  vinculo_tipo?: string | null;
  emp_cnpj?: string | null;
  emp_razao_social?: string | null;
  emp_nome_fantasia?: string | null;
  emp_situacao_cadastral?: string | null;
  emp_cargo_funcao?: string | null;
  emp_participacao_societaria?: string | null;
  emp_endereco?: string | null;
  emp_telefone?: string | null;
  emp_email?: string | null;
  trab_nome_empresa?: string | null;
  trab_cnpj_empresa?: string | null;
  trab_cargo_funcao?: string | null;
  trab_data_admissao?: string | null;
  trab_faixa_salarial?: string | null;
  trab_endereco_empresa?: string | null;
  trab_telefone_empresa?: string | null;
  aut_atividade?: string | null;
  aut_nome_profissional?: string | null;
  aut_cnpj?: string | null;
  aut_telefone?: string | null;
  aut_endereco?: string | null;
  comprovante_endereco_proprio?: string | null;
  servico_interesse?: string | null;
  consentimento_dados_verdadeiros?: boolean | null;
  consentimento_tratamento_dados?: boolean | null;
  consentimento_timestamp?: string | null;
  status: string;
  created_at: string;
}

const normalizeDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

const emptyToNull = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

const pickNew = (incoming: string | null | undefined, current: string | null | undefined) => {
  const next = emptyToNull(incoming);
  return next ?? current ?? null;
};

/** Build update payload from cadastro público → qa_clientes. NEVER touches observacao when current has content. */
const buildClientePayload = (cadastro: CadastroPublico, cur?: Partial<Cliente> | null) => {
  const estado1 = emptyToNull(cadastro.end1_estado)?.toUpperCase() ?? null;
  const estado2 = emptyToNull(cadastro.end2_estado)?.toUpperCase() ?? null;
  // Protect observacao: if current already has process numbers, keep it
  const currentObs = emptyToNull(cur?.observacao);
  const incomingObs = emptyToNull(cadastro.observacoes);
  const observacao = currentObs
    ? (incomingObs && incomingObs !== currentObs ? `${currentObs}\n\n--- Cadastro público ---\n${incomingObs}` : currentObs)
    : incomingObs;
  return {
    nome_completo: pickNew(cadastro.nome_completo, cur?.nome_completo) ?? "",
    cpf: normalizeDigits(cadastro.cpf) || cur?.cpf || null,
    rg: pickNew(cadastro.rg, cur?.rg),
    emissor_rg: pickNew(cadastro.emissor_rg, cur?.emissor_rg),
    uf_emissor_rg: emptyToNull((cadastro as any).uf_emissor_rg)?.toUpperCase() ?? cur?.uf_emissor_rg ?? null,
    data_nascimento: pickNew(cadastro.data_nascimento, cur?.data_nascimento),
    nacionalidade: pickNew(cadastro.nacionalidade, cur?.nacionalidade),
    estado_civil: pickNew(cadastro.estado_civil, cur?.estado_civil),
    profissao: pickNew(cadastro.profissao, cur?.profissao),
    nome_mae: pickNew(cadastro.nome_mae, cur?.nome_mae),
    nome_pai: pickNew(cadastro.nome_pai, cur?.nome_pai),
    email: pickNew(cadastro.email, cur?.email),
    celular: pickNew(cadastro.telefone_principal, cur?.celular),
    endereco: pickNew(cadastro.end1_logradouro, cur?.endereco),
    numero: pickNew(cadastro.end1_numero, cur?.numero),
    complemento: pickNew(cadastro.end1_complemento, cur?.complemento),
    bairro: pickNew(cadastro.end1_bairro, cur?.bairro),
    cep: pickNew(normalizeDigits(cadastro.end1_cep) || emptyToNull(cadastro.end1_cep), cur?.cep),
    cidade: pickNew(cadastro.end1_cidade, cur?.cidade),
    estado: pickNew(estado1, cur?.estado),
    endereco2: pickNew(cadastro.end2_logradouro, cur?.endereco2),
    numero2: pickNew(cadastro.end2_numero, cur?.numero2),
    complemento2: pickNew(cadastro.end2_complemento, cur?.complemento2),
    bairro2: pickNew(cadastro.end2_bairro, cur?.bairro2),
    cep2: pickNew(normalizeDigits(cadastro.end2_cep) || emptyToNull(cadastro.end2_cep), cur?.cep2),
    cidade2: pickNew(cadastro.end2_cidade, cur?.cidade2),
    estado2: pickNew(estado2, cur?.estado2),
    observacao,
    status: cur?.status ?? "ATIVO",
    cliente_lions: cur?.cliente_lions ?? false,
  };
};

export default function QAClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [tab, setTab] = useState("resumo");

  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
  const [examesAtuais, setExamesAtuais] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Modal states
  const [clienteModal, setClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [crafModal, setCrafModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [gteModal, setGteModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [crModal, setCrModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [vendaModal, setVendaModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [filiacaoModal, setFiliacaoModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; table: string; id: number; title: string; desc: string }>({ open: false, table: "", id: 0, title: "", desc: "" });
  const [deleting, setDeleting] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [itemEditForm, setItemEditForm] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState(false);

  // Serviços CAC (Colecionador, Atirador, Caçador) e correlatos onde campos SIGMA/CR/CRAF/Porte/GTE são aplicáveis
  const SERVICOS_CAC = [3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 16, 17, 18, 20];
  // Serviço de Posse na Polícia Federal
  const SERVICOS_POSSE = [2];

  const ITEM_EDIT_FIELDS: { key: string; label: string; type: "date" | "text"; servicos?: number[] }[] = [
    { key: "data_protocolo", label: "Data Protocolo", type: "date" },
    { key: "data_deferimento", label: "Data Deferimento", type: "date" },
    { key: "data_vencimento", label: "Data Vencimento", type: "date" },
    { key: "numero_processo", label: "Nº Processo", type: "text" },
    // Campos exclusivos de CAC — NÃO aparecem em Posse na Polícia Federal
    { key: "numero_craf", label: "Nº CRAF", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_gte", label: "Nº GTE", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_cr", label: "Nº CR", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_porte", label: "Nº Porte", type: "text", servicos: [3, ...SERVICOS_CAC] },
    { key: "numero_sigma", label: "Nº SIGMA", type: "text", servicos: SERVICOS_CAC },
    { key: "numero_sinarm", label: "Nº SINARM", type: "text", servicos: SERVICOS_CAC },
    { key: "registro_cad", label: "Registro CAD", type: "text", servicos: SERVICOS_CAC },
    // Específico de Posse na Polícia Federal
    { key: "numero_posse", label: "Nº do Requerimento de Posse", type: "text", servicos: SERVICOS_POSSE },
    // Específicos de Posse / Autorização de compra de arma de fogo
    { key: "numero_autorizacao", label: "Nº Autorização", type: "text", servicos: [2, 5, 15] },
    { key: "validade_autorizacao", label: "Validade Autorização", type: "date", servicos: [2, 5, 15] },
  ];

  /** Retorna apenas os campos aplicáveis ao serviço (filtra por servico_id quando definido). */
  const getFieldsForServico = (servicoId: number | null | undefined) =>
    ITEM_EDIT_FIELDS.filter(f => !f.servicos || (servicoId != null && f.servicos.includes(servicoId)));

  const handleExpandItem = (item: any) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      setItemEditForm({});
      return;
    }
    setExpandedItemId(item.id);
    const form: Record<string, string> = {};
    ITEM_EDIT_FIELDS.forEach(f => {
      const val = item[f.key];
      if (f.type === "date" && val) {
        try { form[f.key] = new Date(val).toLocaleDateString("pt-BR"); } catch { form[f.key] = val || ""; }
      } else {
        form[f.key] = val || "";
      }
    });
    setItemEditForm(form);
  };

  /** Máscara automática DD/MM/AAAA */
  const applyDateMask = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  /** Converte DD/MM/AAAA → YYYY-MM-DD para gravar no banco (tipo date) */
  const dateBrToIso = (v: string): string | null => {
    if (!v) return null;
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSaveItem = async () => {
    if (!expandedItemId) return;
    setSavingItem(true);
    try {
      const payload: Record<string, any> = {};
      ITEM_EDIT_FIELDS.forEach(f => {
        const v = itemEditForm[f.key]?.trim() || null;
        if (f.type === "date") {
          payload[f.key] = v ? dateBrToIso(v) : null;
        } else {
          payload[f.key] = v;
        }
      });
      const today = new Date();
      payload.data_ultima_atualizacao = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { error } = await supabase.from("qa_itens_venda" as any).update(payload).eq("id", expandedItemId);
      if (error) throw error;
      setItens(prev => prev.map((i: any) => i.id === expandedItemId ? { ...i, ...payload } : i));
      toast.success("Dados do serviço atualizados");
      setExpandedItemId(null);
      setItemEditForm({});
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!item?.id) return;
    const nome = (() => {
      const svc = (servicos as any[]).find(s => s.id === item.servico_id);
      return svc?.nome_servico || `Serviço #${item.servico_id}`;
    })();
    if (!window.confirm(`Excluir o item "${nome}" (R$ ${Number(item.valor || 0).toFixed(2)}) desta venda?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from("qa_itens_venda" as any).delete().eq("id", item.id);
      if (error) throw error;
      // Recalcula total da venda (soma dos itens restantes - desconto)
      const venda = (vendas as any[]).find(v => (v.id_legado ?? v.id) === item.venda_id);
      if (venda) {
        const restantes = (itens as any[]).filter(i => i.venda_id === item.venda_id && i.id !== item.id);
        const subtotal = restantes.reduce((s, i) => s + Number(i.valor || 0), 0);
        const desconto = Number(venda.desconto || 0);
        const novoTotal = Math.max(0, subtotal - desconto);
        await supabase.from("qa_vendas" as any).update({ valor_a_pagar: novoTotal, valor_total: subtotal }).eq("id", venda.id);
        setVendas(prev => (prev as any[]).map(v => v.id === venda.id ? { ...v, valor_a_pagar: novoTotal, valor_total: subtotal } : v));
      }
      setItens(prev => (prev as any[]).filter(i => i.id !== item.id));
      if (expandedItemId === item.id) { setExpandedItemId(null); setItemEditForm({}); }
      toast.success("Item excluído e total recalculado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir item");
    }
  };

  const [cadastrosPublicos, setCadastrosPublicos] = useState<CadastroPublico[]>([]);
  const [tabView, setTabView] = useState<"clientes" | "cadastros">("clientes");
  const [selectedCadastroPublico, setSelectedCadastroPublico] = useState<CadastroPublico | null>(null);
  const [loadingCadastroPublico, setLoadingCadastroPublico] = useState(false);
  const [savingCadastroPublicoStatus, setSavingCadastroPublicoStatus] = useState<string | null>(null);
  const [editingCadastroPublico, setEditingCadastroPublico] = useState(false);
  const [cadastroEditForm, setCadastroEditForm] = useState<Record<string, any>>({});
  const [savingCadastroEdit, setSavingCadastroEdit] = useState(false);
  const [servicos, setServicos] = useState<{ id: number; nome_servico: string }[]>([]);

  const dataLoadedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    loadClientes(); loadCadastrosPublicos(); loadServicos();
  }, []);

  // Auto-abrir cliente via ?cliente=ID (vindo do Dashboard de Exames, etc.)
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = searchParams.get("cliente");
    if (!targetId || autoOpenedRef.current || clientes.length === 0) return;
    // O Monitor envia o FK canônico (id_legado). Buscamos por id_legado primeiro,
    // com fallback para id quando o cliente não tiver id_legado.
    const targetNum = Number(targetId);
    const cli = clientes.find((c) => c.id_legado === targetNum) ?? clientes.find((c) => c.id === targetNum);
    if (cli) {
      autoOpenedRef.current = true;
      openClient(cli);
      const tabParam = searchParams.get("tab");
      if (tabParam) setTab(tabParam);
      // Limpa a URL para não reabrir ao navegar
      const next = new URLSearchParams(searchParams);
      next.delete("cliente");
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  }, [clientes, searchParams]);

  const loadServicos = async () => {
    const { data } = await supabase.from("qa_servicos" as any).select("id, nome_servico").order("id");
    if (data) setServicos(data as any[]);
  };

  const loadClientes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("qa_clientes" as any).select("*").order("nome_completo", { ascending: true });
      setClientes((data as any[]) ?? []);
    } catch (err) {
      console.error("[QAClientes] loadClientes error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCadastrosPublicos = async () => {
    const { data } = await supabase.from("qa_cadastro_publico" as any)
      .select("id, nome_completo, cpf, telefone_principal, email, end1_cidade, end1_estado, servico_interesse, vinculo_tipo, status, created_at")
      .order("created_at", { ascending: false });
    setCadastrosPublicos((data as unknown as CadastroPublico[]) ?? []);
  };

  const openCadastroPublico = async (cadastroId: string) => {
    setLoadingCadastroPublico(true);
    try {
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .select("*")
        .eq("id", cadastroId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Cadastro público não encontrado");
        return;
      }

      setSelected(null);
      setSelectedCadastroPublico(data as unknown as CadastroPublico);
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir cadastro público");
    } finally {
      setLoadingCadastroPublico(false);
    }
  };

  const updateCadastroPublicoStatus = async (status: string) => {
    if (!selectedCadastroPublico) return;

    setSavingCadastroPublicoStatus(status);
    try {
      const cpfDigits = normalizeDigits(selectedCadastroPublico.cpf);
      let clienteVinculadoId: number | null = null;

      if (status === "aprovado") {
        if (!cpfDigits || cpfDigits.length !== 11) {
          throw new Error("CPF inválido para vincular o cadastro ao cliente");
        }
        const cpfVariants = Array.from(new Set([cpfDigits, formatCpf(cpfDigits)]));
        const { data: clientesCpf, error: lookErr } = await supabase
          .from("qa_clientes" as any).select("*").in("cpf", cpfVariants)
          .order("updated_at", { ascending: false }).limit(10);
        if (lookErr) throw lookErr;
        const existing = (((clientesCpf as unknown) as Cliente[] | null) ?? [])[0] ?? null;
        const payload = buildClientePayload(selectedCadastroPublico, existing);

        if (existing) {
          const { error: ue } = await supabase.from("qa_clientes" as any).update(payload).eq("id", existing.id);
          if (ue) throw ue;
          clienteVinculadoId = existing.id;
        } else {
          const { data: ins, error: ie } = await supabase.from("qa_clientes" as any).insert(payload).select("id").single();
          if (ie) throw ie;
          clienteVinculadoId = ((ins as unknown) as { id?: number } | null)?.id ?? null;
        }
      }

      const updatePayload: Record<string, any> = { status };
      if (status === "aprovado") {
        updatePayload.cliente_id_vinculado = clienteVinculadoId;
        updatePayload.processado_em = new Date().toISOString();
        updatePayload.notas_processamento = clienteVinculadoId
          ? `Vinculado ao cliente #${clienteVinculadoId} por CPF.`
          : "Aprovado sem vínculo automático.";
      }

      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update(updatePayload)
        .eq("id", selectedCadastroPublico.id)
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Cadastro público não encontrado");
        return;
      }

      const updated = data as unknown as CadastroPublico;
      setSelectedCadastroPublico(updated);
      setCadastrosPublicos(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated } : item));
      if (status === "aprovado") {
        await loadClientes();
        toast.success(clienteVinculadoId
          ? `Cadastro aprovado e sincronizado com o cliente #${clienteVinculadoId}`
          : "Cadastro aprovado com sucesso");
      } else {
        toast.success(`Cadastro marcado como ${status}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar cadastro público");
    } finally {
      setSavingCadastroPublicoStatus(null);
    }
  };

  const startEditCadastro = () => {
    if (!selectedCadastroPublico) return;
    const c = selectedCadastroPublico;
    setCadastroEditForm({
      nome_completo: c.nome_completo || "",
      cpf: c.cpf || "",
      rg: c.rg || "",
      emissor_rg: c.emissor_rg || "",
      uf_emissor_rg: (c as any).uf_emissor_rg || "",
      data_nascimento: c.data_nascimento || "",
      estado_civil: c.estado_civil || "",
      nacionalidade: c.nacionalidade || "",
      profissao: c.profissao || "",
      nome_mae: c.nome_mae || "",
      nome_pai: c.nome_pai || "",
      telefone_principal: c.telefone_principal || "",
      telefone_secundario: c.telefone_secundario || "",
      email: c.email || "",
      end1_logradouro: c.end1_logradouro || "",
      end1_numero: c.end1_numero || "",
      end1_complemento: c.end1_complemento || "",
      end1_bairro: c.end1_bairro || "",
      end1_cep: c.end1_cep || "",
      end1_cidade: c.end1_cidade || "",
      end1_estado: c.end1_estado || "",
      end2_tipo: c.end2_tipo || "",
      end2_logradouro: c.end2_logradouro || "",
      end2_numero: c.end2_numero || "",
      end2_complemento: c.end2_complemento || "",
      end2_bairro: c.end2_bairro || "",
      end2_cep: c.end2_cep || "",
      end2_cidade: c.end2_cidade || "",
      end2_estado: c.end2_estado || "",
      observacoes: c.observacoes || "",
      vinculo_tipo: c.vinculo_tipo || "",
      servico_interesse: c.servico_interesse || "",
    });
    setEditingCadastroPublico(true);
  };

  const saveCadastroEdit = async () => {
    if (!selectedCadastroPublico) return;
    setSavingCadastroEdit(true);
    try {
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update(cadastroEditForm)
        .eq("id", selectedCadastroPublico.id)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const updated = data as unknown as CadastroPublico;
      setSelectedCadastroPublico(updated);
      setCadastrosPublicos(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated } : item));
      setEditingCadastroPublico(false);
      toast.success("Cadastro atualizado com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSavingCadastroEdit(false);
    }
  };

  const loadingClientRef = useRef<number | null>(null);

  const openClient = async (c: Cliente) => {
    if (loadingClientRef.current === c.id) return; // prevent double-click
    loadingClientRef.current = c.id;
    setSelectedCadastroPublico(null);
    setSelected(c);
    setTab("resumo");
    await loadSubData(c);
    loadingClientRef.current = null;
  };

  const loadSubData = useCallback(async (c: Cliente) => {
    setLoadingSub(true);
    try {
      // CHAVE CANÔNICA APROVADA: vendas/itens/crafs/gtes/cr/filiações usam id_legado.
      // Exames usam c.id (qa_exames_cliente.cliente_id ainda referencia o id real).
      const cid = getClienteFK(c);
      const examesQuery = supabase
        .from("qa_exames_cliente_status" as any)
        .select("*")
        .eq("cliente_id", c.id)
        .order("data_realizacao", { ascending: false });

      const [vRes, cRes, gRes, fRes, cadRes, exRes] = await Promise.all([
        supabase.from("qa_vendas" as any).select("*").eq("cliente_id", cid).order("data_cadastro", { ascending: false }),
        supabase.from("qa_crafs" as any).select("*").eq("cliente_id", cid),
        supabase.from("qa_gtes" as any).select("*").eq("cliente_id", cid),
        supabase.from("qa_filiacoes" as any).select("*").eq("cliente_id", cid),
        supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", cid).limit(1),
        examesQuery,
      ]);
      const vendasData = (vRes.data as any[]) ?? [];
      setVendas(vendasData);
      setCrafs((cRes.data as any[]) ?? []);
      setGtes((gRes.data as any[]) ?? []);
      setFiliacoes((fRes.data as any[]) ?? []);
      setCadastro((cadRes.data as any[])?.[0] ?? null);
      setExamesAtuais((exRes.data as any[]) ?? []);
      if (vendasData.length > 0) {
        // qa_itens_venda.venda_id referencia qa_vendas.id_legado (chave canônica).
        const vendaIds = vendasData.map((v: any) => getVendaFK(v));
        const { data: itensData } = await supabase.from("qa_itens_venda" as any).select("*").in("venda_id", vendaIds);
        setItens((itensData as any[]) ?? []);
      } else {
        setItens([]);
      }
    } catch (e: any) {
      console.error("[loadSubData] erro:", e.message);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setLoadingSub(false);
    }
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (deleteModal.table === "qa_clientes") {
        // Cascade: delete sub-entities first
        const clienteObj = clientes.find(c => c.id === deleteModal.id);
        const clienteId = clienteObj ? getClienteFK(clienteObj) : deleteModal.id;
        const { data: vendasCliente } = await supabase.from("qa_vendas" as any).select("id, id_legado").eq("cliente_id", clienteId);
        if (vendasCliente && vendasCliente.length > 0) {
          const vendaIds = (vendasCliente as any[]).map(v => getVendaFK(v));
          await supabase.from("qa_itens_venda" as any).delete().in("venda_id", vendaIds);
          await supabase.from("qa_vendas" as any).delete().eq("cliente_id", clienteId);
        }
        await Promise.all([
          supabase.from("qa_crafs" as any).delete().eq("cliente_id", clienteId),
          supabase.from("qa_gtes" as any).delete().eq("cliente_id", clienteId),
          supabase.from("qa_filiacoes" as any).delete().eq("cliente_id", clienteId),
        ]);
      }
      const { error } = await supabase.from(deleteModal.table as any).delete().eq("id", deleteModal.id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      if (deleteModal.table === "qa_clientes") {
        setClientes(prev => prev.filter(c => c.id !== deleteModal.id));
        setSelected(null);
      } else if (selected) {
        await loadSubData(selected);
      }
      setDeleteModal({ open: false, table: "", id: 0, title: "", desc: "" });
    } catch (e: any) { toast.error(e.message); } finally { setDeleting(false); }
  };

  const filtered = clientes.filter(c => {
    const s = search.toLowerCase();
    const sDigits = s.replace(/\D/g, "");
    if (!s) return true;
    if (c.nome_completo?.toLowerCase().includes(s)) return true;
    if (c.email?.toLowerCase().includes(s)) return true;
    if (sDigits && c.cpf?.replace(/\D/g, "").includes(sDigits)) return true;
    if (sDigits && c.celular?.replace(/\D/g, "").includes(sDigits)) return true;
    return false;
  });

  const filteredCadastros = cadastrosPublicos.filter(c => {
    const s = search.toLowerCase();
    const sDigits = s.replace(/\D/g, "");
    if (!s) return true;
    if (c.nome_completo?.toLowerCase().includes(s)) return true;
    if (c.email?.toLowerCase().includes(s)) return true;
    if (sDigits && c.cpf?.replace(/\D/g, "").includes(sDigits)) return true;
    if (sDigits && c.telefone_principal?.replace(/\D/g, "").includes(sDigits)) return true;
    return false;
  });

  const statusColor = (s: string) => s === "ATIVO" ? "text-emerald-600" : s === "DESISTENTE" ? "text-red-600" : "text-amber-600";
  const svcStatusColor = (s: string) => {
    if (s === "DEFERIDO" || s === "CONCLUÍDO") return "text-emerald-700 bg-emerald-50";
    if (s === "INDEFERIDO") return "text-red-700 bg-red-50";
    if (s === "EM ANÁLISE" || s === "PRONTO PARA ANÁLISE") return "text-amber-700 bg-amber-50";
    return "text-slate-600 bg-slate-100";
  };
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    // Already DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
    try {
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString("pt-BR");
    } catch { return d; }
  };
  const getServicoNome = (id: number) => {
    // Fonte de verdade: tabela qa_servicos (carregada via loadServicos).
    // Mapas hardcoded foram removidos pois divergiam dos IDs reais e exibiam nomes errados (ex: "Posse PF", "Serviço #23").
    const svc = (servicos as any[]).find(s => s.id === id);
    return svc?.nome_servico || `Serviço #${id}`;
  };

  const clienteIdForSub = selected ? getClienteFK(selected) : 0;

  // ── Detail View ──
  if (selected) {
    const c = selected;
    return (
      <div className="space-y-3 md:space-y-4 px-0.5">
        {/* Header — mobile-optimized */}
        <div className="flex items-start gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-700 h-8 w-8 p-0 shrink-0 mt-0.5 rounded-xl border" style={{ borderColor: "hsl(220 13% 90%)" }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {/* Client photo or fallback */}
          {(c as any).imagem ? (
            <img
              src={supabase.storage.from("qa-documentos").getPublicUrl((c as any).imagem).data?.publicUrl || ""}
              alt={c.nome_completo}
              className="w-11 h-11 rounded-xl shrink-0 mt-0.5 object-cover border border-slate-200"
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] md:text-base font-bold truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${statusColor(c.status)}`} style={{ background: c.status === "ATIVO" ? "hsl(152 60% 95%)" : c.status === "DESISTENTE" ? "hsl(0 60% 95%)" : "hsl(38 80% 95%)" }}>
                {c.status}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "hsl(220 10% 55%)" }}>CPF: {formatCpf(c.cpf)}</span>
              {c.cliente_lions && <span className="text-[10px]">🦁</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => { setEditingCliente(c); setClienteModal(true); }} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 rounded-xl">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_clientes", id: c.id, title: "Excluir Cliente", desc: `Excluir "${c.nome_completo}" e todos os dados vinculados?` })} className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 rounded-xl">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          {/* Scrollable tabs for mobile */}
          <div className="overflow-x-auto -mx-0.5 px-0.5 scrollbar-none">
            <TabsList className="bg-white border border-slate-200 h-9 inline-flex w-auto min-w-full rounded-xl shadow-sm p-0.5 gap-0.5">
              {[
                { value: "resumo", icon: TrendingUp, label: "Resumo" },
                { value: "dados", icon: User, label: "Dados" },
                { value: "servicos", icon: FileText, label: `Serviços (${itens.length})` },
                { value: "armas", icon: Crosshair, label: `Armas (${crafs.length + gtes.length})` },
                { value: "cr", icon: Shield, label: "CR" },
                { value: "docs", icon: FileDown, label: "Docs" },
                { value: "exames", icon: HeartPulse, label: "Exames" },
                { value: "pecas", icon: PenTool, label: "Peças" },
                { value: "portal", icon: KeyRound, label: "Portal" },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-[10px] whitespace-nowrap px-2.5 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg font-semibold">
                  <t.icon className="h-3 w-3 mr-1" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {loadingSub ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 62%)" }}>Carregando...</span>
            </div>
          ) : (
            <>
              {/* RESUMO */}
              <TabsContent value="resumo" className="mt-3">
                <ClienteOverview
                  cliente={c}
                  vendas={vendas}
                  itens={itens}
                  crafs={crafs}
                  gtes={gtes}
                  filiacoes={filiacoes}
                  cadastro={cadastro}
                  examesAtuais={examesAtuais}
                  onNavigate={setTab}
                />
              </TabsContent>

              {/* DADOS */}
              <TabsContent value="dados" className="mt-3 space-y-4">
                <Section title="Identificação">
                  <Field label="Nome" value={c.nome_completo} />
                  <Field label="CPF" value={formatCpf(c.cpf)} copyable />
                  {cadastro?.senha_gov && <Field label="Senha Gov" value={cadastro.senha_gov} copyable />}
                  <Field label="RG" value={c.rg ? `${maskRg(c.rg)}${c.emissor_rg ? ` — ${c.emissor_rg}` : ""}${(c as any).uf_emissor_rg ? `/${(c as any).uf_emissor_rg}` : ""}` : "—"} />
                  <Field label="Nascimento" value={formatDate(c.data_nascimento)} />
                  <Field label="Naturalidade" value={c.naturalidade} />
                  <Field label="Nacionalidade" value={c.nacionalidade} />
                  <Field label="Estado Civil" value={c.estado_civil} />
                  <Field label="Profissão" value={c.profissao} />
                  <Field label="Escolaridade" value={c.escolaridade} />
                  <Field label="Título Eleitor" value={c.titulo_eleitor} />
                </Section>
                <Section title="Filiação">
                  <Field label="Mãe" value={c.nome_mae} />
                  <Field label="Pai" value={c.nome_pai} />
                </Section>
                <Section title="Contato">
                  <Field label="Celular" value={c.celular} icon={Phone} />
                  <Field label="Email" value={c.email} icon={Mail} />
                </Section>
                <Section title="Endereço Principal">
                  <Field label="Logradouro" value={`${c.endereco || ""}, ${c.numero || ""}`} icon={MapPin} />
                  <Field label="Bairro" value={c.bairro} />
                  <Field label="CEP" value={c.cep} />
                  <Field label="Cidade/UF" value={`${c.cidade || ""} / ${c.estado || ""}`} />
                  {c.complemento && <Field label="Complemento" value={c.complemento} />}
                </Section>
                {(c.endereco2 || c.cidade2) && (
                  <Section title="Endereço Secundário">
                    <Field label="Logradouro" value={`${c.endereco2 || ""}, ${c.numero2 || ""}`} icon={MapPin} />
                    <Field label="Bairro" value={c.bairro2} />
                    <Field label="Cidade/UF" value={`${c.cidade2 || ""} / ${c.estado2 || ""}`} />
                  </Section>
                )}
                {c.observacao && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
                    <div className="text-[11px] uppercase tracking-[0.14em] mb-3 font-bold" style={{ color: "hsl(220 65% 48%)" }}>Observações</div>
                    <div className="text-[12px] text-slate-600 whitespace-pre-wrap leading-relaxed">{c.observacao}</div>
                  </div>
                )}
                <Section title="Filiações a Clubes">
                  <div className="flex items-center justify-end mb-1">
                    <Button variant="ghost" size="sm" onClick={() => setFiliacaoModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                      <Plus className="h-3 w-3 mr-1" /> Nova Filiação
                    </Button>
                  </div>
                  {filiacoes.length === 0 ? <Empty text="Nenhuma filiação." /> : filiacoes.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between text-[10px] bg-white rounded px-2.5 py-1.5 border border-slate-200 mb-1">
                      <div>
                        <span className="text-slate-700">Filiação #{f.numero_filiacao || "—"}</span>
                        <span className="text-slate-400 ml-2">Clube #{f.clube_id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[9px]">Val: {formatDate(f.validade_filiacao)}</span>
                        <Button variant="ghost" size="sm" onClick={() => setFiliacaoModal({ open: true, item: f })} className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_filiacoes", id: f.id, title: "Excluir Filiação", desc: `Excluir filiação #${f.numero_filiacao}?` })} className="h-5 w-5 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </Section>
              </TabsContent>

              {/* SERVIÇOS / VENDAS */}
              <TabsContent value="servicos" className="mt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] text-blue-600 uppercase tracking-[0.12em] font-semibold">Vendas</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => exportVendas(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-slate-500">
                      <Download className="h-3 w-3 mr-1" /> CSV
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setVendaModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                      <Plus className="h-3 w-3 mr-1" /> Nova Venda
                    </Button>
                  </div>
                </div>
                {vendas.length === 0 ? <Empty text="Nenhuma venda registrada." /> : (
                  <div className="space-y-3">
                    {vendas.map((v: any) => {
                      const vItens = itens.filter((i: any) => i.venda_id === (v.id_legado ?? v.id));
                      return (
                        <div key={v.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
                            <div className="text-[11px]">
                              <span className="text-slate-700 font-medium">Venda #{v.id_legado ?? v.id}</span>
                              <span className="text-slate-400 ml-2">{formatDate(v.data_cadastro)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${svcStatusColor(v.status)}`}>{v.status}</span>
                              <Button variant="ghost" size="sm" onClick={() => setVendaModal({ open: true, item: v })} className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_vendas", id: v.id, title: "Excluir Venda", desc: `Excluir venda #${v.id_legado ?? v.id}?` })} className="h-5 w-5 p-0 text-slate-400 hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="px-3 py-2 space-y-1.5">
                            {vItens.map((it: any) => (
                              <div key={it.id}>
                                <div className="flex items-center justify-between text-[10px] gap-1 cursor-pointer hover:bg-white rounded px-1 -mx-1 py-0.5" onClick={() => handleExpandItem(it)}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {expandedItemId === it.id ? <ChevronUp className="h-3 w-3 shrink-0 text-slate-500" /> : <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" />}
                                    <Select
                                      value={it.status || "EM ANÁLISE"}
                                      onValueChange={async (newStatus) => {
                                        const { error } = await supabase.from("qa_itens_venda" as any).update({ status: newStatus }).eq("id", it.id);
                                        if (error) { toast.error(error.message); return; }
                                        setItens(prev => prev.map((i: any) => i.id === it.id ? { ...i, status: newStatus } : i));
                                        toast.success(`Status → ${newStatus}`);
                                      }}
                                    >
                                      <SelectTrigger className={`h-5 w-auto min-w-0 px-1.5 text-[9px] font-mono border-0 bg-transparent gap-0.5 ${svcStatusColor(it.status)}`} onClick={(e) => e.stopPropagation()}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {["EM ANÁLISE", "PRONTO PARA ANÁLISE", "À INICIAR", "À FAZER", "AGUARDANDO DOCUMENTAÇÃO", "PASTA FÍSICA - AGUARDANDO LIBERAÇÃO", "DEFERIDO", "INDEFERIDO", "CONCLUÍDO", "DESISTIU", "RESTITUÍDO"].map(s => (
                                          <SelectItem key={s} value={s} className="text-[10px]">{s}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <span className="text-slate-700 truncate">{getServicoNome(it.servico_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    {it.numero_processo && <span className="hidden sm:inline text-slate-400 font-mono text-[9px]">{it.numero_processo}</span>}
                                    <span className="text-slate-600 font-mono">R$ {Number(it.valor || 0).toFixed(0)}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(it); }}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                      title="Excluir item"
                                      aria-label="Excluir item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                {expandedItemId === it.id && (
                                  <div className="bg-slate-50 border border-slate-200 rounded-lg mt-1 mb-2 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-medium text-slate-700">Detalhes — {getServicoNome(it.servico_id)}</span>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setExpandedItemId(null); setItemEditForm({}); }} className="h-6 px-2 text-[9px] text-slate-500 hover:text-slate-700">
                                          <X className="h-3 w-3 mr-1" /> Cancelar
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={handleSaveItem} disabled={savingItem} className="h-6 px-2 text-[9px] text-emerald-400 bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/40">
                                          <Save className="h-3 w-3 mr-1" /> {savingItem ? "Salvando..." : "Salvar"}
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                      {getFieldsForServico(it.servico_id).map(field => (
                                        <div key={field.key}>
                                          <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">{field.label}</label>
                                          <input
                                            type="text"
                                            value={itemEditForm[field.key] || ""}
                                            onChange={e => {
                                              const raw = e.target.value;
                                              const val = field.type === "date" ? applyDateMask(raw) : raw.toUpperCase();
                                              setItemEditForm(prev => ({ ...prev, [field.key]: val }));
                                            }}
                                            placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                            className="w-full h-7 px-2 text-[10px] rounded bg-white border border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    {/* Declarações movidas para a aba "Docs" — não exibir aqui */}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="flex justify-between pt-1 border-t border-slate-200 text-[10px]">
                              <span className="text-slate-400">Total</span>
                              <div className="flex gap-3">
                                {Number(v.desconto) > 0 && <span className="text-amber-400">Desc: R$ {Number(v.desconto).toFixed(0)}</span>}
                                <span className="text-slate-700 font-medium">R$ {Number(v.valor_a_pagar).toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ARMAS */}
              <TabsContent value="armas" className="mt-3 space-y-4">
                {/* CRAFs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-blue-600 uppercase tracking-[0.12em] font-semibold">CRAFs ({crafs.length})</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => exportCrafs(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-slate-500">
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCrafModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                        <Plus className="h-3 w-3 mr-1" /> Novo CRAF
                      </Button>
                    </div>
                  </div>
                  {crafs.length === 0 ? <Empty text="Nenhum CRAF." /> : crafs.map((cr: any) => (
                    <div key={cr.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 mb-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-700 font-medium">{cr.nome_arma}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500">Val: {formatDate(cr.data_validade)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setCrafModal({ open: true, item: cr })} className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_crafs", id: cr.id, title: "Excluir CRAF", desc: `Excluir CRAF "${cr.nome_arma}"?` })} className="h-5 w-5 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-[9px] text-slate-500">
                        {cr.numero_sigma && <span>SIGMA: {cr.numero_sigma}</span>}
                        {cr.numero_arma && <span>Nº: {cr.numero_arma}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* GTEs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-blue-600 uppercase tracking-[0.12em] font-semibold">GTEs ({gtes.length})</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => exportGtes(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-slate-500">
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setGteModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                        <Plus className="h-3 w-3 mr-1" /> Novo GTE
                      </Button>
                    </div>
                  </div>
                  {gtes.length === 0 ? <Empty text="Nenhum GTE." /> : gtes.map((g: any) => (
                    <div key={g.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 mb-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-700 font-medium">{g.nome_arma}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500">Val: {formatDate(g.data_validade)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setGteModal({ open: true, item: g })} className="h-5 w-5 p-0 text-slate-400 hover:text-slate-700"><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_gtes", id: g.id, title: "Excluir GTE", desc: `Excluir GTE "${g.nome_arma}"?` })} className="h-5 w-5 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-[9px] text-slate-500">
                        {g.numero_sigma && <span>SIGMA: {g.numero_sigma}</span>}
                        {g.numero_arma && <span>Nº: {g.numero_arma}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* CR */}
              <TabsContent value="cr" className="mt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] text-blue-600 uppercase tracking-[0.12em] font-semibold">Certificado de Registro</span>
                  <div className="flex gap-1">
                    {cadastro && (
                      <Button variant="ghost" size="sm" onClick={() => exportCr(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-slate-500">
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setCrModal({ open: true, item: cadastro || undefined })} className="h-6 px-2 text-[9px] text-emerald-400">
                      {cadastro ? <><Edit className="h-3 w-3 mr-1" /> Editar</> : <><Plus className="h-3 w-3 mr-1" /> Cadastrar CR</>}
                    </Button>
                  </div>
                </div>
                {!cadastro ? <Empty text="Nenhum cadastro CR encontrado." /> : (
                  <div className="space-y-1">
                    <Field label="Nº CR" value={cadastro.numero_cr} />
                    <Field label="Validade CR" value={formatDate(cadastro.validade_cr)} />
                    <Field label="Laudo Psicológico" value={formatDate(cadastro.validade_laudo_psicologico)} />
                    <Field label="Exame de Tiro" value={formatDate(cadastro.validade_exame_tiro)} />
                    <Field label="Senha Gov" value={cadastro.senha_gov} />
                    <div className="flex gap-4 mt-2 text-[10px]">
                      {cadastro.check_laudo_psi && <span className="text-emerald-400">✓ Laudo Psicológico OK</span>}
                      {cadastro.check_exame_tiro && <span className="text-emerald-400">✓ Exame de Tiro OK</span>}
                    </div>
                  </div>
                )}
              </TabsContent>
              {/* DOCUMENTOS */}
              <TabsContent value="docs" className="mt-3">
                <DocumentGenerator cliente={c} />
              </TabsContent>
              {/* EXAMES */}
              <TabsContent value="exames" className="mt-3">
                <ClienteExames cliente={c} />
              </TabsContent>
              {/* PEÇAS JURÍDICAS */}
              <TabsContent value="pecas" className="mt-3">
                <ClientePecas cliente={c} />
              </TabsContent>
              {/* ACESSO AO PORTAL */}
              <TabsContent value="portal" className="mt-3">
                <ClienteAcessoPortal cliente={c} />
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Modals */}
        <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={async () => {
          await loadClientes();
          if (selected) {
            const { data } = await supabase.from("qa_clientes" as any).select("*").eq("id", selected.id).maybeSingle();
            if (data) setSelected(data as any);
          }
        }} cliente={editingCliente} />
        <CrafModal open={crafModal.open} onClose={() => setCrafModal({ open: false })} onSaved={() => loadSubData(selected!)} clienteId={clienteIdForSub} craf={crafModal.item} />
        <GteModal open={gteModal.open} onClose={() => setGteModal({ open: false })} onSaved={() => loadSubData(selected!)} clienteId={clienteIdForSub} gte={gteModal.item} />
        <CrModal open={crModal.open} onClose={() => setCrModal({ open: false })} onSaved={() => loadSubData(selected!)} clienteId={clienteIdForSub} cadastro={crModal.item} />
        <VendaModal open={vendaModal.open} onClose={() => setVendaModal({ open: false })} onSaved={() => loadSubData(selected!)} clienteId={clienteIdForSub} venda={vendaModal.item} />
        <FiliacaoModal open={filiacaoModal.open} onClose={() => setFiliacaoModal({ open: false })} onSaved={() => loadSubData(selected!)} clienteId={clienteIdForSub} filiacao={filiacaoModal.item} />
        <DeleteConfirm open={deleteModal.open} onClose={() => setDeleteModal({ ...deleteModal, open: false })} onConfirm={handleDelete} title={deleteModal.title} description={deleteModal.desc} loading={deleting} />
      </div>
    );
  }

  const cadastroStatusColor = (s: string) => {
    if (s === "aprovado") return "text-emerald-600 bg-emerald-50";
    if (s === "pendente") return "text-amber-600 bg-amber-50";
    if (s === "rejeitado") return "text-red-600 bg-red-50";
    return "text-slate-500 bg-slate-100";
  };

  if (selectedCadastroPublico) {
    const c = selectedCadastroPublico;
    const comprovanteEndereco = c.comprovante_endereco_proprio === "sim"
      ? "Sim"
      : c.comprovante_endereco_proprio === "nao"
        ? "Não"
        : c.comprovante_endereco_proprio || "—";

    const ef = cadastroEditForm;
    const setEf = (key: string, val: string) => setCadastroEditForm(prev => ({ ...prev, [key]: val }));
    const isEditing = editingCadastroPublico;

    const editInput = (fieldKey: string) => (
      <input
        key={`edit-${fieldKey}`}
        value={ef[fieldKey] || ""}
        onChange={e => setEf(fieldKey, e.target.value.toUpperCase())}
        className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-blue-500 py-0.5"
        style={{ color: "hsl(220 20% 18%)" }}
      />
    );

    const renderField = (label: string, fieldKey: string | undefined, value: string | null | undefined, opts?: { copyable?: boolean }) => {
      if (isEditing && fieldKey) {
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>{label}:</span>
            {editInput(fieldKey)}
          </div>
        );
      }
      return <DetailField label={label} value={value} copyable={opts?.copyable} />;
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => { setSelectedCadastroPublico(null); setEditingCadastroPublico(false); }}
            className="mt-1 w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100"
            style={{ border: "1px solid hsl(220 13% 90%)" }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "hsl(220 10% 46%)" }} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: "hsl(220 20% 14%)" }}>
              {c.nome_completo}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${cadastroStatusColor(c.status)}`}>
                {c.status}
              </span>
              <span className="text-xs" style={{ color: "hsl(220 10% 55%)" }}>CPF: {formatCpf(c.cpf)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={() => setEditingCadastroPublico(false)}
                  className="h-9 px-4 rounded-lg text-xs font-medium border transition-all hover:bg-slate-50"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  <X className="h-3.5 w-3.5 mr-1 inline" /> Cancelar
                </button>
                <button
                  onClick={saveCadastroEdit}
                  disabled={savingCadastroEdit}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 flex items-center gap-1.5"
                  style={{ background: "hsl(152 60% 40%)" }}
                >
                  {savingCadastroEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditCadastro}
                  className="h-9 px-4 rounded-lg text-xs font-medium border transition-all hover:bg-slate-50 flex items-center gap-1.5"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  <Edit className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  disabled={!!savingCadastroPublicoStatus || c.status === "rejeitado"}
                  onClick={() => updateCadastroPublicoStatus("rejeitado")}
                  className="h-9 px-4 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 hover:bg-slate-50"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  {savingCadastroPublicoStatus === "rejeitado" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin inline" />}
                  Rejeitar
                </button>
                <button
                  disabled={!!savingCadastroPublicoStatus || c.status === "pendente"}
                  onClick={() => updateCadastroPublicoStatus("pendente")}
                  className="h-9 px-4 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 hover:bg-slate-50"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  {savingCadastroPublicoStatus === "pendente" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin inline" />}
                  Pendente
                </button>
                <button
                  disabled={!!savingCadastroPublicoStatus || c.status === "aprovado"}
                  onClick={() => updateCadastroPublicoStatus("aprovado")}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 flex items-center gap-1.5"
                  style={{ background: "hsl(230 80% 56%)" }}
                >
                  {savingCadastroPublicoStatus === "aprovado" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Validar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content cards */}
        <div className="space-y-4">
          <DetailCard title="Resumo do Cadastro">
            <DetailGrid>
              <DetailField label="Recebido em" value={formatDate(c.created_at)} />
              {isEditing ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>Serviço:</span>
                  <select
                    value={ef.servico_interesse || ""}
                    onChange={e => setEf("servico_interesse", e.target.value)}
                    className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-blue-500 py-0.5 uppercase"
                    style={{ color: "hsl(220 20% 18%)" }}
                  >
                    <option value="">Selecione...</option>
                    {servicos.map(s => (
                      <option key={s.id} value={s.nome_servico}>{s.nome_servico}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <DetailField label="Serviço" value={c.servico_interesse} />
              )}
              {renderField("Tipo de vínculo", "vinculo_tipo", c.vinculo_tipo)}
              <DetailField label="Comprovante em nome próprio" value={comprovanteEndereco} />
              <DetailField label="Consentimento de veracidade" value={c.consentimento_dados_verdadeiros ? "Sim" : "Não"} />
              <DetailField label="Consentimento LGPD" value={c.consentimento_tratamento_dados ? "Sim" : "Não"} />
              <DetailField label="Aceite em" value={formatDate(c.consentimento_timestamp ?? c.created_at)} />
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Identificação">
            <DetailGrid>
              {renderField("Nome", "nome_completo", c.nome_completo)}
              {renderField("CPF", "cpf", formatCpf(c.cpf), { copyable: true })}
              {isEditing ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>RG:</span>
                    <input
                      value={ef.rg || ""}
                      onChange={e => setEf("rg", maskRg(e.target.value))}
                      placeholder="00.000.000-X"
                      className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-blue-500 py-0.5"
                      style={{ color: "hsl(220 20% 18%)" }}
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>Órgão Emissor:</span>
                    {editInput("emissor_rg")}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>UF Emissor:</span>
                    <select
                      value={ef.uf_emissor_rg || ""}
                      onChange={e => setEf("uf_emissor_rg", e.target.value)}
                      className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-blue-500 py-0.5 uppercase"
                      style={{ color: "hsl(220 20% 18%)" }}
                    >
                      <option value="">Selecione</option>
                      {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <DetailField label="RG" value={c.rg ? `${maskRg(c.rg)}${c.emissor_rg ? ` — ${c.emissor_rg}` : ""}${(c as any).uf_emissor_rg ? `/${(c as any).uf_emissor_rg}` : ""}` : null} />
              )}
              {renderField("Nascimento", "data_nascimento", c.data_nascimento)}
              {renderField("Estado Civil", "estado_civil", c.estado_civil)}
              {renderField("Nacionalidade", "nacionalidade", c.nacionalidade)}
              {renderField("Profissão", "profissao", c.profissao)}
              {renderField("Mãe", "nome_mae", c.nome_mae)}
              {renderField("Pai", "nome_pai", c.nome_pai)}
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Contato">
            <DetailGrid>
              {renderField("Telefone principal", "telefone_principal", c.telefone_principal, { copyable: true })}
              {renderField("Telefone secundário", "telefone_secundario", c.telefone_secundario, { copyable: true })}
              {renderField("Email", "email", c.email, { copyable: true })}
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Endereço Principal">
            <DetailGrid>
              {isEditing ? (
                <>
                  {renderField("Logradouro", "end1_logradouro", c.end1_logradouro)}
                  {renderField("Número", "end1_numero", c.end1_numero)}
                </>
              ) : (
                <DetailField label="Logradouro" value={[c.end1_logradouro, c.end1_numero].filter(Boolean).join(", ")} />
              )}
              {renderField("Complemento", "end1_complemento", c.end1_complemento)}
              {renderField("Bairro", "end1_bairro", c.end1_bairro)}
              {renderField("CEP", "end1_cep", c.end1_cep)}
              {isEditing ? (
                <>
                  {renderField("Cidade", "end1_cidade", c.end1_cidade)}
                  {renderField("UF", "end1_estado", c.end1_estado)}
                </>
              ) : (
                <DetailField label="Cidade/UF" value={[c.end1_cidade, c.end1_estado].filter(Boolean).join(" / ")} />
              )}
            </DetailGrid>
          </DetailCard>

          {(c.tem_segundo_endereco || isEditing) && (
            <DetailCard title="Endereço Secundário">
              <DetailGrid>
                {renderField("Tipo", "end2_tipo", c.end2_tipo)}
                {isEditing ? (
                  <>
                    {renderField("Logradouro", "end2_logradouro", c.end2_logradouro)}
                    {renderField("Número", "end2_numero", c.end2_numero)}
                  </>
                ) : (
                  <DetailField label="Logradouro" value={[c.end2_logradouro, c.end2_numero].filter(Boolean).join(", ")} />
                )}
                {renderField("Complemento", "end2_complemento", c.end2_complemento)}
                {renderField("Bairro", "end2_bairro", c.end2_bairro)}
                {renderField("CEP", "end2_cep", c.end2_cep)}
                {isEditing ? (
                  <>
                    {renderField("Cidade", "end2_cidade", c.end2_cidade)}
                    {renderField("UF", "end2_estado", c.end2_estado)}
                  </>
                ) : (
                  <DetailField label="Cidade/UF" value={[c.end2_cidade, c.end2_estado].filter(Boolean).join(" / ")} />
                )}
              </DetailGrid>
            </DetailCard>
          )}

          {(c.emp_cnpj || c.emp_razao_social || c.emp_nome_fantasia) && (
            <DetailCard title="Empresa / Sociedade">
              <DetailGrid>
                <DetailField label="CNPJ" value={c.emp_cnpj} copyable />
                <DetailField label="Razão social" value={c.emp_razao_social} />
                <DetailField label="Nome fantasia" value={c.emp_nome_fantasia} />
                <DetailField label="Situação Cadastral" value={c.emp_situacao_cadastral} />
                <DetailField label="Cargo/Função" value={c.emp_cargo_funcao} />
                <DetailField label="Participação" value={c.emp_participacao_societaria} />
                <DetailField label="Endereço" value={c.emp_endereco} />
                <DetailField label="Telefone" value={c.emp_telefone} copyable />
                <DetailField label="Email" value={c.emp_email} copyable />
              </DetailGrid>
            </DetailCard>
          )}

          {(c.trab_cnpj_empresa || c.trab_nome_empresa) && (
            <DetailCard title="Trabalho Registrado">
              <DetailGrid>
                <DetailField label="Empresa" value={c.trab_nome_empresa} />
                <DetailField label="CNPJ" value={c.trab_cnpj_empresa} copyable />
                <DetailField label="Cargo/Função" value={c.trab_cargo_funcao} />
                <DetailField label="Admissão" value={c.trab_data_admissao} />
                <DetailField label="Faixa Salarial" value={c.trab_faixa_salarial} />
                <DetailField label="Endereço" value={c.trab_endereco_empresa} />
                <DetailField label="Telefone" value={c.trab_telefone_empresa} copyable />
              </DetailGrid>
            </DetailCard>
          )}

          {(c.aut_atividade || c.aut_nome_profissional) && (
            <DetailCard title="Autônomo">
              <DetailGrid>
                <DetailField label="Atividade" value={c.aut_atividade} />
                <DetailField label="Nome Profissional" value={c.aut_nome_profissional} />
                <DetailField label="CNPJ" value={c.aut_cnpj} copyable />
                <DetailField label="Telefone" value={c.aut_telefone} copyable />
                <DetailField label="Endereço" value={c.aut_endereco} />
              </DetailGrid>
            </DetailCard>
          )}

          {(c.observacoes || isEditing) && (
            <DetailCard title="Observações">
              {isEditing ? (
                <textarea
                  value={ef.observacoes || ""}
                  onChange={e => setEf("observacoes", e.target.value.toUpperCase())}
                  rows={3}
                  className="w-full text-sm border rounded-lg p-3 outline-none focus:border-blue-500"
                  style={{ color: "hsl(220 20% 25%)", borderColor: "hsl(220 13% 88%)" }}
                />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4"
                  style={{ color: "hsl(220 20% 25%)", background: "hsl(220 20% 97%)" }}>
                  {c.observacoes}
                </div>
              )}
            </DetailCard>
          )}
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4 md:space-y-5 max-w-7xl mx-auto px-1">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
              CLIENTES
            </h1>
            <p className="text-xs md:text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
              {clientes.length} cadastrados • {cadastrosPublicos.length} formulários
            </p>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="ghost" size="sm" onClick={exportClientes} className="h-8 px-2 text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>
        {/* Mobile: full-width primary CTA */}
        <button onClick={() => { setEditingCliente(null); setClienteModal(true); }}
          className="flex sm:hidden items-center justify-center gap-1.5 w-full h-10 rounded-xl text-xs font-bold tracking-wide"
          style={{ background: "hsl(230 80% 56%)", color: "#fff" }}>
          <Plus className="h-4 w-4" /> NOVO CLIENTE
        </button>
        {/* Desktop: inline actions */}
        <div className="hidden sm:flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportClientes} className="h-8 px-2.5 text-[11px]" style={{ color: "hsl(220 10% 46%)" }}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <button onClick={() => { setEditingCliente(null); setClienteModal(true); }}
            className="qa-btn-primary flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold">
            <Plus className="h-3.5 w-3.5" /> NOVO CLIENTE
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(220 10% 62%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone ou e-mail..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border text-[13px] outline-none transition-all focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 18%)" }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "hsl(220 20% 96%)" }}>
        <button
          onClick={() => setTabView("clientes")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "clientes" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "clientes" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "clientes" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <User className="h-3.5 w-3.5 inline mr-1" /> CLIENTES ({filtered.length})
        </button>
        <button
          onClick={() => setTabView("cadastros")}
          className="flex-1 py-2 px-3 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: tabView === "cadastros" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "cadastros" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "cadastros" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <FileText className="h-3.5 w-3.5 inline mr-1" /> CADASTROS ({filteredCadastros.length})
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-[11px] uppercase tracking-wider" style={{ color: "hsl(220 10% 62%)" }}>Carregando...</span>
        </div>
      ) : tabView === "clientes" ? (
        <div className="space-y-2">
          {filtered.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "hsl(220 10% 62%)" }}>Nenhum cliente encontrado.</div>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => openClient(c)}
              className="w-full flex items-start gap-3 px-3 py-3 md:px-4 rounded-xl border transition-all hover:shadow-sm active:scale-[0.99] text-left group qa-card"
              style={{ borderColor: "hsl(220 13% 93%)" }}>
              {/* Avatar */}
              {(c as any).imagem ? (
                <img
                  src={supabase.storage.from("qa-documentos").getPublicUrl((c as any).imagem).data?.publicUrl || ""}
                  alt={c.nome_completo}
                  className="w-9 h-9 md:w-10 md:h-10 rounded-xl shrink-0 mt-0.5 object-cover"
                />
              ) : (
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "hsl(230 80% 96%)" }}>
                  <User className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
                </div>
              )}
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</span>
                  {c.cliente_lions && <span className="text-[10px] shrink-0">🦁</span>}
                </div>
                <div className="text-[11px] mt-0.5 font-mono" style={{ color: "hsl(220 10% 55%)" }}>
                  {formatCpf(c.cpf)}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {c.celular && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 50%)" }}>
                      <Phone className="h-2.5 w-2.5" /> {c.celular}
                    </span>
                  )}
                  {c.cidade && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 50%)" }}>
                      <MapPin className="h-2.5 w-2.5" /> {c.cidade}/{c.estado}
                    </span>
                  )}
                </div>
              </div>
              {/* Status & actions */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${statusColor(c.status)}`} style={{ background: c.status === "ATIVO" ? "hsl(152 60% 95%)" : c.status === "DESISTENTE" ? "hsl(0 60% 95%)" : "hsl(38 80% 95%)" }}>
                  {c.status}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModal({ open: true, table: "qa_clientes", id: c.id, title: "Excluir Cliente", desc: `Excluir "${c.nome_completo}" e todos os dados vinculados (vendas, armas, filiações)?` });
                  }}
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredCadastros.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "hsl(220 10% 62%)" }}>Nenhum cadastro público encontrado.</div>}
          {filteredCadastros.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openCadastroPublico(c.id)}
              disabled={loadingCadastroPublico}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm text-left group qa-card disabled:opacity-70"
              style={{ borderColor: "hsl(220 13% 93%)" }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(152 60% 95%)" }}>
                <FileText className="h-4 w-4" style={{ color: "hsl(152 60% 42%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</div>
                <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: "hsl(220 10% 55%)" }}>
                  <span>{formatCpf(c.cpf)}</span>
                  <span>•</span>
                  <span>{c.telefone_principal || "—"}</span>
                  <span>•</span>
                  <span>{c.email || "—"}</span>
                </div>
                {c.servico_interesse && (
                  <div className="text-[10px] mt-0.5" style={{ color: "hsl(230 80% 56%)" }}>🎯 {c.servico_interesse}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cadastroStatusColor(c.status)}`}>{c.status}</span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {loadingCadastroPublico ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "hsl(220 10% 62%)" }} />
                ) : (
                  <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "hsl(220 10% 62%)" }} />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={loadClientes} cliente={editingCliente} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] mb-3 font-bold" style={{ color: "hsl(220 65% 48%)" }}>{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">{children}</div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="qa-card p-5 md:p-6">
      <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-4"
        style={{ color: "hsl(0 65% 42%)" }}>{title}</h3>
      {children}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2.5">{children}</div>;
}

function DetailField({ label, value, icon: Icon, copyable, highlight }: {
  label: string; value?: string | null; icon?: any; copyable?: boolean; highlight?: boolean;
}) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(`${label} copiado!`);
    }
  };
  const displayValue = value || "—";
  const isInvalid = displayValue === "Invalid Date";

  return (
    <div className="flex items-start gap-3 group">
      {Icon && <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(220 10% 62%)" }} />}
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>
          {label}:
        </span>
        <span className={`text-sm font-medium uppercase ${isInvalid ? "text-red-500" : ""} ${highlight ? "text-emerald-600" : ""}`}
          style={!isInvalid && !highlight ? { color: "hsl(220 20% 18%)" } : undefined}>
          {displayValue}
        </span>
      </div>
      {copyable && value && value !== "—" && (
        <button onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100"
          title="Copiar">
          <span className="text-xs">📋</span>
        </button>
      )}
    </div>
  );
}

function Field({ label, value, icon: Icon, copyable }: { label: string; value?: string | null; icon?: any; copyable?: boolean }) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(`${label} copiado!`);
    }
  };
  return (
    <div className={`flex flex-col gap-0.5 py-1 ${copyable && value ? "cursor-pointer active:opacity-60 group" : ""}`} onClick={copyable ? handleCopy : undefined}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(220 10% 55%)" }} />}
        <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{label}</span>
        {copyable && value && <span className="text-slate-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-auto">📋</span>}
      </div>
      <span className="text-[13px] text-slate-800 font-semibold uppercase pl-0.5">{value || "—"}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-slate-400 text-xs">{text}</div>;
}

const TEMPLATES = [
  { key: "dsa_1endereco", label: "DSA – 1 Endereço", desc: "Declaração de Segurança do Acervo (endereço único)", grupo: "cac_cr" },
  { key: "dsa_2enderecos", label: "DSA – 2 Endereços", desc: "Declaração de Segurança do Acervo (principal + secundário)", needs2addr: true, grupo: "cac_cr" },
  { key: "declaracao_guarda_acervo_1endereco", label: "Guarda de Acervo – 1 End.", desc: "Declaração de endereço de guarda de acervo", grupo: "cac_cr" },
  { key: "declaracao_guarda_acervo_2enderecos", label: "Guarda de Acervo – 2 End.", desc: "Declaração com endereço principal e secundário", needs2addr: true, grupo: "cac_cr" },
  { key: "declaracao_nao_segundo_endereco", label: "Não Possui 2º Endereço", desc: "Declaração de não possuir segundo endereço", grupo: "cac_cr" },
  { key: "declaracao_nao_inquerito_criminal", label: "Não Resp. Inquérito/Proc. Criminal", desc: "Declaração de não responder inquérito policial ou processo criminal", grupo: "cac_cr" },
  { key: "declaracao_responsavel_imovel_reside", label: "Resp. Imóvel – Reside", desc: "Declaração do responsável pelo imóvel (reside atualmente)", needsThirdParty: true, grupo: "universal" },
  { key: "declaracao_responsavel_imovel_residiu", label: "Resp. Imóvel – Residiu", desc: "Declaração do responsável pelo imóvel (residiu de/até)", needsThirdParty: true, needsDates: true, grupo: "universal" },
];

/** Determina o grupo de declarações baseado no nome do serviço */
function getServicoGrupo(nomeServico: string): "posse_porte" | "cac_cr" {
  const upper = (nomeServico || "").toUpperCase();
  if (upper.includes("POSSE") || upper.includes("PORTE")) return "posse_porte";
  return "cac_cr";
}

/** Filtra templates aplicáveis ao grupo do serviço */
function getTemplatesParaServico(nomeServico: string) {
  const grupo = getServicoGrupo(nomeServico);
  if (grupo === "posse_porte") {
    return TEMPLATES.filter(t => t.grupo === "universal");
  }
  // CAC/CR/Autorização/Registro → todas as declarações
  return TEMPLATES;
}

function DocumentGenerator({ cliente, nomeServico }: { cliente: any; nomeServico?: string }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [showExtra, setShowExtra] = useState<string | null>(null);
  // Third party fields
  const [tp, setTp] = useState({ nome: "", naturalidade: "", nascimento: "", profissao: "", estadoCivil: "", cpf: "" });
  const [dataEntrada, setDataEntrada] = useState("");
  const [dataSaida, setDataSaida] = useState("");

  const handleGenerate = async (templateKey: string) => {
    const tpl = TEMPLATES.find(t => t.key === templateKey);
    if (tpl?.needsThirdParty && !tp.nome.trim()) {
      toast.error("Preencha os dados do responsável pelo imóvel");
      return;
    }
    if (tpl?.needs2addr && !cliente.endereco2) {
      toast.error("Cliente não possui endereço secundário cadastrado");
      return;
    }

    setGenerating(templateKey);
    try {
      const extra: Record<string, string> = {};
      if (tpl?.needsThirdParty) {
        extra["[NOME COMPLETO 3]"] = tp.nome;
        extra["[NATURALIDADE 3]"] = tp.naturalidade;
        extra["[DATA NASCIMENTO 3]"] = tp.nascimento;
        extra["[PROFISSÃO 3]"] = tp.profissao;
        extra["[ESTADO CIVIL 3]"] = tp.estadoCivil;
        extra["[CPF 3]"] = tp.cpf;
      }
      if (tpl?.needsDates) {
        extra["[DATA ENTRADA]"] = dataEntrada;
        extra["[DATA SAÍDA]"] = dataSaida;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-fill-template`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ template_key: templateKey, cliente_id: cliente.id, extra_fields: extra }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errBody.error || "Erro ao gerar documento");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateKey}_${(cliente.nome_completo || "cliente").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar documento");
    } finally {
      setGenerating(null);
    }
  };

  const filteredTemplates = nomeServico ? getTemplatesParaServico(nomeServico) : TEMPLATES;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(220 10% 45%)" }}>
          {nomeServico ? `Declarações — ${nomeServico}` : "Gerar Declarações"}
        </span>
      </div>

      {/* Third party fields - show when needed */}
      {showExtra && TEMPLATES.find(t => t.key === showExtra)?.needsThirdParty && (
        <div className="qa-card p-4 space-y-3" style={{ borderColor: "hsl(40 70% 80%)" }}>
          <div className="text-[11px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>Dados do Responsável pelo Imóvel</div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={tp.nome} onChange={e => setTp(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="Nome Completo" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.cpf} onChange={e => setTp(p => ({ ...p, cpf: e.target.value.toUpperCase() }))} placeholder="CPF" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.naturalidade} onChange={e => setTp(p => ({ ...p, naturalidade: e.target.value.toUpperCase() }))} placeholder="Naturalidade" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.nascimento} onChange={e => setTp(p => ({ ...p, nascimento: e.target.value.toUpperCase() }))} placeholder="Data Nascimento" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.profissao} onChange={e => setTp(p => ({ ...p, profissao: e.target.value.toUpperCase() }))} placeholder="Profissão" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
            <Input value={tp.estadoCivil} onChange={e => setTp(p => ({ ...p, estadoCivil: e.target.value.toUpperCase() }))} placeholder="Estado Civil" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800 uppercase" />
          </div>
          {TEMPLATES.find(t => t.key === showExtra)?.needsDates && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <Input value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} placeholder="Data Entrada (ex: 01/01/2020)" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800" />
              <Input value={dataSaida} onChange={e => setDataSaida(e.target.value)} placeholder="Data Saída (ex: 31/12/2023)" className="h-8 text-[11px] bg-white border-slate-200 text-slate-800" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => handleGenerate(showExtra)} disabled={generating === showExtra} className="qa-btn-primary h-8 px-4 text-xs flex items-center gap-1.5 no-glow">
              {generating === showExtra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Gerar DOCX
            </button>
            <button onClick={() => setShowExtra(null)} className="qa-btn-outline h-8 px-4 text-xs">Cancelar</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {filteredTemplates.map(tpl => (
          <div key={tpl.key} className="qa-card qa-hover-lift p-3 flex items-center justify-between group">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{tpl.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>{tpl.desc}</div>
            </div>
            <button
              disabled={!!generating}
              onClick={() => {
                if (tpl.needsThirdParty) {
                  setShowExtra(tpl.key);
                } else {
                  handleGenerate(tpl.key);
                }
              }}
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0 ml-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40"
              style={{ color: "hsl(220 10% 45%)" }}
            >
              {generating === tpl.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
