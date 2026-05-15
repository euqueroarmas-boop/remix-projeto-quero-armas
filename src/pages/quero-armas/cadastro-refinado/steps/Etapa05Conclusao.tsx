import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  onReset: () => void;
}

export default function Etapa05Conclusao({ state, onReset }: Props) {
  const navigate = useNavigate();
  const r = state.resultado || {};
  const primeiroNome = (state.dadosPessoais.nome_completo || "").split(" ")[0] || "tudo certo";

  return (
    <QACadastroRefinadoShell
      step={5}
      eyebrow="ETAPA 05 · CONCLUSÃO"
      title={`Tudo certo, ${primeiroNome}`}
      subtitle="Sua contratação foi registrada. Em instantes você receberá os próximos passos por e-mail e WhatsApp."
      showBack={false}
    >
      <div style={{ textAlign: "center" }}>
        <div className="qa-ref-check"><Check size={28} /></div>
      </div>

      <dl className="qa-ref-ficha">
        <div className="qa-ref-ficha-row">
          <dt>Serviço</dt>
          <dd>{state.servicoSlug || "—"}</dd>
        </div>
        {r.numero_processo && (
          <div className="qa-ref-ficha-row">
            <dt>Processo</dt>
            <dd className="qa-ref-mono">{r.numero_processo}</dd>
          </div>
        )}
        <div className="qa-ref-ficha-row">
          <dt>Pagamento</dt>
          <dd>{state.formaPagamento.toUpperCase()}</dd>
        </div>
        <div className="qa-ref-ficha-row">
          <dt>Status</dt>
          <dd>Aguardando confirmação</dd>
        </div>
      </dl>

      <div className="qa-ref-banner" style={{ marginTop: 20 }}>
        <div>
          <strong>Acesso enviado</strong> — verifique seu e-mail e WhatsApp para entrar no Arsenal Inteligente e acompanhar tudo em tempo real.
        </div>
      </div>

      <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
        <button
          className="qa-ref-btn qa-ref-btn-primary"
          onClick={() => { onReset(); navigate("/area-do-cliente"); }}
        >
          Acessar meu Arsenal
        </button>
        {state.clienteExistente ? (
          <>
            <button className="qa-ref-btn qa-ref-btn-ghost" onClick={() => navigate("/area-do-cliente/login")}>
              Fazer login
            </button>
            <button
              className="qa-ref-btn-link"
              type="button"
              style={{ display: "block", textAlign: "center" }}
              onClick={() => navigate("/redefinir-senha")}
            >
              Esqueci minha senha
            </button>
          </>
        ) : (
          <button className="qa-ref-btn qa-ref-btn-ghost" disabled>
            Baixar contrato assinado (em instantes)
          </button>
        )}
      </div>
    </QACadastroRefinadoShell>
  );
}