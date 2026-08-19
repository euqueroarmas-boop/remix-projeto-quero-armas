import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, ChevronRight, UserCheck, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { HUB_TIPOS_DOCUMENTO, getTipoDocumentoMeta } from "@/lib/quero-armas/documentosHubCatalogo";
import {
  calcularValidadeEfetiva,
  getDataEmissaoDocumentoHub,
  isCertidaoCivilSemVencimento,
} from "@/lib/quero-armas/validadeDocumento";
import type { ArquivoUpload, ClienteSalvo } from "./PrePilotoWizard";

interface Props {
  dadosRevisados: Record<string, string | null>;
  senhagov: string | null;
  arquivos: ArquivoUpload[];
  onSalvo: (c: ClienteSalvo) => void;
  onVoltar: () => void;
}

function formatCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return d || null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * As duas formas em que o CPF aparece em qa_clientes.
 *
 * A Central de Adesão grava "000.000.000-00"; o cadastro público grava só os
 * dígitos. Procurar por uma forma só deixava o cadastro existente invisível e
 * o operador acabava criando um segundo registro para a mesma pessoa.
 */
function cpfVariantes(cpf: string | null): string[] {
  const d = String(cpf || "").replace(/\D/g, "");
  if (!d) return [];
  const fmt = formatCpf(d);
  return Array.from(new Set([fmt, d].filter(Boolean))) as string[];
}

function campoPreenchido(v: string | null | undefined): boolean {
  const s = String(v || "").trim();
  return !!s && !/^não extra[ií]do$/i.test(s);
}

