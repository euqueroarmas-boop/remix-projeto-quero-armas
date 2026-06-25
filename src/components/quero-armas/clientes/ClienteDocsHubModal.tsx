import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Calendar,
  Camera,
  CheckCircle2,
  Crosshair,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Pencil,
  ScanLine,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isCurrentUserStaff } from "./docsAprovacao";
import HubDocPreviewSlot from "./HubDocPreviewSlot";
import {
  HUB_CATEGORIAS,
  getHubCategoriaMeta,
  getNomeDocumentoDisplay,
  getTipoDocumentoMeta,
  inferEscopoDocumental,
  inferHubCategoriaFromTipo,
  isCategoriaArmaAcervo,
  listTiposByCategoria,
  type EscopoDocumental,
  type HubCategoria,
} from "@/lib/quero-armas/documentosHubCatalogo";
// Notificações e auto-avanço são 100% backend-driven via triggers
// (qa_doc_cliente_recalcular -> qa_recalcular_status_servico ->
//  qa_dispatch_notify_event). Nada de notify aqui.

// Mapeia o `tipoDetectado` retornado pela edge `qa-classificar-documento-arma`
// para o `tipo_documento` salvo em `qa_documentos_cliente`.
const IA_TO_TIPO: Record<string, string> = {
  // Armas / acervo
  CR: "cr",
  CRAF: "craf",
  SINARM: "sinarm",
  GT: "gt",
  GTE: "gte",
  GUIA_TRANSITO: "gt",
  AUTORIZACAO_COMPRA: "autorizacao_compra",
  NOTA_FISCAL_ARMA: "nota_fiscal_arma",
  // Identificação
  RG_COM_CPF: "rg_com_cpf",
  CIN: "cin",
  CNH: "cnh",
  CPF: "cpf",
  // Endereço
  COMPROVANTE_RESIDENCIA: "comprovante_residencia",
  DECLARACAO_RESPONSAVEL_IMOVEL: "declaracao_responsavel_imovel",
  // Renda
  CTPS: "ctps",
  HOLERITE: "renda_holerite_mes_atual",
  CARTAO_CNPJ: "renda_cartao_cnpj",
  CONTRATO_SOCIAL: "renda_contrato_social",
  NOTA_FISCAL_AUTONOMO: "renda_nf_recente",
  COMPROVANTE_BENEFICIO: "renda_comprovante_beneficio",
  EXTRATO_INSS: "renda_extrato_inss",
  // Antecedentes
  ANTECEDENTES_CRIMINAIS: "antecedentes_criminais",
  ANTECEDENTES_FEDERAL: "antecedentes_federal",
  ANTECEDENTES_ESTADUAL: "antecedentes_estadual",
  ANTECEDENTES_MILITAR: "antecedentes_militar",
  ANTECEDENTES_ELEITORAL: "antecedentes_eleitoral",
  // Declarações
  DECLARACAO_NAO_INQUERITO: "declaracao_sem_inquerito_processo_criminal",
  DECLARACAO_GUARDA_RESPONSAVEL: "declaracao_guarda_responsavel",
  DECLARACAO_CORRELATA: "declaracao_correlata",
  DECLARACAO_GUARDA_ACERVO: "declaracao_guarda_acervo_1endereco",
  // Laudos
  LAUDO_PSICOLOGICO: "laudo_psicologico",
  LAUDO_CAPACIDADE_TECNICA: "laudo_capacidade_tecnica",
  // Efetiva necessidade
  COMPROVANTE_EFETIVA_NECESSIDADE: "comprovante_efetiva_necessidade",
  DOCUMENTO_COMPLEMENTAR: "documento_complementar_caso",
  // CAC
  COMPROVANTE_HABITUALIDADE: "comprovante_habitualidade",
  COMPROVANTE_CLUBE: "comprovante_clube_tiro",
  COMPROVANTE_COMPETICAO: "comprovante_competicao",
  // Processuais
  PROTOCOLO_PROCESSO: "protocolo_processo",
  OFICIO: "oficio",
  DESPACHO: "despacho",
  EXIGENCIA: "exigencia",
  INDEFERIMENTO: "indeferimento",
  // Jurídico
  PROCURACAO: "procuracao",
  RECURSO_ADMINISTRATIVO: "recurso_administrativo_doc",
  MANDADO_SEGURANCA: "mandado_seguranca_doc",
  // Fallback
  DESCONHECIDO: "outro",
};

type IAClass = {
  tipoDetectado: string;
  confianca: number;
  justificativa?: string;
  camposExtraidos?: Record<string, string | undefined> | null;
  recomendacao?: "aceitar" | "confirmar" | "revisao_obrigatoria";
  revisao_obrigatoria?: boolean;
};

type ConformidadeStatus = "conforme" | "divergente" | "sem_referencia" | "verificando";
type ConformidadeItem = {
  campo: string;
  label: string;
  valorCertidao: string;
  valorReferencia: string | null;
  fonteReferencia: string | null;
  status: ConformidadeStatus;
};

const TIPOS_CERTIDAO = new Set([
  "antecedentes_criminais",
  "antecedentes_federal",
  "antecedentes_estadual",
  "antecedentes_militar",
  "antecedentes_eleitoral",
]);

