import React, { useState, useRef, useCallback, Fragment } from "react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Camera, CheckCircle2, Loader2, FileText, IdCard, UserCircle2,
  Sparkles, ChevronRight, RotateCcw, AlertCircle, ArrowLeft, Shield, Info, Search,
  Target, Layers, ChevronDown, MapPin, Phone, Briefcase, Building2, AlertTriangle, User, Users,
} from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";
import { BackButton } from "@/shared/components/BackButton";
import {
  OBJETIVOS_PRINCIPAIS,
  CATEGORIAS_SERVICO,
  findCategoria,
  findServico,
  getCategoriasPorObjetivo,
} from "./qaServiceCatalog";
import {
  type ClienteData,
  emptyClienteData,
  getBlockingErrors,
  getDivergencias,
  detectCpfRgAmbiguity,
  isValidCpf,
  isValidEmail,
  isValidTelefone,
  onlyDigits,
  getCamposObrigatoriosPorCategoria,
  type CategoriaTitular,
} from "@/shared/quero-armas/clienteSchema";
import { trackTelemetria } from "@/shared/quero-armas/telemetria";

/* =========================================================================
 * Cadastro do Cliente — Fluxo guiado em 5 etapas
 * 0) QUALIFICAÇÃO → 1) DOCUMENTOS → 2) EXTRAÇÃO → 3) REVISÃO → 4) CONCLUSÃO
 * Premium, mobile-first, alta UX.
 * ========================================================================= */

type StepId = 0 | 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: "Serviço" },
  { id: 1, label: "Documentos" },
  { id: 2, label: "Extração" },
  { id: 3, label: "Revisão" },
  { id: 4, label: "Conclusão" },
];

interface DocSlot {
  key: "identity" | "address" | "selfie";
  label: string;
  description: string;
  icon: typeof IdCard;
  capture?: "user" | "environment";
}

const SLOTS: DocSlot[] = [
  { key: "identity", label: "Documento com CPF", description: "RG, CNH ou CIN — frente e verso se possível", icon: IdCard },
  { key: "address",  label: "Comprovante de endereço", description: "Conta de luz, água, internet ou telefone", icon: FileText },
  { key: "selfie",   label: "Selfie de identificação",  description: "Foto sua segurando o documento", icon: UserCircle2, capture: "user" },
];

/**
 * Backwards-compat alias: a partir da Entrega B usamos o tipo unificado
 * `ClienteData` (schema compartilhado) como modelo de revisão.
 */
type Extracted = ClienteData;
const emptyExtracted: Extracted = { ...emptyClienteData };

/* ─── helpers ─── */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function maskTel(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function brDateToIso(v: string): string {
  // dd/mm/aaaa → aaaa-mm-dd
  const m = v.trim().match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
/**
 * Converte qualquer data plausível vinda da IA para o formato BR (DD/MM/AAAA).
 * Aceita: ISO YYYY-MM-DD, DD/MM/AAAA, DD-MM-AAAA, e tolera espaços.
 * Retorna "" se não conseguir interpretar.
 */
export function normalizeDateToBr(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  // ISO YYYY-MM-DD (pode vir com T... — pegamos só a data)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // BR DD/MM/AAAA ou DD-MM-AAAA
  const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return "";
}
/**
 * Escolhe a primeira data de expedição/emissão disponível no objeto retornado
 * pela IA, na ordem oficial definida pela regra de negócio. Para CIN gov.br,
 * "Data de Emissão / Issue Date" deve cair em data_expedicao_rg.
 */
export function pickIssueDate(id: Record<string, any> | null | undefined): string {
  if (!id) return "";
  const candidates = [
    id.data_expedicao_rg,
    id.data_emissao,
    id.issue_date,
    id.data_emissao_rg,
  ];
  for (const c of candidates) {
    const br = normalizeDateToBr(c);
    if (br) return br;
  }
  return "";
}
function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta || "")?.[1] || "image/jpeg";
  const ext = mime.split("/")[1]?.split(";")[0] || "jpg";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext };
}

/* ============================================================== */

