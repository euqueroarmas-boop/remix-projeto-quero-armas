export function QAFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="w-full text-center py-3 px-4 text-[11px] md:text-xs"
      style={{
        background: "hsl(0 0% 100%)",
        borderTop: "1px solid hsl(220 13% 91%)",
        color: "hsl(220 10% 45%)",
      }}
    >
      © {year} · Criado e desenvolvido por{" "}
      <span className="font-semibold" style={{ color: "hsl(220 20% 25%)" }}>
        WMTi Tecnologia da Informação
      </span>
      . Todos os direitos reservados.
      <span className="mx-2">·</span>
      <a
        href="tel:+5511963166915"
        className="font-semibold hover:underline"
        style={{ color: "hsl(220 20% 25%)" }}
      >
        +55 (11) 96316-6915
      </a>
    </footer>
  );
}
