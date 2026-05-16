import { useMemo, useRef, useState } from "react";
import { Upload, Check, X as XIcon, Sparkles, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Documento exibido na Etapa 02.
 * `obrigatorio_etapa02`: bloqueia o botão "Continuar". Apenas identidade e
 * comprovante de residência são obrigatórios universais para os 18 serviços.
 * Demais documentos permanecem visíveis (opt-in) e podem ser enviados aqui
 * ou depois no Arsenal pós-pagamento (checklist cobra os pendentes).
 */
interface DocItem {
  key: string;
  label: string;
  obrigatorio_etapa02: boolean;
  shortName?: string; // usado no label dinâmico do botão
}

const DOCS_OBRIGATORIOS_UNIVERSAIS: DocItem[] = [
  { key: "doc_identidade", label: "Documento de identidade — CIN, RG ou CNH (frente e verso)", obrigatorio_etapa02: true, shortName: "identidade" },
  { key: "doc_endereco", label: "Comprovante de residência (últimos 90 dias)", obrigatorio_etapa02: true, shortName: "comprovante de residência" },
];

const DOCS_OPCIONAIS_BASE: DocItem[] = [
  { key: "doc_cpf", label: "CPF (se não constar no documento de identidade)", obrigatorio_etapa02: false },
];

function docsForSlug(slug: string | null): DocItem[] {
  const extras: DocItem[] = [];
  if (slug && /cr|cac|acervo/.test(slug)) {
    extras.push(
      { key: "doc_cr", label: "Certificado de Registro (CR) — se já tiver", obrigatorio_etapa02: false },
      { key: "doc_clube", label: "Comprovante de filiação ao clube de tiro", obrigatorio_etapa02: false },
    );
  }
  if (slug && /porte|posse/.test(slug)) {
    extras.push(
      { key: "doc_psicologico", label: "Laudo psicológico (DPF)", obrigatorio_etapa02: false },
      { key: "doc_capacitacao", label: "Certificado de capacitação técnica", obrigatorio_etapa02: false },
    );
  }
  // Sempre garante identidade + comprovante no topo, demais embaixo.
  return [...DOCS_OBRIGATORIOS_UNIVERSAIS, ...DOCS_OPCIONAIS_BASE, ...extras];
}

export default function Etapa02Documentos({ state, update, onNext, onBack }: Props) {
  const docs = useMemo(() => docsForSlug(state.servicoSlug), [state.servicoSlug]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const obrigatorios = docs.filter((d) => d.obrigatorio_etapa02);
  const opcionais = docs.filter((d) => !d.obrigatorio_etapa02);
  const obrigatoriosPendentes = obrigatorios.filter(
    (d) => state.documentos[d.key]?.status !== "enviado",
  );
  const podeAvancar = obrigatoriosPendentes.length === 0;

  let ctaLabel = "Continuar para revisão dos dados →";
  if (obrigatoriosPendentes.length === obrigatorios.length) {
    ctaLabel = "Continuar — envie identidade e comprovante";
  } else if (obrigatoriosPendentes.length === 1) {
    ctaLabel = `Continuar — falta ${obrigatoriosPendentes[0].shortName ?? obrigatoriosPendentes[0].label}`;
  }

  async function handleUpload(key: string, file: File) {
    setUploadingKey(key);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safe = `${key}_${Date.now()}.${ext}`;
      const path = `cadastro-publico/refinado/${safe}`;
      const { error } = await supabase.storage
        .from("qa-cadastro-selfies")
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
      <div className="qa-ref-banner" style={{ marginBottom: 14 }}>
        <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Análise por IA</strong> — assim que você enviar, extraímos seus dados e preenchemos o cadastro automaticamente. Nada é enviado ao SINARM/PF sem sua revisão.
        </div>
      </div>

      <div className="qa-ref-info-note" style={{ marginBottom: 18 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Para avançar, precisamos do seu <strong>documento de identidade</strong> e do <strong>comprovante de residência</strong>. Os demais documentos podem ser enviados agora ou diretamente no seu Arsenal após o pagamento.
        </span>
      </div>

      <div className="qa-ref-upload-list">
        {obrigatorios.map((d) => renderDoc(d))}
      </div>

      {opcionais.length > 0 && (
        <>
          <div className="qa-ref-docs-sep">Outros documentos <span>(opcional agora)</span></div>
          <div className="qa-ref-upload-list">
            {opcionais.map((d) => renderDoc(d))}
          </div>
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <button className="qa-ref-btn qa-ref-btn-primary" disabled={!podeAvancar} onClick={onNext}>
          {ctaLabel}
        </button>
      </div>
    </QACadastroRefinadoShell>
  );

  function renderDoc(d: DocItem) {
    const item = state.documentos[d.key];
    const status = item?.status ?? "pendente";
    const isOptional = !d.obrigatorio_etapa02;
    return (
      <div
        key={d.key}
        className={[
          "qa-ref-upload-item",
          status === "enviado" ? "is-done" : "",
          status === "erro" ? "is-error" : "",
          isOptional && status !== "enviado" ? "is-optional" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="qa-ref-upload-icon">
          {status === "enviado" ? <Check size={18} /> : status === "erro" ? <XIcon size={18} /> : <Upload size={16} />}
        </div>
        <div className="qa-ref-upload-meta">
          <div className="qa-ref-upload-name">
            {d.label}
            {isOptional && status !== "enviado" && (
              <span className="qa-ref-opt-badge">Opcional agora — pode enviar depois no Arsenal</span>
            )}
          </div>
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
  }
}