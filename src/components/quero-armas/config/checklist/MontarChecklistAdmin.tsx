import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookMarked, Plus, Search, Loader2, ArrowRight, Trash2, ArrowUp, ArrowDown,
  Eye, RotateCcw, Sparkles, Home, BriefcaseBusiness, GitBranch, Landmark,
} from "lucide-react";
import PreviaClienteChecklistModal from "./PreviaClienteChecklistModal";
import RestoreSnapshotModal from "./RestoreSnapshotModal";
import { MODELOS_PRONTOS, getModeloBySlug } from "@/lib/quero-armas/modelosProntos";

type BibliotecaItem = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  descricao_o_que_e: string | null;
  descricao_como_enviar: string | null;
  observacao_cliente: string | null;
  validade_dias: number | null;
  formato_aceito: string[];
  link_emissao: string | null;
  base_legal: string | null;
  ativo: boolean;
};

type ChecklistItem = {
  id: string;
  servico_id: number;
  biblioteca_id: string | null;
  tipo_documento: string;
  nome_documento: string;
  etapa: string;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  regra_validacao: any | null;
  instrucoes: string | null;
  observacoes_cliente: string | null;
};

type Servico = { id: number; nome_servico: string; valor_servico: number };

const CATEGORIAS: Array<{ valor: string; label: string }> = [
  { valor: "identificacao",    label: "Identificação" },
  { valor: "residencia",       label: "Residência" },
  { valor: "ocupacao_licita",  label: "Ocupação Lícita" },
  { valor: "certidoes",        label: "Certidões" },
  { valor: "laudos",           label: "Laudos" },
  { valor: "arma_acervo",      label: "Arma / Acervo" },
  { valor: "declaracoes",      label: "Declarações" },
  { valor: "outros",           label: "Outros" },
];

function labelCategoria(v: string): string {
  return CATEGORIAS.find((c) => c.valor === v)?.label ?? v;
}

const FLUXO_RESIDENCIA_TERCEIRO_TIPOS = [
  "comprovante_residencia",
  "pergunta_comprovante_em_nome",
  "pergunta_ainda_reside_imovel",
  "documento_identificacao_terceiro",
  "declaracao_responsavel_imovel",
];

const FLUXO_OCUPACAO_LICITA_TIPOS = ["renda_definir_condicao"];

const GRUPO_CERTIDOES_ESTADUAIS = [
  {
    codigo: "certidao_estadual_distribuicao_acoes_criminais",
    nome: "Certidão Estadual — Distribuição de Ações Criminais",
    descricao_o_que_e: "Certidão da Justiça Estadual que informa a existência ou inexistência de ações criminais distribuídas em nome do requerente.",
    descricao_como_enviar: "Emita no Tribunal de Justiça do seu estado e envie o PDF original. Em São Paulo, use a certidão de Distribuição de Ações Criminais.",
    observacao_cliente: "Uma das certidões estaduais obrigatórias. O nome deve bater com o documento de identificação.",
  },
  {
    codigo: "certidao_estadual_execucoes_criminais",
    nome: "Certidão Estadual — Execuções Criminais",
    descricao_o_que_e: "Certidão da Justiça Estadual que informa a existência ou inexistência de execuções criminais em nome do requerente.",
    descricao_como_enviar: "Emita no Tribunal de Justiça do seu estado e envie o PDF original. Em São Paulo, use a certidão de Execuções Criminais.",
    observacao_cliente: "Não substitui a certidão de distribuição; são conferências diferentes.",
  },
  {
    codigo: "certidao_estadual_policia_civil",
    legacyCodigos: ["certidao_estadual_segundo_grau_acoes_criminais"],
    nome: "Certidão Estadual — Polícia Civil",
    descricao_o_que_e: "Certidão estadual emitida pela Polícia Civil, quando disponível no estado do requerente.",
    descricao_como_enviar: "Emita a certidão estadual da Polícia Civil do seu estado e envie o PDF original.",
    observacao_cliente: "Pode variar conforme o estado. A equipe confere se o tribunal local oferece esta consulta.",
  },
  {
    codigo: "certidao_estadual_justica_militar",
    legacyCodigos: ["certidao_estadual_segundo_grau_execucoes_criminais"],
    nome: "Certidão Estadual — Tribunal de Justiça Militar",
    descricao_o_que_e: "Certidão estadual emitida pelo Tribunal de Justiça Militar, quando disponível no estado do requerente.",
    descricao_como_enviar: "Emita a certidão estadual do Tribunal de Justiça Militar do seu estado, quando disponível, e envie o PDF original.",
    observacao_cliente: "Pode variar conforme o estado. A equipe confere se o tribunal local oferece esta consulta.",
  },
] as const;

const GRUPO_CERTIDOES_ESTADUAIS_TIPOS = GRUPO_CERTIDOES_ESTADUAIS.flatMap((item) => [
  item.codigo,
  ...("legacyCodigos" in item ? item.legacyCodigos : []),
]);
const CERTIDOES_ESTADUAIS_CANONICAS = new Map(GRUPO_CERTIDOES_ESTADUAIS.map((item) => [item.codigo, item]));
const CERTIDOES_ESTADUAIS_LEGADAS = new Map(
  GRUPO_CERTIDOES_ESTADUAIS.flatMap((item) =>
    ("legacyCodigos" in item ? item.legacyCodigos : []).map((codigo) => [codigo, item] as const),
  ),
);

