import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Copy as CopyIcon,
  ChevronUp,
  ChevronDown,
  Eye,
  Upload,
  X,
  FileText,
  FilePlus2,
  EyeOff,
} from "lucide-react";
import DocumentoViewerModal from "@/components/quero-armas/DocumentoViewerModal";

/* =============================================================================
 * QAServicoDocumentosModal — Editor de DOCUMENTOS EXIGIDOS de um serviço.
 *
 * Camada ADITIVA: CRUD em `qa_servicos_documentos` (template por servico_id).
 * Não toca em edge functions, schema, nem em qualquer outro fluxo.
 *
 * Visual: Premium Light (#7A1F2B sobre #f6f5f1 / branco).
 * Linguagem: "Equipe Quero Armas" — sem usar a palavra "admin" na UI.
 * ============================================================================= */

const BUCKET = "qa-documentos";
const TEMPLATE_FOLDER = "servico-documentos-templates";

type ExigenciaRow = {
  id: string;
  servico_id: number;
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  obrigatorio: boolean;
  validade_dias: number | null;
  formato_aceito: string[];
  regra_validacao: any | null;
  link_emissao: string | null;
  condicao_profissional: string | null;
  ordem: number;
  ativo: boolean;
  instrucoes: string | null;
  observacoes_cliente: string | null;
  modelo_url: string | null;
  exemplo_url: string | null;
  orgao_emissor: string | null;
  prazo_recomendado_dias: number | null;
  emissor: "cliente" | "quero_armas";
};

type Patch = Partial<Omit<ExigenciaRow, "id" | "servico_id">>;

interface Props {
  open: boolean;
  onClose: () => void;
  servicoId: number | null;
  servicoNome: string;
}

const ETAPAS = ["base", "complementar", "pos_protocolo", "renda", "outros"];
const EMISSORES: Array<ExigenciaRow["emissor"]> = ["cliente", "quero_armas"];

const EMPTY_NEW: Patch = {
  tipo_documento: "documento",
  nome_documento: "NOVO DOCUMENTO",
  etapa: "base",
  obrigatorio: true,
  formato_aceito: ["pdf", "jpg", "jpeg", "png"],
  ordem: 0,
  ativo: true,
  emissor: "cliente",
};

/* ----------------------------- helpers tipo --------------------------------- */

function normalizeSlug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sameCondicao(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "") === (b ?? "");
}

/** Garante um tipo_documento único dentro de (servico_id, condicao_profissional).
 *  Tenta primeiro `${base}_<próximoAno>`, depois `${base}_2`, `_3`, etc. */
function uniqueTipo(
  base: string,
  condicao: string | null | undefined,
  existing: ExigenciaRow[],
  excludeId?: string,
): string {
  const baseSlug = normalizeSlug(base) || "documento";
  const taken = new Set(
    existing
      .filter((r) => r.id !== excludeId && sameCondicao(r.condicao_profissional, condicao))
      .map((r) => (r.tipo_documento ?? "").toLowerCase()),
  );
  if (!taken.has(baseSlug)) return baseSlug;
  // 1) tentar sufixo por ano (próximo ano não usado, indo para trás)
  const yearNow = new Date().getFullYear();
  for (let y = yearNow; y >= yearNow - 10; y--) {
    const cand = `${baseSlug}_${y}`;
    if (!taken.has(cand)) return cand;
  }
  // 2) fallback _2, _3...
  let i = 2;
  while (taken.has(`${baseSlug}_${i}`)) i++;
  return `${baseSlug}_${i}`;
}

