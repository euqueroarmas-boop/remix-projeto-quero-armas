import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveServicoFromInteresse } from "@/lib/quero-armas/servicoSlugMap";

/** 11 tipos de pendência cobertos pela varredura de integridade. */
export type PendenciaTipo =
  | "sem_cliente_vinculado"
  | "cpf_divergente"
  | "dados_formulario_nao_aplicados"
  | "servico_solicitado_nao_gerado"
  | "servico_sem_slug"
  | "servico_pendente_classificacao"
  | "servico_sem_status"
  | "servico_sem_status_financeiro"
  | "servico_sem_status_processo"
  | "documentos_orfaos"
  | "cliente_sem_cadastro_publico_id"
  | "conferido_com_pendencias";

export type PendenciaItem = {
  cadastro_publico_id: string;
  cliente_id_vinculado: number | null;
  nome: string;
  cpf: string | null;
  servico_interesse: string | null;
  servico_slug: string;
  servico_nome: string;
  pendencias: PendenciaTipo[];
  status_formulario: string | null;
  created_at: string;
};

const FECHADAS_KEY = "qa_pendencias_fechadas_v1";
const SESSION_DISMISS_KEY = "qa_pendencias_dismissed_session";

function readFechadas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FECHADAS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeFechadas(set: Set<string>) {
  try {
    localStorage.setItem(FECHADAS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

/**
 * Fonte central de pendências críticas relacionadas a cadastros públicos
 * que precisam de ação operacional antes de seguir o fluxo.
 * Usa apenas leitura (RLS-safe). Não altera dados.
 */
export function useCadastroPendenciasCriticas() {
  const [pendencias, setPendencias] = useState<PendenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvidasLocal, setResolvidasLocal] = useState<Set<string>>(readFechadas());

  const recompute = useCallback(async () => {
    setLoading(true);
    try {
      const norm = (v?: string | null) => (v || "").replace(/\D/g, "");
      const isFilled = (v: any) => v != null && String(v).trim() !== "";

      // 1) Todos os cadastros públicos
      const { data: cads } = await supabase
        .from("qa_cadastro_publico" as any)
        .select(
          "id, nome_completo, cpf, email, telefone_principal, end1_cep, end1_logradouro, end1_cidade, end1_estado, servico_interesse, cliente_id_vinculado, status, created_at",
        )
        .order("created_at", { ascending: false });

      const rows = (cads as any[]) ?? [];
      if (rows.length === 0) {
        setPendencias([]);
        return;
      }

      // 2) Clientes vinculados (cpf, email, end, cadastro_publico_id)
      const clienteIds = Array.from(
        new Set(rows.map((r) => r.cliente_id_vinculado).filter((n) => Number.isFinite(n))),
      ) as number[];

      const clientesById = new Map<number, any>();
      if (clienteIds.length > 0) {
        const { data: clis } = await supabase
          .from("qa_clientes" as any)
          .select(
            "id, cpf, email, celular, cep, endereco, cidade, estado, origem, cadastro_publico_id",
          )
          .in("id", clienteIds);
        ((clis as any[]) ?? []).forEach((c) => clientesById.set(c.id, c));
      }

      // 3) Solicitações canônicas
      const { data: sols } = await supabase
        .from("qa_solicitacoes_servico" as any)
        .select(
          "cliente_id, cadastro_publico_id, service_slug, status_servico, status_financeiro, status_processo, pendente_classificacao",
        )
        .in("cliente_id", clienteIds.length ? clienteIds : [-1]);
      const solsArr = (sols as any[]) ?? [];
      const solByKey = new Map<string, any>();
      solsArr.forEach((s) => {
        if (s.cadastro_publico_id) solByKey.set(`${s.cliente_id}::${s.cadastro_publico_id}`, s);
      });

      // 4) Documentos vindos do formulário (órfãos = cadastro_publico_id NULL e origem=form)
      const { data: docsOrfaosRows } = await supabase
        .from("qa_documentos_cliente" as any)
        .select("id, cliente_id, cadastro_publico_id, origem")
        .eq("origem", "formulario_publico")
        .is("cadastro_publico_id", null);
      const clientesComDocOrfao = new Set(
        ((docsOrfaosRows as any[]) ?? []).map((d) => d.cliente_id).filter(Boolean),
      );

      const list: PendenciaItem[] = [];
      for (const r of rows) {
        const tipos: PendenciaTipo[] = [];
        const servico = resolveServicoFromInteresse(r.servico_interesse);

        // (1) Sem cliente vinculado
        if (!r.cliente_id_vinculado) {
          tipos.push("sem_cliente_vinculado");
        } else {
          const cli = clientesById.get(r.cliente_id_vinculado);

          // (2) CPF divergente
          if (cli && norm(cli.cpf) && norm(r.cpf) && norm(cli.cpf) !== norm(r.cpf)) {
            tipos.push("cpf_divergente");
          }

          // (3) Dados do formulário não aplicados (campos vazios no cliente
          //     que existem no formulário público)
          if (cli) {
            const camposFaltando =
              (isFilled(r.email) && !isFilled(cli.email)) ||
              (isFilled(r.telefone_principal) && !isFilled(cli.celular)) ||
              (isFilled(r.end1_cep) && !isFilled(cli.cep)) ||
              (isFilled(r.end1_logradouro) && !isFilled(cli.endereco)) ||
              (isFilled(r.end1_cidade) && !isFilled(cli.cidade));
            if (camposFaltando) tipos.push("dados_formulario_nao_aplicados");
          }

          // (10) Cliente vinculado ao formulário mas sem cadastro_publico_id no perfil
          if (cli && !cli.cadastro_publico_id) {
            tipos.push("cliente_sem_cadastro_publico_id");
          }

          // (11) Documentos órfãos do formulário
          if (clientesComDocOrfao.has(r.cliente_id_vinculado)) {
            tipos.push("documentos_orfaos");
          }

          if (isFilled(r.servico_interesse)) {
            const sol = solByKey.get(`${r.cliente_id_vinculado}::${r.id}`);

            // (4) Serviço informado mas não gerado em qa_solicitacoes_servico
            if (!sol) {
              tipos.push("servico_solicitado_nao_gerado");
            } else {
              // (5) sem slug ou (6) pendente de classificação
              if (!sol.service_slug || sol.service_slug === "servico_pendente_classificacao") {
                if (sol.pendente_classificacao) tipos.push("servico_pendente_classificacao");
                else tipos.push("servico_sem_slug");
              }
              // (7) sem status_servico
              if (!isFilled(sol.status_servico)) tipos.push("servico_sem_status");
              // (8) sem status_financeiro
              if (!isFilled(sol.status_financeiro)) tipos.push("servico_sem_status_financeiro");
              // (9) sem status_processo
              if (!isFilled(sol.status_processo)) tipos.push("servico_sem_status_processo");
            }
          }
        }

        // (12) Conferido com pendências (status formulário 'aprovado'/'conferido' mas resta algo)
        const conferido = ["aprovado", "conferido", "formulario_conferido"].includes(
          (r.status || "").toString().toLowerCase(),
        );
        if (conferido && tipos.length > 0) {
          tipos.push("conferido_com_pendencias");
        }

        if (tipos.length === 0) continue;
        if (resolvidasLocal.has(String(r.id))) continue;

        list.push({
          cadastro_publico_id: String(r.id),
          cliente_id_vinculado: r.cliente_id_vinculado ?? null,
          nome: r.nome_completo ?? "(Sem nome)",
          cpf: r.cpf ?? null,
          servico_interesse: r.servico_interesse ?? null,
          servico_slug: servico.slug,
          servico_nome: servico.nome,
          pendencias: Array.from(new Set(tipos)) as PendenciaTipo[],
          status_formulario: r.status ?? null,
          created_at: r.created_at,
        });
      }

      setPendencias(list);
    } finally {
      setLoading(false);
    }
  }, [resolvidasLocal]);

  useEffect(() => {
    void recompute();
  }, [recompute]);

  const marcarResolvida = useCallback((cadastroId: string) => {
    setResolvidasLocal((prev) => {
      const next = new Set(prev);
      next.add(cadastroId);
      writeFechadas(next);
      return next;
    });
  }, []);

  return { pendencias, loading, reload: recompute, marcarResolvida };
}

export function shouldShowPendenciasModalThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function dismissPendenciasModalForSession() {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* noop */
  }
}