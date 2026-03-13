import logoWmti from "@/assets/logo-wmti.jpeg";

const Footer = () => {
  return (
    <footer className="bg-secondary py-10 md:py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={logoWmti} alt="WMTi" className="h-8 w-auto brightness-200" />
            <p className="font-body text-xs md:text-sm text-muted-foreground">
              Tecnologia da Informação
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            {["Dell Technologies Partner", "Microsoft Partner", "pfSense Certified"].map((cert) => (
              <span key={cert} className="font-mono text-[10px] md:text-xs tracking-wider uppercase text-muted-foreground/70">
                {cert}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-foreground/10 mt-6 md:mt-8 pt-6 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs md:text-sm text-muted-foreground/70 text-center md:text-left">
            © {new Date().getFullYear()} WMTi Tecnologia da Informação. Todos os direitos reservados.
          </p>
          <p className="font-mono text-xs md:text-sm text-muted-foreground/70">
            Jacareí, SP — (11) 96316-6915
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
