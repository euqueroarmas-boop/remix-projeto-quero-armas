import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Loader2 } from "lucide-react";
import CheckoutShell from "@/components/quero-armas/checkout/CheckoutShell";

/**
 * QAContratarIdentificarPage — Split narrativo 50/50 dark monocromático.
 * Esquerda: resumo grande do serviço (preço Oswald gigante).
 * Direita: 3 opções como linhas tipográficas separadas por hairline.
 */

interface Catalogo {
  nome: string;
  preco: number | null;
  descricao_curta: string | null;
}

const D = {
  bg: "#000000",
  paper: "#0A0A0A",
  panel: "#141414",
  panelSoft: "#1A1A1A",
  hairline: "#2A2A2A",
  ink: "#C7C7C7",
  inkFaint: "#5C5C5C",
  inkMute: "#242424",
};

function formatBRL(v: number | null) {
  if (v == null) return "A combinar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function QAContratarIdentificarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/confirmar`, { replace: true });
        return;
      }
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome, preco, descricao_curta")
        .eq("slug", slug)
        .maybeSingle();
      setCatalogo((data as any) ?? { nome: slug, preco: null, descricao_curta: null });
      setLoading(false);
    })();
  }, [slug, navigate]);

  const irParaLogin = () => {
    const next = encodeURIComponent(`/area-do-cliente/contratar/${slug}/confirmar`);
    navigate(`/area-do-cliente/login?next=${next}`);
  };
  const irParaCadastro = () => navigate(`/cadastro?servico=${slug}`);
  const irParaSolicitar = () => navigate(`/area-do-cliente/contratar/${slug}/solicitar`);

  const opcoes = [
    { kicker: "Retornar ao acesso", titulo: "Já sou cliente", onClick: irParaLogin },
    { kicker: "Novo registro",      titulo: "Primeira vez",  onClick: irParaCadastro },
    { kicker: "Acesso rápido",      titulo: "Sem cadastro",  onClick: irParaSolicitar },
  ];

  return (
    <CheckoutShell step={1} slug={slug} backTo="/carrinho" hideSidebar>
      <div
        className="qa-id-split"
        style={{
          background: D.paper,
          border: `1px solid ${D.hairline}`,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          minHeight: 540,
        }}
      >
        {/* ── Esquerda: narrativa ─────────────────────────── */}
        <div
          className="qa-id-left"
          style={{
            flex: "1 1 50%",
            background: D.panel,
            borderRight: `1px solid ${D.hairline}`,
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "5px 10px",
                background: D.panelSoft,
                border: `1px solid ${D.hairline}`,
                color: D.inkFaint,
                fontSize: 10,
                letterSpacing: "0.2em",
                fontWeight: 600,
              }}
            >
              PASSO 01 DE 04
            </span>
          </div>

          <div>
            <h2
              style={{
                fontFamily: "Oswald, sans-serif",
                color: D.inkFaint,
                fontSize: 22,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                lineHeight: 1,
                margin: 0,
                marginBottom: 14,
              }}
            >
              {loading ? "…" : catalogo?.nome}
            </h2>
            <h1
              style={{
                fontFamily: "Oswald, sans-serif",
                color: D.ink,
                fontSize: 68,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                margin: 0,
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={28} /> : formatBRL(catalogo?.preco ?? null)}
            </h1>
            <p
              style={{
                color: D.inkFaint,
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 320,
                marginTop: 24,
              }}
            >
              {catalogo?.descricao_curta ||
                "Inicie seu processo de identificação para prosseguir com sua solicitação."}
            </p>
          </div>

          <div style={{ width: 48, height: 1, background: D.hairline }} />
        </div>

        {/* ── Direita: opções ─────────────────────────────── */}
        <div
          className="qa-id-right"
          style={{
            flex: "1 1 50%",
            padding: "32px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {opcoes.map((op, idx) => (
            <button
              key={op.titulo}
              onClick={op.onClick}
              className="qa-id-opt"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "28px 0",
                background: "transparent",
                border: "none",
                borderBottom: idx < opcoes.length - 1 ? `1px solid ${D.hairline}` : "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div className="qa-id-opt-text" style={{ transition: "transform .3s ease" }}>
                <p
                  style={{
                    color: D.inkFaint,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    margin: 0,
                    marginBottom: 6,
                  }}
                >
                  {op.kicker}
                </p>
                <h3
                  style={{
                    color: D.ink,
                    fontSize: 22,
                    fontWeight: 300,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {op.titulo}
                </h3>
              </div>
              <ChevronRight className="qa-id-opt-arrow" size={20} color={D.inkMute} />
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .qa-id-opt:hover .qa-id-opt-text { transform: translateX(8px); }
        .qa-id-opt:hover .qa-id-opt-arrow { color: ${D.ink} !important; }
        .qa-id-opt-arrow { transition: color .3s ease; }

        @media (max-width: 900px) {
          .qa-id-split { flex-direction: column !important; min-height: 0 !important; }
          .qa-id-left {
            border-right: none !important;
            border-bottom: 1px solid ${D.hairline} !important;
            padding: 32px 28px !important;
          }
          .qa-id-right { padding: 16px 28px 32px !important; }
          .qa-id-left h1 { font-size: 48px !important; }
        }
      `}</style>
    </CheckoutShell>
  );
}