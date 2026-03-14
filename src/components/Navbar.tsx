import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import logoWmti from "@/assets/logo-wmti.jpeg";

const serviceLinks = [
  { href: "/suporte-ti-jacarei", label: "Suporte TI" },
  { href: "/servidor-dell-poweredge-jacarei", label: "Servidores Dell" },
  { href: "/microsoft-365-para-empresas-jacarei", label: "Microsoft 365" },
  { href: "/firewall-pfsense-jacarei", label: "Firewall pfSense" },
  { href: "/montagem-e-monitoramento-de-redes-jacarei", label: "Redes" },
  { href: "/locacao-de-computadores-para-empresas-jacarei", label: "Locação de Computadores" },
  { href: "/backup-empresarial-jacarei", label: "Backup Empresarial" },
  { href: "/seguranca-da-informacao-empresarial-jacarei", label: "Segurança da Informação" },
];

const navLinks = [
  { href: "#cartorios", mobileHref: "/cartorios", label: "Cartórios" },
  { href: "#locacao", mobileHref: "/locacao", label: "Locação" },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "Infraestrutura" },
  { href: "/blog", label: "Blog", isRoute: true },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolveHref = (link: typeof navLinks[0], isMobile: boolean) => {
    if (link.isRoute) return link.href;
    if (!isHome && link.href.startsWith("#")) {
      return isMobile && link.mobileHref ? link.mobileHref : `/${link.href}`;
    }
    if (isMobile && link.mobileHref) return link.mobileHref;
    return link.href;
  };

  const isRouteLink = (href: string) => href.startsWith("/");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-gunmetal-foreground/10">
      <div className="container flex items-center justify-between h-14 md:h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWmti} alt="WMTi Tecnologia da Informação" className="h-8 md:h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {/* Services dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors"
              onClick={() => setServicesOpen(!servicesOpen)}
            >
              Serviços
              <ChevronDown size={12} className={`transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            {servicesOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-secondary border border-gunmetal-foreground/10 shadow-xl z-50">
                <div className="py-2">
                  {serviceLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setServicesOpen(false)}
                      className="block px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t border-gunmetal-foreground/10 mt-1 pt-1">
                    <Link
                      to="/empresa-de-ti-jacarei"
                      onClick={() => setServicesOpen(false)}
                      className="block px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors"
                    >
                      Ver todos os serviços →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {navLinks.map((link) => {
            const href = resolveHref(link, false);
            return isRouteLink(href) ? (
              <Link
                key={link.label}
                to={href}
                className="font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={href}
                className="font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            );
          })}
          <a
            href={isHome ? "#contato" : "/#contato"}
            className="bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:brightness-110 transition-all"
          >
            Orçamento
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden text-gunmetal-foreground"
          aria-label="Menu de navegação"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-secondary border-t border-gunmetal-foreground/10 py-4 md:py-6">
          <div className="container flex flex-col gap-3 md:gap-4">
            {/* Services expandable */}
            <button
              onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
              className="flex items-center justify-between font-mono text-sm uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors py-1"
            >
              Serviços
              <ChevronDown size={14} className={`transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileServicesOpen && (
              <div className="pl-4 flex flex-col gap-2 border-l-2 border-primary/30">
                {serviceLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setOpen(false)}
                    className="font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/50 hover:text-primary transition-colors py-1"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {navLinks.map((link) => {
              const href = resolveHref(link, true);
              return isRouteLink(href) ? (
                <Link
                  key={link.label}
                  to={href}
                  onClick={() => setOpen(false)}
                  className="font-mono text-sm uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors py-1"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="font-mono text-sm uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors py-1"
                >
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
