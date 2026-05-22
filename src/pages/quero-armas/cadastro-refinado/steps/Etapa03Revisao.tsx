import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import QAReiniciarLink from "../components/QAReiniciarLink";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";
import { enviarSnapshotCadastroMira } from "@/lib/quero-armas/cadastroMiraSnapshot";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { useAuth } from "@/shared/auth/AuthProvider";
import { formatCPF, formatPhone } from "@/shared/lib/formatters";

interface Props {
  state: CadastroRefinadoState;
  updateDados: (patch: Partial<CadastroRefinadoState["dadosPessoais"]>) => void;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

function formatCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function formatDateBR(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function isEmailValido(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function field(
  label: string,
  name: keyof CadastroRefinadoState["dadosPessoais"],
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: string; placeholder?: string; readOnly?: boolean; hint?: string },
) {
  return (
    <label className="qa-ref-field">
      <span className="qa-ref-label">{label}</span>
      <input
        className="qa-ref-input"
        type={opts?.type || "text"}
        value={value}
        placeholder={opts?.placeholder}
        readOnly={opts?.readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
      {opts?.hint && <span className="qa-ref-hint" style={{ fontSize: 11, opacity: 0.7 }}>{opts.hint}</span>}
    </label>
  );
}

export default function Etapa03Revisao({ state, updateDados, update, onNext, onBack }: Props) {
  const d = state.dadosPessoais;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { lookupCep, cepLoading } = useBrasilApiLookup();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cpfCheck, setCpfCheck] = useState<{ checking: boolean; existe: boolean; checked: string | null }>({
    checking: false,
    existe: false,
    checked: null,
  });
  const [cepError, setCepError] = useState<string | null>(null);
  // Campos que o usuário editou manualmente após o autofill — não devem
  // ser sobrescritos por busca de CEP nem rotulados como "Extraído por IA".
  const editedRef = useRef<Set<string>>(new Set());

  // Exceção temporária aprovada: e-mail duplicado NÃO bloqueia quando o CPF é diferente.
  // CPF continua sendo o documento canônico e único.
  // Regra de ativação:
  //  - "true"  → sempre ligada
  //  - "false" → sempre desligada
  //  - ausente → ligada apenas em dev/localhost/Lovable preview; desligada em produção real.
  const allowDuplicateEmailTest = isDuplicateEmailTestAllowed();

  // "Extraído por IA" só faz sentido quando algum documento foi realmente
  // enviado na Etapa 02. Sem documento → sem selo.
  const veioDeIA = useMemo(
    () => Object.values(state.documentos || {}).some((doc) => doc?.status === "enviado"),
    [state.documentos],
  );

  const cpfDigits = d.cpf.replace(/\D/g, "");
  const telDigits = d.telefone.replace(/\D/g, "");
  const cepDigits = d.endereco_cep.replace(/\D/g, "");

  // Wrappers de onChange com máscara + marcação de edição manual.
  const markEdited = (k: string) => editedRef.current.add(k);
  const setCpf = (v: string) => {
    markEdited("cpf");
    updateDados({ cpf: formatCPF(v) });
    // Trocar CPF invalida qualquer checagem/bloqueio anterior.
    setError(null);
    setCpfCheck({ checking: false, existe: false, checked: null });
    update({ clienteExistente: false });
  };
  const setTel = (v: string) => { markEdited("telefone"); updateDados({ telefone: formatPhone(v) }); };
  const setNasc = (v: string) => { markEdited("data_nascimento"); updateDados({ data_nascimento: formatDateBR(v) }); };
  const setCep = (v: string) => { markEdited("endereco_cep"); updateDados({ endereco_cep: formatCEP(v) }); };
  const setEmail = (v: string) => {
    markEdited("email");
    updateDados({ email: v.toLowerCase().trim() });
    // Trocar e-mail nunca deve manter bloqueio antigo — CPF é o canônico.
    setError(null);
  };

  // Autobusca CEP ao atingir 8 dígitos.
  useEffect(() => {
    if (cepDigits.length !== 8) { setCepError(null); return; }
    let cancelled = false;
    (async () => {
      setCepError(null);
      const res = await lookupCep(cepDigits);
      if (cancelled) return;
      if (!res) { setCepError("CEP não encontrado. Preencha o endereço manualmente."); return; }
      const patch: Partial<CadastroRefinadoState["dadosPessoais"]> = {};
      if (res.street && !editedRef.current.has("endereco_logradouro") && !d.endereco_logradouro) patch.endereco_logradouro = res.street;
      if (res.neighborhood && !editedRef.current.has("endereco_bairro") && !d.endereco_bairro) patch.endereco_bairro = res.neighborhood;
      if (res.city && !editedRef.current.has("endereco_cidade") && !d.endereco_cidade) patch.endereco_cidade = res.city;
      if (res.state && !editedRef.current.has("endereco_estado") && !d.endereco_estado) patch.endereco_estado = String(res.state).toUpperCase().slice(0, 2);
      if (Object.keys(patch).length) updateDados(patch);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigits]);

  // Checagem proativa de CPF existente (debounced) — apenas se usuário não está logado.
  useEffect(() => {
    if (user) { setCpfCheck({ checking: false, existe: false, checked: null }); return; }
    if (cpfDigits.length !== 11) { setCpfCheck({ checking: false, existe: false, checked: null }); return; }
    if (cpfCheck.checked === cpfDigits) return;
    let cancelled = false;
    setCpfCheck({ checking: true, existe: false, checked: cpfDigits });
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("qa-cliente-checar-existente", {
          body: { cpf: cpfDigits },
        });
        if (cancelled) return;
        const existe = !!data?.cpf_existe;
        setCpfCheck({ checking: false, existe, checked: cpfDigits });
        update({ clienteExistente: existe });
      } catch {
        if (!cancelled) setCpfCheck({ checking: false, existe: false, checked: cpfDigits });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpfDigits, user]);

  function irParaLogin() {
    try {
      // Snapshot operacional silencioso para preservar o checkout antes do login.
      enviarSnapshotCadastroMira(state, "revisao_cliente", {
        snapshot_id: state.cadastro_mira_snapshot_id,
      }).catch(() => {});
    } catch { /* silencioso */ }
    const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
    navigate(`/area-do-cliente/login?next=${next}`);
  }

  async function handleContinue() {
    setError(null);
    if (!d.nome_completo.trim() || cpfDigits.length !== 11 || !isEmailValido(d.email)) {
      setError("Nome, CPF e e-mail são obrigatórios.");
      return;
    }
    if (telDigits.length && telDigits.length < 10) {
      setError("Telefone inválido. Use (00) 00000-0000.");
      return;
    }
    if (cepDigits.length && cepDigits.length !== 8) {
      setError("CEP inválido. Use 00000-000.");
      return;
    }
    // CPF já cadastrado e usuário não logado → bloquear e enviar para login.
    if (!user && cpfCheck.existe) {
      setError("Este CPF já possui cadastro. Faça login para continuar.");
      return;
    }
    setChecking(true);
    try {
      // Bug 1 fix preservado — checa se cliente já existe (CPF/email)
      const { data, error } = await supabase.functions.invoke("qa-cliente-checar-existente", {
        body: { cpf: cpfDigits, email: d.email.trim().toLowerCase() },
      });
      if (error) throw error;
      const cpfExiste = !!data?.cpf_existe;
      const emailExiste = !!data?.email_existe;
      // Bloqueio canônico: somente CPF. E-mail só bloqueia se a flag de teste estiver OFF.
      const bloqueia = cpfExiste || (emailExiste && !allowDuplicateEmailTest);
      update({ clienteExistente: cpfExiste });
      if (bloqueia && !user) {
        setChecking(false);
        if (cpfExiste) {
          setCpfCheck({ checking: false, existe: true, checked: cpfDigits });
          setError("Encontramos um cadastro para este CPF. Para proteger seus dados, faça login para continuar.");
        } else {
          setError("Encontramos um cadastro para este e-mail. Faça login para continuar de onde parou.");
        }
        return;
      }
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

  // Só bloqueia se a checagem mais recente corresponde ao CPF atual.
  const bloqueadoPorCpfExistente =
    !user && cpfCheck.existe && cpfCheck.checked === cpfDigits;
  const selo = veioDeIA ? "Extraído por IA · revise" : "Preenchimento manual";

  return (
    <QACadastroRefinadoShell
      step={3}
      eyebrow="ETAPA 03 · REVISÃO"
      title="Confira seus dados"
      subtitle={
        veioDeIA
          ? "Extraímos automaticamente o que conseguimos. Revise, edite o que for necessário e siga em frente."
          : "Preencha seus dados abaixo. Você pode editar tudo manualmente."
      }
      onBack={onBack}
    >
      <div className="qa-ref-section-card">
        <div className="qa-ref-section-head">
          <span className="qa-ref-section-title">Dados pessoais</span>
          <span className="qa-ref-section-tag">{selo}</span>
        </div>
        <div className="qa-ref-section-body">
          {field("Nome completo", "nome_completo", d.nome_completo, (v) => { markEdited("nome_completo"); updateDados({ nome_completo: v }); })}
          {field("CPF", "cpf", d.cpf, setCpf, {
            placeholder: "000.000.000-00",
            hint: cpfCheck.checking ? "Verificando CPF…" : undefined,
          })}
          {field("E-mail", "email", d.email, setEmail, { type: "email", placeholder: "voce@email.com" })}
          {field("Telefone (WhatsApp)", "telefone", d.telefone, setTel, { placeholder: "(11) 99999-9999" })}
          {field("Data de nascimento", "data_nascimento", d.data_nascimento, setNasc, { placeholder: "DD/MM/AAAA" })}
        </div>
        {bloqueadoPorCpfExistente && (
          <div
            className="qa-ref-error-text"
            style={{
              margin: "12px 16px 16px",
              padding: 12,
              border: "1px solid rgba(214,166,75,0.5)",
              background: "rgba(214,166,75,0.08)",
              borderRadius: 8,
              color: "#D6A64B",
            }}
          >
            <strong>Encontramos um cadastro para este CPF.</strong>
            <div style={{ marginTop: 4, opacity: 0.9 }}>
              Para proteger seus dados e continuar de onde parou, acesse sua conta.
            </div>
            <button
              type="button"
              className="qa-ref-btn qa-ref-btn-primary"
              style={{ marginTop: 12 }}
              onClick={irParaLogin}
            >
              Fazer login e continuar
            </button>
          </div>
        )}
      </div>

      <div className="qa-ref-section-card" style={{ marginTop: 16 }}>
        <div className="qa-ref-section-head">
          <span className="qa-ref-section-title">Endereço</span>
          <span className="qa-ref-section-tag">{selo}</span>
        </div>
        <div className="qa-ref-section-body">
          {field("CEP", "endereco_cep", d.endereco_cep, setCep, {
            placeholder: "00000-000",
            hint: cepLoading ? "Buscando endereço…" : cepError || undefined,
          })}
          {field("Logradouro", "endereco_logradouro", d.endereco_logradouro, (v) => { markEdited("endereco_logradouro"); updateDados({ endereco_logradouro: v }); })}
          {field("Número", "endereco_numero", d.endereco_numero, (v) => { markEdited("endereco_numero"); updateDados({ endereco_numero: v }); })}
          {field("Complemento", "endereco_complemento", d.endereco_complemento, (v) => { markEdited("endereco_complemento"); updateDados({ endereco_complemento: v }); })}
          {field("Bairro", "endereco_bairro", d.endereco_bairro, (v) => { markEdited("endereco_bairro"); updateDados({ endereco_bairro: v }); })}
          {field("Cidade", "endereco_cidade", d.endereco_cidade, (v) => { markEdited("endereco_cidade"); updateDados({ endereco_cidade: v }); })}
          {field("Estado (UF)", "endereco_estado", d.endereco_estado, (v) => { markEdited("endereco_estado"); updateDados({ endereco_estado: v.toUpperCase().slice(0, 2) }); })}
        </div>
      </div>

      {error && <div className="qa-ref-error-text">{error}</div>}

      <div style={{ marginTop: 28 }}>
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          disabled={checking || bloqueadoPorCpfExistente}
          onClick={handleContinue}
        >
          {checking ? "Validando…" : "Dados conferidos, continuar"}
        </button>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <QAReiniciarLink />
        </div>
      </div>
    </QACadastroRefinadoShell>
  );
}