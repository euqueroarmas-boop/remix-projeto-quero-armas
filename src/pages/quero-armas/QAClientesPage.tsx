import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, User, Phone, Mail, MapPin, FileText, Shield, ChevronLeft,
  Loader2, Eye, Plus, Crosshair, Edit, Trash2, Download, FileDown,
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

  const statusColor = (s: string) => s === "ATIVO" ? "text-emerald-400" : s === "DESISTENTE" ? "text-red-400" : "text-amber-400";
  const svcStatusColor = (s: string) => {
    if (s === "DEFERIDO" || s === "CONCLUÍDO") return "text-emerald-400 bg-emerald-500/10";
    if (s === "INDEFERIDO") return "text-red-400 bg-red-500/10";
    if (s === "EM ANÁLISE" || s === "PRONTO PARA ANÁLISE") return "text-amber-400 bg-amber-500/10";
    return "text-neutral-400 bg-neutral-500/10";
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
                  <Field label="CPF" value={c.cpf} />
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
                              <div key={it.id} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${svcStatusColor(it.status)}`}>{it.status}</span>
                                  <span className="text-neutral-300 truncate">{getServicoNome(it.servico_id)}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {it.numero_processo && <span className="text-neutral-600 font-mono text-[9px]">{it.numero_processo}</span>}
                                  <span className="text-neutral-400 font-mono">R$ {Number(it.valor || 0).toFixed(0)}</span>
                                </div>
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
          <h1 className="text-sm font-bold text-neutral-100">Clientes</h1>
          <p className="text-[10px] text-neutral-600">{clientes.length} cadastrados</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={exportClientes} className="h-7 px-2 text-[10px] text-neutral-500">
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => { setEditingCliente(null); setClienteModal(true); }} className="h-7 px-2 text-[10px] bg-[#7a1528] hover:bg-[#9a1b32]">
            <Plus className="h-3 w-3 mr-1" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou email..." className="pl-8 h-8 text-[11px] bg-[#0a0a0a] border-[#1c1c1c] text-neutral-200" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-neutral-600" /></div>
      ) : (
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1">
            {filtered.map(c => (
              <button key={c.id} onClick={() => openClient(c)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#141414] transition-colors text-left group">
                <div className="w-8 h-8 rounded-full bg-[#7a1528]/15 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-[#c43b52]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-neutral-200 font-medium truncate">{c.nome_completo}</div>
                  <div className="flex items-center gap-2 text-[9px] text-neutral-600">
                    <span>{c.cpf || "—"}</span><span>•</span><span>{c.cidade || "—"}/{c.estado || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.cliente_lions && <span className="text-[9px] text-amber-400">🦁</span>}
                  <span className={`text-[9px] font-mono ${statusColor(c.status)}`}>{c.status}</span>
                  <Eye className="h-3 w-3 text-neutral-700 group-hover:text-neutral-400 transition-colors" />
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

function Field({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <div className="flex items-start gap-2 text-[10px]">
      {Icon && <Icon className="h-3 w-3 text-neutral-600 mt-0.5 shrink-0" />}
      <span className="text-neutral-600 min-w-[80px] shrink-0">{label}:</span>
      <span className="text-neutral-200 font-medium">{value || "—"}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-neutral-600 text-[11px]">{text}</div>;
}
