import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, User, Phone, Mail, MapPin, FileText, Shield, ChevronLeft,
  Loader2, Eye, Plus, Crosshair, Edit, Trash2, Download, FileDown,
  ChevronDown, ChevronUp, Save, X, CheckCircle,
} from "lucide-react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ClienteFormModal from "@/components/quero-armas/clientes/ClienteFormModal";
import { CrafModal, GteModal, CrModal, VendaModal, FiliacaoModal, DeleteConfirm } from "@/components/quero-armas/clientes/SubEntityModals";
import { exportClientes, exportCrafs, exportGtes, exportCr, exportVendas } from "@/components/quero-armas/clientes/ClienteExport";

interface Cliente {
  id: number; id_legado: number; nome_completo: string; cpf: string; rg: string; emissor_rg: string;
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

export default function QAClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [tab, setTab] = useState("dados");

  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [crafs, setCrafs] = useState<any[]>([]);
  const [gtes, setGtes] = useState<any[]>([]);
  const [filiacoes, setFiliacoes] = useState<any[]>([]);
  const [cadastro, setCadastro] = useState<any>(null);
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

  const ITEM_EDIT_FIELDS: { key: string; label: string; type: "date" | "text" }[] = [
    { key: "data_protocolo", label: "Data Protocolo", type: "date" },
    { key: "data_deferimento", label: "Data Deferimento", type: "date" },
    { key: "data_vencimento", label: "Data Vencimento", type: "date" },
    { key: "numero_processo", label: "Nº Processo", type: "text" },
    { key: "numero_craf", label: "Nº CRAF", type: "text" },
    { key: "numero_gte", label: "Nº GTE", type: "text" },
    { key: "numero_cr", label: "Nº CR", type: "text" },
    { key: "numero_posse", label: "Nº Posse", type: "text" },
    { key: "numero_porte", label: "Nº Porte", type: "text" },
    { key: "numero_sigma", label: "Nº SIGMA", type: "text" },
    { key: "numero_sinarm", label: "Nº SINARM", type: "text" },
    { key: "registro_cad", label: "Registro CAD", type: "text" },
  ];

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

