import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import logoWmti from "@/assets/logo-wmti.jpeg";

const navLinks = [
  { href: "/servicos", label: "Serviços", isRoute: true },
  { href: "#cartorios", mobileHref: "/cartorios", label: "Cartórios" },
  { href: "#locacao", mobileHref: "/locacao", label: "Locação" },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "Infraestrutura" },
  { href: "/blog", label: "Blog", isRoute: true },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";
  const navRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  const resolveHref = (link: typeof navLinks[0], isMobile: boolean) => {
    if (link.isRoute) return link.href;
    if (!isHome && link.href.startsWith("#")) {
      return isMobile && link.mobileHref ? link.mobileHref : `/${link.href}`;
    }
    if (isMobile && link.mobileHref) return link.mobileHref;
    return link.href;
  };

  const isRouteLink = (href: string) => href.startsWith("/");

  const getActiveIndex = (): number => {
    for (let i = 0; i < navLinks.length; i++) {
      const link = navLinks[i];
      const href = resolveHref(link, false);
      if (href.startsWith("/") && href !== "/") {
        if (location.pathname === href || location.pathname.startsWith(href + "/")) return i;
      }
      if (href.startsWith("#") && isHome && location.hash === href) return i;
    }
    // Check if current route matches segment pages
    const path = location.pathname;
    if (path.includes("cartorio") || path.includes("provimento")) return navLinks.findIndex(l => l.label === "Cartórios");
    if (path.includes("locacao")) return navLinks.findIndex(l => l.label === "Locação");
    if (path.includes("infraestrutura")) return navLinks.findIndex(l => l.label === "Infraestrutura");
    return -1;
  };

  const activeIndex = getActiveIndex();
  const noNavActive = activeIndex === -1;
  // If no nav link is active, highlight the CTA "Orçamento"
  const ctaIsHighlighted = noNavActive;

  useEffect(() => {
    const updatePill = () => {
      if (!noNavActive && activeIndex >= 0 && linkRefs.current[activeIndex] && navRef.current) {
        const el = linkRefs.current[activeIndex]!;
        const navRect = navRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setPillStyle({ left: elRect.left - navRect.left, width: elRect.width });
      } else if (noNavActive && ctaRef.current && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect();
        const elRect = ctaRef.current.getBoundingClientRect();
        setPillStyle({ left: elRect.left - navRect.left, width: elRect.width });
      } else {
        setPillStyle(null);
      }
    };
    updatePill();
    window.addEventListener("resize", updatePill);
    return () => window.removeEventListener("resize", updatePill);
  }, [activeIndex, noNavActive, location.pathname, location.hash]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-border">
      <div className="container flex items-center justify-between h-14 md:h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWmti} alt="WMTi Tecnologia da Informação" className="h-8 md:h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div ref={navRef} className="hidden lg:flex items-center gap-6 xl:gap-8 relative">
          {/* Active pill */}
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
            const href = resolveHref(link, false);
            const active = i === activeIndex;
            const className = `font-mono text-xs uppercase tracking-wider transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-primary"
            }`;

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
            ref={ctaRef}
            href={isHome ? "#contato" : "/#contato"}
            className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 transition-all ${
              ctaIsHighlighted
                ? "bg-primary text-primary-foreground hover:brightness-110"
                : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground"
            }`}
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
              const href = resolveHref(link, true);
              const active = navLinks.indexOf(link) === activeIndex;
              const className = `font-mono text-sm uppercase tracking-wider transition-colors py-1 ${
                active ? "text-primary border-l-2 border-primary pl-3" : "text-muted-foreground hover:text-primary"
              }`;

              return isRouteLink(href) ? (
                <Link key={link.label} to={href} onClick={() => setOpen(false)} className={className}>
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={href} onClick={() => setOpen(false)} className={className}>
                  {link.label}
                </a>
              );
            })}
            <a
              href={isHome ? "#contato" : "/#contato"}
              onClick={() => setOpen(false)}
              className="bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider px-5 py-3 hover:brightness-110 transition-all text-center mt-2"
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
