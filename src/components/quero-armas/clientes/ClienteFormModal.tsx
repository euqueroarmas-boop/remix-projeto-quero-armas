import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Save, User, Users, Phone, MapPin, Home, Settings, ChevronLeft, ChevronRight, CheckCircle2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClienteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cliente?: any;
}

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União Estável"];
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RS","SC","SE","SP","TO"];

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

const formatDateForDatabase = (value: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

/* ── Steps Config ── */
const STEPS = [
  { key: "identificacao", label: "Identificação", icon: User },
  { key: "filiacao", label: "Filiação & Contato", icon: Users },
  { key: "endereco1", label: "Endereço", icon: MapPin },
  { key: "endereco2", label: "End. Secundário", icon: Home },
  { key: "config", label: "Configurações", icon: Settings },
] as const;

/* ── Reusable Field Components ── */
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn("space-y-1.5", span && "col-span-full")}>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all uppercase";
const selectClass = "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all appearance-none cursor-pointer";

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

function FSelect({ label, value, onChange, options, placeholder = "Selecionar..." }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export default function ClienteFormModal({ open, onClose, onSaved, cliente }: ClienteFormModalProps) {
  const isEdit = !!cliente;
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const { lookupCep, cepLoading } = useBrasilApiLookup();

  // Photo upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  const [f, setF] = useState({
    nome_completo: "", cpf: "", rg: "", emissor_rg: "", expedicao_rg: "",
    data_nascimento: "", naturalidade: "", nacionalidade: "Brasileira",
    nome_mae: "", nome_pai: "", estado_civil: "", profissao: "", escolaridade: "",
    email: "", celular: "", titulo_eleitor: "",
    endereco: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", estado: "", pais: "Brasil",
    endereco2: "", numero2: "", complemento2: "", bairro2: "", cep2: "", cidade2: "", estado2: "", pais2: "",
    observacao: "", status: "ATIVO", cliente_lions: false,
  });

  useEffect(() => {
    if (!open) { setStep(0); setPhotoFile(null); setPhotoPreview(null); return; }
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
        cep: cliente.cep || "", cidade: cliente.cidade || "", estado: cliente.estado || "",
        pais: cliente.pais || "Brasil",
        endereco2: cliente.endereco2 || "", numero2: cliente.numero2 || "",
        complemento2: cliente.complemento2 || "", bairro2: cliente.bairro2 || "",
        cep2: cliente.cep2 || "", cidade2: cliente.cidade2 || "", estado2: cliente.estado2 || "",
        pais2: cliente.pais2 || "",
        observacao: cliente.observacao || "", status: cliente.status || "ATIVO",
        cliente_lions: cliente.cliente_lions || false,
      });
      // Load existing photo preview
      if (cliente.imagem) {
        const { data: urlData } = supabase.storage.from("qa-documentos").getPublicUrl(cliente.imagem);
        setPhotoPreview(urlData?.publicUrl || null);
      } else {
        setPhotoPreview(null);
      }
    } else {
      setF(prev => ({ ...prev, nome_completo: "", cpf: "", rg: "", email: "", celular: "" }));
      setPhotoPreview(null);
    }
  }, [cliente, open]);

  const set = (key: string, val: any) => setF(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    if (!f.nome_completo.trim()) { toast.error("Nome completo é obrigatório"); setStep(0); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...f,
        expedicao_rg: formatDateForDatabase(f.expedicao_rg),
        data_nascimento: formatDateForDatabase(f.data_nascimento),
      };
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
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const canGoNext = step < STEPS.length - 1;
  const canGoPrev = step > 0;
  const isLast = step === STEPS.length - 1;

  /* ── Step badge completeness ── */
  const stepComplete = (idx: number): boolean => {
    switch (idx) {
      case 0: return !!(f.nome_completo && f.cpf);
      case 1: return !!(f.nome_mae && f.celular);
      case 2: return !!(f.endereco && f.cidade);
      case 3: return true; // optional
      case 4: return true;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[90vh] overflow-hidden p-0 bg-white border-slate-200 text-slate-800 qa-premium gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <DialogTitle className="text-lg font-bold text-slate-800">
            {isEdit ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Preencha os dados cadastrais • Etapa {step + 1} de {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step Navigation ── */}
        <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const completed = stepComplete(i) && i !== step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : completed
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-100"
                  )}
                >
                  {completed && !active ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Form Body ── */}
        <div className="px-6 py-5 overflow-y-auto" style={{ maxHeight: "calc(90vh - 260px)" }}>
          {/* Step 0: Identificação */}
          {step === 0 && (
            <div className="space-y-5">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 flex items-center justify-center cursor-pointer overflow-hidden transition-colors bg-slate-50"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      onClick={removePhoto}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Foto do Cliente</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Clique para adicionar ou trocar a foto</p>
                  {uploadingPhoto && <p className="text-[10px] text-blue-500 mt-0.5 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FInput label="Nome Completo *" value={f.nome_completo} onChange={v => set("nome_completo", v)} span />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="CPF" value={f.cpf} onChange={v => set("cpf", v)} />
                <FInput label="RG" value={f.rg} onChange={v => set("rg", v)} />
                <FInput label="Emissor RG" value={f.emissor_rg} onChange={v => set("emissor_rg", v)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="Expedição RG" value={f.expedicao_rg} onChange={v => set("expedicao_rg", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
                <FInput label="Data de Nascimento" value={f.data_nascimento} onChange={v => set("data_nascimento", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
                <FInput label="Naturalidade" value={f.naturalidade} onChange={v => set("naturalidade", v)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <FInput label="Nacionalidade" value={f.nacionalidade} onChange={v => set("nacionalidade", v)} />
                <FSelect label="Estado Civil" value={f.estado_civil} onChange={v => set("estado_civil", v)} options={estadoCivilOptions} />
                <FInput label="Profissão" value={f.profissao} onChange={v => set("profissao", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FInput label="Escolaridade" value={f.escolaridade} onChange={v => set("escolaridade", v)} />
                <FInput label="Título de Eleitor" value={f.titulo_eleitor} onChange={v => set("titulo_eleitor", v)} />
              </div>
            </div>
          )}

          {/* Step 1: Filiação & Contato */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filiação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FInput label="Nome da Mãe" value={f.nome_mae} onChange={v => set("nome_mae", v)} />
                  <FInput label="Nome do Pai" value={f.nome_pai} onChange={v => set("nome_pai", v)} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contato</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FInput label="Celular" value={f.celular} onChange={v => set("celular", v)} placeholder="(00) 00000-0000" />
                  <FInput label="E-mail" value={f.email} onChange={v => set("email", v)} placeholder="email@exemplo.com" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Endereço Principal */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Endereço Principal</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <FInput label={cepLoading ? "CEP ⏳" : "CEP"} value={f.cep} onChange={v => set("cep", v)} onBlur={() => handleCepBlur(f.cep, "")} placeholder="00000-000" />
                  <div className="col-span-2 sm:col-span-3">
                    <FInput label="Logradouro" value={f.endereco} onChange={v => set("endereco", v)} span />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Número" value={f.numero} onChange={v => set("numero", v)} />
                  <FInput label="Complemento" value={f.complemento} onChange={v => set("complemento", v)} />
                  <FInput label="Bairro" value={f.bairro} onChange={v => set("bairro", v)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Cidade" value={f.cidade} onChange={v => set("cidade", v)} />
                  <FSelect label="UF" value={f.estado} onChange={v => set("estado", v)} options={ufOptions} placeholder="UF" />
                  <FInput label="País" value={f.pais} onChange={v => set("pais", v)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Endereço Secundário */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Endereço Secundário <span className="normal-case font-normal">(opcional)</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <FInput label={cepLoading ? "CEP ⏳" : "CEP"} value={f.cep2} onChange={v => set("cep2", v)} onBlur={() => handleCepBlur(f.cep2, "2")} placeholder="00000-000" />
                  <div className="col-span-2 sm:col-span-3">
                    <FInput label="Logradouro" value={f.endereco2} onChange={v => set("endereco2", v)} span />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Número" value={f.numero2} onChange={v => set("numero2", v)} />
                  <FInput label="Complemento" value={f.complemento2} onChange={v => set("complemento2", v)} />
                  <FInput label="Bairro" value={f.bairro2} onChange={v => set("bairro2", v)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FInput label="Cidade" value={f.cidade2} onChange={v => set("cidade2", v)} />
                  <FSelect label="UF" value={f.estado2} onChange={v => set("estado2", v)} options={ufOptions} placeholder="UF" />
                  <FInput label="País" value={f.pais2} onChange={v => set("pais2", v)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Configurações */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FSelect label="Status do Cliente" value={f.status} onChange={v => set("status", v)} options={statusOptions} />
                <Field label="Cliente Lions">
                  <label className="flex items-center gap-3 h-10 px-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={f.cliente_lions}
                      onChange={e => set("cliente_lions", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">🦁 Sim, é cliente Lions</span>
                  </label>
                </Field>
              </div>
              <Field label="Observações" span>
                <textarea
                  value={f.observacao}
                  onChange={e => set("observacao", e.target.value)}
                  rows={4}
                  placeholder="Informações adicionais sobre o cliente..."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none uppercase"
                />
              </Field>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            {canGoPrev && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(s => s - 1)}
                className="gap-1.5 text-xs border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
            )}
            {canGoNext && (
              <Button
                size="sm"
                onClick={() => setStep(s => s + 1)}
                className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Próximo
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {isLast && (
              <Button
                size="sm"
                onClick={save}
                disabled={saving}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