  const handleSaveItem = async () => {
    if (!expandedItemId) return;
    setSavingItem(true);
    try {
      const payload: Record<string, any> = {};
      ITEM_EDIT_FIELDS.forEach(f => {
        const v = itemEditForm[f.key]?.trim() || null;
        if (f.type === "date" && v) {
          const parts = v.split("/");
          if (parts.length === 3) {
            payload[f.key] = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            payload[f.key] = v;
          }
        } else {
          payload[f.key] = v;
        }
      });
      payload.data_ultima_atualizacao = new Date().toISOString();
      const { error } = await supabase.from("qa_itens_venda" as any).update(payload).eq("id", expandedItemId);
      if (error) throw error;
      setItens(prev => prev.map((i: any) => i.id === expandedItemId ? { ...i, ...payload } : i));
      toast.success("Dados do serviço atualizados");
      setExpandedItemId(null);
      setItemEditForm({});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingItem(false);
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

  useEffect(() => { loadClientes(); loadCadastrosPublicos(); }, []);

  const loadClientes = async () => {
    setLoading(true);
    const { data } = await supabase.from("qa_clientes" as any).select("*").order("nome_completo", { ascending: true });
    setClientes((data as any[]) ?? []);
    setLoading(false);
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
      const { data, error } = await supabase.from("qa_cadastro_publico" as any)
        .update({ status })
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
      toast.success(`Cadastro marcado como ${status}`);
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

  const openClient = async (c: Cliente) => {
    setSelectedCadastroPublico(null);
    setSelected(c);
    setTab("dados");
    await loadSubData(c);
  };

  const loadSubData = async (c: Cliente) => {
    setLoadingSub(true);
    const lid = c.id_legado ?? c.id;
    const [vRes, cRes, gRes, fRes, cadRes] = await Promise.all([
      supabase.from("qa_vendas" as any).select("*").eq("cliente_id", lid).order("data_cadastro", { ascending: false }),
      supabase.from("qa_crafs" as any).select("*").eq("cliente_id", lid),
      supabase.from("qa_gtes" as any).select("*").eq("cliente_id", lid),
      supabase.from("qa_filiacoes" as any).select("*").eq("cliente_id", lid),
      supabase.from("qa_cadastro_cr" as any).select("*").eq("cliente_id", lid).limit(1),
    ]);
    const vendasData = (vRes.data as any[]) ?? [];
    setVendas(vendasData);
    setCrafs((cRes.data as any[]) ?? []);
    setGtes((gRes.data as any[]) ?? []);
    setFiliacoes((fRes.data as any[]) ?? []);
    setCadastro((cadRes.data as any[])?.[0] ?? null);
    if (vendasData.length > 0) {
      const vendaIds = vendasData.map((v: any) => v.id_legado ?? v.id);
      const { data: itensData } = await supabase.from("qa_itens_venda" as any).select("*").in("venda_id", vendaIds);
      setItens((itensData as any[]) ?? []);
    } else {
      setItens([]);
    }
    setLoadingSub(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from(deleteModal.table as any).delete().eq("id", deleteModal.id);
      if (error) throw error;
      toast.success("Excluído com sucesso");
      if (selected) await loadSubData(selected);
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
    const map: Record<number, string> = { 2:"Posse PF",3:"Porte PF",4:"Lions Gun",5:"COMBO Autoriz.",6:"COMBO CRAF",7:"COMBO GTE",8:"Apost. Atual.",9:"Apost. Mudança",10:"Apost. 2º End.",11:"Curso Pistola",12:"Curso Cal.12",13:"Mudança Serv.",14:"Reg. Recarga",15:"Autoriz. Compra",16:"Reg. Arma",17:"GTE Avulso",18:"GTE",20:"CR EB",21:"VIP Pistola" };
    return map[id] || `Serviço #${id}`;
  };

  const clienteIdForSub = selected ? (selected.id_legado ?? selected.id) : 0;

  // ── Detail View ──
  if (selected) {
    const c = selected;
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-700 h-8 px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-800 truncate">{c.nome_completo}</h1>
            <div className="flex items-center gap-2 text-xs">
              <span className={statusColor(c.status)}>{c.status}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">CPF: {c.cpf || "—"}</span>
              {c.cliente_lions && <span className="text-amber-500">🦁 Lions</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setEditingCliente(c); setClienteModal(true); }} className="h-8 px-2 text-slate-500 hover:text-slate-700">
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white border border-slate-200 h-9 w-full flex-wrap rounded-xl shadow-sm">
            <TabsTrigger value="dados" className="text-xs flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg">
              <User className="h-3.5 w-3.5 mr-1" /> Dados
            </TabsTrigger>
            <TabsTrigger value="servicos" className="text-xs flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg">
              <FileText className="h-3.5 w-3.5 mr-1" /> Serviços ({itens.length})
            </TabsTrigger>
            <TabsTrigger value="armas" className="text-xs flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg">
              <Crosshair className="h-3.5 w-3.5 mr-1" /> Armas ({crafs.length + gtes.length})
            </TabsTrigger>
            <TabsTrigger value="cr" className="text-xs flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg">
              <Shield className="h-3.5 w-3.5 mr-1" /> CR
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs flex-1 data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg">
              <FileDown className="h-3.5 w-3.5 mr-1" /> Docs
            </TabsTrigger>
          </TabsList>

          {loadingSub ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <>
              {/* DADOS */}
              <TabsContent value="dados" className="mt-3 space-y-4">
                <Section title="Identificação">
                  <Field label="Nome" value={c.nome_completo} />
                  <Field label="CPF" value={c.cpf} copyable />
                  {cadastro?.senha_gov && <Field label="Senha Gov" value={cadastro.senha_gov} copyable />}
                  <Field label="RG" value={`${c.rg || "—"} ${c.emissor_rg || ""}`} />
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
                  <Section title="Observações">
                    <div className="text-[10px] text-slate-600 whitespace-pre-wrap bg-white rounded-lg p-2.5 border border-slate-200">{c.observacao}</div>
                  </Section>
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
                  <span className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-semibold">Vendas</span>
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
                                  <div className="flex items-center gap-3 shrink-0">
                                    {it.numero_processo && <span className="text-slate-400 font-mono text-[9px]">{it.numero_processo}</span>}
                                    <span className="text-slate-600 font-mono">R$ {Number(it.valor || 0).toFixed(0)}</span>
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
                                      {ITEM_EDIT_FIELDS.map(field => (
                                        <div key={field.key}>
                                          <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">{field.label}</label>
                                          <input
                                            type="text"
                                            value={itemEditForm[field.key] || ""}
                                            onChange={e => setItemEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                            className="w-full h-7 px-2 text-[10px] rounded bg-white border border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none transition-colors"
                                          />
                                        </div>
                                      ))}
                                    </div>
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
                    <span className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-semibold">CRAFs ({crafs.length})</span>
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
                    <span className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-semibold">GTEs ({gtes.length})</span>
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
                  <span className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-semibold">Certificado de Registro</span>
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
            </>
          )}
        </Tabs>

        {/* Modals */}
        <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={async () => { await loadClientes(); if (selected) { const updated = clientes.find(x => x.id === selected.id); if (updated) setSelected(updated); } }} cliente={editingCliente} />
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

    const EditableField = ({ label, fieldKey, value, copyable }: { label: string; fieldKey?: string; value?: string | null; copyable?: boolean }) => {
      if (isEditing && fieldKey) {
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-xs shrink-0" style={{ color: "hsl(220 10% 50%)", minWidth: "140px" }}>{label}:</span>
            <input
              value={ef[fieldKey] || ""}
              onChange={e => setEf(fieldKey, e.target.value)}
              className="flex-1 text-sm font-medium border-b border-slate-300 bg-transparent outline-none focus:border-blue-500 py-0.5"
              style={{ color: "hsl(220 20% 18%)" }}
            />
          </div>
        );
      }
      return <DetailField label={label} value={value} copyable={copyable} />;
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
              <span className="text-xs" style={{ color: "hsl(220 10% 55%)" }}>CPF: {c.cpf || "—"}</span>
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
              <EditableField label="Serviço" fieldKey="servico_interesse" value={c.servico_interesse} />
              <EditableField label="Tipo de vínculo" fieldKey="vinculo_tipo" value={c.vinculo_tipo} />
              <DetailField label="Comprovante em nome próprio" value={comprovanteEndereco} />
              <DetailField label="Consentimento de veracidade" value={c.consentimento_dados_verdadeiros ? "Sim" : "Não"} />
              <DetailField label="Consentimento LGPD" value={c.consentimento_tratamento_dados ? "Sim" : "Não"} />
              <DetailField label="Aceite em" value={formatDate(c.consentimento_timestamp ?? c.created_at)} />
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Identificação">
            <DetailGrid>
              <EditableField label="Nome" fieldKey="nome_completo" value={c.nome_completo} />
              <EditableField label="CPF" fieldKey="cpf" value={c.cpf} copyable />
              <EditableField label="RG" fieldKey="rg" value={c.rg ? `${c.rg}${c.emissor_rg ? ` — ${c.emissor_rg}` : ""}` : null} />
              <EditableField label="Nascimento" fieldKey="data_nascimento" value={c.data_nascimento} />
              <EditableField label="Estado Civil" fieldKey="estado_civil" value={c.estado_civil} />
              <EditableField label="Nacionalidade" fieldKey="nacionalidade" value={c.nacionalidade} />
              <EditableField label="Profissão" fieldKey="profissao" value={c.profissao} />
              <EditableField label="Mãe" fieldKey="nome_mae" value={c.nome_mae} />
              <EditableField label="Pai" fieldKey="nome_pai" value={c.nome_pai} />
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Contato">
            <DetailGrid>
              <EditableField label="Telefone principal" fieldKey="telefone_principal" value={c.telefone_principal} copyable />
              <EditableField label="Telefone secundário" fieldKey="telefone_secundario" value={c.telefone_secundario} copyable />
              <EditableField label="Email" fieldKey="email" value={c.email} copyable />
            </DetailGrid>
          </DetailCard>

          <DetailCard title="Endereço Principal">
            <DetailGrid>
              {isEditing ? (
                <>
                  <EditableField label="Logradouro" fieldKey="end1_logradouro" value={c.end1_logradouro} />
                  <EditableField label="Número" fieldKey="end1_numero" value={c.end1_numero} />
                </>
              ) : (
                <DetailField label="Logradouro" value={[c.end1_logradouro, c.end1_numero].filter(Boolean).join(", ")} />
              )}
              <EditableField label="Complemento" fieldKey="end1_complemento" value={c.end1_complemento} />
              <EditableField label="Bairro" fieldKey="end1_bairro" value={c.end1_bairro} />
              <EditableField label="CEP" fieldKey="end1_cep" value={c.end1_cep} />
              {isEditing ? (
                <>
                  <EditableField label="Cidade" fieldKey="end1_cidade" value={c.end1_cidade} />
                  <EditableField label="UF" fieldKey="end1_estado" value={c.end1_estado} />
                </>
              ) : (
                <DetailField label="Cidade/UF" value={[c.end1_cidade, c.end1_estado].filter(Boolean).join(" / ")} />
              )}
            </DetailGrid>
          </DetailCard>

          {(c.tem_segundo_endereco || isEditing) && (
            <DetailCard title="Endereço Secundário">
              <DetailGrid>
                <EditableField label="Tipo" fieldKey="end2_tipo" value={c.end2_tipo} />
                {isEditing ? (
                  <>
                    <EditableField label="Logradouro" fieldKey="end2_logradouro" value={c.end2_logradouro} />
                    <EditableField label="Número" fieldKey="end2_numero" value={c.end2_numero} />
                  </>
                ) : (
                  <DetailField label="Logradouro" value={[c.end2_logradouro, c.end2_numero].filter(Boolean).join(", ")} />
                )}
                <EditableField label="Complemento" fieldKey="end2_complemento" value={c.end2_complemento} />
                <EditableField label="Bairro" fieldKey="end2_bairro" value={c.end2_bairro} />
                <EditableField label="CEP" fieldKey="end2_cep" value={c.end2_cep} />
                {isEditing ? (
                  <>
                    <EditableField label="Cidade" fieldKey="end2_cidade" value={c.end2_cidade} />
                    <EditableField label="UF" fieldKey="end2_estado" value={c.end2_estado} />
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
                  onChange={e => setEf("observacoes", e.target.value)}
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Clientes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            {clientes.length} cadastrados • {cadastrosPublicos.length} formulários recebidos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportClientes} className="h-9 px-3 text-xs" style={{ color: "hsl(220 10% 46%)" }}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <button onClick={() => { setEditingCliente(null); setClienteModal(true); }}
            className="qa-btn-primary flex items-center gap-1.5 no-glow h-9 px-4 text-xs">
            <Plus className="h-3.5 w-3.5" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(220 10% 62%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone ou e-mail..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 18%)" }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "hsl(220 20% 96%)" }}>
        <button
          onClick={() => setTabView("clientes")}
          className="flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all"
          style={{
            background: tabView === "clientes" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "clientes" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "clientes" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <User className="h-3.5 w-3.5 inline mr-1.5" /> Clientes ({filtered.length})
        </button>
        <button
          onClick={() => setTabView("cadastros")}
          className="flex-1 py-2 px-4 rounded-lg text-xs font-medium transition-all"
          style={{
            background: tabView === "cadastros" ? "hsl(0 0% 100%)" : "transparent",
            color: tabView === "cadastros" ? "hsl(220 20% 18%)" : "hsl(220 10% 55%)",
            boxShadow: tabView === "cadastros" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}>
          <FileText className="h-3.5 w-3.5 inline mr-1.5" /> Cadastros Públicos ({filteredCadastros.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : tabView === "clientes" ? (
        <div className="space-y-1.5">
          {filtered.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "hsl(220 10% 62%)" }}>Nenhum cliente encontrado.</div>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => openClient(c)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm text-left group qa-card"
              style={{ borderColor: "hsl(220 13% 93%)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(230 80% 96%)" }}>
                <User className="h-4 w-4" style={{ color: "hsl(230 80% 56%)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>{c.nome_completo}</div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
                  <span>{c.cpf || "—"}</span>
                  <span>•</span>
                  <span>{c.celular || "—"}</span>
                  <span>•</span>
                  <span>{c.cidade || "—"}/{c.estado || "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.cliente_lions && <span className="text-xs">🦁</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "hsl(220 10% 62%)" }} />
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
                  <span>{c.cpf || "—"}</span>
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
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] mb-2 font-semibold" style={{ color: "hsl(230 80% 56%)" }}>{title}</div>
      <div className="space-y-1.5">{children}</div>
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
        <span className={`text-sm font-medium ${isInvalid ? "text-red-500" : ""} ${highlight ? "text-emerald-600" : ""}`}
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
    <div className={`flex items-start gap-2 text-xs ${copyable && value ? "cursor-pointer active:opacity-60" : ""}`} onClick={copyable ? handleCopy : undefined}>
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />}
      <span className="text-slate-500 min-w-[80px] shrink-0">{label}:</span>
      <span className="text-slate-800 font-medium">{value || "—"}</span>
      {copyable && value && <span className="text-slate-400 text-[9px] ml-auto">📋</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-slate-400 text-xs">{text}</div>;
}

const TEMPLATES = [
  { key: "dsa_1endereco", label: "DSA – 1 Endereço", desc: "Declaração de Segurança do Acervo (endereço único)" },
  { key: "dsa_2enderecos", label: "DSA – 2 Endereços", desc: "Declaração de Segurança do Acervo (principal + secundário)", needs2addr: true },
  { key: "declaracao_guarda_acervo_1endereco", label: "Guarda de Acervo – 1 End.", desc: "Declaração de endereço de guarda de acervo" },
  { key: "declaracao_guarda_acervo_2enderecos", label: "Guarda de Acervo – 2 End.", desc: "Declaração com endereço principal e secundário", needs2addr: true },
  { key: "declaracao_nao_segundo_endereco", label: "Não Possui 2º Endereço", desc: "Declaração de não possuir segundo endereço" },
  { key: "declaracao_nao_inquerito_criminal", label: "Não Resp. Inquérito/Proc. Criminal", desc: "Declaração de não responder inquérito policial ou processo criminal" },
  { key: "declaracao_responsavel_imovel_reside", label: "Resp. Imóvel – Reside", desc: "Declaração do responsável pelo imóvel (reside atualmente)", needsThirdParty: true },
  { key: "declaracao_responsavel_imovel_residiu", label: "Resp. Imóvel – Residiu", desc: "Declaração do responsável pelo imóvel (residiu de/até)", needsThirdParty: true, needsDates: true },
];

function DocumentGenerator({ cliente }: { cliente: any }) {
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

      const res = await supabaseClient.functions.invoke("qa-fill-template", {
        body: { template_key: templateKey, cliente_id: cliente.id, extra_fields: extra },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao gerar documento");

      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] font-semibold">Gerar Declarações</span>
      </div>

      {/* Third party fields - show when needed */}
      {showExtra && TEMPLATES.find(t => t.key === showExtra)?.needsThirdParty && (
        <div className="bg-white border border-amber-500/20 rounded-lg p-3 space-y-2">
          <div className="text-[10px] text-amber-400 font-medium mb-1">Dados do Responsável pelo Imóvel</div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={tp.nome} onChange={e => setTp(p => ({ ...p, nome: e.target.value }))} placeholder="Nome Completo" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            <Input value={tp.cpf} onChange={e => setTp(p => ({ ...p, cpf: e.target.value }))} placeholder="CPF" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            <Input value={tp.naturalidade} onChange={e => setTp(p => ({ ...p, naturalidade: e.target.value }))} placeholder="Naturalidade" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            <Input value={tp.nascimento} onChange={e => setTp(p => ({ ...p, nascimento: e.target.value }))} placeholder="Data Nascimento" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            <Input value={tp.profissao} onChange={e => setTp(p => ({ ...p, profissao: e.target.value }))} placeholder="Profissão" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            <Input value={tp.estadoCivil} onChange={e => setTp(p => ({ ...p, estadoCivil: e.target.value }))} placeholder="Estado Civil" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
          </div>
          {TEMPLATES.find(t => t.key === showExtra)?.needsDates && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <Input value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} placeholder="Data Entrada (ex: 01/01/2020)" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
              <Input value={dataSaida} onChange={e => setDataSaida(e.target.value)} placeholder="Data Saída (ex: 31/12/2023)" className="h-7 text-[10px] bg-white border-slate-200 text-slate-700" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => handleGenerate(showExtra)} disabled={generating === showExtra} className="h-7 text-[10px] bg-[#7a1528] hover:bg-[#9a1b32]">
              {generating === showExtra ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileDown className="h-3 w-3 mr-1" />} Gerar DOCX
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowExtra(null)} className="h-7 text-[10px] text-slate-500">Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {TEMPLATES.map(tpl => (
          <div key={tpl.key} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-neutral-700 transition-all">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-700 font-medium">{tpl.label}</div>
              <div className="text-[9px] text-slate-400">{tpl.desc}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!!generating}
              onClick={() => {
                if (tpl.needsThirdParty) {
                  setShowExtra(tpl.key);
                } else {
                  handleGenerate(tpl.key);
                }
              }}
              className="h-7 px-2 text-[10px] text-amber-400 hover:text-amber-300 shrink-0"
            >
              {generating === tpl.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
