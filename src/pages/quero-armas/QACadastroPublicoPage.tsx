import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import {
  User, MapPin, Building2, FileCheck, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, Search, Plus, AlertCircle, Shield,
} from "lucide-react";

/* ── Types ── */
type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  nome_completo: string; cpf: string; data_nascimento: string;
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
  consentimento_dados_verdadeiros: boolean;
  consentimento_tratamento_dados: boolean;
}

const initialForm: FormData = {
  nome_completo: "", cpf: "", data_nascimento: "",
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
  consentimento_dados_verdadeiros: false,
  consentimento_tratamento_dados: false,
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

/* ── Component ── */
export default function QACadastroPublicoPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { lookupCep, lookupCnpj, lookupGeocode, cepLoading, cnpjLoading, geocodeLoading } = useBrasilApiLookup();

  const [cpfLooking, setCpfLooking] = useState(false);
  const [cpfFound, setCpfFound] = useState<boolean | null>(null);
  const [showComplementoConfirm, setShowComplementoConfirm] = useState(false);

  const set = useCallback((field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const n = { ...prev };
      delete n[field];
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
      if (error || !data?.found) {
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
    }
    if (s === 2) {
      if (!form.end1_numero.trim()) errs.end1_numero = "Número é obrigatório";
      if (!form.end1_complemento.trim()) errs.end1_complemento = "Complemento é obrigatório (ex: Casa, Apto, Bloco)";
      if (!form.comprovante_endereco_proprio) errs.comprovante_endereco_proprio = "Informe se possui comprovante no seu nome";
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
    } else {
      setStep(Math.max(step - 1, 1) as Step);
    }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-cadastro-publico", {
        body: form,
      });
      if (error || !data?.success) {
        throw new Error(data?.error || "Erro ao enviar");
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, hsl(220 20% 97%) 0%, hsl(230 20% 94%) 100%)" }}>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen qa-premium" style={{ background: "linear-gradient(135deg, hsl(220 20% 97%) 0%, hsl(230 20% 94%) 100%)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: "hsl(230 80% 96%)" }}>
            <Shield className="w-6 h-6" style={{ color: "hsl(230 80% 56%)" }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Cadastro de Cliente
          </h1>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "hsl(220 10% 50%)" }}>
            Preencha seus dados para registro no sistema. Todas as informações são protegidas conforme a LGPD.
          </p>
        </div>

        {/* Steps indicator */}
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

        {/* Form card */}
        <div className="qa-card rounded-2xl p-5 md:p-8" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          {step === 1 && <Step1 form={form} set={set} errors={errors} onCpfLookup={handleCpfLookup} cpfLooking={cpfLooking} cpfFound={cpfFound} />}
          {step === 2 && <Step2 form={form} set={set} errors={errors} onCepLookup={() => handleCepLookup("end1")} cepLoading={cepLoading} showComplementoConfirm={showComplementoConfirm} onComplementoConfirmDismiss={() => { setShowComplementoConfirm(false); proceedFromStep2(); }} onGeocodeLookup={() => handleGeocodeLookup("end1")} geocodeLoading={geocodeLoading} />}
          {step === 3 && <Step3 form={form} set={set} errors={errors} onCepLookup={() => handleCepLookup("end2")} cepLoading={cepLoading} onGeocodeLookup={() => handleGeocodeLookup("end2")} geocodeLoading={geocodeLoading} />}
          {step === 4 && <Step4 form={form} set={set} errors={errors} onCnpjLookup={handleCnpjLookup} cnpjLoading={cnpjLoading} />}
          {step === 5 && <Step5 form={form} set={set} errors={errors} />}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: "hsl(220 13% 93%)" }}>
            {step > 1 ? (
              <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "hsl(220 10% 46%)", background: "hsl(220 14% 96%)" }}>
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            ) : <div />}
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
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
          <Shield className="w-3 h-3 inline mr-1" />
          Dados protegidos conforme a Lei Geral de Proteção de Dados (LGPD)
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

/* ── Step 1: Dados Pessoais ── */
function Step1({ form, set, errors, onCpfLookup, cpfLooking, cpfFound }: { form: FormData; set: any; errors: any; onCpfLookup?: () => void; cpfLooking?: boolean; cpfFound?: boolean | null }) {
  return (
    <div>
      <SectionTitle>Dados Pessoais</SectionTitle>
      <SectionDesc>Informe seus dados de identificação pessoal.</SectionDesc>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onChange={v => set(f("cep"), maskCep(v))}
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
function Step4({ form, set, errors, onCnpjLookup, cnpjLoading }: any) {
  const vinculos = [
    { value: "proprietario", label: "Sou proprietário / sócio de empresa" },
    { value: "registrado", label: "Trabalho registrado / carteira assinada" },
    { value: "aposentado", label: "Sou aposentado / pensionista" },
    { value: "nenhum", label: "Não possuo vínculo profissional no momento" },
  ];

  return (
    <div>
      <SectionTitle>Vínculo Profissional</SectionTitle>
      <SectionDesc>Selecione sua situação profissional atual.</SectionDesc>

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
                  <TextInput value={form.emp_cnpj} onChange={v => set("emp_cnpj", maskCnpj(v))} placeholder="00.000.000/0000-00" maxLength={18} />
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
            <Field label="Natureza jurídica">
              <TextInput value={form.emp_natureza_juridica} onChange={v => set("emp_natureza_juridica", v)} placeholder="Ex: Empresário Individual" />
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
            <Field label="Nome da empresa">
              <TextInput value={form.trab_nome_empresa} onChange={v => set("trab_nome_empresa", v)} placeholder="Nome da empresa" />
            </Field>
            <Field label="CNPJ da empresa">
              <div className="flex gap-2">
                <TextInput value={form.trab_cnpj_empresa} onChange={v => set("trab_cnpj_empresa", maskCnpj(v))} placeholder="00.000.000/0000-00" maxLength={18} />
                <button onClick={() => onCnpjLookup("trab")} disabled={cnpjLoading}
                  className="shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "hsl(230 80% 96%)", color: "hsl(230 80% 56%)" }}>
                  {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </Field>
            <Field label="Cargo / Função">
              <TextInput value={form.trab_cargo_funcao} onChange={v => set("trab_cargo_funcao", v)} placeholder="Cargo ou função" />
            </Field>
            <Field label="Endereço da empresa">
              <TextInput value={form.trab_endereco_empresa} onChange={v => set("trab_endereco_empresa", v)} placeholder="Endereço completo" />
            </Field>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <SummaryItem label="Nome" value={form.nome_completo} />
          <SummaryItem label="CPF" value={form.cpf} />
          <SummaryItem label="E-mail" value={form.email} />
          <SummaryItem label="Telefone" value={form.telefone_principal} />
          {form.end1_cidade && <SummaryItem label="Cidade" value={`${form.end1_cidade}/${form.end1_estado}`} />}
          {form.vinculo_tipo && <SummaryItem label="Vínculo" value={form.vinculo_tipo.replace(/_/g, " ")} />}
        </div>
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-1">
      <span className="font-medium" style={{ color: "hsl(220 10% 50%)" }}>{label}:</span>
      <span style={{ color: "hsl(220 20% 18%)" }}>{value}</span>
    </div>
  );
}
