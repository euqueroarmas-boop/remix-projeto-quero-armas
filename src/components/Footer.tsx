import { Link } from "react-router-dom";
import logoFull from "@/assets/logo-wmti-full.png";

const footerColumns = [
  {
    title: "Serviços",
    links: [
      { label: "Suporte TI", href: "/suporte-ti-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
      { label: "Backup Empresarial", href: "/backup-empresarial-jacarei" },
      { label: "Locação de Computadores", href: "/locacao-de-computadores-para-empresas-jacarei" },
      { label: "Segurança da Informação", href: "/seguranca-da-informacao-empresarial-jacarei" },
    ],
  },
  {
    title: "Segmentos",
    links: [
      { label: "TI para Cartórios", href: "/ti-para-cartorios" },
      { label: "TI para Hospitais e Clínicas", href: "/ti-para-hospitais-e-clinicas" },
      { label: "TI para Advocacia", href: "/ti-para-escritorios-de-advocacia" },
      { label: "TI para Contabilidades", href: "/ti-para-contabilidades" },
      { label: "TI para Escritórios", href: "/ti-para-escritorios-corporativos" },
      { label: "TI para Indústrias", href: "/ti-para-industrias" },
    ],
  },
  {
    title: "Regiões",
    links: [
      { label: "TI em Jacareí", href: "/empresa-de-ti-jacarei" },
      { label: "TI em São José dos Campos", href: "/empresa-de-ti-sao-jose-dos-campos" },
      { label: "TI em Taubaté", href: "/empresa-de-ti-taubate" },
      { label: "TI no Vale do Paraíba", href: "/empresa-de-ti-vale-do-paraiba" },
      { label: "TI no Estado de São Paulo", href: "/empresa-de-ti-sao-paulo" },
      { label: "TI em Todo o Brasil", href: "/empresa-de-ti-brasil" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { label: "Sobre a WMTi", href: "/sobre" },
      { label: "Blog", href: "/blog" },
      { label: "Diagnóstico TI", href: "/diagnostico-ti-empresarial" },
      { label: "Contato", href: "/#contato" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="bg-secondary py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-4">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="font-body text-xs md:text-sm text-muted-foreground/70 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 pt-8 md:pt-10">
          {/* Branding + Certifications row */}
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
            {/* Logo block — stacked vertically, centered */}
            <div className="flex items-center">
              <img
                src={logoFull}
                alt="WMTi Tecnologia da Informação"
                className="h-10 md:h-[72px] w-auto"
              />
            </div>

            {/* Partner certifications */}
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-5 md:gap-8">
              {["Dell Technologies Partner", "Microsoft Partner", "pfSense Certified"].map((cert) => (
                <span
                  key={cert}
                  className="font-mono text-[10px] md:text-[11px] tracking-[0.15em] uppercase text-muted-foreground/50"
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom row — copyright + contact */}
          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground/50 text-center md:text-left">
              © {new Date().getFullYear()} WMTi Tecnologia da Informação. Todos os direitos reservados.
            </p>
            <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground/50 text-center md:text-right">
              Jacareí, SP — (11) 96316-6915
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