export default function QACadastroPublicoPage() {
  const [step, setStep] = useState<StepId>(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Etapa 0 — Qualificação comercial ──
  const [qualif, setQualif] = useState<{
    objetivo_principal: string;
    categoria_servico: string;
    servico_principal: string;
    subtipo_servico: string;
    descricao_servico_livre: string;
  }>({
    objetivo_principal: "",
    categoria_servico: "",
    servico_principal: "",
    subtipo_servico: "",
    descricao_servico_livre: "",
  });

  /* ─── Pré-seleção de serviço via querystring (?servico=slug) ───
   * Permite que cards do portal "/area-do-cliente/contratar" e links
   * externos abram o cadastro já com o serviço escolhido — eliminando
   * o "cadastro genérico que tenta adivinhar o serviço". */
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const slug = searchParams.get("servico");
    if (!slug) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("slug, nome, objetivo_slug, categoria_servico_slug, servico_principal_slug")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (cancel || !data) return;
      const cat = (data as any).categoria_servico_slug as string | null;
      const obj = (data as any).objetivo_slug as string | null;
      const svc = (data as any).servico_principal_slug as string | null;
      if (obj && cat && svc) {
        setQualif((q) => ({
          ...q,
          objetivo_principal: obj,
          categoria_servico: cat,
          servico_principal: svc,
        }));
      }
    })();
    return () => { cancel = true; };
  }, [searchParams]);

  // arquivos / data URLs
  const [files, setFiles] = useState<Record<string, string>>({});
  const identityRef = useRef<HTMLInputElement | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);
  const fileRefs = {
    identity: identityRef,
    address: addressRef,
    selfie: selfieRef,
  };

  // extração
  const [extractStage, setExtractStage] = useState<Record<string, "pending" | "processing" | "ok" | "fail">>({
    identity: "pending", address: "pending", selfie: "pending",
  });
  const [extracted, setExtracted] = useState<Extracted>(emptyExtracted);
  // Snapshot do que veio do documento (para detecção de divergência form × doc)
  const [extractedFromDoc, setExtractedFromDoc] = useState<Partial<ClienteData>>({});
  // Estado de ambiguidade CPF×RG retornado pela IA
  const [cpfRgAmbiguity, setCpfRgAmbiguity] = useState<{
    reason: string; cpfCandidates: string[]; rgCandidates: string[];
  } | null>(null);
  const [cpfRgConfirmed, setCpfRgConfirmed] = useState(false);
  const [divergenciasConfirmadas, setDivergenciasConfirmadas] = useState(false);
  // Tipo do documento de identidade detectado pela IA (ex.: "CIN", "RG", "CNH").
  // Persistido para que o validador (`getBlockingErrors`) saiba dispensar a
  // regra "CPF ≠ RG" no caso legítimo da CIN gov.br.
  const [tipoDocumentoIdentidade, setTipoDocumentoIdentidade] = useState<string>("");
  // Circunscrição PF resolvida a partir do endereço residencial
  const [unidadePF, setUnidadePF] = useState<{
    unidade_pf: string; sigla_unidade: string; tipo_unidade: string;
    municipio_sede: string; uf: string; base_legal: string;
  } | null>(null);
  const [unidadeLoading, setUnidadeLoading] = useState(false);

  // submit
  const [savedId, setSavedId] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    status: string;
    created_at: string;
    existing: Record<string, any>;
    incoming: Record<string, any>;
  } | null>(null);
  const [updateExistingId, setUpdateExistingId] = useState<string | null>(null);

  /* ─── upload handler ─── */
  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Envie um arquivo de imagem"); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Imagem deve ter no máximo 10MB"); return; }
    setError(null);
    const url = await fileToDataUrl(f);
    setFiles(p => ({ ...p, [key]: url }));
  };

  const allUploaded = SLOTS.every(s => files[s.key]);

  /* ─── extração via IA ─── */
  const startExtraction = useCallback(async () => {
    setStep(2);
    setError(null);
    setExtractStage({ identity: "processing", address: "processing", selfie: "processing" });

    try {
      const { data, error } = await supabase.functions.invoke("qa-extract-documents", {
        body: {
          identity_image: files.identity,
          address_image: files.address,
        },
      });

      if (error) throw new Error(error.message || "Falha na extração");

      const id = data?.identity || {};
      const ad = data?.address || {};

      // Detecta ambiguidade CPF×RG retornada pela IA
      const ambig = detectCpfRgAmbiguity(id);
      const tipoDoc = String(id?.tipo_documento || "").toUpperCase();
      const isCin = tipoDoc.includes("CIN");
      setTipoDocumentoIdentidade(tipoDoc);
      const cpfDigitsExtracted = id?.cpf ? onlyDigits(String(id.cpf)) : "";
      const cpfIsValid = cpfDigitsExtracted.length === 11 && isValidCpf(cpfDigitsExtracted);
      // Para CIN gov.br, o número nacional pode legitimamente ser igual ao CPF.
      // Tratamos a ambiguidade como puramente informativa: NÃO bloqueia avanço
      // e NÃO exige clique em "Confirmar". Para qualquer outro tipo, mantém o
      // bloqueio anterior.
      if (ambig.hasAmbiguity && !isCin) {
        setCpfRgAmbiguity({
          reason: ambig.reason || "A IA não conseguiu separar CPF e RG com certeza",
          cpfCandidates: ambig.cpfCandidates,
          rgCandidates: ambig.rgCandidates,
        });
        trackTelemetria({
          event_type: "cpf_rg_ambiguity_detected",
          categoria_titular: extracted.categoria_titular || null,
          payload: {
            tipo_documento: id?.tipo_documento || null,
            cpf_candidato_count: ambig.cpfCandidates.length,
            rg_candidato_count: ambig.rgCandidates.length,
            cpf_eq_rg:
              ambig.cpfCandidates.length > 0 &&
              ambig.rgCandidates.length > 0 &&
              ambig.cpfCandidates[0] === ambig.rgCandidates[0],
            cpf_confidence: typeof id?.cpf_confidence === "number" ? id.cpf_confidence : null,
            rg_confidence: typeof id?.rg_confidence === "number" ? id.rg_confidence : null,
          },
        });
      } else {
        // CIN com CPF==RG é caso legítimo → não bloqueia.
        setCpfRgAmbiguity(null);
        if (isCin) setCpfRgConfirmed(true);
      }

      // Snapshot do que veio do documento (usado para detecção de divergência)
      setExtractedFromDoc({
        nome_completo: id.nome_completo || "",
        cpf: id.cpf ? onlyDigits(id.cpf) : "",
        rg: id.rg || "",
        emissor_rg: id.emissor_rg && id.uf_emissor_rg
          ? `${id.emissor_rg}/${id.uf_emissor_rg}` : (id.emissor_rg || ""),
        data_nascimento: id.data_nascimento || "",
        nome_mae: id.nome_mae || "",
        nome_pai: id.nome_pai || "",
      });

      setExtracted(prev => ({
        ...prev,
        nome_completo: id.nome_completo || prev.nome_completo,
        // CPF: preenche sempre que vier um CPF válido de 11 dígitos, mesmo com
        // ambiguidade. A confirmação manual bloqueia apenas a conclusão final
        // — não deve apagar o CPF do usuário.
        cpf: cpfIsValid ? maskCpf(cpfDigitsExtracted) : prev.cpf,
        // RG/CIN:
        //  - CIN gov.br → preenche automaticamente com id.rg, primeiro
        //    rg_candidato OU o próprio número da CIN/CPF (são o mesmo número
        //    no documento). Sem bloqueio por igualdade.
        //  - Demais documentos sem ambiguidade → comportamento original.
        //  - Demais documentos COM ambiguidade → não preenche silenciosamente.
        rg: isCin
          ? (id.rg || ambig.rgCandidates[0] || cpfDigitsExtracted || prev.rg)
          : (!ambig.hasAmbiguity
              ? (id.rg || prev.rg)
              : prev.rg),
        emissor_rg: id.emissor_rg && id.uf_emissor_rg
          ? `${id.emissor_rg}/${id.uf_emissor_rg}` : (id.emissor_rg || prev.emissor_rg),
        data_nascimento: id.data_nascimento || prev.data_nascimento,
        sexo: id.sexo || prev.sexo,
        nome_mae: id.nome_mae || prev.nome_mae,
        nome_pai: id.nome_pai || prev.nome_pai,
        naturalidade_municipio: id.naturalidade_municipio || prev.naturalidade_municipio,
        naturalidade_uf: id.naturalidade_uf || prev.naturalidade_uf,
        titulo_eleitor: id.titulo_eleitor || prev.titulo_eleitor,
        cnh: id.cnh || prev.cnh,
        ctps: id.ctps || prev.ctps,
        pis_pasep: id.pis_pasep || prev.pis_pasep,
        // Data de expedição: aceita ISO ou BR e cobre múltiplos aliases da IA
        // (CIN gov.br usa "Data de Emissão / Issue Date").
        data_expedicao_rg: pickIssueDate(id) || prev.data_expedicao_rg,
        end1_cep: ad.cep ? maskCep(ad.cep) : prev.end1_cep,
        end1_logradouro: ad.logradouro || prev.end1_logradouro,
        end1_numero: ad.numero || prev.end1_numero,
        end1_bairro: ad.bairro || prev.end1_bairro,
        end1_cidade: ad.cidade || prev.end1_cidade,
        end1_estado: ad.estado || prev.end1_estado,
      }));

      setExtractStage({
        identity: data?.identity ? "ok" : "fail",
        address: data?.address ? "ok" : "fail",
        selfie: "ok", // selfie não passa por IA aqui — apenas confirma envio
      });

      // pequena pausa para o usuário ver "concluído"
      setTimeout(() => setStep(3), 700);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Não foi possível ler os documentos. Você pode preencher manualmente.");
      setExtractStage({ identity: "fail", address: "fail", selfie: "fail" });
    }
  }, [files]);

  /* ─── submissão final ─── */
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const cpfDigits = onlyDigits(extracted.cpf);
      // Bloqueio centralizado pelo schema compartilhado
      const blocking = getBlockingErrors(extracted, {
        categoria: extracted.categoria_titular || "pessoa_fisica",
        needsCpfRgConfirmation: !!cpfRgAmbiguity,
        cpfRgConfirmed,
        documentoIdentidadeTipo: tipoDocumentoIdentidade,
      });
      const divergencias = getDivergencias(extracted, extractedFromDoc);
      if (blocking.length > 0) {
        throw new Error(
          "Existem campos pendentes: " + blocking.map((e) => e.label).join(", "),
        );
      }
      if (divergencias.length > 0 && !divergenciasConfirmadas) {
        throw new Error(
          "Há divergências entre o formulário e o documento extraído. Confirme manualmente para prosseguir.",
        );
      }

      // upload dos arquivos
      const uploaded: { key: string; path: string }[] = [];
      for (const slot of SLOTS) {
        const dataUrl = files[slot.key];
        if (!dataUrl) continue;
        const { blob, ext } = dataUrlToBlob(dataUrl);
        const key = `cadastro-publico/${cpfDigits}-${slot.key}-${Date.now()}.${ext}`;
        // Mobile-resilient upload: fetch direto + AbortController (evita "Load failed" no iOS)
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/qa-cadastro-selfies/${key}`;
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 45000);
        let upRes: Response;
        try {
          upRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": blob.type || "application/octet-stream",
              "x-upsert": "true",
              "cache-control": "3600",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            body: blob,
            signal: ctrl.signal,
          });
        } catch (netErr: any) {
          clearTimeout(timeoutId);
          if (netErr?.name === "AbortError") {
            throw new Error(`Tempo esgotado ao enviar ${slot.label}. Verifique sua conexão e tente novamente.`);
          }
          throw new Error(`Falha ao enviar ${slot.label}: conexão instável. Tente novamente.`);
        }
        clearTimeout(timeoutId);
        if (!upRes.ok) {
          let msg = `HTTP ${upRes.status}`;
          try { const j = await upRes.json(); msg = j?.message || j?.error || msg; } catch { /* ignore */ }
          throw new Error(`Falha ao enviar ${slot.label}: ${msg}`);
        }
        uploaded.push({ key: slot.key, path: key });
      }

      const pathOf = (k: string) => uploaded.find(u => u.key === k)?.path || null;

      const payload = {
        nome_completo: extracted.nome_completo.trim(),
        cpf: cpfDigits,
        rg: extracted.rg || null,
        emissor_rg: extracted.emissor_rg || null,
        data_nascimento: brDateToIso(extracted.data_nascimento) || null,
        data_expedicao_rg: brDateToIso(extracted.data_expedicao_rg) || null,
        sexo: extracted.sexo || null,
        nome_mae: extracted.nome_mae || null,
        nome_pai: extracted.nome_pai || null,
        nacionalidade: extracted.nacionalidade || null,
        estado_civil: extracted.estado_civil || null,
        profissao: extracted.profissao || null,
        naturalidade_municipio: extracted.naturalidade_municipio || null,
        naturalidade_uf: (extracted.naturalidade_uf || "").slice(0, 2).toUpperCase() || null,
        naturalidade_pais: extracted.naturalidade_pais || null,
        titulo_eleitor: extracted.titulo_eleitor || null,
        cnh: extracted.cnh || null,
        ctps: extracted.ctps || null,
        pis_pasep: extracted.pis_pasep || null,
        categoria_titular: extracted.categoria_titular || null,
        vinculo_tipo: extracted.vinculo_tipo || null,
        telefone_principal: extracted.telefone_principal.replace(/\D/g, ""),
        telefone_secundario: extracted.telefone_secundario
          ? extracted.telefone_secundario.replace(/\D/g, "")
          : null,
        email: extracted.email.trim(),
        end1_cep: extracted.end1_cep.replace(/\D/g, "") || null,
        end1_logradouro: extracted.end1_logradouro || null,
        end1_numero: extracted.end1_numero || null,
        end1_complemento: extracted.end1_complemento || null,
        end1_bairro: extracted.end1_bairro || null,
        end1_cidade: extracted.end1_cidade || null,
        end1_estado: (extracted.end1_estado || "").slice(0, 2).toUpperCase() || null,
        end1_pais: extracted.end1_pais || null,
        consentimento_dados_verdadeiros: true as const,
        consentimento_tratamento_dados: true as const,
        documento_identidade_path: pathOf("identity"),
        comprovante_endereco_path: pathOf("address"),
        selfie_path: pathOf("selfie"),
        // ── Qualificação comercial (Etapa 0) ──
        objetivo_principal: qualif.objetivo_principal || null,
        categoria_servico: qualif.categoria_servico || null,
        servico_principal: qualif.servico_principal || null,
        subtipo_servico: qualif.subtipo_servico || null,
        descricao_servico_livre: qualif.descricao_servico_livre || null,
        origem_cadastro: "cadastro_publico" as const,
        // Compat: também grava no campo legado para não quebrar telas que ainda leem dele
        servico_interesse:
          (findServico(qualif.categoria_servico, qualif.servico_principal)?.label as string | undefined) ||
          qualif.descricao_servico_livre ||
          null,
      };

      const { data, error } = await supabase.functions.invoke("qa-cadastro-publico", {
        body: updateExistingId ? { ...payload, update_existing_id: updateExistingId } : payload,
      });
      // Tenta extrair o body mesmo em erros HTTP (ex.: 409 duplicate_cpf)
      let body: any = data;
      if (error && (error as any).context?.json) {
        try { body = await (error as any).context.json(); } catch { /* ignore */ }
      } else if (error && (error as any).context?.text) {
        try { body = JSON.parse(await (error as any).context.text()); } catch { /* ignore */ }
      }

      if (body?.error === "duplicate_cpf" && body.existing_id) {
        setDuplicate({
          id: body.existing_id,
          status: body.existing_status || "—",
          created_at: body.existing_created_at || "",
          existing: body.existing_data || {},
          incoming: payload as Record<string, any>,
        });
        return;
      }
      if (error) throw new Error(error.message || "Erro ao enviar cadastro");
      if (body?.error) throw new Error(body.message || body.error);

      setSavedId(body?.id || null);
      setStep(4);
    } catch (e: any) {
      setError(e?.message || "Erro ao concluir cadastro");
    } finally {
      setBusy(false);
    }
  };

  /* ─── render ─── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, hsl(220 25% 97%) 0%, hsl(225 30% 94%) 100%)" }}>
      <div className="max-w-md w-full mx-auto px-4 py-6 flex-1">
        <div className="mb-4 flex justify-start">
          <BackButton fallback="/" />
        </div>
        <div className="bg-white rounded-[20px] shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.04)] border border-slate-200/70 overflow-hidden">
          {/* Cabeçalho — composição refinada com logo integrada */}
          <div className="px-6 pt-6 pb-5 relative">
            {/* hairline tático sutil no topo */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(215 50% 25%) 30%, hsl(86 23% 30%) 70%, transparent 100%)",
                opacity: 0.55,
              }}
            />
            <div className="flex items-center gap-3.5">
              <div
                className="shrink-0 rounded-xl p-1.5 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(215 40% 12%) 0%, hsl(215 38% 18%) 100%)",
                  boxShadow:
                    "0 4px 12px hsl(215 50% 15% / 0.18), inset 0 1px 0 hsl(50 60% 88% / 0.08)",
                }}
              >
                <QALogo className="h-11 w-11 rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.18em] block mb-0.5"
                  style={{ color: "hsl(215 35% 45%)" }}
                >
                  Quero Armas · Cadastro
                </span>
                <h1
                  className="text-[20px] font-bold leading-tight tracking-tight"
                  style={{ color: "hsl(215 35% 14%)" }}
                >
                  {step === 0 && "Vamos começar"}
                  {step === 1 && "Seus documentos"}
                  {step === 2 && "Lendo informações"}
                  {step === 3 && "Confirme os dados"}
                  {step === 4 && "Tudo pronto"}
                </h1>
                <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "hsl(220 10% 52%)" }}>
                  {step === 0 && "Conte rapidamente o que você precisa"}
                  {step === 1 && "Envie seus documentos para iniciar"}
                  {step === 2 && "Estamos lendo suas informações"}
                  {step === 3 && "Revise antes de enviar"}
                  {step === 4 && "Recebemos seu cadastro com sucesso"}
                </p>
              </div>
            </div>
            <Stepper current={step} />
          </div>

          {/* Conteúdo */}
          <div className="px-6 pb-6">
            {step === 0 && (
              <Step0Qualificacao
                value={qualif}
                onChange={setQualif}
                onContinue={() => { setError(null); setStep(1); }}
              />
            )}

            {step === 1 && (
              <Step1Documents
                files={files}
                fileRefs={fileRefs}
                onPick={handlePick}
                onContinue={startExtraction}
                onManual={() => { setExtracted(emptyExtracted); setStep(3); }}
                allUploaded={allUploaded}
                error={error}
                onBack={() => setStep(0)}
              />
            )}

            {step === 2 && <Step2Extracting stages={extractStage} error={error} />}

            {step === 3 && (
              <Step3Review
                data={extracted}
                onChange={setExtracted}
                onContinue={submit}
                onBack={() => setStep(1)}
                busy={busy}
                error={error}
                fromDoc={extractedFromDoc}
                cpfRgAmbiguity={cpfRgAmbiguity}
                cpfRgConfirmed={cpfRgConfirmed}
                onConfirmCpfRg={() => setCpfRgConfirmed(true)}
                tipoDocumentoIdentidade={tipoDocumentoIdentidade}
                divergenciasConfirmadas={divergenciasConfirmadas}
                onConfirmDivergencias={() => {
                  setDivergenciasConfirmadas(true);
                  const divs = getDivergencias(extracted, extractedFromDoc);
                  trackTelemetria({
                    event_type: "divergencia_confirmada",
                    categoria_titular: extracted.categoria_titular || null,
                    payload: {
                      total_divergencias: divs.length,
                      campos_divergentes: divs.map((d) => d.field).slice(0, 10),
                    },
                  });
                }}
                unidadePF={unidadePF}
                unidadeLoading={unidadeLoading}
                onResolveUnidade={async () => {
                  if (!extracted.end1_cidade || !extracted.end1_estado) return;
                  setUnidadeLoading(true);
                  try {
                    const { data: rows } = await (supabase as any).rpc(
                      "qa_resolver_circunscricao_pf",
                      {
                        p_municipio: extracted.end1_cidade,
                        p_uf: extracted.end1_estado,
                      },
                    );
                    const row = Array.isArray(rows) ? rows[0] : rows;
                    setUnidadePF(row || null);
                    if (!row) {
                      trackTelemetria({
                        event_type: "circunscricao_nao_encontrada",
                        categoria_titular: extracted.categoria_titular || null,
                        payload: {
                          uf: String(extracted.end1_estado || "").toUpperCase().slice(0, 2),
                          municipio_len: String(extracted.end1_cidade || "").length,
                          motivo: "rpc_sem_resultado",
                        },
                      });
                    }
                  } catch (e) {
                    console.error("Erro ao resolver circunscrição:", e);
                    setUnidadePF(null);
                    trackTelemetria({
                      event_type: "circunscricao_nao_encontrada",
                      categoria_titular: extracted.categoria_titular || null,
                      payload: {
                        uf: String(extracted.end1_estado || "").toUpperCase().slice(0, 2),
                        municipio_len: String(extracted.end1_cidade || "").length,
                        motivo: "rpc_erro",
                      },
                    });
                  } finally {
                    setUnidadeLoading(false);
                  }
                }}
              />
            )}

            {step === 4 && <Step4Done firstName={extracted.nome_completo.split(" ")[0] || ""} />}
          </div>
        </div>

        {duplicate && (
          <DuplicateModal
            info={duplicate}
            busy={busy}
            onCancel={() => setDuplicate(null)}
            onConfirm={async () => {
              setUpdateExistingId(duplicate.id);
              setDuplicate(null);
              // Re-submete imediatamente como atualização
              setTimeout(() => submit(), 0);
            }}
          />
        )}

        {/* Selo LGPD — discreto, institucional */}
        <div
          className="mt-5 flex items-center justify-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em]"
          style={{ color: "hsl(220 10% 55%)" }}
        >
          <Shield className="w-3 h-3" style={{ color: "hsl(215 45% 35%)" }} strokeWidth={2.2} />
          Protegido conforme a LGPD
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Stepper ─────────────────────── */
function DuplicateModal({
  info, busy, onCancel, onConfirm,
}: {
  info: { id: string; status: string; created_at: string; existing: Record<string, any>; incoming: Record<string, any> };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dt = info.created_at ? new Date(info.created_at).toLocaleDateString("pt-BR") : "";

  // Campos comparados (rótulo + chave no objeto persistido)
  const FIELDS: { label: string; key: string; format?: (v: any) => string }[] = [
    { label: "Nome completo", key: "nome_completo" },
    { label: "CPF", key: "cpf", format: (v) => v ? maskCpf(String(v)) : "" },
    { label: "RG", key: "rg" },
    { label: "Emissor", key: "emissor_rg" },
    { label: "Data de nascimento", key: "data_nascimento", format: (v) => {
        if (!v) return "";
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          const [y, m, d] = s.slice(0, 10).split("-");
          return `${d}/${m}/${y}`;
        }
        return s;
      } },
    { label: "Telefone", key: "telefone_principal", format: (v) => v ? maskTel(String(v)) : "" },
    { label: "E-mail", key: "email" },
    { label: "CEP", key: "end1_cep", format: (v) => v ? maskCep(String(v)) : "" },
    { label: "Logradouro", key: "end1_logradouro" },
    { label: "Número", key: "end1_numero" },
    { label: "Bairro", key: "end1_bairro" },
    { label: "Cidade", key: "end1_cidade" },
    { label: "UF", key: "end1_estado" },
  ];

  const norm = (v: any) => (v === null || v === undefined ? "" : String(v).trim());
  const rows = FIELDS.map((f) => {
    const oldRaw = info.existing?.[f.key];
    const newRaw = info.incoming?.[f.key];
    const oldVal = f.format ? f.format(oldRaw) : norm(oldRaw);
    const newVal = f.format ? f.format(newRaw) : norm(newRaw);
    const changed = norm(oldRaw) !== norm(newRaw) && norm(newRaw) !== "";
    return { label: f.label, oldVal, newVal, changed };
  });
  const changedRows = rows.filter((r) => r.changed);
  const hasChanges = changedRows.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 overflow-hidden"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 12px)",
        paddingLeft: "max(env(safe-area-inset-left), 12px)",
        paddingRight: "max(env(safe-area-inset-right), 12px)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.18)] border border-slate-200/60 overflow-hidden max-h-full flex flex-col min-w-0">
        {/* Cabeçalho */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-2 mb-1.5">
            <Info className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
            <h3 className="text-base font-bold leading-snug break-words min-w-0 flex-1" style={{ color: "hsl(220 25% 15%)" }}>
              Cadastro já existe
            </h3>
          </div>
          <p className="text-[11px] leading-relaxed break-words" style={{ color: "hsl(220 10% 45%)" }}>
            Já encontramos um cadastro com este CPF{dt ? ` (criado em ${dt})` : ""}.
            Status atual: <strong>{info.status}</strong>.
            {hasChanges
              ? " Confira abaixo as alterações que serão aplicadas:"
              : " Não detectamos alterações nos dados enviados."}
          </p>
        </div>

        {/* Diff lado a lado */}
        {hasChanges && (
          <div className="px-4 sm:px-5 py-3 overflow-y-auto overflow-x-hidden flex-1 qa-diff-scroll min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 mb-2 px-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 10% 50%)" }}>
                Atual
              </span>
              <span className="w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-right" style={{ color: "hsl(230 80% 56%)" }}>
                Novo
              </span>
            </div>

            <div className="space-y-2.5">
              {changedRows.map((r) => (
                <div
                  key={r.label}
                  className="rounded-lg border p-2.5 min-w-0"
                  style={{ borderColor: "hsl(230 80% 92%)", background: "hsl(230 90% 98%)" }}
                >
                  <div className="text-[9px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "hsl(220 15% 45%)" }}>
                    {r.label}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div
                      className="text-[12px] font-medium px-2 py-1.5 rounded-md line-through min-w-0 break-all"
                      style={{ background: "hsl(220 15% 96%)", color: "hsl(220 10% 55%)", overflowWrap: "anywhere" }}
                    >
                      {r.oldVal || <span className="italic opacity-60">vazio</span>}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
                    <div
                      className="text-[12px] font-semibold px-2 py-1.5 rounded-md min-w-0 break-all"
                      style={{ background: "white", color: "hsl(230 70% 35%)", border: "1px solid hsl(230 80% 80%)", overflowWrap: "anywhere" }}
                    >
                      {r.newVal || <span className="italic opacity-60">vazio</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-[10px] text-center" style={{ color: "hsl(220 10% 50%)" }}>
              {changedRows.length} {changedRows.length === 1 ? "campo será alterado" : "campos serão alterados"}
            </div>
          </div>
        )}

        {/* Ações — sticky bar */}
        <div
          className="px-4 sm:px-5 pt-3 pb-3 border-t border-slate-100 flex gap-2 shrink-0 bg-white"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <button
            onClick={onCancel}
            disabled={busy}
            className="shrink-0 px-4 h-11 rounded-lg text-xs font-semibold border border-slate-200 disabled:opacity-50"
            style={{ color: "hsl(220 25% 25%)" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 min-w-0 h-11 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5 px-3"
            style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))" }}
          >
            {busy ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span className="truncate">{hasChanges ? "Confirmar atualização" : "Atualizar mesmo assim"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: StepId }) {
  return (
    <div className="mt-6 px-1">
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const done = current > s.id;
          const active = current === s.id;
          const nextReached = current > s.id;
          const isLast = i === STEPS.length - 1;
          return (
            <Fragment key={s.id}>
              <div className="flex flex-col items-center shrink-0" style={{ width: 52 }}>
                <div
                  className="rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{
                    width: active ? 28 : 24,
                    height: active ? 28 : 24,
                    background: done
                      ? "hsl(152 50% 38%)"
                      : active
                        ? "linear-gradient(135deg, hsl(215 52% 25%) 0%, hsl(215 50% 32%) 100%)"
                        : "hsl(220 14% 95%)",
                    color: done || active ? "white" : "hsl(220 10% 60%)",
                    boxShadow: active
                      ? "0 0 0 4px hsl(215 50% 25% / 0.10), 0 2px 6px hsl(215 50% 25% / 0.22)"
                      : done
                        ? "0 1px 3px hsl(152 50% 30% / 0.20)"
                        : "inset 0 0 0 1px hsl(220 14% 88%)",
                    border: !done && !active ? "1px solid hsl(220 14% 90%)" : "none",
                  }}
                >
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} /> : i + 1}
                </div>
                <span
                  className="mt-2 text-[10px] text-center leading-tight transition-colors"
                  style={{
                    color: active
                      ? "hsl(215 35% 18%)"
                      : done
                        ? "hsl(220 15% 35%)"
                        : "hsl(220 10% 60%)",
                    fontWeight: active ? 700 : 500,
                    letterSpacing: active ? "0.01em" : "0",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="flex-1 h-px rounded-full self-start"
                  style={{
                    marginTop: active ? 14 : 12,
                    background: nextReached
                      ? "hsl(152 50% 38%)"
                      : "hsl(220 14% 88%)",
                    opacity: nextReached ? 0.6 : 1,
                  }}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── Step 1 — Documentos ─────────────────────── */
function Step1Documents({
  files, fileRefs, onPick, onContinue, onManual, allUploaded, error, onBack,
}: any) {
  return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "hsl(220 10% 50%)" }}>
          <ArrowLeft className="w-3 h-3" /> Voltar
        </button>
      )}

      {/* Bloco de boas-vindas — premium, tático e sutil */}
      {SLOTS.map(slot => {
        const Icon = slot.icon;
        const sent = !!files[slot.key];
        return (
          <button
            key={slot.key}
            type="button"
            onClick={() => fileRefs[slot.key].current?.click()}
            className="w-full text-left rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-all hover:border-slate-300 shadow-[0_3px_12px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md border border-slate-200 flex items-center justify-center" style={{ background: "hsl(220 20% 97%)" }}>
                <Icon className="w-3.5 h-3.5" style={{ color: "hsl(220 25% 25%)" }} />
              </div>
              <span className="text-[15px] font-semibold leading-none" style={{ color: "hsl(220 25% 15%)" }}>
                {slot.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {sent ? (
                <div
                  className={slot.key === "selfie"
                    ? "rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"
                    : "rounded-md overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"}
                  style={slot.key === "selfie"
                    ? { width: 90, height: 90, minWidth: 90, maxWidth: 90, minHeight: 90, maxHeight: 90 }
                    : { width: 140, height: 90, minWidth: 140, maxWidth: 140, minHeight: 90, maxHeight: 90 }}
                >
                  <img
                    src={files[slot.key]}
                    alt=""
                    className="w-full h-full object-cover block"
                    style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
                  />
                </div>
              ) : (
                <div className={slot.key === "selfie"
                  ? "w-[90px] h-[90px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-full"
                  : "w-[140px] h-[90px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-md"}>
                  {slot.key === "selfie"
                    ? <Camera className="w-6 h-6" style={{ color: "hsl(220 10% 55%)" }} />
                    : <Upload className="w-6 h-6" style={{ color: "hsl(220 10% 55%)" }} />}
                </div>
              )}
              <span
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold"
                style={sent
                  ? { background: "hsl(152 65% 93%)", color: "hsl(152 65% 34%)" }
                  : { background: "hsl(220 20% 96%)", color: "hsl(220 10% 48%)" }}
              >
                {sent ? <CheckCircle2 className="w-3.5 h-3.5" /> : (slot.key === "selfie" ? <Camera className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />)}
                {sent ? "Enviado" : "Enviar"}
              </span>
            </div>
            <input
              ref={fileRefs[slot.key]}
              type="file"
              accept="image/*"
              capture={slot.capture}
              hidden
              onChange={(e) => onPick(e, slot.key)}
              data-testid={
                slot.key === "identity"
                  ? "documento-identificacao-input"
                  : slot.key === "address"
                    ? "comprovante-endereco-input"
                    : "selfie-input"
              }
              aria-label={slot.label}
            />
          </button>
        );
      })}

      {error && (
        <div className="p-3 rounded-lg flex gap-2 text-xs"
          style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={!allUploaded}
        className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        style={{ background: "linear-gradient(135deg, hsl(219 90% 56%), hsl(225 88% 54%))", boxShadow: "0 6px 18px hsl(222 89% 55% / 0.28)" }}
      >
        Extrair dados
      </button>

      <button
        onClick={onManual}
        className="w-full h-9 text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "hsl(220 15% 45%)" }}
      >
        Preencher manualmente
      </button>
    </div>
  );
}

/* ─────────────────────── Step 2 — Extração ─────────────────────── */
function Step2Extracting({ stages, error }: { stages: Record<string, string>; error: string | null }) {
  return (
    <div className="py-3">
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-5 shadow-[0_3px_12px_rgba(15,23,42,0.06)]">
        <div className="mx-auto w-32 h-32 rounded-full flex items-center justify-center mb-5"
          style={{ background: "hsl(220 95% 96%)" }}>
          <div className="relative">
            <FileText className="w-16 h-16" strokeWidth={1.6} style={{ color: "hsl(217 82% 58%)" }} />
            <Search className="w-7 h-7 absolute -bottom-1 -right-1" strokeWidth={2} style={{ color: "hsl(217 82% 58%)" }} />
            <Sparkles className="w-4 h-4 absolute -top-1 right-1 animate-pulse" style={{ color: "hsl(217 82% 68%)" }} />
          </div>
        </div>
        <h2 className="text-center text-[17px] leading-tight font-bold mb-3" style={{ color: "hsl(220 25% 15%)" }}>
          Extraindo dados dos<br />documentos...
        </h2>

        <div className="h-1.5 rounded-full overflow-hidden mb-2 mx-2" style={{ background: "hsl(220 20% 92%)" }}>
          <div className="h-full animate-[progress_2.5s_ease-in-out_infinite]"
            style={{ background: "hsl(217 82% 58%)", width: "66%" }} />
        </div>
        <p className="text-center text-xs mb-4" style={{ color: "hsl(220 10% 50%)" }}>Aguarde um momento...</p>

        <div className="border-t border-slate-100 pt-3 space-y-2">
        {SLOTS.map(s => {
          const Icon = s.icon;
          const st = stages[s.key];
          const chipStyle = s.key === "selfie"
            ? { background: "hsl(217 95% 96%)", color: "hsl(217 82% 58%)" }
            : { background: "hsl(152 65% 95%)", color: "hsl(152 55% 42%)" };
          return (
            <div key={s.key} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={chipStyle}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium truncate" style={{ color: "hsl(220 25% 20%)" }}>{s.label}</span>
              </div>
              {st === "ok" && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(152 65% 45%)" }}>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </span>
              )}
              {st === "processing" && (
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "hsl(222 89% 55%)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> processando
                </span>
              )}
              {st === "fail" && <AlertCircle className="w-4 h-4" style={{ color: "hsl(0 70% 55%)" }} />}
            </div>
          );
        })}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg flex gap-2 text-xs" style={{ background: "hsl(40 90% 96%)", color: "hsl(30 70% 35%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(20%); }
          100% { transform: translateX(120%); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────── Step 3 — Revisão (Entrega B / 8 blocos) ─────────────────────── */

type FieldStatus = "normal" | "obrigatorio_vazio" | "divergente" | "precisa_confirmacao" | "validado";

const SEXO_OPTS = [
  { value: "", label: "—" },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "Outro", label: "Outro" },
];
const ESTADO_CIVIL_OPTS = [
  { value: "", label: "—" },
  { value: "Solteiro(a)", label: "Solteiro(a)" },
  { value: "Casado(a)", label: "Casado(a)" },
  { value: "Divorciado(a)", label: "Divorciado(a)" },
  { value: "Viúvo(a)", label: "Viúvo(a)" },
  { value: "União Estável", label: "União Estável" },
];
const CATEGORIA_OPTS: { value: CategoriaTitular | ""; label: string }[] = [
  { value: "", label: "Selecione a categoria…" },
  { value: "pessoa_fisica", label: "Pessoa Física (cidadão comum)" },
  { value: "pessoa_juridica", label: "Pessoa Jurídica" },
  { value: "seguranca_publica", label: "Segurança Pública" },
  { value: "magistrado_mp", label: "Magistrado / MP" },
  { value: "militar", label: "Militar das Forças Armadas" },
];

function Step3Review({
  data, onChange, onContinue, onBack, busy, error,
  fromDoc, cpfRgAmbiguity, cpfRgConfirmed, onConfirmCpfRg,
  tipoDocumentoIdentidade,
  divergenciasConfirmadas, onConfirmDivergencias,
  unidadePF, unidadeLoading, onResolveUnidade,
}: {
  data: ClienteData;
  onChange: (v: ClienteData) => void;
  onContinue: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  fromDoc: Partial<ClienteData>;
  cpfRgAmbiguity: { reason: string; cpfCandidates: string[]; rgCandidates: string[] } | null;
  cpfRgConfirmed: boolean;
  onConfirmCpfRg: () => void;
  tipoDocumentoIdentidade: string;
  divergenciasConfirmadas: boolean;
  onConfirmDivergencias: () => void;
  unidadePF: { unidade_pf: string; sigla_unidade: string; tipo_unidade: string; municipio_sede: string; uf: string; base_legal: string } | null;
  unidadeLoading: boolean;
  onResolveUnidade: () => void | Promise<void>;
}) {
  const set = <K extends keyof ClienteData>(k: K, v: ClienteData[K]) => onChange({ ...data, [k]: v });

  const isCinDoc = String(tipoDocumentoIdentidade || "").toUpperCase().includes("CIN");

  // Categoria implícita p/ bloqueio: usa a do form ou "pessoa_fisica" como padrão (cidadão comum)
  const categoriaEfetiva: CategoriaTitular | "" = data.categoria_titular || "pessoa_fisica";
  const required = new Set<string>(getCamposObrigatoriosPorCategoria(categoriaEfetiva));
  const blocking = getBlockingErrors(data, {
    categoria: categoriaEfetiva,
    needsCpfRgConfirmation: !!cpfRgAmbiguity,
    cpfRgConfirmed,
    documentoIdentidadeTipo: tipoDocumentoIdentidade,
  });
  const divergencias = getDivergencias(data, fromDoc);

  // Re-resolve circunscrição quando cidade/UF mudam
  const cidadeUf = `${data.end1_cidade}|${data.end1_estado}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (data.end1_cidade && data.end1_estado.length === 2) onResolveUnidade();
  }, [cidadeUf]);

  function statusOf(field: keyof ClienteData): FieldStatus {
    const v = (data as any)[field];
    const empty = v === undefined || v === null || String(v).trim() === "";
    if (required.has(field as string) && empty) return "obrigatorio_vazio";
    if ((field === "cpf" || field === "rg") && cpfRgAmbiguity && !cpfRgConfirmed && !isCinDoc) return "precisa_confirmacao";
    if (divergencias.some((d) => d.field === field) && !divergenciasConfirmadas) return "divergente";
    if (!empty) return "validado";
    return "normal";
  }

  const podeAvancar =
    blocking.length === 0 &&
    (divergencias.length === 0 || divergenciasConfirmadas);

  return (
    <div className="space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}>
      <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "hsl(220 10% 50%)" }}>
        <ArrowLeft className="w-3 h-3" /> Voltar
      </button>

      <div className="rounded-xl p-3 flex items-center gap-2"
        style={{ background: "hsl(230 90% 97%)", border: "1px solid hsl(230 80% 92%)" }}>
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
        <span className="text-[11px] font-medium" style={{ color: "hsl(230 50% 35%)" }}>
          Revise os dados em todos os blocos antes de enviar
        </span>
      </div>

      {/* ─── Aviso de ambiguidade CPF×RG ─── */}
      {cpfRgAmbiguity && !isCinDoc && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: "hsl(40 95% 96%)", border: "1px solid hsl(40 80% 80%)" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(30 80% 45%)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold" style={{ color: "hsl(30 60% 30%)" }}>Confirme manualmente CPF e RG/CIN</div>
              <div className="text-[11px] leading-relaxed" style={{ color: "hsl(30 40% 35%)" }}>
                {cpfRgAmbiguity.reason}
              </div>
              {(cpfRgAmbiguity.cpfCandidates.length > 0 || cpfRgAmbiguity.rgCandidates.length > 0) && (
                <div className="text-[10px] mt-1" style={{ color: "hsl(30 35% 35%)" }}>
                  Candidatos: {cpfRgAmbiguity.cpfCandidates.concat(cpfRgAmbiguity.rgCandidates).join(", ")}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onConfirmCpfRg}
            disabled={cpfRgConfirmed}
            className="w-full h-9 rounded-lg text-[11px] font-semibold disabled:opacity-60"
            style={{ background: cpfRgConfirmed ? "hsl(152 50% 90%)" : "hsl(30 80% 45%)", color: cpfRgConfirmed ? "hsl(152 50% 30%)" : "white" }}
          >
            {cpfRgConfirmed ? "✓ CPF e RG/CIN confirmados" : "Confirmar CPF e RG/CIN manualmente"}
          </button>
        </div>
      )}

      {/* ─── Aviso informativo (não-bloqueante) para CIN gov.br ─── */}
      {isCinDoc && (
        <div className="rounded-xl p-3 flex items-start gap-2"
          style={{ background: "hsl(210 90% 97%)", border: "1px solid hsl(210 80% 88%)" }}>
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(210 80% 45%)" }} />
          <div className="text-[11px] leading-relaxed font-medium" style={{ color: "hsl(210 50% 30%)" }}>
            CIN gov.br identificada. O número nacional foi usado automaticamente como CPF e RG/CIN.
          </div>
        </div>
      )}

      {/* ─── Bloco 1 — Identificação ─── */}
      <ReviewBlock title="Identificação" icon={IdCard}>
        <ReviewField label="Nome completo" value={data.nome_completo} onChange={(v) => set("nome_completo", v)}
          required={required.has("nome_completo")} status={statusOf("nome_completo")} />
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="CPF" value={data.cpf} onChange={(v) => set("cpf", maskCpf(v))} placeholder="000.000.000-00"
            required status={statusOf("cpf")}
            errorHint={data.cpf && !isValidCpf(data.cpf) ? "CPF inválido" : undefined} />
          <ReviewSelect label="Sexo" value={data.sexo} onChange={(v) => set("sexo", v)} options={SEXO_OPTS} status={statusOf("sexo")} />
        </div>
      </ReviewBlock>

      {/* ─── Bloco 2 — Filiação e nascimento ─── */}
      <ReviewBlock title="Filiação e nascimento" icon={Users}>
        <ReviewField label="Data de nascimento" value={data.data_nascimento}
          onChange={(v) => set("data_nascimento", v)} placeholder="DD/MM/AAAA"
          required={required.has("data_nascimento")} status={statusOf("data_nascimento")} />
        <ReviewField label="Nome da mãe" value={data.nome_mae} onChange={(v) => set("nome_mae", v)}
          required={required.has("nome_mae")} status={statusOf("nome_mae")} />
        <ReviewField label="Nome do pai" value={data.nome_pai} onChange={(v) => set("nome_pai", v)}
          required={required.has("nome_pai")} status={statusOf("nome_pai")} />
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <ReviewField label="Município de nascimento" value={data.naturalidade_municipio}
            onChange={(v) => set("naturalidade_municipio", v)}
            required={required.has("naturalidade_municipio")} status={statusOf("naturalidade_municipio")} />
          <ReviewField label="UF" value={data.naturalidade_uf}
            onChange={(v) => set("naturalidade_uf", v.toUpperCase().slice(0, 2))} placeholder="SP"
            required={required.has("naturalidade_uf")} status={statusOf("naturalidade_uf")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Nacionalidade" value={data.nacionalidade}
            onChange={(v) => set("nacionalidade", v)} status={statusOf("nacionalidade")} />
          <ReviewSelect label="Estado civil" value={data.estado_civil}
            onChange={(v) => set("estado_civil", v)} options={ESTADO_CIVIL_OPTS}
            required={required.has("estado_civil")} status={statusOf("estado_civil")} />
        </div>
      </ReviewBlock>

      {/* ─── Bloco 3 — Documento de identificação ─── */}
      <ReviewBlock title="Documento de identificação" icon={Shield}>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="RG / CIN" value={data.rg} onChange={(v) => set("rg", v)}
            required={required.has("rg")} status={statusOf("rg")} />
          <ReviewField label="Órgão emissor" value={data.emissor_rg} placeholder="SSP/SP"
            onChange={(v) => set("emissor_rg", v)}
            required={required.has("emissor_rg")} status={statusOf("emissor_rg")} />
        </div>
        <ReviewField label="Data de expedição do RG" value={data.data_expedicao_rg}
          onChange={(v) => set("data_expedicao_rg", v)} placeholder="DD/MM/AAAA"
          status={statusOf("data_expedicao_rg")} />
      </ReviewBlock>

      {/* ─── Bloco 4 — Contato ─── */}
      <ReviewBlock title="Contato" icon={Phone}>
        <ReviewField label="E-mail" value={data.email} onChange={(v) => set("email", v)} placeholder="seu@email.com"
          required status={statusOf("email")}
          errorHint={data.email && !isValidEmail(data.email) ? "E-mail inválido" : undefined} />
        <ReviewField label="Telefone principal" value={data.telefone_principal}
          onChange={(v) => set("telefone_principal", maskTel(v))} placeholder="(11) 99999-9999"
          required status={statusOf("telefone_principal")}
          errorHint={data.telefone_principal && !isValidTelefone(data.telefone_principal) ? "Telefone inválido" : undefined} />
        <ReviewField label="Telefone secundário (opcional)" value={data.telefone_secundario}
          onChange={(v) => set("telefone_secundario", maskTel(v))} status={statusOf("telefone_secundario")} />
      </ReviewBlock>

      {/* ─── Bloco 5 — Endereço residencial ─── */}
      <ReviewBlock title="Endereço residencial" icon={MapPin}>
        <ReviewField label="CEP" value={data.end1_cep} onChange={(v) => set("end1_cep", maskCep(v))} placeholder="00000-000"
          required status={statusOf("end1_cep")} />
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <ReviewField label="Logradouro" value={data.end1_logradouro}
            onChange={(v) => set("end1_logradouro", v)} required status={statusOf("end1_logradouro")} />
          <ReviewField label="Número" value={data.end1_numero}
            onChange={(v) => set("end1_numero", v)} required status={statusOf("end1_numero")} />
        </div>
        <ReviewField label="Complemento" value={data.end1_complemento} onChange={(v) => set("end1_complemento", v)}
          status={statusOf("end1_complemento")} />
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Bairro" value={data.end1_bairro}
            onChange={(v) => set("end1_bairro", v)} required status={statusOf("end1_bairro")} />
          <ReviewField label="Cidade" value={data.end1_cidade}
            onChange={(v) => set("end1_cidade", v)} required status={statusOf("end1_cidade")} />
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <ReviewField label="UF" value={data.end1_estado}
            onChange={(v) => set("end1_estado", v.toUpperCase().slice(0, 2))} placeholder="SP"
            required status={statusOf("end1_estado")} />
          <ReviewField label="País" value={data.end1_pais} onChange={(v) => set("end1_pais", v)} status={statusOf("end1_pais")} />
        </div>
      </ReviewBlock>

      {/* ─── Bloco 6 — Dados profissionais ─── */}
      <ReviewBlock title="Dados profissionais" icon={Briefcase}>
        <ReviewSelect
          label="Categoria do titular"
          value={data.categoria_titular || ""}
          onChange={(v) => set("categoria_titular", v as any)}
          options={CATEGORIA_OPTS as any}
          status={data.categoria_titular ? "validado" : "normal"}
        />
        <ReviewField label="Profissão" value={data.profissao} onChange={(v) => set("profissao", v)}
          required={required.has("profissao")} status={statusOf("profissao")} />
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Título de eleitor" value={data.titulo_eleitor}
            onChange={(v) => set("titulo_eleitor", v)} status={statusOf("titulo_eleitor")} />
          <ReviewField label="CNH" value={data.cnh} onChange={(v) => set("cnh", v)} status={statusOf("cnh")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="CTPS" value={data.ctps} onChange={(v) => set("ctps", v)} status={statusOf("ctps")} />
          <ReviewField label="PIS/PASEP" value={data.pis_pasep}
            onChange={(v) => set("pis_pasep", v)} status={statusOf("pis_pasep")} />
        </div>
      </ReviewBlock>

      {/* ─── Bloco 7 — Circunscrição PF ─── */}
      <ReviewBlock title="Unidade responsável da Polícia Federal" icon={Building2}>
        {!data.end1_cidade || !data.end1_estado ? (
          <div className="text-[11px]" style={{ color: "hsl(220 10% 50%)" }}>
            Preencha o endereço residencial para identificarmos a unidade responsável.
          </div>
        ) : unidadeLoading ? (
          <div className="text-[11px] flex items-center gap-1.5" style={{ color: "hsl(220 10% 50%)" }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Resolvendo unidade…
          </div>
        ) : unidadePF ? (
          <div className="rounded-lg p-3 space-y-1" style={{ background: "hsl(215 50% 96%)", border: "1px solid hsl(215 50% 88%)" }}>
            <div className="text-[11px]" style={{ color: "hsl(215 35% 30%)" }}>
              Com base no endereço informado, seus documentos serão preparados/entregues para:
            </div>
            <div className="text-[13px] font-bold" style={{ color: "hsl(215 50% 18%)" }}>
              {unidadePF.unidade_pf}
              {unidadePF.sigla_unidade ? ` (${unidadePF.sigla_unidade})` : ""}
            </div>
            <div className="text-[10px]" style={{ color: "hsl(215 25% 35%)" }}>
              {unidadePF.tipo_unidade} · Sede: {unidadePF.municipio_sede}/{unidadePF.uf}
            </div>
            {unidadePF.base_legal && (
              <div className="text-[9px] italic" style={{ color: "hsl(220 10% 45%)" }}>
                {unidadePF.base_legal}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px]" style={{ color: "hsl(30 60% 35%)" }}>
            Não foi possível identificar automaticamente a unidade responsável para {data.end1_cidade}/{data.end1_estado}. Nossa equipe confirmará na análise.
          </div>
        )}
      </ReviewBlock>

      {/* ─── Bloco 8 — LGPD e revisão final ─── */}
      <ReviewBlock title="LGPD e revisão final" icon={Shield}>
        {divergencias.length > 0 && !divergenciasConfirmadas && (
          <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: "hsl(30 95% 96%)", border: "1px solid hsl(30 80% 80%)" }}>
            <div className="text-[11px] font-bold" style={{ color: "hsl(30 60% 30%)" }}>
              Divergências entre documento e formulário:
            </div>
            <ul className="text-[10px] space-y-0.5" style={{ color: "hsl(30 40% 35%)" }}>
              {divergencias.map((d) => (
                <li key={d.field}>
                  <strong>{d.label}:</strong> documento "{d.documento}" × formulário "{d.formulario}"
                </li>
              ))}
            </ul>
            <button type="button" onClick={onConfirmDivergencias}
              className="w-full h-8 rounded-md text-[11px] font-semibold text-white"
              style={{ background: "hsl(30 80% 45%)" }}>
              Confirmar divergências e prosseguir
            </button>
          </div>
        )}

        <label className="flex items-start gap-2 text-[11px] cursor-pointer" style={{ color: "hsl(220 25% 25%)" }}>
          <input type="checkbox" className="mt-0.5"
            checked={data.consentimento_dados_verdadeiros}
            onChange={(e) => set("consentimento_dados_verdadeiros", e.target.checked)} />
          <span>Declaro que as informações são verdadeiras, completas e de minha responsabilidade.</span>
        </label>
        <label className="flex items-start gap-2 text-[11px] cursor-pointer" style={{ color: "hsl(220 25% 25%)" }}>
          <input type="checkbox" className="mt-0.5"
            checked={data.consentimento_tratamento_dados}
            onChange={(e) => set("consentimento_tratamento_dados", e.target.checked)} />
          <span>Autorizo o tratamento dos meus dados nos termos da LGPD para fins de cadastro, validação e atendimento.</span>
        </label>

        {blocking.length > 0 && (
          <div className="rounded-lg p-2.5 mt-1" style={{ background: "hsl(0 90% 96%)", border: "1px solid hsl(0 80% 88%)" }}>
            <div className="text-[11px] font-bold mb-1" style={{ color: "hsl(0 65% 35%)" }}>
              Pendências para concluir:
            </div>
            <ul className="text-[10px] space-y-0.5 list-disc pl-4" style={{ color: "hsl(0 50% 35%)" }}>
              {blocking.map((b, i) => (
                <li key={`${b.field}-${i}`}>{b.label}: {b.message}</li>
              ))}
            </ul>
          </div>
        )}
      </ReviewBlock>

      {error && (
        <div className="p-3 rounded-lg flex gap-2 text-xs" style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 40%)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={busy || !podeAvancar}
        className="w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))", boxShadow: "0 4px 14px hsl(230 80% 56% / 0.35)" }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        Concluir cadastro
      </button>
    </div>
  );
}

