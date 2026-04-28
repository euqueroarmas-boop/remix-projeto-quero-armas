import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShoppingBag, Sparkles, FileText, ChevronRight, Shield, Loader2 } from "lucide-react";

/* =============================================================================
 * QAContratarServicoPage — catálogo de serviços/produtos para o cliente.
 *
 * Lê de `qa_servicos_catalogo` (tabela criada na migration 2026-04-28).
 * Ao clicar em "Contratar", redireciona para o wizard /cadastro?servico=slug,
 * que irá pré-preencher a Etapa 0 e — se o cliente já estiver logado — usar o
 * mesmo cadastro existente (evitando duplicidade pelo CPF/e-mail).
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
}

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function QAContratarServicoPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      setLogado(!!sess.session);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("id, slug, nome, categoria, tipo, descricao_curta, preco, recorrente, gera_processo, exige_pagamento, ativo, display_order")
        .eq("ativo", true)
        .order("display_order", { ascending: true });
      if (!error && data) setItems(data as any);
      setLoading(false);
    })();
  }, []);

  const grupos = useMemo(() => {
    const map = new Map<string, CatalogoItem[]>();
    items.forEach((it) => {
      const arr = map.get(it.categoria) ?? [];
      arr.push(it);
      map.set(it.categoria, arr);
    });
    return Array.from(map.entries());
  }, [items]);

  const handleContratar = (slug: string) => {
    if (logado) {
      // Cliente logado vai direto para a tela de revisão rápida (Fase 2)
      navigate(`/area-do-cliente/contratar/${slug}/confirmar`);
    } else {
      // Visitante: pergunta se já é cliente (login) ou abre wizard
      navigate(`/area-do-cliente/contratar/${slug}/identificar`);
    }
  };

  return (
    <div data-tactical-portal className="min-h-screen">
      <div className="qa-resumo-light">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 bg-white sticky top-0 z-10">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate(logado ? "/area-do-cliente" : "/")}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight">
                Contratar serviço ou produto
              </h1>
              <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">
                Escolha o serviço — o sistema cria automaticamente o processo e o checklist correto.
              </p>
            </div>
            <ShoppingBag className="h-5 w-5 text-amber-600 hidden sm:block" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
            </div>
          ) : grupos.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Nenhum serviço disponível no momento.
            </div>
          ) : (
            grupos.map(([categoria, itens]) => (
              <section key={categoria}>
                <div className="flex items-center gap-2 mb-2.5">
                  <Shield className="h-3.5 w-3.5 text-slate-500" />
                  <h2 className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-700">
                    {categoria}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200/70" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {itens.map((it) => {
                    const preco = formatBRL(it.preco);
                    return (
                      <div
                        key={it.id}
                        className="rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition p-4 flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 uppercase leading-tight">
                            {it.nome}
                          </h3>
                          {it.gera_processo && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 shrink-0">
                              Gera processo
                            </span>
                          )}
                        </div>
                        {it.descricao_curta && (
                          <p className="text-[12px] text-slate-600 mt-1.5 leading-snug">
                            {it.descricao_curta}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500">
                            {preco ? (
                              <span className="font-semibold text-slate-700">
                                {preco}
                                {it.recorrente ? <span className="font-normal">/mês</span> : null}
                              </span>
                            ) : (
                              <span className="italic">Sob consulta</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleContratar(it.slug)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold uppercase tracking-wider transition"
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

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-900">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Ao contratar, você será levado(a) ao cadastro guiado em 5 etapas. Se já é cliente,
              seus dados serão reaproveitados automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}