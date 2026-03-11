const Footer = () => {
  return (
    <footer className="bg-foreground py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-mono text-sm font-bold text-background">
              <span className="text-primary">//</span> NEXCORE
            </p>
            <p className="font-body text-xs text-background/40 mt-1">
              Infraestrutura de TI Especializada
            </p>
          </div>
          <div className="flex items-center gap-8">
            {["Dell Technologies Partner", "Microsoft Partner", "pfSense Certified"].map((cert) => (
              <span key={cert} className="font-mono text-[10px] tracking-wider uppercase text-background/30">
                {cert}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-background/10 mt-8 pt-8">
          <p className="font-body text-xs text-background/30 text-center">
            © {new Date().getFullYear()} Nexcore. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