function ReviewBlock({ title, icon: Icon, children }: { title: string; icon: typeof Shield; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2" style={{ boxShadow: "0 1px 4px hsl(220 14% 90% / 0.4)" }}>
      <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-slate-100">
        <Icon className="w-3.5 h-3.5" style={{ color: "hsl(215 35% 30%)" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "hsl(215 35% 25%)" }}>{title}</span>
      </div>
      {children}
    </section>
  );
}

function statusBorder(status: FieldStatus): string {
  switch (status) {
    case "obrigatorio_vazio": return "hsl(0 70% 65%)";
    case "divergente": return "hsl(30 80% 55%)";
    case "precisa_confirmacao": return "hsl(40 90% 55%)";
    case "validado": return "hsl(152 50% 70%)";
    default: return "hsl(220 13% 88%)";
  }
}
function statusBg(status: FieldStatus): string {
  switch (status) {
    case "obrigatorio_vazio": return "hsl(0 90% 99%)";
    case "divergente": return "hsl(30 95% 99%)";
    case "precisa_confirmacao": return "hsl(40 95% 99%)";
    default: return "white";
  }
}

function ReviewField({
  label, value, onChange, placeholder, required, status = "normal", errorHint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; status?: FieldStatus; errorHint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
        style={{ color: "hsl(220 15% 45%)" }}>
        {label}{required && <span style={{ color: "hsl(0 70% 55%)" }}>*</span>}
        {status === "validado" && <CheckCircle2 className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(152 50% 45%)" }} />}
        {status === "obrigatorio_vazio" && <AlertCircle className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(0 70% 55%)" }} />}
        {status === "divergente" && <AlertTriangle className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(30 80% 50%)" }} />}
      </span>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full h-10 px-3 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-[hsl(230_80%_70%)] transition"
        style={{ border: `1px solid ${statusBorder(status)}`, background: statusBg(status), color: "hsl(220 25% 18%)" }}
      />
      {errorHint && (
        <span className="text-[10px] mt-0.5 block" style={{ color: "hsl(0 65% 45%)" }}>{errorHint}</span>
      )}
    </label>
  );
}

function ReviewSelect({
  label, value, onChange, options, required, status = "normal",
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean; status?: FieldStatus;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
        style={{ color: "hsl(220 15% 45%)" }}>
        {label}{required && <span style={{ color: "hsl(0 70% 55%)" }}>*</span>}
        {status === "validado" && <CheckCircle2 className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(152 50% 45%)" }} />}
        {status === "obrigatorio_vazio" && <AlertCircle className="w-2.5 h-2.5 ml-auto" style={{ color: "hsl(0 70% 55%)" }} />}
      </span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full h-10 px-3 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-[hsl(230_80%_70%)] transition appearance-none"
        style={{ border: `1px solid ${statusBorder(status)}`, background: statusBg(status), color: "hsl(220 25% 18%)" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/* ─────────────────────── Step 4 — Conclusão ─────────────────────── */
function Step4Done({ firstName }: { firstName: string }) {
  return (
    <div className="text-center py-4">
      <div className="relative w-24 h-24 mx-auto mb-5">
        {/* confetti pontos */}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const r = 50 + (i % 3) * 8;
          const colors = ["hsl(152 60% 50%)", "hsl(45 90% 55%)", "hsl(230 80% 60%)", "hsl(280 60% 60%)"];
          return (
            <span key={i} className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                top: `calc(50% + ${Math.sin(angle) * r}px)`,
                left: `calc(50% + ${Math.cos(angle) * r}px)`,
                background: colors[i % colors.length], opacity: 0.7,
              }} />
          );
        })}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_24px_hsl(152_60%_50%/0.4)]"
            style={{ background: "linear-gradient(135deg, hsl(152 60% 45%), hsl(160 65% 42%))" }}>
            <CheckCircle2 className="w-9 h-9 text-white" />
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-1.5" style={{ color: "hsl(220 25% 18%)" }}>Cadastro completo!</h2>
      <p className="text-xs mb-4" style={{ color: "hsl(220 10% 50%)" }}>
        Suas informações foram extraídas, revisadas e enviadas com sucesso.
      </p>

      <div className="rounded-xl p-3 text-left flex gap-2 mb-5"
        style={{ background: "hsl(230 90% 97%)", border: "1px solid hsl(230 80% 92%)" }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "hsl(230 80% 56%)" }} />
        <div className="text-[11px] leading-relaxed" style={{ color: "hsl(220 25% 25%)" }}>
          <strong>Tudo certo{firstName ? `, ${firstName}` : ""}.</strong> Seu acesso ao sistema será liberado após validação pela nossa equipe. Você receberá um e-mail quando estiver tudo pronto.
        </div>
      </div>

      <a
        href="/area-do-cliente/login"
        className="block w-full h-12 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, hsl(230 80% 56%), hsl(240 80% 60%))", boxShadow: "0 4px 14px hsl(230 80% 56% / 0.35)" }}
      >
        Acessar sistema
      </a>

      <a href="https://wa.me/5511963166915" target="_blank" rel="noreferrer"
        className="block mt-2 text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "hsl(220 15% 45%)" }}>
        Quero tirar dúvidas
      </a>
    </div>
  );
}

