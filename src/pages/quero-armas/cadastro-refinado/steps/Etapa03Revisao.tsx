import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";
import { enviarSnapshotCadastroMira } from "@/lib/quero-armas/cadastroMiraSnapshot";

interface Props {
  state: CadastroRefinadoState;
  updateDados: (patch: Partial<CadastroRefinadoState["dadosPessoais"]>) => void;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

function field(label: string, name: keyof CadastroRefinadoState["dadosPessoais"], value: string, onChange: (v: string) => void, opts?: { type?: string; placeholder?: string }) {
  return (
    <label className="qa-ref-field">
      <span className="qa-ref-label">{label}</span>
      <input
        className="qa-ref-input"
        type={opts?.type || "text"}
        value={value}
        placeholder={opts?.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function Etapa03Revisao({ state, updateDados, update, onNext, onBack }: Props) {
  const d = state.dadosPessoais;
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setError(null);
    if (!d.nome_completo || !d.cpf || !d.email) {
      setError("Nome, CPF e e-mail são obrigatórios.");
      return;
    }
    setChecking(true);
    try {
      // Bug 1 fix preservado — checa se cliente já existe (CPF/email)
      const { data, error } = await supabase.functions.invoke("qa-cliente-checar-existente", {
        body: { cpf: d.cpf.replace(/\D/g, ""), email: d.email.trim().toLowerCase() },
      });
      if (error) throw error;
      const exists = !!(data?.cpf_existe || data?.email_existe);
      update({ clienteExistente: exists });
      // Snapshot operacional p/ Equipe Quero Armas — não bloqueia.
      try {
        const r = await enviarSnapshotCadastroMira(state, "revisao_cliente", {
          snapshot_id: state.cadastro_mira_snapshot_id,
        });
        if (r?.snapshot_id && r.snapshot_id !== state.cadastro_mira_snapshot_id) {
          update({ cadastro_mira_snapshot_id: r.snapshot_id });
        }
      } catch { /* silencioso */ }
      onNext();
    } catch (e: any) {
      // Mesmo se a checagem falhar, prossegue — backend revalida
      console.warn("[cadastro-refinado] checar-existente falhou", e);
      onNext();
    } finally {
      setChecking(false);
    }
  }

  return (
    <QACadastroRefinadoShell
      step={3}
      eyebrow="ETAPA 03 · REVISÃO"
      title="Confira seus dados"
      subtitle="Extraímos automaticamente o que conseguimos. Revise, edite o que for necessário e siga em frente."
      onBack={onBack}
    >
      <div className="qa-ref-section-card">
        <div className="qa-ref-section-head">
          <span className="qa-ref-section-title">Dados pessoais</span>
          <span className="qa-ref-section-tag">Extraído por IA</span>
        </div>
        <div className="qa-ref-section-body">
          {field("Nome completo", "nome_completo", d.nome_completo, (v) => updateDados({ nome_completo: v }))}
          {field("CPF", "cpf", d.cpf, (v) => updateDados({ cpf: v }), { placeholder: "000.000.000-00" })}
          {field("E-mail", "email", d.email, (v) => updateDados({ email: v }), { type: "email" })}
          {field("Telefone (WhatsApp)", "telefone", d.telefone, (v) => updateDados({ telefone: v }), { placeholder: "(11) 99999-9999" })}
          {field("Data de nascimento", "data_nascimento", d.data_nascimento, (v) => updateDados({ data_nascimento: v }), { placeholder: "DD/MM/AAAA" })}
        </div>
      </div>

      <div className="qa-ref-section-card" style={{ marginTop: 16 }}>
        <div className="qa-ref-section-head">
          <span className="qa-ref-section-title">Endereço</span>
          <span className="qa-ref-section-tag">Extraído por IA</span>
        </div>
        <div className="qa-ref-section-body">
          {field("CEP", "endereco_cep", d.endereco_cep, (v) => updateDados({ endereco_cep: v }), { placeholder: "00000-000" })}
          {field("Logradouro", "endereco_logradouro", d.endereco_logradouro, (v) => updateDados({ endereco_logradouro: v }))}
          {field("Número", "endereco_numero", d.endereco_numero, (v) => updateDados({ endereco_numero: v }))}
          {field("Complemento", "endereco_complemento", d.endereco_complemento, (v) => updateDados({ endereco_complemento: v }))}
          {field("Bairro", "endereco_bairro", d.endereco_bairro, (v) => updateDados({ endereco_bairro: v }))}
          {field("Cidade", "endereco_cidade", d.endereco_cidade, (v) => updateDados({ endereco_cidade: v }))}
          {field("Estado (UF)", "endereco_estado", d.endereco_estado, (v) => updateDados({ endereco_estado: v.toUpperCase().slice(0, 2) }))}
        </div>
      </div>

      {error && <div className="qa-ref-error-text">{error}</div>}

      <div style={{ marginTop: 28 }}>
        <button className="qa-ref-btn qa-ref-btn-primary" disabled={checking} onClick={handleContinue}>
          {checking ? "Validando…" : "Dados conferidos, continuar"}
        </button>
      </div>
    </QACadastroRefinadoShell>
  );
}