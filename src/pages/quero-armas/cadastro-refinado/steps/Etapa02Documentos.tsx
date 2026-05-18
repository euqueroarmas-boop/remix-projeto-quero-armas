import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Check, X as XIcon, Sparkles, Info, Loader2, Camera, Paperclip, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState, DocumentoArsenal } from "../hooks/useCadastroRefinadoState";
import { enviarSnapshotCadastroMira } from "@/lib/quero-armas/cadastroMiraSnapshot";
import {
  buscarReaproveitamento,
  requisitoCumpridoPorReaproveitamento,
  type RequisitoDoc,
} from "@/lib/quero-armas/documentosReaproveitamento";
import { computeDocCardState } from "@/lib/quero-armas/docCardState";

/**
 * Mapa: docKey da Etapa02 → conjunto de `tipo_documento` do Arsenal que
 * satisfazem aquele requisito. Tipos não mapeados aqui (CRAF, SINARM, GTE,
 * GT, AC, etc.) NÃO aparecem na Etapa02 porque são documentos históricos
 * gerados por processos anteriores — ficam visíveis no Arsenal do cliente.
 */
const DOC_TIPOS_RELEVANTES_ETAPA02: Record<string, string[]> = {
  doc_identidade: ["RG", "CNH", "CIN", "IDENTIDADE", "DOC_IDENTIDADE", "DOCUMENTO_IDENTIDADE"],
  doc_endereco: ["COMPROVANTE_RESIDENCIA", "COMP_RESIDENCIA", "COMP_RES", "ENDERECO", "DOC_ENDERECO"],
  doc_cpf: ["CPF"],
  doc_cr: ["CR", "CERTIFICADO_REGISTRO"],
  doc_clube: ["FILIACAO_CLUBE", "COMPROVANTE_CLUBE", "CLUBE"],
  doc_psicologico: ["LAUDO_PSICOLOGICO", "PSICOLOGICO"],
  doc_capacitacao: ["CERTIFICADO_CAPACITACAO", "CAPACITACAO_TECNICA", "CAPACITACAO"],
};

const TIPOS_RELEVANTES_FLAT = new Set(
  Object.values(DOC_TIPOS_RELEVANTES_ETAPA02).flat().map((s) => s.toUpperCase()),
);

function arsenalDocMatchesKey(d: { tipo_documento: string }, key: string): boolean {
  const tipos = DOC_TIPOS_RELEVANTES_ETAPA02[key];
  if (!tipos) return false;
  return tipos.includes(String(d.tipo_documento || "").toUpperCase());
}

