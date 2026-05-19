import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
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
  onBack: () => void;
}

const FALLBACK_BULLETS = [
  "Análise documental por especialistas",
  "Acompanhamento processual em tempo real",
  "Suporte jurídico durante todo o processo",
];

export default function Etapa01Servico({ state, update, onNext, onBack }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [servicos, setServicos] = useState<ServicoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Safety-net: alguns redirects legados podem chegar com underscore.
  // O catálogo qa_servicos_catalogo SEMPRE usa hífen → normalizamos.
  // Também aceita lista separada por vírgula (bundle CAC).
  const slugsFromUrl = useMemo(() => {
    const raw = params.get("servico");
    if (!raw) return null;
    return raw
      .split(",")
      .map((s) => s.trim().replace(/_/g, "-"))
      .filter(Boolean);
  }, [params]);

  const slugs = useMemo<string[]>(() => {
    if (slugsFromUrl && slugsFromUrl.length > 0) return slugsFromUrl;
    if (state.servicosSlugs && state.servicosSlugs.length > 0) {
      return state.servicosSlugs.map((s) => s.replace(/_/g, "-"));
    }
    if (state.servicoSlug) return [state.servicoSlug.replace(/_/g, "-")];
    return [];
  }, [slugsFromUrl, state.servicosSlugs, state.servicoSlug]);

  useEffect(() => {
    if (slugs.length === 0) {
      setLoading(false);
      return;
    }
    // Sincroniza state com slugs efetivos (a partir de URL ou state legado)
    const sameAsState =
      state.servicosSlugs.length === slugs.length &&
      state.servicosSlugs.every((s, i) => s === slugs[i]);
    if (!sameAsState) {
      update({
        servicosSlugs: slugs,
        origem: params.get("origem") || state.origem,
        perfilV2: params.get("perfil_v2") || state.perfilV2,
      });
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo")
        .select("slug,nome,descricao_curta,descricao_full,preco")
        .in("slug", slugs)
        .eq("ativo", true);
      if (cancelled) return;
      if (error) setError(error.message);
      else {
        // Reordena conforme ordem original dos slugs
        const map = new Map<string, ServicoCatalogo>();
        for (const row of (data || []) as ServicoCatalogo[]) map.set(row.slug, row);
        setServicos(slugs.map((s) => map.get(s)).filter(Boolean) as ServicoCatalogo[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugs.join(",")]);

  const total = useMemo(
    () => servicos.reduce((acc, s) => acc + (s.preco ?? 0), 0),
    [servicos],
  );

  const handleRemover = (slugToRemove: string) => {
    if (state.servicosSlugs.length <= 1) return;
    const next = state.servicosSlugs.filter((s) => s !== slugToRemove);
    update({ servicosSlugs: next });
  };

  // Sem serviço selecionado — volta para Etapa 00 (escolha guiada)
  if (slugs.length === 0) {
    return (
      <QACadastroRefinadoShell
        step={1}
        eyebrow="CADASTRO · ESCOLHA O SERVIÇO"
        title="Volte e selecione um serviço"
        subtitle="Para continuar, escolha o serviço desejado no nosso assistente guiado."
        onBack={onBack}
      >
        <button className="qa-ref-btn qa-ref-btn-primary" onClick={onBack}>
          Ir para o assistente
        </button>
      </QACadastroRefinadoShell>
    );
  }

  const isBundle = slugs.length > 1;
  const primeiro = servicos[0];
  const eyebrow = isBundle
    ? `CADASTRO · ${slugs.length} SERVIÇOS SELECIONADOS`
    : `CADASTRO · ${(primeiro?.nome || slugs[0]).toUpperCase()}`;

  return (
    <QACadastroRefinadoShell
      step={1}
      eyebrow={eyebrow}
      title={isBundle ? "Confirme seus serviços" : "Confirme seu serviço"}
      subtitle={
        isBundle
          ? "Comprar arma como CAC envolve estes 3 serviços. Você pode remover algum se preferir contratar separado depois."
          : "Revise os detalhes do serviço escolhido. Você pode trocar a qualquer momento."
      }
      onBack={onBack}
    >
      {loading ? (
        <QACadastroRefinadoCard><div className="qa-ref-empty">Carregando serviço…</div></QACadastroRefinadoCard>
      ) : error || servicos.length === 0 ? (
        <QACadastroRefinadoCard>
          <div className="qa-ref-empty">
            Não conseguimos carregar este serviço.
            <div className="qa-ref-error-text">{error || `Slug não encontrado: ${slugs.join(", ")}`}</div>
          </div>
        </QACadastroRefinadoCard>
      ) : (
        <>
          {servicos.map((srv, idx) => {
            const podeRemover = isBundle && servicos.length > 1;
            const bundleDescricoes: Record<number, string> = {
              1: "Registrar a arma no seu nome.",
              2: "Liberar você para poder ir treinar ou caçar.",
            };
            const descricaoBundle = isBundle
              ? (idx === 0
                  ? (srv.descricao_curta || srv.descricao_full || `Serviço ${idx + 1} de ${servicos.length}`)
                  : bundleDescricoes[idx] || `Serviço ${idx + 1} de ${servicos.length}`)
              : (srv.descricao_curta || srv.descricao_full || `Serviço ${idx + 1} de ${servicos.length}`);
            if (isBundle) {
              return (
                <QACadastroRefinadoCard key={srv.slug}>
                  <div className="qa-ref-service-head">
                    <div className="qa-ref-service-info">
                      <span className="qa-ref-caps">
                        Serviço {idx + 1} de {servicos.length}
                      </span>
                      <h2 className="qa-ref-service-name">{srv.nome}</h2>
                      <p className="qa-ref-service-desc">{descricaoBundle}</p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      <div className="qa-ref-price">
                        <small>R$</small>
                        {(srv.preco ?? 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      {podeRemover && (
                        <button
                          type="button"
                          onClick={() => handleRemover(srv.slug)}
                          title="Remover este serviço"
                          aria-label={`Remover ${srv.nome}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.18)",
                            color: "var(--qa-ref-ink-soft, #b8b8b8)",
                            borderRadius: 6,
                            padding: "3px 7px",
                            fontSize: 10.5,
                            letterSpacing: ".04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          <X size={11} />
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="qa-ref-bullets">
                    {FALLBACK_BULLETS.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </QACadastroRefinadoCard>
              );
            }
            return (
              <QACadastroRefinadoCard key={srv.slug}>
                <div className="qa-ref-service-head">
                  <div className="qa-ref-service-info">
                    <span className="qa-ref-caps">
                      Serviço selecionado
                    </span>
                    <h2 className="qa-ref-service-name">{srv.nome}</h2>
                    {(srv.descricao_curta || srv.descricao_full) && (
                      <p className="qa-ref-service-desc">
                        {srv.descricao_curta || srv.descricao_full}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 8,
                    }}
                  >
                    <div className="qa-ref-price">
                      <small>R$</small>
                      {(srv.preco ?? 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                </div>
                <ul className="qa-ref-bullets">
                  {FALLBACK_BULLETS.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </QACadastroRefinadoCard>
            );
          })}

          {isBundle && (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid rgba(214,166,75,0.35)",
                background: "rgba(214,166,75,0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "var(--qa-ref-ink, #f5f5f5)",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                  color: "var(--qa-ref-ink-soft, #b8b8b8)",
                }}
              >
                Total dos serviços
              </span>
              <strong style={{ fontSize: 22 }}>
                R${" "}
                {total.toLocaleString("pt-BR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          )}

          {state.servicos_anteriores && state.servicos_anteriores.length > 0 && (
            (() => {
              const dup = state.servicos_anteriores.find(
                (s) =>
                  (s.servico_slug && s.servico_slug === state.servicoSlug) ||
                  (s.servico_nome &&
                    primeiro?.nome &&
                    String(s.servico_nome).toLowerCase() ===
                      String(primeiro.nome).toLowerCase()),
              );
              if (!dup) return null;
              return (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 14px",
                    border: "1px solid rgba(214,166,75,0.45)",
                    borderRadius: 10,
                    background: "rgba(214,166,75,0.08)",
                    color: "var(--qa-ref-ink)",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <strong>Existe um serviço parecido no seu histórico.</strong>{" "}
                  Deseja continuar mesmo assim?
                </div>
              );
            })()
          )}

          <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
            <button className="qa-ref-btn qa-ref-btn-primary" onClick={onNext}>
              Continuar para documentos
            </button>
            <button
              className="qa-ref-btn-link"
              type="button"
              style={{ display: "block", textAlign: "center" }}
              onClick={onBack}
            >
              {isBundle
                ? "Voltar e escolher outro caminho"
                : "Não é esse serviço? Voltar e escolher outro"}
            </button>
          </div>
        </>
      )}
    </QACadastroRefinadoShell>
  );
}