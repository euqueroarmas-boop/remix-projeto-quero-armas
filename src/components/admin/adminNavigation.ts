import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Brain,
  Calculator,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  FileSignature,
  FileText,
  FlaskConical,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  MapPin,
  Megaphone,
  MessageSquareCode,
  PenTool,
  ScrollText,
  ShieldAlert,
  Stethoscope,
  TestTube2,
  UserCog,
  Webhook,
  Wrench,
} from "lucide-react";

export interface AdminNavItem {
  id: string;
  route: string;
  label: string;
  icon: LucideIcon;
  aliases?: string[];
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { id: "dashboard", route: "", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "logs", route: "logs", label: "Logs", icon: ScrollText },
      { id: "errors", route: "errors", label: "Erros", icon: AlertTriangle },
      { id: "payments", route: "payments", label: "Pagamentos", icon: CreditCard },
      { id: "financeiro", route: "financeiro", label: "Financeiro", icon: DollarSign },
      { id: "invoices", route: "notas-fiscais", label: "Notas Fiscais", icon: FileText, aliases: ["invoices"] },
      { id: "clientes", route: "clientes", label: "Clientes", icon: UserCog },
      { id: "leads", route: "leads", label: "Leads & Propostas", icon: Megaphone },
      { id: "cipa-locations", route: "cipa-locations", label: "CIPA Geo", icon: MapPin },
    ],
  },
  {
    label: "Segurança",
    items: [
      { id: "security", route: "security", label: "Eventos", icon: ShieldAlert },
      { id: "webhooks", route: "webhooks", label: "Webhooks", icon: Webhook },
      { id: "audit", route: "audit", label: "Auditoria", icon: ClipboardCheck },
      { id: "fiscal-audit", route: "fiscal-audit", label: "Auditoria Fiscal", icon: ClipboardCheck },
      { id: "risk", route: "risk", label: "Monitor de Risco", icon: Activity },
    ],
  },
  {
    label: "Qualidade & Conteúdo",
    items: [
      { id: "diagnostics", route: "diagnostics", label: "Diagnóstico", icon: Stethoscope },
      { id: "qa", route: "qa", label: "QA", icon: FlaskConical },
      { id: "test-center", route: "test-center", label: "Centro de Testes", icon: TestTube2 },
      { id: "blog-ai", route: "blog-ai", label: "Blog IA", icon: PenTool },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { id: "prompt-intelligence", route: "prompt-intelligence", label: "Prompt Intelligence", icon: Brain },
      { id: "revenue-intelligence", route: "revenue-intelligence", label: "Receita", icon: DollarSign },
      { id: "dev-chat", route: "dev-chat", label: "DevChat", icon: MessageSquareCode },
    ],
  },
  {
    label: "CMS",
    items: [
      { id: "services-builder", route: "services-builder", label: "Serviços", icon: Wrench },
      { id: "segments-builder", route: "segments-builder", label: "Segmentos", icon: Layers },
      { id: "pricing-engine", route: "pricing-engine", label: "Precificação", icon: Calculator },
      { id: "block-library", route: "block-library", label: "Blocos", icon: LayoutGrid },
      { id: "sitemap-manager", route: "sitemap-manager", label: "Sitemap", icon: Globe },
    ],
  },
  {
    label: "Configurações",
    items: [
      { id: "digital-signature", route: "digital-signature", label: "Assinatura Digital", icon: FileSignature },
      { id: "cert-diagnostic", route: "cert-diagnostic", label: "Diag. Certificado", icon: Stethoscope },
    ],
  },
];

const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

const ADMIN_ROUTE_TO_SECTION = new Map<string, string>(
  ADMIN_NAV_ITEMS.flatMap((item) => [
    [item.id, item.id] as const,
    [item.route, item.id] as const,
    ...((item.aliases ?? []).map((alias) => [alias, item.id] as const)),
  ])
);

const ADMIN_SECTION_TO_ROUTE = new Map<string, string>(
  ADMIN_NAV_ITEMS.map((item) => [item.id, item.route] as const)
);

const ADMIN_SECTION_TO_LABEL = new Map<string, string>(
  ADMIN_NAV_ITEMS.map((item) => [item.id, item.label] as const)
);

export function resolveAdminSection(section?: string) {
  if (!section) return "dashboard";
  return ADMIN_ROUTE_TO_SECTION.get(section) ?? null;
}

export function getAdminRoute(sectionId: string) {
  if (sectionId === "dashboard") return "/admin";
  return `/admin/${ADMIN_SECTION_TO_ROUTE.get(sectionId) ?? sectionId}`;
}

export function getAdminLabel(sectionId: string) {
  return ADMIN_SECTION_TO_LABEL.get(sectionId) ?? "Dashboard";
}