function filtrarRelevantesEtapa02<T extends { tipo_documento: string }>(docs: T[] | undefined | null): T[] {
  return (docs || []).filter((d) =>
    TIPOS_RELEVANTES_FLAT.has(String(d.tipo_documento || "").toUpperCase()),
  );
}

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
  /** Substituição de documentos do Arsenal (cliente autenticado). */
  const subInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [substituindoId, setSubstituindoId] = useState<string | null>(null);
  const [subErros, setSubErros] = useState<Record<string, string>>({});
  const [subSucesso, setSubSucesso] = useState<Record<string, string>>({});

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

  type DocClass = "substituido" | "em_analise" | "reprovado" | "vencido" | "valido" | "revisar";
  function classify(d: DocumentoArsenal & { substituido_em?: string | null }): DocClass {
    if (d.substituido_em) return "substituido";
    const st = (d.status ?? "").toLowerCase();
    if (st === "pendente_aprovacao") return "em_analise";
    if (st === "reprovado") return "reprovado";
    if (d.data_validade) {
      const venc = new Date(d.data_validade);
      if (!isNaN(venc.getTime()) && venc.getTime() < Date.now()) return "vencido";
    }
    if (st === "aprovado" || d.validado_admin) return "valido";
    return "revisar";
  }

  async function handleSubstituir(doc: DocumentoArsenal, file: File) {
    const err = validate(file);
    if (err) { setSubErros((s) => ({ ...s, [doc.id]: err })); return; }
    setSubErros((s) => { const n = { ...s }; delete n[doc.id]; return n; });
    setSubstituindoId(doc.id);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safe = `sub_${doc.id}_${Date.now()}.${ext}`;
      const path = `cadastro-publico/refinado/sub/${doc.id}/${safe}`;
      const up = await supabase.storage
        .from("qa-cadastro-selfies")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const { data, error } = await supabase.functions.invoke("qa-cadastro-substituir-documento", {
        body: {
          documento_anterior_id: doc.id,
          storage_path: path,
          arquivo_nome: file.name,
          arquivo_mime: file.type || "application/octet-stream",
        },
      });
      if (error) throw error;
      const novoId = (data as any)?.documento_id ?? "";
      setSubSucesso((s) => ({ ...s, [doc.id]: novoId }));
      // Move o doc anterior para "substituídos" (não destrutivo no servidor; aqui só reorganiza UI).
      const removeFrom = (arr?: DocumentoArsenal[]) => (arr ?? []).filter((x) => x.id !== doc.id);
      update({
        documentos_reaproveitados: removeFrom(state.documentos_reaproveitados),
        documentos_vencidos: removeFrom(state.documentos_vencidos),
        documentos_pendentes_revisao: [
          ...(state.documentos_pendentes_revisao ?? []),
          { ...doc, id: novoId || `${doc.id}-v2`, status: "pendente_aprovacao" },
        ],
      });
    } catch (e: any) {
      setSubErros((s) => ({ ...s, [doc.id]: e?.message || "Falha ao substituir" }));
    } finally {
      setSubstituindoId(null);
    }
  }

  const obrigatorios = docs.filter((d) => d.obrigatorio_etapa02);
  const opcionais = docs.filter((d) => !d.obrigatorio_etapa02);
  /**
   * REGRA CRÍTICA — cliente logado/autenticado com documento pessoal válido
   * NÃO precisa reenviar. Um requisito é considerado cumprido quando:
   *   (a) há upload válido na sessão atual; OU
   *   (b) há documento reaproveitado do Arsenal/cadastro que satisfaz
   *       o requisito (regra em documentosReaproveitamento.ts).
   */
  function requisitoCumprido(key: string): boolean {
    if (state.documentos[key]?.status === "enviado") return true;
    if (key === "doc_identidade" || key === "doc_endereco" || key === "doc_selfie") {
      return requisitoCumpridoPorReaproveitamento(
        key as RequisitoDoc,
        state.documentos_reaproveitados,
      );
    }
    return false;
  }
  const obrigatoriosPendentes = obrigatorios.filter((d) => !requisitoCumprido(d.key));
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
              {state.documentos_reaproveitados.slice(0, 8).map((d) => renderArsenalDoc(d))}
            </div>
          )}
          {state.documentos_vencidos && state.documentos_vencidos.length > 0 && (
            <div className="qa-ref-found-card qa-ref-found-warn" style={{ marginBottom: 12 }}>
              <span className="qa-ref-found-title">DOCUMENTOS QUE PRECISAM ATUALIZAR</span>
              {state.documentos_vencidos.slice(0, 8).map((d) => renderArsenalDoc(d, "vencido"))}
            </div>
          )}
          {state.documentos_pendentes_revisao && state.documentos_pendentes_revisao.length > 0 && (
            <div className="qa-ref-found-card" style={{ marginBottom: 12 }}>
              <span className="qa-ref-found-title">EM ANÁLISE PELA EQUIPE QUERO ARMAS</span>
              {state.documentos_pendentes_revisao.slice(0, 8).map((d) => renderArsenalDoc(d, "em_analise"))}
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
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          disabled={!podeAvancar}
          onClick={async () => {
            // Snapshot operacional para a Equipe Quero Armas — não bloqueia o fluxo.
            try {
              const extracaoInfo: Record<string, unknown> = {};
              (["doc_identidade", "doc_endereco"] as const).forEach((k) => {
                if (state.documentos[k]?.status === "enviado") {
                  extracaoInfo[k] = extractedFlags[k]
                    ? "extraido"
                    : extractFailedFlags[k]
                      ? "revisao_manual"
                      : "pendente";
                }
              });
              const r = await enviarSnapshotCadastroMira(state, "documentos_enviados", {
                snapshot_id: state.cadastro_mira_snapshot_id,
                contexto: {
                  origem_ui: state.origem || null,
                  etapa: "documentos",
                  extracao: extracaoInfo,
                },
              });
              if (r?.snapshot_id && r.snapshot_id !== state.cadastro_mira_snapshot_id) {
                update({ cadastro_mira_snapshot_id: r.snapshot_id });
              }
            } catch { /* silencioso — não interrompe o cadastro */ }
            onNext();
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </QACadastroRefinadoShell>
  );

  function renderDoc(d: DocItem) {
    const item = state.documentos[d.key];
    const status = item?.status ?? "pendente";
    const isOptional = !d.obrigatorio_etapa02;
    /* Reaproveitamento — só consultamos para os 3 requisitos pessoais. */
    const isPessoal = d.key === "doc_identidade" || d.key === "doc_endereco" || d.key === "doc_selfie";
    const reuso = isPessoal && status !== "enviado"
      ? buscarReaproveitamento(d.key as RequisitoDoc, state.documentos_reaproveitados)
      : null;
    const cumpridoPorReuso = !!(reuso && reuso.status === "valido" && reuso.documento);
    if (cumpridoPorReuso && reuso?.documento) {
      return (
        <div key={d.key} className="qa-ref-upload-item is-done" data-reuso="1">
          <div className="qa-ref-upload-icon"><Check size={18} /></div>
          <div className="qa-ref-upload-meta">
            <div className="qa-ref-upload-name">
              {d.label}
              <span className="qa-ref-opt-badge" style={{ background: "#0f2f1a", color: "#86efac" }}>
                JÁ RECEBIDO — não precisa reenviar
              </span>
            </div>
            <div className="qa-ref-upload-hint">
              <span style={{ color: "var(--qa-ref-success)" }}>
                ✓ {reuso.documento.arquivo_nome || (reuso.documento.tipo_documento || "Documento").toUpperCase()}
                {reuso.documento.data_validade ? ` · validade ${reuso.documento.data_validade}` : " · sem validade informada"}
              </span>
            </div>
          </div>
        </div>
      );
    }
    const exigeExtracaoIA = d.key === "doc_identidade" || d.key === "doc_endereco";
    const isExtracting = extractingKey === d.key;
    const extractionStatus = !exigeExtracaoIA
      ? "pendente"
      : isExtracting
        ? "extraindo"
        : extractedFlags[d.key]
          ? "extraido"
          : extractFailedFlags[d.key]
            ? "falhou"
            : "pendente";
    const card = computeDocCardState({
      uploadStatus: status,
      extractionStatus,
      fileName: item?.fileName,
      errorMsg: item?.errorMsg,
      extractionError: extractFailedFlags[d.key],
      exigeExtracaoIA,
    });
    const toneClass =
      card.tone === "success" ? "is-done"
      : card.tone === "warn" ? "is-warn"
      : card.tone === "error" ? "is-error"
      : "";
    return (
      <div
        key={d.key}
        className={[
          "qa-ref-upload-item",
          toneClass,
          isOptional && status !== "enviado" ? "is-optional" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="qa-ref-upload-icon">
          {card.tone === "success" ? <Check size={18} />
            : card.tone === "warn" ? <AlertTriangle size={18} />
            : card.tone === "error" ? <XIcon size={18} />
            : isExtracting ? <Loader2 size={16} className="qa-ref-spin" />
            : <Upload size={16} />}
        </div>
        <div className="qa-ref-upload-meta">
          <div className="qa-ref-upload-name">
            {d.label}
            {status === "enviado" && card.badge && (
              <span
                className="qa-ref-opt-badge"
                style={
                  card.tone === "success"
                    ? { background: "#0f2f1a", color: "#86efac" }
                    : card.tone === "warn"
                      ? { background: "var(--qa-ref-bordo-soft)", color: "var(--qa-ref-bordo)" }
                      : undefined
                }
              >
                {card.badge}
              </span>
            )}
            {isOptional && status !== "enviado" && (
              <span className="qa-ref-opt-badge">Opcional agora — pode enviar depois no Arsenal</span>
            )}
          </div>
          <div className="qa-ref-upload-hint">
            {isExtracting ? (
              <>
                <Loader2 size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} className="qa-ref-spin" />
                Analisando com IA…
              </>
            ) : (
              <span
                style={
                  card.tone === "success" ? { color: "var(--qa-ref-success)" }
                  : card.tone === "warn" ? { color: "var(--qa-ref-bordo)" }
                  : undefined
                }
              >
                {card.tone === "success" && status === "enviado" ? "✓ " : ""}
                {card.hint}
              </span>
            )}
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
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            {(d.key === "doc_identidade" || d.key === "doc_endereco") && extractingKey !== d.key && (
              <button
                className="qa-ref-upload-action"
                title="Reprocessar com IA"
                onClick={() => reExtractFromStorage(d.key as "doc_identidade" | "doc_endereco")}
              >
                {extractedFlags[d.key] ? "Re-extrair" : "Tentar extrair novamente"}
              </button>
            )}
            {card.tone === "warn" && (
              <button
                className="qa-ref-upload-action"
                title="Enviar outro arquivo"
                onClick={() => fileInputs.current[d.key]?.click()}
              >
                Enviar outro
              </button>
            )}
            <button className="qa-ref-upload-action" onClick={() => handleRemove(d.key)}>Remover</button>
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
          </div>
        )}
      </div>
    );
  }

  /** Render de cards de documentos do Arsenal já existentes — com CTA de substituição. */
  function renderArsenalDoc(d: DocumentoArsenal, hint?: "vencido" | "em_analise") {
    const cls = classify(d as DocumentoArsenal & { substituido_em?: string | null });
    const busy = substituindoId === d.id;
    const success = subSucesso[d.id];
    const erro = subErros[d.id];

    let badge = "JÁ RECEBIDO";
    let ctaLabel = "Substituir";
    let ctaClass = "qa-ref-upload-cta is-secondary";
    if (cls === "vencido" || hint === "vencido") { badge = "VENCIDO"; ctaLabel = "Enviar novo"; ctaClass = "qa-ref-upload-cta"; }
    else if (cls === "em_analise" || hint === "em_analise") { badge = "EM ANÁLISE"; ctaLabel = "Enviar outro"; ctaClass = "qa-ref-upload-cta is-secondary"; }
    else if (cls === "reprovado") { badge = "REPROVADO"; ctaLabel = "Enviar novo"; ctaClass = "qa-ref-upload-cta"; }
    else if (cls === "substituido") { badge = "SUBSTITUÍDO"; }
    else if (cls === "revisar") { badge = "REVISAR"; }

    return (
      <div key={d.id} className="qa-ref-arsenal-doc">
        <div className="qa-ref-arsenal-doc-head">
          <span className="qa-ref-arsenal-doc-tipo">{(d.tipo_documento || "DOCUMENTO").toUpperCase()}</span>
          <span className={`qa-ref-arsenal-doc-badge is-${cls}`}>{badge}</span>
        </div>
        <div className="qa-ref-arsenal-doc-meta">
          {d.arquivo_nome ? <span>{d.arquivo_nome}</span> : null}
          {d.data_validade ? <span> · validade {d.data_validade}</span> : null}
        </div>
        {success && (
          <div className="qa-ref-arsenal-doc-success">
            ✓ Novo documento enviado e em análise pela equipe.
          </div>
        )}
        {erro && (
          <div className="qa-ref-arsenal-doc-error">{erro}</div>
        )}
        {cls !== "substituido" && !success && (
          <div className="qa-ref-arsenal-doc-actions">
            <button
              type="button"
              className={ctaClass}
              disabled={busy}
              onClick={() => subInputs.current[d.id]?.click()}
            >
              {busy ? <Loader2 size={14} className="qa-ref-spin" /> : <RefreshCw size={14} />}
              {busy ? "Enviando…" : ctaLabel}
            </button>
            <input
              ref={(el) => (subInputs.current[d.id] = el)}
              type="file"
              accept="image/*,application/pdf,.pdf"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSubstituir(d, f);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
    );
  }
}