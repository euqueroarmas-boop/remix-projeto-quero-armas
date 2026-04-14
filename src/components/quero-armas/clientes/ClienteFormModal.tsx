import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  FormCard, SectionHeader, FormGrid,
  FormInput, FormSelect, FormTextarea, FormActions, FormCheckbox,
} from "@/components/admin/ui/AdminFormPrimitives";

interface ClienteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  cliente?: any;
}

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União Estável"];
const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

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

export default function ClienteFormModal({ open, onClose, onSaved, cliente }: ClienteFormModalProps) {
  const isEdit = !!cliente;
  const [saving, setSaving] = useState(false);
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
    if (cliente) {
      setF({
        nome_completo: cliente.nome_completo || "",
        cpf: cliente.cpf || "", rg: cliente.rg || "", emissor_rg: cliente.emissor_rg || "",
        expedicao_rg: formatDateForDisplay(cliente.expedicao_rg || ""),
        data_nascimento: formatDateForDisplay(cliente.data_nascimento || ""), naturalidade: cliente.naturalidade || "",
        nacionalidade: cliente.nacionalidade || "Brasileira",
        nome_mae: cliente.nome_mae || "", nome_pai: cliente.nome_pai || "",
        estado_civil: cliente.estado_civil || "", profissao: cliente.profissao || "",
        escolaridade: cliente.escolaridade || "",
        email: cliente.email || "", celular: cliente.celular || "", titulo_eleitor: cliente.titulo_eleitor || "",
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
    } else {
      setF(prev => ({ ...prev, nome_completo: "", cpf: "", rg: "", email: "", celular: "" }));
    }
  }, [cliente, open]);

  const set = (key: string, val: any) => setF(prev => ({ ...prev, [key]: val }));

  const save = async () => {
    if (!f.nome_completo.trim()) { toast.error("Nome completo é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...f,
        expedicao_rg: formatDateForDatabase(f.expedicao_rg),
        data_nascimento: formatDateForDatabase(f.data_nascimento),
      };
      if (isEdit) {
        const { error } = await supabase.from("qa_clientes" as any).update(payload).eq("id", cliente.id);
        if (error) throw error;
        toast.success("Cliente atualizado");
      } else {
        const { error } = await supabase.from("qa_clientes" as any).insert(payload);
        if (error) throw error;
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-0">
          <DialogTitle className="text-base">{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription className="text-xs">Preencha os dados cadastrais do cliente</DialogDescription>
        </DialogHeader>

        <FormCard>
          {/* ── Identificação ── */}
          <SectionHeader title="Identificação" className="pt-1" />
          <FormGrid>
            <FormInput label="Nome Completo *" value={f.nome_completo} onChange={v => set("nome_completo", v)} span="full" />
            <FormInput label="CPF" value={f.cpf} onChange={v => set("cpf", v)} />
            <FormInput label="RG" value={f.rg} onChange={v => set("rg", v)} />
            <FormInput label="Emissor RG" value={f.emissor_rg} onChange={v => set("emissor_rg", v)} />
            <FormInput label="Expedição RG" value={f.expedicao_rg} onChange={v => set("expedicao_rg", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} autoComplete="off" />
            <FormInput label="Nascimento" value={f.data_nascimento} onChange={v => set("data_nascimento", normalizeDateInput(v))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} autoComplete="bday" />
            <FormInput label="Naturalidade" value={f.naturalidade} onChange={v => set("naturalidade", v)} />
            <FormInput label="Nacionalidade" value={f.nacionalidade} onChange={v => set("nacionalidade", v)} />
            <FormSelect label="Estado Civil" value={f.estado_civil} onValueChange={v => set("estado_civil", v)} options={estadoCivilOptions} />
            <FormInput label="Profissão" value={f.profissao} onChange={v => set("profissao", v)} />
            <FormInput label="Escolaridade" value={f.escolaridade} onChange={v => set("escolaridade", v)} />
            <FormInput label="Título de Eleitor" value={f.titulo_eleitor} onChange={v => set("titulo_eleitor", v)} />
          </FormGrid>

          {/* ── Filiação ── */}
          <SectionHeader title="Filiação" />
          <FormGrid>
            <FormInput label="Nome da Mãe" value={f.nome_mae} onChange={v => set("nome_mae", v)} />
            <FormInput label="Nome do Pai" value={f.nome_pai} onChange={v => set("nome_pai", v)} />
          </FormGrid>

          {/* ── Contato ── */}
          <SectionHeader title="Contato" />
          <FormGrid>
            <FormInput label="Celular" value={f.celular} onChange={v => set("celular", v)} />
            <FormInput label="Email" value={f.email} onChange={v => set("email", v)} />
          </FormGrid>

          {/* ── Endereço Principal ── */}
          <SectionHeader title="Endereço Principal" />
          <FormGrid>
            <FormInput label="Logradouro" value={f.endereco} onChange={v => set("endereco", v)} span="full" />
            <FormInput label="Número" value={f.numero} onChange={v => set("numero", v)} />
            <FormInput label="Complemento" value={f.complemento} onChange={v => set("complemento", v)} />
            <FormInput label="Bairro" value={f.bairro} onChange={v => set("bairro", v)} />
            <FormInput label="CEP" value={f.cep} onChange={v => set("cep", v)} />
          </FormGrid>
          <FormGrid cols={3} className="mt-2">
            <FormInput label="Cidade" value={f.cidade} onChange={v => set("cidade", v)} />
            <FormSelect label="UF" value={f.estado} onValueChange={v => set("estado", v)} options={ufOptions} placeholder="UF" />
            <FormInput label="País" value={f.pais} onChange={v => set("pais", v)} />
          </FormGrid>

          {/* ── Endereço Secundário ── */}
          <SectionHeader title="Endereço Secundário (opcional)" />
          <FormGrid>
            <FormInput label="Logradouro" value={f.endereco2} onChange={v => set("endereco2", v)} span="full" />
            <FormInput label="Número" value={f.numero2} onChange={v => set("numero2", v)} />
            <FormInput label="Complemento" value={f.complemento2} onChange={v => set("complemento2", v)} />
            <FormInput label="Bairro" value={f.bairro2} onChange={v => set("bairro2", v)} />
            <FormInput label="CEP" value={f.cep2} onChange={v => set("cep2", v)} />
          </FormGrid>
          <FormGrid cols={3} className="mt-2">
            <FormInput label="Cidade" value={f.cidade2} onChange={v => set("cidade2", v)} />
            <FormSelect label="UF" value={f.estado2} onValueChange={v => set("estado2", v)} options={ufOptions} placeholder="UF" />
            <FormInput label="País" value={f.pais2} onChange={v => set("pais2", v)} />
          </FormGrid>

          {/* ── Configurações ── */}
          <SectionHeader title="Configurações" />
          <FormGrid>
            <FormSelect label="Status" value={f.status} onValueChange={v => set("status", v)} options={statusOptions} />
            <FormCheckbox label="🦁 Cliente Lions" checked={f.cliente_lions} onChange={v => set("cliente_lions", v)} />
          </FormGrid>
          <FormGrid cols={1} className="mt-2">
            <FormTextarea label="Observações" value={f.observacao} onChange={v => set("observacao", v)} span="full" />
          </FormGrid>

          {/* ── Actions ── */}
          <FormActions>
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </FormActions>
        </FormCard>
      </DialogContent>
    </Dialog>
  );
}