export default function QAServicoDocumentosModal({ open, onClose, servicoId, servicoNome }: Props) {
  const [rows, setRows] = useState<ExigenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [patches, setPatches] = useState<Record<string, Patch>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewer, setViewer] = useState<{ bucket: string; path: string; fileName?: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!servicoId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_servicos_documentos" as any)
      .select("*")
      .eq("servico_id", servicoId)
      .order("ordem", { ascending: true })
      .order("nome_documento", { ascending: true });
    if (error) {
      toast.error("FALHA AO CARREGAR EXIGÊNCIAS — " + error.message.toUpperCase());
      setRows([]);
    } else {
      setRows(((data ?? []) as unknown) as ExigenciaRow[]);
    }
    setPatches({});
    setLoading(false);
  }, [servicoId]);

  useEffect(() => {
    if (open && servicoId) void load();
    if (!open) {
      setPatches({});
      setPreviewOpen(false);
      setViewer(null);
    }
  }, [open, servicoId, load]);

  const merged = useMemo<ExigenciaRow[]>(() => {
    return rows.map((r) => ({ ...r, ...patches[r.id] }));
  }, [rows, patches]);

  function patch(id: string, p: Patch) {
    setPatches((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  function isDirty(id: string) {
    return !!patches[id] && Object.keys(patches[id]).length > 0;
  }

  async function saveRow(row: ExigenciaRow) {
    const p = patches[row.id];
    if (!p) return;

    // valida duplicidade de tipo_documento no cliente (mesma condição)
    const novoTipo = (p.tipo_documento ?? row.tipo_documento ?? "").toLowerCase();
    const novaCond = p.condicao_profissional !== undefined ? p.condicao_profissional : row.condicao_profissional;
    const colide = rows.some(
      (r) =>
        r.id !== row.id &&
        (r.tipo_documento ?? "").toLowerCase() === novoTipo &&
        sameCondicao(r.condicao_profissional, novaCond),
    );
    if (colide) {
      toast.error("JÁ EXISTE UMA EXIGÊNCIA COM ESSE TIPO PARA ESTE SERVIÇO");
      return;
    }

    // garante regra_validacao como JSON válido (não persiste string crua)
    const payload: Patch = { ...p };
    if (payload.regra_validacao !== undefined && typeof payload.regra_validacao === "string") {
      try {
        payload.regra_validacao = JSON.parse(payload.regra_validacao as unknown as string);
      } catch {
        toast.error("REGRA DE VALIDAÇÃO COM JSON INVÁLIDO");
        return;
      }
    }

    setSavingId(row.id);
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update(payload)
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("FALHA AO SALVAR — " + error.message.toUpperCase());
      return;
    }
    toast.success("EXIGÊNCIA SALVA");
    setRows((prev) => prev.map((r) => (r.id === row.id ? ({ ...r, ...payload } as ExigenciaRow) : r)));
    setPatches((prev) => {
      const { [row.id]: _drop, ...rest } = prev;
      return rest;
    });
  }

  async function addNew(source?: ExigenciaRow) {
    if (!servicoId) return;
    const baseTipo = source ? normalizeSlug(source.tipo_documento || "documento") : "documento";
    const tipoUnico = source ? uniqueTipo(baseTipo, source.condicao_profissional, rows) : "documento";
    const base: any = source
      ? {
          servico_id: servicoId,
          tipo_documento: tipoUnico,
          nome_documento: (source.nome_documento || "DOCUMENTO") + " (CÓPIA)",
          etapa: source.etapa,
          obrigatorio: source.obrigatorio,
          validade_dias: source.validade_dias,
          formato_aceito: source.formato_aceito,
          regra_validacao: {
            ...(source.regra_validacao && typeof source.regra_validacao === "object" ? source.regra_validacao : {}),
            tipo_base: baseTipo,
          },
          link_emissao: source.link_emissao,
          condicao_profissional: source.condicao_profissional,
          ordem: (source.ordem ?? 0) + 1,
          ativo: true,
          instrucoes: source.instrucoes,
          observacoes_cliente: source.observacoes_cliente,
          modelo_url: source.modelo_url,
          exemplo_url: source.exemplo_url,
          orgao_emissor: source.orgao_emissor,
          prazo_recomendado_dias: source.prazo_recomendado_dias,
          emissor: source.emissor,
        }
      : {
          servico_id: servicoId,
          ...EMPTY_NEW,
          ordem: (rows.length + 1) * 10,
        };
    const { data, error } = await supabase
      .from("qa_servicos_documentos" as any)
      .insert(base)
      .select("*")
      .single();
    if (error) {
      toast.error("FALHA AO CRIAR — " + error.message.toUpperCase());
      return;
    }
    toast.success(source ? "DUPLICADA — REVISE O TIPO ANTES DE SALVAR" : "EXIGÊNCIA CRIADA");
    setRows((prev) => [...prev, (data as unknown) as ExigenciaRow]);
    if (source) {
      // marca dirty no novo registro para destacar e forçar revisão do tipo
      const created = data as unknown as ExigenciaRow;
      patch(created.id, { tipo_documento: tipoUnico });
    }
  }

  /** Expande uma exigência em N linhas, uma por ano informado.
   *  Cada linha vira `${tipoCanonico}_${ano}` e `${nomeBase} ${ano}`. */
  async function expandirPorAnos(row: ExigenciaRow, anos: number[]) {
    if (!servicoId || anos.length === 0) return;
    const tipoCanonico = normalizeSlug(row.tipo_documento || "documento");
    const nomeBase = (row.nome_documento || "DOCUMENTO").replace(/\s+\d{4}\s*$/, "").trim();
    const baseOrdem = row.ordem ?? 0;
    const sortedAnos = [...new Set(anos)].sort((a, b) => b - a); // mais recente primeiro
    const existentes = new Set(
      rows
        .filter((r) => sameCondicao(r.condicao_profissional, row.condicao_profissional))
        .map((r) => (r.tipo_documento ?? "").toLowerCase()),
    );
    const payloads: any[] = [];
    const ignorados: number[] = [];
    sortedAnos.forEach((ano, i) => {
      const tipo = `${tipoCanonico}_${ano}`;
      if (existentes.has(tipo)) {
        ignorados.push(ano);
        return;
      }
      existentes.add(tipo);
      payloads.push({
        servico_id: servicoId,
        tipo_documento: tipo,
        nome_documento: `${nomeBase} ${ano}`.toUpperCase(),
        etapa: row.etapa,
        obrigatorio: row.obrigatorio,
        validade_dias: row.validade_dias,
        formato_aceito: row.formato_aceito,
        regra_validacao: {
          ...(row.regra_validacao && typeof row.regra_validacao === "object" ? row.regra_validacao : {}),
          tipo_base: tipoCanonico,
          ano_competencia: ano,
        },
        link_emissao: row.link_emissao,
        condicao_profissional: row.condicao_profissional,
        ordem: baseOrdem + i + 1,
        ativo: true,
        instrucoes: row.instrucoes,
        observacoes_cliente: row.observacoes_cliente,
        modelo_url: row.modelo_url,
        exemplo_url: row.exemplo_url,
        orgao_emissor: row.orgao_emissor,
        prazo_recomendado_dias: row.prazo_recomendado_dias,
        emissor: row.emissor,
      });
    });
    if (payloads.length === 0) {
      toast.error("TODOS OS ANOS INFORMADOS JÁ EXISTEM PARA ESTE SERVIÇO");
      return;
    }
    const { data, error } = await supabase
      .from("qa_servicos_documentos" as any)
      .insert(payloads)
      .select("*");
    if (error) {
      toast.error("FALHA AO EXPANDIR — " + error.message.toUpperCase());
      return;
    }
    toast.success(
      `${payloads.length} EXIGÊNCIA(S) CRIADA(S)` +
        (ignorados.length ? ` — IGNORADOS: ${ignorados.join(", ")}` : ""),
    );
    setRows((prev) => [...prev, ...((data ?? []) as unknown as ExigenciaRow[])]);
  }

  async function removeRow(row: ExigenciaRow) {
    if (!confirm(`EXCLUIR "${row.nome_documento}"?`)) return;
    const { error } = await supabase.from("qa_servicos_documentos" as any).delete().eq("id", row.id);
    if (error) {
      toast.error("FALHA AO EXCLUIR — " + error.message.toUpperCase());
      return;
    }
    toast.success("EXIGÊNCIA EXCLUÍDA");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setPatches((prev) => {
      const { [row.id]: _d, ...rest } = prev;
      return rest;
    });
  }

  async function moveRow(row: ExigenciaRow, dir: -1 | 1) {
    const idx = merged.findIndex((r) => r.id === row.id);
    const swap = merged[idx + dir];
    if (!swap) return;
    const a = row.ordem ?? 0;
    const b = swap.ordem ?? 0;
    const ordemA = a === b ? a + dir : b;
    const ordemB = a === b ? a : a;
    await Promise.all([
      supabase.from("qa_servicos_documentos" as any).update({ ordem: ordemA }).eq("id", row.id),
      supabase.from("qa_servicos_documentos" as any).update({ ordem: ordemB }).eq("id", swap.id),
    ]);
    void load();
  }

  async function uploadModeloOuExemplo(row: ExigenciaRow, campo: "modelo_url" | "exemplo_url", file: File) {
    if (!servicoId) return;
    setUploadingId(row.id + ":" + campo);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${TEMPLATE_FOLDER}/${servicoId}/${row.id}/${campo}-${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("qa_servicos_documentos" as any)
        .update({ [campo]: path })
        .eq("id", row.id);
      if (upErr) throw upErr;
      toast.success(campo === "modelo_url" ? "MODELO ENVIADO" : "EXEMPLO ENVIADO");
      setRows((prev) => prev.map((r) => (r.id === row.id ? ({ ...r, [campo]: path } as ExigenciaRow) : r)));
    } catch (e: any) {
      toast.error("FALHA NO UPLOAD — " + (e?.message ?? "ERRO").toUpperCase());
    } finally {
      setUploadingId(null);
    }
  }

  async function clearArquivo(row: ExigenciaRow, campo: "modelo_url" | "exemplo_url") {
    if (!row[campo]) return;
    if (!confirm("REMOVER ARQUIVO?")) return;
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .update({ [campo]: null })
      .eq("id", row.id);
    if (error) {
      toast.error("FALHA — " + error.message.toUpperCase());
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? ({ ...r, [campo]: null } as ExigenciaRow) : r)));
    toast.success("ARQUIVO REMOVIDO DO TEMPLATE");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl bg-[#f6f5f1] border-slate-200 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight text-slate-900 text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#7A1F2B]" />
              DOCUMENTOS EXIGIDOS — {servicoNome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              CADA LINHA É UMA EXIGÊNCIA QUE O CLIENTE PRECISA ENVIAR PARA CONTRATAR ESTE SERVIÇO.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md border border-slate-300 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
              >
                {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {previewOpen ? "OCULTAR PRÉ-VIA" : "PRÉ-VISUALIZAR COMO CLIENTE"}
              </button>
              <button
                type="button"
                onClick={() => void addNew()}
                className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md bg-[#7A1F2B] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#5e1820]"
              >
                <Plus className="h-3.5 w-3.5" /> NOVA EXIGÊNCIA
              </button>
            </div>
          </div>

          {previewOpen && (
            <ClientePreview rows={merged.filter((r) => r.ativo)} />
          )}

          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-[#7A1F2B] animate-spin" />
              </div>
            ) : merged.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs uppercase tracking-wider">
                NENHUMA EXIGÊNCIA CADASTRADA. CLIQUE EM "NOVA EXIGÊNCIA".
              </div>
            ) : (
              <div className="space-y-3">
                {merged.map((row, idx) => (
                  <ExigenciaCard
                    key={row.id}
                    row={row}
                    dirty={isDirty(row.id)}
                    saving={savingId === row.id}
                    uploadingId={uploadingId}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < merged.length - 1}
                    onPatch={(p) => patch(row.id, p)}
                    onSave={() => void saveRow(row)}
                    onDuplicate={() => void addNew(row)}
                    onDelete={() => void removeRow(row)}
                    onMoveUp={() => void moveRow(row, -1)}
                    onMoveDown={() => void moveRow(row, 1)}
                    onUpload={(campo, file) => void uploadModeloOuExemplo(row, campo, file)}
                    onClearArquivo={(campo) => void clearArquivo(row, campo)}
                    onView={(path, fileName) => setViewer({ bucket: BUCKET, path, fileName })}
                    onExpandirAnos={(anos) => void expandirPorAnos(row, anos)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              ALTERAÇÕES SÃO SALVAS LINHA-A-LINHA. CAMPO COM <span className="text-[#7A1F2B] font-bold">PONTO</span> = NÃO SALVO.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5 inline mr-1" /> FECHAR
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentoViewerModal
        open={!!viewer}
        onClose={() => setViewer(null)}
        source={viewer ? { kind: "storage", bucket: viewer.bucket, path: viewer.path, fileName: viewer.fileName } : null}
        title="ARQUIVO DO TEMPLATE"
      />
    </>
  );
}

/* ----------------------------- subcomponentes ----------------------------- */

interface CardProps {
  row: ExigenciaRow;
  dirty: boolean;
  saving: boolean;
  uploadingId: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (p: Patch) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpload: (campo: "modelo_url" | "exemplo_url", file: File) => void;
  onClearArquivo: (campo: "modelo_url" | "exemplo_url") => void;
  onView: (path: string, fileName?: string) => void;
}

function ExigenciaCard({
  row,
  dirty,
  saving,
  uploadingId,
  canMoveUp,
  canMoveDown,
  onPatch,
  onSave,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpload,
  onClearArquivo,
  onView,
}: CardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 transition ${
        dirty ? "border-[#7A1F2B]/40 shadow-[0_0_0_3px_rgba(122,31,43,0.06)]" : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="w-6 h-6 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Subir"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="w-6 h-6 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Descer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-2">
          <Field label="NOME DO DOCUMENTO" colSpan={6}>
            <input
              value={row.nome_documento ?? ""}
              onChange={(e) => onPatch({ nome_documento: e.target.value.toUpperCase() })}
              className={inputCls}
            />
          </Field>
          <Field label="TIPO (SLUG)" colSpan={4}>
            <input
              value={row.tipo_documento ?? ""}
              onChange={(e) => onPatch({ tipo_documento: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
              className={inputCls + " font-mono lowercase"}
              style={{ textTransform: "lowercase" }}
            />
          </Field>
          <Field label="ORDEM" colSpan={2}>
            <input
              type="number"
              value={row.ordem ?? 0}
              onChange={(e) => onPatch({ ordem: Number(e.target.value) || 0 })}
              className={inputCls + " font-mono text-right"}
            />
          </Field>

          <Field label="ETAPA" colSpan={3}>
            <select
              value={row.etapa ?? "base"}
              onChange={(e) => onPatch({ etapa: e.target.value })}
              className={inputCls}
            >
              {ETAPAS.map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="CONDIÇÃO PROFISSIONAL" colSpan={3}>
            <input
              value={row.condicao_profissional ?? ""}
              onChange={(e) => onPatch({ condicao_profissional: e.target.value.trim() ? e.target.value.toLowerCase() : null })}
              placeholder="OPCIONAL"
              className={inputCls + " lowercase"}
              style={{ textTransform: "lowercase" }}
            />
          </Field>
          <Field label="EMISSOR" colSpan={2}>
            <select
              value={row.emissor ?? "cliente"}
              onChange={(e) => onPatch({ emissor: e.target.value as ExigenciaRow["emissor"] })}
              className={inputCls}
            >
              {EMISSORES.map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="ÓRGÃO EMISSOR" colSpan={4}>
            <input
              value={row.orgao_emissor ?? ""}
              onChange={(e) => onPatch({ orgao_emissor: e.target.value || null })}
              className={inputCls}
            />
          </Field>

          <Field label="FORMATOS (vírgula)" colSpan={4}>
            <input
              value={(row.formato_aceito ?? []).join(", ")}
              onChange={(e) =>
                onPatch({
                  formato_aceito: e.target.value
                    .split(",")
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              className={inputCls + " font-mono lowercase"}
              style={{ textTransform: "lowercase" }}
            />
          </Field>
          <Field label="VALIDADE (DIAS)" colSpan={2}>
            <input
              type="number"
              value={row.validade_dias ?? ""}
              onChange={(e) => onPatch({ validade_dias: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputCls + " font-mono text-right"}
            />
          </Field>
          <Field label="PRAZO RECOMENDADO (DIAS)" colSpan={2}>
            <input
              type="number"
              value={row.prazo_recomendado_dias ?? ""}
              onChange={(e) => onPatch({ prazo_recomendado_dias: e.target.value === "" ? null : Number(e.target.value) })}
              className={inputCls + " font-mono text-right"}
            />
          </Field>
          <Field label="LINK DE EMISSÃO" colSpan={4}>
            <input
              value={row.link_emissao ?? ""}
              onChange={(e) => onPatch({ link_emissao: e.target.value || null })}
              placeholder="https://"
              className={inputCls + " normal-case"}
              style={{ textTransform: "none" }}
            />
          </Field>

          <Field label="INSTRUÇÕES (INTERNAS)" colSpan={6}>
            <textarea
              value={row.instrucoes ?? ""}
              onChange={(e) => onPatch({ instrucoes: e.target.value || null })}
              rows={2}
              className={textareaCls}
              style={{ textTransform: "none" }}
            />
          </Field>
          <Field label="OBSERVAÇÕES PARA O CLIENTE" colSpan={6}>
            <textarea
              value={row.observacoes_cliente ?? ""}
              onChange={(e) => onPatch({ observacoes_cliente: e.target.value || null })}
              rows={2}
              className={textareaCls}
              style={{ textTransform: "none" }}
            />
          </Field>

          <Field label="REGRA DE VALIDAÇÃO (JSON)" colSpan={12}>
            <textarea
              value={row.regra_validacao ? JSON.stringify(row.regra_validacao, null, 2) : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (!v) {
                  onPatch({ regra_validacao: null });
                  return;
                }
                try {
                  onPatch({ regra_validacao: JSON.parse(v) });
                } catch {
                  // mantém digitação, mas não persiste inválido
                  onPatch({ regra_validacao: v as any });
                }
              }}
              rows={2}
              className={textareaCls + " font-mono"}
              style={{ textTransform: "none" }}
              placeholder='{ "exemplo": true }'
            />
          </Field>

          {/* Anexos do template */}
          <div className="col-span-12 grid grid-cols-2 gap-2">
            <AnexoBox
              titulo="MODELO (PARA O CLIENTE BAIXAR)"
              value={row.modelo_url}
              uploading={uploadingId === row.id + ":modelo_url"}
              onFile={(f) => onUpload("modelo_url", f)}
              onView={() => row.modelo_url && onView(row.modelo_url, "MODELO")}
              onClear={() => onClearArquivo("modelo_url")}
            />
            <AnexoBox
              titulo="EXEMPLO (PREENCHIDO)"
              value={row.exemplo_url}
              uploading={uploadingId === row.id + ":exemplo_url"}
              onFile={(f) => onUpload("exemplo_url", f)}
              onView={() => row.exemplo_url && onView(row.exemplo_url, "EXEMPLO")}
              onClear={() => onClearArquivo("exemplo_url")}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
          <label className="inline-flex items-center gap-1.5 text-slate-700 font-bold">
            <input
              type="checkbox"
              checked={!!row.obrigatorio}
              onChange={(e) => onPatch({ obrigatorio: e.target.checked })}
              className="accent-[#7A1F2B]"
            />
            OBRIGATÓRIO
          </label>
          <label className="inline-flex items-center gap-1.5 text-slate-700 font-bold">
            <input
              type="checkbox"
              checked={!!row.ativo}
              onChange={(e) => onPatch({ ativo: e.target.checked })}
              className="accent-[#7A1F2B]"
            />
            ATIVO
          </label>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicar exigência"
            className="h-8 px-2 inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider hover:bg-[#7A1F2B]/10 hover:text-[#7A1F2B]"
          >
            <CopyIcon className="h-3.5 w-3.5" /> DUPLICAR
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Excluir"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="h-8 px-3 inline-flex items-center gap-1 rounded-md bg-[#7A1F2B] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#5e1820] disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}

function AnexoBox({
  titulo,
  value,
  uploading,
  onFile,
  onView,
  onClear,
}: {
  titulo: string;
  value: string | null;
  uploading: boolean;
  onFile: (f: File) => void;
  onView: () => void;
  onClear: () => void;
}) {
  const inputId = `anx-${titulo.replace(/\s+/g, "_")}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{titulo}</div>
      {value ? (
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono text-slate-700 truncate" title={value}>
            {value.split("/").pop()}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onView}
              className="h-7 px-2 inline-flex items-center gap-1 rounded bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
            >
              <Eye className="h-3 w-3" /> VER
            </button>
            <label
              htmlFor={inputId}
              className="h-7 px-2 inline-flex items-center gap-1 rounded bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} TROCAR
            </label>
            <button
              type="button"
              onClick={onClear}
              className="h-7 w-7 inline-flex items-center justify-center rounded bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
              title="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex items-center justify-center gap-1.5 h-9 rounded bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FilePlus2 className="h-3 w-3" />}
          {uploading ? "ENVIANDO…" : "ENVIAR ARQUIVO"}
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ClientePreview({ rows }: { rows: ExigenciaRow[] }) {
  return (
    <div className="rounded-xl border border-[#7A1F2B]/20 bg-white p-3 mb-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#7A1F2B] mb-2">
        PRÉ-VIA — ORDEM EM QUE O CLIENTE VERÁ
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] uppercase tracking-wider text-slate-500">SEM EXIGÊNCIAS ATIVAS.</div>
      ) : (
        <ol className="space-y-1.5">
          {rows
            .slice()
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((r, i) => (
              <li key={r.id} className="flex items-start gap-2 text-[12px]">
                <span className="inline-flex shrink-0 w-5 h-5 rounded bg-[#7A1F2B]/10 text-[#7A1F2B] text-[10px] font-bold items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900">
                    {r.nome_documento}
                    {r.obrigatorio ? (
                      <span className="ml-2 text-[9px] font-bold uppercase text-[#7A1F2B]">OBRIGATÓRIO</span>
                    ) : (
                      <span className="ml-2 text-[9px] font-bold uppercase text-slate-400">OPCIONAL</span>
                    )}
                    {r.condicao_profissional ? (
                      <span className="ml-2 text-[9px] font-mono uppercase text-slate-500">[{r.condicao_profissional}]</span>
                    ) : null}
                  </div>
                  {r.observacoes_cliente ? (
                    <div className="text-[11px] text-slate-600">{r.observacoes_cliente}</div>
                  ) : null}
                </div>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}

function Field({ label, children, colSpan = 12 }: { label: string; children: React.ReactNode; colSpan?: number }) {
  const cls = `col-span-${colSpan}`;
  return (
    <div className={cls}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-xs uppercase text-slate-900 focus:outline-none focus:border-[#7A1F2B]/40 focus:ring-1 focus:ring-[#7A1F2B]/15";
const textareaCls =
  "w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-[#7A1F2B]/40 focus:ring-1 focus:ring-[#7A1F2B]/15";