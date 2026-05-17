import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Check, X as XIcon, Sparkles, Info, Loader2, Camera, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  updateDados: (patch: Partial<CadastroRefinadoState["dadosPessoais"]>) => void;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("read_error"));
    fr.readAsDataURL(file);
  });
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, "$1.$2.$3-$4").replace(/-$/, "");
}
function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/^(\d{5})(\d{0,3}).*/, "$1-$2").replace(/-$/, "");
}

export default function Etapa02Documentos({ state, update, updateDados, onNext, onBack }: Props) {
  const docs = useMemo(() => docsForSlug(state.servicoSlug), [state.servicoSlug]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [extractingKey, setExtractingKey] = useState<string | null>(null);
  const [extractedFlags, setExtractedFlags] = useState<Record<string, boolean>>({});
  const [extractFailedFlags, setExtractFailedFlags] = useState<Record<string, string>>({});
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [sizeErrors, setSizeErrors] = useState<Record<string, string>>({});

  if (typeof window !== "undefined" && !(window as any).__qaCamHint) {
    (window as any).__qaCamHint = true;
    // eslint-disable-next-line no-console
    console.log("Camera capture may require opening the preview in a new tab or deployed URL on iOS.");
  }

  const MAX_BYTES = 20 * 1024 * 1024;
  function validate(file: File): string | null {
    if (file.size > MAX_BYTES) return "Arquivo maior que 20MB";
    const okType = /^image\//.test(file.type) || file.type === "application/pdf" || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!okType) return "Tipo inválido — use foto ou PDF";
    return null;
  }

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
    const err = validate(file);
    if (err) {
      setSizeErrors((s) => ({ ...s, [key]: err }));
      return;
    }
    setSizeErrors((s) => { const n = { ...s }; delete n[key]; return n; });
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
      // Disparo da extração por IA para identidade e comprovante de residência.
      // Demais documentos NÃO são extraídos nesta etapa (o Arsenal cobra/extrai depois).
      if (key === "doc_identidade" || key === "doc_endereco") {
        try {
          const dataUrl = await fileToDataUrl(file);
          await runExtraction(key, dataUrl);
        } catch (extractErr) {
          // Falha de extração NÃO bloqueia o fluxo — usuário preenche manualmente na Etapa 03.
          console.warn("[cadastro-refinado] extração IA falhou:", extractErr);
          setExtractFailedFlags((f) => ({ ...f, [key]: String((extractErr as any)?.message || "Falha") }));
        }
      }
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

  async function runExtraction(key: "doc_identidade" | "doc_endereco", dataUrl: string) {
    setExtractingKey(key);
    setExtractFailedFlags((f) => { const n = { ...f }; delete n[key]; return n; });
    try {
      const body = key === "doc_identidade"
        ? { identity_image: dataUrl }
        : { address_image: dataUrl };
      const { data, error } = await supabase.functions.invoke("qa-extract-documents", { body });
      if (error) throw error;
      const id = (data as any)?.identity || {};
      const ad = (data as any)?.address || {};
      const patch: Partial<CadastroRefinadoState["dadosPessoais"]> = {};
      // Identidade — só preenche campos ainda vazios para não sobrescrever digitação do usuário.
      if (key === "doc_identidade") {
        const d = state.dadosPessoais;
        if (!d.nome_completo && id.nome_completo) patch.nome_completo = String(id.nome_completo).trim();
        if (!d.cpf && id.cpf) patch.cpf = maskCpf(String(id.cpf));
        if (!d.data_nascimento && id.data_nascimento) patch.data_nascimento = String(id.data_nascimento);
      }
      // Endereço
      if (key === "doc_endereco") {
        const d = state.dadosPessoais;
        if (!d.endereco_cep && ad.cep) patch.endereco_cep = maskCep(String(ad.cep));
        if (!d.endereco_logradouro && ad.logradouro) patch.endereco_logradouro = String(ad.logradouro);
        if (!d.endereco_numero && ad.numero) patch.endereco_numero = String(ad.numero);
        if (!d.endereco_complemento && ad.complemento) patch.endereco_complemento = String(ad.complemento);
        if (!d.endereco_bairro && ad.bairro) patch.endereco_bairro = String(ad.bairro);
        if (!d.endereco_cidade && ad.cidade) patch.endereco_cidade = String(ad.cidade);
        if (!d.endereco_estado && ad.estado) {
          patch.endereco_estado = String(ad.estado).toUpperCase().slice(0, 2);
        }
      }
      if (Object.keys(patch).length > 0) {
        updateDados(patch);
        setExtractedFlags((f) => ({ ...f, [key]: true }));
      } else {
        setExtractFailedFlags((f) => ({ ...f, [key]: "Não conseguimos ler — tente outra foto" }));
      }
    } finally {
      setExtractingKey((k) => (k === key ? null : k));
    }
  }

  /** Extrai a partir do storage (re-extração ou docs enviados antes desta versão). */
  async function reExtractFromStorage(key: "doc_identidade" | "doc_endereco") {
    const item = state.documentos[key];
    if (!item?.storagePath) return;
    setExtractingKey(key);
    try {
      const { data: blob, error } = await supabase.storage
        .from("qa-cadastro-selfies")
        .download(item.storagePath);
      if (error || !blob) throw error || new Error("download_failed");
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => reject(fr.error || new Error("read_error"));
        fr.readAsDataURL(blob);
      });
      await runExtraction(key, dataUrl);
    } catch (e) {
      console.warn("[cadastro-refinado] re-extração falhou:", e);
      setExtractFailedFlags((f) => ({ ...f, [key]: "Falha ao reprocessar" }));
      setExtractingKey(null);
    }
  }

  // Auto-extração on-mount: se identidade/comprovante já estão enviados mas
  // ainda não foram extraídos nesta sessão, reprocessa silenciosamente a partir
  // do storage. Cobre o caso de uploads feitos antes desta funcionalidade.
  useEffect(() => {
    const candidatos: Array<"doc_identidade" | "doc_endereco"> = ["doc_identidade", "doc_endereco"];
    candidatos.forEach((k) => {
      const item = state.documentos[k];
      if (item?.status === "enviado" && item.storagePath && !extractedFlags[k] && !extractFailedFlags[k]) {
        reExtractFromStorage(k);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <strong>Preparando seus dados</strong> — assim que você enviar, organizamos seus documentos e adiantamos o preenchimento. Você revisa tudo antes de seguir. Nada é enviado ao SINARM/PF sem sua confirmação.
        </div>
      </div>

      <div className="qa-ref-info-note" style={{ marginBottom: 18 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Para avançar, precisamos do seu <strong>documento de identidade</strong> e do <strong>comprovante de residência</strong>. Os demais documentos podem ser enviados agora ou diretamente no seu Arsenal após o pagamento.
        </span>
      </div>

      {state.modo_cliente === "autenticado" && (
        <>
          {state.documentos_reaproveitados && state.documentos_reaproveitados.length > 0 && (
            <div className="qa-ref-found-card" style={{ marginBottom: 12 }}>
              <span className="qa-ref-found-title">DOCUMENTOS QUE JÁ TEMOS</span>
              {state.documentos_reaproveitados.slice(0, 8).map((d) => (
                <span key={d.id} className="qa-ref-found-meta">
                  ✓ {d.tipo_documento}
                  {d.data_validade ? ` · válido até ${d.data_validade}` : ""}
                </span>
              ))}
            </div>
          )}
          {state.documentos_vencidos && state.documentos_vencidos.length > 0 && (
            <div className="qa-ref-found-card qa-ref-found-warn" style={{ marginBottom: 12 }}>
              <span className="qa-ref-found-title">DOCUMENTOS QUE PRECISAM ATUALIZAR</span>
              {state.documentos_vencidos.slice(0, 8).map((d) => (
                <span key={d.id} className="qa-ref-found-meta">
                  ⚠ {d.tipo_documento} — vencido, envie novamente
                </span>
              ))}
            </div>
          )}
          {state.documentos_pendentes_revisao && state.documentos_pendentes_revisao.length > 0 && (
            <div className="qa-ref-found-card" style={{ marginBottom: 12 }}>
              <span className="qa-ref-found-title">EM ANÁLISE PELA EQUIPE QUERO ARMAS</span>
              {state.documentos_pendentes_revisao.slice(0, 8).map((d) => (
                <span key={d.id} className="qa-ref-found-meta">
                  {d.tipo_documento}
                </span>
              ))}
            </div>
          )}
        </>
      )}

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
              ? (extractingKey === d.key
                  ? <><Loader2 size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} className="qa-ref-spin" /> Analisando com IA…</>
                  : extractedFlags[d.key]
                    ? <span style={{ color: "var(--qa-ref-success)" }}>✓ {item?.fileName} — dados extraídos</span>
                    : extractFailedFlags[d.key]
                      ? <span style={{ color: "var(--qa-ref-bordo)" }}>{item?.fileName} — {extractFailedFlags[d.key]}</span>
                      : item?.fileName)
              : status === "erro"
              ? item?.errorMsg || "Erro ao enviar"
              : "PDF, JPG ou PNG — até 20MB"}
          </div>
          {status !== "enviado" && (
            <div className="qa-ref-upload-actions">
              <button
                type="button"
                className="qa-ref-upload-cta"
                disabled={uploadingKey === d.key}
                onClick={() => cameraInputs.current[d.key]?.click()}
              >
                <Camera size={14} />
                {uploadingKey === d.key ? "Enviando…" : "Fotografar"}
              </button>
              <button
                type="button"
                className="qa-ref-upload-cta is-secondary"
                disabled={uploadingKey === d.key}
                onClick={() => fileInputs.current[d.key]?.click()}
              >
                <Paperclip size={14} />
                {status === "erro" ? "Tentar arquivo" : "Arquivo"}
              </button>
              <input
                ref={(el) => (cameraInputs.current[d.key] = el)}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(d.key, f);
                  e.target.value = "";
                }}
              />
              <input
                ref={(el) => (fileInputs.current[d.key] = el)}
                type="file"
                accept="image/*,application/pdf,.pdf"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(d.key, f);
                  e.target.value = "";
                }}
              />
              {sizeErrors[d.key] && (
                <span style={{ fontSize: 11, color: "var(--qa-ref-bordo, #c52727)", width: "100%" }}>{sizeErrors[d.key]}</span>
              )}
            </div>
          )}
        </div>
        {status === "enviado" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {(d.key === "doc_identidade" || d.key === "doc_endereco") && extractingKey !== d.key && (
              <button
                className="qa-ref-upload-action"
                title="Reprocessar com IA"
                onClick={() => reExtractFromStorage(d.key as "doc_identidade" | "doc_endereco")}
              >
                {extractedFlags[d.key] ? "Re-extrair" : "Extrair com IA"}
              </button>
            )}
            <button className="qa-ref-upload-action" onClick={() => handleRemove(d.key)}>Remover</button>
          </div>
        )}
      </div>
    );
  }
}