/** Data de hoje em ISO (yyyy-mm-dd), fuso de Brasília (UTC-03). */
function hojeISOBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Normaliza dd/mm/aaaa ou aaaa-mm-dd para ISO; devolve null se não der. */
function toIsoData(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function emailValido(email: string | null | undefined): boolean {
  const s = String(email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function celularValido(celular: string | null | undefined): boolean {
  const d = String(celular || "").replace(/\D/g, "");
  return d.length === 10 || d.length === 11 || (d.length === 13 && d.startsWith("55"));
}

function validarDadosMinimos(dados: Record<string, string | null>, cpfNorm: string | null): string | null {
  if (!campoPreenchido(dados.nome_completo)) return "Nome completo é obrigatório.";
  if (!cpfNorm || cpfNorm.length !== 11) return "CPF inválido — corrija na etapa anterior.";
  if (!emailValido(dados.email)) return "E-mail válido é obrigatório.";
  if (!celularValido(dados.celular)) return "Celular/WhatsApp com DDD é obrigatório.";
  return null;
}

// Mapeia o "tipo" usado na Etapa 1 para o `tipo_documento` canônico do
// Hub Documental (qa_documentos_cliente). GOV.BR não é doc — vai como senha.
// Mapa de aliases legado → canônico. Tipos já canônicos (retornados pela IA
// na Etapa 2 via arquivos_classificados) passam direto por identidade.
// Aliases legado → canônico. Cadastros antigos e classificações da IA feitas
// antes da unificação usavam slugs próprios que o CHECK do banco rejeita —
// o INSERT falhava e o documento se perdia sem que ninguém percebesse.
const TIPO_ETAPA1_TO_HUB: Record<string, string> = {
  certidao_antecedentes_criminais_federal: "antecedentes_federal",
  certidao_antecedentes_criminais_estadual: "antecedentes_estadual",
  certidao_antecedentes_criminais_militar: "antecedentes_militar",
  certidao_antecedentes_criminais_eleitoral: "antecedentes_eleitoral",
  cartao_cnpj_mei: "renda_cartao_cnpj",
  comprovante_renda: "renda_holerite_mes_atual",
  ocupacao_licita: "renda_cnpj_autonomo",
  rg: "rg_com_cpf",
};

// Fonte única da verdade: o catálogo do Hub (espelha o CHECK de
// qa_documentos_cliente). Nunca redeclarar essa lista aqui.
const TIPOS_CANONICOS_HUB = new Set(HUB_TIPOS_DOCUMENTO.map((t) => t.value));

function resolveTipoHub(tipoEtapa1: string): string {
  if (TIPOS_CANONICOS_HUB.has(tipoEtapa1)) return tipoEtapa1;
  const alias = TIPO_ETAPA1_TO_HUB[tipoEtapa1];
  if (alias && TIPOS_CANONICOS_HUB.has(alias)) return alias;
  console.warn(`[Etapa4Salvar] tipo sem correspondência no Hub: "${tipoEtapa1}" → salvo como "outro"`);
  return "outro";
}

/**
 * Apura quais exigências do checklist foram cumpridas pelos documentos que
 * acabaram de entrar e avisa o cliente com UM e-mail resumo por processo.
 *
 * A trigger do banco já fez o casamento documento → exigência. Aqui apenas
 * lemos o resultado e notificamos: um cadastro completo fecha várias exigências
 * de uma vez, e um e-mail por exigência viraria uma enxurrada na caixa do
 * cliente logo no primeiro contato.
 */
async function notificarExigenciasCumpridas(clienteId: number) {
  // Rede de segurança: a trigger roda por linha inserida, mas se o processo
  // foi aberto depois do documento, o slot ficou sem casar. Esta RPC reavalia
  // todas as exigências pendentes contra o Hub.
  await supabase.rpc("qa_processo_rever_exigencias" as any, { p_cliente_id: clienteId });

  // Exigências validadas nos últimos 2 minutos — a janela desta gravação.
  const desde = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: cumpridas } = await supabase
    .from("qa_processo_documentos" as any)
    .select("processo_id, tipo_documento, nome_documento, data_validacao")
    .eq("cliente_id", clienteId)
    .eq("status", "aprovado")
    .gte("data_validacao", desde);

  const lista = (cumpridas as any[]) || [];
  if (lista.length === 0) return;

  // Um resumo por processo: o cliente pode ter mais de um processo aberto.
  const porProcesso = new Map<string, string[]>();
  for (const d of lista) {
    const chave = String(d.processo_id ?? "sem_processo");
    const nome = d.nome_documento || getTipoDocumentoMeta(d.tipo_documento)?.label || d.tipo_documento;
    const atual = porProcesso.get(chave) ?? [];
    if (!atual.includes(nome)) atual.push(nome);
    porProcesso.set(chave, atual);
  }

  for (const [processoId, nomes] of porProcesso) {
    await supabase.functions.invoke("qa-notify-event", {
      body: {
        evento: "exigencia_cumprida",
        cliente_id: clienteId,
        processo: processoId === "sem_processo" ? undefined : processoId,
        exigencia: nomes.length === 1
          ? nomes[0]
          : `${nomes.length} exigências: ${nomes.join(", ")}`,
      },
    });
  }
}

/**
 * Descarta o que veio vazio ou como "não extraído": campo em branco nunca pode
 * apagar o que já estava gravado no cadastro do cliente.
 */
function camposComValor(campos: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(campos)) {
    if (typeof valor === "boolean") { limpo[chave] = valor; continue; }
    if (valor === null || valor === undefined) continue;
    const texto = String(valor).trim();
    if (!campoPreenchido(texto)) continue;
    limpo[chave] = texto;
  }
  return limpo;
}

/**
 * Grava os dados revisados por cima do cadastro que já existe.
 *
 * Caminho preferencial: a edge function, que confere o operador e grava com
 * service role. Mandamos o token da sessão na mão: quando o supabase-js não
 * repassa o token para a função (sessão renovada, aba parada muito tempo), ela
 * respondia "unauthenticated" e o operador ficava sem conseguir atualizar.
 *
 * Se mesmo assim a função recusar ou não estiver publicada, o UPDATE direto
 * assume. Quem autoriza de verdade é a policy `qa_clientes_staff_update`: se o
 * operador não for da equipe, o banco recusa e o erro aparece na tela. Só a
 * recusa por dado inválido (400) não tenta de novo — aí o problema é o campo,
 * não o caminho.
 */
async function atualizarCadastroExistente(
  clienteId: number,
  campos: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // getSession também renova o token vencido antes de qualquer chamada.
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token ?? null;

  let motivo: string | undefined;
  let status: number | undefined;
  if (token) {
    const { data: saveResult, error: saveError } = await supabase.functions.invoke(
      "qa-central-adesao-salvar-cliente",
      {
        body: { cliente_id: clienteId, campos },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!saveError && saveResult?.ok && saveResult.cliente) {
      return saveResult.cliente as Record<string, unknown>;
    }

    // A mensagem padrão do supabase-js ("non-2xx status code") esconde o motivo
    // real; lemos o corpo da resposta para o operador saber o que corrigir.
    motivo = saveResult?.error as string | undefined;
    const ctx: any = (saveError as any)?.context;
    if (ctx) {
      if (typeof ctx.status === "number") status = ctx.status;
      if (!motivo && typeof ctx.json === "function") {
        try { motivo = (await ctx.json())?.error; } catch { /* corpo não-JSON */ }
      }
    }
    if (status === 400) {
      throw new Error(motivo || "Falha ao atualizar o cadastro único do cliente");
    }
    if (!motivo) motivo = saveError?.message;
  }
  if (!token) motivo = "sessão do admin expirada — saia e entre de novo";
  console.warn("[Etapa4Salvar] gravando direto no cadastro; a função recusou:", status ?? "sem sessão", motivo);

  // Marca os campos como preenchidos pela equipe, igual à edge function: sem
  // isso o auto-preenchimento por IA pode sobrescrever depois o que o operador
  // acabou de conferir.
  const { data: atual } = await supabase
    .from("qa_clientes" as any)
    .select("campo_origens")
    .eq("id", clienteId)
    .maybeSingle();
  const origemAtual = (atual as any)?.campo_origens;
  const campoOrigens: Record<string, unknown> = {
    ...(origemAtual && typeof origemAtual === "object" ? origemAtual : {}),
  };
  const agora = new Date().toISOString();
  for (const chave of Object.keys(campos)) {
    if (chave !== "arquivado") campoOrigens[chave] = { source: "manual_override_ai", updated_at: agora };
  }

  const { data: salvo, error: updateError } = await supabase
    .from("qa_clientes" as any)
    .update({ ...campos, campo_origens: campoOrigens })
    .eq("id", clienteId)
    .select("id, nome_completo, cpf, email, celular, endereco, numero, complemento, bairro, cidade, estado, cep, pais")
    .maybeSingle();
  if (updateError || !salvo) {
    throw new Error(updateError?.message || motivo || "Falha ao atualizar o cadastro único do cliente");
  }
  return salvo as Record<string, unknown>;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
}

export default function Etapa4Salvar({ dadosRevisados, senhagov, arquivos, onSalvo, onVoltar }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [existente, setExistente] = useState<ClienteSalvo | null>(null);
  const [existenteArquivado, setExistenteArquivado] = useState(false);
  const [verificado, setVerificado] = useState(false);
  const [statusUpload, setStatusUpload] = useState<string | null>(null);

  const cpfNorm = dadosRevisados.cpf?.replace(/\D/g, "") ?? null;

  // Endereço completo do cliente para o resumo da compra (logradouro, número,
  // complemento, bairro, cidade/UF e CEP) — só entra o que foi extraído.
  const enderecoResumo = [
    [dadosRevisados.logradouro || dadosRevisados.endereco, dadosRevisados.numero]
      .filter((v) => campoPreenchido(v))
      .join(", "),
    dadosRevisados.complemento,
    dadosRevisados.bairro,
    [dadosRevisados.cidade, dadosRevisados.estado]
      .filter((v) => campoPreenchido(v))
      .join("/"),
    campoPreenchido(dadosRevisados.cep) ? `CEP ${dadosRevisados.cep}` : "",
  ]
    .filter((v) => campoPreenchido(v))
    .join(" — ");

  async function verificarDuplicata() {
    const erroMinimo = validarDadosMinimos(dadosRevisados, cpfNorm);
    if (erroMinimo) {
      toast.error(erroMinimo);
      return;
    }
    setSalvando(true);
    try {
      // Sem maybeSingle: se houver duplicata antiga do mesmo CPF, ela derruba a
      // consulta e o cadastro existente some da tela. Ordenamos para o não
      // arquivado mais recente vir primeiro e é ele que o operador atualiza.
      const { data, error } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, cpf, email, celular, arquivado, excluido")
        .in("cpf", cpfVariantes(cpfNorm))
        .eq("excluido", false)
        .order("arquivado", { ascending: true })
        .order("id", { ascending: false })
        .limit(1);
      if (error) throw error;
      const achado = Array.isArray(data) ? (data[0] as any) : null;

      if (achado) {
        setExistente({ id: achado.id, nome_completo: achado.nome_completo, cpf: achado.cpf, email: achado.email, celular: achado.celular, existia: true });
        setExistenteArquivado(!!achado.arquivado);
      } else {
        setExistente(null);
        setExistenteArquivado(false);
      }
      setVerificado(true);
    } catch (e: any) {
      toast.error("Erro ao verificar CPF: " + (e?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  }

  async function salvar(reutilizar: boolean) {
    const erroMinimo = validarDadosMinimos(dadosRevisados, cpfNorm);
    if (erroMinimo) {
      toast.error(erroMinimo);
      return;
    }
    setSalvando(true);
    try {
      // Normaliza data DD/MM/AAAA -> AAAA-MM-DD (Postgres date)
      const toIsoDate = (v: unknown): string | null => {
        if (!v) return null;
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return null;
      };
      const dataNascIso = toIsoDate(dadosRevisados.data_nascimento);
      const expedicaoRgIso = toIsoDate(dadosRevisados.data_expedicao_rg);
      let clienteId: number;
      let existia = false;

      if (reutilizar && existente) {
        clienteId = existente.id;
        existia = true;
        // A Central e o portal compartilham qa_clientes como cadastro canônico.
        // A função valida o operador, grava com service role e devolve o que
        // realmente ficou salvo; assim uma falha de RLS nunca vira falso sucesso.
        const camposCanonicos = {
          nome_completo: dadosRevisados.nome_completo,
          email: dadosRevisados.email || null,
          celular: dadosRevisados.celular || null,
          data_nascimento: dataNascIso,
          nome_pai: dadosRevisados.nome_pai || null,
          nome_mae: dadosRevisados.nome_mae || null,
          sexo: dadosRevisados.sexo || null,
          rg: dadosRevisados.rg || null,
          emissor_rg: dadosRevisados.emissor_rg || null,
          uf_emissor_rg: dadosRevisados.uf_emissor_rg || null,
          expedicao_rg: expedicaoRgIso,
          nacionalidade: dadosRevisados.nacionalidade || null,
          naturalidade_municipio: dadosRevisados.naturalidade_municipio || null,
          naturalidade_uf: dadosRevisados.naturalidade_uf || null,
          naturalidade_pais: dadosRevisados.naturalidade_pais || null,
          estado_civil: dadosRevisados.estado_civil || null,
          escolaridade: dadosRevisados.escolaridade || null,
          titulo_eleitor: dadosRevisados.titulo_eleitor || null,
          cnh: dadosRevisados.cnh || null,
          ctps: dadosRevisados.ctps || null,
          profissao: dadosRevisados.profissao || null,
          cep: dadosRevisados.cep || null,
          endereco: dadosRevisados.logradouro || dadosRevisados.endereco || null,
          numero: dadosRevisados.numero || null,
          complemento: dadosRevisados.complemento || null,
          bairro: dadosRevisados.bairro || null,
          cidade: dadosRevisados.cidade || null,
          estado: dadosRevisados.estado || null,
          pais: dadosRevisados.pais || "BRASIL",
          observacao: dadosRevisados.observacoes || null,
          ocupacao_licita_cnpj: dadosRevisados.cnpj || null,
          ocupacao_licita_razao_social: dadosRevisados.ocupacao_licita_razao_social || null,
          ocupacao_licita_nome_fantasia: dadosRevisados.ocupacao_licita_nome_fantasia || null,
          ocupacao_licita_atividade: dadosRevisados.ocupacao_licita_atividade || null,
          ocupacao_licita_logradouro: dadosRevisados.ocupacao_licita_logradouro || null,
          ocupacao_licita_numero: dadosRevisados.ocupacao_licita_numero || null,
          ocupacao_licita_complemento: dadosRevisados.ocupacao_licita_complemento || null,
          ocupacao_licita_bairro: dadosRevisados.ocupacao_licita_bairro || null,
          ocupacao_licita_cidade: dadosRevisados.ocupacao_licita_cidade || null,
          ocupacao_licita_estado: dadosRevisados.ocupacao_licita_estado || null,
          ocupacao_licita_cep: dadosRevisados.ocupacao_licita_cep || null,
          ocupacao_licita_telefone: dadosRevisados.ocupacao_licita_telefone || null,
          ...(existenteArquivado ? { arquivado: false } : {}),
        };
        const camposParaGravar = camposComValor(camposCanonicos);
        const salvo = await atualizarCadastroExistente(clienteId, camposParaGravar);
        const enderecoEsperado = String(camposParaGravar.endereco || "").trim();
        if (enderecoEsperado && !String((salvo as any)?.endereco || "").trim()) {
          throw new Error("O endereço não foi confirmado no cadastro único do cliente");
        }
      } else {
        // Se existia um cliente arquivado com o mesmo CPF, marca como excluído
        // para liberar o índice único antes de criar o novo registro
        if (existente && existenteArquivado) {
          await supabase.from("qa_clientes" as any).update({ excluido: true }).eq("id", existente.id);
        }

        // Criar novo cliente
        const payload: Record<string, unknown> = {
          nome_completo: dadosRevisados.nome_completo,
          cpf: formatCpf(cpfNorm),
          email: dadosRevisados.email || null,
          celular: dadosRevisados.celular || null,
          data_nascimento: dataNascIso,
          nome_mae: dadosRevisados.nome_mae || null,
          nome_pai: dadosRevisados.nome_pai || null,
          sexo: dadosRevisados.sexo || null,
          rg: dadosRevisados.rg || null,
          emissor_rg: dadosRevisados.emissor_rg || null,
          uf_emissor_rg: dadosRevisados.uf_emissor_rg || null,
          expedicao_rg: expedicaoRgIso || null,
          nacionalidade: dadosRevisados.nacionalidade || null,
          naturalidade_municipio: dadosRevisados.naturalidade_municipio || null,
          naturalidade_uf: dadosRevisados.naturalidade_uf || null,
          naturalidade_pais: dadosRevisados.naturalidade_pais || null,
          estado_civil: dadosRevisados.estado_civil || null,
          escolaridade: dadosRevisados.escolaridade || null,
          titulo_eleitor: dadosRevisados.titulo_eleitor || null,
          cnh: dadosRevisados.cnh || null,
          ctps: dadosRevisados.ctps || null,
          cep: dadosRevisados.cep || null,
          endereco: dadosRevisados.logradouro || dadosRevisados.endereco || null,
          numero: dadosRevisados.numero || null,
          complemento: dadosRevisados.complemento || null,
          bairro: dadosRevisados.bairro || null,
          cidade: dadosRevisados.cidade || null,
          estado: dadosRevisados.estado || null,
          profissao: dadosRevisados.profissao || null,
          observacao: dadosRevisados.observacoes || null,
          ocupacao_licita_cnpj: dadosRevisados.cnpj || null,
          ocupacao_licita_razao_social: dadosRevisados.ocupacao_licita_razao_social || null,
          ocupacao_licita_nome_fantasia: dadosRevisados.ocupacao_licita_nome_fantasia || null,
          ocupacao_licita_atividade: dadosRevisados.ocupacao_licita_atividade || null,
          ocupacao_licita_logradouro: dadosRevisados.ocupacao_licita_logradouro || null,
          ocupacao_licita_numero: dadosRevisados.ocupacao_licita_numero || null,
          ocupacao_licita_complemento: dadosRevisados.ocupacao_licita_complemento || null,
          ocupacao_licita_bairro: dadosRevisados.ocupacao_licita_bairro || null,
          ocupacao_licita_cidade: dadosRevisados.ocupacao_licita_cidade || null,
          ocupacao_licita_estado: dadosRevisados.ocupacao_licita_estado || null,
          ocupacao_licita_cep: dadosRevisados.ocupacao_licita_cep || null,
          ocupacao_licita_telefone: dadosRevisados.ocupacao_licita_telefone || null,
        };

        const { data: novo, error: errNovo } = await supabase
          .from("qa_clientes" as any)
          .insert(payload)
          .select("id, nome_completo, cpf, email, celular")
          .single();

        if (errNovo || !novo) throw new Error(errNovo?.message || "Falha ao criar cliente");
        clienteId = (novo as any).id;
      }

      // Salvar senha GOV.BR se disponível (via RPC segura)
      if (senhagov) {
        try {
          await supabase.rpc("qa_cliente_salvar_senha_gov" as any, {
            p_cliente_id: clienteId,
            p_senha_plaintext: senhagov,
          });
        } catch {
          toast.warning("Cliente salvo, mas não foi possível salvar a senha GOV.BR — adicione manualmente no cadastro.");
        }
      }

      // Auditoria
      try {
        await supabase.from("qa_logs_auditoria" as any).insert({
          acao: reutilizar ? "pre_piloto_reutilizou_cliente" : "pre_piloto_criou_cliente",
          entidade: "pre_piloto",
          entidade_id: String(clienteId),
          detalhes_json: { campos_preenchidos: Object.keys(dadosRevisados).filter((k) => dadosRevisados[k]) },
        });
      } catch { /* não bloqueia */ }

      const cFinal: ClienteSalvo = {
        id: clienteId,
        nome_completo: dadosRevisados.nome_completo || existente?.nome_completo || "",
        cpf: formatCpf(cpfNorm),
        email: dadosRevisados.email || null,
        celular: dadosRevisados.celular || null,
        existia,
      };

      toast.success(existia ? "Cliente atualizado com sucesso" : "Cliente criado com sucesso");

      // ============================================================
      // Persistência dos documentos capturados na Etapa 1.
      // A Central de Adesão só entrega o arquivo ao Hub Documental. A
      // validação final fica no fluxo único do Hub, contra a pendência real
      // do checklist, para evitar que a extração inicial aprove tipo errado.
      // ============================================================
      const vistosNoPacote = new Set<string>();
      const docsParaPersistir = (arquivos || []).filter((a) => {
        if (a.tipo === "gov_br") return false;
        const tipoDb = resolveTipoHub(a.tipo);
        const key = `${tipoDb}::${a.file.name.toLowerCase()}::${a.file.size}`;
        if (vistosNoPacote.has(key)) return false;
        vistosNoPacote.add(key);
        return true;
      });
      // O QSA é emitido junto com o cartão CNPJ e não traz data própria.
      // Sem emissão não há validade — e o documento entraria no Hub "SEM DATA".
      // Herda a data do cartão enviado no mesmo lote, e com ela os 30 dias.
      const emissaoCartaoCnpj = docsParaPersistir.find((a) =>
        ["renda_cartao_cnpj", "renda_cnpj_autonomo"].includes(resolveTipoHub(a.tipo)) && a.data_emissao,
      )?.data_emissao ?? null;

      if (docsParaPersistir.length > 0) {
        setStatusUpload(`Enviando ${docsParaPersistir.length} documento(s) ao Hub Documental…`);
        let ok = 0;
        let falhas = 0;
        for (const a of docsParaPersistir) {
          try {
            const tipoDb = resolveTipoHub(a.tipo);
            const jaExiste = await supabase
              .from("qa_documentos_cliente" as any)
              .select("id")
              .eq("qa_cliente_id", clienteId)
              .eq("tipo_documento", tipoDb)
              .eq("arquivo_nome", a.file.name)
              .not("status", "in", "(substituido,excluido)")
              .limit(1);
            if (!jaExiste.error && Array.isArray(jaExiste.data) && jaExiste.data.length > 0) {
              ok++;
              continue;
            }
            const safe = sanitizeFileName(a.file.name);
            const path = `cliente-docs/qa-${clienteId}/${tipoDb}/${Date.now()}_${safe}`;
            const { error: upErr } = await supabase.storage
              .from("qa-documentos")
              .upload(path, a.file, { upsert: true, contentType: a.file.type || undefined });
            if (upErr) {
              falhas++;
              console.error("[pre-piloto upload] arquivo:", a.file.name, "erro:", upErr.message, upErr);
              continue;
            }

            // ── Datas: nenhum documento da Central de Adesão pode entrar no
            // Hub "SEM DATA". A ordem de resolução da emissão é:
            //   1) data lida pela IA no card da Etapa 1;
            //   2) qualquer campo de data equivalente dentro de camposExtraidos
            //      (data_expedicao, data_documento, data_referencia, etc.);
            //   3) herança do cartão CNPJ (só para o QSA, que não tem data);
            //   4) presunção pela data do envio — o documento acabou de ser
            //      entregue pelo cliente, então a contagem começa hoje.
            // A presunção fica registrada em ia_dados_extraidos para a equipe
            // poder corrigir depois no Hub.
            const emissaoIA = a.data_emissao
              ?? getDataEmissaoDocumentoHub({
                ia_dados_extraidos: { camposExtraidos: a.campos_extraidos ?? {} },
              })
              ?? (tipoDb === "renda_qsa" ? emissaoCartaoCnpj : null);
            const semVencimento = isCertidaoCivilSemVencimento(tipoDb);
            const emissaoPresumida = !emissaoIA && !semVencimento;
            const emissao = emissaoIA ?? (semVencimento ? null : hojeISOBrasilia());
            // Validade explícita lida no documento tem precedência sobre a regra.
            const validadeIA = toIsoData(
              (a.campos_extraidos as Record<string, unknown> | undefined)?.data_validade
                ?? (a.campos_extraidos as Record<string, unknown> | undefined)?.data_vencimento,
            );
            const validade = validadeIA ?? calcularValidadeEfetiva(tipoDb, emissao);

            const payload: Record<string, unknown> = {
              qa_cliente_id: clienteId,
              tipo_documento: tipoDb,
              data_emissao: emissao,
              data_validade: validade,
              arquivo_storage_path: path,
              arquivo_nome: a.file.name,
              arquivo_mime: a.file.type || null,
              // Nasce APROVADO: o documento foi conferido e classificado pela
              // equipe durante o cadastro. É essa flag que a trigger
              // qa_doc_hub_satisfaz_exigencias_processo() exige para marcar a
              // exigência do checklist como cumprida — com "pendente_aprovacao"
              // ela nunca disparava, e o cliente era cobrado de novo por um
              // documento que já havia entregue.
              status: "aprovado",
              origem: "admin",
              validado_admin: true,
              aprovado_em: new Date().toISOString(),
              ia_dados_extraidos: {
                origem: "central_adesao",
                tipo_sugerido: tipoDb,
                tipo_original: a.tipo_original ?? null,
                tipo_aplicado_por_ia: a.tipo_aplicado_por_ia === true,
                tipo_ia_confianca: a.tipo_ia_confianca ?? null,
                tipo_ia_motivo: a.tipo_ia_motivo ?? null,
                validacao_final: "hub_documental",
                // Tudo que a IA leu do documento. Antes era descartado: só
                // tipo e confiança eram gravados, e o documento chegava ao Hub
                // sem data de emissão (logo, sem validade e sem alerta de
                // vencimento) e sem nada para a validação cruzada comparar.
                // Usa a mesma chave `camposExtraidos` do fluxo do Hub, para
                // que backfill e conformidade leiam de um só lugar.
                ...(a.campos_extraidos ? { camposExtraidos: a.campos_extraidos } : {}),
                data_emissao_presumida: emissaoPresumida,
                ...(emissaoPresumida
                  ? { data_emissao_presumida_motivo: "ia_nao_extraiu_data_usou_data_do_envio" }
                  : {}),
              },
            };
            const { error: insErr } = await supabase
              .from("qa_documentos_cliente" as any)
              .insert(payload);
            if (insErr) { falhas++; console.warn("[pre-piloto insert doc]", insErr); }
            else ok++;
          } catch (err) {
            falhas++;
            console.warn("[pre-piloto doc catch]", err);
          }
        }
        setStatusUpload(null);
        if (ok > 0) toast.success(`${ok} documento(s) gravado(s) no Hub Documental`);
        if (falhas > 0) toast.warning(`${falhas} documento(s) não puderam ser gravados — veja o console (F12) para o erro detalhado.`);

        // Os documentos entram como aprovados, então a trigger
        // qa_doc_hub_satisfaz_exigencias_processo() já casou cada um com os
        // slots do processo. Aqui só conferimos o que fechou e avisamos o
        // cliente — um e-mail resumo por processo, não um por exigência.
        if (ok > 0 && clienteId) {
          try {
            await notificarExigenciasCumpridas(clienteId);
          } catch (err) {
            // Falha de notificação nunca pode derrubar o cadastro: o documento
            // já está salvo e a exigência já foi cumprida no banco.
            console.warn("[pre-piloto notificar exigências]", err);
          }
        }
      }

      onSalvo(cFinal);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 4 — Salvar Cliente</h2>
        <p className="text-xs text-muted-foreground">
          Verificamos o CPF: se já houver cadastro, ele é atualizado com os dados revisados agora; se não houver, criamos um novo.
        </p>
      </div>

      {/* Resumo */}
      {/* Rótulo e valor em duas colunas: no parágrafo corrido o endereço
          quebrava por baixo do rótulo e o bloco ficava torto. */}
      <div className="bg-muted/40 rounded-lg p-3 text-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-medium">Nome</dt>
          <dd className="min-w-0 break-words">{dadosRevisados.nome_completo}</dd>
          <dt className="font-medium">CPF</dt>
          <dd className="min-w-0 break-words">{formatCpf(cpfNorm) || "(não informado)"}</dd>
          {dadosRevisados.email && (
            <>
              <dt className="font-medium">E-mail</dt>
              <dd className="min-w-0 break-words">{dadosRevisados.email}</dd>
            </>
          )}
          {dadosRevisados.celular && (
            <>
              <dt className="font-medium">Celular</dt>
              <dd className="min-w-0 break-words">{dadosRevisados.celular}</dd>
            </>
          )}
          {enderecoResumo && (
            <>
              <dt className="font-medium">Endereço</dt>
              <dd className="min-w-0 break-words">{enderecoResumo}</dd>
            </>
          )}
        </dl>
        {senhagov && (
          <p className="flex items-center gap-1.5 text-green-700 mt-2 pt-2 border-t border-border/60">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" /> Senha GOV.BR será salva (criptografada)
          </p>
        )}
      </div>

      {!verificado && (
        <Button
          onClick={verificarDuplicata}
          disabled={salvando}
          className="w-full bg-[#2E3236] hover:bg-[#282B2F] text-white text-xs gap-1"
          size="sm"
        >
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Verificar CPF e continuar
        </Button>
      )}

      {verificado && existente && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <div className="flex items-start gap-2">
            <UserCheck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-amber-800">
                {existenteArquivado ? "CPF encontrado (cliente arquivado)" : "CPF já cadastrado"}
              </p>
              <p className="text-xs text-amber-700 break-words">
                <strong>{existente.nome_completo}</strong> (ID {existente.id})
              </p>
              {existente.email && <p className="text-xs text-amber-600 break-words">{existente.email}</p>}
              {existenteArquivado && (
                <p className="text-xs text-amber-600">
                  Este cliente estava arquivado. Você pode reativá-lo ou criar um novo cadastro (o arquivado será excluído).
                </p>
              )}
              <p className="text-xs text-amber-600 leading-relaxed">
                Atualizar mantém o ID {existente.id}, o histórico e os documentos, e grava por cima os dados revisados. Campo que não foi lido nos documentos fica como está.
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-700">O que deseja fazer?</p>
          {/* Um botão embaixo do outro no celular: lado a lado o texto não cabia
              na largura da tela e o segundo botão ficava cortado pela metade. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => salvar(true)}
              disabled={salvando}
              className="text-xs gap-1 w-full sm:flex-1 h-auto min-h-9 py-2 whitespace-normal text-center"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
              {existenteArquivado ? "Reativar e atualizar" : "Atualizar cadastro existente"}
            </Button>
            <Button
              size="sm"
              onClick={() => salvar(false)}
              disabled={salvando}
              className="bg-[#2E3236] hover:bg-[#282B2F] text-white text-xs gap-1 w-full sm:flex-1 h-auto min-h-9 py-2 whitespace-normal text-center"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              Criar novo mesmo assim
            </Button>
          </div>
        </div>
      )}

      {verificado && !existente && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            CPF não encontrado — será criado um novo cadastro.
          </div>
          <Button
            onClick={() => salvar(false)}
            disabled={salvando}
            className="w-full bg-[#2E3236] hover:bg-[#282B2F] text-white text-xs gap-1"
            size="sm"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Criar cliente e avançar
          </Button>
        </div>
      )}

      <div className="flex justify-start pt-1">
        <Button variant="ghost" size="sm" onClick={onVoltar} className="text-xs gap-1 text-muted-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </Button>
      </div>
    </div>
  );
}
