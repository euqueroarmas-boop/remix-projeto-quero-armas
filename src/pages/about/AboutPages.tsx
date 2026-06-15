import { InfoPageTemplate } from "./InfoPageTemplate";
import { infoPages } from "./infoPages";

export function QuemSomosPage() {
  return <InfoPageTemplate page={infoPages.quemSomos} />;
}

export function ComoFuncionaPage() {
  return <InfoPageTemplate page={infoPages.comoFunciona} />;
}

export function AtendimentoNacionalPage() {
  return <InfoPageTemplate page={infoPages.atendimentoNacional} />;
}

export function LimitesResponsabilidadesPage() {
  return <InfoPageTemplate page={infoPages.limitesResponsabilidades} />;
}

export function TermosPage() {
  return <InfoPageTemplate page={infoPages.termos} />;
}

export function PrivacidadePage() {
  return <InfoPageTemplate page={infoPages.privacidade} />;
}
