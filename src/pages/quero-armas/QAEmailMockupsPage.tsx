import QueroArmasEmailMockups from "./QueroArmasEmailMockups";

/**
 * /email-mockups — bancada visual dos mockups de e-mails transacionais.
 * Renderiza o componente fornecido (QueroArmasEmailMockups.tsx) preservando
 * EXATAMENTE identidade visual, layout, textos, logo, cores, placeholders
 * e separação dos fluxos (Arsenal Inteligente × Serviços Contratados).
 */
export default function QAEmailMockupsPage() {
  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      <header
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "34px 18px 0",
          background: "#000",
          color: "#fff",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: "#66666E",
            margin: "0 0 10px",
            fontWeight: 700,
          }}
        >
          // BANCADA VISUAL · QUERO ARMAS
        </p>
        <h1
          style={{
            fontSize: 34,
            letterSpacing: "-.035em",
            lineHeight: 1.05,
            margin: 0,
            fontWeight: 760,
            color: "#fff",
          }}
        >
          Mockups de E-mails · Quero Armas
        </h1>
      </header>
      <QueroArmasEmailMockups />
    </div>
  );
}