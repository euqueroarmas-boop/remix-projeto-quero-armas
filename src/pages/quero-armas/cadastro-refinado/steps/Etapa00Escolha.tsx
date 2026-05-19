import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, GraduationCap } from "lucide-react";
import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import {
  QA_V2_PERFIS,
  QA_V2_CURSOS,
  QA_V2_PATH_DEFESA_PESSOAL,
  QA_V2_PATH_CAC,
  QA_V2_PATH_PROFISSAO,
  QA_V2_PATH_APOSENTADO,
  QA_V2_PATH_SESSION_KEY,
  type QAV2Node,
  type QAV2PathDefinition,
  type QAV2NodeOption,
} from "@/pages/quero-armas/qaCadastroV2Catalog";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onSelectService: (slug: string, perfilV2?: string, subperfilV2?: string) => void;
  /** Seleção de bundle (múltiplos serviços) — fluxo CAC "comprar arma".
   *  Quando ausente, o componente faz fallback para `onSelectService` com o
   *  primeiro slug do bundle, preservando compatibilidade. */
  onSelectBundle?: (
    slugs: string[],
    perfilV2?: string,
    subperfilV2?: string,
  ) => void;
  onBackToHome: () => void;
  initialPerfil?: string | null;
  /** Atalho discreto: usuário caiu direto na escolha guiada mas quer fazer
   *  login no Arsenal. Reabre Etapa00Identificacao. */
  onAbrirIdentificacao?: () => void;
}

const PATH_MAP: Record<string, QAV2PathDefinition> = {
  defesa_pessoal: QA_V2_PATH_DEFESA_PESSOAL,
  cac: QA_V2_PATH_CAC,
  profissional_ativo: QA_V2_PATH_PROFISSAO,
  aposentado_inativo: QA_V2_PATH_APOSENTADO,
};

const ROOT_STACK: string[] = [];

export default function Etapa00Escolha({ onSelectService, onBackToHome, initialPerfil, onAbrirIdentificacao }: Props) {
  // Desestruturação separada para incluir o callback opcional sem mexer no
  // contrato dos demais componentes que ainda chamam só onSelectService.
  // (parsed via props above)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  void 0;
  return Etapa00EscolhaImpl({ onSelectService, onBackToHome, initialPerfil, onAbrirIdentificacao });
}

