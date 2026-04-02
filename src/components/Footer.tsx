import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import logoFull from "@/assets/logo-wmti-full.webp";

interface FooterLink {
  label: string;
  href: string;
  contexts: string[];
}

const ALL_FOOTER_LINKS: FooterLink[] = [
  // Cartórios / Segmentos
  { label: "Serventias Cartoriais", href: "/ti-para-serventias-cartoriais", contexts: ["cartorios", "segmentos"] },
  { label: "Tabelionatos de Notas", href: "/ti-para-tabelionatos-de-notas", contexts: ["cartorios", "segmentos"] },
  { label: "Ofícios de Registro", href: "/ti-para-oficios-de-registro", contexts: ["cartorios", "segmentos"] },
  { label: "Tabelionatos de Protesto", href: "/ti-para-tabelionatos-de-protesto", contexts: ["cartorios", "segmentos"] },
  { label: "Provimento 213", href: "/cartorios/provimento-213", contexts: ["cartorios"] },
  { label: "Cartórios", href: "/ti-para-cartorios", contexts: ["cartorios", "segmentos"] },
  // Segmentos corporativos
  { label: "Contabilidades", href: "/ti-para-contabilidades", contexts: ["segmentos", "corporativo"] },
  { label: "Escritórios de Advocacia", href: "/ti-para-escritorios-de-advocacia", contexts: ["segmentos", "corporativo"] },
  { label: "Escritórios Corporativos", href: "/ti-para-escritorios-corporativos", contexts: ["segmentos", "corporativo"] },
  { label: "Hospitais e Clínicas", href: "/ti-para-hospitais-e-clinicas", contexts: ["segmentos", "corporativo"] },
  { label: "Indústrias Alimentícias", href: "/ti-para-industrias-alimenticias", contexts: ["segmentos", "corporativo"] },
  { label: "Indústrias Petrolíferas", href: "/ti-para-industrias-petroliferas", contexts: ["segmentos", "corporativo"] },
  // Infraestrutura
  { label: "Administração de Servidores", href: "/administracao-de-servidores", contexts: ["infra", "servidores"] },
  { label: "Servidores Dell", href: "/servidores-dell", contexts: ["infra", "servidores"] },
  { label: "Monitoramento de Servidores", href: "/monitoramento-de-servidores", contexts: ["infra", "servidores"] },
  { label: "Backup Corporativo", href: "/backup-corporativo", contexts: ["infra", "seguranca"] },
  { label: "Infraestrutura Corporativa", href: "/infraestrutura-corporativa", contexts: ["infra"] },
  { label: "Manutenção de Infraestrutura", href: "/manutencao-de-infraestrutura", contexts: ["infra"] },
  // Redes e Segurança
  { label: "Montagem de Redes", href: "/montagem-de-redes", contexts: ["redes", "infra"] },
  { label: "Segurança de Rede", href: "/seguranca-de-rede", contexts: ["redes", "seguranca"] },
  { label: "Firewall pfSense", href: "/firewall-pfsense", contexts: ["redes", "seguranca"] },
  { label: "Monitoramento de Rede", href: "/monitoramento-de-rede", contexts: ["redes"] },
  { label: "Reestruturação de Rede", href: "/reestruturação-de-rede", contexts: ["redes"] },
  // Suporte
  { label: "Suporte de TI", href: "/suporte-de-ti", contexts: ["suporte"] },
  { label: "Suporte Emergencial", href: "/suporte-emergencial", contexts: ["suporte"] },
  { label: "Suporte Linux", href: "/suporte-linux", contexts: ["suporte", "servidores"] },
  { label: "Suporte Windows Server", href: "/suporte-windows-server", contexts: ["suporte", "servidores"] },
  { label: "Suporte Redes Corporativas", href: "/suporte-redes-corporativas", contexts: ["suporte", "redes"] },
  // Locação e outros
  { label: "Locação de Computadores", href: "/locacao-de-computadores", contexts: ["locacao"] },
  { label: "Microsoft 365", href: "/microsoft-365", contexts: ["corporativo", "suporte"] },
  { label: "Automação com IA", href: "/automacao-ia", contexts: ["corporativo"] },
  { label: "Terceirização de TI", href: "/terceirizacao-de-ti", contexts: ["corporativo", "suporte"] },
];

function getContextForPath(pathname: string): string | null {
  const p = pathname.toLowerCase();
  if (p.includes("cartorio") || p.includes("serventias") || p.includes("tabelionato") || p.includes("oficio") || p.includes("provimento")) return "cartorios";
  if (p.includes("contabilidade") || p.includes("advocacia") || p.includes("escritorio") || p.includes("hospital") || p.includes("clinica") || p.includes("industria")) return "corporativo";
  if (p.includes("servidor") || p.includes("dell") || p.includes("backup") || p.includes("infraestrutura") || p.includes("manutencao")) return "infra";
  if (p.includes("rede") || p.includes("pfsense") || p.includes("firewall") || p.includes("seguranca")) return "redes";
  if (p.includes("suporte") || p.includes("emergencial") || p.includes("linux") || p.includes("windows")) return "suporte";
  if (p.includes("locacao")) return "locacao";
  if (p.includes("segmento")) return "segmentos";
  return null;
}

function getFooterLinks(pathname: string): { label: string; href: string }[] {
  const ctx = getContextForPath(pathname);

  let pool: FooterLink[];
  if (ctx) {
    pool = ALL_FOOTER_LINKS.filter(
      (l) => l.contexts.includes(ctx) && l.href !== pathname
    );
  } else {
    pool = ALL_FOOTER_LINKS.filter((l) => l.href !== pathname);
  }

  // Shuffle deterministically per page load but pick up to 6
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6);
}

const Footer = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const links = useMemo(() => getFooterLinks(pathname), [pathname]);

  return (
    <footer className="bg-secondary py-12 md:py-16">
      <div className="container">
        <div className="border-t border-border/60 pt-8 md:pt-10">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8">
            <div className="flex items-center">
              <img
                src={logoFull}
                alt="WMTi Tecnologia da Informação"
                className="h-10 md:h-[72px] w-auto"
                loading="lazy"
              />
            </div>

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

          <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground/60 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground/50 text-center md:text-left">
              © {new Date().getFullYear()} WMTi Tecnologia da Informação. {t("footer.rights")}
            </p>
            <p className="font-mono text-[11px] tracking-[0.04em] text-muted-foreground/50 text-center md:text-right">
              {t("footer.location")}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border/20 text-center">
            <p className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground/40">
              Desenvolvido por WMTi Tecnologia da Informação
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
