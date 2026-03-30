import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminQuerySingle, adminQuery } from "@/lib/adminApi";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  ADMIN_SESSION_EXPIRED_MESSAGE,
  clearAdminSession,
  getValidAdminToken,
  saveAdminToken,
} from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, AlertTriangle, CreditCard, FileText, LogOut, RefreshCw, ChevronLeft, ChevronRight, Eye, Users, Plus, Loader2, Check, Copy, Shield,
  LayoutDashboard, ScrollText, CreditCard as CreditCardIcon, UserCog, Megaphone, ShieldAlert, Webhook, ClipboardCheck, Activity, Stethoscope, FlaskConical, PenTool, TestTube2, Brain, DollarSign, MessageSquareCode,
  Search, Bell, ChevronDown, PanelLeftClose, PanelLeft, Menu, Settings, FileSignature,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { StatusPill, SectionHeader, DataPanel } from "@/components/admin/ui/AdminPrimitives";
import AdminSecurityEvents from "@/components/admin/AdminSecurityEvents";
import AdminWebhooks from "@/components/admin/AdminWebhooks";
import AdminAudit from "@/components/admin/AdminAudit";
import AdminRiskMonitor from "@/components/admin/AdminRiskMonitor";
import AdminLeadsProposals from "@/components/admin/AdminLeadsProposals";
import AdminDiagnostics from "@/components/admin/AdminDiagnostics";
import AdminCommandCenter from "@/components/admin/AdminCommandCenter";
import AdminFullscreenMenu from "@/components/admin/AdminFullscreenMenu";
import LogFullscreenViewer from "@/components/admin/LogFullscreenViewer";
import { cn } from "@/lib/utils";

const QAPanel = lazy(() => import("@/components/admin/qa/QAPanel"));
const AdminBlogGenerator = lazy(() => import("@/components/admin/AdminBlogGenerator"));
const AdminTestCenter = lazy(() => import("@/components/admin/AdminTestCenter"));
const AdminPromptIntelligence = lazy(() => import("@/components/admin/AdminPromptIntelligence"));
const AdminRevenueIntelligence = lazy(() => import("@/components/admin/AdminRevenueIntelligence"));
const DevChatPanel = lazy(() => import("@/components/admin/DevChatPanel"));
const AdminDigitalSignature = lazy(() => import("@/components/admin/AdminDigitalSignature"));
const AdminCertDiagnostic = lazy(() => import("@/components/admin/AdminCertDiagnostic"));

const ITEMS_PER_PAGE = 20;

// ─── Navigation Structure ───
const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "logs", label: "Logs", icon: ScrollText },
      { id: "errors", label: "Erros", icon: AlertTriangle },
      { id: "payments", label: "Pagamentos", icon: CreditCardIcon },
      { id: "clientes", label: "Clientes", icon: UserCog },
      { id: "leads", label: "Leads & Propostas", icon: Megaphone },
    ],
  },
  {
    label: "Segurança",
    items: [
      { id: "security", label: "Eventos", icon: ShieldAlert },
      { id: "webhooks", label: "Webhooks", icon: Webhook },
      { id: "audit", label: "Auditoria", icon: ClipboardCheck },
      { id: "risk", label: "Monitor de Risco", icon: Activity },
    ],
  },
  {
    label: "Qualidade & Conteúdo",
    items: [
      { id: "diagnostics", label: "Diagnóstico", icon: Stethoscope },
      { id: "qa", label: "QA", icon: FlaskConical },
      { id: "test-center", label: "Centro de Testes", icon: TestTube2 },
      { id: "blog-ai", label: "Blog IA", icon: PenTool },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { id: "prompt-intelligence", label: "Prompt Intelligence", icon: Brain },
      { id: "revenue-intelligence", label: "Receita", icon: DollarSign },
      { id: "dev-chat", label: "DevChat", icon: MessageSquareCode },
    ],
  },
  {
    label: "Configurações",
    items: [
      { id: "digital-signature", label: "Assinatura Digital", icon: FileSignature },
      { id: "cert-diagnostic", label: "Diag. Certificado", icon: Stethoscope },
    ],
  },
];

// ─── Login ───
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-auth", {
        body: { password },
      });
      if (fnErr || !data?.success) {
        setError(data?.error || "Senha incorreta");
      } else {
        saveAdminToken(data.token);
        onLogin();
      }
    } catch {
      setError("Erro ao autenticar");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">WMTi Operations</h1>
          <p className="text-xs text-muted-foreground mt-1">Centro de Controle · Produção</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6" data-testid="admin-login-page">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Senha de Acesso</label>
              <Input
                data-testid="admin-login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/30 border-border/60 text-foreground h-10"
              />
            </div>
            {error && <p data-testid="admin-login-error" className="text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
            <Button data-testid="admin-login-submit" type="submit" className="w-full h-10" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </div>
...
                <button
                  key={item.id}
                  data-testid={`admin-nav-${item.id}`}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "w-full flex items-center gap-2.5 transition-all duration-150",
                    collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2",
                    isActive
                      ? "text-primary bg-primary/8 border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className={cn("text-[11px] truncate", isActive && "font-semibold")}>{item.label}</span>}
                </button>
...
    <header data-testid="admin-topbar" className="h-14 border-b border-border/30 bg-[hsl(0,0%,5%)] flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu */}
        <button data-testid="admin-menu-toggle" onClick={onMenuOpen} className="md:hidden p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground">
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0">
          <h2 data-testid="admin-topbar-title" className="text-sm font-bold text-foreground truncate">{title}</h2>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status="online" label="Live" pulse />
        <div className="w-px h-5 bg-border/30 mx-1 hidden sm:block" />
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-[11px] text-muted-foreground hover:text-foreground gap-1.5 h-8">
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}

// ─── Main Page ───
export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getValidAdminToken());
  const [activeSection, setActiveSection] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const syncSession = () => setAuthed(!!getValidAdminToken());
    const intervalId = window.setInterval(syncSession, 60_000);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, syncSession);
    window.addEventListener("focus", syncSession);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const handleLogout = () => {
    clearAdminSession("manual");
    setAuthed(false);
  };

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setMenuOpen(false);
  };

  const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeSection)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-background text-foreground flex" data-testid="admin-authenticated">
      {/* Fullscreen Menu (mobile) */}
      <AdminFullscreenMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeSection={activeSection}
        onNavigate={handleNavClick}
        onLogout={handleLogout}
      />

      {/* Sidebar - Desktop */}
      {!isMobile && (
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={handleNavClick}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar
          title={currentLabel}
          onMenuOpen={() => setMenuOpen(true)}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <AdminContent activeSection={activeSection} onNavigate={handleNavClick} />
        </main>
      </div>
    </div>
  );
}
