import { useMemo, useRef, useState } from "react";
import { Upload, Check, X as XIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Lista de documentos exigidos por slug. Mantém-se consciente do catálogo
 * existente; quando não encontra mapeamento, usa o conjunto base.
 */
const DEFAULT_DOCS: { key: string; label: string }[] = [
  { key: "doc_identidade", label: "Documento de identidade (RG ou CNH)" },
  { key: "doc_cpf", label: "CPF (se não constar no documento)" },
  { key: "doc_endereco", label: "Comprovante de endereço (últimos 90 dias)" },
];

function docsForSlug(slug: string | null): { key: string; label: string }[] {
  if (!slug) return DEFAULT_DOCS;
  if (/cr|cac|acervo/.test(slug)) {
    return [
      ...DEFAULT_DOCS,
      { key: "doc_cr", label: "Certificado de Registro (CR) — se já tiver" },
      { key: "doc_clube", label: "Comprovante de filiação ao clube de tiro" },
    ];
  }
  if (/porte|posse/.test(slug)) {
    return [
      ...DEFAULT_DOCS,
      { key: "doc_psicologico", label: "Laudo psicológico (DPF)" },
      { key: "doc_capacitacao", label: "Certificado de capacitação técnica" },
    ];
  }
  return DEFAULT_DOCS;
}

export default function Etapa02Documentos({ state, update, onNext, onBack }: Props) {
  const docs = useMemo(() => docsForSlug(state.servicoSlug), [state.servicoSlug]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const enviados = docs.filter((d) => state.documentos[d.key]?.status === "enviado").length;
  const allDone = enviados === docs.length;

  async function handleUpload(key: string, file: File) {
    setUploadingKey(key);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safe = `${key}_${Date.now()}.${ext}`;
      const path = `cadastro-refinado/${safe}`;
      const { error } = await supabase.storage
        .from("qa-cliente-docs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      update({
        documentos: {
          ...state.documentos,
          [key]: { storagePath: path, fileName: file.name, status: "enviado" },
        },
      });
    } catch (e: any) {
      update({
        documentos: {
          ...state.documentos,
          [key]: { fileName: file.name, status: "erro", errorMsg: e?.message || "Falha no upload" },
        },
      });
    } finally {
      setUploadingKey(null);
    }
  }

  function handleRemove(key: string) {
    const next = { ...state.documentos };
    delete next[key];
    update({ documentos: next });
  }

  return (
    <QACadastroRefinadoShell
      step={2}
      eyebrow="ETAPA 02 · DOCUMENTOS"
      title="Envie seus documentos"
      subtitle="Aceitamos PDF, JPG e PNG. Nossa IA analisa cada arquivo e extrai os dados automaticamente."
      onBack={onBack}
    >
      <div className="qa-ref-banner" style={{ marginBottom: 18 }}>
        <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Análise por IA</strong> — assim que você enviar, extraímos seus dados e preenchemos o cadastro automaticamente. Nada é enviado ao SINARM/PF sem sua revisão.
        </div>
      </div>

      <div className="qa-ref-upload-list">
        {docs.map((d) => {
          const item = state.documentos[d.key];
          const status = item?.status ?? "pendente";
          return (
            <div
              key={d.key}
              className={`qa-ref-upload-item ${status === "enviado" ? "is-done" : ""} ${status === "erro" ? "is-error" : ""}`}
            >
              <div className="qa-ref-upload-icon">
                {status === "enviado" ? <Check size={18} /> : status === "erro" ? <XIcon size={18} /> : <Upload size={16} />}
              </div>
              <div className="qa-ref-upload-meta">
                <div className="qa-ref-upload-name">{d.label}</div>
                <div className="qa-ref-upload-hint">
                  {status === "enviado"
                    ? item?.fileName
                    : status === "erro"
                    ? item?.errorMsg || "Erro ao enviar"
                    : "PDF, JPG ou PNG — até 10MB"}
                </div>
              </div>
              {status === "enviado" ? (
                <button className="qa-ref-upload-action" onClick={() => handleRemove(d.key)}>Remover</button>
              ) : (
                <>
                  <button
                    className="qa-ref-upload-action"
                    disabled={uploadingKey === d.key}
                    onClick={() => fileInputs.current[d.key]?.click()}
                  >
                    {uploadingKey === d.key ? "Enviando…" : status === "erro" ? "Tentar novamente" : "Enviar"}
                  </button>
                  <input
                    ref={(el) => (fileInputs.current[d.key] = el)}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(d.key, f);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 28 }}>
        <button className="qa-ref-btn qa-ref-btn-primary" disabled={!allDone} onClick={onNext}>
          Continuar — {enviados} de {docs.length} documentos
        </button>
      </div>
    </QACadastroRefinadoShell>
  );
}