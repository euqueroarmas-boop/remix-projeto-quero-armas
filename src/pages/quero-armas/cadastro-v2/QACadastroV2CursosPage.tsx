import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, GraduationCap } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";
import { QA_V2_CURSOS, QA_V2_PATH_SESSION_KEY } from "../qaCadastroV2Catalog";
import { supabase } from "@/integrations/supabase/client";

/** Atalho transversal /cadastro-v2/cursos. Puxa preço do qa_servicos_catalogo. */
export default function QACadastroV2CursosPage() {
  const navigate = useNavigate();
  const [precos, setPrecos] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const slugs = QA_V2_CURSOS.map((c) => c.slug);
      const { data, error } = await supabase
        .from("qa_servicos_catalogo")
        .select("slug, preco")
        .in("slug", slugs);
      if (cancelado || error || !data) return;
      const mapa: Record<string, number | null> = {};
      for (const row of data as Array<{ slug: string; preco: number | null }>) {
        mapa[row.slug] = row.preco;
      }
      setPrecos(mapa);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const handleSelecionar = useCallback(
    (slug: string) => {
      try {
        sessionStorage.setItem(
          QA_V2_PATH_SESSION_KEY,
          JSON.stringify({
            perfil: "curso_tiro_transversal",
            tipo: "curso",
            curso_slug: slug,
            origem: "v2_cursos",
            ts: new Date().toISOString(),
          }),
        );
      } catch {
        /* ignora */
      }
      navigate(`/cadastro?servico=${encodeURIComponent(slug)}&origem=v2_cursos`);
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <QALogo />
          <button
            type="button"
            onClick={() => navigate("/cadastro-v2")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
            aria-label="Voltar para a etapa anterior"
          >
            <ArrowLeft className="h-4 w-4" />
            VOLTAR
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <nav aria-label="Trilha do cadastro" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <li>
              <button
                type="button"
                onClick={() => navigate("/cadastro-v2")}
                className="hover:text-foreground transition-colors uppercase px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Cadastro
              </button>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <span className="uppercase px-1 text-foreground font-semibold" aria-current="page">
                Cursos
              </span>
            </li>
          </ol>
        </nav>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">
            ESCOLHA SEU CURSO
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Capacitação técnica reconhecida para PF, SIGMA e profissionais
          </p>
        </div>

        <ul className="grid gap-3 sm:gap-4" role="list">
          {QA_V2_CURSOS.map((curso) => {
            const preco = precos[curso.slug];
            return (
              <li key={curso.slug}>
                <button
                  type="button"
                  onClick={() => handleSelecionar(curso.slug)}
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
                    {typeof preco === "number" && (
                      <span className="mt-2 block text-sm font-semibold text-primary">
                        {preco.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground self-center shrink-0 group-hover:text-primary transition-colors" />
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}