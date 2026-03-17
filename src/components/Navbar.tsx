import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, Server, Cloud, Shield, Network, Monitor, Wrench, Headphones, Activity, Eye, Cpu, HardDrive, Lock, Zap, Terminal, RefreshCw, Building2, Scale, Heart, Landmark, Briefcase, Calculator, Factory, Fuel, FileText, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoFull from "@/assets/logo-wmti-full.png";
import type { LucideIcon } from "lucide-react";

interface MegaMenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const segmentos: MegaMenuItem[] = [
  { label: "Contabilidade", href: "/ti-para-contabilidades", icon: Calculator },
  { label: "Empresas Corporativas", href: "/ti-para-escritorios-corporativos", icon: Building2 },
  { label: "Escritórios De Advocacia", href: "/ti-para-escritorios-de-advocacia", icon: Scale },
  { label: "Hospitais e Clínicas", href: "/ti-para-hospitais-e-clinicas", icon: Heart },
  { label: "Indústrias Alimentícias", href: "/ti-para-industrias-alimenticias", icon: Factory },
  { label: "Indústrias Petrolíferas", href: "/ti-para-industrias-petroliferas", icon: Fuel },
  { label: "Serventias Notariais", href: "/ti-para-serventias-cartoriais", icon: FileText },
];

const servicos: MegaMenuItem[] = [
  { label: "Administração De Servidores", href: "/administracao-de-servidores", icon: Server },
  { label: "Administração Microsoft 365", href: "/microsoft-365-para-empresas-jacarei", icon: Cloud },
  { label: "Backup Corporativo", href: "/backup-corporativo", icon: HardDrive },
  { label: "Firewall Corporativo", href: "/firewall-pfsense-jacarei", icon: Shield },
  { label: "Implantação De Servidores Dell PowerEdge", href: "/servidor-dell-poweredge-jacarei", icon: Cpu },
  { label: "Infraestrutura De Rede Corporativa", href: "/montagem-e-monitoramento-de-redes-jacarei", icon: Network },
  { label: "Infraestrutura De Servidores", href: "/infraestrutura-ti-corporativa-jacarei", icon: Server },
  { label: "Infraestrutura De TI Para Empresas", href: "/infraestrutura-ti-corporativa-jacarei", icon: Building2 },
  { label: "Locação De Computadores", href: "/locacao-de-computadores-para-empresas-jacarei", icon: Monitor },
  { label: "Manutenção De Infraestrutura De TI", href: "/manutencao-de-infraestrutura-de-ti", icon: Wrench },
  { label: "Monitoramento De Rede", href: "/monitoramento-de-rede", icon: Eye },
  { label: "Monitoramento De Servidores", href: "/monitoramento-de-servidores", icon: Activity },
  { label: "Suporte Linux", href: "/suporte-linux", icon: Terminal },
  { label: "Suporte Técnico Emergencial", href: "/suporte-tecnico-emergencial", icon: Zap },
  { label: "Suporte Técnico Empresarial", href: "/suporte-ti-jacarei", icon: Headphones },
  { label: "Suporte Técnico Para Redes Corporativas", href: "/suporte-tecnico-para-redes-corporativas", icon: Network },
  { label: "Suporte Windows Server", href: "/suporte-windows-server", icon: Lock },
  { label: "Terceirização De TI", href: "/terceirizacao-de-mao-de-obra-ti", icon: RefreshCw },
].sort((a, b) => a.label.localeCompare(b.label));

type NavLink = {
  href: string;
  label: string;
  isRoute?: boolean;
  isDropdown?: boolean;
  mobileHref?: string;
};

const navLinks: NavLink[] = [
  { href: "/institucional", label: "Institucional", isRoute: true },
  { href: "#servicos", label: "Serviços", isDropdown: true },
  { href: "#segmentos", label: "Segmentos", isDropdown: true },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "Infraestrutura" },
  { href: "/blog", label: "Blog", isRoute: true },
];

/* ─── Shared nav-item class for perfect vertical alignment ─── */
const NAV_ITEM_CLASS = "font-mono text-xs uppercase tracking-wider flex items-center justify-center h-16 transition-colors";

const WEBMAIL_URL = "https://sigma.servidor.net.br:2096/cpsess3314771808/webmail/jupiter/mail/clientconf.html?login=1&post_login=62387806819454";

