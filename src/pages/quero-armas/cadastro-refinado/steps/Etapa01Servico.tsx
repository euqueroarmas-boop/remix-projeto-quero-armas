import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import QACadastroRefinadoCard from "../components/QACadastroRefinadoCard";
import { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface ServicoCatalogo {
  slug: string;
  nome: string;
  descricao_curta: string | null;
  descricao_full: string | null;
  preco: number | null;
}

interface Props {
  state: CadastroRefinadoState;
  update: (patch: Partial<CadastroRefinadoState>) => void;
  onNext: () => void;
}

const FALLBACK_BULLETS = [
  "Análise documental por especialistas",
  "Acompanhamento processual em tempo real",
  "Suporte jurídico durante todo o processo",
];

export default function Etapa01Servico({ state, update, onNext }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [servico, setServico] = useState<ServicoCatalogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safety-net: alguns redirects legados podem chegar com underscore.
  // O catálogo qa_servicos_catalogo SEMPRE usa hífen → normalizamos defensivamente.
  const rawSlug = params.get("servico") || state.servicoSlug;
  const slug = rawSlug ? rawSlug.replace(/_/g, "-") : rawSlug;

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    update({
      servicoSlug: slug,
      origem: params.get("origem") || state.origem,
      perfilV2: params.get("perfil_v2") || state.perfilV2,
    });

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo")
        .select("slug,nome,descricao_curta,descricao_full,preco")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      else setServico((data as unknown) as ServicoCatalogo | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Sem serviço selecionado
  if (!slug) {
    return (
      <QACadastroRefinadoShell
        step={1}
        eyebrow="CADASTRO · ESCOLHA O SERVIÇO"
        title="Volte e selecione um serviço"
        subtitle="Para continuar, escolha o serviço desejado no nosso assistente guiado."
        onBack={() => navigate(-1)}
      >
        <button className="qa-ref-btn qa-ref-btn-primary" onClick={() => navigate("/cadastro-v2")}>
          Ir para o assistente
        </button>
      </QACadastroRefinadoShell>
    );
  }

  const eyebrow = `CADASTRO · ${(servico?.nome || slug).toUpperCase()}`;
  const preco = servico?.preco ?? 0;

  return (
    <QACadastroRefinadoShell
      step={1}
      eyebrow={eyebrow}
      title="Confirme seu serviço"
      subtitle="Revise os detalhes do serviço escolhido. Você pode trocar a qualquer momento."
      onBack={() => navigate("/cadastro-v2")}
    >
      {loading ? (
        <QACadastroRefinadoCard><div className="qa-ref-empty">Carregando serviço…</div></QACadastroRefinadoCard>
      ) : error || !servico ? (
        <QACadastroRefinadoCard>
          <div className="qa-ref-empty">
            Não conseguimos carregar este serviço.
            <div className="qa-ref-error-text">{error || `Slug não encontrado: ${slug}`}</div>
          </div>
        </QACadastroRefinadoCard>
      ) : (
        <>
          <QACadastroRefinadoCard>
            <div className="qa-ref-service-head">
              <div className="qa-ref-service-info">
                <span className="qa-ref-caps">Serviço selecionado</span>
                <h2 className="qa-ref-service-name">{servico.nome}</h2>
                {(servico.descricao_curta || servico.descricao_full) && (
                  <p className="qa-ref-service-desc">{servico.descricao_curta || servico.descricao_full}</p>
                )}
              </div>
              <div className="qa-ref-price">
                <small>R$</small>
                {preco.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <ul className="qa-ref-bullets">
              {FALLBACK_BULLETS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </QACadastroRefinadoCard>

          <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
            <button className="qa-ref-btn qa-ref-btn-primary" onClick={onNext}>
              Continuar para documentos
            </button>
            <button
              className="qa-ref-btn-link"
              type="button"
              style={{ display: "block", textAlign: "center" }}
              onClick={() => navigate("/cadastro-v2")}
            >
              Não é esse serviço? Voltar e escolher outro
            </button>
          </div>
        </>
      )}
    </QACadastroRefinadoShell>
  );
}