/* ─────────────────────── Bloco de boas-vindas ─────────────────────── */
function WelcomeBlock() {
  return (
    <div className="px-1">
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "hsl(220 12% 38%)" }}
      >
        Cuidamos de toda a burocracia para você.{" "}
        <span style={{ color: "hsl(220 18% 22%)", fontWeight: 600 }}>
          Comece nos contando o que precisa
        </span>{" "}
        — seu processo será conduzido com clareza, sigilo e precisão técnica.
      </p>
    </div>
  );
}

/* ─────────────────────── Step 0 — Qualificação ─────────────────────── */
interface QualifValue {
  objetivo_principal: string;
  categoria_servico: string;
  servico_principal: string;
  subtipo_servico: string;
  descricao_servico_livre: string;
}

function Step0Qualificacao({
  value,
  onChange,
  onContinue,
}: {
  value: QualifValue;
  onChange: (v: QualifValue) => void;
  onContinue: () => void;
}) {
  const set = <K extends keyof QualifValue>(k: K, v: QualifValue[K]) => onChange({ ...value, [k]: v });

  const cat = findCategoria(value.categoria_servico);
  const svc = findServico(value.categoria_servico, value.servico_principal);
  const needsSubtipo = !!(svc?.subtipos && svc.subtipos.length > 0);
  const needsLivre = !!svc?.livre;

  // Categorias filtradas pelo objetivo escolhido (já ordenadas + serviços filtrados)
  const categoriasDisponiveis = getCategoriasPorObjetivo(value.objetivo_principal);
  // Serviços visíveis (com filtro/ordem do objetivo, com fallback para o catálogo bruto)
  const servicosDisponiveis =
    categoriasDisponiveis.find((c) => c.value === value.categoria_servico)?.servicos ||
    cat?.servicos ||
    [];

  // Validação
  const valido =
    !!value.objetivo_principal &&
    !!value.categoria_servico &&
    !!value.servico_principal &&
    (!needsSubtipo || !!value.subtipo_servico) &&
    (!needsLivre || value.descricao_servico_livre.trim().length >= 10);

  return (
    <div className="space-y-3.5">
      <WelcomeBlock />

      {/* Campo 1 — Objetivo principal (destaque visual: variante primary) */}
      <TacticalSelect
        icon={Target}
        label="Qual é o seu objetivo principal?"
        value={value.objetivo_principal}
        onChange={(v) => set("objetivo_principal", v)}
        placeholder="Selecione seu objetivo"
        options={OBJETIVOS_PRINCIPAIS.map((o) => ({ value: o.value, label: o.label }))}
        required
        primary
      />

      {/* Campo 2 — Categoria */}
      {value.objetivo_principal && (
        <TacticalSelect
          icon={Layers}
          label="Categoria"
          value={value.categoria_servico}
          onChange={(v) => {
            // limpa serviço/subtipo ao trocar categoria
            onChange({ ...value, categoria_servico: v, servico_principal: "", subtipo_servico: "", descricao_servico_livre: "" });
          }}
          placeholder="Selecione a categoria"
          options={categoriasDisponiveis.map((c) => ({ value: c.value, label: c.label }))}
          required
        />
      )}

      {/* Campo 3 — Serviço */}
      {cat && (
        <TacticalSelect
          icon={FileText}
          label="Serviço"
          value={value.servico_principal}
          onChange={(v) => onChange({ ...value, servico_principal: v, subtipo_servico: "", descricao_servico_livre: "" })}
          placeholder="Selecione o serviço"
          options={servicosDisponiveis.map((s) => ({ value: s.value, label: s.label }))}
          required
        />
      )}

      {/* Campo 4 — Subtipo (condicional) */}
      {svc && needsSubtipo && (
        <TacticalSelect
          icon={ChevronRight}
          label="Subtipo"
          value={value.subtipo_servico}
          onChange={(v) => set("subtipo_servico", v)}
          placeholder="Selecione o subtipo"
          options={(svc.subtipos || []).map((s) => ({ value: s, label: s }))}
          required
        />
      )}

      {/* Campo 5 — Texto livre (condicional) */}
      {svc && needsLivre && (
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: "hsl(215 35% 30%)" }}>
            <FileText className="w-3 h-3" />
            Descreva o serviço que você precisa <span style={{ color: "hsl(0 70% 50%)" }}>*</span>
          </span>
          <textarea
            value={value.descricao_servico_livre}
            onChange={(e) => set("descricao_servico_livre", e.target.value)}
            placeholder="Explique brevemente qual atendimento ou processo você deseja solicitar"
            rows={3}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[hsl(215_50%_45%)] transition resize-none"
            style={{
              border: "1px solid hsl(220 13% 86%)",
              background: "white",
              color: "hsl(220 25% 18%)",
            }}
          />
          <span className="text-[10px] mt-1 block" style={{ color: "hsl(220 10% 55%)" }}>
            Mínimo 10 caracteres.
          </span>
        </label>
      )}

      {/* CTA principal — premium, com mais peso e claramente clicável quando ativo */}
      <button
        onClick={onContinue}
        disabled={!valido}
        className="group w-full h-[52px] rounded-xl text-[13.5px] font-bold tracking-wide uppercase text-white flex items-center justify-center gap-2 transition-all duration-200 mt-1 relative overflow-hidden disabled:cursor-not-allowed"
        style={{
          background: valido
            ? "linear-gradient(135deg, hsl(215 55% 22%) 0%, hsl(215 52% 28%) 50%, hsl(86 28% 26%) 100%)"
            : "hsl(220 14% 92%)",
          color: valido ? "white" : "hsl(220 10% 58%)",
          boxShadow: valido
            ? "0 10px 24px -8px hsl(215 55% 20% / 0.45), 0 4px 10px -2px hsl(215 55% 20% / 0.20), inset 0 1px 0 hsl(50 60% 88% / 0.18)"
            : "inset 0 0 0 1px hsl(220 14% 86%)",
          letterSpacing: "0.04em",
        }}
      >
        {valido && (
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, hsl(50 60% 88% / 0.45), transparent)" }}
          />
        )}
        <span>Continuar</span>
        <ChevronRight
          className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2.5}
        />
      </button>

      {/* Texto de apoio — discreto, secundário ao CTA */}
      <p
        className="text-[10px] text-center px-4 leading-relaxed pt-1"
        style={{ color: "hsl(220 10% 62%)" }}
      >
        Sem compromisso até a confirmação · Dados protegidos
      </p>
    </div>
  );
}

