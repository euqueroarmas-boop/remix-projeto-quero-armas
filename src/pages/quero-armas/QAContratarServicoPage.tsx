import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShoppingBag, Sparkles, FileText, ChevronRight, Shield, Loader2, X } from "lucide-react";

/* =============================================================================
 * QAContratarServicoPage — catálogo de serviços/produtos para o cliente.
 * Estilo: Catálogo Light (Ficha Catalográfica Light)
 * Paleta: Page #FAFAFA | Paper #FFFFFF | Ink #0A0A0A | Border #E4E4E4
 *         Secondary #6A6A6A | Micro-dots RGB apenas para status (8px)
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
    <div data-tactical-portal className="min-h-screen bg-[#FAFAFA]">
      {/* Header — discreto, sem sticky colorido */}
      <div className="px-4 pt-6 pb-4 border-b border-[#E4E4E4]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(logado ? "/area-do-cliente" : "/")}
            className="w-9 h-9 rounded-sm flex items-center justify-center border border-[#E4E4E4] bg-[#FFFFFF] hover:bg-[#FAFAFA] text-[#0A0A0A] transition"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-bold text-[#0A0A0A] uppercase tracking-tight">
              Contratar serviço ou produto
            </h1>
            <p className="text-[11px] md:text-xs text-[#6A6A6A] mt-0.5">
              Escolha o serviço — o sistema cria automaticamente o processo e o checklist correto.
            </p>
          </div>
          <ShoppingBag className="h-5 w-5 text-[#6A6A6A] hidden sm:block" />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {labelTrilha && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#E4E4E4] bg-[#FFFFFF] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">
              Trilha: {labelTrilha}
              <button
                type="button"
                onClick={limparFiltros}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#E4E4E4]"
                aria-label="Remover filtro de trilha"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <span className="text-[11px] text-[#6A6A6A]">Mostrando apenas serviços compatíveis</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-[#0A0A0A] animate-spin" />
          </div>
        ) : grupos.length === 0 ? (
          <div className="text-center py-16 text-[#6A6A6A] text-sm">
            Nenhum serviço disponível no momento.
          </div>
        ) : (
          grupos.map(([categoria, itens]) => (
            <section key={categoria} className="border-l-2 border-[#E4E4E4] pl-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-3.5 w-3.5 text-[#6A6A6A]" />
                <h2 className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-[#6A6A6A]">
                  {categoria}
                </h2>
                <div className="flex-1 h-px bg-[#E4E4E4]" />
                <span className="text-[10px] text-[#6A6A6A] font-mono">
                  QTY: {String(itens.length).padStart(2, "0")}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {itens.map((it) => {
                  const preco = formatBRL(it.preco);
                  return (
                    <div
                      key={it.id}
                      className="rounded-sm bg-[#FFFFFF] border border-[#E4E4E4] hover:border-[#0A0A0A] transition p-4 flex flex-col shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#0A0A0A] uppercase leading-tight">
                          {it.nome}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {it.gera_processo && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-[#28C840]" aria-hidden="true" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#6A6A6A]">
                                Gera processo
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Anotação técnica em canto */}
                      <div className="flex justify-end mt-0.5">
                        <span className="text-[10px] text-[#6A6A6A] font-mono uppercase">
                          {it.tipo === "servico" ? "SRV" : "PRD"} · ID:{it.id.slice(0, 6)}
                        </span>
                      </div>
                      {it.descricao_curta && (
                        <p className="text-[12px] text-[#6A6A6A] mt-1.5 leading-snug">
                          {it.descricao_curta}
                        </p>
                      )}
                      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                        <div className="text-[11px]">
                          {preco ? (
                            <span className="font-semibold text-[#0A0A0A]">
                              {preco}
                              {it.recorrente ? <span className="font-normal text-[#6A6A6A]">/mês</span> : null}
                            </span>
                          ) : (
                            <span className="italic text-[#6A6A6A]">Sob consulta</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleContratar(it.slug)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#1A1A1A] text-[#FFFFFF] text-[11px] font-bold uppercase tracking-wider transition"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Contratar
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {/* Footer informativo — estilo Catálogo Light */}
        <div className="flex items-start gap-2 p-3 rounded-sm bg-[#FFFFFF] border border-[#E4E4E4] text-[11px] text-[#6A6A6A]">
          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Ao contratar, você será levado(a) ao cadastro guiado em 5 etapas. Se já é cliente,
            seus dados serão reaproveitados automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
