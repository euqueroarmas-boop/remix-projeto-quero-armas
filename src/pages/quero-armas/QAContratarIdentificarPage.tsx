import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, Loader2, Sparkles, Zap, ChevronRight } from "lucide-react";
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";
import { KanbanPageHeader, KanbanCard, KanbanTag } from "@/components/quero-armas/contratar/KanbanUI";

/**
 * QAContratarIdentificarPage — Visitante não logado escolheu um serviço.
 * Pergunta: já é cliente? -> /area-do-cliente/login?next=...
 *           sou novo?    -> /cadastro?servico=slug (wizard público completo)
 *
 * Visual dark premium (.qa-refinado) + linguagem de cards do
 * ResumoClienteKanbanMockPage, para ficar consistente com o restante do
 * fluxo "Contratar serviço".
 */
export default function QAContratarIdentificarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [nome, setNome] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Se já estiver logado, vai direto para revisão
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/confirmar`, { replace: true });
        return;
      }
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome")
        .eq("slug", slug)
        .maybeSingle();
      setNome((data as any)?.nome ?? slug);
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
    {
      onClick: irParaLogin,
      Icon: LogIn,
      tag: "Mais rápido",
      tagTone: "accent" as const,
      title: "Continuar contratação — já sou cliente",
      desc: "Faço login e contrato em segundos — só revisar dados.",
    },
    {
      onClick: irParaCadastro,
      Icon: UserPlus,
      tag: "Cadastro guiado",
      tagTone: "ok" as const,
      title: "Sou novo aqui",
      desc: "Faço o cadastro guiado em 5 etapas com o serviço já selecionado.",
    },
    {
      onClick: irParaSolicitar,
      Icon: Zap,
      tag: "Sem login",
      tagTone: "warn" as const,
      title: "Solicitar agora",
      desc: "Envio nome, CPF, e-mail, telefone e o valor combinado — equipe valida e me retorna.",
    },
  ];

  return (
    <div className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)" }}>
      <KanbanPageHeader
        crumb="Quero Armas · Contratar"
        title="Você já é cliente?"
        meta={<span>Serviço selecionado: <strong style={{ color: "var(--qa-ref-ink)" }}>{loading ? "…" : nome}</strong></span>}
        onBack={() => navigate("/carrinho")}
      />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
            <Loader2 size={22} color="var(--qa-ref-accent)" className="animate-spin" />
          </div>
        ) : (
          <>
            {opcoes.map((op) => (
              <button
                key={op.title}
                type="button"
                onClick={op.onClick}
                style={{ textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
              >
                <KanbanCard>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: "var(--qa-ref-accent-soft)", color: "var(--qa-ref-accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <op.Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <KanbanTag tone={op.tagTone}>{op.tag}</KanbanTag>
                      <div style={{
                        fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "var(--qa-ref-ink)",
                        marginTop: 6,
                      }}>
                        {op.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", marginTop: 3, lineHeight: 1.5 }}>
                        {op.desc}
                      </div>
                    </div>
                    <ChevronRight size={16} color="var(--qa-ref-ink-soft)" style={{ flexShrink: 0, marginTop: 10 }} />
                  </div>
                </KanbanCard>
              </button>
            ))}

            <p style={{
              fontSize: 11, color: "var(--qa-ref-ink-soft)", lineHeight: 1.6, marginTop: 8,
              paddingTop: 12, borderTop: "0.5px solid var(--qa-ref-border-soft)",
            }}>
              <Sparkles size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1, color: "var(--qa-ref-accent)" }} />
              Seu processo começa após a confirmação do pagamento. Você receberá acesso ao portal
              para acompanhar documentos, etapas e próximos passos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
