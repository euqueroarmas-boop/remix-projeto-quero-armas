import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronUp } from "lucide-react";
import { getCtaItemsForPath } from "@/lib/ctaContext";
import { whatsappLink, buildContextualWhatsAppMessage } from "@/lib/whatsapp";
import { trackCta, trackWhatsApp } from "@/lib/tracking";

/** Pages where the CTA bar should NOT appear */
const HIDDEN_ROUTES = [
  "/orcamento-ti",
  "/contrato",
  "/compra-concluida",
  "/area-do-cliente",
  "/redefinir-senha",
  "/admin",
];

const FloatingCtaBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isHidden =
    HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r)) ||
    location.pathname.startsWith("/contratar/");

  const ctaItems = getCtaItemsForPath(location.pathname, t);

  useEffect(() => {
    setDismissed(false);
    setCollapsed(false);
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  if (isHidden || !visible || dismissed || ctaItems.length === 0) return null;

  const handleClick = (href: string, label: string) => {
    if (href.startsWith("whatsapp:")) {
      const intent = href.includes("diagnóstico") || href.includes("diagnostic") ? "diagnosis"
        : href.includes("proposta") || href.includes("proposal") ? "proposal"
        : "specialist";
      const msg = buildContextualWhatsAppMessage({ intent });
      trackWhatsApp(location.pathname, msg);
      window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
      return;
    }
    trackCta(label, href);
    if (href === "contratar") {
      navigate(`/contratar${location.pathname}`);
      return;
    }
    navigate(href);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="cta-mobile"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      >
        <div className="bg-card/95 backdrop-blur-md border-t border-border px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            {ctaItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.href, item.shortLabel)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2 px-1 text-[10px] font-bold uppercase tracking-wide transition-all ${item.color}`}
              >
                <item.icon size={18} />
                {item.shortLabel}
              </button>
            ))}
            <button
              onClick={() => setDismissed(true)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={t("floatingCta.fechar")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        key="cta-desktop"
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-4 bottom-24 z-40 hidden md:flex flex-col items-end gap-2"
      >
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col gap-2"
            >
              {ctaItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleClick(item.href, item.label)}
                  className={`group flex items-center gap-3 rounded-lg shadow-lg px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all ${item.color}`}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all shadow-lg"
          aria-label={collapsed ? t("floatingCta.expandir") : t("floatingCta.recolher")}
        >
          <ChevronUp
            size={18}
            className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingCtaBar;