function normalizeStr(s: string): string {
  return s.trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    // Normaliza separadores variados (–, —, -, /, |) para espaço
    .replace(/[–—\-\/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normCpf(s: string): string {
  return s.replace(/\D/g, "");
}

// Mapeia nome completo do estado → sigla (já sem acento, uppercase)
const ESTADO_PARA_UF: Record<string, string> = {
  "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM",
  "BAHIA": "BA", "CEARA": "CE", "DISTRITO FEDERAL": "DF",
  "ESPIRITO SANTO": "ES", "GOIAS": "GO", "MARANHAO": "MA",
  "MATO GROSSO DO SUL": "MS", "MATO GROSSO": "MT", "MINAS GERAIS": "MG",
  "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR", "PERNAMBUCO": "PE",
  "PIAUI": "PI", "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS", "RONDONIA": "RO", "RORAIMA": "RR",
  "SANTA CATARINA": "SC", "SAO PAULO": "SP", "SERGIPE": "SE",
  "TOCANTINS": "TO",
};

// Normaliza naturalidade para comparação: remove formatação, expande/contrai UF
function normNaturalidade(s: string): string {
  let v = normalizeStr(s); // já: uppercase, sem acento, separadores → espaço
  // Substitui nome completo do estado pela sigla (do maior para menor para evitar substring clash)
  const sorted = Object.keys(ESTADO_PARA_UF).sort((a, b) => b.length - a.length);
  for (const nome of sorted) {
    if (v.includes(nome)) {
      v = v.replace(nome, ESTADO_PARA_UF[nome]);
      break;
    }
  }
  return v.replace(/\s+/g, " ").trim();
}

function normDate(s: string): string {
  // Accepts DD/MM/YYYY or YYYY-MM-DD
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return s.trim();
}

// ── Similaridade fuzzy para nomes ────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, n + 1, ...curr);
  }
  return prev[n];
}

function levenshteinSim(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// Jaccard por palavras — lida com reordenação: "Carlos José" vs "José Carlos"
function jaccardSim(a: string, b: string): number {
  const words = (s: string) => new Set(s.split(" ").filter(w => w.length > 2));
  const wa = words(a), wb = words(b);
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 1 : inter / union;
}

// Score combinado: o melhor dos dois algoritmos
function nameSim(a: string, b: string): number {
  const na = normalizeStr(a), nb = normalizeStr(b);
  return Math.max(levenshteinSim(na, nb), jaccardSim(na, nb));
}

// Limites de decisão (sem IA / zona cinzenta / divergente)
const SIM_HIGH = 0.88; // acima → conforme sem IA (typo/partícula omitida)
const SIM_LOW  = 0.55; // abaixo → divergente sem IA (claramente diferente)

// Hierarquia de confiança dos documentos como fonte de referência.
// Nível 1 = maior confiança (governo primário); 3 = menor (empresa mercantil).
const DOC_TRUST_TIER: Record<string, number> = {
  // Nível 1 — Governo, documentos primários de identidade
  cin: 1,
  rg_com_cpf: 1,
  cnh: 1,
  // Nível 2 — Órgãos governamentais / instituições centralizadas e descentralizadas
  cr: 2,
  craf: 2,
  gte: 2,
  sinarm: 2,
  gt: 2,
  antecedentes_criminais: 2,
  antecedentes_federal: 2,
  antecedentes_estadual: 2,
  antecedentes_militar: 2,
  antecedentes_eleitoral: 2,
  laudo_psicologico: 2,
  laudo_capacidade_tecnica: 2,
  renda_comprovante_beneficio: 2,
  renda_extrato_inss: 2,
  comprovante_habitualidade: 2,
  comprovante_clube_tiro: 2,
  // Nível 3 — Empresas mercantis / empregadores / concessionárias
  comprovante_residencia: 3,
  renda_holerite_mes_atual: 3,
  renda_nf_recente: 3,
  renda_cartao_cnpj: 3,
  renda_contrato_social: 3,
  ctps: 3,
};

function docTrustTier(tipo: string): number {
  return DOC_TRUST_TIER[tipo] ?? 3;
}

function calcularConformidade(
  campos: Record<string, string | undefined>,
  clienteNome: string | null | undefined,
  clienteCpf: string | null | undefined,
  clienteDataNascimento: string | null | undefined,
  clienteNomeMae: string | null | undefined,
  docsAprovados: any[],
): ConformidadeItem[] {
  type Ref = { valor: string; fonte: string; tier: number };
  const ref: Record<string, Ref> = {};

  // Ordena docs aprovados: equipe-validado primeiro, depois por tier crescente (1 = mais confiável)
  const sorted = [...docsAprovados]
    .filter(d => d.status === "aprovado")
    .sort((a, b) => {
      const tierA = docTrustTier(a.tipo_documento);
      const tierB = docTrustTier(b.tipo_documento);
      if (tierA !== tierB) return tierA - tierB;
      return (b.validado_admin ? 1 : 0) - (a.validado_admin ? 1 : 0);
    });

  for (const doc of sorted) {
    const c = (doc.ia_dados_extraidos?.camposExtraidos || {}) as Record<string, string>;
    const tier = docTrustTier(doc.tipo_documento);
    const nomeDoc = getNomeDocumentoDisplay(doc, doc.tipo_documento);
    const fonte = doc.validado_admin ? `${nomeDoc} (equipe)` : nomeDoc;

    const trySet = (key: string, val: string | undefined) => {
      if (!val) return;
      if (!ref[key] || tier < ref[key].tier) ref[key] = { valor: val, fonte, tier };
    };
    trySet("nome_completo", c.nome_completo);
    trySet("cpf", c.cpf);
    trySet("data_nascimento", c.data_nascimento);
    trySet("filiacao_mae", c.filiacao_mae);
    trySet("filiacao_pai", c.filiacao_pai);
    trySet("naturalidade", c.naturalidade);
    trySet("sexo", c.sexo);
  }

  // Fallback: dados de cadastro do cliente (usados apenas se nenhum doc aprovado cobriu o campo)
  const setFromCadastro = (key: string, val: string | null | undefined) => {
    if (!ref[key] && val) ref[key] = { valor: val, fonte: "Cadastro", tier: 99 };
  };
  setFromCadastro("nome_completo", clienteNome);
  setFromCadastro("cpf", clienteCpf);
  setFromCadastro("data_nascimento", clienteDataNascimento);
  setFromCadastro("filiacao_mae", clienteNomeMae);

  const items: ConformidadeItem[] = [];

  // compare retorna: true = conforme | false = divergente | "gray" = acionar IA
  function pushItem(
    campo: string, label: string, valorDoc: string | undefined,
    compare: (a: string, b: string) => boolean | "gray",
  ) {
    if (!valorDoc) return;
    const r = ref[campo];
    let status: ConformidadeStatus;
    if (!r) {
      status = "sem_referencia";
    } else {
      const res = compare(valorDoc, r.valor);
      status = res === true ? "conforme" : res === "gray" ? "verificando" : "divergente";
    }
    items.push({ campo, label, valorCertidao: valorDoc, valorReferencia: r?.valor ?? null, fonteReferencia: r?.fonte ?? null, status });
  }

  // Comparador fuzzy para nomes: exato → conforme; alta sim → conforme; zona cinzenta → IA; baixa → divergente
  const fuzzyName = (a: string, b: string): boolean | "gray" => {
    if (normalizeStr(a) === normalizeStr(b)) return true;
    // Subconjunto de tokens: documento pode trazer nome abreviado (ex.: sem sobrenome paterno final).
    // Se TODOS os tokens significativos (>=3 chars, excluindo partículas) do nome menor estiverem
    // presentes na mesma ordem no nome maior, considera-se conforme.
    const STOP = new Set(["DE","DA","DO","DAS","DOS","E"]);
    const ta = normalizeStr(a).split(" ").filter(t => t.length >= 3 && !STOP.has(t));
    const tb = normalizeStr(b).split(" ").filter(t => t.length >= 3 && !STOP.has(t));
    if (ta.length && tb.length) {
      const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
      let i = 0;
      for (const tok of longer) { if (tok === shorter[i]) i++; if (i === shorter.length) break; }
      if (i === shorter.length) return true;
    }
    const sim = nameSim(a, b);
    if (sim >= SIM_HIGH) return true;
    if (sim >= SIM_LOW) return "gray";
    return false;
  };

  // Naturalidade: tenta match normalizado; se falhar, cai em fuzzy
  const fuzzyNat = (a: string, b: string): boolean | "gray" => {
    if (normNaturalidade(a) === normNaturalidade(b)) return true;
    const sim = nameSim(normNaturalidade(a), normNaturalidade(b));
    if (sim >= SIM_HIGH) return true;
    if (sim >= SIM_LOW) return "gray";
    return false;
  };

  pushItem("nome_completo",   "Nome completo",      campos.nome_completo,   fuzzyName);
  pushItem("cpf",             "CPF",                campos.cpf,             (a, b) => normCpf(a) === normCpf(b));
  pushItem("data_nascimento", "Data de nascimento", campos.data_nascimento, (a, b) => normDate(a) === normDate(b));
  pushItem("filiacao_mae",    "Filiação materna",   campos.filiacao_mae,    fuzzyName);
  pushItem("filiacao_pai",    "Filiação paterna",   campos.filiacao_pai,    fuzzyName);
  pushItem("naturalidade",    "Naturalidade",       campos.naturalidade,    fuzzyNat);
  pushItem("sexo",            "Sexo",               campos.sexo,            (a, b) => a.trim().toUpperCase()[0] === b.trim().toUpperCase()[0]);

  return items;
}

type AutoResult =
  | { safe: true; documento_id: string | null; tipo_documento: string }
  | {
      safe: false;
      motivo:
        | "documento_nao_identificado"
        | "confianca_insuficiente"
        | "campos_ilegiveis"
        | "duplicado"
        | "erro_insercao"
        | "erro_upload"
        | "revisao_humana_obrigatoria";
      campos_faltando?: string[];
      confianca?: number;
      mensagem?: string;
    };

const MOTIVOS: Record<string, string> = {
  documento_nao_identificado:
    "Não conseguimos identificar este documento com segurança. Envie uma foto/PDF mais nítido.",
  confianca_insuficiente:
    "A leitura do documento não está nítida o suficiente. Reenvie em melhor qualidade.",
  campos_ilegiveis:
    "Alguns campos obrigatórios ficaram ilegíveis. Reenvie a foto/PDF com melhor nitidez.",
  duplicado: "Este documento já está cadastrado no seu Arsenal.",
  erro_insercao: "Não foi possível cadastrar automaticamente. Tente novamente.",
  erro_upload: "Falha ao enviar o arquivo. Verifique sua conexão e tente novamente.",
  revisao_humana_obrigatoria:
    "A IA leu o documento e sugeriu os campos abaixo. Confira CAMPO A CAMPO e corrija o que estiver errado antes de salvar — nada é cadastrado automaticamente.",
};

function dataIsoFromBr(v?: string | null): string {
  if (!v) return "";
  const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoToBr(v?: string | null): string {
  if (!v) return "";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function applyDateMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

type FormState = {
  tipo_documento: string;
  /** Título oficial literal lido pela IA do PDF (ex.: "CERTIDÃO ESTADUAL DE DISTRIBUIÇÕES CRIMINAIS"). */
  nome_documento: string;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string;
  data_validade: string;
  observacoes: string;
  arma_marca: string;
  arma_modelo: string;
  arma_calibre: string;
  arma_numero_serie: string;
  arma_especie: string;
  /** "Nº Cad. SINARM" — só quando regime SINARM. Ex.: 2022/905178870-50. */
  numero_cad_sinarm: string;
  /** Número de registro SIGMA — só quando regime SIGMA explícito. */
  numero_registro_sigma: string;
  /** Regime canônico inferido pela IA: SINARM | SIGMA | REVISAR. */
  sistema_registro: "" | "SINARM" | "SIGMA" | "REVISAR";
};

const EMPTY: FormState = {
  tipo_documento: "cr",
  nome_documento: "",
  numero_documento: "",
  orgao_emissor: "",
  data_emissao: "",
  data_validade: "",
  observacoes: "",
  arma_marca: "",
  arma_modelo: "",
  arma_calibre: "",
  arma_numero_serie: "",
  arma_especie: "",
  numero_cad_sinarm: "",
  numero_registro_sigma: "",
  sistema_registro: "",
};

/**
 * Campos sensíveis que a IA pode sugerir, mas que EXIGEM confirmação
 * humana antes do save. Usados para travar o botão "Salvar" e exibir
 * o badge "Confirmar" / "Corrigir" campo a campo.
 */
const SENSITIVE_KEYS = [
  "numero_documento",
  "numero_cad_sinarm",
  "numero_registro_sigma",
  "arma_numero_serie",
  "arma_marca",
  "arma_modelo",
  "arma_calibre",
  "data_validade",
  "sistema_registro",
] as const;
type SensitiveKey = typeof SENSITIVE_KEYS[number];

const GENERIC_WEAPON_MODEL_VALUES = new Set([
  "PISTOLA",
  "REVOLVER",
  "REVÓLVER",
  "CARABINA",
  "ESPINGARDA",
  "FUZIL",
  "ARMA",
  "ARMAMENTO",
]);

function safeExtractedModel(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  return GENERIC_WEAPON_MODEL_VALUES.has(value.toUpperCase()) ? "" : value;
}

/** Auditoria por campo: valor extraído pela IA × valor confirmado pelo humano. */
type FieldAudit = {
  valor_extraido_ia: string | null;
  valor_confirmado: string | null;
  corrigido_pelo_usuario: boolean;
  confianca: number;
  legivel: boolean;
  fonte: "vision" | "ocr" | "manual";
  confirmado_em: string | null;
};

const modalTheme = {
  // Stack Cockpit Z6 Light — papel #F2F2F2, tinta #0A0A0A, bordô #7A1F2B, brass #D6A64B
  "--background": "0 0% 100%",
  "--foreground": "0 0% 4%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 4%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 0% 4%",
  "--primary": "352 60% 30%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "0 0% 95%",
  "--secondary-foreground": "0 0% 4%",
  "--muted": "0 0% 95%",
  "--muted-foreground": "0 0% 35%",
  "--accent": "42 60% 50%",
  "--accent-foreground": "0 0% 4%",
  "--border": "0 0% 90%",
  "--input": "0 0% 90%",
  "--ring": "352 60% 30%",
} as React.CSSProperties;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  className,
  action,
}: {
  label: string;
  icon?: typeof Hash;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="font-heading flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {label}
        </span>
        {action}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 rounded-xl border border-input bg-background text-foreground shadow-sm transition-all placeholder:text-muted-foreground/55 hover:border-foreground/15 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0";

/**
 * Input de data em formato BR (DD/MM/AAAA) com máscara, que mantém o
 * valor pai em ISO (YYYY-MM-DD). Substitui o `<input type="date">`
 * nativo — que renderiza em altura inconsistente no iOS Safari — e
 * cumpre a regra de projeto (mem://style/admin-form-architecture).
 */
function DateInputBR({
  value,
  onChange,
  className,
  placeholder = "DD/MM/AAAA",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState<string>(isoToBr(value));
  useEffect(() => {
    setLocal(isoToBr(value));
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={local}
      placeholder={placeholder}
      maxLength={10}
      className={className}
      onChange={(e) => {
        const masked = applyDateMask(e.target.value);
        setLocal(masked);
        if (masked.length === 0) {
          onChange("");
          return;
        }
        if (masked.length === 10) {
          const iso = dataIsoFromBr(masked);
          if (iso) onChange(iso);
        }
      }}
    />
  );
}

/** Badge inline de confirmação humana de um campo sensível extraído pela IA. */
function ConfirmBadge({
  extraido,
  confirmado,
  onConfirm,
}: {
  extraido: string | undefined | null;
  confirmado: boolean | undefined;
  onConfirm: () => void;
}) {
  if (!extraido) return null;
  if (confirmado) {
    return (
      <span className="font-heading inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> Confirmado
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onConfirm}
      className="font-heading inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-300"
      title={`Valor extraído pela IA: ${extraido}`}
    >
      <AlertTriangle className="h-3 w-3" /> Confirmar
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  qaClienteId?: number | null;
  onSaved: () => void;
  /** Tipo de documento pré-selecionado ao abrir (ex.: "craf"). Default: "cr". */
  defaultTipo?: string;
  mode?: "portal" | "arsenal";
  /** CPF do cliente cadastrado (somente dígitos). */
  clienteCpf?: string | null;
  /** Nome completo do cliente conforme cadastro. */
  clienteNome?: string | null;
  /** Data de nascimento ISO (YYYY-MM-DD) ou DD/MM/YYYY. */
  clienteDataNascimento?: string | null;
  /** Nome da mãe conforme cadastro. */
  clienteNomeMae?: string | null;
  /** Documentos já aprovados no hub — usados como referência de conformidade. */
  docsAprovados?: any[];
}

function getDefaultTipo(mode: "portal" | "arsenal", defaultTipo?: string) {
  if (defaultTipo) return defaultTipo;
  return mode === "arsenal" ? "cr" : "rg_com_cpf";
}

export function ClienteDocsHubModal({
  open,
  onClose,
  customerId,
  qaClienteId,
  onSaved,
  defaultTipo,
  mode = customerId ? "portal" : "arsenal",
  clienteCpf,
  clienteNome,
  clienteDataNascimento,
  clienteNomeMae,
  docsAprovados = [],
}: Props) {
  const defaultTipoEfetivo = getDefaultTipo(mode, defaultTipo);
  const [form, setForm] = useState<FormState>({ ...EMPTY, tipo_documento: defaultTipoEfetivo });
  const [categoriaHub, setCategoriaHub] = useState<HubCategoria>(inferHubCategoriaFromTipo(defaultTipoEfetivo));
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [classificacao, setClassificacao] = useState<IAClass | null>(null);
  const [showTipoOverride, setShowTipoOverride] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoResult | null>(null);
  /** Valor original extraído pela IA por campo sensível (snapshot imutável). */
  const [iaExtraido, setIaExtraido] = useState<Partial<Record<SensitiveKey, string>>>({});
  /** Campos sensíveis que o humano confirmou explicitamente. */
  const [confirmados, setConfirmados] = useState<Partial<Record<SensitiveKey, boolean>>>({});
  /** Conformidade cruzada para certidões de antecedentes. */
  const [conformidade, setConformidade] = useState<ConformidadeItem[]>([]);
  /** true quando a certidão tem resultado_certidao = "consta_apontamento". */
  const [temApontamento, setTemApontamento] = useState(false);
  /** null = não respondido; "sim" = reconhece; "nao" = não reconhece (homônimo). */
  const [reconheceApontamento, setReconheceApontamento] = useState<"sim" | "nao" | null>(null);
  /** true após o cliente assinar a declaração de homonímia nesta sessão. */
  const [homonimiaSalva, setHomonimiaSalva] = useState(false);
  /** true para expandir o preview da declaração de homonímia. */
  const [showDeclaracao, setShowDeclaracao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /**
   * Auto-busca de dados do cliente para alimentar o motor de conformidade
   * cruzada. Resolve cenários (ex.: Bancada/Arsenal) onde o componente
   * pai não passa explicitamente clienteCpf/clienteNome/etc.
   */
  const [clienteAutoFetch, setClienteAutoFetch] = useState<{
    nome: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    nome_mae: string | null;
  }>({ nome: null, cpf: null, data_nascimento: null, nome_mae: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !qaClienteId) return;
      // Só busca se algum campo de referência estiver ausente nas props.
      if (clienteNome && clienteCpf && clienteDataNascimento && clienteNomeMae) return;
      try {
        const { data } = await supabase
          .from("qa_clientes" as any)
          .select("nome_completo, cpf, data_nascimento, nome_mae")
          .eq("id", qaClienteId)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as unknown as Record<string, string | null>;
        setClienteAutoFetch({
          nome: row.nome_completo || null,
          cpf: row.cpf || null,
          data_nascimento: row.data_nascimento || null,
          nome_mae: row.nome_mae || null,
        });
      } catch {
        // Silencioso — conformidade apenas degrada para "sem referência".
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, qaClienteId, clienteNome, clienteCpf, clienteDataNascimento, clienteNomeMae]);

  const refClienteNome = clienteNome ?? clienteAutoFetch.nome;
  const refClienteCpf = clienteCpf ?? clienteAutoFetch.cpf;
  const refClienteDataNascimento = clienteDataNascimento ?? clienteAutoFetch.data_nascimento;
  const refClienteNomeMae = clienteNomeMae ?? clienteAutoFetch.nome_mae;

  // Sincroniza tipo padrão a cada abertura (sem quebrar edição em andamento).
  // Reset apenas quando o modal abre.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      const tipoInicial = getDefaultTipo(mode, defaultTipo);
      // Reset COMPLETO ao reabrir: não vazar dados do documento anterior.
      setForm({ ...EMPTY, tipo_documento: tipoInicial });
      setCategoriaHub(inferHubCategoriaFromTipo(tipoInicial));
      setClassificacao(null);
      setShowTipoOverride(false);
      setAutoResult(null);
      setIaExtraido({});
      setConfirmados({});
      setConformidade([]);
      setTemApontamento(false);
      setReconheceApontamento(null);
      setHomonimiaSalva(false);
      setShowDeclaracao(false);
    }
  }, [open, defaultTipo, mode]);

  const tiposDisponiveis = listTiposByCategoria(categoriaHub);
  const tipoAtual = getTipoDocumentoMeta(form.tipo_documento) ?? tiposDisponiveis[0] ?? null;
  const categoriaAtualMeta = getHubCategoriaMeta(categoriaHub);
  const showArmaFields = isCategoriaArmaAcervo(categoriaHub);
  // CR e Autorização de Compra PRECEDEM a arma — não exigir dados da arma.
  const isDocPreArma = form.tipo_documento === "cr" || form.tipo_documento === "autorizacao_compra";
  const showArmaVinculada = showArmaFields && !isDocPreArma;
  const escopoAtual: EscopoDocumental = inferEscopoDocumental({
    tipo_documento: form.tipo_documento,
    categoria_hub: categoriaHub,
  });
  // Mostra campos SINARM quando: regime detectado SINARM, ou tipo = sinarm,
  // ou já existe um Nº Cad. SINARM preenchido (manual).
  const showSinarmFields =
    showArmaFields &&
    (form.sistema_registro === "SINARM" ||
      form.tipo_documento === "sinarm" ||
      !!form.numero_cad_sinarm);
  const showSigmaFields =
    showArmaFields &&
    (form.sistema_registro === "SIGMA" ||
      (form.tipo_documento === "craf" && !form.numero_cad_sinarm));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(prev.tipo_documento === "cr" && key === "numero_registro_sigma"
        ? { numero_documento: String(value || "") }
        : {}),
    }));
    // Edição manual implica confirmação (corrigido pelo usuário).
    if ((SENSITIVE_KEYS as readonly string[]).includes(key as string)) {
      setConfirmados((prev) => ({ ...prev, [key as SensitiveKey]: true }));
    }
  }

  function setCategoria(categoria: HubCategoria) {
    setCategoriaHub(categoria);
    const tipos = listTiposByCategoria(categoria);
    const tipoAtualMeta = getTipoDocumentoMeta(form.tipo_documento);
    if (!tipos.length) return;
    if (!tipoAtualMeta || tipoAtualMeta.categoria !== categoria) {
      setForm((prev) => ({
        ...prev,
        tipo_documento: tipos[0].value,
        numero_cad_sinarm: categoria === "arma_acervo" ? prev.numero_cad_sinarm : "",
        numero_registro_sigma: categoria === "arma_acervo" ? prev.numero_registro_sigma : "",
        sistema_registro: categoria === "arma_acervo" ? prev.sistema_registro : "",
      }));
    }
  }

  /** Marca um campo sensível como confirmado pelo humano (botão Confirmar). */
  function confirmField(key: SensitiveKey) {
    setConfirmados((prev) => ({
      ...prev,
      [key]: true,
      // No CR, o número operacional do documento é o próprio registro SIGMA.
      // A tela exibe apenas “Nº de Registro SIGMA”, então confirmar esse campo
      // também deve satisfazer a trava histórica de `numero_documento`.
      ...(form.tipo_documento === "cr" && key === "numero_registro_sigma" ? { numero_documento: true } : {}),
    }));
  }

  /** Quais campos sensíveis são exigidos para o tipo atual. */
  function requiredSensitiveKeys(): SensitiveKey[] {
    const t = form.tipo_documento;
    if (!showArmaFields) {
      const base: SensitiveKey[] = [];
      if (iaExtraido.numero_documento) base.push("numero_documento");
      if (iaExtraido.data_validade) base.push("data_validade");
      return base;
    }
    if (t === "cr" || t === "autorizacao_compra") {
      return t === "cr" ? ["numero_registro_sigma", "data_validade"] : ["numero_documento", "data_validade"];
    }
    if (t === "craf") {
      const base: SensitiveKey[] = [
        "sistema_registro",
        "arma_numero_serie",
        "arma_marca",
        "arma_modelo",
        "arma_calibre",
        "data_validade",
      ];
      if (form.sistema_registro === "SINARM") {
        return [...base, "numero_cad_sinarm", "numero_documento"];
      }
      if (form.sistema_registro === "SIGMA") {
        return [...base, "numero_registro_sigma"];
      }
      return [...base, "numero_documento"];
    }
    if (t === "sinarm") {
      return ["numero_cad_sinarm", "numero_documento", "data_validade"];
    }
    if (t === "gte" || t === "gt") {
      return ["numero_documento", "arma_numero_serie", "data_validade"];
    }
    return ["numero_documento"];
  }

  function pendingSensitiveKeys(): SensitiveKey[] {
    return requiredSensitiveKeys().filter((k) => !confirmados[k]);
  }

  // Documento expirado: compara data_validade (ISO) com hoje sem depender de timezone.
  const hoje = new Date().toISOString().slice(0, 10);
  const docExpirado = !!form.data_validade && form.data_validade < hoje;

  function buildFieldAudit(key: SensitiveKey, valorFinal: string | null): FieldAudit {
    const extraido = (iaExtraido[key] ?? "") || null;
    const final = (valorFinal ?? "") || null;
    const corrigido = !!extraido && !!final && extraido.trim().toUpperCase() !== final.trim().toUpperCase();
    return {
      valor_extraido_ia: extraido,
      valor_confirmado: final,
      corrigido_pelo_usuario: corrigido || (!extraido && !!final),
      confianca: extraido ? Number(classificacao?.confianca || 0) : 0,
      legivel: !!extraido,
      fonte: extraido ? "vision" : "manual",
      confirmado_em: confirmados[key] ? new Date().toISOString() : null,
    };
  }

  async function classifyAndExtract(target: File | null) {
    if (!target) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    const isImage = target.type.startsWith("image/");
    const isPdf = target.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Envie uma foto (JPG/PNG) ou PDF para a IA ler.");
      return;
    }

    setExtracting(true);
    setAutoResult(null);
    try {
      const dataUrl = await fileToDataUrl(target);

      // 1) Classifica automaticamente (sem depender da seleção manual).
      const { data: cls, error: clsErr } = await supabase.functions.invoke(
        "qa-classificar-documento-arma",
        { body: { imageDataUrl: dataUrl } },
      );
      if (clsErr) throw clsErr;

      const ia = (cls || {}) as IAClass;
      setClassificacao(ia);

      const tipoIA = IA_TO_TIPO[ia.tipoDetectado] || "outro";
      const categoriaIA = inferHubCategoriaFromTipo(tipoIA);
      setCategoriaHub(categoriaIA);
      const campos = ia.camposExtraidos || {};

      // Regime canônico (espelha lógica do backend qa-arsenal-doc-autoinsert).
      const cadSinarmRaw = String((campos as any).numero_cad_sinarm || "").trim();
      const sigmaExplicitoRaw = String((campos as any).numero_registro_sigma || "").trim();
      const sistemaIARaw = String((campos as any).sistema_registro || "").toUpperCase().trim();
      const sistemaFinal: "SINARM" | "SIGMA" | "REVISAR" =
        cadSinarmRaw ? "SINARM" :
        (sistemaIARaw === "SIGMA" && sigmaExplicitoRaw) ? "SIGMA" :
        sistemaIARaw === "SINARM" ? "SINARM" :
        sistemaIARaw === "SIGMA" ? "SIGMA" :
        "REVISAR";

      const modeloExtraidoSeguro = safeExtractedModel(campos.arma_modelo);

      setForm((prev) => ({
        ...prev,
        // tipo definido pela IA; cliente pode sobrescrever depois
        tipo_documento: tipoIA,
        // Comprovante de residência: usa o CPF extraído como identificador do titular
        numero_documento: tipoIA === "comprovante_residencia"
          ? (campos.cpf || campos.numero_documento || prev.numero_documento)
          : (campos.numero_documento || prev.numero_documento),
        orgao_emissor: campos.orgao_emissor || prev.orgao_emissor,
        // Para laudos/exames, o campo "Avaliação" usa data_avaliacao.
        // A regra legal (Lei 10.826/03) vincula validade à DATA DA AVALIAÇÃO,
        // não à data de emissão impressa.
        data_emissao: (() => {
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          if (isLaudoExame) {
            return (
              dataIsoFromBr((campos as any).data_avaliacao) ||
              dataIsoFromBr(campos.data_emissao) ||
              prev.data_emissao
            );
          }
          return dataIsoFromBr(campos.data_emissao) || prev.data_emissao;
        })(),
        data_validade: (() => {
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          // Regra legal (Lei 10.826/03): para laudos/exames a validade é SEMPRE
          // data_avaliacao + 1 ano, ignorando a data de validade impressa no documento
          // (que costuma ser inconsistente ou inexistente).
          if (isLaudoExame) {
            const avaliacao = dataIsoFromBr((campos as any).data_avaliacao) || dataIsoFromBr(campos.data_emissao);
            if (avaliacao) {
              const [y, m, d] = avaliacao.split("-").map(Number);
              const venc = new Date(Date.UTC(y + 1, m - 1, d));
              return venc.toISOString().slice(0, 10);
            }
            return prev.data_validade;
          }
          const valExplicita = dataIsoFromBr(campos.data_validade);
          if (valExplicita) return valExplicita;
          const emissao = dataIsoFromBr(campos.data_emissao);
          if (!emissao) return prev.data_validade;
          // Certidão militar: validade = 3 meses após emissão
          if (tipoIA === "antecedentes_militar") {
            const d = new Date(emissao);
            d.setMonth(d.getMonth() + 3);
            return d.toISOString().slice(0, 10);
          }
          // Comprovante de residência e demais certidões de antecedentes: + 1 mês
          const tiposValidade1mes = [
            "comprovante_residencia",
            "antecedentes_criminais",
            "antecedentes_eleitoral",
            "antecedentes_federal",
            "antecedentes_estadual",
          ];
          if (tiposValidade1mes.includes(tipoIA)) {
            const d = new Date(emissao);
            d.setMonth(d.getMonth() + 1);
            return d.toISOString().slice(0, 10);
          }
          return prev.data_validade;
        })(),
        arma_marca: campos.arma_marca || prev.arma_marca,
        arma_modelo: modeloExtraidoSeguro || prev.arma_modelo,
        arma_calibre: campos.arma_calibre || prev.arma_calibre,
        arma_numero_serie: campos.arma_numero_serie || prev.arma_numero_serie,
        numero_cad_sinarm: cadSinarmRaw || prev.numero_cad_sinarm,
        numero_registro_sigma:
          sistemaFinal === "SIGMA"
            ? (sigmaExplicitoRaw
                // CR é registrado no SIGMA: o nº do CR (numero_documento) É o nº de registro SIGMA.
                || (tipoIA === "cr" ? (campos.numero_documento || "") : "")
                || prev.numero_registro_sigma)
            : "", // SINARM/REVISAR nunca preenche SIGMA
        sistema_registro: tipoIA === "cr" ? "SIGMA" : sistemaFinal,
      }));

      // Snapshot IMUTÁVEL do que a IA extraiu, para auditoria e
      // bloqueio do salvar até confirmação humana campo a campo.
      setIaExtraido({
        numero_documento: campos.numero_documento || "",
        numero_cad_sinarm: cadSinarmRaw,
        numero_registro_sigma:
          sigmaExplicitoRaw || (tipoIA === "cr" ? (campos.numero_documento || "") : ""),
        arma_numero_serie: campos.arma_numero_serie || "",
        arma_marca: campos.arma_marca || "",
        arma_modelo: modeloExtraidoSeguro,
        arma_calibre: campos.arma_calibre || "",
        data_validade: dataIsoFromBr(campos.data_validade) || "",
        sistema_registro: sistemaFinal,
      });
      // Tudo começa como NÃO confirmado — exige clique do humano.
      setConfirmados({});

      // Motor de conformidade: todos os documentos que extraem dados pessoais.
      const items = calcularConformidade(
        campos as Record<string, string | undefined>,
        refClienteNome,
        refClienteCpf,
        refClienteDataNascimento,
        refClienteNomeMae,
        docsAprovados,
      );
      setConformidade(items);

      // Para itens em zona cinzenta, aciona verificação semântica via IA em paralelo
      const grayItems = items.filter(i => i.status === "verificando");
      if (grayItems.length > 0) {
        grayItems.forEach(async (item) => {
          if (!item.valorReferencia) return;
          try {
            const { data, error } = await supabase.functions.invoke("qa-conformidade-semantica", {
              body: { campo: item.label, valorA: item.valorCertidao, valorB: item.valorReferencia },
            });
            const equivalente = !error && data?.equivalente === true;
            setConformidade(prev =>
              prev.map(i => i.campo === item.campo
                ? { ...i, status: equivalente ? "conforme" : "divergente" }
                : i
              )
            );
          } catch {
            // Em caso de erro, marca como divergente por conservadorismo
            setConformidade(prev =>
              prev.map(i => i.campo === item.campo ? { ...i, status: "divergente" } : i)
            );
          }
        });
      }

      // Apontamento criminal: apenas certidões de antecedentes.
      if (TIPOS_CERTIDAO.has(tipoIA)) {
        const res = String(campos.resultado_certidao || "").toLowerCase();
        setTemApontamento(res === "consta_apontamento");
      } else {
        setTemApontamento(false);
      }
      setReconheceApontamento(null);
      setHomonimiaSalva(false);
      setShowDeclaracao(false);

      // 2) Tenta enriquecer campos via extractor já existente, usando o tipo da IA.
      try {
        const { data: extra } = await supabase.functions.invoke("qa-extract-cliente-doc", {
          body: { tipo_documento: tipoIA, imageDataUrl: dataUrl },
        });
        const sugestao = (extra as any)?.sugestao || {};
        setForm((prev) => {
          const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(tipoIA);
          // Para laudos/exames, a DATA DA AVALIAÇÃO do extractor SEMPRE prevalece
          // sobre qualquer data_emissao previamente capturada pelo classify (que
          // costuma trazer a data de emissão impressa do laudo, não a da avaliação).
          // Regra legal (Lei 10.826/03): validade = data_avaliacao + 1 ano.
          const dataAvaliacaoExtractor = isLaudoExame ? (sugestao.data_avaliacao || "") : "";
          return ({
            ...prev,
            nome_documento: prev.nome_documento || sugestao.titulo_oficial || "",
            numero_documento: prev.numero_documento || sugestao.numero_documento || "",
            orgao_emissor: prev.orgao_emissor || sugestao.orgao_emissor || "",
            data_emissao:
              dataAvaliacaoExtractor ||
              prev.data_emissao ||
              (isLaudoExame
                ? sugestao.data_avaliacao || sugestao.data_emissao
                : sugestao.data_emissao) ||
              "",
          // Para comprovante de residência, nunca usar data_validade da sugestão:
          // a IA extrai o vencimento da conta (≈1 mês), não a validade do documento (90 dias).
            data_validade:
              // Para laudos/exames, o extractor já recalcula data_validade = data_avaliacao + 1 ano
              // no servidor; sobrescreve qualquer prev (que veio do classify, possivelmente errado).
              (isLaudoExame && sugestao.data_validade)
                ? sugestao.data_validade
                : (prev.data_validade || (tipoIA === "comprovante_residencia" ? "" : sugestao.data_validade) || ""),
          observacoes: prev.observacoes || sugestao.observacoes || "",
          arma_marca: prev.arma_marca || sugestao.arma_marca || "",
          arma_modelo: prev.arma_modelo || safeExtractedModel(sugestao.arma_modelo) || "",
          arma_calibre: prev.arma_calibre || sugestao.arma_calibre || "",
          arma_numero_serie: prev.arma_numero_serie || sugestao.arma_numero_serie || "",
          arma_especie: prev.arma_especie || sugestao.arma_especie || "",
          });
        });
      } catch (eExt) {
        console.warn("[extract complementar] ignorado:", eExt);
      }

      // 3) Se a IA estiver segura (>=0.85, identificou tipo e campos legíveis),
      //    o backend faz upload + auto-cadastro. Caso contrário devolve motivo.
      if (inferHubCategoriaFromTipo(tipoIA) === "arma_acervo") {
        await tryAutoInsert(target, ia);
      } else {
        setAutoResult(null);
      }
    } catch (e: any) {
      console.error("[classify+extract] error:", e);
      toast.error(e?.message || "Falha ao processar o documento.");
    } finally {
      setExtracting(false);
    }
  }

  async function tryAutoInsert(target: File, ia: IAClass) {
    // Pré-checagem rápida client-side (evita upload desnecessário)
    if (
      !ia ||
      ia.tipoDetectado === "DESCONHECIDO" ||
      (ia.confianca || 0) < 0.85 ||
      ia.revisao_obrigatoria
    ) {
      const motivo: AutoResult = {
        safe: false,
        motivo: ia?.tipoDetectado === "DESCONHECIDO" ? "documento_nao_identificado" : "confianca_insuficiente",
        confianca: ia?.confianca,
      };
      setAutoResult(motivo);
      return;
    }

    try {
      // Upload para storage (sob a pasta do tipo identificado)
      const tipoDb = IA_TO_TIPO[ia.tipoDetectado] || "outro";
      const safe = sanitize(target.name);
      const ownerKey = customerId ?? `qa-${qaClienteId}`;
      const path = `cliente-docs/${ownerKey}/${tipoDb}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("qa-documentos")
        .upload(path, target, { upsert: false, contentType: target.type });
      if (upErr) {
        console.error("[auto upload] error:", upErr);
        setAutoResult({ safe: false, motivo: "erro_upload" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("qa-arsenal-doc-autoinsert", {
        body: {
          customer_id: customerId ?? null,
          qa_cliente_id: qaClienteId ?? null,
          arquivo_storage_path: path,
          arquivo_nome: target.name,
          arquivo_mime: target.type || null,
          classificacao: ia,
        },
      });

      if (error) {
        console.error("[autoinsert] edge error:", error);
        setAutoResult({ safe: false, motivo: "erro_insercao", mensagem: error.message });
        return;
      }

      const r = (data || {}) as any;
      if (r?.safe) {
        setAutoResult({ safe: true, documento_id: r.documento_id, tipo_documento: r.tipo_documento });
        toast.success("Documento cadastrado automaticamente no seu Arsenal.");
        onSaved();
        // pequeno delay para o cliente ver o resultado antes de fechar
        setTimeout(() => onClose(), 900);
      } else {
        setAutoResult({
          safe: false,
          motivo: r?.motivo || "campos_ilegiveis",
          campos_faltando: r?.campos_faltando,
          confianca: r?.confianca,
        });
      }
    } catch (e: any) {
      console.error("[autoinsert] error:", e);
      setAutoResult({ safe: false, motivo: "erro_insercao", mensagem: e?.message });
    }
  }

  async function handleFileChange(f: File | null) {
    setFile(f);
    setClassificacao(null);
    setShowTipoOverride(false);
    if (f) {
      // Dispara IA imediatamente — cliente não precisa escolher tipo antes.
      await classifyAndExtract(f);
    }
  }

  async function handleSave() {
    if (!form.tipo_documento) {
      toast.error("Escolha o tipo de documento.");
      return;
    }
    if (!customerId && !qaClienteId) {
      toast.error("Não foi possível identificar seu cadastro. Recarregue a página.");
      return;
    }

    // Trava de segurança: nenhum campo sensível pode ser gravado sem
    // confirmação humana explícita (clique em Confirmar OU edição manual).
    const pendentes = pendingSensitiveKeys();
    if (pendentes.length) {
      toast.error(
        `Confirme os campos antes de salvar: ${pendentes.join(", ").replace(/_/g, " ")}.`,
      );
      return;
    }

    // Trava de apontamento: se há apontamento na certidão, o cliente deve
    // responder se reconhece ou não antes de salvar.
    if (temApontamento && reconheceApontamento === null) {
      toast.error("Responda se reconhece o apontamento criminal antes de salvar.");
      return;
    }
    // Se não reconhece, precisa assinar a declaração de homonímia primeiro.
    if (temApontamento && reconheceApontamento === "nao" && !homonimiaSalva) {
      toast.error("Assine a declaração de homonímia antes de salvar a certidão.");
      return;
    }

    setSaving(true);
    try {
      // Bloqueio de duplicidade
      const tipoLabel = getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento || "documento").toUpperCase();
      const numeroNorm = (form.numero_documento || "").replace(/\s+/g, "").toUpperCase();

      // CR: único por cliente (não importa número)
      if (form.tipo_documento === "cr") {
        let q = supabase
          .from("qa_documentos_cliente" as any)
          .select("id")
          .eq("tipo_documento", "cr")
          .neq("status", "excluido")
          .limit(1);
        q = customerId
          ? q.eq("customer_id", customerId)
          : q.eq("qa_cliente_id", qaClienteId as number);
        const { data: existsCr, error: errCr } = await q;
        if (errCr) throw errCr;
        if ((existsCr as any[])?.length) {
          toast.error("Este cliente já possui um CR cadastrado. Edite o existente em vez de duplicar.");
          setSaving(false);
          return;
        }
      } else if (numeroNorm) {
        // Demais tipos: bloqueia se mesmo tipo + mesmo número já existir
        let q = supabase
          .from("qa_documentos_cliente" as any)
          .select("id, numero_documento")
          .eq("tipo_documento", form.tipo_documento)
          .neq("status", "excluido");
        q = customerId
          ? q.eq("customer_id", customerId)
          : q.eq("qa_cliente_id", qaClienteId as number);
        const { data: existsNum, error: errNum } = await q;
        if (errNum) throw errNum;
        const dup = (existsNum as any[] | null)?.find(
          (d) => (d.numero_documento || "").replace(/\s+/g, "").toUpperCase() === numeroNorm,
        );
        if (dup) {
          toast.error(`Já existe um ${tipoLabel} com o número ${form.numero_documento} para este cliente.`);
          setSaving(false);
          return;
        }
      }

      let storagePath: string | null = null;
      let fileName: string | null = null;
      let mime: string | null = null;

      if (file) {
        const safe = sanitize(file.name);
        const ownerKey = customerId ?? `qa-${qaClienteId}`;
        const path = `cliente-docs/${ownerKey}/${categoriaHub}/${form.tipo_documento}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documentos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        storagePath = path;
        fileName = file.name;
        mime = file.type || null;
      }

      const payload: any = {
        customer_id: customerId ?? null,
        qa_cliente_id: qaClienteId ?? null,
        categoria_hub: categoriaHub,
        subcategoria_hub: tipoAtual?.value ?? form.tipo_documento,
        escopo_documental: escopoAtual,
        reaproveitavel_global: escopoAtual !== "processo",
        revisao_humana_obrigatoria: !!tipoAtual?.revisaoHumanaObrigatoria,
        fonte_normativa: tipoAtual ? ["Lei 10.826/2003", ...(tipoAtual.categoria === "arma_acervo" || tipoAtual.categoria === "cac_atividade" ? ["Decreto 11.615/2023", "Decreto 12.345/2024", "IN DG/PF 311"] : ["IN DG/PF 201"])] : ["Lei 10.826/2003"],
        tipo_documento: form.tipo_documento,
        nome_documento: form.nome_documento || null,
        numero_documento: form.tipo_documento === "cr"
          ? (form.numero_documento || form.numero_registro_sigma || null)
          : (form.numero_documento || null),
        orgao_emissor: form.orgao_emissor || null,
        data_emissao: form.data_emissao || null,
        data_validade: form.data_validade || null,
        observacoes: form.observacoes || null,
        arma_marca: showArmaFields ? form.arma_marca || null : null,
        arma_modelo: showArmaFields ? form.arma_modelo || null : null,
        arma_calibre: showArmaFields ? form.arma_calibre || null : null,
        arma_numero_serie: showArmaFields ? form.arma_numero_serie || null : null,
        arma_especie: showArmaFields ? form.arma_especie || null : null,
        numero_cad_sinarm: showArmaFields ? (form.numero_cad_sinarm.trim() || null) : null,
        numero_registro_sigma: showArmaFields ? (form.numero_registro_sigma.trim() || null) : null,
        sistema_registro: showArmaFields ? (form.sistema_registro || null) : null,
        arquivo_storage_path: storagePath,
        arquivo_nome: fileName,
        arquivo_mime: mime,
        ia_status: classificacao ? "confirmado_humano" : (storagePath ? "sugerido" : "nao_processado"),
        ia_dados_extraidos: classificacao
          ? {
              tipoDetectado: classificacao.tipoDetectado,
              confianca: classificacao.confianca,
              recomendacao: classificacao.recomendacao,
              camposExtraidos: classificacao.camposExtraidos || {},
              avaliado_em: new Date().toISOString(),
              origem_fluxo: "arsenal_hub_documental",
              auto_cadastro: false,
              ...(form.tipo_documento === "comprovante_residencia" ? (() => {
                const cpfDoc = String(classificacao.camposExtraidos?.cpf || "").replace(/\D/g, "");
                const cpfCliente = String(clienteCpf || "").replace(/\D/g, "");
                const titularNome = classificacao.camposExtraidos?.nome_completo || null;
                const emNomeDoCliente = !!(cpfDoc && cpfCliente && cpfDoc === cpfCliente);
                return {
                  comprovante_residencia_cpf_titular: cpfDoc || null,
                  comprovante_residencia_em_nome_do_cliente: emNomeDoCliente,
                  comprovante_residencia_nome_titular: titularNome,
                  // Se não está no nome do cliente, declaracao_responsavel_imovel será exigida ao iniciar serviço
                  comprovante_residencia_exige_declaracao_responsavel: !emNomeDoCliente && !!(cpfDoc),
                };
              })() : {}),
              revisao_humana: true,
              documento_expirado: docExpirado,
              // Dados de conformidade cruzada para certidões
              ...(TIPOS_CERTIDAO.has(form.tipo_documento) ? {
                conformidade_cruzada: conformidade.map(i => ({
                  campo: i.campo,
                  status: i.status,
                  valor_certidao: i.valorCertidao,
                  valor_referencia: i.valorReferencia,
                  fonte_referencia: i.fonteReferencia,
                })),
                tem_divergencia: conformidade.some(i => i.status === "divergente"),
                resultado_certidao: classificacao.camposExtraidos?.resultado_certidao || null,
                // Certidão com apontamento criminal
                ...(temApontamento ? {
                  apontamento_criminal: true,
                  apontamento_reconhecido: reconheceApontamento,
                  declaracao_homonimia_salva: homonimiaSalva,
                } : {}),
              } : {}),
              campos_sensiveis: {
                numero_documento: buildFieldAudit("numero_documento", form.numero_documento || null),
                numero_cad_sinarm: buildFieldAudit("numero_cad_sinarm", form.numero_cad_sinarm || null),
                numero_registro_sigma: buildFieldAudit("numero_registro_sigma", form.numero_registro_sigma || null),
                arma_numero_serie: buildFieldAudit("arma_numero_serie", form.arma_numero_serie || null),
                arma_marca: buildFieldAudit("arma_marca", form.arma_marca || null),
                arma_modelo: buildFieldAudit("arma_modelo", form.arma_modelo || null),
                arma_calibre: buildFieldAudit("arma_calibre", form.arma_calibre || null),
                data_validade: buildFieldAudit("data_validade", form.data_validade || null),
                sistema_registro: buildFieldAudit("sistema_registro", form.sistema_registro || null),
              },
            }
          : null,
      };

      // Fluxo de aprovação:
      // - admin: aprovado direto
      // - cliente: sempre insere como pendente_aprovacao (RLS exige)
      //   a trigger qa_doc_auto_aprovar_por_ia_trigger promove para aprovado
      //   no servidor quando ia_dados_extraidos.recomendacao = 'aceitar'
      const isStaff = await isCurrentUserStaff();
      // Documento expirado, com apontamento ou com divergência nunca é auto-aprovado.
      // Laudos/exames vencidos NÃO bloqueiam: ficam como histórico (podem ser exigidos
      // pela PF para comprovar validade cruzada na época do exame de tiro).
      const isLaudoExameTipo = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(form.tipo_documento);
      const bloqueioPorVencimento = docExpirado && !isLaudoExameTipo;
      const bloqueioRevisao = bloqueioPorVencimento || temApontamento || conformidade.some(i => i.status === "divergente");
      const iaConfia = !bloqueioRevisao && classificacao?.recomendacao === "aceitar";
      if (isStaff) {
        payload.status = "aprovado";
        payload.origem = "admin";
        payload.validado_admin = true;
        payload.aprovado_em = new Date().toISOString();
      } else {
        payload.status = "pendente_aprovacao";
        payload.origem = "cliente";
        payload.validado_admin = false;
      }

      const { error: insertError } = await supabase.from("qa_documentos_cliente" as any).insert(payload);
      if (insertError) throw insertError;

      // Auto-sincroniza com qa_exames_cliente quando o documento for um
      // laudo psicológico ou atestado de capacidade técnica (exame de tiro).
      // O card EXAMES do Resumo lê dessa tabela — sem este upsert ele fica em 0.
      // Regra Lei 10.826/03: vencimento = data_avaliacao + 1 ano.
      try {
        if (qaClienteId && isLaudoExameTipo) {
          const t = form.tipo_documento.toLowerCase();
          const tipoExame: "psicologico" | "tiro" | null = /psico|laudo_psi|psicotec/.test(t)
            ? "psicologico"
            : /capacidade_tecnica|exame_tiro|tiro/.test(t)
              ? "tiro"
              : null;
          const dataRealizacao =
            (classificacao?.camposExtraidos as any)?.data_avaliacao ||
            form.data_emissao ||
            null;
          const dataIso = (() => {
            if (!dataRealizacao) return null;
            // aceita 'YYYY-MM-DD' direto ou 'DD/MM/AAAA'
            if (/^\d{4}-\d{2}-\d{2}$/.test(dataRealizacao)) return dataRealizacao;
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataRealizacao);
            return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
          })();
          if (tipoExame && dataIso) {
            const [y, mo, d] = dataIso.split("-").map(Number);
            const venc = new Date(Date.UTC(y + 1, mo - 1, d)).toISOString().slice(0, 10);
            // Substitui o exame vigente do mesmo tipo (mantém um por tipo).
            await supabase
              .from("qa_exames_cliente" as any)
              .delete()
              .eq("cliente_id", qaClienteId)
              .eq("tipo", tipoExame);
            await supabase.from("qa_exames_cliente" as any).insert({
              cliente_id: qaClienteId,
              tipo: tipoExame,
              data_realizacao: dataIso,
              data_vencimento: venc,
              observacoes: `Sincronizado automaticamente do Hub Documental (${form.tipo_documento}).`,
            });
          }
        }
      } catch (syncErr) {
        console.warn("[exames sync] falha não-crítica:", syncErr);
      }

      // Recálculo, eventos (documento_recebido / todos_documentos_recebidos),
      // cópia de campos para qa_clientes (titulo_eleitor, etc.) e e-mail são
      // disparados por triggers SECURITY DEFINER no banco.

      toast.success(
        isStaff || iaConfia
          ? "Documento aprovado e adicionado ao seu Hub."
          : "Documento enviado! Aguardando aprovação da equipe."
      );
      setForm(EMPTY);
      setFile(null);
      onSaved();
      onClose();
    } catch (e: any) {
      console.error("[save doc] error:", e);
      toast.error(e?.message || "Falha ao salvar documento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssinarHomonimia() {
    if (!customerId && !qaClienteId) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const nomeCliente = clienteNome || "Requerente";
    const cpfCliente = clienteCpf ? clienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "não informado";
    const nascimento = clienteDataNascimento
      ? (() => {
          const d = new Date(clienteDataNascimento + "T00:00:00");
          return d.toLocaleDateString("pt-BR");
        })()
      : "não informado";
    const tipoCertidaoLabel = getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento);

    const texto = [
      "DECLARAÇÃO DE HOMONÍMIA",
      "",
      `Eu, ${nomeCliente}, portador(a) do CPF ${cpfCliente}, nascido(a) em ${nascimento}, venho por meio desta declaração afirmar que NÃO possuo qualquer vínculo com o apontamento constante na ${tipoCertidaoLabel}.`,
      "",
      "Declaro que as informações do referido apontamento não me pertencem, tratando-se de homonímia com outra pessoa de nome semelhante, e que não pratiquei qualquer ato que possa fundamentar tal registro.",
      "",
      "Declaro ainda estar ciente das penalidades legais decorrentes de declaração falsa, nos termos do Art. 299 do Código Penal Brasileiro.",
      "",
      `${hoje}`,
      "",
      `Assinante: ${nomeCliente}`,
      `CPF: ${cpfCliente}`,
    ].join("\n");

    try {
      const payload: any = {
        customer_id: customerId ?? null,
        qa_cliente_id: qaClienteId ?? null,
        tipo_documento: "declaracao_homonimia",
        categoria_hub: "declaracoes",
        numero_documento: null,
        orgao_emissor: "Declaração própria",
        data_emissao: new Date().toISOString().slice(0, 10),
        data_validade: null,
        observacoes: texto,
        status: "pendente_aprovacao",
        origem: "cliente",
        validado_admin: false,
        ia_status: "nao_processado",
        ia_dados_extraidos: {
          origem_fluxo: "declaracao_homonimia_automatica",
          certidao_origem: form.tipo_documento,
          gerado_em: new Date().toISOString(),
        },
      };
      const { error } = await supabase.from("qa_documentos_cliente" as any).insert(payload);
      if (error) throw error;
      setHomonimiaSalva(true);
      toast.success("Declaração de homonímia registrada no seu Hub. A equipe irá analisar.");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar declaração: " + (e?.message || "tente novamente."));
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) void handleFileChange(droppedFile);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        style={modalTheme}
        className="w-[calc(100vw-1rem)] max-w-xl lg:max-w-[1320px] xl:max-w-[1400px] rounded-md border border-[#E5E5E5] bg-white p-0 text-[#0A0A0A] shadow-2xl max-h-[92dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden font-sans"
      >
        <div className="shrink-0 border-b-2 border-[#7A1F2B] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#7A1F2B]/10 text-[#7A1F2B]">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.4} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-heading text-[10px] font-semibold uppercase tracking-[0.32em] text-[#7A1F2B]">
                Hub documental
              </div>
              <h2 className="font-heading text-[22px] font-bold uppercase leading-none tracking-[0.06em] text-[#0A0A0A]">
                Adicionar Documento
              </h2>
              <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-[#4A4A4A]">
                Anexe foto ou PDF — a IA identifica o tipo e preenche os campos automaticamente. Você só revisa antes de salvar.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#E5E5E5] bg-white text-[#7A7A7A] transition-colors hover:bg-[#F7F7F7] hover:text-[#0A0A0A]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-4 [-webkit-overflow-scrolling:touch]">
          {/* Ficha catalográfica horizontal — 3 colunas no desktop: Arquivo · Análise · Dados */}
          <div className="space-y-4 pb-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arquivo</div>
                  <div className="mt-1 text-sm text-foreground">A IA identifica o tipo automaticamente</div>
                </div>
                {classificacao && tipoAtual ? (
                  <span className="rounded-full bg-accent/18 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
                    {tipoAtual.short}
                  </span>
                ) : null}
              </div>

              {!file ? (
                <div className="space-y-2.5">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                      dragOver ? "border-accent bg-accent/8" : "border-border bg-muted/45 hover:border-accent hover:bg-accent/6",
                    )}
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/18 text-accent-foreground shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-base font-semibold text-foreground">Toque ou arraste o arquivo</div>
                    <div className="mt-1 text-sm text-muted-foreground">JPG · PNG · PDF · até 20MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted"
                  >
                    <Camera className="h-4 w-4" />
                    Tirar foto agora
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-accent-foreground shadow-sm">
                    {file.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{file.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
                className="hidden"
              />

              {extracting && (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lendo o documento e identificando o tipo…
                </div>
              )}

              {!extracting && classificacao && (
                <div
                  className={cn(
                    "mt-3 rounded-2xl border p-3",
                    autoResult?.safe === false
                      ? "border-amber-300 bg-amber-50"
                      : autoResult?.safe
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-emerald-300 bg-emerald-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {autoResult?.safe === false ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                    ) : (
                      autoResult?.safe ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                      ) : (
                        <ScanLine className="mt-0.5 h-4 w-4 text-emerald-700" />
                      )
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {autoResult?.safe ? "Cadastrado automaticamente no Arsenal" : "Tipo identificado pela IA"}
                      </div>
                      <div className="mt-0.5 text-sm font-bold uppercase text-foreground">
                        {tipoAtual?.label || form.tipo_documento.toUpperCase()}{" "}
                        <span className="text-xs font-medium text-muted-foreground">
                          · {Math.round((classificacao.confianca || 0) * 100)}% confiança
                        </span>
                      </div>
                      {classificacao.justificativa && (
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">
                          {classificacao.justificativa}
                        </p>
                      )}
                      {autoResult?.safe === false && (
                        <div className="mt-2 rounded-lg bg-amber-100/70 p-2">
                          <p className="text-xs font-semibold text-amber-900">
                            {MOTIVOS[autoResult.motivo] || "Não foi possível cadastrar automaticamente."}
                          </p>
                          {autoResult.campos_faltando?.length ? (
                            <p className="mt-1 text-[11px] text-amber-900">
                              Campos ilegíveis: {autoResult.campos_faltando.join(", ")}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setClassificacao(null);
                              setAutoResult(null);
                              fileInputRef.current?.click();
                            }}
                            className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-amber-800"
                          >
                            <Upload className="h-3.5 w-3.5" /> Enviar novamente
                          </button>
                        </div>
                      )}
                      {autoResult?.safe && (
                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                          Tudo certo! O documento já está vinculado ao seu Arsenal.
                        </p>
                      )}
                      {!autoResult?.safe && (
                        <button
                        type="button"
                        onClick={() => setShowTipoOverride((v) => !v)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
                      >
                        <Pencil className="h-3 w-3" />
                        {showTipoOverride ? "Manter tipo identificado" : "Não é esse tipo? Alterar manualmente"}
                        </button>
                      )}
                      {showTipoOverride && !autoResult?.safe && (
                        <div className="mt-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Categoria
                              </div>
                              <Select value={categoriaHub} onValueChange={(value) => setCategoria(value as HubCategoria)}>
                                <SelectTrigger className={cn(inputClassName, "h-10 rounded-xl text-left text-sm font-medium")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover text-popover-foreground">
                                  {HUB_CATEGORIAS.map((categoria) => (
                                    <SelectItem
                                      key={categoria.value}
                                      value={categoria.value}
                                      className="focus:bg-muted focus:text-foreground"
                                    >
                                      {categoria.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Tipo
                              </div>
                              <Select value={form.tipo_documento} onValueChange={(value) => update("tipo_documento", value)}>
                                <SelectTrigger className={cn(inputClassName, "h-10 rounded-xl text-left text-sm font-medium")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-border bg-popover text-popover-foreground">
                                  {tiposDisponiveis.map((tipo) => (
                                    <SelectItem
                                      key={tipo.value}
                                      value={tipo.value}
                                      className="focus:bg-muted focus:text-foreground"
                                    >
                                      {tipo.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
                            {categoriaAtualMeta?.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <SectionTitle title="Dados do documento" />

            {classificacao && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wide">
                      Revise CAMPO A CAMPO antes de salvar
                    </div>
                    <p className="mt-1">
                      A IA leu o documento e sugeriu os valores abaixo. Nenhum dado é cadastrado
                      automaticamente. Clique em <b>Confirmar</b> em cada campo OU corrija manualmente.
                      Pendentes:{" "}
                      <b>{pendingSensitiveKeys().length === 0 ? "—" : pendingSensitiveKeys().join(", ").replace(/_/g, " ")}</b>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Alerta de documento expirado ── */}
            {docExpirado && (
              (() => {
                const isLaudoExame = /laudo|exame|capacidade_tecnica|psicotecnico/i.test(form.tipo_documento);
                return (
                  <div className={cn(
                    "rounded-2xl border p-3 text-xs",
                    isLaudoExame
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-red-400 bg-red-50 text-red-900"
                  )}>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className={cn("h-4 w-4 shrink-0", isLaudoExame ? "text-amber-600" : "text-red-600")} />
                      <span className="font-bold uppercase tracking-wide text-[10px]">
                        {isLaudoExame ? "Documento vencido — mantido como histórico" : "Documento vencido"}
                      </span>
                      <span className={cn(
                        "ml-auto text-[9px] font-tactical px-1.5 py-0.5 rounded",
                        isLaudoExame ? "bg-amber-100" : "bg-red-100"
                      )}>
                        {new Date(form.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {isLaudoExame ? (
                      <p className="mt-1 text-[10px]">
                        Laudos e exames vencidos <b>são aceitos e arquivados no histórico</b>. Eles podem ser
                        exigidos pela PF para comprovar a validade cruzada com outros exames realizados na
                        época (ex.: exame de tiro feito enquanto o psicológico estava vigente). O sistema
                        seleciona automaticamente os exames antigos necessários no momento do protocolo.
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px]">
                        A validade deste documento expirou. Documentos vencidos são encaminhados para revisão
                        humana e não serão aceitos no processo sem renovação.
                      </p>
                    )}
                  </div>
                );
              })()
            )}

            {/* ── Painel de conformidade cruzada (todos os documentos) ── */}
            {conformidade.length > 0 && (
              <div className={cn(
                "rounded-2xl border p-3 text-xs",
                conformidade.some(i => i.status === "divergente")
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  {conformidade.some(i => i.status === "divergente")
                    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  <span className="font-bold uppercase tracking-wide text-[10px]">
                    Conformidade com documentos aprovados
                    {conformidade.some(i => i.fonteReferencia?.includes("equipe")) ? " (dupla verificação)" : ""}
                  </span>
                </div>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider opacity-60">
                      <th className="text-left pb-1 pr-2 font-semibold">Campo</th>
                      <th className="text-left pb-1 pr-2 font-semibold">Na certidão</th>
                      <th className="text-left pb-1 pr-2 font-semibold">Referência</th>
                      <th className="text-left pb-1 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {conformidade.map((item) => (
                      <tr key={item.campo} className="align-top">
                        <td className="py-1 pr-2 font-medium text-current opacity-70 whitespace-nowrap">{item.label}</td>
                        <td className="py-1 pr-2 font-tactical">{item.valorCertidao}</td>
                        <td className="py-1 pr-2 opacity-70">
                          {item.valorReferencia
                            ? <span>{item.valorReferencia}<br/><span className="opacity-50 text-[8px]">{item.fonteReferencia}</span></span>
                            : <span className="opacity-40">sem referência</span>}
                        </td>
                        <td className="py-1 whitespace-nowrap">
                          {item.status === "conforme" && <span className="text-emerald-700 font-bold">✓ Conforme</span>}
                          {item.status === "divergente" && <span className="text-red-700 font-bold">⚠ Divergência</span>}
                          {item.status === "sem_referencia" && <span className="opacity-40">—</span>}
                          {item.status === "verificando" && (
                            <span className="text-blue-600 font-bold animate-pulse">⟳ IA verificando…</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {conformidade.some(i => i.status === "divergente") && (
                  <p className="mt-2 font-semibold text-red-800 text-[10px]">
                    Atenção: há divergência de dados. Corrija o documento ou entre em contato com a equipe antes de prosseguir.
                  </p>
                )}
              </div>
            )}

            {/* ── Resultado da certidão / apontamento criminal ── */}
            {classificacao && TIPOS_CERTIDAO.has(form.tipo_documento) && (
              <div className={cn(
                "rounded-2xl border p-3 text-xs",
                temApontamento
                  ? "border-red-400 bg-red-50 text-red-900"
                  : classificacao.camposExtraidos?.resultado_certidao === "nada_consta"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-border bg-card"
              )}>
                <div className="flex items-center gap-1.5 mb-1">
                  {temApontamento
                    ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    : <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  <span className="font-bold uppercase tracking-wide text-[10px]">Resultado da certidão</span>
                  <span className={cn(
                    "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded",
                    temApontamento ? "bg-red-200 text-red-800" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {temApontamento ? "CONSTA APONTAMENTO" : "NADA CONSTA"}
                  </span>
                </div>

                {temApontamento && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-red-800">
                      Esta certidão indica a existência de apontamento criminal ou pendência.
                      Antes de salvar, informe se você reconhece este apontamento:
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReconheceApontamento("sim")}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-[11px] font-bold border transition-colors",
                          reconheceApontamento === "sim"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                        )}
                      >
                        Sim, reconheço
                      </button>
                      <button
                        type="button"
                        onClick={() => { setReconheceApontamento("nao"); setHomonimiaSalva(false); }}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-[11px] font-bold border transition-colors",
                          reconheceApontamento === "nao"
                            ? "bg-slate-700 text-white border-slate-700"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        Não é meu
                      </button>
                    </div>

                    {reconheceApontamento === "sim" && (
                      <p className="text-[10px] text-red-700 bg-red-100 rounded-lg p-2">
                        O apontamento será registrado e a certidão encaminhada para análise da equipe.
                      </p>
                    )}

                    {reconheceApontamento === "nao" && !homonimiaSalva && (
                      <div className="rounded-xl border border-slate-300 bg-white p-3 space-y-2">
                        <p className="text-[11px] text-slate-700 font-medium">
                          Para prosseguir, você deverá assinar uma Declaração de Homonímia informando
                          que o apontamento não lhe pertence.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowDeclaracao(v => !v)}
                          className="text-[10px] text-slate-500 underline"
                        >
                          {showDeclaracao ? "Ocultar declaração" : "Ver declaração"}
                        </button>
                        {showDeclaracao && (
                          <pre className="text-[9px] text-slate-600 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap font-sans border border-slate-200 max-h-40 overflow-y-auto">
                            {[
                              "DECLARAÇÃO DE HOMONÍMIA",
                              "",
                              `Eu, ${clienteNome || "Requerente"}, portador(a) do CPF ${clienteCpf ? clienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "---"}, declaro que NÃO possuo qualquer vínculo com o apontamento constante na ${getNomeDocumentoDisplay({ tipo_documento: form.tipo_documento, nome_documento: form.nome_documento, numero_documento: form.numero_documento, orgao_emissor: form.orgao_emissor }, form.tipo_documento)}.`,
                              "",
                              "Trata-se de homonímia com outra pessoa de nome semelhante.",
                              "Declaro estar ciente das penalidades do Art. 299 do Código Penal.",
                              "",
                              new Date().toLocaleDateString("pt-BR"),
                            ].join("\n")}
                          </pre>
                        )}
                        <button
                          type="button"
                          onClick={handleAssinarHomonimia}
                          className="w-full rounded-xl bg-slate-800 text-white text-[11px] font-bold py-2 hover:bg-slate-900 transition-colors"
                        >
                          Assinar eletronicamente e registrar declaração
                        </button>
                      </div>
                    )}

                    {reconheceApontamento === "nao" && homonimiaSalva && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        Declaração de homonímia registrada. Agora você pode salvar a certidão.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoria do documento">
                  <Select value={categoriaHub} onValueChange={(value) => setCategoria(value as HubCategoria)}>
                    <SelectTrigger className={cn(inputClassName, "h-11 rounded-xl text-left text-sm font-medium")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {HUB_CATEGORIAS.map((categoria) => (
                        <SelectItem
                          key={categoria.value}
                          value={categoria.value}
                          className="focus:bg-muted focus:text-foreground"
                        >
                          {categoria.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Tipo do documento">
                  <Select value={form.tipo_documento} onValueChange={(value) => update("tipo_documento", value)}>
                    <SelectTrigger className={cn(inputClassName, "h-11 rounded-xl text-left text-sm font-medium")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {tiposDisponiveis.map((tipo) => (
                        <SelectItem
                          key={tipo.value}
                          value={tipo.value}
                          className="focus:bg-muted focus:text-foreground"
                        >
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Escopo e reaproveitamento
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {categoriaAtualMeta?.label} · escopo {escopoAtual}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {categoriaAtualMeta?.description}
                  {escopoAtual === "processo"
                    ? " Este documento tende a ficar vinculado ao processo atual."
                    : " Este documento pode ser reaproveitado em outras jornadas quando continuar válido e compatível."}
                </p>
              </div>

              {showArmaFields ? (
                <>
                  <Field
                    label="Sistema do registro"
                    icon={Hash}
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.sistema_registro}
                        confirmado={confirmados.sistema_registro}
                        onConfirm={() => confirmField("sistema_registro")}
                      />
                    }
                  >
                    <Select
                      value={form.sistema_registro || "REVISAR"}
                      onValueChange={(v) => {
                        update("sistema_registro", v as FormState["sistema_registro"]);
                        if (v === "SINARM") update("numero_registro_sigma", "");
                        if (v === "SIGMA") update("numero_cad_sinarm", "");
                      }}
                    >
                      <SelectTrigger className={cn(inputClassName, "h-11 rounded-xl text-left text-sm font-medium")}>
                        <SelectValue placeholder="Selecione o regime" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover text-popover-foreground">
                        <SelectItem value="SINARM">SINARM (Polícia Federal)</SelectItem>
                        <SelectItem value="SIGMA">SIGMA (Exército / CAC)</SelectItem>
                        <SelectItem value="REVISAR">A revisar</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {(!form.sistema_registro || form.sistema_registro === "REVISAR") ? (
                    <p className="text-xs text-amber-700">
                      Regime não identificado com segurança — confirme manualmente.
                    </p>
                  ) : null}
                  {showSinarmFields ? (
                    <>
                      <Field
                        label="Nº Cad. SINARM"
                        icon={Hash}
                        action={
                          <ConfirmBadge
                            extraido={iaExtraido.numero_cad_sinarm}
                            confirmado={confirmados.numero_cad_sinarm}
                            onConfirm={() => confirmField("numero_cad_sinarm")}
                          />
                        }
                      >
                        <Input
                          value={form.numero_cad_sinarm}
                          onChange={(event) => update("numero_cad_sinarm", event.target.value)}
                          placeholder="Ex.: 2022/905178870-50"
                          className={inputClassName}
                        />
                      </Field>
                      <Field
                        label="Nº do Registro"
                        icon={Hash}
                        action={
                          <ConfirmBadge
                            extraido={iaExtraido.numero_documento}
                            confirmado={confirmados.numero_documento}
                            onConfirm={() => confirmField("numero_documento")}
                          />
                        }
                      >
                        <Input
                          value={form.numero_documento}
                          onChange={(event) => update("numero_documento", event.target.value)}
                          placeholder="Ex.: 906786939"
                          className={inputClassName}
                        />
                      </Field>
                    </>
                  ) : showSigmaFields ? (
                    <Field
                      label="Nº de Registro SIGMA"
                      icon={Hash}
                      action={
                        <ConfirmBadge
                          extraido={iaExtraido.numero_registro_sigma}
                          confirmado={confirmados.numero_registro_sigma}
                          onConfirm={() => confirmField("numero_registro_sigma")}
                        />
                      }
                    >
                      <Input
                        value={form.numero_registro_sigma}
                        onChange={(event) => update("numero_registro_sigma", event.target.value)}
                        placeholder="Número SIGMA / Exército"
                        className={inputClassName}
                      />
                    </Field>
                  ) : (
                    <Field
                      label="Número do documento"
                      icon={Hash}
                      action={
                        <ConfirmBadge
                          extraido={iaExtraido.numero_documento}
                          confirmado={confirmados.numero_documento}
                          onConfirm={() => confirmField("numero_documento")}
                        />
                      }
                    >
                      <Input
                        value={form.numero_documento}
                        onChange={(event) => update("numero_documento", event.target.value)}
                        placeholder="Ex.: 1234567"
                        className={inputClassName}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <Field
                  label="Número do documento"
                  icon={Hash}
                  action={
                    <ConfirmBadge
                      extraido={iaExtraido.numero_documento}
                      confirmado={confirmados.numero_documento}
                      onConfirm={() => confirmField("numero_documento")}
                    />
                  }
                >
                  <Input
                    value={form.numero_documento}
                    onChange={(event) => update("numero_documento", event.target.value)}
                    placeholder="Ex.: 1234567"
                    className={inputClassName}
                  />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Órgão emissor">
                  <Input
                    value={form.orgao_emissor}
                    onChange={(event) => update("orgao_emissor", event.target.value)}
                    placeholder="PF, EB..."
                    className={inputClassName}
                  />
                </Field>

                <Field
                  label={
                    /laudo|exame|capacidade_tecnica|psicotecnico/i.test(form.tipo_documento)
                      ? "Avaliação"
                      : "Emissão"
                  }
                  icon={Calendar}
                >
                  <DateInputBR
                    value={form.data_emissao}
                    onChange={(iso) => update("data_emissao", iso)}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field
                label="Validade"
                icon={Calendar}
                action={
                  <ConfirmBadge
                    extraido={iaExtraido.data_validade}
                    confirmado={confirmados.data_validade}
                    onConfirm={() => confirmField("data_validade")}
                  />
                }
              >
                <DateInputBR
                  value={form.data_validade}
                  onChange={(iso) => update("data_validade", iso)}
                  className={inputClassName}
                />
              </Field>
            </div>

            {showArmaVinculada ? (
              <div className="rounded-2xl border border-accent/30 bg-accent/8 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-accent-foreground shadow-sm">
                    <Crosshair className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arma vinculada</div>
                    <div className="text-sm font-medium text-foreground">Preencha ou ajuste os dados identificados</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Espécie">
                    <Input
                      value={form.arma_especie}
                      onChange={(event) => update("arma_especie", event.target.value)}
                      placeholder="Pistola"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Marca"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_marca}
                        confirmado={confirmados.arma_marca}
                        onConfirm={() => confirmField("arma_marca")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_marca}
                      onChange={(event) => update("arma_marca", event.target.value)}
                      placeholder="Taurus"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Modelo"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_modelo}
                        confirmado={confirmados.arma_modelo}
                        onConfirm={() => confirmField("arma_modelo")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_modelo}
                      onChange={(event) => update("arma_modelo", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Calibre"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_calibre}
                        confirmado={confirmados.arma_calibre}
                        onConfirm={() => confirmField("arma_calibre")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_calibre}
                      onChange={(event) => update("arma_calibre", event.target.value)}
                      placeholder="9mm"
                      className={inputClassName}
                    />
                  </Field>

                  <Field
                    label="Nº de série"
                    className="col-span-2"
                    action={
                      <ConfirmBadge
                        extraido={iaExtraido.arma_numero_serie}
                        confirmado={confirmados.arma_numero_serie}
                        onConfirm={() => confirmField("arma_numero_serie")}
                      />
                    }
                  >
                    <Input
                      value={form.arma_numero_serie}
                      onChange={(event) => update("arma_numero_serie", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <Field label="Observações">
                <Textarea
                  value={form.observacoes}
                  onChange={(event) => update("observacoes", event.target.value)}
                  rows={3}
                  placeholder="Se necessário, adicione detalhes complementares."
                  className="min-h-[110px] rounded-2xl border border-input bg-background text-sm text-foreground shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0 resize-none"
                />
              </Field>
            </div>
          </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6">
          {autoResult?.safe ? (
            <div className="flex">
              <Button
                onClick={onClose}
                className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluído
              </Button>
            </div>
          ) : (
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border-border bg-background text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                extracting ||
                (!!classificacao && pendingSensitiveKeys().length > 0) ||
                (temApontamento && reconheceApontamento === null) ||
                (temApontamento && reconheceApontamento === "nao" && !homonimiaSalva)
              }
              className="h-11 flex-[1.2] rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {saving
                ? "Salvando..."
                : classificacao && pendingSensitiveKeys().length > 0
                  ? `Confirme ${pendingSensitiveKeys().length} campo(s)`
                  : temApontamento && reconheceApontamento === null
                    ? "Responda sobre o apontamento"
                    : temApontamento && reconheceApontamento === "nao" && !homonimiaSalva
                      ? "Assine a declaração"
                      : "Salvar documento"}
            </Button>
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClienteDocsHubModal;
