/**
 * Contextual CTA configuration per service category.
 * Used by FloatingCtaBar to show relevant actions based on current page.
 */
import { Shield, HardDrive, Monitor, Wifi, Brain, Mic, Server, Wrench, Headphones, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CtaItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

export interface CtaContextConfig {
  /** Route prefix or exact match patterns */
  patterns: string[];
  items: CtaItem[];
}

const CTA_CONTEXTS: CtaContextConfig[] = [
  // Firewall / Segurança
  {
    patterns: ["/firewall", "/seguranca"],
    items: [
      { id: "diag-seg", label: "Diagnosticar segurança", shortLabel: "Diagnóstico", icon: Shield, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-seg", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso avaliar a segurança da minha rede corporativa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-seg", label: "Contratar este serviço", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Backup
  {
    patterns: ["/backup"],
    items: [
      { id: "diag-bkp", label: "Diagnosticar risco de dados", shortLabel: "Diagnóstico", icon: HardDrive, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "montar-bkp", label: "Montar solução de backup", shortLabel: "Proposta", icon: Server, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-bkp", label: "Contratar este serviço", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Locação
  {
    patterns: ["/locacao"],
    items: [
      { id: "simular", label: "Simular locação", shortLabel: "Simular", icon: Monitor, href: "/locacao-de-computadores-para-empresas-jacarei", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-loc", label: "Solicitar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-loc", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Quero saber mais sobre locação de computadores para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Monitoramento
  {
    patterns: ["/monitoramento"],
    items: [
      { id: "diag-mon", label: "Solicitar diagnóstico", shortLabel: "Diagnóstico", icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-mon", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de monitoramento para minha infraestrutura.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-mon", label: "Contratar monitoramento", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Manutenção
  {
    patterns: ["/manutencao"],
    items: [
      { id: "diag-man", label: "Solicitar diagnóstico", shortLabel: "Diagnóstico", icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-man", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de manutenção preventiva para minha infraestrutura de TI.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-man", label: "Contratar manutenção", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Microsoft 365
  {
    patterns: ["/microsoft-365"],
    items: [
      { id: "diag-365", label: "Solicitar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-365", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Quero saber mais sobre Microsoft 365 para minha empresa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-365", label: "Contratar Microsoft 365", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Redes / Montagem / Infraestrutura
  {
    patterns: ["/montagem", "/rede", "/infraestrutura", "/reestruturacao"],
    items: [
      { id: "diag-rede", label: "Diagnosticar rede", shortLabel: "Diagnóstico", icon: Wifi, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "projeto-rede", label: "Solicitar projeto", shortLabel: "Projeto", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-rede", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de diagnóstico e projeto de rede para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Automação IA
  {
    patterns: ["/automacao-de-ti", "/automacao-ia"],
    items: [
      { id: "mapear-ia", label: "Mapear automação possível", shortLabel: "Mapear", icon: Brain, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-ia", label: "Solicitar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-ia", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Quero entender como automação com IA pode ajudar minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Alexa
  {
    patterns: ["/automacao-alexa"],
    items: [
      { id: "auto-alexa", label: "Automatizar meu espaço", shortLabel: "Automatizar", icon: Mic, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-alexa", label: "Solicitar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-alexa", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Quero saber mais sobre automação com Alexa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Suporte
  {
    patterns: ["/suporte"],
    items: [
      { id: "diag-sup", label: "Solicitar análise", shortLabel: "Análise", icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "falar-sup", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de suporte técnico para minha empresa.", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "contratar-sup", label: "Contratar suporte", shortLabel: "Contratar", icon: FileText, href: "contratar", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Servidores Dell
  {
    patterns: ["/servidor"],
    items: [
      { id: "diag-srv", label: "Dimensionar servidor", shortLabel: "Dimensionar", icon: Server, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-srv", label: "Solicitar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-srv", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de servidor Dell para minha empresa.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
  // Segmentos (cartórios, contabilidades, escritórios, etc.)
  {
    patterns: ["/ti-para-", "/ti-serventia"],
    items: [
      { id: "diag-seg2", label: "Solicitar diagnóstico", shortLabel: "Diagnóstico", icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
      { id: "proposta-seg2", label: "Montar proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
      { id: "falar-seg2", label: "Falar com especialista", shortLabel: "Especialista", icon: Headphones, href: "whatsapp:Preciso de TI especializada para meu segmento.", color: "bg-sky-600 hover:bg-sky-700 text-white" },
    ],
  },
];

/** Default fallback CTA items */
const DEFAULT_ITEMS: CtaItem[] = [
  { id: "calcular", label: "Calcular TI", shortLabel: "Calcular", icon: Wrench, href: "/orcamento-ti", color: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  { id: "locacao", label: "Simular Locação", shortLabel: "Locação", icon: Monitor, href: "/locacao-de-computadores-para-empresas-jacarei", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { id: "proposta", label: "Solicitar Proposta", shortLabel: "Proposta", icon: FileText, href: "/orcamento-ti", color: "bg-sky-600 hover:bg-sky-700 text-white" },
];

/**
 * Returns contextual CTA items based on the current pathname.
 * Falls back to generic items if no match found.
 */
export function getCtaItemsForPath(pathname: string): CtaItem[] {
  for (const ctx of CTA_CONTEXTS) {
    if (ctx.patterns.some((p) => pathname.includes(p))) {
      return ctx.items;
    }
  }
  return DEFAULT_ITEMS;
}
