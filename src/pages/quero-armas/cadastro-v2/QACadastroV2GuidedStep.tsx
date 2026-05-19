import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";
import {
  QA_V2_PATH_SESSION_KEY,
  type QAV2PathDefinition,
  type QAV2Node,
  type QAV2NodeOption,
} from "../qaCadastroV2Catalog";

/**
 * Componente compartilhado das sub-rotas /cadastro-v2/<caminho>.
 * Renderiza um nó (pergunta + cards) e gerencia sub-steps via stack interna,
 * com breadcrumb e botão Voltar acessível por teclado.
 * Aditivo, isolado — não toca em /cadastro nem em QACadastroPublicoPage.
 */
export default function QACadastroV2GuidedStep({
  definition,
}: {
  definition: QAV2PathDefinition;
}) {
  const navigate = useNavigate();
  const [stack, setStack] = useState<string[]>([]); // chaves dos sub-steps abertos

  const noAtual: QAV2Node = useMemo(() => {
    if (stack.length === 0) return definition.raiz;
    const ultimo = stack[stack.length - 1];
    return definition.steps[ultimo] ?? definition.raiz;
  }, [definition, stack]);

  const breadcrumbItens = useMemo(() => {
    const itens: { label: string; onClick?: () => void }[] = [
      { label: "Cadastro", onClick: () => navigate("/cadastro-v2") },
      {
        label: definition.tituloBreadcrumb,
        onClick: stack.length === 0 ? undefined : () => setStack([]),
      },
    ];
    stack.forEach((key, idx) => {
      const node = definition.steps[key];
      const opcaoPai =
        idx === 0
          ? definition.raiz.opcoes.find((o) => o.kind === "step" && o.key === key)
          : definition.steps[stack[idx - 1]]?.opcoes.find(
              (o) => o.kind === "step" && o.key === key,
            );
      const label = opcaoPai && "titulo" in opcaoPai ? opcaoPai.titulo : node?.pergunta ?? key;
      const isUltimo = idx === stack.length - 1;
      itens.push({
        label,
        onClick: isUltimo ? undefined : () => setStack(stack.slice(0, idx + 1)),
      });
    });
    return itens;
  }, [definition, stack, navigate]);

  const handleVoltar = useCallback(() => {
    if (stack.length > 0) {
      setStack(stack.slice(0, -1));
    } else {
      navigate("/cadastro-v2");
    }
  }, [navigate, stack]);

  const persistirCaminho = useCallback(
    (extra: Record<string, unknown>) => {
      try {
        sessionStorage.setItem(
          QA_V2_PATH_SESSION_KEY,
          JSON.stringify({
            perfil: definition.perfil,
            stack,
            ...extra,
            ts: new Date().toISOString(),
          }),
        );
      } catch {
        /* ignora */
      }
    },
    [definition.perfil, stack],
  );

  const handleSelecionar = useCallback(
    (opcao: QAV2NodeOption) => {
      if (opcao.kind === "step") {
        persistirCaminho({ acao: "abrir_step", step: opcao.key });
        setStack((s) => [...s, opcao.key]);
        return;
      }
      const slugParam =
        opcao.kind === "bundle"
          ? opcao.servicoSlugs.join(",")
          : opcao.servicoSlug;
      const params = new URLSearchParams({
        servico: slugParam,
        perfil_v2: definition.perfil,
        subperfil_v2: opcao.subperfilV2,
        origem: "v2",
      });
      persistirCaminho({
        acao: "redirecionar_servico",
        servico: slugParam,
        subperfil: opcao.subperfilV2,
      });
      navigate(`/cadastro?${params.toString()}`);
    },
    [definition.perfil, navigate, persistirCaminho],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <QALogo />
          <button
            type="button"
            onClick={handleVoltar}
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
            {breadcrumbItens.map((item, idx) => {
              const last = idx === breadcrumbItens.length - 1;
              return (
                <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
                  {item.onClick ? (
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 uppercase"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span
                      className={`uppercase px-1 ${last ? "text-foreground font-semibold" : ""}`}
                      aria-current={last ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                  {!last && <span aria-hidden="true">›</span>}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">
            {noAtual.pergunta}
          </h1>
          {noAtual.subtitulo && (
            <p className="mt-3 text-base text-muted-foreground">{noAtual.subtitulo}</p>
          )}
        </div>

        <ul className="grid gap-3 sm:gap-4" role="list">
          {noAtual.opcoes.map((opcao, idx) => (
            <li key={`${opcao.kind}-${idx}-${opcao.titulo}`}>
              <OpcaoCard opcao={opcao} onSelect={() => handleSelecionar(opcao)} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function OpcaoCard({
  opcao,
  onSelect,
}: {
  opcao: QAV2NodeOption;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={opcao.titulo}
      className="group w-full text-left rounded-xl border border-border bg-card p-4 sm:p-5 flex items-start gap-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-primary hover:shadow-md"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base sm:text-lg font-semibold uppercase">
          {opcao.titulo}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {opcao.descricao}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground self-center shrink-0 group-hover:text-primary transition-colors" />
    </button>
  );
}