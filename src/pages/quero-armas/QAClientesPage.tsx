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
  ChevronDown, ChevronUp, Save, X,
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

  useEffect(() => { loadClientes(); }, []);

  const loadClientes = async () => {
    setLoading(true);
    const { data } = await supabase.from("qa_clientes" as any).select("*").order("nome_completo", { ascending: true });
    setClientes((data as any[]) ?? []);
    setLoading(false);
  };

  const openClient = async (c: Cliente) => {
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
    return !s || c.nome_completo?.toLowerCase().includes(s) || c.cpf?.includes(s) || c.email?.toLowerCase().includes(s);
  });

  const statusColor = (s: string) => s === "ATIVO" ? "text-emerald-600" : s === "DESISTENTE" ? "text-red-600" : "text-amber-600";
  const svcStatusColor = (s: string) => {
    if (s === "DEFERIDO" || s === "CONCLUÍDO") return "text-emerald-700 bg-emerald-50";
    if (s === "INDEFERIDO") return "text-red-700 bg-red-50";
    if (s === "EM ANÁLISE" || s === "PRONTO PARA ANÁLISE") return "text-amber-700 bg-amber-50";
    return "text-slate-600 bg-slate-100";
  };
  const formatDate = (d: string | null) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; } };
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
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-200 h-7 px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-neutral-100 truncate">{c.nome_completo}</h1>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={statusColor(c.status)}>{c.status}</span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-500">CPF: {c.cpf || "—"}</span>
              {c.cliente_lions && <span className="text-amber-400">🦁 Lions</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setEditingCliente(c); setClienteModal(true); }} className="h-7 px-2 text-neutral-500 hover:text-neutral-200">
            <Edit className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-[#0e0e0e] border border-[#1c1c1c] h-8 w-full flex-wrap">
            <TabsTrigger value="dados" className="text-[10px] flex-1 data-[state=active]:bg-[#7a1528]/30 data-[state=active]:text-neutral-100">
              <User className="h-3 w-3 mr-1" /> Dados
            </TabsTrigger>
            <TabsTrigger value="servicos" className="text-[10px] flex-1 data-[state=active]:bg-[#7a1528]/30 data-[state=active]:text-neutral-100">
              <FileText className="h-3 w-3 mr-1" /> Serviços ({itens.length})
            </TabsTrigger>
            <TabsTrigger value="armas" className="text-[10px] flex-1 data-[state=active]:bg-[#7a1528]/30 data-[state=active]:text-neutral-100">
              <Crosshair className="h-3 w-3 mr-1" /> Armas ({crafs.length + gtes.length})
            </TabsTrigger>
            <TabsTrigger value="cr" className="text-[10px] flex-1 data-[state=active]:bg-[#7a1528]/30 data-[state=active]:text-neutral-100">
              <Shield className="h-3 w-3 mr-1" /> CR
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-[10px] flex-1 data-[state=active]:bg-[#7a1528]/30 data-[state=active]:text-neutral-100">
              <FileDown className="h-3 w-3 mr-1" /> Docs
            </TabsTrigger>
          </TabsList>

          {loadingSub ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-600" /></div>
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
                    <div className="text-[10px] text-neutral-400 whitespace-pre-wrap bg-[#0a0a0a] rounded-lg p-2.5 border border-[#1c1c1c]">{c.observacao}</div>
                  </Section>
                )}
                <Section title="Filiações a Clubes">
                  <div className="flex items-center justify-end mb-1">
                    <Button variant="ghost" size="sm" onClick={() => setFiliacaoModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                      <Plus className="h-3 w-3 mr-1" /> Nova Filiação
                    </Button>
                  </div>
                  {filiacoes.length === 0 ? <Empty text="Nenhuma filiação." /> : filiacoes.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between text-[10px] bg-[#0a0a0a] rounded px-2.5 py-1.5 border border-[#1c1c1c] mb-1">
                      <div>
                        <span className="text-neutral-300">Filiação #{f.numero_filiacao || "—"}</span>
                        <span className="text-neutral-600 ml-2">Clube #{f.clube_id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-neutral-500 text-[9px]">Val: {formatDate(f.validade_filiacao)}</span>
                        <Button variant="ghost" size="sm" onClick={() => setFiliacaoModal({ open: true, item: f })} className="h-5 w-5 p-0 text-neutral-600 hover:text-neutral-300"><Edit className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_filiacoes", id: f.id, title: "Excluir Filiação", desc: `Excluir filiação #${f.numero_filiacao}?` })} className="h-5 w-5 p-0 text-neutral-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
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
                    <Button variant="ghost" size="sm" onClick={() => exportVendas(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-neutral-500">
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
                        <div key={v.id} className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c1c1c]">
                            <div className="text-[11px]">
                              <span className="text-neutral-200 font-medium">Venda #{v.id_legado ?? v.id}</span>
                              <span className="text-neutral-600 ml-2">{formatDate(v.data_cadastro)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${svcStatusColor(v.status)}`}>{v.status}</span>
                              <Button variant="ghost" size="sm" onClick={() => setVendaModal({ open: true, item: v })} className="h-5 w-5 p-0 text-neutral-600 hover:text-neutral-300">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_vendas", id: v.id, title: "Excluir Venda", desc: `Excluir venda #${v.id_legado ?? v.id}?` })} className="h-5 w-5 p-0 text-neutral-600 hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="px-3 py-2 space-y-1.5">
                            {vItens.map((it: any) => (
                              <div key={it.id}>
                                <div className="flex items-center justify-between text-[10px] gap-1 cursor-pointer hover:bg-[#111] rounded px-1 -mx-1 py-0.5" onClick={() => handleExpandItem(it)}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {expandedItemId === it.id ? <ChevronUp className="h-3 w-3 shrink-0 text-neutral-500" /> : <ChevronDown className="h-3 w-3 shrink-0 text-neutral-500" />}
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
                                    <span className="text-neutral-300 truncate">{getServicoNome(it.servico_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {it.numero_processo && <span className="text-neutral-600 font-mono text-[9px]">{it.numero_processo}</span>}
                                    <span className="text-neutral-400 font-mono">R$ {Number(it.valor || 0).toFixed(0)}</span>
                                  </div>
                                </div>
                                {expandedItemId === it.id && (
                                  <div className="bg-[#080808] border border-[#1c1c1c] rounded-lg mt-1 mb-2 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-medium text-neutral-300">Detalhes — {getServicoNome(it.servico_id)}</span>
                                      <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setExpandedItemId(null); setItemEditForm({}); }} className="h-6 px-2 text-[9px] text-neutral-500 hover:text-neutral-300">
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
                                          <label className="block text-[9px] text-neutral-500 uppercase tracking-wider mb-0.5">{field.label}</label>
                                          <input
                                            type="text"
                                            value={itemEditForm[field.key] || ""}
                                            onChange={e => setItemEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={field.type === "date" ? "DD/MM/AAAA" : "—"}
                                            className="w-full h-7 px-2 text-[10px] rounded bg-[#0a0a0a] border border-[#1c1c1c] text-neutral-200 placeholder:text-neutral-700 focus:border-[#7a1528] focus:outline-none transition-colors"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="flex justify-between pt-1 border-t border-[#1c1c1c] text-[10px]">
                              <span className="text-neutral-600">Total</span>
                              <div className="flex gap-3">
                                {Number(v.desconto) > 0 && <span className="text-amber-400">Desc: R$ {Number(v.desconto).toFixed(0)}</span>}
                                <span className="text-neutral-200 font-medium">R$ {Number(v.valor_a_pagar).toFixed(0)}</span>
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
                      <Button variant="ghost" size="sm" onClick={() => exportCrafs(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-neutral-500">
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setCrafModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                        <Plus className="h-3 w-3 mr-1" /> Novo CRAF
                      </Button>
                    </div>
                  </div>
                  {crafs.length === 0 ? <Empty text="Nenhum CRAF." /> : crafs.map((cr: any) => (
                    <div key={cr.id} className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg px-3 py-2 mb-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-neutral-200 font-medium">{cr.nome_arma}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-neutral-500">Val: {formatDate(cr.data_validade)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setCrafModal({ open: true, item: cr })} className="h-5 w-5 p-0 text-neutral-600 hover:text-neutral-300"><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_crafs", id: cr.id, title: "Excluir CRAF", desc: `Excluir CRAF "${cr.nome_arma}"?` })} className="h-5 w-5 p-0 text-neutral-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-[9px] text-neutral-500">
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
                      <Button variant="ghost" size="sm" onClick={() => exportGtes(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-neutral-500">
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setGteModal({ open: true })} className="h-6 px-2 text-[9px] text-emerald-400">
                        <Plus className="h-3 w-3 mr-1" /> Novo GTE
                      </Button>
                    </div>
                  </div>
                  {gtes.length === 0 ? <Empty text="Nenhum GTE." /> : gtes.map((g: any) => (
                    <div key={g.id} className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg px-3 py-2 mb-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-neutral-200 font-medium">{g.nome_arma}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-neutral-500">Val: {formatDate(g.data_validade)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setGteModal({ open: true, item: g })} className="h-5 w-5 p-0 text-neutral-600 hover:text-neutral-300"><Edit className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteModal({ open: true, table: "qa_gtes", id: g.id, title: "Excluir GTE", desc: `Excluir GTE "${g.nome_arma}"?` })} className="h-5 w-5 p-0 text-neutral-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-1 text-[9px] text-neutral-500">
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
                      <Button variant="ghost" size="sm" onClick={() => exportCr(clienteIdForSub, c.nome_completo)} className="h-6 px-2 text-[9px] text-neutral-500">
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

  // ── List View ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Clientes</h1>
          <p className="text-xs text-slate-500">{clientes.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportClientes} className="h-8 px-3 text-xs text-slate-500 hover:text-slate-700">
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => { setEditingCliente(null); setClienteModal(true); }} className="h-8 px-3 text-xs qa-btn-primary">
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou email..." className="pl-9 h-10 text-sm bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl shadow-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1">
            {filtered.map(c => (
              <button key={c.id} onClick={() => openClient(c)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200/80 transition-all text-left group">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 font-medium truncate">{c.nome_completo}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{c.cpf || "—"}</span><span>•</span><span>{c.cidade || "—"}/{c.estado || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.cliente_lions && <span className="text-xs">🦁</span>}
                  <span className={`text-xs font-medium ${statusColor(c.status)}`}>{c.status}</span>
                  <Eye className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      <ClienteFormModal open={clienteModal} onClose={() => { setClienteModal(false); setEditingCliente(null); }} onSaved={loadClientes} cliente={editingCliente} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] text-[#c43b52] uppercase tracking-[0.12em] mb-1.5 font-semibold">{title}</div>
      <div className="space-y-1">{children}</div>
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
    <div className={`flex items-start gap-2 text-[10px] ${copyable && value ? "cursor-pointer active:opacity-60" : ""}`} onClick={copyable ? handleCopy : undefined}>
      {Icon && <Icon className="h-3 w-3 text-neutral-600 mt-0.5 shrink-0" />}
      <span className="text-neutral-600 min-w-[80px] shrink-0">{label}:</span>
      <span className="text-neutral-200 font-medium">{value || "—"}</span>
      {copyable && value && <span className="text-neutral-600 text-[8px] ml-auto">📋</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-neutral-600 text-[11px]">{text}</div>;
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
        <div className="bg-[#0a0a0a] border border-amber-500/20 rounded-lg p-3 space-y-2">
          <div className="text-[10px] text-amber-400 font-medium mb-1">Dados do Responsável pelo Imóvel</div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={tp.nome} onChange={e => setTp(p => ({ ...p, nome: e.target.value }))} placeholder="Nome Completo" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            <Input value={tp.cpf} onChange={e => setTp(p => ({ ...p, cpf: e.target.value }))} placeholder="CPF" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            <Input value={tp.naturalidade} onChange={e => setTp(p => ({ ...p, naturalidade: e.target.value }))} placeholder="Naturalidade" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            <Input value={tp.nascimento} onChange={e => setTp(p => ({ ...p, nascimento: e.target.value }))} placeholder="Data Nascimento" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            <Input value={tp.profissao} onChange={e => setTp(p => ({ ...p, profissao: e.target.value }))} placeholder="Profissão" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            <Input value={tp.estadoCivil} onChange={e => setTp(p => ({ ...p, estadoCivil: e.target.value }))} placeholder="Estado Civil" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
          </div>
          {TEMPLATES.find(t => t.key === showExtra)?.needsDates && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1c1c1c]">
              <Input value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} placeholder="Data Entrada (ex: 01/01/2020)" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
              <Input value={dataSaida} onChange={e => setDataSaida(e.target.value)} placeholder="Data Saída (ex: 31/12/2023)" className="h-7 text-[10px] bg-[#111] border-[#1c1c1c] text-neutral-200" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => handleGenerate(showExtra)} disabled={generating === showExtra} className="h-7 text-[10px] bg-[#7a1528] hover:bg-[#9a1b32]">
              {generating === showExtra ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileDown className="h-3 w-3 mr-1" />} Gerar DOCX
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowExtra(null)} className="h-7 text-[10px] text-neutral-500">Cancelar</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {TEMPLATES.map(tpl => (
          <div key={tpl.key} className="flex items-center justify-between bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg px-3 py-2 hover:border-neutral-700 transition-all">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-neutral-200 font-medium">{tpl.label}</div>
              <div className="text-[9px] text-neutral-600">{tpl.desc}</div>
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
