import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShoppingBag, Sparkles, FileText, ChevronRight, Shield, Loader2, X } from "lucide-react";
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";

/* =============================================================================
 * QAContratarServicoPage — catálogo de serviços/produtos para o cliente.
 *
 * Lê de `qa_servicos_catalogo` (tabela criada na migration 2026-04-28).
 * Ao clicar em "Contratar", redireciona para o wizard /cadastro?servico=slug,
 * que irá pré-preencher a Etapa 0 e — se o cliente já estiver logado — usar o
 * mesmo cadastro existente (evitando duplicidade pelo CPF/e-mail).
 *
 * Apresentação em kanban: cada categoria do catálogo é uma coluna; os
 * serviços daquela categoria empilham verticalmente dentro da coluna.
 * Visual dark premium — mesma paleta usada no checkout guiado (.qa-refinado).
 * ============================================================================= */

interface CatalogoItem {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  tipo: "servico" | "produto";
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
  gera_processo: boolean;
  exige_pagamento: boolean;
  ativo: boolean;
  display_order: number;
  exige_acervo: boolean | null;
  exige_cr: boolean | null;
}

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function QAContratarServicoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const trilha = searchParams.get("trilha");       // "inicial" | "defesa_pessoal" | "continuidade" | null
  const possuiArma = searchParams.get("possuiArma"); // "sim" | "nao" | "nao_sei" | null
  const finalidade = searchParams.get("finalidade"); // "caca" | "tiro_esportivo" | "colecionamento" | "defesa_pessoal" | null
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      setLogado(!!sess.session);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("id, slug, nome, categoria, tipo, descricao_curta, preco, recorrente, gera_processo, exige_pagamento, ativo, display_order, exige_acervo, exige_cr")
        .eq("ativo", true)
        .order("display_order", { ascending: true });
      if (!error && data) setItems(data as any);
      setLoading(false);
    })();
  }, []);

  const CAT_SINARM = "SINARM CAC";
  const CAT_PF = "Polícia Federal";
  const CAT_GERAL = "Geral"; // serviços válidos para ambas as trilhas (ex: 2ª via CRAF)

  const itemsFiltrados = useMemo(() => {
    if (trilha === "inicial") {
      const sinarm = items.filter((i) => i.categoria === CAT_SINARM || i.categoria === CAT_GERAL);
      if (possuiArma === "nao") {
        return sinarm.filter((i) => i.exige_acervo !== true && i.exige_cr !== true);
      }
      return sinarm;
    }

    if (trilha === "defesa_pessoal") {
      const pf = items.filter((i) => i.categoria === CAT_PF || i.categoria === CAT_GERAL);
      if (possuiArma === "nao") {
        return pf.filter((i) => i.exige_acervo !== true);
      }
      return pf;
    }

    if (trilha === "continuidade") {
      if (finalidade === "defesa_pessoal") {
        return items.filter(
          (i) => (i.categoria === CAT_PF || i.categoria === CAT_GERAL) && i.exige_acervo === true
        );
      }
      return items.filter(
        (i) => (i.categoria === CAT_SINARM || i.categoria === CAT_GERAL) && i.exige_cr === true
      );
    }

    return items;
  }, [items, trilha, possuiArma, finalidade]);

  const grupos = useMemo(() => {
    const map = new Map<string, CatalogoItem[]>();
    itemsFiltrados.forEach((it) => {
      const arr = map.get(it.categoria) ?? [];
      arr.push(it);
      map.set(it.categoria, arr);
    });
    return Array.from(map.entries());
  }, [itemsFiltrados]);

  function limparFiltros() {
    const next = new URLSearchParams(searchParams);
    next.delete("trilha");
    next.delete("possuiArma");
    next.delete("finalidade");
    setSearchParams(next, { replace: true });
  }

  const labelFinalidade: Record<string, string> = {
    tiro_esportivo: "Tiro esportivo",
    caca: "Caça",
    colecionamento: "Colecionamento",
    defesa_pessoal: "Defesa pessoal",
  };
  const labelTrilha =
    trilha === "inicial" && possuiArma === "nao"
      ? "CR de CAC · Primeiro CR"
      : trilha === "inicial"
      ? "CR de CAC"
      : trilha === "defesa_pessoal" && possuiArma === "nao"
      ? "Defesa pessoal · Aquisição"
      : trilha === "defesa_pessoal"
      ? "Defesa pessoal"
      : trilha === "continuidade" && finalidade
      ? `Regularizar · ${labelFinalidade[finalidade] ?? finalidade}`
      : trilha === "continuidade"
      ? "Mexer em arma que já tenho"
      : null;

  const handleContratar = (slug: string) => {
    if (logado) {
      // Cliente logado vai direto para a tela de revisão rápida (Fase 2)
      navigate(`/area-do-cliente/contratar/${slug}/confirmar`);
    } else {
      // Visitante: vai DIRETO para o cadastro público com o serviço pré-selecionado.
      // O próprio wizard mostra todas as opções do catálogo caso queira trocar.
      navigate(`/cadastro?servico=${slug}`);
    }
  };

  return (
    <div data-tactical-portal className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(5,5,5,0.92)", backdropFilter: "blur(10px)",
          borderBottom: "0.5px solid var(--qa-ref-border-soft)",
          padding: "16px 20px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate(logado ? "/area-do-cliente" : "/")}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border)",
              color: "var(--qa-ref-ink)", cursor: "pointer",
            }}
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
              color: "var(--qa-ref-ink)", margin: 0,
            }}>
              Contratar serviço ou produto
            </h1>
            <p style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)", margin: "2px 0 0" }}>
              Escolha o serviço — o sistema cria automaticamente o processo e o checklist correto.
            </p>
          </div>
          <ShoppingBag size={18} color="var(--qa-ref-accent)" style={{ flexShrink: 0 }} />
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
        {labelTrilha && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              borderRadius: 99, border: "1px solid var(--qa-ref-accent-strong)",
              background: "var(--qa-ref-accent-soft)", padding: "6px 12px",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--qa-ref-accent)",
            }}>
              Trilha: {labelTrilha}
              <button
                type="button"
                onClick={limparFiltros}
                style={{
                  width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--qa-ref-accent)",
                }}
                aria-label="Remover filtro de trilha"
              >
                <X size={11} />
              </button>
            </span>
            <span style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)" }}>Mostrando apenas serviços compatíveis</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
            <Loader2 size={22} color="var(--qa-ref-accent)" className="animate-spin" />
          </div>
        ) : grupos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 0", color: "var(--qa-ref-ink-soft)", fontSize: 13 }}>
            Nenhum serviço disponível no momento.
          </div>
        ) : (
          /* ── Kanban: uma coluna por categoria, rolagem horizontal ────────── */
          <div
            style={{
              display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8,
              scrollSnapType: "x proximity",
            }}
          >
            {grupos.map(([categoria, itens]) => (
              <section
                key={categoria}
                style={{
                  flex: "0 0 290px", scrollSnapAlign: "start",
                  background: "var(--qa-ref-paper)", border: "0.5px solid var(--qa-ref-border)",
                  borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={13} color="var(--qa-ref-ink-soft)" />
                  <h2 style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: "var(--qa-ref-ink)", margin: 0, flex: 1,
                  }}>
                    {categoria}
                  </h2>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "var(--qa-ref-ink-soft)",
                    background: "var(--qa-ref-paper-2)", borderRadius: 99, padding: "1px 7px",
                  }}>
                    {itens.length}
                  </span>
                </div>

                {itens.map((it) => {
                  const preco = formatBRL(it.preco);
                  return (
                    <div
                      key={it.id}
                      style={{
                        background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border-soft)",
                        borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
                        transition: "border-color .15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <h3 style={{
                          fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3,
                          color: "var(--qa-ref-ink)", margin: 0,
                        }}>
                          {it.nome}
                        </h3>
                        {it.gera_processo && (
                          <span style={{
                            fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                            padding: "2px 6px", borderRadius: 5, flexShrink: 0,
                            background: "var(--qa-ref-success-soft)", color: "var(--qa-ref-success)",
                          }}>
                            Gera processo
                          </span>
                        )}
                      </div>

                      {it.descricao_curta && (
                        <p style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", lineHeight: 1.5, margin: 0 }}>
                          {it.descricao_curta}
                        </p>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                        <div style={{ fontSize: 11, color: "var(--qa-ref-ink-soft)" }}>
                          {preco ? (
                            <span style={{ fontWeight: 700, color: "var(--qa-ref-ink)" }}>
                              {preco}
                              {it.recorrente ? <span style={{ fontWeight: 400 }}>/mês</span> : null}
                            </span>
                          ) : (
                            <span style={{ fontStyle: "italic" }}>Sob consulta</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleContratar(it.slug)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "7px 11px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: "var(--qa-ref-accent)", color: "#1a1206",
                            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                          }}
                        >
                          <Sparkles size={12} />
                          Contratar
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}

        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", borderRadius: 10,
          background: "var(--qa-ref-accent-soft)", border: "1px solid var(--qa-ref-accent-strong)",
          fontSize: 11, color: "var(--qa-ref-accent)", lineHeight: 1.6,
        }}>
          <FileText size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0 }}>
            Ao contratar, você será levado(a) ao cadastro guiado em 5 etapas. Se já é cliente,
            seus dados serão reaproveitados automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