function itemCertidaoEstadualPresente(item: (typeof GRUPO_CERTIDOES_ESTADUAIS)[number], tipos: Set<string>) {
  return tipos.has(item.codigo) || ("legacyCodigos" in item && item.legacyCodigos.some((codigo) => tipos.has(codigo)));
}

function nomeDocumentoExibicao(item: { codigo?: string | null; tipo_documento?: string | null; nome: string } | ChecklistItem) {
  const codigo = "codigo" in item ? item.codigo : item.tipo_documento;
  const pacote = (codigo && (CERTIDOES_ESTADUAIS_CANONICAS.get(codigo) ?? CERTIDOES_ESTADUAIS_LEGADAS.get(codigo))) || null;
  return pacote?.nome ?? ("nome" in item ? item.nome : item.nome_documento);
}

const OCUPACAO_RAMOS: Array<{ titulo: string; itens: string[] }> = [
  {
    titulo: "EMPRESÁRIO / SÓCIO",
    itens: [
      "Cartão CNPJ emitido nos últimos 30 dias",
      "QSA emitido nos últimos 30 dias",
      "Nota fiscal emitida pela empresa para um cliente, em qualquer data",
      "Contrato Social, última alteração ou Requerimento de Empresário emitido pela Junta Comercial",
    ],
  },
  {
    titulo: "SERVIDOR PÚBLICO",
    itens: [
      "Carteira funcional ou documento funcional",
      "Holerite / contracheque recente emitido nos últimos 30 dias",
    ],
  },
  {
    titulo: "CLT",
    itens: [
      "Holerite mais recente",
      "Carteira de Trabalho Digital",
      "Extrato CNIS / INSS",
    ],
  },
  {
    titulo: "AUTÔNOMO / MEI",
    itens: [
      "Cartão CNPJ / MEI",
      "Nota fiscal recente ou documento substituto definido pela equipe",
    ],
  },
  {
    titulo: "APOSENTADO",
    itens: [
      "Comprovante de benefício",
      "Extrato CNIS / INSS, se aplicável",
    ],
  },
];

