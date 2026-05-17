import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import type { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  updateDados: (patch: Partial<CadastroRefinadoState["dadosPessoais"]>) => void;
  onNovo: () => void;
  onAutenticado: () => void;
  onBack?: () => void;
}

type Choice = null | "ja_tem" | "novo" | "nao_sei";
type Phase = "escolha" | "identificar" | "codigo" | "carregando" | "erro";

const GENERIC_MSG =
  "Se encontrarmos uma conta, enviaremos um código de acesso para o e-mail vinculado ao seu cadastro.";

export default function Etapa00Identificacao({
  state,
  update,
  updateDados,
  onNovo,
  onAutenticado,
  onBack,
}: Props) {
  const [choice, setChoice] = useState<Choice>(null);
  const [phase, setPhase] = useState<Phase>("escolha");
  const [identificador, setIdentificador] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function escolher(c: Choice) {
    setChoice(c);
    setErrorMsg(null);
    setInfo(null);
    if (c === "novo") {
      update({ modo_cliente: "novo" });
      onNovo();
      return;
    }
    setPhase("identificar");
  }

  async function enviarCodigo() {
    if (!identificador.trim()) {
      setErrorMsg("Informe seu e-mail, CPF ou CNPJ.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setInfo(null);
    update({ modo_cliente: "verificando" });
    try {
      const { data, error } = await supabase.functions.invoke(
        "cliente-portal-request-otp",
        { body: { identificador: identificador.trim() } },
      );
      if (error) throw new Error(error.message || "Falha ao solicitar código");
      // resposta genérica: nunca confirmamos existência antes do OTP
      if (data?.success && data?.otp_id) {
        setOtpId(data.otp_id);
        setInfo(GENERIC_MSG);
        setPhase("codigo");
      } else if (data?.not_found) {
        // anti-enumeração: para "não sei" → vira novo silenciosamente
        if (choice === "nao_sei") {
          update({ modo_cliente: "novo" });
          onNovo();
          return;
        }
        setInfo(
          "Não encontramos uma conta com esses dados. Você pode continuar criando um cadastro novo.",
        );
        setPhase("erro");
      } else if (data?.require_email) {
        setErrorMsg(
          "Encontramos seu cadastro, mas precisamos de um e-mail válido. Informe seu e-mail.",
        );
      } else {
        setInfo(GENERIC_MSG);
        setPhase("codigo");
      }
    } catch (e) {
      setErrorMsg((e as Error).message || "Erro ao enviar código.");
    } finally {
      setBusy(false);
    }
  }

  async function validarCodigo() {
    if (!otpId || code.trim().length < 4) {
      setErrorMsg("Informe o código recebido.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "cliente-portal-verify-otp",
        { body: { otp_id: otpId, code: code.trim() } },
      );
      if (error) throw new Error(error.message || "Falha ao validar código");
      if (data?.awaiting_admin) {
        setInfo(
          data.message ||
            "Solicitação enviada para aprovação. Você receberá uma confirmação por e-mail.",
        );
        setPhase("erro");
        return;
      }
      if (!data?.success || !data?.email || !data?.temp_password) {
        throw new Error(data?.error || "Não foi possível validar o código.");
      }
      // Autentica via senha temporária para obter JWT
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.temp_password,
      });
      if (signErr) throw new Error(signErr.message);

      setPhase("carregando");

      // Carrega dados do cliente (Arsenal) usando o JWT recém-obtido
      const { data: payload, error: loadErr } = await supabase.functions.invoke(
        "qa-cadastro-carregar-cliente",
        { body: {} },
      );
      if (loadErr) throw new Error(loadErr.message || "Erro ao carregar dados");

      const cli = payload?.cliente || {};
      updateDados({
        nome_completo: cli.nome_completo || state.dadosPessoais.nome_completo,
        cpf: cli.cpf || state.dadosPessoais.cpf,
        email: cli.email || data.email,
        telefone: cli.celular || state.dadosPessoais.telefone,
        data_nascimento: cli.data_nascimento || state.dadosPessoais.data_nascimento,
        endereco_cep: cli.cep || state.dadosPessoais.endereco_cep,
        endereco_logradouro: cli.endereco || state.dadosPessoais.endereco_logradouro,
        endereco_numero: cli.numero || state.dadosPessoais.endereco_numero,
        endereco_complemento: cli.complemento || state.dadosPessoais.endereco_complemento,
        endereco_bairro: cli.bairro || state.dadosPessoais.endereco_bairro,
        endereco_cidade: cli.cidade || state.dadosPessoais.endereco_cidade,
        endereco_estado: cli.estado || state.dadosPessoais.endereco_estado,
      });
      update({
        modo_cliente: "autenticado",
        cliente_existente_id: cli.id ? String(cli.id) : null,
        dados_carregados_do_arsenal: true,
        documentos_reaproveitados: payload?.documentos_validos || [],
        documentos_vencidos: payload?.documentos_vencidos || [],
        documentos_pendentes_revisao: payload?.documentos_pendentes || [],
        servicos_anteriores: payload?.servicos_anteriores || [],
        processos_ativos: payload?.processos_ativos || [],
        contratos_existentes: payload?.contratos_existentes || [],
        arsenal_resumo: payload?.arsenal_resumo || null,
      });
      onAutenticado();
    } catch (e) {
      setErrorMsg((e as Error).message || "Erro ao validar código.");
      setPhase("codigo");
    } finally {
      setBusy(false);
    }
  }

  const eyebrow = "Identificação";
  const title = "VOCÊ JÁ TEM CONTA NO ARSENAL INTELIGENTE?";
  const subtitle =
    "Se você já é cliente, eu busco seus dados, documentos e serviços para você não preencher tudo de novo.";

  return (
    <QACadastroRefinadoShell
      step={0}
      total={6}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      showBack={Boolean(onBack)}
    >
      {phase === "escolha" && (
        <div className="qa-ref-opt-list">
          {[
            {
              key: "ja_tem",
              titulo: "SIM, JÁ TENHO CONTA",
              desc: "Entrar e reaproveitar meus dados",
            },
            {
              key: "novo",
              titulo: "NÃO, QUERO COMEÇAR AGORA",
              desc: "Criar cadastro novo",
            },
            {
              key: "nao_sei",
              titulo: "NÃO SEI",
              desc: "Vamos verificar com segurança",
            },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="qa-ref-opt-card"
              onClick={() => escolher(opt.key as Choice)}
            >
              <div className="qa-ref-opt-meta">
                <span className="qa-ref-opt-title">{opt.titulo}</span>
                <span className="qa-ref-opt-desc">{opt.desc}</span>
              </div>
              <span className="qa-ref-opt-arrow" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}

      {(phase === "identificar" || phase === "codigo" || phase === "erro") && (
        <div className="qa-ref-id-form">
          <button
            type="button"
            className="qa-ref-link-btn"
            onClick={() => {
              setPhase("escolha");
              setOtpId(null);
              setCode("");
              setErrorMsg(null);
              setInfo(null);
            }}
          >
            ← Voltar para opções
          </button>

          {phase === "identificar" && (
            <>
              <label className="qa-ref-label">E-mail, CPF ou CNPJ</label>
              <input
                className="qa-ref-input"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="seu@email.com  ou  000.000.000-00"
                disabled={busy}
                autoComplete="email"
              />
              {info && <p className="qa-ref-helper">{info}</p>}
              {errorMsg && <p className="qa-ref-error">{errorMsg}</p>}
              <button
                type="button"
                className="qa-ref-cta"
                onClick={enviarCodigo}
                disabled={busy}
              >
                {busy ? "Enviando…" : "ENVIAR CÓDIGO"}
              </button>
              <p className="qa-ref-helper qa-ref-helper-muted">{GENERIC_MSG}</p>
            </>
          )}

          {phase === "codigo" && (
            <>
              <p className="qa-ref-helper">{info || GENERIC_MSG}</p>
              <label className="qa-ref-label">Código recebido</label>
              <input
                className="qa-ref-input qa-ref-input-otp"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                disabled={busy}
              />
              {errorMsg && <p className="qa-ref-error">{errorMsg}</p>}
              <button
                type="button"
                className="qa-ref-cta"
                onClick={validarCodigo}
                disabled={busy}
              >
                {busy ? "Validando…" : "VALIDAR E CARREGAR DADOS"}
              </button>
            </>
          )}

          {phase === "erro" && (
            <>
              <p className="qa-ref-helper">{info || errorMsg}</p>
              <button
                type="button"
                className="qa-ref-cta"
                onClick={() => {
                  update({ modo_cliente: "novo" });
                  onNovo();
                }}
              >
                CONTINUAR COM CADASTRO NOVO
              </button>
            </>
          )}
        </div>
      )}

      {phase === "carregando" && (
        <p className="qa-ref-helper">Carregando seus dados do Arsenal Inteligente…</p>
      )}
    </QACadastroRefinadoShell>
  );
}
