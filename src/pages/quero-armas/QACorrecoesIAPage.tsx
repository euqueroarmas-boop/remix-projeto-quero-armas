import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_PECA } from "@/components/quero-armas/tiposPeca";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Power, Trash2, Loader2, GraduationCap, Globe2, User,
  AlertTriangle, BookMarked, Filter,
} from "lucide-react";

// =============================================================
// Página de gestão das CORREÇÕES SUPERVISIONADAS DA IA JURÍDICA
// (Fase 1 — somente CRUD; injeção no prompt acontece na Fase 3)
// =============================================================

export const CATEGORIAS_ERRO = [
  { value: "enderecamento_errado", label: "Endereçamento errado" },
  { value: "circunscricao_errada", label: "Circunscrição/Delegacia errada" },
  { value: "fundamento_juridico_incorreto", label: "Fundamento jurídico incorreto" },
  { value: "tese_inadequada", label: "Tese inadequada" },
  { value: "excesso_linguagem", label: "Excesso de linguagem" },
  { value: "omissao_fato_relevante", label: "Omissão de fato relevante" },
  { value: "uso_dado_inexistente", label: "Uso de dado inexistente" },
  { value: "confusao_posse_porte", label: "Confusão entre posse e porte" },
  { value: "confusao_sinarm_sigma", label: "Confusão entre SINARM e SIGMA" },
  { value: "confusao_pf_exercito", label: "Confusão entre PF e Exército" },
  { value: "prazo_administrativo_errado", label: "Prazo administrativo errado" },
  { value: "redacao_fraca", label: "Redação fraca" },
  { value: "pedido_final_incorreto", label: "Pedido final incorreto" },
  { value: "conclusao_desalinhada", label: "Conclusão desalinhada" },
  { value: "outro", label: "Outro" },
] as const;

type Correcao = {
  id: string;
  tipo_peca: string;
  foco_argumentativo: string | null;
  categoria_erro: string;
  trecho_errado: string;
  trecho_correto: string;
  explicacao: string | null;
  regra_aplicavel: string | null;
  aplicar_globalmente: boolean;
  cliente_id: string | null;
  caso_id: string | null;
  peca_id: string | null;
  ativo: boolean;
  criado_por_nome: string | null;
  usado_vezes: number;
  ultima_utilizacao: string | null;
  created_at: string;
};

type FormState = {
  id?: string;
  tipo_peca: string;
  foco_argumentativo: string;
  categoria_erro: string;
  trecho_errado: string;
  trecho_correto: string;
  explicacao: string;
  regra_aplicavel: string;
  aplicar_globalmente: boolean;
  ativo: boolean;
};

const EMPTY_FORM: FormState = {
  tipo_peca: TIPOS_PECA[0].value,
  foco_argumentativo: "",
  categoria_erro: "outro",
  trecho_errado: "",
  trecho_correto: "",
  explicacao: "",
  regra_aplicavel: "",
  aplicar_globalmente: true,
  ativo: true,
};

function getCategoriaLabel(v: string) {
  return CATEGORIAS_ERRO.find(c => c.value === v)?.label || v;
}
function getTipoPecaLabel(v: string) {
  return TIPOS_PECA.find(t => t.value === v)?.label || v;
}