/* Select tático premium — visual sóbrio com acento institucional */
function TacticalSelect({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  options,
  required,
  primary,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  required?: boolean;
  /** Quando true, aplica acabamento mais forte: usado no campo focal da etapa. */
  primary?: boolean;
}) {
  return (
    <label className="block">
      <span
        className="font-semibold uppercase flex items-center gap-1.5"
        style={{
          color: primary ? "hsl(215 45% 22%)" : "hsl(215 30% 38%)",
          fontSize: primary ? "11px" : "10px",
          letterSpacing: primary ? "0.06em" : "0.05em",
        }}
      >
        <Icon className={primary ? "w-3.5 h-3.5" : "w-3 h-3"} strokeWidth={2.2} />
        {label} {required && <span style={{ color: "hsl(0 65% 52%)" }}>*</span>}
      </span>
      <div className="relative mt-2">
        {/* halo de destaque para o campo focal quando ainda vazio */}
        {primary && !value && (
          <div
            className="absolute -inset-px rounded-xl pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, hsl(215 50% 25% / 0.10), hsl(86 23% 30% / 0.08))",
              filter: "blur(6px)",
            }}
          />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="relative w-full pl-3.5 pr-10 rounded-xl font-medium outline-none focus:ring-2 transition-all appearance-none cursor-pointer"
          style={{
            height: primary ? 52 : 44,
            fontSize: primary ? "14.5px" : "13.5px",
            border: value
              ? `1px solid hsl(215 45% ${primary ? 38 : 50}%)`
              : `1px solid hsl(220 13% ${primary ? 80 : 86}%)`,
            background: value
              ? "linear-gradient(180deg, white 0%, hsl(215 30% 99%) 100%)"
              : "white",
            color: value ? "hsl(215 35% 16%)" : "hsl(220 10% 55%)",
            boxShadow: value
              ? primary
                ? "0 4px 14px hsl(215 50% 25% / 0.14), inset 0 1px 0 white"
                : "0 1px 3px hsl(215 50% 30% / 0.08)"
              : primary
                ? "0 2px 8px hsl(215 50% 25% / 0.06), inset 0 1px 0 white"
                : "none",
            // ring color via custom property
            // @ts-ignore
            "--tw-ring-color": "hsl(215 50% 45% / 0.35)",
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rounded-md flex items-center justify-center"
          style={{
            width: primary ? 26 : 22,
            height: primary ? 26 : 22,
            background: value
              ? "linear-gradient(135deg, hsl(215 52% 25%) 0%, hsl(215 50% 32%) 100%)"
              : "hsl(220 14% 96%)",
            boxShadow: value ? "0 1px 3px hsl(215 50% 25% / 0.25)" : "none",
          }}
        >
          <ChevronDown
            className={primary ? "w-4 h-4" : "w-3.5 h-3.5"}
            style={{ color: value ? "white" : "hsl(220 10% 50%)" }}
            strokeWidth={2.4}
          />
        </div>
      </div>
    </label>
  );
}
