import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X, LogOut,
  LayoutDashboard, ScrollText, AlertTriangle, CreditCard, UserCog, Megaphone,
  ShieldAlert, Webhook, ClipboardCheck, Activity, Stethoscope, FlaskConical,
  TestTube2, PenTool, Settings, Users, MessageSquareCode,
} from "lucide-react";

interface AdminFullscreenMenuProps {
  open: boolean;
  onClose: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
  onLogout: () => void;
}

const MENU_SECTIONS = [
  {
    label: "Principal",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "test-center", label: "Centro de Testes", icon: TestTube2 },
      { id: "errors", label: "Alertas / Erros", icon: AlertTriangle },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "leads", label: "Leads & Propostas", icon: Megaphone },
      { id: "payments", label: "Pagamentos", icon: CreditCard },
      { id: "clientes", label: "Clientes", icon: UserCog },
    ],
  },
  {
    label: "Segurança",
    items: [
      { id: "security", label: "Eventos de Segurança", icon: ShieldAlert },
      { id: "webhooks", label: "Webhooks", icon: Webhook },
      { id: "audit", label: "Auditoria", icon: ClipboardCheck },
      { id: "risk", label: "Monitor de Risco", icon: Activity },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { id: "prompt-intelligence", label: "Prompt Intelligence", icon: Activity },
      { id: "revenue-intelligence", label: "Receita", icon: CreditCard },
      { id: "dev-chat", label: "DevChat", icon: MessageSquareCode },
    ],
  },
  {
    label: "Qualidade & Conteúdo",
    items: [
      { id: "logs", label: "Logs Técnicos", icon: ScrollText },
      { id: "diagnostics", label: "Diagnóstico", icon: Stethoscope },
      { id: "qa", label: "Homologação / QA", icon: FlaskConical },
      { id: "blog-ai", label: "Blog IA", icon: PenTool },
    ],
  },
];

export default function AdminFullscreenMenu({ open, onClose, activeSection, onNavigate, onLogout }: AdminFullscreenMenuProps) {
  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleNav = (id: string) => {
    onNavigate(id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] bg-[#0A0A0A] flex flex-col shadow-inner"
          style={{ background: "linear-gradient(to bottom, #0A0A0A, #050505)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h1 className="text-base font-bold text-foreground">🛡️ WMTi Admin</h1>
              <p className="text-[11px] text-muted-foreground">Painel de Controle · Produção</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Menu Content */}
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
              {MENU_SECTIONS.map((section, sIdx) => (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: sIdx * 0.05 + 0.1 }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNav(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-5 py-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">admin@wmti</p>
              <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
