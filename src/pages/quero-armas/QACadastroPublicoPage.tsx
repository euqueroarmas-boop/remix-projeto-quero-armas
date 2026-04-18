import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import {
  User, MapPin, Building2, FileCheck, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, Search, Plus, AlertCircle, Shield, Camera, RotateCcw,
  IdCard, FileText, Sparkles, Upload, X,
} from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";

/* ── Types ── */
type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface FormData {
  nome_completo: string; cpf: string; rg: string; emissor_rg: string; uf_emissor_rg: string; data_nascimento: string;
  telefone_principal: string; telefone_secundario: string; email: string;
  nome_mae: string; nome_pai: string; estado_civil: string; nacionalidade: string;
  profissao: string; observacoes: string;
  end1_cep: string; end1_logradouro: string; end1_numero: string;
  end1_complemento: string; end1_bairro: string; end1_cidade: string;
  end1_estado: string; end1_latitude: string; end1_longitude: string;
  tem_segundo_endereco: boolean; end2_tipo: string;
  end2_cep: string; end2_logradouro: string; end2_numero: string;
  end2_complemento: string; end2_bairro: string; end2_cidade: string;
  end2_estado: string; end2_latitude: string; end2_longitude: string;
  vinculo_tipo: string;
  emp_cnpj: string; emp_razao_social: string; emp_nome_fantasia: string;
  emp_natureza_juridica: string;
  emp_endereco: string; emp_telefone: string; emp_email: string;
  trab_nome_empresa: string; trab_cnpj_empresa: string;
  trab_cargo_funcao: string;
  trab_endereco_empresa: string;
  trab_telefone_empresa: string;
  comprovante_endereco_proprio: string;
  servico_interesse: string;
  consentimento_dados_verdadeiros: boolean;
  consentimento_tratamento_dados: boolean;
  selfie_data_url: string;
}

interface DocImages {
  identity_data_url: string;
  address_data_url: string;
}

interface AddressDivergence {
  cep_address: { logradouro: string; bairro: string; cidade: string; estado: string };
  doc_address: { logradouro: string; bairro: string; cidade: string; estado: string };
}

const initialForm: FormData = {
  nome_completo: "", cpf: "", rg: "", emissor_rg: "", uf_emissor_rg: "", data_nascimento: "",
  telefone_principal: "", telefone_secundario: "", email: "",
  nome_mae: "", nome_pai: "", estado_civil: "", nacionalidade: "Brasileiro(a)",
  profissao: "", observacoes: "",
  end1_cep: "", end1_logradouro: "", end1_numero: "",
  end1_complemento: "", end1_bairro: "", end1_cidade: "",
  end1_estado: "", end1_latitude: "", end1_longitude: "",
  tem_segundo_endereco: false, end2_tipo: "",
  end2_cep: "", end2_logradouro: "", end2_numero: "",
  end2_complemento: "", end2_bairro: "", end2_cidade: "",
  end2_estado: "", end2_latitude: "", end2_longitude: "",
  vinculo_tipo: "",
  emp_cnpj: "", emp_razao_social: "", emp_nome_fantasia: "",
  emp_natureza_juridica: "",
  emp_endereco: "", emp_telefone: "", emp_email: "",
  trab_nome_empresa: "", trab_cnpj_empresa: "",
  trab_cargo_funcao: "",
  trab_endereco_empresa: "",
  trab_telefone_empresa: "",
  comprovante_endereco_proprio: "",
  servico_interesse: "",
  consentimento_dados_verdadeiros: false,
  consentimento_tratamento_dados: false,
  selfie_data_url: "",
};

const STEPS: { num: Step; label: string; icon: any }[] = [
  { num: 1, label: "Dados Pessoais", icon: User },
  { num: 2, label: "Endereço", icon: MapPin },
  { num: 3, label: "Segundo Endereço", icon: MapPin },
  { num: 4, label: "Vínculo Profissional", icon: Building2 },
  { num: 5, label: "Consentimento", icon: FileCheck },
];

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União Estável"];
const FAIXAS_SALARIAIS = ["Até R$ 2.000", "R$ 2.001 a R$ 5.000", "R$ 5.001 a R$ 10.000", "R$ 10.001 a R$ 20.000", "Acima de R$ 20.000", "Prefiro não informar"];

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

/* ── Helpers ── */
function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + "." + d.slice(3);
  if (d.length <= 9) return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6);
  return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9);
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskDate(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + "/" + d.slice(2);
  return d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return d.slice(0, 5) + "-" + d.slice(5);
}

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0, 2) + "." + d.slice(2);
  if (d.length <= 8) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
  if (d.length <= 12) return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
}

