import logoWmti from "@/assets/logo-wmti.jpeg";

const Footer = () => {
  return (
    <footer className="bg-foreground py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={logoWmti} alt="WMTi" className="h-8 w-auto brightness-200" />
            <div>
              <p className="font-body text-xs text-background/40">
                Tecnologia da Informação
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            {["Dell Technologies Partner", "Microsoft Partner", "pfSense Certified"].map((cert) => (
              <span key={cert} className="font-mono text-[10px] tracking-wider uppercase text-background/30">
                {cert}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-background/10 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-background/30">
            © {new Date().getFullYear()} WMTi Tecnologia da Informação. Todos os direitos reservados.
          </p>
          <p className="font-mono text-xs text-background/30">
            Jacareí, SP — (11) 96316-6915
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