export default function MontarChecklistAdmin() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [biblioteca, setBiblioteca] = useState<BibliotecaItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  const [buscaBib, setBuscaBib] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [previaAberta, setPreviaAberta] = useState(false);
  const [restoreAberto, setRestoreAberto] = useState(false);
  const [modeloEscolhido, setModeloEscolhido] = useState<string>("");

  const servicoAtual = useMemo(() => servicos.find((s) => s.id === servicoId), [servicos, servicoId]);
  const tiposChecklist = useMemo(() => new Set(checklist.map((c) => c.tipo_documento)), [checklist]);
  const fluxoResidenciaAtivo = FLUXO_RESIDENCIA_TERCEIRO_TIPOS.every((t) => tiposChecklist.has(t));
  const fluxoOcupacaoAtivo = FLUXO_OCUPACAO_LICITA_TIPOS.every((t) => tiposChecklist.has(t));
  const certidoesEstaduaisAplicadas = GRUPO_CERTIDOES_ESTADUAIS.filter((item) => itemCertidaoEstadualPresente(item, tiposChecklist)).length;
  const grupoCertidoesEstaduaisAtivo = certidoesEstaduaisAplicadas === GRUPO_CERTIDOES_ESTADUAIS.length;

  async function carregarBiblioteca() {
    const { data } = await supabase
      .from("qa_documentos_biblioteca" as any)
      .select("*")
      .eq("ativo", true)
      .order("nome");
    setBiblioteca(((data as any[]) ?? []) as BibliotecaItem[]);
  }

  async function carregarServicos() {
    const { data } = await supabase.from("qa_servicos" as any).select("id, nome_servico, valor_servico").order("nome_servico");
    setServicos(((data as any[]) ?? []) as Servico[]);
  }

  async function carregarChecklist(id: number) {
    const { data } = await supabase
      .from("qa_servicos_documentos" as any)
      .select("id, servico_id, biblioteca_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, regra_validacao, instrucoes, observacoes_cliente")
      .eq("servico_id", id)
      .eq("ativo", true)
      .order("ordem");
    setChecklist(((data as any[]) ?? []) as ChecklistItem[]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([carregarBiblioteca(), carregarServicos()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (servicoId) carregarChecklist(servicoId);
    else setChecklist([]);
  }, [servicoId]);

  const bibliotecaFiltrada = useMemo(() => {
    const idsUsados = new Set(checklist.map((c) => c.biblioteca_id).filter(Boolean));
    const b = buscaBib.trim().toLowerCase();
    return biblioteca
      .filter((i) => (catFiltro ? i.categoria === catFiltro : true))
      .filter((i) => (b ? i.nome.toLowerCase().includes(b) || i.codigo.toLowerCase().includes(b) : true))
      .map((i) => ({ ...i, jaNoServico: idsUsados.has(i.id) }));
  }, [biblioteca, buscaBib, catFiltro, checklist]);

  const gruposBib = useMemo(() => {
    const m = new Map<string, typeof bibliotecaFiltrada>();
    for (const i of bibliotecaFiltrada) {
      if (!m.has(i.categoria)) m.set(i.categoria, []);
      m.get(i.categoria)!.push(i);
    }
    return Array.from(m.entries()).sort(([a], [b]) => labelCategoria(a).localeCompare(labelCategoria(b), "pt-BR"));
  }, [bibliotecaFiltrada]);

  async function snapshot(motivo: string) {
    if (!servicoId) return;
    const { data: linhas } = await supabase
      .from("qa_servicos_documentos" as any)
      .select("*")
      .eq("servico_id", servicoId);
    if (linhas && (linhas as any[]).length > 0) {
      await supabase.from("qa_servicos_documentos_snapshots" as any).insert({
        servico_id: servicoId, motivo, payload: linhas,
      });
    }
  }

  async function adicionarBiblioteca(item: BibliotecaItem) {
    if (!servicoId) { toast.error("Escolha um serviço primeiro"); return; }
    setCarregandoAcao(true);
    try {
      const proxOrdem = (checklist.reduce((max, c) => Math.max(max, c.ordem), 0) + 10) || 10;
      const { error } = await supabase.from("qa_servicos_documentos" as any).insert({
        servico_id: servicoId,
        biblioteca_id: item.id,
        tipo_documento: item.codigo,
        nome_documento: item.nome,
        etapa: "base",
        obrigatorio: true,
        validade_dias: item.validade_dias,
        formato_aceito: item.formato_aceito,
        link_emissao: item.link_emissao,
        instrucoes: item.descricao_como_enviar,
        observacoes_cliente: item.observacao_cliente,
        ordem: proxOrdem,
        ativo: true,
      });
      if (error) throw error;
      toast.success(`"${item.nome}" adicionado ao checklist`);
      await carregarChecklist(servicoId);
    } catch (e: any) {
      toast.error(e.message.includes("duplicate") ? "Este documento já está no checklist" : e.message);
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function removerChecklist(item: ChecklistItem) {
    if (!confirm(`Remover "${item.nome_documento}" do checklist deste serviço?`)) return;
    setCarregandoAcao(true);
    try {
      await snapshot(`remocao_manual:${item.nome_documento}`);
      const { error } = await supabase.from("qa_servicos_documentos" as any).delete().eq("id", item.id);
      if (error) throw error;
      toast.success("Removido");
      await carregarChecklist(servicoId!);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function moverOrdem(item: ChecklistItem, direcao: "cima" | "baixo") {
    const idx = checklist.findIndex((c) => c.id === item.id);
    const alvo = direcao === "cima" ? idx - 1 : idx + 1;
    if (alvo < 0 || alvo >= checklist.length) return;
    const outro = checklist[alvo];
    setCarregandoAcao(true);
    try {
      await supabase.from("qa_servicos_documentos" as any).update({ ordem: outro.ordem }).eq("id", item.id);
      await supabase.from("qa_servicos_documentos" as any).update({ ordem: item.ordem }).eq("id", outro.id);
      await carregarChecklist(servicoId!);
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function toggleObrigatorio(item: ChecklistItem) {
    await supabase
      .from("qa_servicos_documentos" as any)
      .update({ obrigatorio: !item.obrigatorio })
      .eq("id", item.id);
    await carregarChecklist(servicoId!);
  }

  async function salvarOuCriarDocumentoFluxo(
    tipoDocumento: string,
    payload: Record<string, any>,
  ) {
    if (!servicoId) return;
    const { data: existente, error: findError } = await supabase
      .from("qa_servicos_documentos" as any)
      .select("id")
      .eq("servico_id", servicoId)
      .eq("tipo_documento", tipoDocumento)
      .is("condicao_profissional", null)
      .maybeSingle();
    if (findError) throw findError;
    if ((existente as any)?.id) {
      const { error } = await supabase
        .from("qa_servicos_documentos" as any)
        .update(payload)
        .eq("id", (existente as any).id);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from("qa_servicos_documentos" as any)
      .insert({
        servico_id: servicoId,
        tipo_documento: tipoDocumento,
        ...payload,
      });
    if (error) throw error;
  }

  async function aplicarFluxoResidenciaTerceiro() {
    if (!servicoId) return;
    if (!confirm(
      `Aplicar o fluxo guiado de residência ao serviço "${servicoAtual?.nome_servico}"?\n\n` +
      "O cliente responderá se o comprovante está em nome dele. Se estiver em nome de terceiro, o sistema exigirá documento do terceiro e declaração do responsável pelo imóvel.",
    )) return;
    setCarregandoAcao(true);
    try {
      await snapshot("aplicar_fluxo:residencia_terceiro");
      const residenciaBib = biblioteca.find((b) => b.codigo === "comprovante_residencia");
      const declaracaoBib = biblioteca.find((b) => b.codigo === "declaracao_responsavel_imovel");

      await salvarOuCriarDocumentoFluxo("comprovante_residencia", {
        biblioteca_id: residenciaBib?.id ?? null,
        nome_documento: "Comprovante de residência",
        etapa: "endereco",
        obrigatorio: true,
        validade_dias: residenciaBib?.validade_dias ?? 30,
        formato_aceito: residenciaBib?.formato_aceito ?? ["pdf", "jpg", "jpeg", "png"],
        instrucoes:
          "Envie uma conta de água, energia, telefone, gás ou internet do imóvel. Se a conta estiver em nome de terceiro, responda as perguntas seguintes e envie também os documentos que o sistema solicitar.",
        observacoes_cliente: "O endereço precisa ser atual e será conferido pela IA com seu documento de identificação e com as declarações do processo.",
        regra_validacao: {
          exige: ["endereco"],
          cruzar_com: ["documento_identificacao_cliente"],
          objetivo_documental: "comprovar_residencia",
        },
        ordem: 30,
        ativo: true,
      });

      await salvarOuCriarDocumentoFluxo("pergunta_comprovante_em_nome", {
        nome_documento: "O comprovante de residência está em seu nome?",
        etapa: "endereco",
        obrigatorio: true,
        formato_aceito: [],
        instrucoes: "Responda para o sistema montar o caminho correto de entrega da residência.",
        regra_validacao: {
          tipo: "pergunta",
          chave: "comprovante_em_nome_titular",
          objetivo_documental: "comprovar_residencia",
          opcoes: [
            { valor: "sim", label: "SIM, ESTÁ NO MEU NOME" },
            { valor: "nao", label: "NÃO, ESTÁ NO NOME DE TERCEIRO" },
          ],
        },
        ordem: 31,
        ativo: true,
      });

      await salvarOuCriarDocumentoFluxo("pergunta_ainda_reside_imovel", {
        nome_documento: "Você ainda reside neste imóvel de terceiro?",
        etapa: "endereco",
        obrigatorio: true,
        formato_aceito: [],
        instrucoes: "Essa resposta define qual declaração do responsável pelo imóvel será liberada para assinatura.",
        regra_validacao: {
          tipo: "pergunta",
          chave: "ainda_reside_imovel",
          objetivo_documental: "comprovar_residencia",
          depende_de: { chave: "comprovante_em_nome_titular", valor: "nao" },
          opcoes: [
            { valor: "sim", label: "SIM, AINDA MORO LÁ" },
            { valor: "nao", label: "NÃO, JÁ MUDEI" },
          ],
        },
        ordem: 32,
        ativo: true,
      });

      await salvarOuCriarDocumentoFluxo("documento_identificacao_terceiro", {
        nome_documento: "Documento de identificação do titular do comprovante",
        etapa: "endereco",
        obrigatorio: true,
        validade_dias: null,
        formato_aceito: ["pdf", "jpg", "jpeg", "png"],
        instrucoes:
          "Envie RG, CIN ou CNH da pessoa que aparece como titular no comprovante de residência. A IA vai cruzar o nome do titular com a conta e com a declaração assinada.",
        observacoes_cliente: "Necessário somente quando o comprovante de residência não estiver em seu nome.",
        regra_validacao: {
          condicional: { depende_de: "comprovante_em_nome_titular", valor: "nao" },
          exige_quando: { comprovante_em_nome_titular: "nao" },
          exige: ["nome_titular"],
          cruzar_com: ["comprovante_residencia", "declaracao_responsavel_imovel"],
          objetivo_documental: "comprovar_residencia",
        },
        ordem: 33,
        ativo: true,
      });

      await salvarOuCriarDocumentoFluxo("declaracao_responsavel_imovel", {
        biblioteca_id: declaracaoBib?.id ?? null,
        nome_documento: "Declaração do responsável pelo imóvel",
        etapa: "endereco",
        obrigatorio: true,
        validade_dias: null,
        formato_aceito: ["application/pdf", "pdf"],
        instrucoes:
          "1) Responda as perguntas sobre o imóvel. 2) Baixe a declaração preenchida. 3) Peça ao responsável pelo imóvel para assinar. 4) Envie o PDF assinado aqui.",
        observacoes_cliente: "A declaração só aparece quando o comprovante está em nome de terceiro.",
        regra_validacao: {
          assinatura_requerida: "govbr",
          label_botao: "ENVIAR DECLARAÇÃO ASSINADA",
          template_condicional: true,
          condicional: { depende_de: "comprovante_em_nome_titular", valor: "nao" },
          exige_quando: { comprovante_em_nome_titular: "nao" },
          objetivo_documental: "comprovar_residencia",
          cruzar_com: ["comprovante_residencia", "documento_identificacao_terceiro", "documento_identificacao_cliente"],
          template_quando: [
            {
              se: { comprovante_em_nome_titular: "nao", ainda_reside_imovel: "sim" },
              template_key: "declaracao_responsavel_imovel_atual",
              label: "BAIXAR DECLARAÇÃO PARA ASSINAR",
            },
            {
              se: { comprovante_em_nome_titular: "nao", ainda_reside_imovel: "nao" },
              template_key: "declaracao_responsavel_imovel_passado",
              label: "BAIXAR DECLARAÇÃO PARA ASSINAR",
            },
          ],
        },
        ordem: 34,
        ativo: true,
      });

      toast.success("Fluxo de residência com terceiro aplicado ao checklist.");
      await carregarChecklist(servicoId);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aplicar fluxo de residência.");
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function aplicarFluxoOcupacaoLicita() {
    if (!servicoId) return;
    if (!confirm(
      `Aplicar o fluxo guiado de ocupação lícita ao serviço "${servicoAtual?.nome_servico}"?\n\n` +
      "O cliente escolherá a condição profissional e o sistema criará os documentos corretos no processo, como CLT, MEI, empresário, servidor público, autônomo ou aposentado.",
    )) return;
    setCarregandoAcao(true);
    try {
      await snapshot("aplicar_fluxo:ocupacao_licita");
      await salvarOuCriarDocumentoFluxo("renda_definir_condicao", {
        nome_documento: "Defina sua condição profissional",
        etapa: "condicao_profissional",
        obrigatorio: true,
        formato_aceito: [],
        instrucoes:
          "Responda qual é sua situação profissional. Depois disso, o sistema abre somente os documentos necessários para o seu caso.",
        observacoes_cliente:
          "Empresário e MEI exigem mais de um documento. O sistema vai separar cada item para a IA validar um por um.",
        regra_validacao: {
          objetivo_documental: "comprovar_ocupacao_licita",
          tipo: "seletor_condicao_profissional",
          cria_documentos_por_condicao: true,
          base_legal: ["Lei 10.826/2003", "Decreto 11.615/2023", "Decreto 12.345/2024", "IN DG/PF 201", "IN DG/PF 311"],
        },
        ordem: 40,
        ativo: true,
      });
      toast.success("Fluxo de ocupação lícita aplicado ao checklist.");
      await carregarChecklist(servicoId);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aplicar fluxo de ocupação lícita.");
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function aplicarGrupoCertidoesEstaduais() {
    if (!servicoId) return;
    if (!confirm(
      `Aplicar o grupo completo de certidões estaduais ao serviço "${servicoAtual?.nome_servico}"?\n\n` +
      "O cliente continuará entendendo que se trata da Justiça Estadual, mas o checklist passará a ter os 4 itens internos separados para a IA validar um por um.",
    )) return;
    setCarregandoAcao(true);
    try {
      await snapshot("aplicar_grupo:certidoes_estaduais");
      const { data: bibExistente, error: bibExistenteError } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .select("codigo")
        .in("codigo", GRUPO_CERTIDOES_ESTADUAIS_TIPOS);
      if (bibExistenteError) throw bibExistenteError;
      const codigosBibliotecaExistentes = new Set(((bibExistente as any[]) ?? []).map((item) => item.codigo));
      const seedsFaltantes = GRUPO_CERTIDOES_ESTADUAIS
        .filter((item) => !codigosBibliotecaExistentes.has(item.codigo))
        .map((item) => ({
          codigo: item.codigo,
          nome: item.nome,
          categoria: "certidoes",
          descricao_o_que_e: item.descricao_o_que_e,
          descricao_como_enviar: item.descricao_como_enviar,
          observacao_cliente: item.observacao_cliente,
          validade_dias: 60,
          formato_aceito: ["pdf"],
          link_emissao: null,
          base_legal: "IN DG/PF 201",
          ativo: true,
        }));
      if (seedsFaltantes.length > 0) {
        const { error: insertBibError } = await supabase
          .from("qa_documentos_biblioteca" as any)
          .insert(seedsFaltantes as any[]);
        if (insertBibError) throw insertBibError;
      }

      await carregarBiblioteca();
      const { data: bib, error: bibError } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .select("id, codigo, nome, validade_dias, formato_aceito, link_emissao, descricao_como_enviar, observacao_cliente")
        .in("codigo", GRUPO_CERTIDOES_ESTADUAIS_TIPOS);
      if (bibError) throw bibError;

      const bibMap = new Map<string, any>();
      for (const item of ((bib as any[]) ?? [])) bibMap.set(item.codigo, item);
      const ordemBase = Math.max(50, checklist.reduce((max, c) => Math.max(max, c.ordem), 0) + 10);
      const tiposExistentes = new Set(checklist.map((item) => item.tipo_documento));
      const payload = GRUPO_CERTIDOES_ESTADUAIS.filter((item) => !itemCertidaoEstadualPresente(item, tiposExistentes)).map((item, index) => {
        const b = bibMap.get(item.codigo);
        return {
          servico_id: servicoId,
          biblioteca_id: b?.id ?? null,
          tipo_documento: item.codigo,
          nome_documento: b?.nome ?? item.nome,
          etapa: "complementar",
          obrigatorio: true,
          validade_dias: b?.validade_dias ?? 60,
          formato_aceito: b?.formato_aceito ?? ["pdf"],
          link_emissao: b?.link_emissao ?? null,
          instrucoes: b?.descricao_como_enviar ?? item.descricao_como_enviar,
          observacoes_cliente: b?.observacao_cliente ?? item.observacao_cliente,
          ordem: ordemBase + index * 10,
          ativo: true,
          regra_validacao: {
            grupo_documental: "certidoes_estaduais",
            item_grupo: index + 1,
            total_itens_grupo: GRUPO_CERTIDOES_ESTADUAIS.length,
            cruzar_com: ["documento_identificacao_cliente"],
            base_legal: ["Lei 10.826/2003", "Decreto 11.615/2023", "Decreto 12.345/2024", "IN DG/PF 201", "IN DG/PF 311"],
          },
        };
      });
      if (payload.length > 0) {
        const { error } = await supabase
          .from("qa_servicos_documentos" as any)
          .insert(payload as any[]);
        if (error) throw error;
      }
      toast.success(payload.length > 0 ? "Grupo de certidões estaduais aplicado." : "Grupo de certidões estaduais já estava completo.");
      await carregarChecklist(servicoId);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aplicar grupo de certidões estaduais.");
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function aplicarModelo() {
    if (!servicoId) return;
    const modelo = getModeloBySlug(modeloEscolhido);
    if (!modelo) return;
    if (!confirm(
      `Aplicar modelo "${modelo.titulo}" (${modelo.exigencias.length} exigências) ao serviço "${servicoAtual?.nome_servico}"?\n\n${modelo.aviso_juridico}\n\nItens já existentes serão ignorados (não duplicam).`,
    )) return;
    setCarregandoAcao(true);
    try {
      await snapshot(`aplicar_modelo:${modelo.slug}`);
      const codigos = modelo.exigencias.map((e) => e.codigo_biblioteca);
      const { data: bib } = await supabase
        .from("qa_documentos_biblioteca" as any)
        .select("id, codigo, nome, validade_dias, formato_aceito, link_emissao, descricao_como_enviar, observacao_cliente")
        .in("codigo", codigos);
      const bibMap = new Map<string, any>();
      for (const b of ((bib as any[]) ?? [])) bibMap.set((b as any).codigo, b);
      const payload = modelo.exigencias
        .map((ex) => {
          const b = bibMap.get(ex.codigo_biblioteca);
          if (!b) return null;
          return {
            servico_id: servicoId,
            biblioteca_id: b.id,
            tipo_documento: b.codigo,
            nome_documento: b.nome,
            etapa: ex.etapa ?? "base",
            obrigatorio: ex.obrigatorio,
            validade_dias: b.validade_dias,
            formato_aceito: b.formato_aceito,
            link_emissao: b.link_emissao,
            instrucoes: b.descricao_como_enviar,
            observacoes_cliente: b.observacao_cliente,
            ordem: ex.ordem ?? 10,
            ativo: true,
          };
        })
        .filter(Boolean);
      const { error } = await supabase
        .from("qa_servicos_documentos" as any)
        .upsert(payload as any[], {
          onConflict: "servico_id,tipo_documento,condicao_profissional",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      toast.success(`Modelo "${modelo.titulo}" aplicado`);
      setModeloEscolhido("");
      await carregarChecklist(servicoId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCarregandoAcao(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-8 flex items-center justify-center gap-2 text-slate-400" style={{ borderColor: "hsl(220 15% 90%)" }}>
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Seletor de serviço + toolbar */}
      <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "hsl(220 15% 90%)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 shrink-0">Serviço:</label>
          <select
            value={servicoId ?? ""}
            onChange={(e) => setServicoId(e.target.value ? Number(e.target.value) : null)}
            className="h-8 text-xs border rounded-md px-2 flex-1 min-w-[220px]"
            style={{ borderColor: "hsl(220 15% 88%)" }}
          >
            <option value="">Escolha um serviço para montar o checklist…</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>{s.nome_servico}</option>
            ))}
          </select>

          {servicoId && (
            <>
              <div className="flex items-center gap-1">
                <select
                  value={modeloEscolhido}
                  onChange={(e) => setModeloEscolhido(e.target.value)}
                  className="h-8 text-xs border rounded-md px-2"
                  style={{ borderColor: "hsl(220 15% 88%)" }}
                >
                  <option value="">Usar modelo pronto…</option>
                  {MODELOS_PRONTOS.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.titulo}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!modeloEscolhido || carregandoAcao}
                  onClick={aplicarModelo}
                  className="h-8 text-xs gap-1 bg-[#7B1C2E] hover:bg-[#6a1827] text-white"
                >
                  <Sparkles className="w-3 h-3" /> Aplicar
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={() => setPreviaAberta(true)} className="h-8 text-xs gap-1">
                <Eye className="w-3 h-3" /> Pré-via cliente
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRestoreAberto(true)} className="h-8 text-xs gap-1">
                <RotateCcw className="w-3 h-3" /> Snapshots
              </Button>
            </>
          )}
        </div>
        {modeloEscolhido && (
          <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
            {getModeloBySlug(modeloEscolhido)?.aviso_juridico}
          </p>
        )}
      </div>

      {servicoId && (
        <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "hsl(220 15% 90%)" }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" style={{ color: "hsl(352 60% 30%)" }} />
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(220 20% 25%)" }}>
                  Fluxos guiados do cliente
                </h3>
              </div>
              <p className="text-[11px] mt-1 leading-relaxed text-slate-500">
                Use estes fluxos quando uma exigência pode se ramificar. O cliente responde perguntas simples,
                o sistema pede os documentos certos, grava as respostas no processo e libera declarações quando necessário.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:min-w-[640px]">
              <button
                disabled={carregandoAcao}
                onClick={aplicarFluxoResidenciaTerceiro}
                className="rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60 transition-colors"
                style={{ borderColor: fluxoResidenciaAtivo ? "hsl(145 60% 80%)" : "hsl(220 15% 88%)" }}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "hsl(220 20% 25%)" }}>
                  <Home className="w-3.5 h-3.5 text-[#7B1C2E]" />
                  RESIDÊNCIA COM TERCEIRO
                </span>
                <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  fluxoResidenciaAtivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {fluxoResidenciaAtivo ? "APLICADO" : "CLIQUE PARA APLICAR"}
                </span>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Comprovante, pergunta de titularidade, documento do terceiro e declaração assinada.
                </p>
              </button>

              <button
                disabled={carregandoAcao}
                onClick={aplicarFluxoOcupacaoLicita}
                className="rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60 transition-colors"
                style={{ borderColor: fluxoOcupacaoAtivo ? "hsl(145 60% 80%)" : "hsl(220 15% 88%)" }}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "hsl(220 20% 25%)" }}>
                  <BriefcaseBusiness className="w-3.5 h-3.5 text-[#7B1C2E]" />
                  OCUPAÇÃO LÍCITA RAMIFICADA
                </span>
                <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  fluxoOcupacaoAtivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {fluxoOcupacaoAtivo ? "APLICADO" : "CLIQUE PARA APLICAR"}
                </span>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  O cliente escolhe CLT, MEI, empresário, servidor, autônomo ou aposentado.
                </p>
              </button>

              <button
                disabled={carregandoAcao}
                onClick={aplicarGrupoCertidoesEstaduais}
                className="rounded-lg border p-3 text-left hover:bg-slate-50 disabled:opacity-60 transition-colors"
                style={{ borderColor: grupoCertidoesEstaduaisAtivo ? "hsl(145 60% 80%)" : "hsl(220 15% 88%)" }}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "hsl(220 20% 25%)" }}>
                  <Landmark className="w-3.5 h-3.5 text-[#7B1C2E]" />
                  CERTIDÕES ESTADUAIS
                </span>
                <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  grupoCertidoesEstaduaisAtivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {certidoesEstaduaisAplicadas}/{GRUPO_CERTIDOES_ESTADUAIS.length} ITENS
                </span>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  Transforma Justiça Estadual em pacote auditável com 4 certidões internas.
                </p>
              </button>
            </div>
          </div>
          {certidoesEstaduaisAplicadas > 0 && (
            <div className="mt-3 rounded-xl border bg-slate-50/70 p-3" style={{ borderColor: "hsl(220 15% 88%)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  PACOTE DE JUSTIÇA ESTADUAL NO CHECKLIST
                </p>
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  grupoCertidoesEstaduaisAtivo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                  {grupoCertidoesEstaduaisAtivo ? "COMPLETO" : "INCOMPLETO"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {GRUPO_CERTIDOES_ESTADUAIS.map((item, index) => {
                  const presente = itemCertidaoEstadualPresente(item, tiposChecklist);
                  return (
                    <div key={item.codigo} className="rounded-lg border bg-white p-2" style={{ borderColor: presente ? "hsl(145 60% 85%)" : "hsl(0 70% 88%)" }}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          presente ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-[#7B1C2E]">{item.nome}</div>
                          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                            {presente ? "Está no checklist e será validada separadamente." : "Ainda falta adicionar este item ao checklist."}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Base legal: Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311. A IN 201 exige certidões e comprovação de idoneidade; este pacote organiza a parte estadual para reduzir erro humano.
              </p>
            </div>
          )}
          {fluxoOcupacaoAtivo && (
            <div className="mt-3 rounded-xl border bg-slate-50/70 p-3" style={{ borderColor: "hsl(220 15% 88%)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  O QUE SERÁ PEDIDO QUANDO O CLIENTE ESCOLHER A CONDIÇÃO PROFISSIONAL
                </p>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                  VISÍVEL PARA AUDITORIA
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {OCUPACAO_RAMOS.map((ramo) => (
                  <div key={ramo.titulo} className="rounded-lg border bg-white p-2" style={{ borderColor: "hsl(220 15% 90%)" }}>
                    <div className="text-[10px] font-bold uppercase text-[#7B1C2E]">{ramo.titulo}</div>
                    <ul className="mt-1 space-y-1">
                      {ramo.itens.map((item) => (
                        <li key={item} className="flex gap-1.5 text-[10px] leading-snug text-slate-600">
                          <span className="mt-[5px] h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Estes documentos não aparecem todos na lista principal porque eles só nascem no processo depois que o cliente responde a condição profissional. A base legal usada é Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.
              </p>
            </div>
          )}
        </div>
      )}

      {!servicoId ? (
        <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: "hsl(220 15% 90%)" }}>
          <BookMarked className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Escolha um serviço acima para montar ou editar o checklist.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          {/* COLUNA ESQUERDA — biblioteca */}
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "hsl(220 15% 90%)" }}>
            <div className="flex items-center gap-2 mb-2">
              <BookMarked className="w-4 h-4" style={{ color: "hsl(352 60% 30%)" }} />
              <h3 className="text-xs font-semibold" style={{ color: "hsl(220 20% 25%)" }}>Biblioteca</h3>
              <span className="text-[10px] text-slate-400 ml-auto">clique em + para adicionar</span>
            </div>
            <div className="flex gap-1.5 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <Input
                  value={buscaBib}
                  onChange={(e) => setBuscaBib(e.target.value)}
                  placeholder="Buscar…"
                  className="pl-7 h-8 text-xs"
                />
              </div>
              <select
                value={catFiltro}
                onChange={(e) => setCatFiltro(e.target.value)}
                className="h-8 text-xs border rounded-md px-2"
                style={{ borderColor: "hsl(220 15% 88%)" }}
              >
                <option value="">Todas</option>
                {CATEGORIAS.map((c) => (<option key={c.valor} value={c.valor}>{c.label}</option>))}
              </select>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {gruposBib.length === 0 && (
                <p className="text-center py-8 text-xs italic text-slate-400">Nenhum documento encontrado.</p>
              )}
              {gruposBib.map(([cat, lista]) => (
                <div key={cat}>
                  <div className="text-[9px] font-bold tracking-[0.18em] text-slate-400 uppercase mb-1 px-1">
                    {labelCategoria(cat)}
                  </div>
                  <div className="space-y-1">
                    {lista.map((i) => (
                      <button
                        key={i.id}
                        disabled={i.jaNoServico || carregandoAcao}
                        onClick={() => adicionarBiblioteca(i)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left text-xs transition-colors ${
                          i.jaNoServico
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-white border-slate-200 hover:bg-slate-50 hover:border-[#7B1C2E]/30"
                        }`}
                      >
                        <span className="flex-1 truncate">{nomeDocumentoExibicao(i)}</span>
                        {i.jaNoServico ? (
                          <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-500 shrink-0">já no serviço</span>
                        ) : (
                          <Plus className="w-3 h-3 text-[#7B1C2E] shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COLUNA DIREITA — checklist do serviço */}
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "hsl(220 15% 90%)" }}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className="w-4 h-4" style={{ color: "hsl(352 60% 30%)" }} />
              <h3 className="text-xs font-semibold truncate" style={{ color: "hsl(220 20% 25%)" }}>
                Checklist — {servicoAtual?.nome_servico}
              </h3>
              <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                {checklist.length} exigência{checklist.length !== 1 ? "s" : ""}
              </span>
            </div>
            {checklist.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 border border-dashed rounded-lg" style={{ borderColor: "hsl(220 15% 88%)" }}>
                Nenhuma exigência ainda.<br />
                Adicione da biblioteca (à esquerda) ou aplique um modelo pronto.
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                {checklist.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-1.5 border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={i === 0 || carregandoAcao}
                        onClick={() => moverOrdem(c, "cima")}
                        className="h-3.5 w-3.5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={i === checklist.length - 1 || carregandoAcao}
                        onClick={() => moverOrdem(c, "baixo")}
                        className="h-3.5 w-3.5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${GRUPO_CERTIDOES_ESTADUAIS_TIPOS.includes(c.tipo_documento) ? "whitespace-normal leading-snug" : "truncate"}`} style={{ color: "hsl(220 20% 25%)" }}>
                        {nomeDocumentoExibicao(c)}
                      </p>
                      <p className="text-[10px] font-mono truncate text-slate-400">
                        ordem {c.ordem} · {c.etapa}{c.biblioteca_id ? " · ligado à biblioteca" : ""}
                        {GRUPO_CERTIDOES_ESTADUAIS_TIPOS.includes(c.tipo_documento) ? " · pacote estadual" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleObrigatorio(c)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${
                        c.obrigatorio
                          ? "text-red-700 bg-red-50 border-red-200"
                          : "text-slate-500 bg-slate-50 border-slate-200"
                      }`}
                    >
                      {c.obrigatorio ? "OBRIGATÓRIO" : "OPCIONAL"}
                    </button>
                    <button
                      onClick={() => removerChecklist(c)}
                      className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      {previaAberta && servicoId && (
        <PreviaClienteChecklistModal
          servicoId={servicoId}
          servicoNome={servicoAtual?.nome_servico}
          onClose={() => setPreviaAberta(false)}
        />
      )}
      {restoreAberto && servicoId && servicoAtual && (
        <RestoreSnapshotModal
          servicoId={servicoId}
          servicoNome={servicoAtual.nome_servico}
          onClose={() => setRestoreAberto(false)}
          onRestored={() => carregarChecklist(servicoId)}
        />
      )}
    </div>
  );
}