function Etapa00EscolhaImpl({ onSelectService, onSelectBundle, onBackToHome, initialPerfil, onAbrirIdentificacao }: Props) {
  const navigate = useNavigate();
  const [stack, setStack] = useState<string[]>(() => {
    if (initialPerfil && (PATH_MAP[initialPerfil] || initialPerfil === "cursos")) {
      return [initialPerfil];
    }
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(QA_V2_PATH_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.stack)) return parsed.stack as string[];
        }
      } catch { /* ignore */ }
    }
    return ROOT_STACK;
  });

  const [precosCursos, setPrecosCursos] = useState<Record<string, number | null>>({});

  useEffect(() => {
    try {
      sessionStorage.setItem(
        QA_V2_PATH_SESSION_KEY,
        JSON.stringify({ stack, ts: new Date().toISOString() }),
      );
    } catch { /* ignore */ }
  }, [stack]);

  useEffect(() => {
    if (stack[0] !== "cursos") return;
    let cancelled = false;
    (async () => {
      const slugs = QA_V2_CURSOS.map((c) => c.slug);
      const { data } = await supabase
        .from("qa_servicos_catalogo")
        .select("slug, preco")
        .in("slug", slugs);
      if (cancelled || !data) return;
      const m: Record<string, number | null> = {};
      for (const r of data as Array<{ slug: string; preco: number | null }>) m[r.slug] = r.preco;
      setPrecosCursos(m);
    })();
    return () => { cancelled = true; };
  }, [stack]);

  const push = useCallback((key: string) => setStack((s) => [...s, key]), []);
  const pop = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) {
        onBackToHome();
        return s;
      }
      return s.slice(0, -1);
    });
  }, [onBackToHome]);

  const handleBack = useCallback(() => {
    if (stack.length === 0) onBackToHome();
    else pop();
  }, [stack.length, pop, onBackToHome]);

  // Resolve current node + breadcrumb labels
  const { node, crumbs, isCursos } = useMemo(() => {
    if (stack.length === 0) {
      return { node: null as QAV2Node | null, crumbs: [] as string[], isCursos: false };
    }
    if (stack[0] === "cursos") {
      return { node: null, crumbs: ["Cursos de tiro"], isCursos: true };
    }
    const path = PATH_MAP[stack[0]];
    if (!path) return { node: null, crumbs: [], isCursos: false };
    const crumbList: string[] = [path.tituloBreadcrumb];
    let current: QAV2Node = path.raiz;
    for (let i = 1; i < stack.length; i++) {
      const opt = current.opcoes.find(
        (o): o is Extract<QAV2NodeOption, { kind: "step" }> =>
          o.kind === "step" && o.key === stack[i],
      );
      if (!opt) break;
      crumbList.push(opt.titulo);
      const next = path.steps[stack[i]];
      if (!next) break;
      current = next;
    }
    return { node: current, crumbs: crumbList, isCursos: false };
  }, [stack]);

  // ────────── RAIZ ──────────
  if (stack.length === 0) {
    return (
      <QACadastroRefinadoShell
        step={0}
        total={6}
        eyebrow="ESCOLHA GUIADA · CADASTRO INICIAL"
        title="Para que você precisa da arma de fogo?"
        subtitle="Em 30 segundos identificamos o serviço certo para o seu caso. Você pode mudar a qualquer momento."
        onBack={onBackToHome}
      >
        {onAbrirIdentificacao && (
          <div className="qa-ref-id-shortcut-row">
            <button
              type="button"
              className="qa-ref-link-btn"
              onClick={onAbrirIdentificacao}
            >
              Já tenho conta no Arsenal
            </button>
          </div>
        )}
        {/* Atalho cursos — destaque sutil */}
        <button
          type="button"
          className="qa-ref-opt-card qa-ref-opt-shortcut"
          onClick={() => push("cursos")}
        >
          <div className="qa-ref-opt-icon" aria-hidden>
            <GraduationCap size={18} />
          </div>
          <div className="qa-ref-opt-body">
            <span className="qa-ref-caps qa-ref-opt-eyebrow">ATALHO</span>
            <div className="qa-ref-opt-title">Quero fazer um curso de tiro</div>
            <div className="qa-ref-opt-desc">Cursos práticos com instrução certificada</div>
          </div>
          <ChevronRight size={18} className="qa-ref-opt-chevron" />
        </button>

        <div className="qa-ref-opt-list">
          {QA_V2_PERFIS.map((p) => {
            const isPopular = p.id === "defesa_pessoal";
            return (
            <button
              key={p.id}
              type="button"
              className={`qa-ref-opt-card${isPopular ? " is-popular" : ""}`}
              onClick={() => {
                if (p.acao === "redirecionar_quiz") {
                  navigate("/descobrir-meu-caminho");
                  return;
                }
                push(p.id);
              }}
            >
              <div className="qa-ref-opt-icon" aria-hidden />
              <div className="qa-ref-opt-body">
                <div className="qa-ref-opt-title">{p.titulo}</div>
                <div className="qa-ref-opt-desc">{p.descricao}</div>
              </div>
              {isPopular && <span className="qa-ref-opt-tag-popular">POPULAR</span>}
              <ChevronRight size={18} className="qa-ref-opt-chevron" />
            </button>
            );
          })}
        </div>
      </QACadastroRefinadoShell>
    );
  }

  // ────────── CURSOS ──────────
  if (isCursos) {
    return (
      <QACadastroRefinadoShell
        step={0}
        total={6}
        eyebrow="CURSOS DE TIRO · ESCOLHA UM"
        title="Qual curso você quer fazer?"
        subtitle="Selecione o curso desejado para seguir com o cadastro."
        onBack={handleBack}
      >
        <Breadcrumb crumbs={crumbs} />
        <div className="qa-ref-opt-list">
          {QA_V2_CURSOS.map((c) => {
            const preco = precosCursos[c.slug];
            return (
              <button
                key={c.slug}
                type="button"
                className="qa-ref-opt-card"
                onClick={() =>
                  onSelectService(c.slug, "cursos", "curso_tiro_transversal")
                }
              >
                <div className="qa-ref-opt-icon" aria-hidden>
                  <GraduationCap size={18} />
                </div>
                <div className="qa-ref-opt-body">
                  <div className="qa-ref-opt-title">{c.titulo}</div>
                  <div className="qa-ref-opt-desc">{c.descricao}</div>
                </div>
                {typeof preco === "number" && (
                  <span className="qa-ref-opt-price">
                    R$ {preco.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                )}
                <ChevronRight size={18} className="qa-ref-opt-chevron" />
              </button>
            );
          })}
        </div>
      </QACadastroRefinadoShell>
    );
  }

  // ────────── NÓ INTERNO (perfil/sub) ──────────
  if (!node) {
    return (
      <QACadastroRefinadoShell
        step={0}
        total={6}
        title="Algo inesperado aconteceu"
        subtitle="Volte e tente novamente."
        onBack={handleBack}
      >
        <button className="qa-ref-btn qa-ref-btn-primary" onClick={onBackToHome}>
          Recomeçar
        </button>
      </QACadastroRefinadoShell>
    );
  }

  const perfilId = stack[0];

  return (
    <QACadastroRefinadoShell
      step={0}
      total={6}
      eyebrow={`ESCOLHA GUIADA · ${crumbs[crumbs.length - 1]?.toUpperCase() ?? ""}`}
      title={node.pergunta}
      subtitle={node.subtitulo}
      onBack={handleBack}
    >
      <Breadcrumb crumbs={crumbs} />
      <div className="qa-ref-opt-list">
        {node.opcoes.map((opt, idx) => (
          <button
            key={opt.kind === "step" ? `s-${opt.key}` : `srv-${opt.servicoSlug}-${idx}`}
            type="button"
            className="qa-ref-opt-card"
            onClick={() => {
              if (opt.kind === "step") {
                push(opt.key);
              } else {
                onSelectService(opt.servicoSlug, perfilId, opt.subperfilV2);
              }
            }}
          >
            <div className="qa-ref-opt-icon" aria-hidden />
            <div className="qa-ref-opt-body">
              <div className="qa-ref-opt-title">{opt.titulo}</div>
              <div className="qa-ref-opt-desc">{opt.descricao}</div>
            </div>
            <ChevronRight size={18} className="qa-ref-opt-chevron" />
          </button>
        ))}
      </div>
    </QACadastroRefinadoShell>
  );
}

function Breadcrumb({ crumbs }: { crumbs: string[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav className="qa-ref-breadcrumb" aria-label="Trilha de escolha">
      <span>Cadastro</span>
      {crumbs.map((c, i) => (
        <span key={`${c}-${i}`}>
          <span className="qa-ref-breadcrumb-sep">›</span>
          {c}
        </span>
      ))}
    </nav>
  );
}