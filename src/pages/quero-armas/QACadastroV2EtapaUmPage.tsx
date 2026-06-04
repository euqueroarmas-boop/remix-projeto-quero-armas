import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, GraduationCap, ShieldCheck, Crosshair, Briefcase, Award, HelpCircle, Check } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";
import {
  QA_V2_PERFIS,
  QA_V2_CURSOS,
  QA_V2_SESSION_KEY,
  type QAV2PerfilId,
  type QAV2Perfil,
} from "./qaCadastroV2Catalog";

/* =========================================================================
 * /cadastro-v2 — Etapa 1 (Fluxo guiado raiz)
 * Pergunta única: "Para que você precisa da arma de fogo?"
 * Aditivo, isolado. Não toca em /cadastro nem em QACadastroPublicoPage.
 * ========================================================================= */

const PERFIL_ICON: Record<QAV2PerfilId, React.ComponentType<{ className?: string }>> = {
  defesa_pessoal: ShieldCheck,
  cac: Crosshair,
  profissional_ativo: Briefcase,
  aposentado_inativo: Award,
  orientacao_necessaria: HelpCircle,
};

type SubTela = "perfis" | "cursos";

export default function QACadastroV2EtapaUmPage() {
  const navigate = useNavigate();
  const [subTela, setSubTela] = useState<SubTela>("perfis");
  const [selecionado, setSelecionado] = useState<QAV2PerfilId | null>(null);

  const persistir = useCallback((payload: Record<string, unknown>) => {
    try {
      sessionStorage.setItem(
        QA_V2_SESSION_KEY,
        JSON.stringify({ ...payload, ts: new Date().toISOString() }),
      );
    } catch {
      /* sessionStorage indisponível — segue sem bloquear */
    }
  }, []);

  const handleSelecionarPerfil = useCallback(
    (perfil: QAV2Perfil) => {
      setSelecionado(perfil.id);
      persistir({ perfil: perfil.id, orgao: perfil.orgao ?? null, origem: "v2" });

      // Etapa 2 — sub-rotas guiadas dedicadas (aditivo).
      const subRotaPorPerfil: Record<string, string> = {
        defesa_pessoal: "/cadastro-v2/defesa-pessoal",
        cac: "/cadastro-v2/cac",
        profissional_ativo: "/cadastro-v2/profissao-ativa",
        aposentado_inativo: "/cadastro-v2/aposentado",
      };
      const destino = subRotaPorPerfil[perfil.id];
      if (destino) {
        navigate(destino);
        return;
      }
      // Fallback defensivo: mantém o comportamento anterior.
      navigate(`/cadastro?perfil_v2=${encodeURIComponent(perfil.id)}&origem=v2`);
    },
    [navigate, persistir],
  );

  const handleSelecionarCurso = useCallback(
    (slug: string) => {
      persistir({ perfil: "curso_tiro_transversal", tipo: "curso", curso_slug: slug, origem: "v2_cursos" });
      navigate(`/cadastro?servico=${encodeURIComponent(slug)}&origem=v2_cursos`);
    },
    [navigate, persistir],
  );

  const handleAtalhoCursos = useCallback(() => {
    // Sub-tela dedicada substitui o estado local de cursos (mantém retrocompat por fallback abaixo).
    navigate("/cadastro-v2/cursos");
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <QALogo />
          {subTela === "cursos" && (
            <button
              type="button"
              onClick={() => setSubTela("perfis")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
              aria-label="Voltar para a pergunta principal"
            >
              <ArrowLeft className="h-4 w-4" />
              VOLTAR
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {subTela === "perfis" ? (
          <PerfisView
            onSelect={handleSelecionarPerfil}
            onAtalhoCursos={handleAtalhoCursos}
            selecionado={selecionado}
          />
        ) : (
          <CursosView onSelect={handleSelecionarCurso} />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-tela: 5 perfis                                                 */
/* ------------------------------------------------------------------ */

function PerfisView({
  onSelect,
  onAtalhoCursos,
  selecionado,
}: {
  onSelect: (perfil: QAV2Perfil) => void;
  onAtalhoCursos: () => void;
  selecionado: QAV2PerfilId | null;
}) {
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight uppercase">
          PARA QUE VOCÊ PRECISA DA ARMA DE FOGO?
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground">
          Escolha o que mais se aproxima do seu caso
        </p>
      </div>

      <button
        type="button"
        onClick={onAtalhoCursos}
        className="w-full mb-6 flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold uppercase">QUERO FAZER UM CURSO DE TIRO</span>
          <span className="block text-xs text-muted-foreground">
            Disponível para qualquer perfil — atalho transversal
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      <ul className="grid gap-3 sm:gap-4" role="list">
        {QA_V2_PERFIS.map((perfil) => (
          <li key={perfil.id}>
            <PerfilCard
              perfil={perfil}
              selecionado={selecionado === perfil.id}
              onSelect={() => onSelect(perfil)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function PerfilCard({
  perfil,
  selecionado,
  onSelect,
}: {
  perfil: QAV2Perfil;
  selecionado: boolean;
  onSelect: () => void;
}) {
  const Icon = PERFIL_ICON[perfil.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={perfil.titulo}
      aria-pressed={selecionado}
      className={`group w-full text-left rounded-xl border bg-card p-4 sm:p-5 flex items-start gap-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-primary hover:shadow-md ${
        selecionado ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-base sm:text-lg font-semibold uppercase">
          {perfil.titulo}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {perfil.descricao}
        </span>
      </span>
      <span className="shrink-0 self-center">
        {selecionado ? (
          <Check className="h-5 w-5 text-primary" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-tela: cursos transversais                                      */
/* ------------------------------------------------------------------ */

function CursosView({ onSelect }: { onSelect: (slug: string) => void }) {
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight uppercase">
          ESCOLHA SEU CURSO DE TIRO
        </h1>
        <p className="mt-3 text-base sm:text-lg text-muted-foreground">
          Cursos disponíveis para qualquer perfil de cliente
        </p>
      </div>

      <ul className="grid gap-3 sm:gap-4" role="list">
        {QA_V2_CURSOS.map((curso) => (
          <li key={curso.slug}>
            <button
              type="button"
              onClick={() => onSelect(curso.slug)}
              aria-label={curso.titulo}
              className="group w-full text-left rounded-xl border border-border bg-card p-4 sm:p-5 flex items-start gap-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-primary hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-6 w-6" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-base sm:text-lg font-semibold uppercase">
                  {curso.titulo}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {curso.descricao}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground self-center group-hover:text-primary transition-colors" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}