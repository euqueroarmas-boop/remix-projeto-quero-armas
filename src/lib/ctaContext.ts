/**
 * Contextual CTA configuration per service category.
 * Used by FloatingCtaBar to show relevant actions based on current page.
 */
import { Shield, HardDrive, Monitor, Wifi, Brain, Mic, Server, Wrench, Headphones, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";

export interface CtaItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

export interface CtaContextConfig {
  patterns: string[];
  items: (t: TFunction) => CtaItem[];
}

const CTA_CONTEXTS: CtaContextConfig[] = [
  {
    patterns: ["/firewall", "/seguranca"],
    items: (t) => [
      { id: "diag-seg", label: t("cta.diagSeguranca"), shortLabel: t("cta.diagnostico"), icon: Shield, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-seg", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso avaliar a segurança da minha rede corporativa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-seg", label: t("cta.contratarServico"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/backup"],
    items: (t) => [
      { id: "diag-bkp", label: t("cta.diagRiscoDados"), shortLabel: t("cta.diagnostico"), icon: HardDrive, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "montar-bkp", label: t("cta.montarBackup"), shortLabel: t("cta.proposta"), icon: Server, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-bkp", label: t("cta.contratarServico"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/locacao"],
    items: (t) => [
      { id: "simular", label: t("cta.simularLocacao"), shortLabel: t("cta.simular"), icon: Monitor, href: "/locacao-de-computadores-para-empresas-jacarei", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-loc", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-loc", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Quero saber mais sobre locação de computadores para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/monitoramento"],
    items: (t) => [
      { id: "diag-mon", label: t("cta.solicitarDiagnostico"), shortLabel: t("cta.diagnostico"), icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-mon", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de monitoramento para minha infraestrutura.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-mon", label: t("cta.contratarMonitoramento"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/manutencao"],
    items: (t) => [
      { id: "diag-man", label: t("cta.solicitarDiagnostico"), shortLabel: t("cta.diagnostico"), icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-man", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de manutenção preventiva para minha infraestrutura de TI.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-man", label: t("cta.contratarManutencao"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/microsoft-365"],
    items: (t) => [
      { id: "diag-365", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-365", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Quero saber mais sobre Microsoft 365 para minha empresa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-365", label: t("cta.contratarM365"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/montagem", "/rede", "/infraestrutura", "/reestruturacao"],
    items: (t) => [
      { id: "diag-rede", label: t("cta.diagRede"), shortLabel: t("cta.diagnostico"), icon: Wifi, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "projeto-rede", label: t("cta.solicitarProjeto"), shortLabel: t("cta.projeto"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-rede", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de diagnóstico e projeto de rede para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/automacao-de-ti", "/automacao-ia"],
    items: (t) => [
      { id: "mapear-ia", label: t("cta.mapearIA"), shortLabel: t("cta.mapear"), icon: Brain, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-ia", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-ia", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Quero entender como automação com IA pode ajudar minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/automacao-alexa"],
    items: (t) => [
      { id: "auto-alexa", label: t("cta.automatizar"), shortLabel: t("cta.automatizarShort"), icon: Mic, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-alexa", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-alexa", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Quero saber mais sobre automação com Alexa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/suporte"],
    items: (t) => [
      { id: "diag-sup", label: t("cta.solicitarAnalise"), shortLabel: t("cta.analise"), icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-sup", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de suporte técnico para minha empresa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-sup", label: t("cta.contratarSuporte"), shortLabel: t("cta.contratar"), icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/servidor"],
    items: (t) => [
      { id: "diag-srv", label: t("cta.dimensionarServidor"), shortLabel: t("cta.dimensionar"), icon: Server, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-srv", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-srv", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de servidor Dell para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  {
    patterns: ["/ti-para-", "/ti-serventia"],
    items: (t) => [
      { id: "diag-seg2", label: t("cta.solicitarDiagnostico"), shortLabel: t("cta.diagnostico"), icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-seg2", label: t("cta.montarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-seg2", label: t("cta.falarEspecialista"), shortLabel: t("cta.especialista"), icon: Headphones, href: "whatsapp:Preciso de TI especializada para meu segmento.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
];

const DEFAULT_ITEMS = (t: TFunction): CtaItem[] => [
  { id: "calcular", label: t("cta.calcularTI"), shortLabel: t("cta.calcular"), icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  { id: "locacao", label: t("cta.simularLocacao"), shortLabel: t("cta.locacaoShort"), icon: Monitor, href: "/locacao-de-computadores-para-empresas-jacarei", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { id: "proposta", label: t("cta.solicitarProposta"), shortLabel: t("cta.proposta"), icon: FileText, href: "/orcamento-ti", color: "bg-sky-600 hover:bg-sky-700 text-white" },
];

/**
 * Returns contextual CTA items based on the current pathname.
 * Now accepts a t() function for i18n.
 */
export function getCtaItemsForPath(pathname: string, t?: TFunction): CtaItem[] {
  if (!t) {
    // Fallback without translation (should not happen in practice)
    return [];
  }
  for (const ctx of CTA_CONTEXTS) {
    if (ctx.patterns.some((p) => pathname.includes(p))) {
      return ctx.items(t);
    }
  }
  return DEFAULT_ITEMS(t);
}
