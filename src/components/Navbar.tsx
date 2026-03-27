import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, Server, Cloud, Shield, Network, Monitor, Wrench, Headphones, Activity, Eye, Cpu, HardDrive, Lock, Zap, Terminal, RefreshCw, Building2, Scale, Heart, Landmark, Briefcase, Calculator, Factory, Fuel, FileText, Mail, Globe, Brain, Bot, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import logoFull from "@/assets/logo-wmti-full.webp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { whatsappLink } from "@/lib/whatsapp";
import { trackWhatsApp } from "@/lib/tracking";
import type { LucideIcon } from "lucide-react";

interface MegaMenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const segmentosBase = [
  { labelKey: "segments.contabilidade", href: "/ti-para-contabilidades", icon: Calculator },
  { labelKey: "segments.corporativos", href: "/ti-para-escritorios-corporativos", icon: Building2 },
  { labelKey: "segments.advocacia", href: "/ti-para-escritorios-de-advocacia", icon: Scale },
  { labelKey: "segments.hospitais", href: "/ti-para-hospitais-e-clinicas", icon: Heart },
  { labelKey: "segments.alimenticias", href: "/ti-para-industrias-alimenticias", icon: Factory },
  { labelKey: "segments.petroliferas", href: "/ti-para-industrias-petroliferas", icon: Fuel },
  { labelKey: "segments.notariais", href: "/ti-para-serventias-cartoriais", icon: FileText },
] as const;

const servicosBase = [
  { labelKey: "services.adminServidores", href: "/administracao-de-servidores", icon: Server },
  { labelKey: "services.microsoft365", href: "/microsoft-365-para-empresas-jacarei", icon: Cloud },
  { labelKey: "services.backup", href: "/backup-corporativo", icon: HardDrive },
  { labelKey: "services.firewall", href: "/firewall-pfsense-jacarei", icon: Shield },
  { labelKey: "services.dell", href: "/servidor-dell-poweredge-jacarei", icon: Cpu },
  { labelKey: "services.infraRede", href: "/montagem-e-monitoramento-de-redes-jacarei", icon: Network },
  { labelKey: "services.infraServidores", href: "/infraestrutura-ti-corporativa-jacarei", icon: Server },
  { labelKey: "services.infraTI", href: "/infraestrutura-ti-corporativa-jacarei", icon: Building2 },
  { labelKey: "services.locacao", href: "/locacao-de-computadores-para-empresas-jacarei", icon: Monitor },
  { labelKey: "services.manutencao", href: "/manutencao-de-infraestrutura-de-ti", icon: Wrench },
  { labelKey: "services.monRede", href: "/monitoramento-de-rede", icon: Eye },
  { labelKey: "services.monServidores", href: "/monitoramento-de-servidores", icon: Activity },
  { labelKey: "services.linux", href: "/suporte-linux", icon: Terminal },
  { labelKey: "services.emergencial", href: "/suporte-tecnico-emergencial", icon: Zap },
  { labelKey: "services.suporteTI", href: "/suporte-ti-jacarei", icon: Headphones },
  { labelKey: "services.suporteRedes", href: "/suporte-tecnico-para-redes-corporativas", icon: Network },
  { labelKey: "services.windows", href: "/suporte-windows-server", icon: Lock },
  { labelKey: "services.terceirizacao", href: "/terceirizacao-de-mao-de-obra-ti", icon: RefreshCw },
  { labelKey: "services.reestruturacao", href: "/reestruturacao-completa-de-rede-corporativa", icon: Globe },
  { labelKey: "services.devWeb", href: "/desenvolvimento-de-sites-e-sistemas-web", icon: Brain },
  { labelKey: "services.autoIA", href: "/automacao-de-ti-com-inteligencia-artificial", icon: Bot },
  { labelKey: "services.alexa", href: "/automacao-alexa-casa-empresa-inteligente", icon: Home },
] as const;

type NavLink = {
  href: string;
  label: string;
  isRoute?: boolean;
  isDropdown?: boolean;
  mobileHref?: string;
};

const navLinks: NavLink[] = [
  { href: "/institucional", label: "nav.institucional", isRoute: true },
  { href: "#servicos", label: "nav.servicos", isDropdown: true },
  { href: "#segmentos", label: "nav.segmentos", isDropdown: true },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "nav.infraestrutura" },
  { href: "/blog", label: "nav.blog", isRoute: true },
];

/* ─── Shared nav-item class for perfect vertical alignment ─── */
const NAV_ITEM_CLASS = "font-mono text-xs uppercase tracking-wider flex items-center justify-center h-16 transition-colors";

