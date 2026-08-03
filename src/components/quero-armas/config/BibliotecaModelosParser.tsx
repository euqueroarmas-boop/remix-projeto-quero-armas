import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ScanLine, Sparkles, FileCheck2 } from "lucide-react";

export type ModeloParser = {
  id: string;
  tipo_documento: string;
  nome_modelo: string;
  ativo: boolean;
  created_at: string;
  tem_deterministico: boolean;
  tem_ia: boolean;
};

/** Carrega o resumo de modelos treinados por tipo de documento (código da biblioteca). */
export async function carregarResumoModelos(): Promise<
  Map<string, { total: number; deterministico: number; ia: number }>
> {
  const mapa = new Map<string, { total: number; deterministico: number; ia: number }>();
  const { data } = await supabase
    .from("qa_documentos_modelos_aprovados" as any)
    .select("tipo_documento, texto_ocr_normalizado, embedding_texto, ativo")
    .eq("ativo", true);
  for (const r of ((data as any[]) ?? [])) {
    const k = String(r.tipo_documento);
    const atual = mapa.get(k) ?? { total: 0, deterministico: 0, ia: 0 };
    atual.total += 1;
    if (r.texto_ocr_normalizado) atual.deterministico += 1;
    if (r.embedding_texto) atual.ia += 1;
    mapa.set(k, atual);
  }
  return mapa;
}


/** Sobe um arquivo e treina o modelo do parser. Lança em caso de falha. */
export async function treinarModeloArquivo(codigo: string, nomeDocumento: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase();
  const path = `biblioteca-modelos/${codigo}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("qa-processo-docs")
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { data, error } = await supabase.functions.invoke("qa-modelo-biblioteca-treinar", {
    body: {
      codigo,
      nome_modelo: file.name.replace(/\.[^.]+$/, "").toUpperCase(),
      storage_path: path,
      observacoes: `MODELO DE REFERÊNCIA — ${nomeDocumento.toUpperCase()}`,
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { deterministico?: boolean; ia?: boolean };
}

/** Selo compacto exibido na linha da biblioteca. */
export function SeloModeloParser({
  resumo,
}: {
  resumo?: { total: number; deterministico: number; ia: number };
}) {
  if (!resumo || resumo.total === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide text-slate-400 border-slate-200 bg-slate-50"
        title="Nenhum modelo de referência salvo para o parser"
      >
        <ScanLine className="w-2.5 h-2.5" /> sem modelo
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide"
      style={{ color: "#065F46", borderColor: "#A7F3D0", background: "#ECFDF5" }}
      title={`${resumo.total} modelo(s) salvo(s) · ${resumo.deterministico} com análise determinística · ${resumo.ia} com análise por IA`}
    >
      <FileCheck2 className="w-2.5 h-2.5" />
      {resumo.total} modelo{resumo.total > 1 ? "s" : ""}
      {resumo.deterministico > 0 && <ScanLine className="w-2.5 h-2.5" />}
      {resumo.ia > 0 && <Sparkles className="w-2.5 h-2.5" />}
    </span>
  );
}

/** Painel de gestão dos modelos de referência do parser para um documento da biblioteca. */
export default function BibliotecaModelosParser({
  codigo,
  nomeDocumento,
  onChanged,
}: {
  codigo: string;
  nomeDocumento: string;
  onChanged?: () => void;
}) {
  const [modelos, setModelos] = useState<ModeloParser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("qa_documentos_modelos_aprovados" as any)
      .select("id, tipo_documento, nome_modelo, ativo, created_at, texto_ocr_normalizado, embedding_texto")
      .eq("tipo_documento", codigo)
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    setModelos(
      ((data as any[]) ?? []).map((r) => ({
        id: r.id,
        tipo_documento: r.tipo_documento,
        nome_modelo: r.nome_modelo,
        ativo: r.ativo,
        created_at: r.created_at,
        tem_deterministico: !!r.texto_ocr_normalizado,
        tem_ia: !!r.embedding_texto,
      })),
    );
    setCarregando(false);
  }, [codigo]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function enviarArquivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const lista = Array.from(files);
    for (const file of lista) {
      setEnviando(file.name);
      try {
        const data = await treinarModeloArquivo(codigo, nomeDocumento, file);

        const det = (data as any)?.deterministico ? "determinística ✓" : "determinística —";
        const ia = (data as any)?.ia ? "IA ✓" : "IA —";
        toast.success(`Modelo "${file.name}" treinado (${det} · ${ia})`);
      } catch (e: any) {
        toast.error(`Falha em "${file.name}": ${e?.message ?? "erro"}`);
      }
    }
    setEnviando(null);
    if (inputRef.current) inputRef.current.value = "";
    await carregar();
    onChanged?.();
  }

  async function remover(m: ModeloParser) {
    if (!confirm(`Remover o modelo "${m.nome_modelo}" do parser?`)) return;
    const { error } = await supabase
      .from("qa_documentos_modelos_aprovados" as any)
      .update({ ativo: false })
      .eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo removido");
    await carregar();
    onChanged?.();
  }

  return (
    <div className="rounded-lg border bg-white p-3" style={{ borderColor: "hsl(220 15% 90%)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Modelos de referência do parser
          </p>
          <p className="text-[10px] text-slate-400">
            Envie 2 ou mais exemplos reais deste documento. Cada arquivo gera análise determinística
            (texto + palavras-chave) e análise por IA (embedding) para comparação futura.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 shrink-0"
          disabled={!!enviando}
          onClick={() => inputRef.current?.click()}
        >
          {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {enviando ? "Treinando…" : "Adicionar modelos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => void enviarArquivos(e.target.files)}
        />
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando modelos…
        </div>
      ) : modelos.length === 0 ? (
        <p className="text-[11px] italic text-slate-400 py-1">
          Nenhum modelo salvo ainda — o parser está sem base de comparação para este documento.
        </p>
      ) : (
        <div className="space-y-1">
          {modelos.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5"
              style={{ borderColor: "hsl(220 15% 92%)" }}
            >
              <FileCheck2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#059669" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium truncate text-slate-700">{m.nome_modelo}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(m.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase"
                style={
                  m.tem_deterministico
                    ? { color: "#065F46", borderColor: "#A7F3D0", background: "#ECFDF5" }
                    : { color: "#94A3B8", borderColor: "#E2E8F0", background: "#F8FAFC" }
                }
                title="Análise determinística (texto e palavras-chave)"
              >
                <ScanLine className="w-2.5 h-2.5" /> det
              </span>
              <span
                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase"
                style={
                  m.tem_ia
                    ? { color: "#1D4ED8", borderColor: "#BFDBFE", background: "#EFF6FF" }
                    : { color: "#94A3B8", borderColor: "#E2E8F0", background: "#F8FAFC" }
                }
                title="Análise por IA (embedding semântico)"
              >
                <Sparkles className="w-2.5 h-2.5" /> ia
              </span>
              <button
                onClick={() => void remover(m)}
                className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                title="Remover modelo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
