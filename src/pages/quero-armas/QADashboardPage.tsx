import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import { PenTool, ListChecks } from "lucide-react";

import { LoadingState } from "@/components/quero-armas/LoadStates";
import { useCadastroPendenciasCriticas } from "@/components/quero-armas/clientes/useCadastroPendenciasCriticas";

const PendenciasEssenciaisModal = lazyRetry(() => import("@/components/quero-armas/PendenciasEssenciaisModal"), "PendenciasEssenciaisModal");

/**
 * Dashboard Principal — enxuta.
 * Foco: KPIs essenciais, alertas, prazos críticos, monitor operacional.
 * Gráficos analíticos e listas longas vivem em /operacao/monitoramento.
 */

const DashboardPrazosRecursais  = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardPrazosRecursais"), "DashboardPrazosRecursais");
const DashboardProntoProtocolar = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardProntoProtocolar"), "DashboardProntoProtocolar");
const DashboardClientesOnline   = lazyRetry(() => import("@/components/quero-armas/dashboard/DashboardClientesOnline"), "DashboardClientesOnline");

interface Stats {
  documentos: number;
  pecas: number;
  pendentes: number;
  erros: number;
  consultas: number;
  aprovadas: number;
  rascunhos: number;
  novosCadastros: number;
}

function Spinner() {
  return (
    <div className="qa-card p-6 flex justify-center">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-[#7A1F2B] rounded-full animate-spin" />
    </div>
  );
}

export default function QADashboardPage() {
  const [stats, setStats] = useState<Stats>({
    documentos: 0, pecas: 0, pendentes: 0, erros: 0,
    consultas: 0, aprovadas: 0, rascunhos: 0, novosCadastros: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mountHeavy, setMountHeavy] = useState(false);
  const [pendenciasOpen, setPendenciasOpen] = useState(false);
  // Força re-montagem (= re-fetch) do modal a cada clique manual.
  const [pendenciasRunKey, setPendenciasRunKey] = useState(0);
  const { reload: reloadPendencias, pendencias: pendenciasAtuais } = useCadastroPendenciasCriticas();

  const handleBuscarPendencias = async () => {
    // Força nova consulta (não cache antigo) e abre o painel.
    await reloadPendencias();
    if (import.meta.env.DEV) {
      const total_pendencias = pendenciasAtuais.length;
      const cadastros_sem_cliente = pendenciasAtuais.filter(p => p.pendencias.includes("sem_cliente_vinculado")).length;
      const clientes_sem_servico  = pendenciasAtuais.filter(p => p.pendencias.includes("servico_solicitado_nao_gerado")).length;
      const servicos_sem_classificacao = pendenciasAtuais.filter(p => p.pendencias.includes("servico_pendente_classificacao")).length;
      // eslint-disable-next-line no-console
      console.log("[BuscarPendenciasDashboard]", {
        total_pendencias,
        cadastros_sem_cliente,
        clientes_sem_servico,
        servicos_sem_classificacao,
      });
    }
    setPendenciasRunKey(k => k + 1);
    setPendenciasOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);

    const loadCritical = async () => {
      const results = await Promise.allSettled([
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }),
        supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }).neq("status", "recusado").or("arquivado.is.null,arquivado.eq.false"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "aprovado"),
        supabase.from("qa_geracoes_pecas" as any).select("id", { count: "exact", head: true }).eq("status_revisao", "rascunho"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).eq("status_validacao", "nao_validado").eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_documentos_conhecimento" as any).select("id", { count: "exact", head: true }).in("status_processamento", ["erro", "texto_invalido"]).eq("ativo", true).eq("papel_documento", "aprendizado"),
        supabase.from("qa_consultas_ia" as any).select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const pick = (i: number): any => results[i].status === "fulfilled" ? (results[i] as any).value : null;
      setStats({
        documentos: pick(0)?.count ?? 0,
        pecas: pick(1)?.count ?? 0,
        novosCadastros: pick(2)?.count ?? 0,
        aprovadas: pick(3)?.count ?? 0,
        rascunhos: pick(4)?.count ?? 0,
        pendentes: pick(5)?.count ?? 0,
        erros: pick(6)?.count ?? 0,
        consultas: pick(7)?.count ?? 0,
      });
      clearTimeout(safety);
      setLoading(false);
    };

    loadCritical().catch(() => {
      if (!cancelled) { clearTimeout(safety); setLoading(false); }
    });

    return () => { cancelled = true; clearTimeout(safety); };
  }, []);

  useEffect(() => {
    if (loading || mountHeavy) return;
    const t = setTimeout(() => setMountHeavy(true), 120);
    return () => clearTimeout(t);
  }, [loading, mountHeavy]);

  if (loading) return <LoadingState label="Carregando dashboard…" />;

  return (
    <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "hsl(220 20% 18%)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            Visão geral do sistema jurídico
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBuscarPendencias}
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md transition-all hover:opacity-90 shadow-sm border"
            style={{ background: "hsl(38 92% 96%)", color: "hsl(35 80% 30%)", borderColor: "hsl(38 92% 80%)" }}
            title="Executa a mesma varredura do login e lista cadastros que precisam de correção"
          >
            <ListChecks className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Buscar pendências</span>
          </button>
          <Link to="/gerar-peca"
            className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-semibold rounded-md transition-all hover:opacity-90 shadow-sm no-glow"
            style={{ background: "hsl(352 60% 30%)", color: "#ffffff" }}>
            <PenTool className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nova Peça</span>
          </Link>
        </div>
      </div>

      {/* Prazos processuais 10 dias — SEMPRE primeiro card, nada sobrepõe.
          Renderiza fora do gate `mountHeavy` para garantir prioridade absoluta. */}
      <Suspense fallback={<Spinner />}>
        <DashboardPrazosRecursais />
      </Suspense>

      {/* Processos prontos para protocolar — alerta operacional para a equipe */}
      <Suspense fallback={<Spinner />}>
        <DashboardProntoProtocolar />
      </Suspense>

      {/* Clientes logados agora na área do cliente */}
      <Suspense fallback={<Spinner />}>
        <DashboardClientesOnline />
      </Suspense>

      <p className="text-[11px] text-center" style={{ color: "hsl(220 10% 62%)" }}>
        Os demais motores foram movidos para{" "}
        <Link to="/configuracoes" className="font-semibold hover:underline" style={{ color: "hsl(352 60% 30%)" }}>
          Configurações → Apagar
        </Link>
      </p>

      {/* Painel manual de pendências — mesma fonte do alerta automático.
          A `key` força nova consulta a cada clique, garantindo dados atuais. */}
      {pendenciasOpen && (
        <Suspense fallback={null}>
          <PendenciasEssenciaisModal
            key={pendenciasRunKey}
            open={pendenciasOpen}
            onOpenChange={setPendenciasOpen}
            triggeredManually
          />
        </Suspense>
      )}
    </div>
  );
}
