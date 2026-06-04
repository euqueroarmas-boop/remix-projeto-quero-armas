import { ReactNode, useMemo } from "react";
import QACadastroRefinadoHeader from "./QACadastroRefinadoHeader";
import QACadastroRefinadoFooter from "./QACadastroRefinadoFooter";
import QACadastroRefinadoStepIndicator from "./QACadastroRefinadoStepIndicator";

interface Props {
  step: number;
  total?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  children: ReactNode;
}

function serviceNameFromSlug(slug: string | null) {
  if (!slug) return "Serviço definido no diagnóstico";
  if (slug.includes(",")) return "Pacote de serviços selecionado";
  const names: Record<string, string> = {
    "concessao-cr": "Concessão de CR",
    "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac": "Autorização de compra CAC",
    "registro-e-apostilamento-de-arma-de-fogo-cac": "Registro e apostilamento CAC",
    "guia-de-trafego-especial-cac": "GTE para CAC",
    "aquisicao-registro-posse-de-arma-de-fogo": "Aquisição, registro e posse",
    "renovacao-posse-de-arma-de-fogo": "Renovação de posse",
    "porte-arma-fogo": "Porte de arma de fogo",
    "operador-de-pistola-nivel-i": "Operador de pistola nível I",
  };
  return names[slug] || slug.split("-").filter(Boolean).join(" ");
}

function readJourneyState() {
  if (typeof window === "undefined") {
    return { service: null as string | null, origem: null as string | null, modoCliente: null as string | null };
  }
  const params = new URLSearchParams(window.location.search);
  const urlService = params.get("servico");
  try {
    const raw = sessionStorage.getItem("qa_cadastro_refinado_state");
    const parsed = raw ? JSON.parse(raw) : {};
    const storedService = Array.isArray(parsed.servicosSlugs) && parsed.servicosSlugs.length > 0
      ? parsed.servicosSlugs.join(",")
      : parsed.servicoSlug;
    return {
      service: urlService || storedService || null,
      origem: params.get("origem") || parsed.origem || null,
      modoCliente: parsed.modo_cliente || null,
    };
  } catch {
    return { service: urlService || null, origem: params.get("origem"), modoCliente: null };
  }
}

export default function QACadastroRefinadoShell({
  step,
  total = 6,
  eyebrow,
  title,
  subtitle,
  onBack,
  showBack = true,
  children,
}: Props) {
  const journey = useMemo(() => readJourneyState(), [step]);
  const serviceName = serviceNameFromSlug(journey.service);
  const isLogged = journey.modoCliente === "autenticado";
  const items = [
    { n: 1, label: "Caminho escolhido", detail: serviceName, active: step >= 1 },
    { n: 2, label: "Documentos e dados", detail: "Enviar ou preencher manualmente", active: step >= 2 },
    { n: 3, label: "Revisão do cadastro", detail: "Dados reaproveitados ou digitados", active: step >= 3 },
    { n: 4, label: "Contrato e pagamento", detail: "Aceite, cobrança e assinatura", active: step >= 4 },
    {
      n: 5,
      label: isLogged ? "Arsenal conectado" : "Arsenal Inteligente",
      detail: isLogged ? "Cliente já logado, sem criar acesso duplicado" : "Conta criada ou liberada ao concluir",
      active: step >= 5,
    },
  ];

  return (
    <div className="qa-refinado">
      <QACadastroRefinadoHeader onBack={onBack} showBack={showBack} step={step} total={total} />
      <main className="qa-ref-shell">
        <div className="qa-ref-integrated-grid">
          <div className="qa-ref-integrated-main">
            <QACadastroRefinadoStepIndicator current={step} total={total} />
            {eyebrow && <span className="qa-ref-caps qa-ref-eyebrow">{eyebrow}</span>}
            <h1 className="qa-ref-title">{title}</h1>
            {subtitle && <p className="qa-ref-subtitle">{subtitle}</p>}
            <div className="qa-ref-section">{children}</div>
          </div>
          <aside className="qa-ref-journey" aria-label="Resumo do caminho do cliente">
            <div className="qa-ref-journey-kicker">Jornada do cliente</div>
            <h2 className="qa-ref-journey-title">Do diagnóstico ao Arsenal</h2>
            <p className="qa-ref-journey-desc">
              O cliente segue no mesmo fluxo até a conclusão do checkout. Nada é perdido entre documentos, dados, contrato, pagamento e acesso.
            </p>
            <ol className="qa-ref-journey-list">
              {items.map((item) => (
                <li key={item.n} className={item.active ? "is-active" : ""}>
                  <span className="qa-ref-journey-num">{item.n}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </main>
      <QACadastroRefinadoFooter />
    </div>
  );
}
