import React, { useState, useRef, useCallback, Fragment } from "react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, Camera, CheckCircle2, Loader2, FileText, IdCard, UserCircle2,
  Sparkles, ChevronRight, RotateCcw, AlertCircle, ArrowLeft, Shield, Info, Search,
  Target, Layers, ChevronDown, MapPin, Phone, Briefcase, Building2, AlertTriangle, User, Users, Crosshair, Check,
  Lock, Eye, EyeOff, Crown, Smartphone, Download,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
 * Cadastro do Cliente — Fluxo guiado em 6 etapas
 * 0) QUALIFICAÇÃO → 1) DOCUMENTOS → 2) EXTRAÇÃO → 3) REVISÃO
 * → 4) ACESSO ARSENAL (cria conta gratuita) → 5) CONCLUSÃO + INSTALAR APP
 * Premium, mobile-first, alta UX.
 * ========================================================================= */

type StepId = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; label: string }[] = [
  { id: 0, label: "Serviço" },
  { id: 1, label: "Documentos" },
  { id: 2, label: "Extração" },
  { id: 3, label: "Revisão" },
  { id: 4, label: "Arsenal" },
  { id: 5, label: "Conclusão" },
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

  // Etapa 5 — Acesso Arsenal (cria conta gratuita)
  const [arsenalSenha, setArsenalSenha] = useState("");
  const [arsenalSenhaConfirma, setArsenalSenhaConfirma] = useState("");
  const [arsenalShowSenha, setArsenalShowSenha] = useState(false);
  const [arsenalBusy, setArsenalBusy] = useState(false);
  const [arsenalError, setArsenalError] = useState<string | null>(null);
  const [arsenalCriado, setArsenalCriado] = useState<{
    user_id: string | null;
    email: string;
    cliente_existente: boolean;
  } | null>(null);

  /* ─── checagem proativa de CPF/email já cadastrado (Etapa 3) ─── */
  const [existingCheck, setExistingCheck] = useState<{
    cpf_existe: boolean;
    email_existe: boolean;
    checked_for: { cpf: string; email: string };
    loading: boolean;
  }>({ cpf_existe: false, email_existe: false, checked_for: { cpf: "", email: "" }, loading: false });

  useEffect(() => {
    if (step !== 3) return;
    const cpfDigits = (extracted.cpf || "").replace(/\D/g, "");
    const emailNorm = (extracted.email || "").trim().toLowerCase();
    if (cpfDigits.length !== 11 && !emailNorm) return;
    // dedupe — não rechecar a mesma combinação
    if (
      existingCheck.checked_for.cpf === cpfDigits &&
      existingCheck.checked_for.email === emailNorm
    ) return;

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setExistingCheck((p) => ({ ...p, loading: true }));
      try {
        const url = `${(import.meta as any).env?.VITE_SUPABASE_URL}/functions/v1/qa-cliente-checar-existente`;
        const anonKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ cpf: cpfDigits, email: emailNorm }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => ({}));
        setExistingCheck({
          cpf_existe: !!body?.cpf_existe,
          email_existe: !!body?.email_existe,
          checked_for: { cpf: cpfDigits, email: emailNorm },
          loading: false,
        });
      } catch {
        setExistingCheck((p) => ({ ...p, loading: false }));
      }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [step, extracted.cpf, extracted.email, existingCheck.checked_for.cpf, existingCheck.checked_for.email]);

  /* ─── upload handler ─── */
  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isImage && !isPdf) {
      setError("Envie uma imagem (JPG/PNG) ou PDF");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Arquivo deve ter no máximo 10MB");
      return;
    }
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
        tipo_documento_identidade: isCin ? "CIN" : (prev.tipo_documento_identidade || "RG"),
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
        documentoIdentidadeTipo: extracted.tipo_documento_identidade || tipoDocumentoIdentidade,
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
        tipo_documento_identidade: extracted.tipo_documento_identidade || (String(tipoDocumentoIdentidade).toUpperCase().includes("CIN") ? "CIN" : "RG"),
        numero_documento_identidade: extracted.rg || null,
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

  /* ─── criação de conta Arsenal (Etapa 5) ─── */
  const criarContaArsenal = async () => {
    setArsenalBusy(true);
    setArsenalError(null);
    try {
      // Validação de senha forte (8+, 1 letra, 1 número)
      if (arsenalSenha.length < 8) {
        throw new Error("A senha deve ter no mínimo 8 caracteres.");
      }
      if (!/[A-Za-z]/.test(arsenalSenha) || !/[0-9]/.test(arsenalSenha)) {
        throw new Error("A senha precisa conter pelo menos 1 letra e 1 número.");
      }
      if (arsenalSenha !== arsenalSenhaConfirma) {
        throw new Error("As senhas não conferem.");
      }

      const cpfDigits = onlyDigits(extracted.cpf);
      const emailNorm = extracted.email.trim().toLowerCase();
      const telefone = extracted.telefone_principal?.replace(/\D/g, "") || "";

      // Label do serviço de interesse (para o e-mail Arsenal)
      const servicoInteresseLabel =
        (findServico(qualif.categoria_servico, qualif.servico_principal)?.label as string | undefined) ||
        qualif.descricao_servico_livre ||
        null;

      const { data, error } = await supabase.functions.invoke(
        "qa-cliente-criar-conta-publica",
        {
          body: {
            cpf: cpfDigits,
            nome: extracted.nome_completo.trim(),
            email: emailNorm,
            telefone: telefone || null,
            senha: arsenalSenha,
            servico_interesse: servicoInteresseLabel,
          },
        },
      );

      let body: any = data;
      if (error && (error as any).context?.json) {
        try { body = await (error as any).context.json(); } catch { /* ignore */ }
      } else if (error && (error as any).context?.text) {
        try { body = JSON.parse(await (error as any).context.text()); } catch { /* ignore */ }
      }

      // CPF/Email já tem login → vincula (não cria duplicado, só segue para conclusão)
      if (body?.reason === "cpf_ja_possui_login" || body?.reason === "email_ja_cadastrado") {
        setArsenalCriado({ user_id: null, email: emailNorm, cliente_existente: true });
        setStep(5);
        return;
      }

      if (error && !body?.ok) {
        throw new Error(body?.message || error.message || "Não foi possível criar a conta Arsenal.");
      }
      if (body?.ok === false) {
        throw new Error(body?.message || "Não foi possível criar a conta Arsenal.");
      }

      setArsenalCriado({
        user_id: body?.user_id || null,
        email: emailNorm,
        cliente_existente: false,
      });
      setStep(5);
    } catch (e: any) {
      setArsenalError(e?.message || "Erro ao criar acesso Arsenal");
    } finally {
      setArsenalBusy(false);
    }
  };

  /* ─── render ─── */
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#f6f5f1] overflow-x-hidden">
      <div className="w-full max-w-[480px] mx-auto px-0 pt-0 pb-6 flex-1 min-w-0 flex flex-col">
        {/* Header premium — integrado ao card, mesma palheta da logo. Logo clicável = voltar. */}
        <div className="relative w-full overflow-hidden bg-[#1E1E1E]">
          {/* Textura sutil de grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Glow âmbar lateral */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.href = "/";
            }}
            aria-label="Voltar"
            className="relative w-full flex items-center justify-center gap-4 px-5 py-7 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          >
            <QALogo className="h-20 w-20" />
            <div className="flex flex-col leading-tight text-left">
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-400/90">
                // Arsenal
              </span>
              <span className="font-mono text-xl font-black uppercase tracking-[0.32em] text-zinc-100 [text-shadow:0_1px_0_rgba(0,0,0,0.6)]">
                INTELIGENTE
              </span>
            </div>
          </button>

          {/* Faixa âmbar separadora */}
          <div className="relative h-px w-full bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
        </div>

        <div
          className="relative overflow-hidden border-y border-zinc-200 bg-gradient-to-br from-white via-[#fafaf7] to-[#f1efe9] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)]"
        >
          {/* Grid pontilhado Arsenal */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Glow âmbar Arsenal */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
          {/* Faixa âmbar superior */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

          {/* Cabeçalho no estilo KpiCard do Arsenal */}
          <div className="relative px-5 pt-5 pb-4 min-w-0">
            {/* Barra de navegação tática — Voltar + indicador de etapa */}
            <div className="mb-3 flex items-center justify-between gap-2 pb-3 border-b border-dashed border-amber-500/30">
              {step > 0 && step < 4 ? (
                <button
                  onClick={() => { setError(null); setStep((step - 1) as StepId); }}
                  className="group/back inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 transition-colors"
                  aria-label="Voltar à etapa anterior"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-amber-500/60 bg-amber-500/10 group-hover/back:bg-amber-500/20 group-hover/back:border-amber-600 transition-all">
                    <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
                    Voltar à etapa anterior
                  </span>
                </button>
              ) : (
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
                  // ATENDIMENTO
                </span>
              )}
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 shrink-0">
                ETAPA {step + 1}/6
              </span>
            </div>

            <div className="min-w-0">
              <div className="min-w-0">
                <h1 className="text-[18px] sm:text-[20px] font-bold leading-tight tracking-tight text-zinc-900 break-words">
                  {step === 0 && "VAMOS COMEÇAR"}
                  {step === 1 && "SEUS DOCUMENTOS"}
                  {step === 2 && "LENDO INFORMAÇÕES"}
                  {step === 3 && "CONFIRME OS DADOS"}
                  {step === 4 && "ACESSO AO ARSENAL"}
                  {step === 5 && "TUDO PRONTO"}
                </h1>
                <p className="mt-1 text-[11.5px] leading-snug text-zinc-500 break-words">
                  {step === 0 && "Conte rapidamente o que você precisa"}
                  {step === 1 && "Envie seus documentos para iniciar"}
                  {step === 2 && "Estamos lendo suas informações"}
                  {step === 3 && "Revise antes de enviar"}
                  {step === 4 && "Crie sua senha do app Arsenal"}
                  {step === 5 && "Recebemos seu cadastro com sucesso"}
                </p>
              </div>
            </div>
            <Stepper
              current={step}
              onJump={(target) => {
                if (target < step && step < 4) {
                  setError(null);
                  setStep(target);
                }
              }}
            />
          </div>

          {/* Conteúdo */}
          <div className="relative px-4 sm:px-5 pb-5 min-w-0">
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

            {step === 2 && (
              <Step2Extracting
                stages={extractStage}
                error={error}
                onBack={() => { setError(null); setStep(1); }}
              />
            )}

            {step === 3 && (
              <div key="step-3" className="animate-fade-in">
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
              </div>
            )}

            {step === 4 && (
              <Step4ArsenalAccess
                email={extracted.email}
                nome={extracted.nome_completo}
                senha={arsenalSenha}
                setSenha={setArsenalSenha}
                senhaConfirma={arsenalSenhaConfirma}
                setSenhaConfirma={setArsenalSenhaConfirma}
                showSenha={arsenalShowSenha}
                setShowSenha={setArsenalShowSenha}
                onContinue={criarContaArsenal}
                busy={arsenalBusy}
                error={arsenalError}
              />
            )}

            {step === 5 && (
              <Step5Done
                firstName={extracted.nome_completo.split(" ")[0] || ""}
                email={arsenalCriado?.email || extracted.email}
                clienteExistente={arsenalCriado?.cliente_existente || false}
              />
            )}
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
    { label: "Tipo documento", key: "tipo_documento_identidade" },
    { label: "Documento", key: "numero_documento_identidade" },
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

function Stepper({ current, onJump }: { current: StepId; onJump?: (target: StepId) => void }) {
  return (
    <div className="mt-4 -mx-1 overflow-x-hidden">
      <div className="flex items-start min-w-0 gap-0.5 px-1">
        {STEPS.map((s, i) => {
          const done = current > s.id;
          const active = current === s.id;
          const nextReached = current > s.id;
          const isLast = i === STEPS.length - 1;
          const amber = "hsl(38 92% 50%)";   // amber-500
          const amberDark = "hsl(35 91% 33%)"; // amber-700
          const ok = "hsl(152 60% 42%)";
          const canJump = !!onJump && s.id < current && current < 4;
          return (
            <Fragment key={s.id}>
              <button
                type="button"
                disabled={!canJump}
                onClick={canJump ? () => onJump!(s.id) : undefined}
                className={`flex flex-col items-center min-w-0 flex-1 basis-0 bg-transparent border-0 p-0 ${canJump ? "cursor-pointer group/step" : "cursor-default"}`}
                aria-label={canJump ? `Voltar para ${s.label}` : s.label}
              >
                <div
                  className={`shrink-0 rounded-lg flex items-center justify-center text-[13px] font-bold font-mono transition-all ${canJump ? "group-hover/step:scale-110 group-hover/step:shadow-[0_0_0_4px_hsla(38,92%,50%,0.3)]" : ""}`}
                  style={{
                    width: active ? 30 : 26,
                    height: active ? 30 : 26,
                    background: done ? `${ok}1F` : active ? amber : "white",
                    color: done ? ok : active ? "white" : "hsl(220 12% 40%)",
                    boxShadow: active
                      ? `0 4px 14px -4px ${amber}, inset 0 0 0 2px ${amber}`
                      : done
                        ? "inset 0 0 0 1.5px hsl(220 14% 80%)"
                        : "inset 0 0 0 1.5px hsl(220 14% 80%)",
                  }}
                >
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.6} /> : i + 1}
                </div>
                <span
                  className="mt-1 text-[8.5px] text-center leading-[1.1] uppercase tracking-[0.04em] font-mono w-full px-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{
                    color: active
                      ? amberDark
                      : done
                        ? "hsl(152 60% 28%)"
                        : "hsl(220 12% 45%)",
                    fontWeight: active ? 800 : 600,
                  }}
                >
                  {s.label}
                </span>
              </button>
              {!isLast && (
                <div
                  className="shrink-0 w-2 sm:w-3 h-[2px] rounded-full self-start"
                  style={{
                    marginTop: active ? 15 : 13,
                    background: nextReached ? ok : "hsl(220 14% 85%)",
                    opacity: nextReached ? 0.7 : 1,
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
  const [manualWarnOpen, setManualWarnOpen] = useState(false);
  return (
    <div className="space-y-3">
      {/* Slots — KpiCard-like premium light */}
      {SLOTS.map(slot => {
        const Icon = slot.icon;
        const sent = !!files[slot.key];
        const color = sent ? "hsl(152 60% 42%)" : "hsl(38 92% 50%)"; // ok verde / pendente âmbar
        return (
          <button
            key={slot.key}
            type="button"
            onClick={() => fileRefs[slot.key].current?.click()}
            className="group relative w-full text-left overflow-hidden rounded-xl border border-zinc-200 bg-white px-3.5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ boxShadow: `inset 0 0 0 1px ${color}14` }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
              style={{ background: color }}
            />
            <div className="relative flex items-start justify-between gap-2 mb-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${color}14`, color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em]"
                style={{ background: `${color}10`, color }}
              >
                {sent ? "Enviado" : "Pendente"} <ChevronRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">
              {slot.label}
            </div>
            <div className="flex items-center gap-3">
              {sent ? (
                <div
                  className={slot.key === "selfie"
                    ? "rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"
                    : "rounded-md overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block"}
                  style={slot.key === "selfie"
                    ? { width: 90, height: 90, minWidth: 90, maxWidth: 90, minHeight: 90, maxHeight: 90 }
                    : { width: 150, height: 210, minWidth: 150, maxWidth: 150, minHeight: 210, maxHeight: 210 }}
                >
                  <img
                    src={files[slot.key]}
                    alt=""
                    className={slot.key === "selfie" ? "w-full h-full object-cover block" : "w-full h-full object-contain block"}
                    style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
                  />
                </div>
              ) : (
                <div className={slot.key === "selfie"
                  ? "w-[90px] h-[90px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-full"
                  : "w-[150px] h-[210px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 rounded-md"}>
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
              accept={slot.key === "selfie" ? "image/*" : "image/*,application/pdf,.pdf"}
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
        className="w-full h-12 rounded-lg text-[11px] font-bold uppercase tracking-[0.18em] text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-amber-500 hover:bg-amber-600 shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)]"
      >
        Extrair dados <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={() => setManualWarnOpen(true)}
        className="w-full h-9 text-xs font-medium underline-offset-2 hover:underline text-zinc-500"
      >
        Preencher manualmente
      </button>

      <AlertDialog open={manualWarnOpen} onOpenChange={setManualWarnOpen}>
        <AlertDialogContent className="max-w-md bg-white border-zinc-200 max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-600" strokeWidth={2.2} />
            </div>
            <div className="text-center text-[10px] font-mono uppercase tracking-[0.28em] text-amber-700">
              // ATENÇÃO · ENTRADA MANUAL
            </div>
            <AlertDialogTitle className="text-center text-base font-bold text-zinc-900 break-words">
              Tem certeza que prefere digitar manualmente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-zinc-600 text-left space-y-2 pt-2 break-words">
              <span className="block">
                Preencher os dados <strong className="text-zinc-900">à mão</strong> aumenta muito
                o risco de <strong className="text-amber-700">erros de digitação</strong> em CPF,
                RG, CEP, datas e endereço — e qualquer divergência pode causar a{" "}
                <strong className="text-red-700">rejeição do seu cadastro pela Polícia Federal</strong>.
              </span>
              <span className="block">
                Nossa <strong className="text-amber-700">IA é treinada para extrair os dados com
                altíssima precisão</strong> direto dos seus documentos. É <strong>mais rápido,
                mais seguro</strong> e elimina o retrabalho.
              </span>
              <span className="block text-[12px] text-zinc-500">
                Recomendamos fortemente enviar as fotos dos documentos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => { setManualWarnOpen(false); }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-[0.16em]"
            >
              Voltar e enviar documentos
            </AlertDialogAction>
            <button
              type="button"
              onClick={() => { setManualWarnOpen(false); onManual(); }}
              className="w-full text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-700 font-medium"
            >
              Entendi os riscos, quero digitar mesmo assim
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────── Step 2 — Extração ─────────────────────── */
function Step2Extracting({ stages, error, onBack }: { stages: Record<string, string>; error: string | null; onBack?: () => void }) {
  return (
    <div className="py-3 space-y-3">
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-br from-white via-[#fafaf7] to-[#f1efe9] px-4 py-5 shadow-sm"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div className="relative mx-auto w-16 h-16 rounded-lg flex items-center justify-center mb-4 border border-amber-500/40 bg-amber-500/10 overflow-visible">
          <span className="absolute inset-0 rounded-lg bg-amber-500/20 blur-md animate-pulse" aria-hidden />
          <div className="relative" style={{ transformOrigin: "center" }}>
            <FileText
              className="w-8 h-8 text-amber-700 animate-doc-float"
              strokeWidth={1.7}
              style={{ transformOrigin: "center" }}
            />
            <Search
              className="w-4 h-4 absolute -bottom-1 -right-1 text-amber-600 animate-lens-scan drop-shadow-[0_1px_2px_rgba(180,83,9,0.4)]"
              strokeWidth={2.4}
              style={{ transformOrigin: "center" }}
            />
            <Sparkles
              className="w-3 h-3 absolute -top-1 right-0 text-amber-500 animate-twinkle"
              style={{ transformOrigin: "center" }}
            />
            <Sparkles
              className="w-2.5 h-2.5 absolute -top-1.5 -left-1 text-amber-400 animate-twinkle-alt"
              style={{ transformOrigin: "center", animationDelay: "0.4s" }}
            />
          </div>
        </div>
        <div className="text-center text-[10px] font-mono uppercase tracking-[0.28em] mb-1 text-amber-700">
          // PROCESSANDO · IA
        </div>
        <h2 className="text-center text-[16px] leading-tight font-bold tracking-tight mb-3 text-zinc-900 break-words">
          EXTRAINDO DADOS DOS DOCUMENTOS
        </h2>

        <div className="h-1.5 rounded-full overflow-hidden mb-2 mx-2 bg-zinc-200/60">
          <div className="h-full bg-amber-500 animate-[progress_2.5s_ease-in-out_infinite]" style={{ width: "66%" }} />
        </div>
        <p className="text-center text-[10px] font-mono uppercase tracking-[0.22em] mb-4 text-zinc-500">Aguarde um momento</p>

        <div className="border-t border-zinc-200 pt-3 space-y-2">
        {SLOTS.map(s => {
          const Icon = s.icon;
          const st = stages[s.key];
          const chipColor = st === "ok" ? "hsl(152 60% 42%)" : "hsl(38 92% 50%)";
          const chipStyle = { background: `${chipColor}14`, color: chipColor, boxShadow: `inset 0 0 0 1px ${chipColor}25` };
          return (
            <div key={s.key} className="flex items-center justify-between gap-2 py-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={chipStyle}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] truncate text-zinc-700">{s.label}</span>
              </div>
              {st === "ok" && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em]"
                  style={{ background: "hsl(152 60% 42% / 0.10)", color: "hsl(152 60% 32%)" }}>
                  <CheckCircle2 className="w-3 h-3" /> OK
                </span>
              )}
              {st === "processing" && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em] bg-amber-500/10 text-amber-700">
                  <Loader2 className="w-3 h-3 animate-spin" /> Lendo
                </span>
              )}
              {st === "fail" && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em]"
                  style={{ background: "hsl(0 70% 55% / 0.10)", color: "hsl(0 70% 45%)" }}>
                  <AlertCircle className="w-3 h-3" /> Erro
                </span>
              )}
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
  { value: "Solteiro(a)", label: "SOLTEIRO(A)" },
  { value: "Casado(a)", label: "CASADO(A)" },
  { value: "Divorciado(a)", label: "DIVORCIADO(A)" },
  { value: "Viúvo(a)", label: "VIÚVO(A)" },
  { value: "União Estável", label: "UNIÃO ESTÁVEL" },
];
const CATEGORIA_OPTS: { value: CategoriaTitular | ""; label: string }[] = [
  { value: "", label: "SELECIONE A CATEGORIA…" },
  { value: "pessoa_fisica", label: "PESSOA FÍSICA (CIDADÃO COMUM)" },
  { value: "pessoa_juridica", label: "PESSOA JURÍDICA" },
  { value: "seguranca_publica", label: "SEGURANÇA PÚBLICA" },
  { value: "magistrado_mp", label: "MAGISTRADO / MP" },
  { value: "militar", label: "MILITAR DAS FORÇAS ARMADAS" },
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

  const tipoDocumentoAtual = data.tipo_documento_identidade || (String(tipoDocumentoIdentidade || "").toUpperCase().includes("CIN") ? "CIN" : "RG");
  const isCinDoc = tipoDocumentoAtual === "CIN";

  // Categoria implícita p/ bloqueio: usa a do form ou "pessoa_fisica" como padrão (cidadão comum)
  const categoriaEfetiva: CategoriaTitular | "" = data.categoria_titular || "pessoa_fisica";
  const required = new Set<string>(getCamposObrigatoriosPorCategoria(categoriaEfetiva));
  const blocking = getBlockingErrors(data, {
    categoria: categoriaEfetiva,
    needsCpfRgConfirmation: !!cpfRgAmbiguity,
    cpfRgConfirmed,
    documentoIdentidadeTipo: tipoDocumentoAtual,
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
          <ReviewSelect
            label="Tipo"
            value={tipoDocumentoAtual}
            onChange={(v) => set("tipo_documento_identidade", (v === "CIN" ? "CIN" : "RG") as any)}
            options={[
              { value: "RG", label: "RG" },
              { value: "CIN", label: "CIN" },
            ]}
            status={tipoDocumentoAtual ? "validado" : "normal"}
          />
          <ReviewField label={isCinDoc ? "CIN" : "RG"} value={data.rg} onChange={(v) => set("rg", v)}
            required={required.has("rg")} status={statusOf("rg")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Órgão emissor" value={data.emissor_rg} placeholder="SSP/SP"
            onChange={(v) => set("emissor_rg", v)}
            required={required.has("emissor_rg")} status={statusOf("emissor_rg")} />
          <ReviewField label={isCinDoc ? "Data de emissão" : "Data de expedição"} value={data.data_expedicao_rg}
            onChange={(v) => set("data_expedicao_rg", v)} placeholder="DD/MM/AAAA"
            status={statusOf("data_expedicao_rg")} />
        </div>
        {isCinDoc && (
          <div className="rounded-lg p-2 text-[10px] leading-relaxed" style={{ background: "hsl(210 90% 97%)", color: "hsl(210 50% 30%)", border: "1px solid hsl(210 80% 88%)" }}>
            CIN substitui o RG e pode usar o mesmo número do CPF.
          </div>
        )}
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
        <ReviewField
          label="Profissão / Atividade lícita exercida"
          value={data.profissao}
          onChange={(v) => set("profissao", v)}
          required={required.has("profissao")}
          status={statusOf("profissao")}
          placeholder="Ex.: Médico, Advogado, Servidor Público, Empresário…"
        />
        <p className="-mt-1 text-[10px] leading-snug" style={{ color: "hsl(220 12% 50%)" }}>
          Informe <strong>exatamente</strong> como sua atividade é exercida.
          A Polícia Federal exigirá <strong>comprovante dessa atividade</strong> (holerite,
          contrato social, declaração de IR, etc.) e este campo abastecerá automaticamente
          o checklist do seu processo após a aprovação do pagamento.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ReviewField label="Título de eleitor" value={data.titulo_eleitor}
            onChange={(v) => set("titulo_eleitor", v)} status={statusOf("titulo_eleitor")} />
          <ReviewField label="CNH" value={data.cnh} onChange={(v) => set("cnh", v)} status={statusOf("cnh")} />
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
              Com base no endereço informado, seus documentos serão protocolados na seguinte unidade da Polícia Federal:
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

            {/* ─── Prazos do processo ─── */}
            <div className="mt-2 pt-2 border-t" style={{ borderColor: "hsl(215 50% 86%)" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5" style={{ color: "hsl(215 50% 25%)" }}>
                Prazos do processo
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-md p-2" style={{ background: "hsl(190 60% 96%)", border: "1px solid hsl(190 50% 85%)" }}>
                  <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(190 60% 28%)" }}>
                    Quero Armas
                  </div>
                  <div className="text-[12px] font-bold" style={{ color: "hsl(190 70% 22%)" }}>
                    7 a 25 dias
                  </div>
                  <div className="text-[9px] leading-tight" style={{ color: "hsl(190 30% 35%)" }}>
                    para preparar e protocolar seu pedido na unidade acima.
                  </div>
                </div>
                <div className="rounded-md p-2" style={{ background: "hsl(152 50% 96%)", border: "1px solid hsl(152 40% 85%)" }}>
                  <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(152 60% 25%)" }}>
                    Polícia Federal
                  </div>
                  <div className="text-[12px] font-bold" style={{ color: "hsl(152 70% 18%)" }}>
                    30 a 60 dias
                  </div>
                  <div className="text-[9px] leading-tight" style={{ color: "hsl(152 30% 30%)" }}>
                    para análise (Lei&nbsp;nº&nbsp;9.784/1999, art.&nbsp;49).
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-[9px] italic" style={{ color: "hsl(220 10% 45%)" }}>
                Os prazos da PF correm a partir do protocolo e podem ser prorrogados motivadamente, conforme a mesma lei.
              </div>
            </div>
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
  const isEmail = /e-?mail/i.test(label);
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
        onChange={(e) => onChange(isEmail ? e.target.value : e.target.value.toUpperCase())}
        placeholder={placeholder}
        className="mt-0.5 w-full h-10 px-3 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-[hsl(230_80%_70%)] transition"
        style={{ border: `1px solid ${statusBorder(status)}`, background: statusBg(status), color: "hsl(220 25% 18%)", textTransform: isEmail ? "none" : "uppercase" }}
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
function Step5Done({ firstName, email, clienteExistente }: { firstName: string; email: string; clienteExistente: boolean }) {
  // Captura o evento de install do PWA (Android/Desktop)
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);
  const [installed, setInstalled] = React.useState(false);
  const [isIOS] = React.useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent));
  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };
  // Confetes caindo do topo (gerados uma vez por montagem)
  const confetti = React.useMemo(() => {
    const palette = [
      "hsl(152 60% 42%)", // verde
      "hsl(38 92% 50%)",  // âmbar
      "hsl(45 90% 55%)",  // amarelo
      "hsl(348 80% 60%)", // rosa
      "hsl(220 80% 60%)", // azul
      "hsl(280 70% 60%)", // roxo
    ];
    return Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      cx: (Math.random() - 0.5) * 80, // deriva horizontal em px
      delay: Math.random() * 2.4,
      duration: 2 + Math.random() * 2,
      color: palette[i % palette.length],
      size: 4 + Math.round(Math.random() * 4),
      shape: i % 3, // 0 quadrado, 1 círculo, 2 retângulo (fita)
    }));
  }, []);

  // Purpurina cintilante (pontinhos brilhantes espalhados)
  const glitter = React.useMemo(() => {
    const palette = ["#fde68a", "#fbbf24", "#fef3c7", "#fff", "#fcd34d", "#f9a8d4"];
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 1.4,
      duration: 1 + Math.random() * 1.4,
      size: 2 + Math.round(Math.random() * 3),
      color: palette[i % palette.length],
    }));
  }, []);

  return (
    <div className="relative overflow-hidden text-center py-4 px-4 rounded-xl border border-zinc-200 bg-gradient-to-br from-white via-[#fafaf7] to-[#f1efe9] shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-3xl"
        style={{ background: "hsl(152 60% 42%)" }}
      />
      {/* Confetes caindo (festa) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="absolute animate-confetti-fall"
            style={{
              left: `${c.left}%`,
              top: "-10%",
              width: c.shape === 2 ? c.size * 2 : c.size,
              height: c.shape === 2 ? c.size / 1.5 : c.size,
              background: c.color,
              borderRadius: c.shape === 1 ? "9999px" : "1px",
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              ["--cx" as any]: `${c.cx}px`,
              opacity: 0.85,
            }}
          />
        ))}
        {/* Purpurina cintilante */}
        {glitter.map((g) => (
          <span
            key={`g-${g.id}`}
            className="absolute rounded-full animate-glitter"
            style={{
              top: `${g.top}%`,
              left: `${g.left}%`,
              width: g.size,
              height: g.size,
              background: g.color,
              boxShadow: `0 0 ${g.size * 2}px ${g.color}`,
              animationDelay: `${g.delay}s`,
              animationDuration: `${g.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="relative mt-2 min-w-0">
      <div className="relative w-20 h-20 mx-auto mb-4">
        {/* raios de luz girando atrás */}
        <div className="absolute inset-0 -m-4 animate-rays-spin pointer-events-none" aria-hidden>
          <svg viewBox="0 0 100 100" className="w-full h-full opacity-50">
            <defs>
              <radialGradient id="rayGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(45 95% 65%)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(45 95% 65%)" stopOpacity="0" />
              </radialGradient>
            </defs>
            {Array.from({ length: 12 }).map((_, i) => (
              <polygon
                key={i}
                points="50,50 48,0 52,0"
                fill="url(#rayGrad)"
                transform={`rotate(${i * 30} 50 50)`}
              />
            ))}
          </svg>
        </div>
        {/* anéis de pulso */}
        <span
          className="absolute inset-0 m-auto w-14 h-14 rounded-lg border-2 border-emerald-500/60 animate-ring-pulse"
          style={{ animationDelay: "0s" }}
        />
        <span
          className="absolute inset-0 m-auto w-14 h-14 rounded-lg border-2 border-amber-400/60 animate-ring-pulse"
          style={{ animationDelay: "0.6s" }}
        />
        {/* estrelinhas em volta */}
        <Sparkles className="absolute -top-1 -left-1 w-3.5 h-3.5 text-amber-500 animate-twinkle" />
        <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-emerald-500 animate-twinkle-alt" style={{ animationDelay: "0.3s" }} />
        <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 text-rose-400 animate-twinkle-alt" style={{ animationDelay: "0.7s" }} />
        <Sparkles className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-amber-400 animate-twinkle" style={{ animationDelay: "1s" }} />
        {/* badge central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center border border-emerald-500/50 bg-emerald-500/10 animate-party-pop shadow-[0_8px_24px_-8px_rgba(16,185,129,0.5)]">
            <CheckCircle2 className="w-7 h-7 text-emerald-700 animate-party-bounce" strokeWidth={2.4} />
            {/* Chapéu de aniversário */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 animate-hat-wiggle"
              style={{ transformOrigin: "50% 100%" }}
              aria-hidden
            >
              <svg width="34" height="40" viewBox="0 0 34 40" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
                <defs>
                  <linearGradient id="hatGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(348 85% 62%)" />
                    <stop offset="50%" stopColor="hsl(280 75% 60%)" />
                    <stop offset="100%" stopColor="hsl(220 80% 58%)" />
                  </linearGradient>
                </defs>
                {/* cone do chapéu */}
                <polygon points="17,2 4,32 30,32" fill="url(#hatGrad)" stroke="hsl(220 25% 18%)" strokeWidth="0.8" strokeLinejoin="round" />
                {/* listras decorativas */}
                <polygon points="17,2 13,11 21,11" fill="hsl(45 95% 60%)" opacity="0.95" />
                <polygon points="13,11 9,22 25,22 21,11" fill="hsl(152 65% 50%)" opacity="0.55" />
                {/* bolinhas (pompons coloridos) */}
                <circle cx="10" cy="28" r="1.6" fill="hsl(45 95% 60%)" />
                <circle cx="22" cy="20" r="1.4" fill="hsl(348 85% 65%)" />
                <circle cx="14" cy="18" r="1.2" fill="#fff" opacity="0.9" />
                {/* base/aba */}
                <ellipse cx="17" cy="33" rx="14" ry="2.2" fill="hsl(220 25% 18%)" opacity="0.85" />
                {/* pompom no topo */}
                <circle cx="17" cy="2.5" r="3" fill="hsl(45 95% 60%)" stroke="hsl(35 90% 40%)" strokeWidth="0.5" className="animate-pom-bounce" style={{ transformOrigin: "17px 2.5px" }} />
                {/* brilho no pompom */}
                <circle cx="15.8" cy="1.4" r="0.8" fill="#fff" opacity="0.9" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] font-mono uppercase tracking-[0.28em] mb-1 text-emerald-700">
        // CONCLUÍDO
      </div>
      <h2 className="text-[18px] font-bold tracking-tight mb-1.5 text-zinc-900 break-words">CADASTRO COMPLETO</h2>
      <p className="text-xs mb-4 text-zinc-500 break-words">
        Recebemos seus dados e documentos. A partir de agora, nossa equipe assume o processo por você.
      </p>

      <div className="rounded-lg p-3 text-left flex gap-2 mb-3 border border-emerald-500/30 bg-emerald-500/5 min-w-0">
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
        <div className="text-[11px] leading-relaxed text-zinc-700 min-w-0 break-words">
          <strong>Tudo certo{firstName ? `, ${firstName}` : ""}.</strong> {clienteExistente
            ? <>Vinculamos este cadastro ao seu acesso existente. Use sua senha já cadastrada para entrar.</>
            : <>Sua conta <span className="font-semibold">Arsenal Free</span> foi criada. Use o e-mail <span className="font-mono">{email}</span> e a senha que você acabou de definir para entrar.</>
          }
        </div>
      </div>

      <div className="rounded-lg p-3 text-left flex gap-2 mb-4 border border-amber-500/30 bg-amber-500/5 min-w-0">
        <Crown className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
        <div className="text-[11px] leading-relaxed text-zinc-700 min-w-0 break-words">
          Quando nossa equipe aprovar seu pagamento, seu Arsenal vira <strong>Premium</strong> automaticamente — você será avisado por e-mail e pelo próprio app.
        </div>
      </div>

      {/* Instalar PWA */}
      {installed ? (
        <div className="w-full h-12 rounded-lg text-[11px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 mb-2">
          <CheckCircle2 className="w-4 h-4" /> APP INSTALADO
        </div>
      ) : installPrompt ? (
        <button
          type="button"
          onClick={handleInstall}
          className="w-full h-12 rounded-lg text-[11px] font-bold uppercase tracking-[0.18em] text-white flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.55)] mb-2"
        >
          <Download className="w-4 h-4" /> Instalar Gerenciamento de Arsenal
        </button>
      ) : isIOS ? (
        <div className="rounded-lg p-3 text-left mb-2 border border-zinc-200 bg-white text-[11px] leading-relaxed text-zinc-700">
          <div className="font-semibold mb-1 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Instalar no iPhone:</div>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Toque no botão <strong>Compartilhar</strong> (ícone de seta para cima).</li>
            <li>Escolha <strong>"Adicionar à Tela de Início"</strong>.</li>
            <li>Confirme com o nome <strong>Arsenal QA</strong>.</li>
          </ol>
        </div>
      ) : null}

      <a
        href="/area-do-cliente/login"
        className="w-full h-12 rounded-lg text-[11px] font-bold uppercase tracking-[0.18em] text-white flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)]"
      >
        Acessar Arsenal agora
      </a>

      <a href="https://wa.me/5511963166915" target="_blank" rel="noreferrer"
        className="block mt-2 text-xs font-medium underline-offset-2 hover:underline text-zinc-500">
        Quero tirar dúvidas
      </a>
      </div>
    </div>
  );
}

/* ─────────────────── Step 4 — Acesso Arsenal (cria conta) ─────────────────── */
function Step4ArsenalAccess({
  email, nome, senha, setSenha, senhaConfirma, setSenhaConfirma,
  showSenha, setShowSenha, onContinue, busy, error,
}: {
  email: string; nome: string;
  senha: string; setSenha: (v: string) => void;
  senhaConfirma: string; setSenhaConfirma: (v: string) => void;
  showSenha: boolean; setShowSenha: (v: boolean) => void;
  onContinue: () => void; busy: boolean; error: string | null;
}) {
  // Indicador de força (0-3)
  const forca = React.useMemo(() => {
    let s = 0;
    if (senha.length >= 8) s++;
    if (/[A-Za-z]/.test(senha) && /[0-9]/.test(senha)) s++;
    if (senha.length >= 12 && /[^A-Za-z0-9]/.test(senha)) s++;
    return s;
  }, [senha]);
  const forcaLabel = ["FRACA", "FRACA", "MÉDIA", "FORTE"][forca] || "FRACA";
  const forcaCor = forca <= 1 ? "bg-rose-500" : forca === 2 ? "bg-amber-500" : "bg-emerald-500";
  const senhasIguais = senha.length > 0 && senha === senhaConfirma;
  const podeContinuar = senha.length >= 8 && /[A-Za-z]/.test(senha) && /[0-9]/.test(senha) && senhasIguais && !busy;
  const firstName = nome.split(" ")[0] || "";

  return (
    <div className="space-y-4">
      {/* Banner Arsenal */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-50 via-white to-amber-100/40 p-4 shadow-sm">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-md border border-amber-500/50 bg-amber-500/10 grid place-items-center">
            <Shield className="h-5 w-5 text-amber-700" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-700">// ACESSO ARSENAL</div>
            <h3 className="mt-1 text-[15px] font-bold tracking-tight text-zinc-900">Bem-vindo{firstName ? `, ${firstName}` : ""}!</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-700">
              Vamos criar sua <strong>conta gratuita</strong> no app <strong>Arsenal Quero Armas</strong>. Aqui você acompanha seu processo, documentos e prazos. Quando o pagamento for aprovado, seu plano vira <strong>Premium</strong> automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Email (somente leitura) */}
      <div>
        <label className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-zinc-500">E-mail de acesso</label>
        <div className="mt-1 h-11 px-3 rounded-md border border-zinc-200 bg-zinc-50 flex items-center text-[13px] text-zinc-700 font-mono break-all">
          {email}
        </div>
      </div>

      {/* Senha */}
      <div>
        <label className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-zinc-500">Crie uma senha</label>
        <div className="mt-1 relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type={showSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 8 caracteres, com letra e número"
            className="w-full h-11 pl-10 pr-10 rounded-md border border-zinc-300 bg-white text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowSenha(!showSenha)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {senha.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
              <div className={`h-full transition-all ${forcaCor}`} style={{ width: `${(Math.min(forca, 3) / 3) * 100}%` }} />
            </div>
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${forca <= 1 ? "text-rose-600" : forca === 2 ? "text-amber-600" : "text-emerald-600"}`}>
              {forcaLabel}
            </span>
          </div>
        )}
      </div>

      {/* Confirma senha */}
      <div>
        <label className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-zinc-500">Confirme a senha</label>
        <div className="mt-1 relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type={showSenha ? "text" : "password"}
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            placeholder="Digite a mesma senha"
            className={`w-full h-11 pl-10 pr-3 rounded-md border bg-white text-[13px] font-mono focus:outline-none focus:ring-2 ${
              senhaConfirma.length > 0 && !senhasIguais
                ? "border-rose-400 focus:ring-rose-500/40"
                : senhasIguais
                ? "border-emerald-400 focus:ring-emerald-500/40"
                : "border-zinc-300 focus:ring-amber-500/40 focus:border-amber-500"
            }`}
            autoComplete="new-password"
          />
        </div>
        {senhaConfirma.length > 0 && !senhasIguais && (
          <p className="mt-1 text-[11px] text-rose-600">As senhas não coincidem.</p>
        )}
      </div>

      {/* Aviso */}
      <div className="rounded-md p-3 flex gap-2 border border-zinc-200 bg-zinc-50">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Use uma senha que você lembre fácil. Se já tiver conta com este CPF/e-mail, vamos vincular automaticamente sem criar nada novo.
        </p>
      </div>

      {error && (
        <div className="rounded-md p-3 flex gap-2 border border-rose-300 bg-rose-50">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <p className="text-[11.5px] leading-relaxed text-rose-700">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!podeContinuar}
        onClick={onContinue}
        className="w-full h-12 rounded-lg text-[11px] font-bold uppercase tracking-[0.18em] text-white flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:cursor-not-allowed shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)]"
      >
        {busy ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Criando acesso…</>
        ) : (
          <><Shield className="w-4 h-4" /> Criar meu acesso Arsenal</>
        )}
      </button>
    </div>
  );
}

/* ─────────────────────── Bloco de boas-vindas ─────────────────────── */
/* WelcomeBlock — assinatura Arsenal: papel off-white, grid pontilhado, glow âmbar */
function WelcomeBlock() {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-br from-white via-[#fafaf7] to-[#f1efe9] px-4 py-3.5 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.08)]"
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-md border border-amber-500/50 bg-amber-500/10 grid place-items-center">
          <Crosshair className="h-4 w-4 text-amber-600" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-700">
            // BRIEFING TÉCNICO
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-700">
            Selecione abaixo o <span className="font-semibold text-zinc-900">objetivo</span> e o{" "}
            <span className="font-semibold text-zinc-900">serviço</span> desejados. Conduzimos o restante do processo
            com sigilo e precisão técnica.
          </p>
        </div>
      </div>
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
    <div className="space-y-4">
      <WelcomeBlock />

      {/* Bloco 1 — OBJETIVO (tiles) */}
      <ArsenalGroup
        index="01"
        title="OBJETIVO PRINCIPAL"
        hint="Qual o motivo central do seu pedido?"
      >
        <ArsenalTileGrid
          options={OBJETIVOS_PRINCIPAIS.map((o) => ({ value: o.value, label: o.label }))}
          selected={value.objetivo_principal}
          onSelect={(v) => {
            onChange({
              ...value,
              objetivo_principal: v,
              categoria_servico: "",
              servico_principal: "",
              subtipo_servico: "",
              descricao_servico_livre: "",
            });
          }}
        />
      </ArsenalGroup>

      {/* Bloco 2 — CATEGORIA */}
      {value.objetivo_principal && (
        <ArsenalGroup index="02" title="CATEGORIA DO SERVIÇO">
          <ArsenalTileGrid
            options={categoriasDisponiveis.map((c) => ({ value: c.value, label: c.label }))}
            selected={value.categoria_servico}
            onSelect={(v) => {
              onChange({
                ...value,
                categoria_servico: v,
                servico_principal: "",
                subtipo_servico: "",
                descricao_servico_livre: "",
              });
            }}
          />
        </ArsenalGroup>
      )}

      {/* Bloco 3 — SERVIÇO */}
      {cat && (
        <ArsenalGroup index="03" title="SERVIÇO">
          <ArsenalTileGrid
            options={servicosDisponiveis.map((s) => ({ value: s.value, label: s.label }))}
            selected={value.servico_principal}
            onSelect={(v) =>
              onChange({
                ...value,
                servico_principal: v,
                subtipo_servico: "",
                descricao_servico_livre: "",
              })
            }
          />
        </ArsenalGroup>
      )}

      {/* Bloco 4 — SUBTIPO (condicional) */}
      {svc && needsSubtipo && (
        <ArsenalGroup index="04" title="SUBTIPO">
          <ArsenalTileGrid
            options={(svc.subtipos || []).map((s) => ({ value: s, label: s }))}
            selected={value.subtipo_servico}
            onSelect={(v) => set("subtipo_servico", v)}
          />
        </ArsenalGroup>
      )}

      {/* Bloco 5 — Texto livre (condicional) */}
      {svc && needsLivre && (
        <ArsenalGroup index="05" title="DESCREVA O SERVIÇO" hint="Mínimo 10 caracteres.">
          <textarea
            value={value.descricao_servico_livre}
            onChange={(e) => set("descricao_servico_livre", e.target.value.toUpperCase())}
            placeholder="Explique brevemente qual atendimento você deseja solicitar"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all resize-none uppercase"
          />
        </ArsenalGroup>
      )}

      {/* CTA — assinatura âmbar Arsenal */}
      <button
        onClick={onContinue}
        disabled={!valido}
        className={`w-full h-12 rounded-lg text-[12px] font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all
          ${valido
            ? "bg-amber-500 text-white hover:bg-amber-600 shadow-[0_6px_20px_-6px_rgba(245,158,11,0.55)]"
            : "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"}`}
      >
        <span>Continuar</span>
        <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

/* ── Componentes visuais Arsenal (tiles + group) ── */
function ArsenalGroup({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-[#f6f5f1] shadow-sm">
      {/* faixa superior âmbar (assinatura KpiCard Arsenal) */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5">
        <span className="font-mono text-[10px] font-bold text-amber-700 tracking-[0.2em] bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
          {index}
        </span>
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-700">
          {title}
        </div>
      </div>
      {hint && (
        <p className="px-4 pb-2 text-[12.5px] leading-snug text-zinc-700 font-medium">{hint}</p>
      )}
      <div className="px-4 pb-4 pt-1">{children}</div>
    </div>
  );
}

function ArsenalTileGrid({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={`group relative w-full text-left rounded-lg border px-3.5 py-3 transition-all flex items-center gap-3
              ${active
                ? "border-amber-500 bg-white shadow-[0_4px_14px_-6px_rgba(245,158,11,0.45)]"
                : "border-zinc-200 bg-white hover:border-amber-400/60 hover:bg-[#fafaf7]"}`}
          >
            <div
              className={`h-5 w-5 shrink-0 rounded-full border-2 grid place-items-center transition-colors
                ${active ? "border-amber-500 bg-amber-500" : "border-zinc-300 bg-white"}`}
            >
              {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
            <span
              className={`text-[13px] leading-snug ${
                active ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"
              }`}
            >
              {o.label}
            </span>
            {active && (
              <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-amber-700">
                SELECIONADO
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Field e Select no padrão do ClienteFormModal (admin Quero Armas) ── */
function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function AdminSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-3 pr-9 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all appearance-none cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
        strokeWidth={2.2}
      />
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