function maskRgInput(v: string): string {
  const raw = v.toUpperCase().replace(/[^0-9X]/g, "");
  const hasX = raw.endsWith("X");
  const digits = raw.replace(/X/g, "");
  const clean = hasX ? `${digits.slice(0, 8)}X` : digits.slice(0, 9);
  if (!clean) return "";
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}-${clean.slice(8)}`;
}
function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    img.src = src;
  });
}

async function normalizeUploadToDataUrl(file: File, maxSide = 1800, mirror = false): Promise<string> {
  if (!file.type.startsWith("image/")) return readFileAsDataUrl(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/* ── Component ── */
export default function QACadastroPublicoPage() {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { lookupCep, lookupCnpj, lookupGeocode, cepLoading, cnpjLoading, geocodeLoading } = useBrasilApiLookup();

  const [cpfLooking, setCpfLooking] = useState(false);
  const [cpfFound, setCpfFound] = useState<boolean | null>(null);
  const [showComplementoConfirm, setShowComplementoConfirm] = useState(false);
  const [servicos, setServicos] = useState<{ id: number; nome_servico: string }[]>([]);

  // Cadastro público duplicado (mesmo CPF) — fluxo de atualização
  const [existingCadastroId, setExistingCadastroId] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<
    | {
        id: string;
        nome_completo?: string | null;
        status?: string | null;
        servico_interesse?: string | null;
        created_at?: string | null;
        full?: any;
      }
    | null
  >(null);

  // ── Step 0: Document extraction state ──
  const [docImages, setDocImages] = useState<DocImages>({ identity_data_url: "", address_data_url: "" });
  const [extracting, setExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState<string>("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [divergence, setDivergence] = useState<AddressDivergence | null>(null);

  useEffect(() => {
    supabase.from("qa_servicos" as any).select("id, nome_servico").order("id").then(({ data }) => {
      if (data) setServicos(data as any[]);
    });
  }, []);

  const set = useCallback((field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
    // Once user manually changes a field, remove the auto-filled highlight
    setAutoFilled(prev => {
      if (!prev.has(field as string)) return prev;
      const n = new Set(prev);
      n.delete(field as string);
      return n;
    });
  }, []);

  /* ── CPF Lookup from qa_clientes ── */
  const handleCpfLookup = useCallback(async () => {
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11 || !validateCpf(form.cpf)) return;
    setCpfLooking(true);
    setCpfFound(null);
    try {
      const { data, error } = await supabase.functions.invoke("qa-cadastro-publico", {
        body: { action: "lookup-cpf", cpf: cpfDigits },
      });
      if (error) {
        setCpfFound(false);
        return;
      }

      // 1) Cadastro público já existente → abrir modal de confirmação
      if (data?.existing_cadastro?.id) {
        setDuplicateInfo(data.existing_cadastro);
        setCpfFound(false); // não usa autopreenchimento legado
        return;
      }

      if (!data?.found) {
        setCpfFound(false);
        return;
      }
      setCpfFound(true);
      const c = data.cliente;
      setForm(prev => ({
        ...prev,
        nome_completo: c.nome_completo || prev.nome_completo,
        data_nascimento: c.data_nascimento || prev.data_nascimento,
        telefone_principal: c.celular ? maskPhone(c.celular) : prev.telefone_principal,
        email: c.email || prev.email,
        nome_mae: c.nome_mae || prev.nome_mae,
        nome_pai: c.nome_pai || prev.nome_pai,
        estado_civil: c.estado_civil || prev.estado_civil,
        nacionalidade: c.nacionalidade || prev.nacionalidade,
        profissao: c.profissao || prev.profissao,
        observacoes: c.observacao || prev.observacoes,
        end1_cep: c.cep ? maskCep(c.cep) : prev.end1_cep,
        end1_logradouro: c.endereco || prev.end1_logradouro,
        end1_numero: c.numero || prev.end1_numero,
        end1_complemento: c.complemento || prev.end1_complemento,
        end1_bairro: c.bairro || prev.end1_bairro,
        end1_cidade: c.cidade || prev.end1_cidade,
        end1_estado: c.estado || prev.end1_estado,
        end1_latitude: c.geolocalizacao?.split(",")[0]?.trim() || prev.end1_latitude,
        end1_longitude: c.geolocalizacao?.split(",")[1]?.trim() || prev.end1_longitude,
        ...(c.endereco2 ? {
          tem_segundo_endereco: true,
          end2_logradouro: c.endereco2 || "",
          end2_numero: c.numero2 || "",
          end2_complemento: c.complemento2 || "",
          end2_bairro: c.bairro2 || "",
          end2_cep: c.cep2 ? maskCep(c.cep2) : "",
          end2_cidade: c.cidade2 || "",
          end2_estado: c.estado2 || "",
        } : {}),
      }));
    } catch {
      setCpfFound(false);
    } finally {
      setCpfLooking(false);
    }
  }, [form.cpf]);

  /* ── Aceitar atualização do cadastro existente ── */
  const acceptUpdateExisting = useCallback(() => {
    if (!duplicateInfo?.id) return;
    const f = duplicateInfo.full || {};
    setExistingCadastroId(duplicateInfo.id);
    // Preserva o serviço atual desejado pelo usuário (se já tiver selecionado);
    // caso contrário, herda do cadastro existente.
    setForm(prev => ({
      ...prev,
      nome_completo: f.nome_completo || prev.nome_completo,
      rg: f.rg || prev.rg,
      emissor_rg: f.emissor_rg || prev.emissor_rg,
      uf_emissor_rg: f.uf_emissor_rg || prev.uf_emissor_rg,
      data_nascimento: f.data_nascimento || prev.data_nascimento,
      telefone_principal: f.telefone_principal ? maskPhone(f.telefone_principal) : prev.telefone_principal,
      telefone_secundario: f.telefone_secundario ? maskPhone(f.telefone_secundario) : prev.telefone_secundario,
      email: f.email || prev.email,
      nome_mae: f.nome_mae || prev.nome_mae,
      nome_pai: f.nome_pai || prev.nome_pai,
      estado_civil: f.estado_civil || prev.estado_civil,
      nacionalidade: f.nacionalidade || prev.nacionalidade,
      profissao: f.profissao || prev.profissao,
      observacoes: f.observacoes || prev.observacoes,
      end1_cep: f.end1_cep ? maskCep(f.end1_cep) : prev.end1_cep,
      end1_logradouro: f.end1_logradouro || prev.end1_logradouro,
      end1_numero: f.end1_numero || prev.end1_numero,
      end1_complemento: f.end1_complemento || prev.end1_complemento,
      end1_bairro: f.end1_bairro || prev.end1_bairro,
      end1_cidade: f.end1_cidade || prev.end1_cidade,
      end1_estado: f.end1_estado || prev.end1_estado,
      end1_latitude: f.end1_latitude || prev.end1_latitude,
      end1_longitude: f.end1_longitude || prev.end1_longitude,
      tem_segundo_endereco: !!f.tem_segundo_endereco || prev.tem_segundo_endereco,
      end2_tipo: f.end2_tipo || prev.end2_tipo,
      end2_cep: f.end2_cep ? maskCep(f.end2_cep) : prev.end2_cep,
      end2_logradouro: f.end2_logradouro || prev.end2_logradouro,
      end2_numero: f.end2_numero || prev.end2_numero,
      end2_complemento: f.end2_complemento || prev.end2_complemento,
      end2_bairro: f.end2_bairro || prev.end2_bairro,
      end2_cidade: f.end2_cidade || prev.end2_cidade,
      end2_estado: f.end2_estado || prev.end2_estado,
      vinculo_tipo: f.vinculo_tipo || prev.vinculo_tipo,
      // Mantém o serviço novo se o usuário já escolheu, senão herda do existente
      servico_interesse: prev.servico_interesse || f.servico_interesse || "",
    }));
    setCpfFound(true);
    setDuplicateInfo(null);
  }, [duplicateInfo]);

  /* ── Cancelar — reset CPF e limpar formulário ── */
  const declineUpdateExisting = useCallback(() => {
    setDuplicateInfo(null);
    setExistingCadastroId(null);
    setCpfFound(null);
    setForm(prev => ({ ...prev, cpf: "" }));
  }, []);

  /* ── Address CEP lookup ── */
  const handleCepLookup = useCallback(async (prefix: "end1" | "end2") => {
    const cepField = `${prefix}_cep` as keyof FormData;
    const cepVal = (form[cepField] as string).replace(/\D/g, "");
    if (cepVal.length !== 8) return;
    const data = await lookupCep(cepVal);
    if (data) {
      set(`${prefix}_logradouro` as keyof FormData, data.street || "");
      set(`${prefix}_bairro` as keyof FormData, data.neighborhood || "");
      set(`${prefix}_cidade` as keyof FormData, data.city || "");
      set(`${prefix}_estado` as keyof FormData, data.state || "");
    }
  }, [form, lookupCep, set]);

  /* ── Geocode lookup (after number is filled) ── */
  const handleGeocodeLookup = useCallback(async (prefix: "end1" | "end2") => {
    const street = form[`${prefix}_logradouro` as keyof FormData] as string;
    const number = form[`${prefix}_numero` as keyof FormData] as string;
    const city = form[`${prefix}_cidade` as keyof FormData] as string;
    const state = form[`${prefix}_estado` as keyof FormData] as string;
    if (!city || !number.trim()) return;
    const geo = await lookupGeocode({ street, number, city, state });
    if (geo) {
      set(`${prefix}_latitude` as keyof FormData, geo.latitude);
      set(`${prefix}_longitude` as keyof FormData, geo.longitude);
    }
  }, [form, lookupGeocode, set]);

  /* ── CNPJ lookup ── */
  const handleCnpjLookup = useCallback(async (target: "emp" | "trab") => {
    const field = target === "emp" ? "emp_cnpj" : "trab_cnpj_empresa";
    const cnpjVal = (form[field] as string).replace(/\D/g, "");
    if (cnpjVal.length !== 14) return;
    const data = await lookupCnpj(cnpjVal);
    if (data) {
      if (target === "emp") {
        set("emp_razao_social", data.razao_social || "");
        set("emp_nome_fantasia", data.nome_fantasia || "");
        
        const addr = [data.logradouro, data.numero, data.complemento, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ");
        set("emp_endereco", addr);
        set("emp_telefone", data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : "");
      } else {
        set("trab_nome_empresa", data.razao_social || "");
        const addr = [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ");
        set("trab_endereco_empresa", addr);
        set("trab_telefone_empresa", data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : "");
      }
    }
  }, [form, lookupCnpj, set]);

  /* ── Step 0: Document extraction ── */
  const handleExtractDocuments = useCallback(async () => {
    setExtractError(null);
    if (!docImages.identity_data_url && !docImages.address_data_url) {
      setExtractError("Envie pelo menos um documento ou pule esta etapa.");
      return;
    }
    setExtracting(true);
    setExtractStage("Lendo documentos enviados…");
    try {
      const { data, error } = await supabase.functions.invoke("qa-extract-documents", {
        body: {
          identity_image: docImages.identity_data_url || undefined,
          address_image: docImages.address_data_url || undefined,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.error || "Falha ao extrair dados");
      }

      const filled = new Set<string>();
      const id = data.identity || {};
      const ad = data.address || {};

      // ── Apply identity fields ──
      setExtractStage("Preenchendo dados pessoais…");
      setForm(prev => {
        const next = { ...prev };
        if (id.nome_completo && !next.nome_completo) { next.nome_completo = String(id.nome_completo).toUpperCase(); filled.add("nome_completo"); }
        if (id.cpf) {
          const masked = maskCpf(String(id.cpf));
          if (!next.cpf || next.cpf.replace(/\D/g, "").length < 11) { next.cpf = masked; filled.add("cpf"); }
        }
        if (id.rg && !next.rg) { next.rg = maskRgInput(String(id.rg)); filled.add("rg"); }
        if (id.emissor_rg && !next.emissor_rg) { next.emissor_rg = String(id.emissor_rg).toUpperCase(); filled.add("emissor_rg"); }
        if (id.uf_emissor_rg && !next.uf_emissor_rg) { next.uf_emissor_rg = String(id.uf_emissor_rg).toUpperCase().slice(0, 2); filled.add("uf_emissor_rg"); }
        if (id.data_nascimento && !next.data_nascimento) {
          const d = String(id.data_nascimento).replace(/\D/g, "");
          if (d.length === 8) { next.data_nascimento = maskDate(d); filled.add("data_nascimento"); }
        }
        if (id.nome_mae && !next.nome_mae) { next.nome_mae = String(id.nome_mae).toUpperCase(); filled.add("nome_mae"); }
        if (id.nome_pai && !next.nome_pai) { next.nome_pai = String(id.nome_pai).toUpperCase(); filled.add("nome_pai"); }

        // ── Address fields from comprovante ──
        if (ad.cep && !next.end1_cep) { next.end1_cep = maskCep(String(ad.cep)); filled.add("end1_cep"); }
        if (ad.logradouro) { next.end1_logradouro = String(ad.logradouro).toUpperCase(); filled.add("end1_logradouro"); }
        if (ad.numero) { next.end1_numero = String(ad.numero); filled.add("end1_numero"); }
        if (ad.complemento) { next.end1_complemento = String(ad.complemento).toUpperCase(); filled.add("end1_complemento"); }
        if (ad.bairro) { next.end1_bairro = String(ad.bairro).toUpperCase(); filled.add("end1_bairro"); }
        if (ad.cidade) { next.end1_cidade = String(ad.cidade).toUpperCase(); filled.add("end1_cidade"); }
        if (ad.estado) { next.end1_estado = String(ad.estado).toUpperCase().slice(0, 2); filled.add("end1_estado"); }
        return next;
      });
      setAutoFilled(filled);

      // ── Confront CEP with extracted address ──
      if (ad.cep) {
        setExtractStage("Conferindo endereço com o CEP informado…");
        const cepDigits = String(ad.cep).replace(/\D/g, "");
        if (cepDigits.length === 8) {
          const cepData = await lookupCep(cepDigits);
          if (cepData) {
            const norm = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
            const cepLog = norm(cepData.street);
            const docLog = norm(ad.logradouro);
            const cepCity = norm(cepData.city);
            const docCity = norm(ad.cidade);
            const divergeLog = cepLog && docLog && !cepLog.includes(docLog) && !docLog.includes(cepLog);
            const divergeCity = cepCity && docCity && cepCity !== docCity;
            if (divergeLog || divergeCity) {
              setDivergence({
                cep_address: {
                  logradouro: cepData.street || "",
                  bairro: cepData.neighborhood || "",
                  cidade: cepData.city || "",
                  estado: cepData.state || "",
                },
                doc_address: {
                  logradouro: ad.logradouro || "",
                  bairro: ad.bairro || "",
                  cidade: ad.cidade || "",
                  estado: ad.estado || "",
                },
              });
            }
          }
        }
      }

      setExtractStage("Cadastro pré-preenchido!");
      setTimeout(() => setStep(1), 400);
    } catch (e: any) {
      setExtractError(
        e?.message === "RATE_LIMIT"
          ? "Limite de uso atingido. Tente novamente em alguns segundos."
          : "Não foi possível extrair todos os dados automaticamente. Revise e complete manualmente.",
      );
      // Allow user to proceed manually
    } finally {
      setExtracting(false);
    }
  }, [docImages, lookupCep]);

  const skipDocuments = () => setStep(1);

  const applyDivergenceChoice = (choice: "cep" | "doc") => {
    if (!divergence) return;
    const src = choice === "cep" ? divergence.cep_address : divergence.doc_address;
    setForm(prev => ({
      ...prev,
      end1_logradouro: src.logradouro.toUpperCase() || prev.end1_logradouro,
      end1_bairro: src.bairro.toUpperCase() || prev.end1_bairro,
      end1_cidade: src.cidade.toUpperCase() || prev.end1_cidade,
      end1_estado: src.estado.toUpperCase().slice(0, 2) || prev.end1_estado,
    }));
    setDivergence(null);
  };

  /* ── Validation per step ── */
  const validateStep = (s: Step): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!form.nome_completo.trim()) errs.nome_completo = "Nome é obrigatório";
      if (!validateCpf(form.cpf)) errs.cpf = "CPF inválido";
      if (!form.telefone_principal.replace(/\D/g, "") || form.telefone_principal.replace(/\D/g, "").length < 10)
        errs.telefone_principal = "Telefone é obrigatório";
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = "E-mail inválido";
      if (!form.selfie_data_url) (errs as any).selfie_data_url = "Selfie é obrigatória";
    }
    if (s === 2) {
      if (!form.end1_numero.trim()) errs.end1_numero = "Número é obrigatório";
      if (!form.end1_complemento.trim()) errs.end1_complemento = "Complemento é obrigatório (ex: Casa, Apto, Bloco)";
      if (!form.comprovante_endereco_proprio) errs.comprovante_endereco_proprio = "Informe se possui comprovante no seu nome";
    }
    if (s === 4) {
      if (!form.vinculo_tipo) errs.vinculo_tipo = "Selecione o vínculo profissional";
      if (!form.servico_interesse) errs.servico_interesse = "Selecione o serviço de interesse";
    }
    if (s === 5) {
      if (!form.consentimento_dados_verdadeiros) errs.consentimento_dados_verdadeiros = "Obrigatório";
      if (!form.consentimento_tratamento_dados) errs.consentimento_tratamento_dados = "Obrigatório";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const proceedFromStep2 = () => {
    if (form.tem_segundo_endereco) {
      setStep(3);
    } else {
      setStep(4);
    }
  };

  const nextStep = () => {
    if (step === 0) return; // Step 0 has its own button
    if (!validateStep(step)) return;
    if (step === 2) {
      proceedFromStep2();
    } else {
      setStep(Math.min(step + 1, 5) as Step);
    }
  };

  const prevStep = () => {
    if (step === 4 && !form.tem_segundo_endereco) {
      setStep(2);
    } else if (step === 1) {
      setStep(0);
    } else {
      setStep(Math.max(step - 1, 0) as Step);
    }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    if (!form.selfie_data_url) {
      setStep(1);
      setErrors({ nome_completo: "É necessário tirar a selfie no Passo 1" } as any);
      return;
    }
    setSubmitting(true);
    try {
      // Upload selfie — DataURL→Blob direto (mais confiável em iOS Safari)
      let selfie_path: string | null = null;
      try {
        const dataUrl = form.selfie_data_url;
        const [meta, b64] = dataUrl.split(",");
        const mime = /data:([^;]+)/.exec(meta || "")?.[1] || "image/jpeg";
        const bin = atob(b64 || "");
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });

        const cpfDigits = form.cpf.replace(/\D/g, "");
        const key = `cadastro-publico/${cpfDigits || "anon"}-${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("qa-cadastro-selfies")
          .upload(key, blob, { contentType: mime, upsert: true });
        if (upErr) {
          console.error("[selfie upload] storage error:", upErr);
          throw new Error(`Falha ao enviar selfie: ${upErr.message}`);
        }
        selfie_path = key;
        console.log("[selfie upload] ok →", key);
      } catch (e: any) {
        console.error("[selfie upload]", e);
        throw new Error(e?.message || "Não foi possível enviar a selfie. Tente novamente.");
      }

      const { selfie_data_url: _omit, ...rest } = form;
      const payload: any = { ...rest, selfie_path };
      if (existingCadastroId) payload.update_existing_id = existingCadastroId;

      const { data, error } = await supabase.functions.invoke("qa-cadastro-publico", {
        body: payload,
      });

      // Tratar duplicata detectada no servidor (race condition)
      const errMsg = (error as any)?.message || data?.error;
      if (errMsg === "duplicate_cpf" || data?.error === "duplicate_cpf") {
        setDuplicateInfo({
          id: data?.existing_id,
          status: data?.existing_status,
          created_at: data?.existing_created_at,
        });
        throw new Error("Já existe um cadastro com este CPF. Confirme a atualização para prosseguir.");
      }
      if (error || !data?.success) {
        throw new Error(data?.message || data?.error || (error as any)?.message || "Erro ao enviar");
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ nome_completo: err.message || "Erro ao enviar cadastro" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(220 20% 97%) 0%, hsl(230 20% 94%) 100%)" }}>
        <div className="max-w-md w-full text-center qa-card p-8 md:p-12 rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "hsl(152 60% 95%)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "hsl(152 60% 42%)" }} />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: "hsl(220 20% 18%)" }}>
            Cadastro Enviado
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(220 10% 46%)" }}>
            Seus dados foram recebidos com sucesso. Nossa equipe analisará as informações e entrará em contato em breve.
          </p>
          <div className="mt-6 p-3 rounded-lg text-xs" style={{ background: "hsl(220 20% 97%)", color: "hsl(220 10% 55%)" }}>
            <Shield className="h-3.5 w-3.5 inline mr-1.5" style={{ color: "hsl(230 80% 56%)" }} />
            Seus dados estão protegidos conforme a LGPD.
          </div>
        </div>

        <div
          className="max-w-md w-full text-center mt-6 pt-4 text-[11px] border-t"
          style={{ color: "hsl(220 10% 50%)", borderColor: "hsl(220 13% 88%)" }}
        >
          © {new Date().getFullYear()} · Criado e desenvolvido por{" "}
          <span className="font-semibold" style={{ color: "hsl(220 20% 25%)" }}>
            WMTi Tecnologia da Informação
          </span>
          . Todos os direitos reservados.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen qa-premium" style={{ background: "linear-gradient(135deg, hsl(220 20% 97%) 0%, hsl(230 20% 94%) 100%)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Modal: cadastro duplicado — perguntar se deseja atualizar */}
        {duplicateInfo && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={declineUpdateExisting}>
            <div
              className="qa-card max-w-md w-full rounded-2xl p-6 md:p-7 shadow-2xl"
              style={{ background: "white" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(35 95% 95%)" }}>
                  <AlertCircle className="w-5 h-5" style={{ color: "hsl(35 90% 45%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold leading-tight" style={{ color: "hsl(220 20% 18%)" }}>
                    Já existe um cadastro com este CPF
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "hsl(220 10% 50%)" }}>
                    Identificamos que você já enviou um cadastro anteriormente.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-3 mb-4 space-y-1.5 text-[12px]" style={{ background: "hsl(220 20% 97%)", color: "hsl(220 15% 30%)" }}>
                {duplicateInfo.nome_completo && (
                  <div><span className="opacity-60">Nome:</span> <span className="font-medium">{duplicateInfo.nome_completo}</span></div>
                )}
                {duplicateInfo.created_at && (
                  <div><span className="opacity-60">Enviado em:</span> <span className="font-medium">{new Date(duplicateInfo.created_at).toLocaleDateString("pt-BR")}</span></div>
                )}
                {duplicateInfo.status && (
                  <div><span className="opacity-60">Status:</span> <span className="font-medium uppercase">{duplicateInfo.status}</span></div>
                )}
                {duplicateInfo.servico_interesse && (
                  <div><span className="opacity-60">Serviço anterior:</span> <span className="font-medium">{duplicateInfo.servico_interesse}</span></div>
                )}
              </div>

              <p className="text-[13px] leading-relaxed mb-5" style={{ color: "hsl(220 15% 30%)" }}>
                Deseja <strong>atualizar seu cadastro</strong> com as informações atuais? Pode ser que algo tenha mudado (endereço, telefone, etc.).
                {form.servico_interesse && form.servico_interesse !== duplicateInfo.servico_interesse && (
                  <> O novo serviço solicitado (<strong>{form.servico_interesse}</strong>) será adicionado ao seu cadastro existente.</>
                )}
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={declineUpdateExisting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:bg-slate-50"
                  style={{ borderColor: "hsl(220 13% 88%)", color: "hsl(220 20% 30%)" }}
                >
                  Não, cancelar
                </button>
                <button
                  onClick={acceptUpdateExisting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: "hsl(230 80% 56%)" }}
                >
                  Sim, atualizar cadastro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center overflow-hidden bg-black shadow-sm">
            <QALogo className="h-16 w-16" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Cadastro de Cliente
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "hsl(220 10% 50%)" }}>
            Preencha seus dados para registro no sistema. Todas as informações são protegidas conforme a LGPD.
          </p>
        </div>

        {/* Steps indicator (hidden on Step 0) */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-1 mb-8 overflow-x-auto pb-2">
            {STEPS.filter(s => s.num !== 3 || form.tem_segundo_endereco).map((s, i, arr) => {
              const active = step === s.num;
              const done = step > s.num || (s.num === 3 && !form.tem_segundo_endereco);
              return (
                <div key={s.num} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: active ? "hsl(230 80% 56%)" : done ? "hsl(152 60% 42%)" : "hsl(220 13% 93%)",
                        color: active || done ? "white" : "hsl(220 10% 55%)",
                      }}
                    >
                      {done && !active ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-[10px] font-medium hidden md:block" style={{
                      color: active ? "hsl(230 80% 46%)" : "hsl(220 10% 55%)",
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-8 md:w-12 h-px mx-1" style={{ background: "hsl(220 13% 88%)" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Form card */}
        <div className="qa-card rounded-2xl p-5 md:p-8" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          {step === 0 && (
            <Step0Documents
              docImages={docImages}
              setDocImages={setDocImages}
              selfieDataUrl={form.selfie_data_url}
              setSelfieDataUrl={(v) => set("selfie_data_url", v)}
              extracting={extracting}
              extractStage={extractStage}
              extractError={extractError}
              onExtract={handleExtractDocuments}
              onSkip={skipDocuments}
            />
          )}
          {step === 1 && <Step1 form={form} set={set} errors={errors} onCpfLookup={handleCpfLookup} cpfLooking={cpfLooking} cpfFound={cpfFound} autoFilled={autoFilled} isUpdating={!!existingCadastroId} />}
          {step === 2 && <Step2 form={form} set={set} errors={errors} onCepLookup={() => handleCepLookup("end1")} cepLoading={cepLoading} showComplementoConfirm={showComplementoConfirm} onComplementoConfirmDismiss={() => { setShowComplementoConfirm(false); proceedFromStep2(); }} onGeocodeLookup={() => handleGeocodeLookup("end1")} geocodeLoading={geocodeLoading} autoFilled={autoFilled} />}
          {step === 3 && <Step3 form={form} set={set} errors={errors} onCepLookup={() => handleCepLookup("end2")} cepLoading={cepLoading} onGeocodeLookup={() => handleGeocodeLookup("end2")} geocodeLoading={geocodeLoading} />}
          {step === 4 && <Step4 form={form} set={set} errors={errors} onCnpjLookup={handleCnpjLookup} cnpjLoading={cnpjLoading} servicos={servicos} />}
          {step === 5 && <Step5 form={form} set={set} errors={errors} />}

          {/* Navigation (hidden on Step 0; Step 0 has its own buttons) */}
          {step > 0 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
              <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "hsl(220 10% 46%)", background: "hsl(220 14% 96%)" }}>
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
              {step < 5 ? (
                <button onClick={nextStep} className="qa-btn-primary flex items-center gap-1.5 no-glow">
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting}
                  className="qa-btn-primary flex items-center gap-1.5 no-glow disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {submitting ? "Enviando..." : "Enviar Cadastro"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Address divergence modal */}
        {divergence && (
          <DivergenceModal
            divergence={divergence}
            onChoose={applyDivergenceChoice}
            onClose={() => setDivergence(null)}
          />
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
          <Shield className="w-3 h-3 inline mr-1" />
          Dados protegidos conforme a Lei Geral de Proteção de Dados (LGPD)
        </div>

        <div
          className="text-center mt-3 pt-3 text-[11px] border-t"
          style={{ color: "hsl(220 10% 50%)", borderColor: "hsl(220 13% 88%)" }}
        >
          © {new Date().getFullYear()} · Criado e desenvolvido por{" "}
          <span className="font-semibold" style={{ color: "hsl(220 20% 25%)" }}>
            WMTi Tecnologia da Informação
          </span>
          . Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Step Components
   ══════════════════════════════════════ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold mb-1 tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>{children}</h2>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-5" style={{ color: "hsl(220 10% 55%)" }}>{children}</p>;
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5" style={{ color: "hsl(220 20% 25%)" }}>
        {label}{required && <span style={{ color: "hsl(0 72% 51%)" }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: "hsl(0 72% 51%)" }}>
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

const inputClass = "w-full h-10 px-3 rounded-lg border text-sm outline-none transition-all focus:ring-2";
const inputStyle = {
  background: "hsl(0 0% 100%)",
  borderColor: "hsl(220 13% 88%)",
  color: "hsl(220 20% 18%)",
};
const inputFocusRing = "focus:ring-blue-200 focus:border-blue-400";

function TextInput({ value, onChange, placeholder, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className={`${inputClass} ${inputFocusRing} uppercase`}
      style={inputStyle}
      value={value}
      onChange={e => onChange(e.target.value.toUpperCase())}
      placeholder={placeholder}
      {...rest}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select className={`${inputClass} ${inputFocusRing} uppercase`} style={inputStyle} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder || "Selecione..."}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ── Selfie Capture ── */
function SelfieCapture({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);

  const onFile = async (f: File, mirror = false) => {
    setCamErr(null);
    try {
      const normalized = await normalizeUploadToDataUrl(f, 1400, mirror);
      onChange(normalized);
    } catch {
      setCamErr("Não foi possível carregar a imagem. Tente novamente com outra foto.");
    }
  };

  return (
    <div className="md:col-span-2">
      <div className="flex items-center gap-2 mb-2">
        <Camera className="w-4 h-4" style={{ color: "hsl(230 80% 56%)" }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(220 20% 25%)" }}>
          Selfie de Identificação <span style={{ color: "hsl(0 70% 55%)" }}>*</span>
        </span>
      </div>
      <div className="rounded-xl border p-3 flex flex-col sm:flex-row items-center gap-3" style={{ borderColor: "hsl(220 13% 88%)", background: "hsl(220 20% 98%)" }}>
        <div className="w-32 h-32 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-black/5" style={{ border: "1px dashed hsl(220 13% 80%)" }}>
          {value ? (
            <img src={value} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8" style={{ color: "hsl(220 10% 60%)" }} />
          )}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <p className="text-xs leading-relaxed mb-2" style={{ color: "hsl(220 10% 50%)" }}>
            Tire uma foto do seu rosto bem iluminado, sem óculos escuros ou boné. Será usada para identificação.
          </p>
          <div className="flex flex-wrap gap-2">
            {value ? (
              <button type="button" onClick={() => { onChange(""); }} className="text-xs font-medium px-3 py-1.5 rounded-lg border flex items-center gap-1.5" style={{ borderColor: "hsl(220 13% 85%)", color: "hsl(220 20% 30%)" }}>
                <RotateCcw className="w-3.5 h-3.5" /> Tirar outra
              </button>
            ) : (
              <>
                <label className="relative overflow-hidden text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 cursor-pointer" style={{ background: "hsl(230 80% 56%)" }}>
                  <Camera className="w-3.5 h-3.5" /> Abrir câmera
                  <input ref={cameraRef} type="file" accept="image/*" capture="user" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const f = e.target.files?.[0]; if (f) await onFile(f, true); e.target.value = ""; }} />
                </label>
                <label className="relative overflow-hidden text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer" style={{ borderColor: "hsl(220 13% 85%)", color: "hsl(220 20% 30%)" }}>
                  Enviar arquivo
                  <input ref={fileRef} type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const f = e.target.files?.[0]; if (f) await onFile(f); e.target.value = ""; }} />
                </label>
              </>
            )}
          </div>
          {camErr && <p className="text-[11px] mt-1.5" style={{ color: "hsl(0 70% 50%)" }}>{camErr}</p>}
          {error && !value && <p className="text-[11px] mt-1.5" style={{ color: "hsl(0 70% 50%)" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Step 0: Envio de Documentos (extração automática por IA)
   ══════════════════════════════════════ */
function DocUploadCard({
  title, description, accepted, value, onChange, icon: Icon,
}: {
  title: string; description: string; accepted: string;
  value: string; onChange: (v: string) => void; icon: any;
}) {
  const [fileError, setFileError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setFileError(null);
    try {
      const normalized = await normalizeUploadToDataUrl(f);
      onChange(normalized);
    } catch {
      setFileError("Não foi possível carregar este arquivo. Tente novamente.");
    }
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: value ? "hsl(152 40% 70%)" : "hsl(220 13% 88%)", background: value ? "hsl(152 60% 98%)" : "hsl(0 0% 100%)" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: value ? "hsl(152 60% 92%)" : "hsl(230 80% 96%)" }}>
          {value ? <CheckCircle className="w-5 h-5" style={{ color: "hsl(152 60% 38%)" }} /> : <Icon className="w-5 h-5" style={{ color: "hsl(230 80% 56%)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold" style={{ color: "hsl(220 20% 18%)" }}>{title}</h3>
          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "hsl(220 10% 50%)" }}>{description}</p>
        </div>
      </div>
      {value ? (
        <div className="mt-3 flex items-center gap-2">
          <img src={value} alt={title} className="h-16 w-16 object-cover rounded-lg border" style={{ borderColor: "hsl(220 13% 85%)" }} />
          <button type="button" onClick={() => onChange("")} className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1" style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 45%)" }}>
            <X className="w-3 h-3" /> Trocar
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="relative overflow-hidden flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors cursor-pointer" style={{ borderColor: "hsl(230 60% 80%)", color: "hsl(230 80% 50%)", background: "hsl(230 80% 99%)" }}>
            <Camera className="w-4 h-4" /> Câmera
            <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const f = e.target.files?.[0]; if (f) await onFile(f); e.target.value = ""; }} />
          </label>
          <label className="relative overflow-hidden flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors cursor-pointer" style={{ borderColor: "hsl(230 60% 80%)", color: "hsl(230 80% 50%)", background: "hsl(230 80% 99%)" }}>
            <Upload className="w-4 h-4" /> Arquivo
            <input type="file" accept={accepted} className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e => { const f = e.target.files?.[0]; if (f) await onFile(f); e.target.value = ""; }} />
          </label>
        </div>
      )}
      {fileError && <p className="text-[11px] mt-2" style={{ color: "hsl(0 70% 50%)" }}>{fileError}</p>}
    </div>
  );
}

function Step0Documents({
  docImages, setDocImages, selfieDataUrl, setSelfieDataUrl,
  extracting, extractStage, extractError, onExtract, onSkip,
}: {
  docImages: DocImages;
  setDocImages: (v: DocImages | ((p: DocImages) => DocImages)) => void;
  selfieDataUrl: string;
  setSelfieDataUrl: (v: string) => void;
  extracting: boolean;
  extractStage: string;
  extractError: string | null;
  onExtract: () => void;
  onSkip: () => void;
}) {
  const hasAny = !!(docImages.identity_data_url || docImages.address_data_url || selfieDataUrl);

  if (extracting) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "hsl(230 80% 96%)" }}>
          <Sparkles className="w-8 h-8 animate-pulse" style={{ color: "hsl(230 80% 56%)" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "hsl(220 20% 18%)" }}>Processando seus documentos</h2>
        <p className="text-sm flex items-center justify-center gap-2" style={{ color: "hsl(220 10% 50%)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          {extractStage || "Extraindo dados…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5" style={{ color: "hsl(230 80% 56%)" }} />
        <SectionTitle>Envio de Documentos (preenchimento automático)</SectionTitle>
      </div>
      <SectionDesc>
        Envie um documento oficial de identificação com CPF e um comprovante de endereço legível.
        Nossa IA extrai os dados e preenche o cadastro para você. Você poderá revisar tudo antes de enviar.
      </SectionDesc>

      <div className="p-3 rounded-lg mb-5 text-[11px] leading-relaxed flex items-start gap-2" style={{ background: "hsl(220 20% 97%)", color: "hsl(220 15% 35%)", border: "1px solid hsl(220 13% 90%)" }}>
        <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "hsl(230 80% 56%)" }} />
        <span>
          Conforme a <strong>Lei 10.826/2003</strong>, o <strong>Decreto 11.615/2023</strong> e os normativos vigentes da Polícia Federal aplicáveis ao público <strong>CAC</strong> e ao <strong>armamento para defesa pessoal</strong>,
          o cadastro exige identificação civil com CPF e comprovação de endereço. Seus arquivos são tratados conforme a LGPD.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DocUploadCard
          icon={IdCard}
          title="Documento de identificação com CPF"
          description="RG, CNH, CIN ou outro documento oficial. Se já contiver o CPF, não é preciso enviar separado."
          accepted="image/*,application/pdf"
          value={docImages.identity_data_url}
          onChange={(v) => setDocImages(prev => ({ ...prev, identity_data_url: v }))}
        />
        <DocUploadCard
          icon={FileText}
          title="Comprovante de endereço"
          description="Conta de luz, água, telefone, internet, gás ou IPTU. Legível e atualizado."
          accepted="image/*,application/pdf"
          value={docImages.address_data_url}
          onChange={(v) => setDocImages(prev => ({ ...prev, address_data_url: v }))}
        />
      </div>

      <div className="mt-4">
        <SelfieCapture value={selfieDataUrl} onChange={setSelfieDataUrl} />
      </div>

      {extractError && (
        <div className="mt-4 p-3 rounded-lg flex items-start gap-2 text-xs" style={{ background: "hsl(40 90% 96%)", border: "1px solid hsl(40 70% 80%)", color: "hsl(40 50% 25%)" }}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(40 80% 45%)" }} />
          <span>{extractError}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 pt-5 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
        <button onClick={onSkip} type="button" className="text-sm font-medium px-4 py-2.5 rounded-lg transition-colors" style={{ color: "hsl(220 10% 46%)", background: "hsl(220 14% 96%)" }}>
          Preencher manualmente
        </button>
        <button
          onClick={onExtract}
          disabled={!hasAny}
          type="button"
          className="qa-btn-primary flex items-center justify-center gap-1.5 no-glow disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Extrair dados e continuar
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Address Divergence Modal ── */
function DivergenceModal({
  divergence, onChoose, onClose,
}: {
  divergence: AddressDivergence;
  onChoose: (c: "cep" | "doc") => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="qa-card max-w-lg w-full rounded-2xl p-6" onClick={e => e.stopPropagation()} style={{ background: "white" }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "hsl(40 90% 96%)" }}>
            <AlertCircle className="w-5 h-5" style={{ color: "hsl(40 80% 45%)" }} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold" style={{ color: "hsl(220 20% 18%)" }}>Divergência no endereço</h3>
            <p className="text-xs mt-0.5" style={{ color: "hsl(220 10% 50%)" }}>
              O CEP informado localizou um endereço diferente do que está no comprovante. Qual deseja usar?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <button onClick={() => onChoose("cep")} className="text-left p-3 rounded-xl border-2 hover:border-blue-400 transition-colors" style={{ borderColor: "hsl(220 13% 88%)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "hsl(230 80% 56%)" }}>Do CEP (oficial)</div>
            <div className="text-xs leading-relaxed" style={{ color: "hsl(220 20% 25%)" }}>
              <div className="font-semibold">{divergence.cep_address.logradouro}</div>
              <div>{divergence.cep_address.bairro}</div>
              <div>{divergence.cep_address.cidade}/{divergence.cep_address.estado}</div>
            </div>
          </button>
          <button onClick={() => onChoose("doc")} className="text-left p-3 rounded-xl border-2 hover:border-blue-400 transition-colors" style={{ borderColor: "hsl(220 13% 88%)" }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "hsl(152 60% 42%)" }}>Do comprovante</div>
            <div className="text-xs leading-relaxed" style={{ color: "hsl(220 20% 25%)" }}>
              <div className="font-semibold">{divergence.doc_address.logradouro}</div>
              <div>{divergence.doc_address.bairro}</div>
              <div>{divergence.doc_address.cidade}/{divergence.doc_address.estado}</div>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="w-full text-xs font-medium py-2 rounded-lg" style={{ color: "hsl(220 10% 46%)", background: "hsl(220 14% 96%)" }}>
          Decidir depois
        </button>
      </div>
    </div>
  );
}

/* ── Step 1: Dados Pessoais ── */
function Step1({ form, set, errors, onCpfLookup, cpfLooking, cpfFound, autoFilled, isUpdating }: { form: FormData; set: any; errors: any; onCpfLookup?: () => void; cpfLooking?: boolean; cpfFound?: boolean | null; autoFilled?: Set<string>; isUpdating?: boolean }) {
  const hl = (f: string) => autoFilled?.has(f) ? { boxShadow: "0 0 0 2px hsl(152 60% 80%)", background: "hsl(152 60% 99%)" } : undefined;
  return (
    <div>
      <SectionTitle>Dados Pessoais</SectionTitle>
      <SectionDesc>
        {autoFilled && autoFilled.size > 0
          ? "Confira os dados extraídos dos seus documentos. Campos destacados em verde foram preenchidos automaticamente — revise e complete o que faltar."
          : "Informe seus dados de identificação pessoal."}
      </SectionDesc>
      {isUpdating && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-[12px]" style={{ background: "hsl(220 95% 96%)", border: "1px solid hsl(220 80% 80%)", color: "hsl(220 70% 30%)" }}>
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span><strong>Modo atualização:</strong> seus dados serão atualizados no cadastro existente. Revise as informações e complete o que precisa ser alterado.</span>
        </div>
      )}
      {autoFilled && autoFilled.size > 0 && (
        <div className="mb-4 p-2.5 rounded-lg flex items-center gap-2 text-[11px]" style={{ background: "hsl(152 60% 96%)", border: "1px solid hsl(152 40% 80%)", color: "hsl(152 40% 25%)" }}>
          <Sparkles className="w-3.5 h-3.5" />
          <span><strong>{autoFilled.size}</strong> campos preenchidos automaticamente pela IA. Revise antes de continuar.</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!form.selfie_data_url && (
          <SelfieCapture value={form.selfie_data_url} onChange={v => set("selfie_data_url", v)} error={(errors as any).selfie_data_url} />
        )}
        <div className="md:col-span-2">
          <Field label="Nome completo" required error={errors.nome_completo}>
            <TextInput value={form.nome_completo} onChange={v => set("nome_completo", v)} placeholder="Nome completo" />
          </Field>
        </div>
        <Field label="CPF" required error={errors.cpf}>
          <div className="relative">
            <TextInput value={form.cpf} onChange={v => set("cpf", maskCpf(v))} placeholder="000.000.000-00" maxLength={14} onBlur={onCpfLookup} />
            {cpfLooking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(230 80% 56%)" }} />
              </div>
            )}
          </div>
          {cpfFound === true && (
            <p className="flex items-center gap-1 mt-1 text-[11px] font-medium" style={{ color: "hsl(152 60% 42%)" }}>
              <CheckCircle className="w-3 h-3" /> Dados encontrados e preenchidos automaticamente
            </p>
          )}
          {cpfFound === false && (
            <p className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
              CPF não encontrado no cadastro — preencha manualmente
            </p>
          )}
        </Field>
        <Field label="RG">
          <TextInput value={form.rg} onChange={v => set("rg", maskRgInput(v))} placeholder="00.000.000-X" maxLength={14} />
        </Field>
        <Field label="Órgão emissor">
          <TextInput value={form.emissor_rg} onChange={v => set("emissor_rg", v)} placeholder="SSP" />
        </Field>
        <Field label="UF emissor">
          <select
            value={form.uf_emissor_rg}
            onChange={e => set("uf_emissor_rg", e.target.value)}
            className="w-full h-10 px-3 rounded-lg border text-sm uppercase"
            style={{ borderColor: "hsl(220 15% 85%)", color: "hsl(220 20% 18%)", backgroundColor: "white" }}
          >
            <option value="">Selecione</option>
            {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="Data de nascimento">
          <TextInput value={form.data_nascimento} onChange={v => set("data_nascimento", maskDate(v))} placeholder="DD/MM/AAAA" maxLength={10} />
        </Field>
        <Field label="Telefone principal" required error={errors.telefone_principal}>
          <TextInput value={form.telefone_principal} onChange={v => set("telefone_principal", maskPhone(v))} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="Telefone secundário">
          <TextInput value={form.telefone_secundario} onChange={v => set("telefone_secundario", maskPhone(v))} placeholder="(00) 00000-0000" />
        </Field>
        <div className="md:col-span-2">
          <Field label="E-mail" required error={errors.email}>
            <TextInput value={form.email} onChange={v => set("email", v)} placeholder="seu@email.com" type="email" />
          </Field>
        </div>
        <Field label="Nome da mãe">
          <TextInput value={form.nome_mae} onChange={v => set("nome_mae", v)} placeholder="Nome completo da mãe" />
        </Field>
        <Field label="Nome do pai">
          <TextInput value={form.nome_pai} onChange={v => set("nome_pai", v)} placeholder="Nome completo do pai" />
        </Field>
        <Field label="Estado civil">
          <SelectInput value={form.estado_civil} onChange={v => set("estado_civil", v)} options={ESTADOS_CIVIS} />
        </Field>
        <Field label="Nacionalidade">
          <TextInput value={form.nacionalidade} onChange={v => set("nacionalidade", v)} placeholder="Brasileiro(a)" />
        </Field>
        <Field label="Profissão">
          <TextInput value={form.profissao} onChange={v => set("profissao", v)} placeholder="Ex: Advogado, Empresário..." />
        </Field>
        <div className="md:col-span-2">
          <Field label="Observações">
            <textarea
              className={`${inputClass} ${inputFocusRing} h-20 py-2 resize-none uppercase`}
              style={inputStyle}
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value.toUpperCase())}
              placeholder="Informações adicionais (opcional)"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ── Address Block (shared between Step 2 & 3) ── */
function AddressBlock({ prefix, form, set, errors, onCepLookup, cepLoading, onGeocodeLookup, geocodeLoading }: {
  prefix: "end1" | "end2"; form: FormData; set: any; errors: any;
  onCepLookup: () => void; cepLoading: boolean;
  onGeocodeLookup?: () => void; geocodeLoading?: boolean;
}) {
  const f = (field: string) => `${prefix}_${field}` as keyof FormData;
  const lat = form[f("latitude")] as string;
  const lng = form[f("longitude")] as string;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <Field label="CEP">
          <div className="flex gap-2">
            <TextInput
              value={form[f("cep")] as string}
              onChange={v => {
                const masked = maskCep(v);
                set(f("cep"), masked);
                if (masked.replace(/\D/g, "").length === 8) {
                  setTimeout(() => onCepLookup(), 50);
                }
              }}
              placeholder="00000-000"
              maxLength={9}
              onBlur={onCepLookup}
            />
            <button onClick={onCepLookup} disabled={cepLoading}
              className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "hsl(230 80% 96%)", color: "hsl(230 80% 56%)" }}>
              {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </Field>
      </div>
      <div className="md:col-span-2">
        <Field label="Logradouro">
          <TextInput value={form[f("logradouro")] as string} onChange={v => set(f("logradouro"), v)} placeholder="Rua, Avenida, Travessa..." />
        </Field>
      </div>
      <Field label="Número" required error={errors[f("numero")]}>
        <TextInput value={form[f("numero")] as string} onChange={v => set(f("numero"), v)} placeholder="Nº" onBlur={onGeocodeLookup} />
      </Field>
      <Field label="Complemento" required error={errors[f("complemento")]}>
        <TextInput value={form[f("complemento")] as string} onChange={v => set(f("complemento"), v)} placeholder="Casa, Apto, Sala, Bloco..." />
      </Field>
      <Field label="Bairro">
        <TextInput value={form[f("bairro")] as string} onChange={v => set(f("bairro"), v)} placeholder="Bairro" />
      </Field>
      <Field label="Cidade">
        <TextInput value={form[f("cidade")] as string} onChange={v => set(f("cidade"), v)} placeholder="Cidade" />
      </Field>
      <Field label="Estado">
        <SelectInput value={form[f("estado")] as string} onChange={v => set(f("estado"), v)} options={UF_LIST} placeholder="UF" />
      </Field>

      {/* Geolocalização */}
      {(lat || lng || geocodeLoading) && (
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "hsl(152 60% 96%)", border: "1px solid hsl(152 40% 85%)" }}>
            {geocodeLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(152 60% 42%)" }} />
                <span className="text-xs font-medium" style={{ color: "hsl(152 40% 35%)" }}>Buscando geolocalização...</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" style={{ color: "hsl(152 60% 42%)" }} />
                <span className="text-xs font-medium" style={{ color: "hsl(152 40% 25%)" }}>
                  Lat: {lat} &nbsp;|&nbsp; Lng: {lng}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 2: Endereço Residencial ── */
function Step2({ form, set, errors, onCepLookup, cepLoading, showComplementoConfirm, onComplementoConfirmDismiss, onGeocodeLookup, geocodeLoading }: any) {
  return (
    <div>
      <SectionTitle>Endereço Residencial</SectionTitle>
      <SectionDesc>Informe seu endereço residencial. Digite o CEP para preenchimento automático.</SectionDesc>
      <AddressBlock prefix="end1" form={form} set={set} errors={errors} onCepLookup={onCepLookup} cepLoading={cepLoading} onGeocodeLookup={onGeocodeLookup} geocodeLoading={geocodeLoading} />

      {showComplementoConfirm && (
        <div className="mt-4 p-4 rounded-xl border flex items-start gap-3" style={{ background: "hsl(40 90% 96%)", borderColor: "hsl(40 70% 80%)" }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "hsl(40 80% 45%)" }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "hsl(40 50% 25%)" }}>
              Você não informou um complemento (Apto, Bloco, Sala...).
            </p>
            <p className="text-xs mt-0.5" style={{ color: "hsl(40 30% 40%)" }}>
              Deseja continuar sem complemento?
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={onComplementoConfirmDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "hsl(40 70% 85%)", color: "hsl(40 50% 25%)" }}>
                Sim, continuar sem complemento
              </button>
              <button onClick={() => {
                const el = document.querySelector<HTMLInputElement>('[placeholder="APTO, SALA, BLOCO..."]');
                el?.focus();
              }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "hsl(230 80% 56%)", color: "white" }}>
                Adicionar complemento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprovante de endereço */}
      <div className="mt-6 pt-5 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
        <Field label="Possui comprovante de endereço no seu nome?" required error={errors.comprovante_endereco_proprio}>
          <p className="text-[11px] mb-3" style={{ color: "hsl(220 10% 55%)" }}>
            Contas de consumo como água, energia, gás, telefone fixo, internet fixa, TV por assinatura ou IPTU.
          </p>
          <div className="flex gap-3">
            {[
              { value: "sim", label: "Sim, possuo no meu nome" },
              { value: "nao", label: "Não possuo no meu nome" },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("comprovante_endereco_proprio", opt.value)}
                className="flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all"
                style={{
                  background: form.comprovante_endereco_proprio === opt.value
                    ? opt.value === "sim" ? "hsl(152 60% 96%)" : "hsl(40 90% 96%)"
                    : "hsl(0 0% 100%)",
                  borderColor: form.comprovante_endereco_proprio === opt.value
                    ? opt.value === "sim" ? "hsl(152 40% 65%)" : "hsl(40 70% 70%)"
                    : "hsl(220 13% 88%)",
                  color: form.comprovante_endereco_proprio === opt.value
                    ? opt.value === "sim" ? "hsl(152 40% 25%)" : "hsl(40 50% 25%)"
                    : "hsl(220 10% 46%)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {form.comprovante_endereco_proprio === "nao" && (
          <div className="mt-4 p-4 rounded-xl border flex items-start gap-3" style={{ background: "hsl(40 90% 96%)", borderColor: "hsl(40 70% 80%)" }}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "hsl(40 80% 45%)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "hsl(40 50% 25%)" }}>
                Atenção: documentos adicionais serão necessários
              </p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "hsl(40 30% 40%)" }}>
                Após a conclusão deste cadastro, iremos solicitar os documentos da pessoa responsável pelo imóvel (titular das contas de consumo). 
                Essa pessoa deverá assinar um <strong>termo declarando ser a responsável direta pelo imóvel</strong>.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-5 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input type="checkbox" checked={form.tem_segundo_endereco} onChange={e => set("tem_segundo_endereco", e.target.checked)}
              className="sr-only peer" />
            <div className="w-10 h-6 rounded-full peer-checked:bg-blue-500 transition-colors" style={{ background: form.tem_segundo_endereco ? "hsl(230 80% 56%)" : "hsl(220 13% 88%)" }}>
              <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                style={{ transform: form.tem_segundo_endereco ? "translateX(16px)" : "translateX(0)" }} />
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: "hsl(220 20% 25%)" }}>
            Desejo informar um segundo endereço
          </span>
        </label>
      </div>
    </div>
  );
}

/* ── Step 3: Segundo Endereço ── */
function Step3({ form, set, errors, onCepLookup, cepLoading, onGeocodeLookup, geocodeLoading }: any) {
  return (
    <div>
      <SectionTitle>Segundo Endereço</SectionTitle>
      <SectionDesc>Informe um endereço adicional (comercial, correspondência ou outro).</SectionDesc>
      <div className="mb-5">
        <Field label="Tipo do endereço">
          <SelectInput value={form.end2_tipo} onChange={v => set("end2_tipo", v)} options={["Comercial", "Correspondência", "Outro"]} />
        </Field>
      </div>
      <AddressBlock prefix="end2" form={form} set={set} errors={errors} onCepLookup={onCepLookup} cepLoading={cepLoading} onGeocodeLookup={onGeocodeLookup} geocodeLoading={geocodeLoading} />
    </div>
  );
}

/* ── Step 4: Vínculo Profissional ── */
function Step4({ form, set, errors, onCnpjLookup, cnpjLoading, servicos }: any) {
  const vinculos = [
    { value: "proprietario", label: "Sou proprietário / sócio de empresa" },
    { value: "registrado", label: "Trabalho registrado / carteira assinada" },
    { value: "aposentado", label: "Sou aposentado / pensionista" },
    { value: "nenhum", label: "Não possuo vínculo profissional no momento" },
  ];

  const servicoOptions = (servicos || []).map((s: any) => s.nome_servico);

  return (
    <div>
      <SectionTitle>Vínculo Profissional</SectionTitle>
      <SectionDesc>Selecione o serviço desejado e sua situação profissional atual.</SectionDesc>

      {/* Serviço de Interesse */}
      <div className="mb-6">
        <Field label="Serviço de interesse *" error={errors.servico_interesse}>
          <SelectInput value={form.servico_interesse} onChange={v => set("servico_interesse", v)} options={servicoOptions} placeholder="Selecione o serviço" />
        </Field>
      </div>

      <div className="mb-3">
        <span className="text-xs font-medium" style={{ color: "hsl(220 10% 50%)" }}>Situação profissional</span>
        {errors.vinculo_tipo && <span className="text-[11px] ml-2" style={{ color: "hsl(0 72% 51%)" }}>{errors.vinculo_tipo}</span>}
      </div>
      <div className="space-y-2 mb-6">
        {vinculos.map(v => (
          <label key={v.value}
            onClick={() => set("vinculo_tipo", v.value)}
            className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
            style={{
              borderColor: form.vinculo_tipo === v.value ? "hsl(230 80% 56%)" : "hsl(220 13% 91%)",
              background: form.vinculo_tipo === v.value ? "hsl(230 80% 97%)" : "transparent",
            }}>
            <input
              type="radio"
              name="vinculo_tipo"
              value={v.value}
              checked={form.vinculo_tipo === v.value}
              onChange={() => set("vinculo_tipo", v.value)}
              className="sr-only"
            />
            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: form.vinculo_tipo === v.value ? "hsl(230 80% 56%)" : "hsl(220 13% 82%)" }}>
              {form.vinculo_tipo === v.value && (
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(230 80% 56%)" }} />
              )}
            </div>
            <span className="text-sm font-medium" style={{
              color: form.vinculo_tipo === v.value ? "hsl(230 80% 40%)" : "hsl(220 10% 40%)",
            }}>
              {v.label}
            </span>
          </label>
        ))}
      </div>

      {/* Proprietário / Sócio */}
      {(form.vinculo_tipo === "proprietario" || form.vinculo_tipo === "socio") && (
        <div className="space-y-4 p-4 rounded-xl" style={{ background: "hsl(220 20% 97%)", border: "1px solid hsl(220 13% 91%)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="CNPJ">
                <div className="flex gap-2">
                  <TextInput value={form.emp_cnpj} onChange={v => {
                    const masked = maskCnpj(v);
                    set("emp_cnpj", masked);
                    if (masked.replace(/\D/g, "").length === 14) setTimeout(() => onCnpjLookup("emp"), 50);
                  }} placeholder="00.000.000/0000-00" maxLength={18} onBlur={() => onCnpjLookup("emp")} />
                  <button onClick={() => onCnpjLookup("emp")} disabled={cnpjLoading}
                    className="shrink-0 h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ background: "hsl(230 80% 96%)", color: "hsl(230 80% 56%)" }}>
                    {cnpjLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Consultar</span>
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Razão social">
              <TextInput value={form.emp_razao_social} onChange={v => set("emp_razao_social", v)} placeholder="Razão social" />
            </Field>
            <Field label="Nome fantasia">
              <TextInput value={form.emp_nome_fantasia} onChange={v => set("emp_nome_fantasia", v)} placeholder="Nome fantasia" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Endereço da empresa">
                <TextInput value={form.emp_endereco} onChange={v => set("emp_endereco", v)} placeholder="Endereço completo" />
              </Field>
            </div>
            <Field label="Telefone da empresa">
              <TextInput value={form.emp_telefone} onChange={v => set("emp_telefone", maskPhone(v))} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="E-mail da empresa">
              <TextInput value={form.emp_email} onChange={v => set("emp_email", v)} placeholder="email@empresa.com" type="email" />
            </Field>
          </div>
        </div>
      )}

      {/* Registrado */}
      {form.vinculo_tipo === "registrado" && (
        <div className="space-y-4 p-4 rounded-xl" style={{ background: "hsl(220 20% 97%)", border: "1px solid hsl(220 13% 91%)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Dados do Emprego</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="CNPJ da empresa">
                <div className="flex gap-2">
                  <TextInput value={form.trab_cnpj_empresa} onChange={v => {
                    const masked = maskCnpj(v);
                    set("trab_cnpj_empresa", masked);
                    if (masked.replace(/\D/g, "").length === 14) setTimeout(() => onCnpjLookup("trab"), 50);
                  }} placeholder="00.000.000/0000-00" maxLength={18} onBlur={() => onCnpjLookup("trab")} />
                  <button onClick={() => onCnpjLookup("trab")} disabled={cnpjLoading}
                    className="shrink-0 h-10 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ background: "hsl(230 80% 96%)", color: "hsl(230 80% 56%)" }}>
                    {cnpjLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Consultar</span>
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Nome da empresa">
              <TextInput value={form.trab_nome_empresa} onChange={v => set("trab_nome_empresa", v)} placeholder="Nome da empresa" />
            </Field>
            <Field label="Cargo / Função">
              <TextInput value={form.trab_cargo_funcao} onChange={v => set("trab_cargo_funcao", v)} placeholder="Cargo ou função" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Endereço da empresa">
                <TextInput value={form.trab_endereco_empresa} onChange={v => set("trab_endereco_empresa", v)} placeholder="Endereço completo" />
              </Field>
            </div>
            <Field label="Telefone da empresa">
              <TextInput value={form.trab_telefone_empresa} onChange={v => set("trab_telefone_empresa", maskPhone(v))} placeholder="(00) 00000-0000" />
            </Field>
          </div>
        </div>
      )}

    </div>
  );
}

/* ── Step 5: Consentimento ── */
function Step5({ form, set, errors }: any) {
  return (
    <div>
      <SectionTitle>Consentimento e Anuência</SectionTitle>
      <SectionDesc>Revise e confirme a veracidade das informações prestadas.</SectionDesc>

      {/* Summary */}
      <div className="p-4 rounded-xl mb-6" style={{ background: "hsl(220 20% 97%)", border: "1px solid hsl(220 13% 91%)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "hsl(220 20% 18%)" }}>Resumo dos Dados</h3>

        {/* Foto / Selfie */}
        {form.selfie_data_url && (
          <div className="mb-4 flex items-center gap-3">
            <img
              src={form.selfie_data_url}
              alt="Selfie"
              className="w-20 h-20 rounded-full object-cover border-2"
              style={{ borderColor: "hsl(220 13% 85%)" }}
            />
            <div>
              <div className="text-[11px] font-medium" style={{ color: "hsl(220 10% 50%)" }}>Foto capturada</div>
              <div className="text-xs" style={{ color: "hsl(220 20% 25%)" }}>Será enviada no cadastro</div>
            </div>
          </div>
        )}

        {/* Dados Pessoais */}
        <SummarySection title="Dados Pessoais">
          <SummaryItem label="Nome" value={form.nome_completo} />
          <SummaryItem label="CPF" value={form.cpf} />
          <SummaryItem label="RG" value={form.rg} />
          <SummaryItem label="Emissor RG" value={form.emissor_rg} />
          <SummaryItem label="Nascimento" value={form.data_nascimento} />
          <SummaryItem label="E-mail" value={form.email} />
          <SummaryItem label="Telefone" value={form.telefone_principal} />
          <SummaryItem label="Tel. secundário" value={form.telefone_secundario} />
          <SummaryItem label="Nome da mãe" value={form.nome_mae} />
          <SummaryItem label="Nome do pai" value={form.nome_pai} />
          <SummaryItem label="Estado civil" value={form.estado_civil} />
          <SummaryItem label="Nacionalidade" value={form.nacionalidade} />
          <SummaryItem label="Profissão" value={form.profissao} />
        </SummarySection>

        {/* Endereço Principal */}
        {(form.end1_cep || form.end1_logradouro || form.end1_cidade) && (
          <SummarySection title="Endereço Principal">
            <SummaryItem label="CEP" value={form.end1_cep} />
            <SummaryItem label="Logradouro" value={form.end1_logradouro} />
            <SummaryItem label="Número" value={form.end1_numero} />
            <SummaryItem label="Complemento" value={form.end1_complemento} />
            <SummaryItem label="Bairro" value={form.end1_bairro} />
            <SummaryItem
              label="Cidade/UF"
              value={form.end1_cidade ? `${form.end1_cidade}${form.end1_estado ? "/" + form.end1_estado : ""}` : ""}
            />
            <SummaryItem
              label="Geolocalização"
              value={form.end1_latitude && form.end1_longitude ? `${form.end1_latitude}, ${form.end1_longitude}` : ""}
            />
          </SummarySection>
        )}

        {/* Endereço Secundário */}
        {form.tem_segundo_endereco && (form.end2_cep || form.end2_logradouro || form.end2_cidade) && (
          <SummarySection title="Endereço Secundário">
            <SummaryItem label="Tipo" value={form.end2_tipo} />
            <SummaryItem label="CEP" value={form.end2_cep} />
            <SummaryItem label="Logradouro" value={form.end2_logradouro} />
            <SummaryItem label="Número" value={form.end2_numero} />
            <SummaryItem label="Complemento" value={form.end2_complemento} />
            <SummaryItem label="Bairro" value={form.end2_bairro} />
            <SummaryItem
              label="Cidade/UF"
              value={form.end2_cidade ? `${form.end2_cidade}${form.end2_estado ? "/" + form.end2_estado : ""}` : ""}
            />
          </SummarySection>
        )}

        {/* Vínculo / Empresa */}
        {form.vinculo_tipo && (
          <SummarySection title="Vínculo Profissional">
            <SummaryItem label="Tipo de vínculo" value={form.vinculo_tipo.replace(/_/g, " ")} />

            {/* Empresa (sócio/proprietário) */}
            <SummaryItem label="CNPJ (empresa)" value={form.emp_cnpj} />
            <SummaryItem label="Razão social" value={form.emp_razao_social} />
            <SummaryItem label="Nome fantasia" value={form.emp_nome_fantasia} />
            <SummaryItem label="Situação cadastral" value={form.emp_situacao_cadastral} />
            <SummaryItem label="Data de abertura" value={form.emp_data_abertura} />
            <SummaryItem label="CNAE principal" value={form.emp_cnae_principal} />
            <SummaryItem label="Natureza jurídica" value={form.emp_natureza_juridica} />
            <SummaryItem label="Endereço (empresa)" value={form.emp_endereco} />
            <SummaryItem label="Telefone (empresa)" value={form.emp_telefone} />
            <SummaryItem label="E-mail (empresa)" value={form.emp_email} />
            <SummaryItem label="Cargo/Função" value={form.emp_cargo_funcao} />
            <SummaryItem label="Participação societária" value={form.emp_participacao_societaria} />

            {/* Trabalho registrado */}
            <SummaryItem label="Empresa (CLT)" value={form.trab_nome_empresa} />
            <SummaryItem label="CNPJ (CLT)" value={form.trab_cnpj_empresa} />
            <SummaryItem label="Cargo (CLT)" value={form.trab_cargo_funcao} />
            <SummaryItem label="Admissão" value={form.trab_data_admissao} />
            <SummaryItem label="Faixa salarial" value={form.trab_faixa_salarial} />
            <SummaryItem label="Endereço (CLT)" value={form.trab_endereco_empresa} />
            <SummaryItem label="Telefone (CLT)" value={form.trab_telefone_empresa} />

            {/* Autônomo */}
            <SummaryItem label="Atividade (autônomo)" value={form.aut_atividade} />
            <SummaryItem label="Nome profissional" value={form.aut_nome_profissional} />
            <SummaryItem label="CNPJ (autônomo)" value={form.aut_cnpj} />
            <SummaryItem label="Telefone (autônomo)" value={form.aut_telefone} />
            <SummaryItem label="Endereço (autônomo)" value={form.aut_endereco} />
          </SummarySection>
        )}

        {/* Serviço e observações */}
        {(form.servico_interesse || form.observacoes) && (
          <SummarySection title="Serviço e Observações">
            <SummaryItem label="Serviço de interesse" value={form.servico_interesse} />
            <SummaryItem label="Observações" value={form.observacoes} />
          </SummarySection>
        )}
      </div>

      {/* Consent text */}
      <div className="p-4 rounded-xl mb-6" style={{ background: "hsl(230 80% 97%)", border: "1px solid hsl(230 80% 90%)" }}>
        <p className="text-[13px] leading-relaxed" style={{ color: "hsl(220 20% 25%)" }}>
          "Declaro que as informações prestadas são verdadeiras, completas e de minha responsabilidade,
          e autorizo seu uso para fins de cadastro, validação, análise e continuidade do atendimento,
          nos termos aplicáveis de privacidade e proteção de dados."
        </p>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input type="checkbox" checked={form.consentimento_dados_verdadeiros}
            onChange={e => set("consentimento_dados_verdadeiros", e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300" />
          <span className="text-sm" style={{ color: "hsl(220 20% 25%)" }}>
            Confirmo que os dados informados são verdadeiros e de minha responsabilidade.
            {errors.consentimento_dados_verdadeiros && (
              <span className="block text-[11px] mt-0.5" style={{ color: "hsl(0 72% 51%)" }}>
                <AlertCircle className="w-3 h-3 inline mr-0.5" /> Este campo é obrigatório
              </span>
            )}
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input type="checkbox" checked={form.consentimento_tratamento_dados}
            onChange={e => set("consentimento_tratamento_dados", e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300" />
          <span className="text-sm" style={{ color: "hsl(220 20% 25%)" }}>
            Autorizo o tratamento dos meus dados pessoais para fins de cadastro, análise e prestação de serviço,
            conforme a Lei Geral de Proteção de Dados (LGPD).
            {errors.consentimento_tratamento_dados && (
              <span className="block text-[11px] mt-0.5" style={{ color: "hsl(0 72% 51%)" }}>
                <AlertCircle className="w-3 h-3 inline mr-0.5" /> Este campo é obrigatório
              </span>
            )}
          </span>
        </label>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1">
      <span className="font-medium whitespace-nowrap" style={{ color: "hsl(220 10% 50%)" }}>{label}:</span>
      <span className="break-words" style={{ color: "hsl(220 20% 18%)" }}>{value}</span>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div
        className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 pb-1 border-b"
        style={{ color: "hsl(220 20% 30%)", borderColor: "hsl(220 13% 88%)" }}
      >
        {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {children}
      </div>
    </div>
  );
}
