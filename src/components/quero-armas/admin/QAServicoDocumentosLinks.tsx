import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  ExternalLink,
  Link2,
} from "lucide-react";

/* =============================================================================
 * QAServicoDocumentosLinks — CRUD dos qa_document_external_links de uma exigência.
 *
 * Camada ADITIVA. Usa SOMENTE qa_document_external_links (sem schema novo).
 * Filtro por tipo_documento da exigência (e categoria opcional). Os links são
 * GLOBAIS por tipo_documento (não pertencem a um servico_id específico) —
 * editar aqui reflete em todas as exigências que usem o mesmo tipo_documento,
 * incluindo o assistente guiado do cliente que já os consome.
 *
 * Visual: Premium Light (#7A1F2B sobre branco). Linguagem: Equipe Quero Armas.
 * ============================================================================= */

type LinkRow = {
  id: string;
  tipo_documento: string;
  nome_botao: string;
  url: string;
  descricao: string | null;
  categoria: string | null;
  ordem: number;
  ativo: boolean;
};

type LinkPatch = Partial<Omit<LinkRow, "id" | "tipo_documento">>;

interface Props {
  tipoDocumento: string;
}

export default function QAServicoDocumentosLinks({ tipoDocumento }: Props) {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [patches, setPatches] = useState<Record<string, LinkPatch>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!tipoDocumento) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_document_external_links" as any)
      .select("*")
      .eq("tipo_documento", tipoDocumento)
      .order("ordem", { ascending: true })
      .order("nome_botao", { ascending: true });
    if (error) toast.error("FALHA AO CARREGAR LINKS — " + error.message.toUpperCase());
    setRows(((data ?? []) as unknown) as LinkRow[]);
    setPatches({});
    setLoading(false);
  }, [tipoDocumento]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, p: LinkPatch) {
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }
  function isDirty(id: string) {
    return !!patches[id] && Object.keys(patches[id]).length > 0;
  }

  async function saveRow(row: LinkRow) {
    const p = patches[row.id];
    if (!p) return;
    if (p.url !== undefined) {
      const u = (p.url ?? "").trim();
      if (!/^https?:\/\//i.test(u)) {
        toast.error("URL DEVE COMEÇAR COM HTTP:// OU HTTPS://");
        return;
      }
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("qa_document_external_links" as any)
      .update(p)
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("FALHA AO SALVAR — " + error.message.toUpperCase());
      return;
    }
    toast.success("LINK SALVO — JÁ APARECE NO ASSISTENTE DO CLIENTE");
    setRows((prev) => prev.map((r) => (r.id === row.id ? ({ ...r, ...p } as LinkRow) : r)));
    setPatches((prev) => {
      const { [row.id]: _drop, ...rest } = prev;
      return rest;
    });
  }

  async function addNew() {
    setCreating(true);
    const { data, error } = await supabase
      .from("qa_document_external_links" as any)
      .insert({
        tipo_documento: tipoDocumento,
        nome_botao: "NOVO BOTÃO",
        url: "https://",
        descricao: null,
        categoria: null,
        ordem: (rows.length + 1) * 10,
        ativo: true,
      })
      .select("*")
      .single();
    setCreating(false);
    if (error) {
      toast.error("FALHA AO CRIAR — " + error.message.toUpperCase());
      return;
    }
    toast.success("LINK CRIADO — EDITE E SALVE");
    setRows((prev) => [...prev, (data as unknown) as LinkRow]);
  }

  async function removeRow(row: LinkRow) {
    if (!confirm(`REMOVER O BOTÃO "${row.nome_botao}"?`)) return;
    const { error } = await supabase.from("qa_document_external_links" as any).delete().eq("id", row.id);
    if (error) {
      toast.error("FALHA — " + error.message.toUpperCase());
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setPatches((prev) => {
      const { [row.id]: _d, ...rest } = prev;
      return rest;
    });
    toast.success("LINK REMOVIDO");
  }

  return (
    <div className="col-span-12 rounded-lg border border-[#7A1F2B]/20 bg-white p-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-[#7A1F2B]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A1F2B]">
            LINKS DE EMISSÃO (REAPROVEITADOS DO CATÁLOGO)
          </span>
        </div>
        <button
          type="button"
          onClick={() => void addNew()}
          disabled={creating}
          className="h-7 px-2 inline-flex items-center gap-1 rounded bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          NOVO BOTÃO
        </button>
      </div>

      <p className="text-[11px] text-slate-600 mb-2 leading-snug">
        Estes botões aparecem no <b>assistente guiado do cliente</b> e nas instruções
        deste documento. São <b>globais por tipo de documento</b> — editar aqui atualiza
        em todos os serviços que usem o mesmo tipo. Use a explicação adicional da
        exigência (campo "OBSERVAÇÕES PARA O CLIENTE" acima) para textos específicos.
      </p>

      {loading ? (
        <div className="py-4 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[#7A1F2B]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[11px] uppercase tracking-wider text-slate-500">
          NENHUM LINK DE EMISSÃO PARA O TIPO "{tipoDocumento}". CLIQUE EM "NOVO BOTÃO".
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const m = { ...row, ...patches[row.id] };
            const dirty = isDirty(row.id);
            return (
              <div
                key={row.id}
                className={`rounded-md border bg-white p-2 grid grid-cols-12 gap-2 items-center ${
                  dirty ? "border-[#7A1F2B]/50" : "border-slate-200"
                }`}
              >
                <input
                  value={m.nome_botao ?? ""}
                  onChange={(e) => patch(row.id, { nome_botao: e.target.value.toUpperCase() })}
                  placeholder="NOME DO BOTÃO"
                  className="col-span-12 md:col-span-3 h-8 px-2 rounded border border-slate-200 bg-white text-[11px] uppercase font-bold text-slate-900 focus:outline-none focus:border-[#7A1F2B]/40"
                />
                <input
                  value={m.url ?? ""}
                  onChange={(e) => patch(row.id, { url: e.target.value })}
                  placeholder="https://..."
                  className="col-span-12 md:col-span-4 h-8 px-2 rounded border border-slate-200 bg-white text-[11px] font-mono text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
                  style={{ textTransform: "none" }}
                />
                <input
                  value={m.categoria ?? ""}
                  onChange={(e) => patch(row.id, { categoria: e.target.value || null })}
                  placeholder="CATEGORIA (OPCIONAL)"
                  className="col-span-6 md:col-span-2 h-8 px-2 rounded border border-slate-200 bg-white text-[11px] uppercase text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
                />
                <input
                  type="number"
                  value={m.ordem ?? 0}
                  onChange={(e) => patch(row.id, { ordem: Number(e.target.value) || 0 })}
                  className="col-span-3 md:col-span-1 h-8 px-2 rounded border border-slate-200 bg-white text-[11px] font-mono text-right text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
                  title="Ordem"
                />
                <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1">
                  <label className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!m.ativo}
                      onChange={(e) => patch(row.id, { ativo: e.target.checked })}
                      className="accent-[#7A1F2B]"
                    />
                    ATIVO
                  </label>
                  {m.url && /^https?:\/\//i.test(m.url) ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      title="Abrir em nova aba"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveRow(row)}
                    disabled={!dirty || savingId === row.id}
                    className="h-7 px-2 inline-flex items-center gap-1 rounded bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-40"
                  >
                    {savingId === row.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    SALVAR
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeRow(row)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  value={m.descricao ?? ""}
                  onChange={(e) => patch(row.id, { descricao: e.target.value || null })}
                  placeholder="DESCRIÇÃO CURTA (APARECE PARA O CLIENTE)"
                  className="col-span-12 h-8 px-2 rounded border border-slate-200 bg-white text-[11px] text-slate-800 focus:outline-none focus:border-[#7A1F2B]/40"
                  style={{ textTransform: "none" }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}