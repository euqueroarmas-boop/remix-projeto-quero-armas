import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Save, User, Users, MapPin, Home, Settings, Camera, X, Shield, AlertTriangle, Crosshair, Phone, Activity, FileBadge, CheckCircle2, Stethoscope, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrivateStorageUrl } from "@/hooks/usePrivateStorageUrl";
import { CATEGORIAS, CATEGORIA_OPTIONS, CATEGORIA_MAP, type CategoriaTitular } from "./categoriaTitular";
import {
  isValidCpf,
  isValidEmail,
  isValidTelefone,
  rgNotEqualCpf,
  cinEqualsCpf,
} from "@/shared/quero-armas/clienteSchema";
import { SenhaGovField } from "./SenhaGovField";
import ClienteAIPrefill, { type PrefillFields } from "./ClienteAIPrefill";
import { setSenhaGov } from "./senhaGovApi";

interface ClienteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cliente?: any;
}

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União Estável"];
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RS","SC","SE","SP","TO"];
const SEXO_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "Outro", label: "Outro" },
];

const estadoCivilOptions = ESTADOS_CIVIS.map(e => ({ value: e, label: e }));
const ufOptions = UFS.map(u => ({ value: u, label: u }));
const statusOptions = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "DESISTENTE", label: "Desistente" },
];

const formatDateForDisplay = (value: string) => {
  if (!value) return "";
  const isoDate = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
};

const normalizeDateInput = (value: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateForDisplay(value);
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const formatDateForDatabase = (value: string): string | null => {
  // Postgres `date` columns rejeitam string vazia. Sempre devolvemos null
  // quando o campo está vazio ou parcialmente preenchido.
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

/* ── Reusable Field Components ── */
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn("space-y-1.5", span && "col-span-full")}>
      <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-400 transition-all uppercase";
const selectClass = "w-full h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-400 transition-all appearance-none cursor-pointer";

function FInput({ label, value, onChange, onBlur, placeholder, inputMode, maxLength, span, disabled }: {
  label: string; value: string; onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number; span?: boolean; disabled?: boolean;
}) {
  return (
    <Field label={label} span={span}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        className={cn(inputClass, disabled && "opacity-50 cursor-not-allowed")}
      />
    </Field>
  );
}

function FSelect({ label, value, onChange, options, placeholder = "Selecionar...", error }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; error?: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} className={cn(selectClass, error && "border-red-500 ring-1 ring-red-500")}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-[10px] text-red-600 mt-1 uppercase">{error}</p>}
    </Field>
  );
}

