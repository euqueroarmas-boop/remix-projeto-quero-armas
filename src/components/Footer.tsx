import logoFull from "@/assets/logo-wmti-full.png";

const Footer = () => {
  return (
    <footer className="bg-secondary py-12 md:py-16">
      <div className="container">
        <div className="border-t border-border/60 pt-8 md:pt-10">
          {/* Branding + Certifications row */}
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
