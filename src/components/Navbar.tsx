import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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

const navLinks = [
  { href: "/servicos", label: "Serviços", isRoute: true },
  { href: "#segmentos", label: "Segmentos", isDropdown: true },
  { href: "#locacao", mobileHref: "/locacao", label: "Locação" },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "Infraestrutura" },
  { href: "/blog", label: "Blog", isRoute: true },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [segOpen, setSegOpen] = useState(false);
  const [mobileSegOpen, setMobileSegOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const navRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const linkRefs = useRef<(HTMLElement | null)[]>([]);
  const segDropdownRef = useRef<HTMLDivElement>(null);

  const resolveHref = (link: typeof navLinks[0], isMobile: boolean) => {
    if (link.isRoute) return link.href;
    if (link.isDropdown) return "#";
    if (!isHome && link.href.startsWith("#")) {
      return isMobile && link.mobileHref ? link.mobileHref : `/${link.href}`;
    }
    if (isMobile && link.mobileHref) return link.mobileHref;
    return link.href;
  };

  const isRouteLink = (href: string) => href.startsWith("/");

  // Check if current path matches any segment page
  const isSegmentActive = (): boolean => {
    const path = location.pathname;
    return segmentos.some(s => path === s.href || path.startsWith(s.href + "/")) ||
      path.includes("cartorio") || path.includes("provimento");
  };

  const getActiveIndex = (): number => {
    const path = location.pathname;

    // Check segments first
    if (isSegmentActive()) return navLinks.findIndex(l => l.label === "Segmentos");

    for (let i = 0; i < navLinks.length; i++) {
      const link = navLinks[i];
      if (link.isDropdown) continue;
      const href = resolveHref(link, false);
      if (href.startsWith("/") && href !== "/") {
        if (path === href || path.startsWith(href + "/")) return i;
      }
      if (href.startsWith("#") && isHome && location.hash === href) return i;
    }

    if (path.includes("locacao")) return navLinks.findIndex(l => l.label === "Locação");
    if (path.includes("infraestrutura")) return navLinks.findIndex(l => l.label === "Infraestrutura");
    return -1;
  };

  const activeIndex = getActiveIndex();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (segDropdownRef.current && !segDropdownRef.current.contains(e.target as Node)) {
        setSegOpen(false);
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

            // Segmentos dropdown
            if (link.isDropdown) {
              return (
                <div key={link.label} ref={segDropdownRef} className="relative">
                  <button
                    ref={(el) => { linkRefs.current[i] = el; }}
                    onClick={() => setSegOpen(!segOpen)}
                    className={`${className} inline-flex items-center gap-1`}
                  >
                    {link.label}
                    <ChevronDown size={12} className={`transition-transform ${segOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {segOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-3 w-64 bg-popover border border-border shadow-lg py-2"
                      >
                        {segmentos.map((seg) => {
                          const isActive = location.pathname === seg.href;
                          return (
                            <Link
                              key={seg.href}
                              to={seg.href}
                              onClick={() => setSegOpen(false)}
                              className={`block px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                                isActive
                                  ? "text-primary bg-muted"
                                  : "text-muted-foreground hover:text-primary hover:bg-muted"
                              }`}
                            >
                              {seg.label}
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
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
              <a
                key={link.label}
                href={href}
                ref={(el) => { linkRefs.current[i] = el; }}
                className={className}
              >
                {link.label}
              </a>
            );
          })}

          <a
            href={isHome ? "#contato" : "/#contato"}
            className="font-mono text-xs uppercase tracking-wider transition-colors text-muted-foreground hover:text-primary"
          >
            Orçamento
          </a>
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

              if (link.isDropdown) {
                return (
                  <div key={link.label}>
                    <button
                      onClick={() => setMobileSegOpen(!mobileSegOpen)}
                      className={`${baseClass} inline-flex items-center gap-1 w-full text-left`}
                    >
                      {link.label}
                      <ChevronDown size={14} className={`transition-transform ${mobileSegOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {mobileSegOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-2 pl-4 mt-2">
                            {segmentos.map((seg) => (
                              <Link
                                key={seg.href}
                                to={seg.href}
                                onClick={() => { setOpen(false); setMobileSegOpen(false); }}
                                className={`font-mono text-xs uppercase tracking-wider py-1 transition-colors ${
                                  location.pathname === seg.href
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-primary"
                                }`}
                              >
                                {seg.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
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
            <a
              href={isHome ? "#contato" : "/#contato"}
              onClick={() => setOpen(false)}
              className="font-mono text-sm uppercase tracking-wider transition-colors py-1 text-muted-foreground hover:text-primary"
            >
              Orçamento
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