const Navbar = () => {
  const [open, setOpen] = useState(false);
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
    if (isSegmentActive()) return navLinks.findIndex(l => l.label === "Segmentos");
    if (isServiceActive()) return navLinks.findIndex(l => l.label === "Serviços");
    for (let i = 0; i < navLinks.length; i++) {
      const link = navLinks[i];
      if (link.isDropdown) continue;
      const href = resolveHref(link, false);
      if (href.startsWith("/") && href !== "/") {
        if (path === href || path.startsWith(href + "/")) return i;
      }
      if (href.startsWith("#") && isHome && location.hash === href) return i;
    }
    if (path.includes("infraestrutura")) return navLinks.findIndex(l => l.label === "Infraestrutura");
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
      if (segDropdownRef.current && !segDropdownRef.current.contains(e.target as Node)) setSegOpen(false);
      if (svcDropdownRef.current && !svcDropdownRef.current.contains(e.target as Node)) setSvcOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMegaMenus();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closeMegaMenus]);

  // Lock body scroll when mega menu or mobile menu is open
  useEffect(() => {
    if (open || megaOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open, megaOpen]);

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
    setOpen(false);
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

  /* ─── MEGA MENU DESKTOP — full-screen opaque panel ─── */
  const renderMegaDropdown = (
    items: MegaMenuItem[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    ref: React.RefObject<HTMLDivElement | null>,
    link: NavLink,
    index: number,
    active: boolean
  ) => (
    <div key={link.label} ref={ref} className="relative flex items-center h-16">
      <button
        ref={(el) => { linkRefs.current[index] = el; }}
        onClick={(e) => {
          e.stopPropagation();
          const next = !isOpen;
          console.log(`[Navbar] ${link.label} clicked, isOpen=${isOpen}, setting to ${next}`);
          setIsOpen(next);
          if (link.label === "Segmentos") setSvcOpen(false);
          if (link.label === "Serviços") setSegOpen(false);
        }}
        className={`${NAV_ITEM_CLASS} gap-1 ${active ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
      >
        {link.label}
        <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 bottom-0 z-[100] bg-secondary overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          >
            <div className="relative container mx-auto py-12">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-8">{link.label}</h2>
              <div className={`grid gap-x-12 gap-y-1 ${items.length > 7 ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2'}`}>
                {items.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label}
                      to={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`group flex items-center gap-4 px-6 py-4 transition-all duration-150 hover:bg-white/[0.04] rounded-lg ${
                        isActive ? "text-primary bg-primary/10" : "text-foreground"
                      }`}
                    >
                      <Icon size={28} className="text-primary shrink-0" strokeWidth={1.5} />
                      <span className="text-lg font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          {link.label}
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
                      onClick={() => { setOpen(false); setIsOpen(false); }}
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-border">
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

            if (link.isDropdown && link.label === "Segmentos") {
              return renderMegaDropdown(segmentos, segOpen, setSegOpen, segDropdownRef, link, i, active);
            }
            if (link.isDropdown && link.label === "Serviços") {
              return renderMegaDropdown(servicos, svcOpen, setSvcOpen, svcDropdownRef, link, i, active);
            }

            const href = resolveHref(link, false);
            return isRouteLink(href) ? (
              <Link
                key={link.label}
                to={href}
                ref={(el) => { linkRefs.current[i] = el; }}
                className={`${NAV_ITEM_CLASS} ${colorClass}`}
              >
                {link.label}
              </Link>
            ) : (
              <button
                key={link.label}
                ref={(el) => { linkRefs.current[i] = el; }}
                onClick={() => handleAnchorClick(link.href.replace("#", ""))}
                className={`${NAV_ITEM_CLASS} ${colorClass}`}
              >
                {link.label}
              </button>
            );
          })}

          <Link
            to="/orcamento-ti"
            className={`${NAV_ITEM_CLASS} text-muted-foreground hover:text-primary`}
          >
            Orçamento
          </Link>

          <a
            href={WEBMAIL_URL}
            target="_blank"
            rel="noopener"
            className={`${NAV_ITEM_CLASS} text-muted-foreground hover:text-primary`}
          >
            Webmail
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden text-foreground relative z-[60] flex items-center justify-center h-16"
          aria-label="Menu de navegação"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile fullscreen menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden fixed inset-0 w-screen bg-secondary z-[55] flex flex-col"
            style={{ height: "100dvh" }}
          >
            <div className="container flex items-center justify-between h-14">
              <Link to="/" onClick={() => setOpen(false)} className="flex items-center">
                <img src={logoFull} alt="WMTi Tecnologia da Informação" className="h-8 w-auto" />
              </Link>
              <button onClick={() => setOpen(false)} className="text-foreground" aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>

            <div className="container flex-1 flex flex-col justify-start gap-4 overflow-y-auto pb-12 pt-4">
              {navLinks.map((link) => {
                const active = navLinks.indexOf(link) === activeIndex;
                const baseClass = `font-mono text-base uppercase tracking-wider transition-colors py-2 ${
                  active ? "text-primary border-l-2 border-primary pl-4" : "text-muted-foreground hover:text-primary"
                }`;

                if (link.isDropdown && link.label === "Segmentos") {
                  return renderMobileMegaDropdown(segmentos, mobileSegOpen, setMobileSegOpen, link, active);
                }
                if (link.isDropdown && link.label === "Serviços") {
                  return renderMobileMegaDropdown(servicos, mobileSvcOpen, setMobileSvcOpen, link, active);
                }

                const href = resolveHref(link, true);
                return isRouteLink(href) ? (
                  <Link key={link.label} to={href} onClick={() => setOpen(false)} className={baseClass}>
                    {link.label}
                  </Link>
                ) : (
                  <button
                    key={link.label}
                    onClick={() => { setOpen(false); handleAnchorClick(link.href.replace("#", "")); }}
                    className={`${baseClass} text-left`}
                  >
                    {link.label}
                  </button>
                );
              })}
              <Link
                to="/orcamento-ti"
                onClick={() => setOpen(false)}
                className="font-mono text-base uppercase tracking-wider transition-colors py-2 text-muted-foreground hover:text-primary text-left"
              >
                Orçamento
              </Link>

              <a
                href={WEBMAIL_URL}
                target="_blank"
                rel="noopener"
                onClick={() => setOpen(false)}
                className="font-mono text-base uppercase tracking-wider transition-colors py-2 text-muted-foreground hover:text-primary text-left"
              >
                Webmail
              </a>

              <a
                href="https://wa.me/5511963166915?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20especialista%20em%20TI."
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider"
              >
                Falar com Especialista
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
