import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, Loader2, Save, Power, PowerOff, Search, Plus, Pencil, Trash2, X, FolderCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/* =============================================================================
 * QAPrecosServicosPage — admin de preços do catálogo de contratação.
 *
 * Gerencia diretamente `qa_servicos_catalogo`: preço, recorrente e ativo.
 * Edição inline. Salva linha-a-linha (UPDATE), sem mexer em SLA/checklist.
 * ============================================================================= */

interface ServicoRow {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  tipo: "servico" | "produto";
  preco: number | null;
  recorrente: boolean;
  ativo: boolean;
  display_order: number;
  descricao_curta?: string | null;
}

function fmtBRL(v: number | null) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/** Converte string "1997" / "1997,50" / "1.997,00" / "1997.50" -> number */
function parseBRL(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100) / 100);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface FormState {
  id?: string;
  nome: string;
  slug: string;
  categoria: string;
  tipo: "servico" | "produto";
  preco: string;
  recorrente: boolean;
  ativo: boolean;
  display_order: string;
  descricao_curta: string;
}

const EMPTY_FORM: FormState = {
  nome: "",
  slug: "",
  categoria: "",
  tipo: "servico",
  preco: "",
  recorrente: false,
  ativo: true,
  display_order: "100",
  descricao_curta: "",
};

const CATEGORIAS_CUSTOM_KEY = "qa_categorias_custom_v1";