export default function QACorrecoesIAPage() {
  const [items, setItems] = useState<Correcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEscopo, setFilterEscopo] = useState<string>("all");

  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("qa_ia_correcoes_juridicas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setItems((data || []) as Correcao[]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar correções");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (filterTipo !== "all" && it.tipo_peca !== filterTipo) return false;
      if (filterCategoria !== "all" && it.categoria_erro !== filterCategoria) return false;
      if (filterStatus === "ativo" && !it.ativo) return false;
      if (filterStatus === "inativo" && it.ativo) return false;
      if (filterEscopo === "global" && !it.aplicar_globalmente) return false;
      if (filterEscopo === "especifico" && it.aplicar_globalmente) return false;
      if (q) {
        const blob = `${it.trecho_errado} ${it.trecho_correto} ${it.explicacao || ""} ${it.regra_aplicavel || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filterTipo, filterCategoria, filterStatus, filterEscopo]);

  const stats = useMemo(() => {
    const total = items.length;
    const ativas = items.filter(i => i.ativo).length;
    const globais = items.filter(i => i.aplicar_globalmente && i.ativo).length;
    const usos = items.reduce((acc, i) => acc + (i.usado_vezes || 0), 0);
    return { total, ativas, globais, usos };
  }, [items]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpenModal(true);
  }
  function openEdit(it: Correcao) {
    setForm({
      id: it.id,
      tipo_peca: it.tipo_peca,
      foco_argumentativo: it.foco_argumentativo || "",
      categoria_erro: it.categoria_erro,
      trecho_errado: it.trecho_errado,
      trecho_correto: it.trecho_correto,
      explicacao: it.explicacao || "",
      regra_aplicavel: it.regra_aplicavel || "",
      aplicar_globalmente: it.aplicar_globalmente,
      ativo: it.ativo,
    });
    setOpenModal(true);
  }

  async function salvar() {
    if (form.trecho_errado.trim().length < 5) {
      toast.error("Trecho errado deve ter pelo menos 5 caracteres");
      return;
    }
    if (form.trecho_correto.trim().length < 5) {
      toast.error("Trecho correto deve ter pelo menos 5 caracteres");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        tipo_peca: form.tipo_peca,
        foco_argumentativo: form.foco_argumentativo.trim() || null,
        categoria_erro: form.categoria_erro,
        trecho_errado: form.trecho_errado.trim(),
        trecho_correto: form.trecho_correto.trim(),
        explicacao: form.explicacao.trim() || null,
        regra_aplicavel: form.regra_aplicavel.trim() || null,
        aplicar_globalmente: form.aplicar_globalmente,
        ativo: form.ativo,
      };
      if (form.id) {
        const { error } = await (supabase as any)
          .from("qa_ia_correcoes_juridicas")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Correção atualizada");
      } else {
        payload.criado_por = user?.id || null;
        payload.criado_por_nome = user?.email || null;
        const { error } = await (supabase as any)
          .from("qa_ia_correcoes_juridicas")
          .insert(payload);
        if (error) throw error;
        toast.success("Correção registrada");
      }
      setOpenModal(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(it: Correcao) {
    try {
      const { error } = await (supabase as any)
        .from("qa_ia_correcoes_juridicas")
        .update({ ativo: !it.ativo })
        .eq("id", it.id);
      if (error) throw error;
      toast.success(it.ativo ? "Correção desativada" : "Correção reativada");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
  }

  async function excluir(it: Correcao) {
    if (!confirm("Excluir esta correção definitivamente? A IA deixará de considerá-la.")) return;
    try {
      const { error } = await (supabase as any)
        .from("qa_ia_correcoes_juridicas")
        .delete()
        .eq("id", it.id);
      if (error) throw error;
      toast.success("Correção excluída");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  }

  return (
    <div className="qa-scope min-h-full" style={{ background: "hsl(36 30% 96%)" }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: "hsl(35 90% 35%)" }}>
              <GraduationCap className="h-4 w-4" />
              TREINAMENTO JURÍDICO DA IA
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase mt-1" style={{ color: "hsl(220 25% 12%)" }}>
              CORREÇÕES DA IA
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(220 10% 45%)" }}>
              Cadastre trechos errados gerados pela IA e a versão correta. Cada correção ativa será injetada como regra obrigatória nas próximas peças jurídicas.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors"
            style={{ background: "hsl(35 90% 50%)", color: "white" }}
          >
            <Plus className="h-4 w-4" /> Nova Correção
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI label="Total" value={stats.total} icon={<BookMarked className="h-4 w-4" />} />
          <KPI label="Ativas" value={stats.ativas} icon={<Power className="h-4 w-4" />} accent />
          <KPI label="Globais" value={stats.globais} icon={<Globe2 className="h-4 w-4" />} />
          <KPI label="Usos Acumulados" value={stats.usos} icon={<GraduationCap className="h-4 w-4" />} />
        </div>

        {/* Filtros */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "hsl(36 20% 88%)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-3.5 w-3.5" style={{ color: "hsl(220 10% 45%)" }} />
            <span className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "hsl(220 10% 45%)" }}>FILTROS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "hsl(220 10% 50%)" }} />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="BUSCAR EM TRECHO, EXPLICAÇÃO OU REGRA..."
                className="h-9 pl-8 text-xs uppercase bg-white"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-9 text-xs uppercase bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs uppercase">TODOS OS TIPOS</SelectItem>
                {TIPOS_PECA.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs uppercase">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="h-9 text-xs uppercase bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs uppercase">TODAS AS CATEGORIAS</SelectItem>
                {CATEGORIAS_ERRO.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-xs uppercase">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs uppercase bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs uppercase">TODAS</SelectItem>
                  <SelectItem value="ativo" className="text-xs uppercase">ATIVAS</SelectItem>
                  <SelectItem value="inativo" className="text-xs uppercase">INATIVAS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEscopo} onValueChange={setFilterEscopo}>
                <SelectTrigger className="h-9 text-xs uppercase bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs uppercase">QUALQUER ESCOPO</SelectItem>
                  <SelectItem value="global" className="text-xs uppercase">GLOBAL</SelectItem>
                  <SelectItem value="especifico" className="text-xs uppercase">ESPECÍFICO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-16 text-xs uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> CARREGANDO CORREÇÕES...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border-2 border-dashed py-16 px-6 text-center" style={{ borderColor: "hsl(36 25% 80%)" }}>
              <GraduationCap className="h-8 w-8 mx-auto mb-3" style={{ color: "hsl(35 70% 55%)" }} />
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "hsl(220 25% 25%)" }}>NENHUMA CORREÇÃO ENCONTRADA</p>
              <p className="text-xs mt-1" style={{ color: "hsl(220 10% 50%)" }}>
                {items.length === 0 ? "Cadastre a primeira correção para começar a treinar a IA." : "Ajuste os filtros acima."}
              </p>
            </div>
          )}
          {!loading && filtered.map(it => (
            <CorrecaoCard
              key={it.id}
              it={it}
              onEdit={() => openEdit(it)}
              onToggle={() => toggleAtivo(it)}
              onDelete={() => excluir(it)}
            />
          ))}
        </div>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto qa-scope">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wide text-base">
              {form.id ? "EDITAR CORREÇÃO" : "NOVA CORREÇÃO DA IA"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="TIPO DE PEÇA *">
                <Select value={form.tipo_peca} onValueChange={v => setForm(f => ({ ...f, tipo_peca: v }))}>
                  <SelectTrigger className="h-9 text-xs uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_PECA.map(t => (
                      <SelectItem key={t.value} value={t.value} className="text-xs uppercase">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="CATEGORIA DO ERRO *">
                <Select value={form.categoria_erro} onValueChange={v => setForm(f => ({ ...f, categoria_erro: v }))}>
                  <SelectTrigger className="h-9 text-xs uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ERRO.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-xs uppercase">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="FOCO ARGUMENTATIVO (OPCIONAL)">
              <Input
                value={form.foco_argumentativo}
                onChange={e => setForm(f => ({ ...f, foco_argumentativo: e.target.value.toUpperCase() }))}
                placeholder="EX: AUSÊNCIA DE DOLO, CADUCIDADE DE NOTIFICAÇÃO..."
                className="h-9 text-xs uppercase"
              />
            </Field>

            <Field label="TRECHO ERRADO GERADO PELA IA *">
              <Textarea
                value={form.trecho_errado}
                onChange={e => setForm(f => ({ ...f, trecho_errado: e.target.value }))}
                placeholder="Cole aqui o trecho exato que a IA gerou e está incorreto..."
                className="min-h-[100px] text-xs"
              />
            </Field>

            <Field label="TRECHO CORRETO ESPERADO *">
              <Textarea
                value={form.trecho_correto}
                onChange={e => setForm(f => ({ ...f, trecho_correto: e.target.value }))}
                placeholder="Escreva como a IA deveria ter redigido..."
                className="min-h-[100px] text-xs"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="EXPLICAÇÃO DO ERRO">
                <Textarea
                  value={form.explicacao}
                  onChange={e => setForm(f => ({ ...f, explicacao: e.target.value }))}
                  placeholder="Por que o trecho está errado?"
                  className="min-h-[80px] text-xs"
                />
              </Field>
              <Field label="REGRA / NORMA APLICÁVEL">
                <Textarea
                  value={form.regra_aplicavel}
                  onChange={e => setForm(f => ({ ...f, regra_aplicavel: e.target.value }))}
                  placeholder="EX: ART. X DA LEI 10.826/03, DECRETO 9.847/19..."
                  className="min-h-[80px] text-xs uppercase"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2 p-3 rounded-lg border bg-white" style={{ borderColor: "hsl(36 20% 88%)" }}>
                <Globe2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(35 90% 50%)" }} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 25% 18%)" }}>APLICAR GLOBALMENTE</div>
                  <div className="text-[10px]" style={{ color: "hsl(220 10% 50%)" }}>
                    Correções criadas aqui valem para TODAS as peças do mesmo tipo. Para correções específicas de cliente/caso/peça, use "MARCAR COMO ERRO" diretamente na peça gerada.
                  </div>
                </div>
              </div>
              <ToggleRow
                checked={form.ativo}
                onChange={v => setForm(f => ({ ...f, ativo: v }))}
                title="ATIVA"
                desc="Correções inativas não são usadas."
                icon={<Power className="h-4 w-4" />}
              />
            </div>

          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setOpenModal(false)}
              disabled={saving}
              className="h-9 px-4 rounded-md text-xs font-semibold uppercase tracking-wider border transition-colors"
              style={{ borderColor: "hsl(220 13% 85%)", color: "hsl(220 15% 30%)" }}
            >Cancelar</button>
            <button
              onClick={salvar}
              disabled={saving}
              className="h-9 px-5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
              style={{ background: "hsl(35 90% 50%)", color: "white" }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
              {form.id ? "Salvar alterações" : "Registrar correção"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================
// Subcomponentes
// =============================================================

function KPI({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  const isZero = value === 0;
  return (
    <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: "hsl(36 20% 88%)" }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: isZero ? "hsl(220 8% 60%)" : "hsl(220 10% 45%)" }}>
        {icon}<span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums" style={{
        color: isZero ? "hsl(220 8% 60%)" : (accent ? "hsl(35 90% 40%)" : "hsl(220 25% 15%)")
      }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "hsl(220 10% 40%)" }}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ checked, onChange, title, desc, icon }:
  { checked: boolean; onChange: (v: boolean) => void; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white" style={{ borderColor: "hsl(36 20% 88%)" }}>
      <div className="flex items-start gap-2 min-w-0">
        <div className="mt-0.5" style={{ color: checked ? "hsl(35 90% 50%)" : "hsl(220 10% 55%)" }}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 25% 18%)" }}>{title}</div>
          <div className="text-[10px]" style={{ color: "hsl(220 10% 50%)" }}>{desc}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CorrecaoCard({ it, onEdit, onToggle, onDelete }:
  { it: Correcao; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const dim = !it.ativo;
  return (
    <div
      className="rounded-xl border bg-white p-4 transition-all"
      style={{
        borderColor: dim ? "hsl(220 13% 88%)" : "hsl(36 20% 85%)",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge>{getTipoPecaLabel(it.tipo_peca)}</Badge>
        <Badge variant="amber">{getCategoriaLabel(it.categoria_erro)}</Badge>
        {it.aplicar_globalmente
          ? <Badge variant="blue"><Globe2 className="h-3 w-3 mr-1 inline" />GLOBAL</Badge>
          : <Badge variant="purple"><User className="h-3 w-3 mr-1 inline" />ESPECÍFICA</Badge>}
        {!it.ativo && <Badge variant="gray">INATIVA</Badge>}
        {it.ativo && <Badge variant="green">ATIVA</Badge>}
        <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 55%)" }}>
          USADA {it.usado_vezes}× {it.ultima_utilizacao && `· ÚLT. ${new Date(it.ultima_utilizacao).toLocaleDateString("pt-BR")}`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg p-3 border" style={{ background: "hsl(0 70% 97%)", borderColor: "hsl(0 60% 88%)" }}>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: "hsl(0 60% 40%)" }}>TRECHO ERRADO</div>
          <div className="whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(220 25% 20%)" }}>{it.trecho_errado}</div>
        </div>
        <div className="rounded-lg p-3 border" style={{ background: "hsl(140 50% 97%)", borderColor: "hsl(140 40% 85%)" }}>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-1" style={{ color: "hsl(140 50% 30%)" }}>TRECHO CORRETO</div>
          <div className="whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(220 25% 20%)" }}>{it.trecho_correto}</div>
        </div>
      </div>

      {(it.explicacao || it.regra_aplicavel) && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          {it.explicacao && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-0.5" style={{ color: "hsl(220 10% 45%)" }}>EXPLICAÇÃO</div>
              <div style={{ color: "hsl(220 15% 30%)" }}>{it.explicacao}</div>
            </div>
          )}
          {it.regra_aplicavel && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] font-bold mb-0.5" style={{ color: "hsl(220 10% 45%)" }}>REGRA APLICÁVEL</div>
              <div className="uppercase" style={{ color: "hsl(220 15% 30%)" }}>{it.regra_aplicavel}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "hsl(36 15% 92%)" }}>
        <button onClick={onEdit} className="h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider border inline-flex items-center gap-1.5 transition-colors hover:bg-amber-50" style={{ borderColor: "hsl(36 30% 80%)", color: "hsl(35 60% 35%)" }}>
          <Pencil className="h-3 w-3" /> Editar
        </button>
        <button onClick={onToggle} className="h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider border inline-flex items-center gap-1.5 transition-colors" style={{ borderColor: "hsl(220 13% 85%)", color: "hsl(220 15% 35%)" }}>
          <Power className="h-3 w-3" /> {it.ativo ? "Desativar" : "Reativar"}
        </button>
        <button onClick={onDelete} className="h-8 px-3 rounded-md text-[11px] font-semibold uppercase tracking-wider border inline-flex items-center gap-1.5 transition-colors hover:bg-red-50 ml-auto" style={{ borderColor: "hsl(0 50% 85%)", color: "hsl(0 60% 45%)" }}>
          <Trash2 className="h-3 w-3" /> Excluir
        </button>
      </div>
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "amber" | "blue" | "purple" | "green" | "gray" }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    default: { bg: "hsl(220 14% 96%)", color: "hsl(220 25% 25%)", border: "hsl(220 13% 88%)" },
    amber: { bg: "hsl(40 95% 95%)", color: "hsl(35 80% 30%)", border: "hsl(40 80% 80%)" },
    blue: { bg: "hsl(220 95% 96%)", color: "hsl(220 80% 35%)", border: "hsl(220 80% 85%)" },
    purple: { bg: "hsl(270 80% 96%)", color: "hsl(270 60% 35%)", border: "hsl(270 60% 85%)" },
    green: { bg: "hsl(140 60% 95%)", color: "hsl(140 60% 25%)", border: "hsl(140 50% 80%)" },
    gray: { bg: "hsl(220 10% 94%)", color: "hsl(220 8% 45%)", border: "hsl(220 13% 85%)" },
  };
  const s = styles[variant];
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {children}
    </span>
  );
}