export default function ClienteFormModal({ open, onClose, onSaved, cliente }: ClienteFormModalProps) {
  const isEdit = !!cliente;
  const existingPhotoUrl = usePrivateStorageUrl("qa-documentos", cliente?.imagem || null);
  const [saving, setSaving] = useState(false);
  const { lookupCep, cepLoading, lookupGeocode, geocodeLoading } = useBrasilApiLookup();

  // Photo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [requiredErrors, setRequiredErrors] = useState<{ photo?: boolean; sexo?: boolean; estado_civil?: boolean }>({});

  // Senha Gov.br (cifrada via edge function `qa-senha-gov`)
  const [cadastroCrId, setCadastroCrId] = useState<number | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (clienteId: number): Promise<string | null> => {
    if (!photoFile) return null;
    setUploadingPhoto(true);
    try {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `clientes/fotos/${clienteId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("qa-documentos").upload(path, photoFile, { upsert: true });
      if (error) throw error;
      return path;
    } catch (e: any) {
      console.error("Photo upload error:", e);
      toast.error("Erro ao enviar foto");
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCepBlur = useCallback(async (cepValue: string, prefix: "" | "2") => {
    const result = await lookupCep(cepValue);
    if (result) {
      setF(prev => ({
        ...prev,
        [`endereco${prefix}`]: result.street || prev[`endereco${prefix}` as keyof typeof prev] || "",
        [`bairro${prefix}`]: result.neighborhood || prev[`bairro${prefix}` as keyof typeof prev] || "",
        [`cidade${prefix}`]: result.city || prev[`cidade${prefix}` as keyof typeof prev] || "",
        [`estado${prefix}`]: result.state || prev[`estado${prefix}` as keyof typeof prev] || "",
      }));
    }
  }, [lookupCep]);

  // Máscara visual de CEP — sempre formata como "XX.XXX-XXX".
  // Aceita qualquer entrada (com ou sem pontuação) e devolve a forma padronizada.
  const formatCepMask = (raw: string): string => {
    const d = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
  };

  const resolveGeoloc = useCallback(async (prefix: "" | "2") => {
    setF(prev => {
      // lê valores atuais e dispara fora do setter
      const street = (prev as any)[`endereco${prefix}`];
      const number = (prev as any)[`numero${prefix}`];
      const city = (prev as any)[`cidade${prefix}`];
      const state = (prev as any)[`estado${prefix}`];
      if (!street || !city) return prev;
      lookupGeocode({ street, number, city, state }).then((g) => {
        if (!g) return;
        const value = `${g.latitude},${g.longitude}`;
        setF((p2) => ({
          ...p2,
          [`geolocalizacao${prefix}`]: value,
        }));
      }).catch(() => {});
      return prev;
    });
  }, [lookupGeocode]);

  // Auto-resolve geolocation directly from passed values (sem depender do state).
  const autoResolveGeoloc = useCallback(async (
    prefix: "" | "2",
    addr: { street?: string; number?: string; city?: string; state?: string }
  ) => {
    if (!addr.street || !addr.city) return;
    try {
      const g = await lookupGeocode({
        street: addr.street,
        number: addr.number || "",
        city: addr.city,
        state: addr.state || "",
      });
      if (!g) return;
      const value = `${g.latitude},${g.longitude}`;
      setF((p2) => ({ ...p2, [`geolocalizacao${prefix}`]: value }));
    } catch { /* silencioso */ }
  }, [lookupGeocode]);

  const [f, setF] = useState({
    nome_completo: "", cpf: "", rg: "", emissor_rg: "", expedicao_rg: "",
    data_nascimento: "", naturalidade: "", nacionalidade: "Brasileira",
    nome_mae: "", nome_pai: "", estado_civil: "", profissao: "", escolaridade: "",
    email: "", celular: "", titulo_eleitor: "",
    endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", pais: "Brasil",
    endereco2: "", numero2: "", complemento2: "", bairro2: "", cep2: "", cidade2: "", estado2: "", pais2: "",
    geolocalizacao: "", geolocalizacao2: "",
    observacao: "", status: "ATIVO",
    // Categorização legal (Lei 10.826/03 art. 6º)
    categoria_titular: "" as CategoriaTitular | "",
    subcategoria: "",
    orgao_vinculado: "",
    matricula_funcional: "",
    // ── Entrega B (sincronizado com clienteSchema) ──
    sexo: "",
    // Tipo do documento de identidade — RG ou CIN.
    // CIN substitui o RG e usa o MESMO número do CPF (legalmente permitido).
    tipo_documento_identidade: "RG" as "RG" | "CIN",
    naturalidade_municipio: "",
    naturalidade_uf: "",
    naturalidade_pais: "Brasil",
    cnh: "",
    ctps: "",
    // Datas de realização dos exames (colunas legadas em qa_cadastro_cr)
    validade_laudo_psicologico: "",
    validade_exame_tiro: "",
    senha_gov: "",
  });

  useEffect(() => {
    if (!open) { setPhotoFile(null); setPhotoPreview(null); return; }
    if (cliente) {
      setF({
        nome_completo: cliente.nome_completo || "", cpf: cliente.cpf || "",
        rg: cliente.rg || "", emissor_rg: cliente.emissor_rg || "",
        expedicao_rg: formatDateForDisplay(cliente.expedicao_rg || ""),
        data_nascimento: formatDateForDisplay(cliente.data_nascimento || ""),
        naturalidade: cliente.naturalidade || "", nacionalidade: cliente.nacionalidade || "Brasileira",
        nome_mae: cliente.nome_mae || "", nome_pai: cliente.nome_pai || "",
        estado_civil: cliente.estado_civil || "", profissao: cliente.profissao || "",
        escolaridade: cliente.escolaridade || "",
        email: cliente.email || "", celular: cliente.celular || "",
        titulo_eleitor: cliente.titulo_eleitor || "",
        endereco: cliente.endereco || "", numero: cliente.numero || "",
        complemento: cliente.complemento || "", bairro: cliente.bairro || "",
        cep: formatCepMask(cliente.cep || ""),
        cidade: cliente.cidade || "", estado: cliente.estado || "",
        pais: cliente.pais || "Brasil",
        endereco2: cliente.endereco2 || "", numero2: cliente.numero2 || "",
        complemento2: cliente.complemento2 || "", bairro2: cliente.bairro2 || "",
        cep2: formatCepMask(cliente.cep2 || ""), cidade2: cliente.cidade2 || "", estado2: cliente.estado2 || "",
        pais2: cliente.pais2 || "",
        geolocalizacao: cliente.geolocalizacao || "",
        geolocalizacao2: cliente.geolocalizacao2 || "",
        observacao: cliente.observacao || "", status: cliente.status || "ATIVO",
        categoria_titular: (cliente.categoria_titular || "") as CategoriaTitular | "",
        subcategoria: cliente.subcategoria || "",
        orgao_vinculado: cliente.orgao_vinculado || "",
        matricula_funcional: cliente.matricula_funcional || "",
        sexo: cliente.sexo || "",
        tipo_documento_identidade: ((cliente.tipo_documento_identidade as "RG" | "CIN") || "RG"),
        naturalidade_municipio: cliente.naturalidade_municipio || "",
        naturalidade_uf: cliente.naturalidade_uf || "",
        naturalidade_pais: cliente.naturalidade_pais || "Brasil",
        cnh: cliente.cnh || "",
        ctps: cliente.ctps || "",
        validade_laudo_psicologico: "",
        validade_exame_tiro: "",
        senha_gov: "",
      });
      // Load existing photo preview
      if (cliente.imagem) {
        setPhotoPreview(existingPhotoUrl || null);
      } else {
        setPhotoPreview(null);
      }
      // Pós-P0: NÃO pré-carrega senha GOV. Apenas resolve o cadastro_cr_id
      // (filtrando duplicatas consolidadas) para o componente SenhaGovField.
      (async () => {
        try {
          const { data: row } = await supabase
            .from("qa_cadastro_cr" as any)
            .select("id, validade_laudo_psicologico, validade_exame_tiro")
            .eq("cliente_id", cliente.id)
            .is("consolidado_em", null)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();
          setCadastroCrId((row as any)?.id ?? null);
          if (row) {
            setF(prev => ({
              ...prev,
              validade_laudo_psicologico: formatDateForDisplay((row as any).validade_laudo_psicologico || ""),
              validade_exame_tiro: formatDateForDisplay((row as any).validade_exame_tiro || ""),
            }));
          }
        } catch {
          setCadastroCrId(null);
        }
        // estado de senha não é mais mantido aqui; SenhaGovField gerencia tudo.
      })();
    } else {
      setF(prev => ({
        ...prev,
        nome_completo: "", cpf: "", rg: "", email: "", celular: "",
        validade_laudo_psicologico: "", validade_exame_tiro: "", senha_gov: "",
      }));
      setPhotoPreview(null);
      setCadastroCrId(null);
    }
  }, [cliente, existingPhotoUrl, open]);

  const set = (key: string, val: any) => setF(prev => ({ ...prev, [key]: val }));

  // Aplica os dados extraídos pela IA no formulário existente, sem destruir
  // valores já preenchidos manualmente. Dispara CEP lookup quando aplicável,
  // e adiciona warnings/acervo nas observações para revisão humana.
  const applyAIPrefill = useCallback(async (p: PrefillFields) => {
    const onlyDigits = (s: any) => String(s ?? "").replace(/\D/g, "");
    const setIfEmpty = (cur: string, next: any) =>
      cur && cur.trim() ? cur : (next == null ? cur : String(next));

    // Detecta divergência de endereço (CEP vs endereço extraído)
    let addressDivergence: string | null = null;
    let extractedCep = onlyDigits(p.cep);
    const extractedCep2 = onlyDigits((p as any).cep_secundario);

    setF(prev => {
      const cinDetected = String(p.tipo_documento_identidade || "").toUpperCase() === "CIN";
      const cpfDigits = onlyDigits(p.cpf);
      const rgValue = String(p.rg ?? "");
      return {
        ...prev,
        nome_completo: setIfEmpty(prev.nome_completo, p.nome_completo),
        cpf: setIfEmpty(prev.cpf, cpfDigits),
        tipo_documento_identidade: cinDetected ? "CIN" : prev.tipo_documento_identidade,
        rg: setIfEmpty(prev.rg, rgValue),
        emissor_rg: setIfEmpty(prev.emissor_rg, p.emissor_rg),
        expedicao_rg: setIfEmpty(prev.expedicao_rg, p.data_expedicao_rg),
        data_nascimento: setIfEmpty(prev.data_nascimento, p.data_nascimento),
        sexo: setIfEmpty(prev.sexo, p.sexo),
        nome_mae: setIfEmpty(prev.nome_mae, p.nome_mae),
        nome_pai: setIfEmpty(prev.nome_pai, p.nome_pai),
        nacionalidade: setIfEmpty(prev.nacionalidade, p.nacionalidade) || prev.nacionalidade,
        estado_civil: setIfEmpty(prev.estado_civil, p.estado_civil),
        profissao: setIfEmpty(prev.profissao, p.profissao),
        escolaridade: setIfEmpty(prev.escolaridade, p.escolaridade),
        naturalidade_municipio: setIfEmpty(prev.naturalidade_municipio, p.naturalidade_municipio),
        naturalidade_uf: setIfEmpty(prev.naturalidade_uf, p.naturalidade_uf),
        naturalidade_pais: setIfEmpty(prev.naturalidade_pais, p.naturalidade_pais) || prev.naturalidade_pais,
        titulo_eleitor: setIfEmpty(prev.titulo_eleitor, p.titulo_eleitor),
        cnh: setIfEmpty(prev.cnh, p.cnh),
        ctps: setIfEmpty(prev.ctps, p.ctps),
        celular: setIfEmpty(prev.celular, p.celular ? onlyDigits(p.celular) : ""),
        email: setIfEmpty(prev.email, p.email),
        cep: setIfEmpty(prev.cep, extractedCep ? formatCepMask(extractedCep) : ""),
        endereco: setIfEmpty(prev.endereco, p.endereco),
        numero: setIfEmpty(prev.numero, p.numero),
        complemento: setIfEmpty(prev.complemento, p.complemento),
        bairro: setIfEmpty(prev.bairro, p.bairro),
        cidade: setIfEmpty(prev.cidade, p.cidade),
        estado: setIfEmpty(prev.estado, p.estado),
        pais: setIfEmpty(prev.pais, p.pais) || prev.pais,
        cep2: setIfEmpty(prev.cep2, extractedCep2 ? formatCepMask(extractedCep2) : ""),
        endereco2: setIfEmpty(prev.endereco2, (p as any).endereco_secundario),
        numero2: setIfEmpty(prev.numero2, (p as any).numero_secundario),
        complemento2: setIfEmpty(prev.complemento2, (p as any).complemento_secundario),
        bairro2: setIfEmpty(prev.bairro2, (p as any).bairro_secundario),
        cidade2: setIfEmpty(prev.cidade2, (p as any).cidade_secundario),
        estado2: setIfEmpty(prev.estado2, (p as any).estado_secundario),
        pais2: setIfEmpty(prev.pais2, (p as any).pais_secundario),
        validade_laudo_psicologico: setIfEmpty(prev.validade_laudo_psicologico, (p as any).data_realizacao_exame_psicologico ?? (p as any).validade_laudo_psicologico),
        validade_exame_tiro: setIfEmpty(prev.validade_exame_tiro, (p as any).data_realizacao_exame_tiro ?? (p as any).validade_exame_tiro),
        senha_gov: setIfEmpty(prev.senha_gov, (p as any).senha_gov),
        observacao: [
          prev.observacao,
          Array.isArray(p.warnings) && p.warnings.length
            ? `\n\n⚠️ AVISOS DA IA:\n- ${p.warnings.join("\n- ")}`
            : "",
          Array.isArray(p.acervo) && p.acervo.length
            ? `\n\n📦 ACERVO IDENTIFICADO PELA IA:\n${p.acervo.map((a: any, i: number) =>
                `${i + 1}. ${[a.tipo_documento, a.arma_marca, a.arma_modelo, a.arma_calibre, a.arma_numero_serie]
                  .filter(Boolean).join(" · ")}`).join("\n")}`
            : "",
          p.observacoes ? `\n\n📝 ${p.observacoes}` : "",
        ].filter(Boolean).join("").trim(),
      };
    });

    // CEP lookup automático + geocode encadeado (principal)
    if (extractedCep && extractedCep.length === 8) {
      try {
        const result = await lookupCep(extractedCep);
        if (result) {
          const cepCity = (result.city || "").trim().toLowerCase();
          const aiCity = String(p.cidade || "").trim().toLowerCase();
          if (cepCity && aiCity && cepCity !== aiCity) {
            addressDivergence = `Cidade do CEP (${result.city}) difere da cidade extraída (${p.cidade}).`;
          }
          const street1 = String(p.endereco || result.street || "");
          const number1 = String(p.numero || "");
          const city1 = String(p.cidade || result.city || "");
          const state1 = String(p.estado || result.state || "");
          setF(prev => ({
            ...prev,
            endereco: prev.endereco || result.street || "",
            bairro: prev.bairro || result.neighborhood || "",
            cidade: prev.cidade || result.city || "",
            estado: prev.estado || result.state || "",
          }));
          // Geocode imediato com valores garantidos
          autoResolveGeoloc("", { street: street1, number: number1, city: city1, state: state1 });
        }
      } catch { /* lookup falha silenciosa — usuário revê manualmente */ }
    }

    // CEP lookup automático + geocode encadeado (secundário)
    if (extractedCep2 && extractedCep2.length === 8) {
      try {
        const result2 = await lookupCep(extractedCep2);
        if (result2) {
          const street2 = String((p as any).endereco_secundario || result2.street || "");
          const number2 = String((p as any).numero_secundario || "");
          const city2 = String((p as any).cidade_secundario || result2.city || "");
          const state2 = String((p as any).estado_secundario || result2.state || "");
          setF(prev => ({
            ...prev,
            endereco2: prev.endereco2 || result2.street || "",
            bairro2: prev.bairro2 || result2.neighborhood || "",
            cidade2: prev.cidade2 || result2.city || "",
            estado2: prev.estado2 || result2.state || "",
          }));
          autoResolveGeoloc("2", { street: street2, number: number2, city: city2, state: state2 });
        }
      } catch { /* silencioso */ }
    }

    if (addressDivergence) {
      toast.warning("Divergência de endereço detectada — revise.");
      setF(prev => ({
        ...prev,
        observacao: `${prev.observacao}\n\n⚠️ ${addressDivergence}`.trim(),
      }));
    }

    // Fallback: caso o CEP não tenha sido extraído mas o endereço sim,
    // ainda tenta geocodar a partir dos campos já preenchidos pela IA.
    setTimeout(() => {
      setF(curr => {
        if (!curr.geolocalizacao && curr.endereco && curr.cidade) {
          autoResolveGeoloc("", { street: curr.endereco, number: curr.numero, city: curr.cidade, state: curr.estado });
        }
        if (!curr.geolocalizacao2 && curr.endereco2 && curr.cidade2) {
          autoResolveGeoloc("2", { street: curr.endereco2, number: curr.numero2, city: curr.cidade2, state: curr.estado2 });
        }
        return curr;
      });
    }, 1500);
  }, [lookupCep, autoResolveGeoloc]);

  const save = async () => {
    if (!f.nome_completo.trim()) { toast.error("Nome completo é obrigatório"); return; }
    if (!isEdit) {
      const errs = { photo: !photoFile, sexo: !f.sexo, estado_civil: !f.estado_civil };
      if (errs.photo || errs.sexo || errs.estado_civil) {
        setRequiredErrors(errs);
        const missing: string[] = [];
        if (errs.photo) missing.push("foto");
        if (errs.sexo) missing.push("sexo");
        if (errs.estado_civil) missing.push("estado civil");
        toast.error(`Campos obrigatórios: ${missing.join(", ")}`);
        return;
      }
      setRequiredErrors({});
    }
    // ── Validação compartilhada (clienteSchema) ──
    if (f.cpf && !isValidCpf(f.cpf)) { toast.error("CPF inválido"); return; }
    if (f.email && !isValidEmail(f.email)) { toast.error("E-mail inválido"); return; }
    if (f.celular && !isValidTelefone(f.celular)) { toast.error("Telefone inválido"); return; }
    // CIN substitui o RG e PODE ter o mesmo número do CPF (legal).
    // Só bloqueia quando o tipo é RG tradicional.
    if (f.tipo_documento_identidade !== "CIN" && !rgNotEqualCpf(f.rg, f.cpf)) {
      toast.error("RG não pode ser igual ao CPF — se for CIN, mude o tipo de documento para 'CIN'");
      return;
    }
    if (f.tipo_documento_identidade === "CIN" && !cinEqualsCpf(f.rg, f.cpf)) {
      toast.error("CIN deve usar o mesmo número do CPF (mesmos dígitos)");
      return;
    }
    setSaving(true);
    try {
      // Separa campos que pertencem ao CR/credenciais do payload do cliente
      const { validade_laudo_psicologico, validade_exame_tiro, senha_gov, ...clienteFields } = f;
      const payload: any = {
        ...clienteFields,
        numero_documento_identidade: f.rg || null,
        expedicao_rg: formatDateForDatabase(f.expedicao_rg),
        data_nascimento: formatDateForDatabase(f.data_nascimento),
      };
      // Hardening: Postgres rejeita string vazia em colunas date/timestamp/numeric.
      // Convertemos QUALQUER "" → null para evitar regressão se novos campos forem
      // adicionados ao formulário no futuro. Booleans e zeros são preservados.
      for (const k of Object.keys(payload)) {
        if (payload[k] === "") payload[k] = null;
      }
      let savedId: number | null = null;
      if (isEdit) {
        // Upload photo if new file selected
        if (photoFile) {
          const path = await uploadPhoto(cliente.id);
          if (path) payload.imagem = path;
        }
        const { error } = await supabase.from("qa_clientes" as any).update(payload).eq("id", cliente.id);
        if (error) throw error;
        savedId = cliente.id;
        toast.success("Cliente atualizado");
      } else {
        const { data, error } = await supabase.from("qa_clientes" as any).insert(payload).select("id").single();
        if (error) throw error;
        savedId = (data as any)?.id;
        // Upload photo after insert (need the ID)
        if (photoFile && savedId) {
          const path = await uploadPhoto(savedId);
          if (path) {
            await supabase.from("qa_clientes" as any).update({ imagem: path }).eq("id", savedId);
          }
        }
        toast.success("Cliente cadastrado");
      }
      // Persiste datas de realização dos exames em qa_cadastro_cr (cria stub se necessário)
      let persistedCrId = cadastroCrId;
      if (savedId && (validade_laudo_psicologico || validade_exame_tiro)) {
        try {
          let crId = persistedCrId;
          if (!crId) {
            const { data: stub } = await supabase
              .from("qa_cadastro_cr" as any)
              .insert({ cliente_id: savedId })
              .select("id")
              .single();
            crId = (stub as any)?.id ?? null;
          }
          if (crId) {
            persistedCrId = crId;
            await supabase.from("qa_cadastro_cr" as any).update({
              validade_laudo_psicologico: formatDateForDatabase(validade_laudo_psicologico),
              validade_exame_tiro: formatDateForDatabase(validade_exame_tiro),
            }).eq("id", crId);
          }
        } catch (e: any) {
          console.error("Falha ao salvar exames:", e);
          toast.warning("Cliente salvo, mas datas de exames não foram persistidas");
        }
      }
      if (savedId && senha_gov.trim()) {
        try {
          await setSenhaGov(persistedCrId ?? null, senha_gov.trim(), "ClienteFormModal:IA", savedId);
        } catch (e: any) {
          console.error("Falha ao salvar senha GOV importada:", e);
          toast.warning("Cliente salvo, mas Senha GOV importada não foi persistida");
        }
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[98vw] max-w-6xl max-h-[94dvh] overflow-hidden p-0 bg-[#fafaf9] border border-zinc-200 text-zinc-800 qa-premium gap-0">

        {/* DialogHeader é obrigatório para acessibilidade — invisível visualmente */}
        <DialogHeader className="sr-only">
          <DialogTitle>{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>Cadastro completo do titular em formulário único.</DialogDescription>
        </DialogHeader>

        {/* ── Body com layout de Dashboard (igual à tela do cliente) ── */}
        <div className="px-5 sm:px-7 py-5 overflow-y-auto bg-[#fafaf9]" style={{ maxHeight: "calc(94vh - 80px)" }}>
          <div className="space-y-5">
            {/* ── Header Card (espelha o card de identificação do cliente) ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-100" />
              <div className="relative flex items-center gap-4 flex-wrap">
                {/* Avatar / foto */}
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-20 w-20 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 bg-zinc-50 flex items-center justify-center overflow-hidden transition-colors"
                    aria-label="Adicionar foto"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Foto" className="w-full h-full object-contain bg-zinc-100" />
                    ) : (
                      <Camera className="h-7 w-7 text-zinc-400" />
                    )}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </div>

                {/* Identidade do cliente */}
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border",
                      isEdit
                        ? "bg-zinc-50 border-zinc-200 text-zinc-600"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600"
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", isEdit ? "bg-emerald-500" : "bg-[#7A1F2B]")} />
                      {isEdit ? "Editando" : "Em cadastro"}
                    </span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      ID {isEdit && cliente?.id ? `#${String(cliente.id).padStart(4, "0")}` : "#----"}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 uppercase mt-1 break-words">
                    {f.nome_completo || (isEdit ? "Cliente" : "NOVO CLIENTE")}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mt-0.5">
                    CPF {f.cpf || "—"}
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-3.5 rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[#7A1F2B] hover:bg-[#641722] text-white text-xs font-semibold uppercase tracking-wide justify-center disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
                  </button>
                </div>
              </div>

              {/* KPIs (espelha a tira de KPIs do dashboard do cliente) */}
              <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiCard icon={User} label="Identificação" value={kpiIdent(f)} tone={kpiTone(kpiIdent(f))} />
                <KpiCard icon={Phone} label="Contato" value={kpiContato(f)} tone={kpiTone(kpiContato(f))} />
                <KpiCard icon={MapPin} label="Endereço" value={kpiEndereco(f)} tone={kpiTone(kpiEndereco(f))} />
                <KpiCard icon={Shield} label="Categoria" value={f.categoria_titular ? "OK" : "Pendente"} tone={f.categoria_titular ? "ok" : "warn"} />
                <KpiCard icon={FileBadge} label="Status" value={isEdit ? "Edição" : "Novo"} tone={isEdit ? "ok" : "info"} />
              </div>
            </section>

            {/* IA — bloco destacado, mesmo padrão dos cards */}
            {!isEdit && (
              <section className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm overflow-hidden">
                <SectionTitle icon={Activity} label="Preencher com IA" />
                <div className="mt-3">
                  <ClienteAIPrefill onApply={applyAIPrefill} />
                </div>
              </section>
            )}

            <div className="space-y-5">
            {/* ── Bloco: Identificação ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <SectionTitle icon={User} label="Identificação" />
              {uploadingPhoto && <p className="text-[10px] text-zinc-500 -mt-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando foto...</p>}
              <div className="grid grid-cols-1 gap-4">
                <FInput label="Nome Completo *" value={f.nome_completo} onChange={v => set("nome_completo", v)} span />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FInput label="CPF" value={f.cpf} onChange={v => set("cpf", v)} />
                <FSelect
                  label="Tipo de Documento"
                  value={f.tipo_documento_identidade}
                  onChange={v => set("tipo_documento_identidade", (v === "CIN" ? "CIN" : "RG"))}
                  options={[
                    { value: "RG", label: "RG" },
                    { value: "CIN", label: "CIN (usa CPF)" },
                  ]}
                />
                <FInput
                  label={f.tipo_documento_identidade === "CIN" ? "CIN (nº)" : "RG (nº)"}
                  value={f.rg}
                  onChange={v => set("rg", v)}
                />
                <FInput
                  label={f.tipo_documento_identidade === "CIN" ? "Emissor CIN" : "Emissor RG"}
                  value={f.emissor_rg}
                  onChange={v => set("emissor_rg", v)}
                />
              </div>
              {f.tipo_documento_identidade === "CIN" && (
                <p className="text-[10px] text-zinc-500 -mt-2">
                  ℹ️ A Carteira de Identidade Nacional (CIN) substitui o RG e usa o mesmo número do CPF — é legal e esperado que coincidam.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="Expedição RG" value={f.expedicao_rg} onChange={v => set("expedicao_rg", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
                <FInput label="Data de Nascimento" value={f.data_nascimento} onChange={v => set("data_nascimento", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
                <FSelect label="Sexo" value={f.sexo} onChange={v => set("sexo", v)} options={SEXO_OPTIONS} placeholder="Selecionar..." />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="Naturalidade (Município)" value={f.naturalidade_municipio} onChange={v => set("naturalidade_municipio", v)} />
                <FSelect label="Naturalidade (UF)" value={f.naturalidade_uf} onChange={v => set("naturalidade_uf", v)} options={ufOptions} placeholder="UF" />
                <FInput label="Naturalidade (País)" value={f.naturalidade_pais} onChange={v => set("naturalidade_pais", v)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="Nacionalidade" value={f.nacionalidade} onChange={v => set("nacionalidade", v)} />
                <FSelect label="Estado Civil" value={f.estado_civil} onChange={v => set("estado_civil", v)} options={estadoCivilOptions} />
                <FInput label="Profissão" value={f.profissao} onChange={v => set("profissao", v)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FInput label="Escolaridade" value={f.escolaridade} onChange={v => set("escolaridade", v)} />
                <FInput label="Título de Eleitor" value={f.titulo_eleitor} onChange={v => set("titulo_eleitor", v)} />
                <FInput label="CNH" value={f.cnh} onChange={v => set("cnh", v)} />
                <FInput label="CTPS" value={f.ctps} onChange={v => set("ctps", v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Senha Gov.br">
                  {isEdit ? (
                    <SenhaGovField
                      cadastroCrId={cadastroCrId}
                      clienteId={cliente?.id ?? null}
                      contexto="ClienteFormModal"
                      variant="row"
                      autoReveal
                      onCreateCadastro={async () => {
                        if (!cliente?.id) return null;
                        const { data: stub, error } = await supabase
                          .from("qa_cadastro_cr" as any)
                          .insert({ cliente_id: cliente.id })
                          .select("id")
                          .single();
                        if (error) {
                          toast.error("Falha ao preparar CR: " + error.message);
                          return null;
                        }
                        const newId = (stub as any)?.id ?? null;
                        setCadastroCrId(newId);
                        return newId;
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={f.senha_gov}
                      onChange={e => set("senha_gov", e.target.value)}
                      placeholder="Senha GOV importada"
                      className={inputClass.replace(" uppercase", "")}
                    />
                  )}
                </Field>
                <FInput
                  label="Data de Realização Exame Psicológico"
                  value={f.validade_laudo_psicologico}
                  onChange={v => set("validade_laudo_psicologico", normalizeDateInput(v))}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
                <FInput
                  label="Data de Realização Exame de Tiro"
                  value={f.validade_exame_tiro}
                  onChange={v => set("validade_exame_tiro", normalizeDateInput(v))}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </section>

            {/* ── Bloco: Filiação & Contato ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <SectionTitle icon={Users} label="Filiação & Contato" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FInput label="Nome da Mãe" value={f.nome_mae} onChange={v => set("nome_mae", v)} />
                <FInput label="Nome do Pai" value={f.nome_pai} onChange={v => set("nome_pai", v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FInput label="Celular" value={f.celular} onChange={v => set("celular", v)} placeholder="(00) 00000-0000" />
                <FInput label="E-mail" value={f.email} onChange={v => set("email", v)} placeholder="email@exemplo.com" />
              </div>
            </section>

            {/* ── Bloco: Endereço Principal ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <SectionTitle icon={MapPin} label="Endereço Principal" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <FInput label={cepLoading ? "CEP ⏳" : "CEP"} value={f.cep} onChange={v => set("cep", formatCepMask(v))} onBlur={() => handleCepBlur(f.cep, "")} placeholder="00.000-000" maxLength={10} inputMode="numeric" />
                  <div className="col-span-2 sm:col-span-3">
                    <FInput label="Logradouro" value={f.endereco} onChange={v => set("endereco", v)} span />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Número" value={f.numero} onChange={v => set("numero", v)} onBlur={() => resolveGeoloc("")} />
                  <FInput label="Complemento" value={f.complemento} onChange={v => set("complemento", v)} />
                  <FInput label="Bairro" value={f.bairro} onChange={v => set("bairro", v)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Cidade" value={f.cidade} onChange={v => set("cidade", v)} />
                  <FSelect label="UF" value={f.estado} onChange={v => set("estado", v)} options={ufOptions} placeholder="UF" />
                  <FInput label="País" value={f.pais} onChange={v => set("pais", v)} />
                </div>
                <div>
                  <FInput
                    label={geocodeLoading ? "Geolocalização (lat,long) — resolvendo…" : "Geolocalização (lat,long) — automática"}
                    value={f.geolocalizacao}
                    onChange={v => set("geolocalizacao", v)}
                    placeholder="Resolvida automaticamente após preencher o endereço"
                    span
                  />
                </div>
            </section>

            {/* ── Bloco: Endereço Secundário ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <SectionTitle icon={Home} label="Endereço Secundário (opcional)" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <FInput label={cepLoading ? "CEP ⏳" : "CEP"} value={f.cep2} onChange={v => set("cep2", formatCepMask(v))} onBlur={() => handleCepBlur(f.cep2, "2")} placeholder="00.000-000" maxLength={10} inputMode="numeric" />
                  <div className="col-span-2 sm:col-span-3">
                    <FInput label="Logradouro" value={f.endereco2} onChange={v => set("endereco2", v)} span />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Número" value={f.numero2} onChange={v => set("numero2", v)} onBlur={() => resolveGeoloc("2")} />
                  <FInput label="Complemento" value={f.complemento2} onChange={v => set("complemento2", v)} />
                  <FInput label="Bairro" value={f.bairro2} onChange={v => set("bairro2", v)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Cidade" value={f.cidade2} onChange={v => set("cidade2", v)} />
                  <FSelect label="UF" value={f.estado2} onChange={v => set("estado2", v)} options={ufOptions} placeholder="UF" />
                  <FInput label="País" value={f.pais2} onChange={v => set("pais2", v)} />
                </div>
                <div>
                  <FInput
                    label={geocodeLoading ? "Geolocalização (lat,long) — resolvendo…" : "Geolocalização (lat,long) — automática"}
                    value={f.geolocalizacao2}
                    onChange={v => set("geolocalizacao2", v)}
                    placeholder="Resolvida automaticamente após preencher o endereço"
                    span
                  />
                </div>
            </section>

            {/* ── Bloco: Configurações ── */}
            <section className="relative rounded-xl border border-zinc-200 bg-white p-5 space-y-5 shadow-sm">
              <SectionTitle icon={Settings} label="Configurações" />
              {/* Categoria Legal do Titular (Lei 10.826/03 art. 6º) */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-700">Categoria Legal do Titular</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Define quais documentos/exames são exigidos. Base: Lei 10.826/03 art. 6º, Decreto 11.615/23.
                    </p>
                  </div>
                </div>
                {!f.categoria_titular && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#FBF3F4] border border-[#E5C2C6]">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#4F121C] flex-shrink-0" />
                    <span className="text-[11px] text-[#3D0E16] font-medium">
                      Categoria não definida — sistema considerará todas as exigências.
                    </span>
                  </div>
                )}
                <FSelect
                  label="Categoria *"
                  value={f.categoria_titular}
                  onChange={v => setF(prev => ({ ...prev, categoria_titular: v as CategoriaTitular | "", subcategoria: "" }))}
                  options={CATEGORIA_OPTIONS}
                  placeholder="Selecione a categoria do titular..."
                />
                {f.categoria_titular && (
                  <>
                    <p className="text-[10px] text-zinc-500 italic">
                      {CATEGORIA_MAP[f.categoria_titular as CategoriaTitular]?.descricao}
                    </p>
                    {(() => {
                      const cat = f.categoria_titular as CategoriaTitular;
                      const isInstitucional = cat === "seguranca_publica";
                      return (
                        <>
                          <div className={isInstitucional ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                            <FSelect
                              label="Subcategoria"
                              value={f.subcategoria}
                              onChange={v => set("subcategoria", v)}
                              options={(CATEGORIA_MAP[cat]?.subcategorias || []).map(s => ({ value: s, label: s }))}
                              placeholder="Selecione..."
                            />
                            {isInstitucional && (
                              <FInput label="Órgão / Instituição" value={f.orgao_vinculado} onChange={v => set("orgao_vinculado", v)} placeholder="Ex: Polícia Civil/SP" />
                            )}
                          </div>
                          {isInstitucional && (
                            <FInput label="Matrícula Funcional" value={f.matricula_funcional} onChange={v => set("matricula_funcional", v)} placeholder="Identidade funcional" />
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FSelect label="Status do Cliente" value={f.status} onChange={v => set("status", v)} options={statusOptions} />
              </div>
              <Field label="Observações" span>
                <textarea
                  value={f.observacao}
                  onChange={e => set("observacao", e.target.value)}
                  rows={4}
                  placeholder="Informações adicionais sobre o cliente..."
                  className="w-full px-3 py-2.5 rounded-md border border-zinc-200 bg-white text-sm text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-400 transition-all resize-none uppercase"
                />
              </Field>
            </section>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

/* ── Section title (Arsenal UI) ── */
function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-zinc-500" />
      </div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-700">{label}</p>
      <span className="ml-1 h-px flex-1 bg-zinc-100" />
    </div>
  );
}

/* ── KPI Card (espelha os cards KPI do dashboard) ── */
function KpiCard({ icon: Icon, label, value, tone = "info" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "info";
}) {
  // Cor do glow esfumaçado no canto sup. direito — espelha o padrão Arsenal
  const glow = tone === "ok"
    ? "rgba(16, 185, 129, 0.55)"      // emerald-500
    : tone === "warn"
      ? "rgba(122, 31, 43, 0.55)"     // bordo
      : "rgba(161, 161, 170, 0.45)";  // zinc-400
  const dotCls = tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-[#7A1F2B]" : "bg-zinc-300";
  const iconCls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-[#7A1F2B]" : "text-zinc-400";
  return (
    <div className="relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm overflow-hidden transition-colors">
      {/* Glow esfumaçado animado no canto superior direito (padrão Arsenal) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl transition-[background,opacity] duration-500 ease-out"
        style={{ background: glow }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <Icon className={cn("h-4 w-4 transition-colors duration-500", iconCls)} />
        <span className={cn("h-1.5 w-1.5 rounded-full transition-colors duration-500", dotCls)} />
      </div>
      <p className="relative text-lg font-bold tracking-tight mt-2 uppercase text-zinc-900">{value}</p>
      <p className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

/* Calcula tom do KPI a partir de progresso "X/Y" */
function kpiTone(value: string): "ok" | "warn" | "info" {
  const m = value.match(/^(\d+)\/(\d+)$/);
  if (!m) return "info";
  const filled = Number(m[1]);
  const total = Number(m[2]);
  if (total === 0) return "info";
  if (filled === 0) return "warn";
  if (filled >= total) return "ok";
  return "warn";
}

/* ── Compute KPIs ── */
function kpiIdent(f: any): string {
  const fields = ["nome_completo", "cpf", "rg", "data_nascimento", "sexo", "naturalidade_municipio"];
  const filled = fields.filter(k => String(f?.[k] || "").trim()).length;
  return `${filled}/${fields.length}`;
}
function kpiContato(f: any): string {
  const fields = ["celular", "email"];
  const filled = fields.filter(k => String(f?.[k] || "").trim()).length;
  return `${filled}/${fields.length}`;
}
function kpiEndereco(f: any): string {
  const fields = ["cep", "endereco", "numero", "bairro", "cidade", "estado"];
  const filled = fields.filter(k => String(f?.[k] || "").trim()).length;
  return `${filled}/${fields.length}`;
}