const WEBMAIL_URL = "https://sigma.servidor.net.br:2096/cpsess3314771808/webmail/jupiter/mail/clientconf.html?login=1&post_login=62387806819454";

const Navbar = () => {
  const { t } = useTranslation();
  const segmentos: MegaMenuItem[] = [...segmentosBase]
    .map((item) => ({ ...item, label: t(item.labelKey) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const servicos: MegaMenuItem[] = [...servicosBase]
    .map((item) => ({ ...item, label: t(item.labelKey) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const [menuOpen, setMenuOpen] = useState(false);
  const [segOpen, setSegOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [mobileSegOpen, setMobileSegOpen] = useState(false);
  const [mobileSvcOpen, setMobileSvcOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const navRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const linkRefs = useRef<(HTMLElement | null)[]>([]);
  const segDropdownRef = useRef<HTMLDivElement>(null);
  const svcDropdownRef = useRef<HTMLDivElement>(null);

  const megaOpen = segOpen || svcOpen;

  const closeMobileMenu = useCallback(() => {
    setMenuOpen(false);
    setMobileSegOpen(false);
    setMobileSvcOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const resolveHref = (link: NavLink, isMobile: boolean) => {
    if (link.isRoute) return link.href;
    if (link.isDropdown) return "#";
    if (!isHome && link.href.startsWith("#")) {
      return isMobile && link.mobileHref ? link.mobileHref : `/${link.href}`;
    }
    if (isMobile && link.mobileHref) return link.mobileHref;
    return link.href;
  };

  const isRouteLink = (href: string) => href.startsWith("/");

  const isSegmentActive = (): boolean => {
    const path = location.pathname;
    return segmentos.some(s => path === s.href || path.startsWith(s.href + "/")) ||
      path.includes("cartorio") || path.includes("provimento");
  };

  const isServiceActive = (): boolean => {
    const path = location.pathname;
    return servicos.some(s => path === s.href || path.startsWith(s.href + "/")) ||
      path === "/servicos" || path.includes("locacao") || path.includes("terceirizacao");
  };

  const getActiveIndex = (): number => {
    const path = location.pathname;
    if (isSegmentActive()) return navLinks.findIndex(l => l.label === "nav.segmentos");
    if (isServiceActive()) return navLinks.findIndex(l => l.label === "nav.servicos");
    for (let i = 0; i < navLinks.length; i++) {
      const link = navLinks[i];
      if (link.isDropdown) continue;
      const href = resolveHref(link, false);
      if (href.startsWith("/") && href !== "/") {
        if (path === href || path.startsWith(href + "/")) return i;
      }
      if (href.startsWith("#") && isHome && location.hash === href) return i;
    }
    if (path.includes("infraestrutura")) return navLinks.findIndex(l => l.label === "nav.infraestrutura");
    return -1;
  };

  const activeIndex = getActiveIndex();

  const closeMegaMenus = useCallback(() => {
    setSegOpen(false);
    setSvcOpen(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the portal panel
      const portalPanel = document.querySelector('[data-mega-panel]');
      if (portalPanel?.contains(target)) return;
      if (segDropdownRef.current && !segDropdownRef.current.contains(target)) setSegOpen(false);
      if (svcDropdownRef.current && !svcDropdownRef.current.contains(target)) setSvcOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMegaMenus();
        closeMobileMenu();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closeMegaMenus, closeMobileMenu]);

  // Lock body scroll when mega menu or mobile menu is open
  useEffect(() => {
    if (menuOpen || megaOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, megaOpen]);

  useEffect(() => {
    const updatePill = () => {
      if (activeIndex >= 0 && linkRefs.current[activeIndex] && navRef.current) {
        const el = linkRefs.current[activeIndex]!;
        const navRect = navRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setPillStyle({ left: elRect.left - navRect.left, width: elRect.width });
      } else {
        setPillStyle(null);
      }
    };
    updatePill();
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [activeIndex, location.pathname, location.hash]);

  const handleAnchorClick = (anchorId: string) => {
    closeMobileMenu();
    if (isHome) {
      const el = document.getElementById(anchorId);
      if (el) { el.scrollIntoView({ behavior: "smooth" }); return; }
    }
    navigate("/");
    setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  /* ─── MEGA MENU DESKTOP — renders button only, panel rendered outside nav ─── */
  const renderMegaButton = (
    link: NavLink,
    index: number,
    active: boolean,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => (
    <div key={link.label} ref={ref} className="relative flex items-center h-16">
      <button
        ref={(el) => { linkRefs.current[index] = el; }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
           if (link.label === "nav.segmentos") setSvcOpen(false);
           if (link.label === "nav.servicos") setSegOpen(false);
         }}
         className={`${NAV_ITEM_CLASS} gap-1 ${active ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
       >
         {t(link.label)}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
    </div>
  );

  /* ─── MEGA PANEL — rendered outside nav as sibling ─── */
  const renderMegaPanel = (
    items: MegaMenuItem[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    label: string,
  ) => (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-0 top-16 bottom-0 z-[60] overflow-y-auto"
          data-mega-panel
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          style={{
            background: "rgba(10, 18, 28, 0.65)",
            backdropFilter: "blur(18px) saturate(160%)",
            WebkitBackdropFilter: "blur(18px) saturate(160%)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="container mx-auto py-12 px-8 xl:px-16">
            <div className={`grid gap-6 ${items.length > 7 ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2'}`}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className="group flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-250 ease-out"
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 90, 31, 0.10)";
                      e.currentTarget.style.borderColor = "rgba(255, 90, 31, 0.45)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.28)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <Icon size={22} className="text-primary shrink-0" strokeWidth={1.5} />
                    <span className="text-[15px] font-medium tracking-wide text-foreground group-hover:text-white">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ─── MOBILE MEGA MENU ─── */
  const renderMobileMegaDropdown = (
    items: MegaMenuItem[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    link: NavLink,
    active: boolean
  ) => {
    const baseClass = `font-mono text-base uppercase tracking-wider transition-colors py-2 ${
      active ? "text-primary border-l-2 border-primary pl-4" : "text-muted-foreground hover:text-primary"
    }`;
    return (
      <div key={link.label}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${baseClass} inline-flex items-center gap-2 w-full text-left`}
        >
          {t(link.label)}
          <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-1 pl-2 mt-3 ml-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label}
                      to={item.href}
                      onClick={() => { closeMobileMenu(); setIsOpen(false); }}
                      className={`flex items-center gap-4 py-3 px-4 transition-colors hover:bg-white/[0.04] ${
                        location.pathname === item.href ? "text-primary" : "text-muted-foreground hover:text-primary"
                      }`}
                      style={{ borderRadius: "10px" }}
                    >
                      <Icon size={24} className="text-primary shrink-0" strokeWidth={1.5} />
                      <span className="font-mono text-sm uppercase tracking-wider">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08]"
      style={{
        background: "#050505",
        boxShadow: "0 4px 30px rgba(0,0,0,0.25)",
      }}
    >
      {/* Single header container — fixed height, flex center */}
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center h-16">
          <img src={logoFull} alt="WMTi Tecnologia da Informação" className="h-8 md:h-9 w-auto" />
        </Link>

        {/* Desktop nav — all items share h-16 and flex-center */}
        <div ref={navRef} className="hidden lg:flex items-center gap-6 xl:gap-8 relative h-16">
          {pillStyle && (
            <motion.div
              className="absolute bottom-0 h-[3px] bg-primary"
              layoutId="nav-pill"
              animate={{ left: pillStyle.left, width: pillStyle.width }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}

          {navLinks.map((link, i) => {
            const active = i === activeIndex;
            const colorClass = active ? "text-primary" : "text-muted-foreground hover:text-primary";

            if (link.isDropdown && link.label === "nav.segmentos") {
              return renderMegaButton(link, i, active, segOpen, setSegOpen, segDropdownRef);
            }
            if (link.isDropdown && link.label === "nav.servicos") {
              return renderMegaButton(link, i, active, svcOpen, setSvcOpen, svcDropdownRef);
            }

            const href = resolveHref(link, false);
            return isRouteLink(href) ? (
              <Link
                key={link.label}
                to={href}
                className={`${NAV_ITEM_CLASS} ${colorClass}`}
              >
                <span ref={(el) => { linkRefs.current[i] = el; }} className="inline-flex items-center justify-center h-full">
                  {t(link.label)}
                </span>
              </Link>
            ) : (
              <button
                key={link.label}
                ref={(el) => { linkRefs.current[i] = el; }}
                onClick={() => handleAnchorClick(link.href.replace("#", ""))}
                className={`${NAV_ITEM_CLASS} ${colorClass}`}
              >
                {t(link.label)}
              </button>
            );
          })}

          <Link
            to="/orcamento-ti"
            className={`${NAV_ITEM_CLASS} text-muted-foreground hover:text-primary`}
          >
            {t("nav.orcamento")}
          </Link>

          <a
            href={WEBMAIL_URL}
            target="_blank"
            rel="noopener"
            className={`${NAV_ITEM_CLASS} text-muted-foreground hover:text-primary`}
          >
            {t("nav.webmail")}
          </a>

          {/* Área do Cliente — separated, red accent */}
          <Link
            to="/area-do-cliente"
            className={`${NAV_ITEM_CLASS} ml-4 xl:ml-6 transition-colors ${
              location.pathname === "/area-do-cliente"
                ? "text-red-500"
                : "text-muted-foreground hover:text-red-500"
            }`}
          >
            {t("nav.areaCliente")}
          </Link>

          <LanguageSwitcher />
        </div>

        {/* Mobile header controls — aeroglass style, no overlap */}
        <div className="lg:hidden flex items-center gap-3 shrink-0">
          <LanguageSwitcher compact />
          <button
            onClick={toggleMobileMenu}
            className="text-foreground flex items-center justify-center h-10 w-10 shrink-0 rounded-full border border-border/70 bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60"
            aria-label={menuOpen ? t("nav.fecharMenu") : t("nav.menuLabel")}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed top-16 left-0 right-0 bottom-0 z-[54]"
              style={{ background: "#050505" }}
              onClick={closeMobileMenu}
              aria-label={t("nav.fecharMenu")}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
               className="lg:hidden fixed top-16 left-0 w-full h-[calc(100dvh-4rem)] z-[55] overflow-y-auto border-t border-white/[0.06]"
              style={{
                background: "#050505",
              }}
            >
              <div className="container flex flex-col gap-4 py-6 pb-12">
                {navLinks.map((link) => {
                  const active = navLinks.indexOf(link) === activeIndex;
                  const baseClass = `font-mono text-base uppercase tracking-wider transition-colors py-2 ${
                    active ? "text-primary border-l-2 border-primary pl-4" : "text-muted-foreground hover:text-primary"
                  }`;

                  if (link.isDropdown && link.label === "nav.segmentos") {
                    return renderMobileMegaDropdown(segmentos, mobileSegOpen, setMobileSegOpen, link, active);
                  }
                  if (link.isDropdown && link.label === "nav.servicos") {
                    return renderMobileMegaDropdown(servicos, mobileSvcOpen, setMobileSvcOpen, link, active);
                  }

                  const href = resolveHref(link, true);
                  return isRouteLink(href) ? (
                    <Link key={link.label} to={href} onClick={closeMobileMenu} className={baseClass}>
                      {t(link.label)}
                    </Link>
                  ) : (
                    <button
                      key={link.label}
                      onClick={() => { closeMobileMenu(); handleAnchorClick(link.href.replace("#", "")); }}
                      className={`${baseClass} text-left`}
                    >
                      {t(link.label)}
                    </button>
                  );
                })}
                <Link
                  to="/orcamento-ti"
                  onClick={closeMobileMenu}
                  className="font-mono text-base uppercase tracking-wider transition-colors py-2 text-muted-foreground hover:text-primary text-left"
                >
                  {t("nav.orcamento")}
                </Link>

                <a
                  href={WEBMAIL_URL}
                  target="_blank"
                  rel="noopener"
                  onClick={closeMobileMenu}
                  className="font-mono text-base uppercase tracking-wider transition-colors py-2 text-muted-foreground hover:text-primary text-left"
                >
                  {t("nav.webmail")}
                </a>

                <Link
                  to="/area-do-cliente"
                  onClick={closeMobileMenu}
                  className={`font-mono text-base uppercase tracking-wider transition-colors py-2 text-left ${
                    location.pathname === "/area-do-cliente"
                      ? "text-red-500 border-l-2 border-red-500 pl-4"
                      : "text-muted-foreground hover:text-red-500"
                  }`}
                >
                  {t("nav.areaCliente")}
                </Link>

                <a
                  href={whatsappLink(t("nav.whatsappMessage", { defaultValue: "Olá, gostaria de falar com um especialista em TI." }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { closeMobileMenu(); trackWhatsApp("navbar-mobile", "especialista"); }}
                  className="mt-2 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider"
                >
                  {t("nav.falarEspecialista")}
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>

    {/* Mega panels rendered OUTSIDE nav to avoid stacking context issues */}
      <div className="hidden lg:block">
      {renderMegaPanel(servicos, svcOpen, setSvcOpen, "Serviços")}
      {renderMegaPanel(segmentos, segOpen, setSegOpen, "Segmentos")}
    </div>
    </>
  );
};

export default Navbar;