function loadCustomCategorias(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIAS_CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveCustomCategorias(list: string[]) {
  try {
    localStorage.setItem(CATEGORIAS_CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export default function QAPrecosServicosPage() {
  const [rows, setRows] = useState<ServicoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { preco?: string; recorrente?: boolean; ativo?: boolean }>>({});
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [customCategorias, setCustomCategorias] = useState<string[]>(() => loadCustomCategorias());
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [catBusy, setCatBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_servicos_catalogo" as any)
      .select("id, slug, nome, categoria, tipo, preco, recorrente, ativo, display_order, descricao_curta")
      .order("categoria", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) {
      toast.error("FALHA AO CARREGAR CATÁLOGO");
    } else {
      setRows((data as any[]).map((r) => ({ ...r, preco: r.preco != null ? Number(r.preco) : null })) as ServicoRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const categoriasExistentes = useMemo(() => {
    const CANONICAS = [
      "POLÍCIA FEDERAL / DEFESA PESSOAL",
      "EXÉRCITO / CAC",
    ];
    const doBanco = rows.map((r) => r.categoria.toUpperCase());
    return Array.from(new Set([...CANONICAS, ...doBanco, ...customCategorias.map((c) => c.toUpperCase())])).sort();
  }, [rows, customCategorias]);

  /** Conta serviços por categoria (case-insensitive) */
  const contagemPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.categoria.toUpperCase();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [rows]);

  const grupos = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = !f ? rows : rows.filter((r) => r.nome.toLowerCase().includes(f) || r.slug.toLowerCase().includes(f) || r.categoria.toLowerCase().includes(f));
    const map = new Map<string, ServicoRow[]>();
    list.forEach((r) => {
      const arr = map.get(r.categoria) ?? [];
      arr.push(r);
      map.set(r.categoria, arr);
    });
    return Array.from(map.entries());
  }, [rows, filter]);

  function setEdit(id: string, patch: Partial<{ preco: string; recorrente: boolean; ativo: boolean }>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function isDirty(row: ServicoRow): boolean {
    const e = edits[row.id];
    if (!e) return false;
    if (e.preco !== undefined) {
      const parsed = parseBRL(e.preco);
      if (parsed !== row.preco) return true;
    }
    if (e.recorrente !== undefined && e.recorrente !== row.recorrente) return true;
    if (e.ativo !== undefined && e.ativo !== row.ativo) return true;
    return false;
  }

  async function save(row: ServicoRow) {
    const e = edits[row.id] || {};
    const payload: Record<string, unknown> = {};
    if (e.preco !== undefined) payload.preco = parseBRL(e.preco);
    if (e.recorrente !== undefined) payload.recorrente = e.recorrente;
    if (e.ativo !== undefined) payload.ativo = e.ativo;
    if (Object.keys(payload).length === 0) return;

    setSavingId(row.id);
    const { error } = await supabase
      .from("qa_servicos_catalogo" as any)
      .update(payload)
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("FALHA AO SALVAR — " + error.message.toUpperCase());
      return;
    }
    toast.success("SALVO");
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? {
              ...r,
              preco: payload.preco !== undefined ? (payload.preco as number | null) : r.preco,
              recorrente: payload.recorrente !== undefined ? (payload.recorrente as boolean) : r.recorrente,
              ativo: payload.ativo !== undefined ? (payload.ativo as boolean) : r.ativo,
            }
          : r,
      ),
    );
    setEdits((prev) => {
      const { [row.id]: _, ...rest } = prev;
      return rest;
    });
  }

  function openCreate() {
    setSlugTouched(false);
    setForm({ ...EMPTY_FORM, categoria: categoriasExistentes[0] ?? "" });
  }

  function openEdit(row: ServicoRow) {
    setSlugTouched(true);
    setForm({
      id: row.id,
      nome: row.nome,
      slug: row.slug,
      categoria: row.categoria,
      tipo: row.tipo,
      preco: row.preco != null ? String(row.preco).replace(".", ",") : "",
      recorrente: row.recorrente,
      ativo: row.ativo,
      display_order: String(row.display_order ?? 100),
      descricao_curta: row.descricao_curta ?? "",
    });
  }

  async function submitForm() {
    if (!form) return;
    const nome = form.nome.trim();
    const slug = (form.slug || slugify(nome)).trim();
    const categoria = form.categoria.trim();
    if (!nome || !slug || !categoria) {
      toast.error("PREENCHA NOME, SLUG E CATEGORIA");
      return;
    }
    const payload: Record<string, unknown> = {
      nome: nome.toUpperCase(),
      slug,
      categoria: categoria.toUpperCase(),
      tipo: form.tipo,
      preco: parseBRL(form.preco),
      recorrente: form.recorrente,
      ativo: form.ativo,
      display_order: Number(form.display_order) || 100,
      descricao_curta: form.descricao_curta.trim() || null,
    };
    setSubmitting(true);
    let error;
    if (form.id) {
      ({ error } = await supabase.from("qa_servicos_catalogo" as any).update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("qa_servicos_catalogo" as any).insert(payload));
    }
    setSubmitting(false);
    if (error) {
      toast.error("FALHA — " + error.message.toUpperCase());
      return;
    }
    toast.success(form.id ? "ATUALIZADO" : "SERVIÇO CRIADO");
    setForm(null);
    void load();
  }

  async function removeRow(row: ServicoRow) {
    if (!confirm(`EXCLUIR "${row.nome}"? ESTA AÇÃO É IRREVERSÍVEL.`)) return;
    const { error } = await supabase.from("qa_servicos_catalogo" as any).delete().eq("id", row.id);
    if (error) {
      toast.error("FALHA AO EXCLUIR — " + error.message.toUpperCase());
      return;
    }
    toast.success("SERVIÇO EXCLUÍDO");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  /* ----------------- GESTÃO DE CATEGORIAS ----------------- */

  function adicionarCategoria() {
    const nome = novaCategoria.trim().toUpperCase();
    if (!nome) return;
    if (categoriasExistentes.includes(nome)) {
      toast.error("CATEGORIA JÁ EXISTE");
      return;
    }
    const next = [...customCategorias, nome];
    setCustomCategorias(next);
    saveCustomCategorias(next);
    setNovaCategoria("");
    toast.success("CATEGORIA ADICIONADA");
  }

  async function renomearCategoria() {
    if (!renaming) return;
    const from = renaming.from.trim().toUpperCase();
    const to = renaming.to.trim().toUpperCase();
    if (!to || from === to) {
      setRenaming(null);
      return;
    }
    setCatBusy(true);
    // Atualiza todas as linhas do banco que têm essa categoria (case-insensitive via .ilike não funciona em UPDATE; usamos eq pela versão exata).
    // Como salvamos sempre em UPPERCASE, o `from` casa direto.
    const afetadas = rows.filter((r) => r.categoria.toUpperCase() === from);
    if (afetadas.length > 0) {
      const ids = afetadas.map((r) => r.id);
      const { error } = await supabase
        .from("qa_servicos_catalogo" as any)
        .update({ categoria: to })
        .in("id", ids);
      if (error) {
        setCatBusy(false);
        toast.error("FALHA AO RENOMEAR — " + error.message.toUpperCase());
        return;
      }
    }
    // Atualiza lista custom (substitui from→to se estiver lá)
    if (customCategorias.map((c) => c.toUpperCase()).includes(from)) {
      const next = customCategorias.map((c) => (c.toUpperCase() === from ? to : c));
      setCustomCategorias(next);
      saveCustomCategorias(next);
    } else {
      // Se não estava, e tinha serviços, garantimos persistência futura adicionando o novo nome
      if (!customCategorias.map((c) => c.toUpperCase()).includes(to)) {
        const next = [...customCategorias, to];
        setCustomCategorias(next);
        saveCustomCategorias(next);
      }
    }
    setCatBusy(false);
    setRenaming(null);
    toast.success(`RENOMEADA (${afetadas.length} SERVIÇO${afetadas.length === 1 ? "" : "S"} ATUALIZADO${afetadas.length === 1 ? "" : "S"})`);
    void load();
  }

  function excluirCategoria(cat: string) {
    const nome = cat.toUpperCase();
    const qtd = contagemPorCategoria.get(nome) ?? 0;
    if (qtd > 0) {
      toast.error(`CATEGORIA POSSUI ${qtd} SERVIÇO(S). MOVA OU EXCLUA OS SERVIÇOS PRIMEIRO.`);
      return;
    }
    if (!confirm(`EXCLUIR CATEGORIA "${nome}"?`)) return;
    const next = customCategorias.filter((c) => c.toUpperCase() !== nome);
    setCustomCategorias(next);
    saveCustomCategorias(next);
    toast.success("CATEGORIA EXCLUÍDA");
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold uppercase tracking-tight text-slate-900">
              PREÇOS DO CATÁLOGO
            </h1>
            <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 uppercase tracking-wider">
              EDITE PREÇO, RECORRÊNCIA E DISPONIBILIDADE DE CADA SERVIÇO
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="BUSCAR SERVIÇO…"
              className="h-9 w-full md:w-64 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-xs uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-amber-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-amber-600 transition"
          >
            <Plus className="h-3.5 w-3.5" /> NOVO SERVIÇO
          </button>
          <button
            type="button"
            onClick={() => setCatManagerOpen(true)}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md border border-slate-300 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
          >
            <FolderCog className="h-3.5 w-3.5" /> CATEGORIAS
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-xs uppercase tracking-wider">
          NENHUM SERVIÇO ENCONTRADO
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([categoria, itens]) => (
            <section key={categoria}>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-700 mb-2 flex items-center gap-2">
                <span className="w-1 h-3 bg-amber-500 rounded-sm" />
                {categoria}
                <span className="text-[10px] font-normal text-slate-400">({itens.length})</span>
              </h2>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="px-3 py-2 font-semibold">SERVIÇO</th>
                      <th className="px-3 py-2 font-semibold w-40">PREÇO (R$)</th>
                      <th className="px-3 py-2 font-semibold w-28 text-center">RECORRENTE</th>
                      <th className="px-3 py-2 font-semibold w-24 text-center">ATIVO</th>
                      <th className="px-3 py-2 font-semibold w-44 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((row) => {
                      const e = edits[row.id] || {};
                      const precoStr =
                        e.preco !== undefined
                          ? e.preco
                          : row.preco != null
                          ? String(row.preco).replace(".", ",")
                          : "";
                      const recorrente = e.recorrente ?? row.recorrente;
                      const ativo = e.ativo ?? row.ativo;
                      const dirty = isDirty(row);
                      const saving = savingId === row.id;
                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-amber-50/40">
                          <td className="px-3 py-2.5">
                            <div className="font-bold uppercase text-slate-900 leading-tight">
                              {row.nome}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.slug}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              value={precoStr}
                              onChange={(ev) => setEdit(row.id, { preco: ev.target.value })}
                              placeholder="0,00"
                              inputMode="decimal"
                              className="h-8 w-full px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-900 font-mono text-right focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                            />
                            {row.preco != null && e.preco === undefined && (
                              <div className="text-[10px] text-slate-400 mt-0.5 text-right">
                                {fmtBRL(row.preco)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setEdit(row.id, { recorrente: !recorrente })}
                              className={`inline-flex items-center justify-center h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border transition ${
                                recorrente
                                  ? "bg-amber-100 border-amber-300 text-amber-800"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {recorrente ? "MENSAL" : "ÚNICA"}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setEdit(row.id, { ativo: !ativo })}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition ${
                                ativo
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              }`}
                              aria-label={ativo ? "Desativar" : "Ativar"}
                            >
                              {ativo ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => save(row)}
                                disabled={!dirty || saving}
                                title="Salvar alterações inline"
                                className="inline-flex items-center gap-1 px-2 h-8 rounded-md bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500 disabled:opacity-30 disabled:hover:bg-slate-900 transition"
                              >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                title="Editar tudo"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-700 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(row)}
                                title="Excluir"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
        <strong className="uppercase tracking-wider">DICA:</strong> O preço aqui aparece imediatamente
        no cartão de contratação da área do cliente (formato R$ 1.997,00). É também travado no cadastro
        do cliente como valor da contratação — sem disparar cobrança automática.
      </div>

      {/* Modal de criação/edição */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-w-md bg-[#f6f5f1] border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight text-slate-900 text-sm font-bold">
              {form?.id ? "EDITAR SERVIÇO" : "NOVO SERVIÇO"}
            </DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <Field label="NOME">
                <input
                  value={form.nome}
                  onChange={(e) => {
                    const nome = e.target.value.toUpperCase();
                    setForm((f) => f && { ...f, nome, slug: slugTouched ? f.slug : slugify(nome) });
                  }}
                  className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                />
              </Field>

              <Field label="SLUG (URL)">
                <input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => f && { ...f, slug: slugify(e.target.value) });
                  }}
                  className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="CATEGORIA">
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm((f) => f && { ...f, categoria: e.target.value.toUpperCase() })}
                    className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                  >
                    <option value="">SELECIONE...</option>
                    {categoriasExistentes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="TIPO">
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((f) => f && { ...f, tipo: e.target.value as "servico" | "produto" })}
                    className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                  >
                    <option value="servico">SERVIÇO</option>
                    <option value="produto">PRODUTO</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="PREÇO (R$)">
                  <input
                    value={form.preco}
                    onChange={(e) => setForm((f) => f && { ...f, preco: e.target.value })}
                    placeholder="1997,00"
                    inputMode="decimal"
                    className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs font-mono text-right text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                  />
                </Field>
                <Field label="ORDEM">
                  <input
                    value={form.display_order}
                    onChange={(e) => setForm((f) => f && { ...f, display_order: e.target.value.replace(/\D/g, "") })}
                    inputMode="numeric"
                    className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs font-mono text-right text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                  />
                </Field>
              </div>

              <Field label="DESCRIÇÃO CURTA">
                <textarea
                  value={form.descricao_curta}
                  onChange={(e) => setForm((f) => f && { ...f, descricao_curta: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                />
              </Field>

              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                  <input
                    type="checkbox"
                    checked={form.recorrente}
                    onChange={(e) => setForm((f) => f && { ...f, recorrente: e.target.checked })}
                    className="accent-amber-500"
                  />
                  RECORRENTE (MENSAL)
                </label>
                <label className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm((f) => f && { ...f, ativo: e.target.checked })}
                    className="accent-amber-500"
                  />
                  ATIVO
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5 inline mr-1" /> CANCELAR
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={submitting}
              className="h-9 px-4 rounded-md bg-amber-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-amber-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : <Save className="h-3.5 w-3.5 inline mr-1" />}
              {form?.id ? "SALVAR" : "CRIAR"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de gestão de categorias */}
      <Dialog open={catManagerOpen} onOpenChange={(open) => { if (!open) { setCatManagerOpen(false); setRenaming(null); } }}>
        <DialogContent className="max-w-md bg-[#f6f5f1] border-slate-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight text-slate-900 text-sm font-bold">
              GERENCIAR CATEGORIAS
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nova categoria */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">NOVA CATEGORIA</div>
                <input
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") adicionarCategoria(); }}
                  placeholder="EX: POLÍCIA FEDERAL / SINARM"
                  className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100"
                />
              </div>
              <button
                type="button"
                onClick={adicionarCategoria}
                className="h-9 px-3 rounded-md bg-amber-500 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-amber-600"
              >
                <Plus className="h-3.5 w-3.5 inline mr-1" /> ADD
              </button>
            </div>

            {/* Lista */}
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {categoriasExistentes.map((cat) => {
                const qtd = contagemPorCategoria.get(cat.toUpperCase()) ?? 0;
                const isRenaming = renaming?.from === cat;
                return (
                  <div key={cat} className="px-3 py-2 flex items-center gap-2">
                    {isRenaming ? (
                      <>
                        <input
                          autoFocus
                          value={renaming.to}
                          onChange={(e) => setRenaming({ ...renaming, to: e.target.value.toUpperCase() })}
                          onKeyDown={(e) => { if (e.key === "Enter") void renomearCategoria(); if (e.key === "Escape") setRenaming(null); }}
                          className="h-8 flex-1 px-2 rounded-md border border-amber-300 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-100"
                        />
                        <button
                          type="button"
                          onClick={() => void renomearCategoria()}
                          disabled={catBusy}
                          className="h-8 px-2 rounded-md bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-amber-600 disabled:opacity-50"
                        >
                          {catBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenaming(null)}
                          className="h-8 px-2 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold uppercase text-slate-900 truncate">{cat}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {qtd} SERVIÇO{qtd === 1 ? "" : "S"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRenaming({ from: cat, to: cat })}
                          title="Renomear (atualiza todos os serviços)"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirCategoria(cat)}
                          title={qtd > 0 ? "Mova/exclua os serviços antes" : "Excluir categoria"}
                          disabled={qtd > 0}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-relaxed">
              <strong className="text-amber-700">RENOMEAR</strong> ATUALIZA TODOS OS SERVIÇOS DA CATEGORIA NO BANCO.
              <br />
              <strong className="text-amber-700">EXCLUIR</strong> SÓ É PERMITIDO PARA CATEGORIAS SEM SERVIÇOS — MOVA-OS ANTES PELA EDIÇÃO DE CADA SERVIÇO.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}