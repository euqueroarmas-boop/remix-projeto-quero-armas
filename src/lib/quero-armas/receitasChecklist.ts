import { supabase } from "@/integrations/supabase/client";

/**
 * RECEITAS DE CHECKLIST — blocos prontos.
 *
 * Uma receita é um conjunto de linhas de `qa_servicos_documentos` (perguntas +
 * documentos, com as condições já amarradas) que o admin aplica no serviço com
 * um clique. Para criar novos blocos no futuro basta acrescentar um item em
 * `RECEITAS` — nada de SQL manual.
 */

export interface LinhaReceita {
  tipo_documento: string;
  nome_documento: string;
  etapa?: string;
  obrigatorio?: boolean;
  condicao_profissional?: string | null;
  /** deslocamento de ordem dentro do bloco (0, 1, 2…) */
  passo: number;
  regra_validacao: Record<string, any>;
}

export interface ReceitaChecklist {
  id: string;
  nome: string;
  descricao: string;
  /** grupo temático em que o bloco inteiro é gravado */
  grupo: string;
  ordemGrupo: number;
  linhas: LinhaReceita[];
}

const AJUDA_PORTARIA =
  "Portaria Conjunta COLOG/C EX e DPA/PF nº 1, de 29/11/2024, art. 3º, II: integrantes das " +
  "forças de segurança podem comprovar aptidão psicológica e capacidade técnica por atestado " +
  "da própria instituição.";

export const RECEITAS: ReceitaChecklist[] = [
  {
    id: "exames_instituicao_x_credenciados",
    nome: "EXAMES — INSTITUIÇÃO × CREDENCIADOS (SEGURANÇA PÚBLICA)",
    descricao:
      "Cria a pergunta pivô e as 4 entregas: atestado psicológico e atestado de tiro da " +
      "instituição (só para segurança pública que responder SIM) e laudo psicológico + laudo " +
      "de capacidade técnica com credenciados da PF (dispensados quando usar os da instituição).",
    grupo: "saude",
    ordemGrupo: 60,
    linhas: [
      {
        tipo_documento: "exames_instituicao_definir",
        nome_documento: "Você vai usar os exames psicológico e de tiro da sua instituição?",
        etapa: "tecnico",
        condicao_profissional: "seguranca_publica",
        passo: 0,
        regra_validacao: {
          tipo: "pergunta",
          chave: "exames_instituicao",
          ajuda: AJUDA_PORTARIA,
          opcoes: [
            { label: "SIM — VOU USAR OS EXAMES DA MINHA INSTITUIÇÃO", valor: "sim" },
            { label: "NÃO — QUERO FAZER COM CREDENCIADOS DA PF (MOSTRAMOS OS MAIS PRÓXIMOS DE VOCÊ)", valor: "nao" },
          ],
        },
      },
      {
        tipo_documento: "atestado_aptidao_psicologica_instituicao",
        nome_documento: "Atestado de Aptidão Psicológica da Instituição",
        etapa: "tecnico",
        condicao_profissional: "seguranca_publica",
        passo: 1,
        regra_validacao: { exige_quando: { exames_instituicao: "sim" } },
      },
      {
        tipo_documento: "atestado_capacidade_tecnica_instituicao",
        nome_documento: "Atestado de Capacidade Técnica e Tiro da Instituição",
        etapa: "tecnico",
        condicao_profissional: "seguranca_publica",
        passo: 2,
        regra_validacao: { exige_quando: { exames_instituicao: "sim" } },
      },
      {
        tipo_documento: "laudo_psicologico",
        nome_documento: "Laudo Psicológico (psicólogo credenciado pela PF)",
        etapa: "tecnico",
        passo: 3,
        regra_validacao: { dispensa_quando: { exames_instituicao: "sim" } },
      },
      {
        tipo_documento: "laudo_capacidade_tecnica",
        nome_documento: "Laudo de Capacidade Técnica para Manuseio de Arma de Fogo (instrutor credenciado)",
        etapa: "tecnico",
        passo: 4,
        regra_validacao: { dispensa_quando: { exames_instituicao: "sim" } },
      },
    ],
  },
];

export interface ResultadoAplicacao { criadas: number; atualizadas: number }

/**
 * Aplica a receita no serviço: cria o que falta, corrige (grupo, ordem, regra e
 * condição) o que já existe e reativa linhas desativadas. Idempotente.
 */
export async function aplicarReceita(
  receita: ReceitaChecklist,
  servicoId: number,
): Promise<ResultadoAplicacao> {
  const { data } = await supabase
    .from("qa_servicos_documentos" as any)
    .select("id, tipo_documento, ordem, regra_validacao")
    .eq("servico_id", servicoId);

  const existentes = ((data as any[]) ?? []) as {
    id: string; tipo_documento: string; ordem: number | null; regra_validacao: any;
  }[];

  // Base de ordem: fim do grupo, ou fim da lista se o grupo ainda não existe.
  const doGrupo = existentes.filter(
    (l) => String(l.regra_validacao?.grupo_checklist ?? "") === receita.grupo,
  );
  const base = doGrupo.length
    ? Math.max(...doGrupo.map((l) => l.ordem ?? 0)) + 10
    : Math.max(0, ...existentes.map((l) => l.ordem ?? 0)) + 10;

  let criadas = 0;
  let atualizadas = 0;

  for (const linha of receita.linhas) {
    const atual = existentes.find((l) => l.tipo_documento === linha.tipo_documento);
    const regra = {
      ...(atual?.regra_validacao ?? {}),
      ...linha.regra_validacao,
      grupo_checklist: receita.grupo,
      ordem_grupo_checklist: receita.ordemGrupo,
    };
    const ordem = base + linha.passo;

    if (atual) {
      const { error } = await supabase
        .from("qa_servicos_documentos" as any)
        .update({
          ativo: true,
          etapa: linha.etapa ?? "tecnico",
          obrigatorio: linha.obrigatorio ?? true,
          condicao_profissional: linha.condicao_profissional ?? null,
          regra_validacao: regra,
          ordem,
        })
        .eq("id", atual.id);
      if (error) throw error;
      atualizadas += 1;
    } else {
      const { error } = await supabase.from("qa_servicos_documentos" as any).insert({
        servico_id: servicoId,
        tipo_documento: linha.tipo_documento,
        nome_documento: linha.nome_documento,
        etapa: linha.etapa ?? "tecnico",
        obrigatorio: linha.obrigatorio ?? true,
        condicao_profissional: linha.condicao_profissional ?? null,
        regra_validacao: regra,
        ordem,
        ativo: true,
      });
      if (error) throw error;
      criadas += 1;
    }
  }

  return { criadas, atualizadas };
}
