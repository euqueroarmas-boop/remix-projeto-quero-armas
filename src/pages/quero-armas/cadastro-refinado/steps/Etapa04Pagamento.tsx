import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import ContractPreviewCard from "../components/ContractPreviewCard";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const PAY_OPTIONS: { id: CadastroRefinadoState["formaPagamento"]; nome: string; hint: string }[] = [
  { id: "pix", nome: "PIX", hint: "Aprovação imediata. Recomendado." },
  { id: "cartao", nome: "Cartão de crédito", hint: "Em até 12x. Aprovação imediata." },
  { id: "boleto", nome: "Boleto bancário", hint: "Compensação em até 2 dias úteis." },
];

export default function Etapa04Pagamento({ state, update, onNext, onBack }: Props) {
  const navigate = useNavigate();
  const [preco, setPreco] = useState<number>(0);
  const [nomeServico, setNomeServico] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.servicoSlug) return;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("preco, nome")
        .eq("slug", state.servicoSlug)
        .maybeSingle();
      setPreco(Number(data?.preco) || 0);
      setNomeServico((data as any)?.nome ?? null);
    })();
  }, [state.servicoSlug]);

  const labelBtn = (() => {
    const v = `R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (state.formaPagamento === "pix") return `Gerar PIX e assinar contrato — ${v}`;
    if (state.formaPagamento === "cartao") return `Pagar com cartão e assinar contrato — ${v}`;
    return `Gerar boleto e assinar contrato — ${v}`;
  })();

  async function handleSubmit() {
    setError(null);
    if (!state.aceiteContrato) {
      setError("É necessário aceitar o contrato e a política de privacidade.");
      return;
    }
    setSubmitting(true);
    try {
      const d = state.dadosPessoais;
      // Bug 2 fix preservado — qa-cliente-criar-conta-publica dispara as notificações
      const { data, error } = await supabase.functions.invoke("qa-cliente-criar-conta-publica", {
        body: {
          nome_completo: d.nome_completo,
          cpf: d.cpf.replace(/\D/g, ""),
          email: d.email.trim().toLowerCase(),
          telefone: d.telefone,
          data_nascimento: d.data_nascimento,
          endereco: {
            cep: d.endereco_cep,
            logradouro: d.endereco_logradouro,
            numero: d.endereco_numero,
            complemento: d.endereco_complemento,
            bairro: d.endereco_bairro,
            cidade: d.endereco_cidade,
            estado: d.endereco_estado,
          },
          servico_slug: state.servicoSlug,
          origem: state.origem || "cadastro_refinado",
          documentos: state.documentos,
        },
      });
      if (error) throw error;

      const cliente_id = data?.cliente_id;
      const venda_id = data?.venda_id;
      const solicitacao_id = data?.solicitacao_id;
      const numero_processo = data?.numero_processo;

      update({
        resultado: { cliente_id, venda_id, solicitacao_id, numero_processo },
        clienteExistente: !!data?.cpf_ja_possui_login || state.clienteExistente,
      });

      // Registro probatório do aceite eletrônico (não bloqueia o checkout)
      try {
        const { error: aceiteErr } = await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id,
            venda_id,
            solicitacao_id,
            servico_slug: state.servicoSlug,
            servico_preco: preco,
            dados_pessoais: state.dadosPessoais,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            template_codigo: "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
          },
        });
        if (aceiteErr) throw aceiteErr;
      } catch (aceiteFail: any) {
        console.warn("[Etapa04] qa-contract-aceite-registrar falhou:", aceiteFail);
        try {
          await supabase.functions.invoke("qa-notificar-admin-contratacao", {
            body: {
              motivo: "aceite_registro_falhou",
              cliente_id,
              venda_id,
              servico_slug: state.servicoSlug,
              erro: aceiteFail?.message || String(aceiteFail),
            },
          });
        } catch (notifyErr) {
          console.warn("[Etapa04] notificação de falha de aceite também falhou:", notifyErr);
        }
      }

      // Encaminha ao pipeline de pagamento existente (Asaas + contrato)
      // — reaproveita 100% do fluxo /area-do-cliente/contratar/{slug}/confirmar
      const slug = state.servicoSlug!;
      const params = new URLSearchParams({
        forma_pagamento: state.formaPagamento,
        origem: "cadastro_refinado",
      });
      if (cliente_id) params.set("cliente_id", cliente_id);
      if (venda_id) params.set("venda_id", venda_id);
      if (solicitacao_id) params.set("solicitacao_id", solicitacao_id);
      navigate(`/area-do-cliente/contratar/${slug}/confirmar?${params.toString()}`);
    } catch (e: any) {
      setError(e?.message || "Não foi possível processar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <QACadastroRefinadoShell
      step={4}
      eyebrow="ETAPA 04 · PAGAMENTO E CONTRATO"
      title="Escolha como pagar"
      subtitle="Após a confirmação você assina o contrato digitalmente e libera o início do serviço."
      onBack={onBack}
    >
      <div className="qa-ref-total">
        <div>
          <div className="qa-ref-total-label">Total a pagar</div>
          <div className="qa-ref-caps" style={{ marginTop: 4 }}>1 serviço selecionado</div>
        </div>
        <div className="qa-ref-total-value">
          R$ {preco.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
      </div>

      <div className="qa-ref-pay-list">
        {PAY_OPTIONS.map((opt) => (
          <label key={opt.id} className={`qa-ref-pay-opt ${state.formaPagamento === opt.id ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="forma_pagamento"
              value={opt.id}
              checked={state.formaPagamento === opt.id}
              onChange={() => update({ formaPagamento: opt.id })}
            />
            <div>
              <div className="qa-ref-pay-name">{opt.nome}</div>
              <div className="qa-ref-pay-hint">{opt.hint}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <ContractPreviewCard state={state} precoServico={preco} nomeServico={nomeServico} />
      </div>

      <label className="qa-ref-checkbox-row">
        <input
          type="checkbox"
          checked={state.aceiteContrato}
          onChange={(e) => update({ aceiteContrato: e.target.checked })}
        />
        <span>
          Li e aceito o <a href="/termos" target="_blank" rel="noreferrer">contrato de prestação de serviços</a>
          {" "}e a <a href="/privacidade" target="_blank" rel="noreferrer">política de privacidade</a> (LGPD).
        </span>
      </label>
      <p className="qa-ref-aceite-fineprint">
        Ao prosseguir, o aceite eletrônico será registrado com data, hora, IP e identificação do dispositivo,
        na forma da MP 2.200-2/2001 e Lei 14.063/2020. Para os atos perante PF/Exército/órgãos competentes,
        será solicitada assinatura digital ICP-Brasil em momento posterior.
      </p>

      {error && <div className="qa-ref-error-text">{error}</div>}

      <div style={{ marginTop: 28 }}>
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          disabled={submitting || !state.aceiteContrato}
          onClick={handleSubmit}
        >
          {submitting ? "Processando…" : labelBtn}
        </button>
      </div>
    </QACadastroRefinadoShell>
  );
}