import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoWmti from "@/assets/logo-wmti.jpeg";

const navLinks = [
  { href: "#servicos", mobileHref: "/servicos", label: "Serviços" },
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
