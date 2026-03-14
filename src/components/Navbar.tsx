import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoWmti from "@/assets/logo-wmti.jpeg";

const navLinks = [
  { href: "#cartorios", mobileHref: "/cartorios", label: "Cartórios" },
  { href: "/provimento-213", label: "Provimento 213", isRoute: true },
  { href: "#servicos", mobileHref: "/servicos", label: "Serviços" },
  { href: "#locacao", mobileHref: "/locacao", label: "Locação" },
  { href: "#infraestrutura", mobileHref: "/infraestrutura", label: "Infraestrutura" },
  { href: "#seguranca", mobileHref: "/infraestrutura", label: "Segurança" },
  { href: "#contato", label: "Contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-gunmetal-foreground/10">
      <div className="container flex items-center justify-between h-14 md:h-16">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoWmti} alt="WMTi Tecnologia da Informação" className="h-8 md:h-10 w-auto" />
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.href}
                to={link.href}
                className="font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            )
          )}
          <a
            href="#contato"
            className="bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider px-5 py-2.5 hover:brightness-110 transition-all"
          >
            Orçamento
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden text-gunmetal-foreground"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-secondary border-t border-gunmetal-foreground/10 py-4 md:py-6">
          <div className="container flex flex-col gap-3 md:gap-4">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="font-mono text-sm uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors py-1"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="font-mono text-sm uppercase tracking-wider text-gunmetal-foreground/60 hover:text-primary transition-colors py-1"
                >
                  {link.label}
                </a>
              )
            )}
            <a
              href="#contato"
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
