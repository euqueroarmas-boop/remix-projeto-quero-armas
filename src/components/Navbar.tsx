import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoWmti from "@/assets/logo-wmti.jpeg";

const segmentos = [
  { label: "Cartórios", href: "/ti-para-cartorios" },
  { label: "Hospitais e Clínicas", href: "/ti-para-hospitais-e-clinicas" },
  { label: "Escritórios de Advocacia", href: "/ti-para-escritorios-de-advocacia" },
  { label: "Escritórios de Contabilidade", href: "/ti-para-contabilidades" },
  { label: "Empresas Corporativas", href: "/ti-para-escritorios-corporativos" },
];

const servicos = [
  { label: "Locação de Computadores", href: "/locacao-de-computadores-para-empresas-jacarei" },
  { label: "Suporte de TI", href: "/suporte-ti-jacarei" },
  { label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" },
  { label: "Terceirização de TI", href: "/terceirizacao-de-mao-de-obra-ti" },
  { label: "Monitoramento de Redes", href: "/montagem-redes-corporativas-jacarei" },
  { label: "Servidores Dell PowerEdge", href: "/servidor-dell-poweredge-jacarei" },
  { label: "Microsoft 365", href: "/microsoft-365-empresas-jacarei" },
  { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
  { label: "Backup Empresarial", href: "/backup-empresarial-jacarei" },
  { label: "Segurança da Informação", href: "/seguranca-informacao-empresarial" },
];

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
  { href: "#contato", label: "Contato", isRoute: false },
];

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (segDropdownRef.current && !segDropdownRef.current.contains(e.target as Node)) {
        setSegOpen(false);
      }
      if (svcDropdownRef.current && !svcDropdownRef.current.contains(e.target as Node)) {
        setSvcOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate("/");
    setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const renderDropdown = (
    items: { label: string; href: string }[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    ref: React.RefObject<HTMLDivElement | null>,
    link: NavLink,
    index: number,
    active: boolean
  ) => {
    const className = `font-mono text-xs uppercase tracking-wider transition-colors ${
      active ? "text-primary" : "text-muted-foreground hover:text-primary"
    }`;
    return (
      <div key={link.label} ref={ref} className="relative">
        <button
          ref={(el) => { linkRefs.current[index] = el; }}
          onClick={() => {
            setIsOpen(!isOpen);
            if (link.label === "Segmentos") setSvcOpen(false);
            if (link.label === "Serviços") setSegOpen(false);
          }}
          className={`${className} inline-flex items-center gap-1`}
        >
          {link.label}
          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute top-full left-0 mt-4 w-72 bg-card/95 backdrop-blur-md border border-border/60 shadow-2xl shadow-black/30 py-2 z-50 overflow-hidden"
              style={{ borderRadius: "var(--radius)" }}
            >
              {items.map((item, idx) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-3 px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className={`w-1 h-1 rounded-full transition-colors ${
                      isActive ? "bg-primary" : "bg-muted-foreground/30 group-hover:bg-primary/60"
                    }`} />
                    {item.label}
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderMobileDropdown = (
    items: { label: string; href: string }[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    link: NavLink,
    active: boolean
  ) => {
    const baseClass = `font-mono text-sm uppercase tracking-wider transition-colors py-1 ${
      active ? "text-primary border-l-2 border-primary pl-3" : "text-muted-foreground hover:text-primary"
    }`;
    return (
      <div key={link.label}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`${baseClass} inline-flex items-center gap-1 w-full text-left`}
        >
          {link.label}
          <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
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
              <div className="flex flex-col gap-1 pl-4 mt-2 border-l border-border/40 ml-1">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => { setOpen(false); setIsOpen(false); }}
                    className={`font-mono text-xs uppercase tracking-wider py-1.5 transition-colors ${
                      location.pathname === item.href
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-border">
      <div className="container flex items-center justify-between h-14 md:h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWmti} alt="WMTi Tecnologia da Informação" className="h-8 md:h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div ref={navRef} className="hidden lg:flex items-center gap-6 xl:gap-8 relative">
          {pillStyle && (
            <motion.div
              className="absolute -bottom-1 h-[3px] bg-primary"
              layoutId="nav-pill"
              animate={{ left: pillStyle.left, width: pillStyle.width }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ bottom: -1 }}
            />
          )}

          {navLinks.map((link, i) => {
            const active = i === activeIndex;
            const className = `font-mono text-xs uppercase tracking-wider transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`;

            if (link.isDropdown && link.label === "Segmentos") {
              return renderDropdown(segmentos, segOpen, setSegOpen, segDropdownRef, link, i, active);
            }
            if (link.isDropdown && link.label === "Serviços") {
              return renderDropdown(servicos, svcOpen, setSvcOpen, svcDropdownRef, link, i, active);
            }

            const href = resolveHref(link, false);
            return isRouteLink(href) ? (
              <Link
                key={link.label}
                to={href}
                ref={(el) => { linkRefs.current[i] = el; }}
                className={className}
              >
                {link.label}
              </Link>
            ) : (
              <button
                key={link.label}
                ref={(el) => { linkRefs.current[i] = el; }}
                onClick={() => handleAnchorClick(link.href.replace("#", ""))}
                className={className}
              >
                {link.label}
              </button>
            );
          })}

          <button
            onClick={handleOrcamentoClick}
            className="font-mono text-xs uppercase tracking-wider transition-colors text-muted-foreground hover:text-primary"
          >
            Orçamento
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden text-foreground"
          aria-label="Menu de navegação"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-secondary border-t border-border py-4 md:py-6">
          <div className="container flex flex-col gap-3 md:gap-4">
            {navLinks.map((link) => {
              const active = navLinks.indexOf(link) === activeIndex;
              const baseClass = `font-mono text-sm uppercase tracking-wider transition-colors py-1 ${
                active ? "text-primary border-l-2 border-primary pl-3" : "text-muted-foreground hover:text-primary"
              }`;

              if (link.isDropdown && link.label === "Segmentos") {
                return renderMobileDropdown(segmentos, mobileSegOpen, setMobileSegOpen, link, active);
              }
              if (link.isDropdown && link.label === "Serviços") {
                return renderMobileDropdown(servicos, mobileSvcOpen, setMobileSvcOpen, link, active);
              }

              const href = resolveHref(link, true);
              return isRouteLink(href) ? (
                <Link key={link.label} to={href} onClick={() => setOpen(false)} className={baseClass}>
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={href} onClick={() => setOpen(false)} className={baseClass}>
                  {link.label}
                </a>
              );
            })}
            <button
              onClick={handleOrcamentoClick}
              className="font-mono text-sm uppercase tracking-wider transition-colors py-1 text-muted-foreground hover:text-primary text-left"
            >
              Orçamento
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
