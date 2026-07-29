import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArquivoUpload, DadosExtraidos } from "./PrePilotoWizard";

interface Props {
  arquivos: ArquivoUpload[];
  setArquivos?: (a: ArquivoUpload[]) => void;
  textoPastaColado: string;
  onConcluido: (dados: DadosExtraidos) => void;
  onVoltar: () => void;
}

type StatusLinha = { label: string; status: "pending" | "loading" | "ok" | "error"; detalhe?: string };

const TIPOS_CANONICOS_HUB = new Set([
  "cin", "rg_com_cpf", "cnh", "cpf",
  "comprovante_residencia", "comprovante_renda",
  "laudo_psicologico", "laudo_capacidade_tecnica",
  "certidao_antecedentes_criminais_federal",
  "certidao_antecedentes_criminais_estadual",
  "certidao_antecedentes_criminais_militar",
  "certidao_antecedentes_criminais_eleitoral",
  "cartao_cnpj_mei", "renda_contrato_social", "renda_ccmei", "certidao_alteracao_nome",
  "craf", "sinarm", "gt", "gte", "autorizacao_compra", "nota_fiscal_arma",
  "procuracao", "recurso_administrativo_doc", "mandado_seguranca_doc",
  "gov_br", "outro",
]);

const CONFIANCA_MINIMA_TIPO_IA = 0.75;
const CONFIANCA_MINIMA_TIPO_IA_OUTRO = 0.6;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Valida o dígito verificador do CNPJ (algoritmo oficial da Receita Federal).
function cnpjValido(cnpj: string): boolean {
  const d = digitsOnly(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, dig, i) => acc + Number(dig) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calc(d.slice(0, 12) + dv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d === d.slice(0, 12) + String(dv1) + String(dv2);
}

// Devolve só o trecho realmente digitado pelo operador, descartando os blocos
// que a Etapa 1 injeta automaticamente (conversa do ZIP, nomes de arquivo).
// Sem isso a conversa inteira do WhatsApp é tratada como "dado informado
// manualmente" e sobrescreve, com confiança 1, o que a IA leu dos documentos.
function soTextoDigitado(text: string): string {
  const marcador = /^===\s*(NOMES DE ARQUIVO|CONVERSA WHATSAPP|TELEFONES EXTRA)/i;
  const out: string[] = [];
  let emBlocoAutomatico = false;
  for (const linha of text.split("\n")) {
    if (marcador.test(linha.trim())) { emBlocoAutomatico = true; continue; }
    if (!emBlocoAutomatico) out.push(linha);
  }
  return out.join("\n").trim();
}

// Extrai dados que o OPERADOR digitou no campo de texto livre.
// Regra central: só aceita valor com RÓTULO explícito ("CEP: 12345-678").
// Dígitos soltos nunca viram cadastro — uma data como 2026-07-20-17-57-13
// tem 8 e 14 dígitos e viraria CEP e CNPJ.
function extractManualOverrides(text: string): Record<string, string> {
  const raw = soTextoDigitado(text);
  const overrides: Record<string, string> = {};
  if (!raw) return overrides;

  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) overrides.email = email;

  // RG exige dígitos — "rg completo" não pode virar rg = "completo"
  const rg = raw.match(/\brg\s*(?:[:=\-]|n[ºo.]*)?\s*(\d[\d.\-]{4,17}[\dXx]?)/i)?.[1];
  if (rg && digitsOnly(rg).length >= 5) overrides.rg = digitsOnly(rg);

  const cep = raw.match(/\bcep\s*(?:[:=\-]|n[ºo.]*)?\s*(\d{5}[-.\s]?\d{3})/i)?.[1];
  if (cep && !digitsOnly(cep).startsWith("0000")) overrides.cep = digitsOnly(cep);

  // CNPJ só entra se o dígito verificador conferir
  const cnpj = raw.match(/\bcnpj\s*(?:[:=\-]|n[ºo.]*)?\s*([0-9.\-/]{14,22})/i)?.[1];
  if (cnpj && cnpjValido(cnpj)) overrides.cnpj = digitsOnly(cnpj);

  const cel = raw.match(/\b(?:celular|telefone|whatsapp|whats|fone)\s*(?:[:=\-])?\s*((?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4})/i)?.[1];
  if (cel) {
    const d = digitsOnly(cel).replace(/^55(?=\d{10,11}$)/, "");
    if ((d.length === 10 || d.length === 11) && Number(d.slice(0, 2)) >= 11) overrides.celular = d;
  }

  // Campos de vocabulário fechado: grava o TERMO reconhecido, nunca a linha inteira
  const n = normText(raw);
  const acha = (re: RegExp) => n.match(re)?.[0]?.toUpperCase() ?? null;
  const estadoCivil = acha(/\b(casado|casada|solteiro|solteira|divorciado|divorciada|viuvo|viuva|uniao estavel)\b/);
  if (estadoCivil) overrides.estado_civil = estadoCivil;
  const escolaridade = acha(/\b(ensino medio completo|ensino medio incompleto|ensino medio|superior completo|superior incompleto|superior|fundamental completo|fundamental incompleto|fundamental|pos-?graduacao)\b/);
  if (escolaridade) overrides.escolaridade = escolaridade;
  const profissao = acha(/\b(empresario|empresaria|mei|autonomo|autonoma|servidor publico|servidor|servidora|aposentado|aposentada|clt)\b/);
  if (profissao) overrides.profissao = profissao;

  return overrides;
}

async function lookupCepManual(cep: string): Promise<Record<string, string> | null> {
  const clean = digitsOnly(cep);
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      cep: `${clean.slice(0, 5)}-${clean.slice(5)}`,
      logradouro: data.street || "",
      bairro: data.neighborhood || "",
      cidade: data.city || "",
      estado: data.state || "",
      pais: "BRASIL",
    };
  } catch {
    return null;
  }
}

export default function Etapa2Leitura({ arquivos, setArquivos, textoPastaColado, onConcluido, onVoltar }: Props) {
  const [linhas, setLinhas] = useState<StatusLinha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const rodouRef = useRef(false);

  const atualizar = (i: number, patch: Partial<StatusLinha>) =>
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  useEffect(() => {
    if (rodouRef.current) return;
    rodouRef.current = true;
    executar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function executar() {
    const steps: StatusLinha[] = [
      { label: "Preparando arquivos", status: "pending" },
      { label: "Enviando para extração IA", status: "pending" },
      { label: "Processando campos", status: "pending" },
      { label: "Verificando senha GOV.BR", status: "pending" },
    ];
    setLinhas(steps);
    setErro(null);

    try {
      // Passo 0: preparar conteúdo
      atualizar(0, { status: "loading" });
      const parts: { tipo: string; mime: string; name: string; data_url: string }[] = [];
      for (const a of arquivos) {
        const b64 = await fileToBase64(a.file);
        const mime = a.file.type || "application/octet-stream";
        parts.push({
          tipo: a.tipo,
          mime,
          name: a.file.name,
          data_url: `data:${mime};base64,${b64}`,
        });
      }
      atualizar(0, { status: "ok" });

      // Passo 1: chamar qa-cliente-prefill
      atualizar(1, { status: "loading" });
      const body: Record<string, unknown> = { files: parts };
      if (textoPastaColado.trim()) body.text = textoPastaColado.trim();

      const { data, error } = await supabase.functions.invoke("qa-cliente-prefill", { body });
      if (error) throw new Error(error.message || "Erro na edge function");
      if (!data) throw new Error("Resposta vazia da IA");
      if (data.error) throw new Error(String(data.error));
      atualizar(1, { status: "ok" });

      // Passo 2: processar campos
      atualizar(2, { status: "loading" });
      // A edge function retorna { success, fields: { ...campos, confidence, warnings, senha_gov_raw } }
      const fields: Record<string, any> = data.fields || {};
      const confidenceMap: Record<string, number> = (fields.confidence && typeof fields.confidence === "object") ? fields.confidence : {};
      const warnings: string[] = Array.isArray(fields.warnings) ? fields.warnings : [];
      const senhaRaw: string | null = typeof fields.senha_gov_raw === "string" && fields.senha_gov_raw ? fields.senha_gov_raw : null;
      const senhaConfidence: number = typeof fields.senha_gov_confidence === "number" ? fields.senha_gov_confidence : 0;
      const senhaNeedsReview: boolean = fields.senha_gov_needs_review === true;

      // A IA classifica o conteúdo visual/textual. Quando vier em tipo canônico
      // e com confiança suficiente, aplicamos antes de gravar no Hub; a aprovação
      // final continua sendo do Hub/Equipe.
      const arquivosClassificados: Array<{
        indice?: number;
        nome_arquivo?: string;
        tipo_sugerido?: string;
        confianca?: number;
        motivo?: string;
      }> = Array.isArray((fields as any).arquivos_classificados) ? (fields as any).arquivos_classificados : [];
      if (arquivosClassificados.length > 0 && setArquivos) {
        const atualizados = arquivos.map((arq, i) => {
          const sug = arquivosClassificados.find(
            (s) => s.indice === i || s.nome_arquivo === arq.file.name,
          );
          if (!sug || !sug.tipo_sugerido) return arq;
          const tipoIA = sug.tipo_sugerido.trim().toLowerCase();
          if (!tipoIA) return arq;
          const confianca = typeof sug.confianca === "number" ? sug.confianca : 0;
          const meta = {
            tipo_ia_confianca: sug.confianca,
            tipo_ia_motivo: sug.motivo,
          };
          if (!TIPOS_CANONICOS_HUB.has(tipoIA)) {
            warnings.push(`Classificação ignorada: "${arq.file.name}" retornou tipo não canônico "${tipoIA}".`);
            return { ...arq, ...meta } as ArquivoUpload;
          }
          if (tipoIA !== arq.tipo) {
            if (confianca >= CONFIANCA_MINIMA_TIPO_IA || (arq.tipo === "outro" && confianca >= CONFIANCA_MINIMA_TIPO_IA_OUTRO)) {
              warnings.push(`Classificação aplicada: "${arq.file.name}" foi ajustado de "${arq.tipo}" para "${tipoIA}" antes de gravar no Hub Documental.`);
              return {
                ...arq,
                ...meta,
                tipo_original: arq.tipo_original ?? arq.tipo,
                tipo: tipoIA,
                tipo_aplicado_por_ia: true,
              } as ArquivoUpload;
            }
            warnings.push(`Classificação apenas sugerida: "${arq.file.name}" parece "${tipoIA}", mas ficou como "${arq.tipo}" por baixa confiança.`);
            return { ...arq, ...meta } as ArquivoUpload;
          }
          return { ...arq, ...meta } as ArquivoUpload;
        });
        setArquivos(atualizados);
      }

      // Chaves internas que não devem virar campos do formulário
      const IGNORAR = new Set([
        "confidence", "confidence_pairs", "warnings",
        "arquivos_classificados",
        "senha_gov_raw", "senha_gov_confidence", "senha_gov_needs_review",
        "emissor_rg_needs_review",
      ]);
      const campos: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (IGNORAR.has(k)) continue;
        if (v == null) continue;
        campos[k] = typeof v === "string" ? v : String(v);
      }
      // Aliases para bater com a lista de campos da Etapa 3
      if (campos.emissor_rg && !campos.rg_orgao_emissor) campos.rg_orgao_emissor = campos.emissor_rg;
      if (confidenceMap.emissor_rg != null && confidenceMap.rg_orgao_emissor == null) {
        confidenceMap.rg_orgao_emissor = confidenceMap.emissor_rg;
      }
      // Remove o duplicado da UI (rg_orgao_emissor fica; emissor_rg some da revisão)
      delete campos.emissor_rg;
      // endereco (retornado pela IA) ↔ logradouro (usado na Etapa 3) — evita campo duplicado
      if (campos.endereco && !campos.logradouro) campos.logradouro = campos.endereco;
      if (campos.logradouro && !campos.endereco) campos.endereco = campos.logradouro;
      if (confidenceMap.endereco != null && confidenceMap.logradouro == null) {
        confidenceMap.logradouro = confidenceMap.endereco;
      }
      // Remove o duplicado da UI (logradouro fica; endereco some da revisão)
      delete campos.endereco;
      // Normaliza sexo (M/F → Masculino/Feminino) para exibição amigável
      if (campos.sexo) {
        const s = campos.sexo.trim().toUpperCase();
        if (s === "M" || s === "MASC" || s === "MASCULINO") campos.sexo = "Masculino";
        else if (s === "F" || s === "FEM" || s === "FEMININO") campos.sexo = "Feminino";
      }
      if (senhaRaw) campos.senha_gov = senhaRaw;

      // Formata telefones brasileiros: "+55 (DD) 9XXXX-XXXX" ou "+55 (DD) XXXX-XXXX"
      const formatarTelefoneBR = (raw: string): string => {
        const d = raw.replace(/\D/g, "").replace(/^55/, "");
        if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
        if (d.length === 10) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
        return raw;
      };
      for (const campo of ["celular", "telefone_secundario", "telefone"]) {
        if (campos[campo]) campos[campo] = formatarTelefoneBR(campos[campo]!);
      }

      const manualOverrides = extractManualOverrides(soTextoDigitado(textoPastaColado));
      const camposManuais = Object.keys(manualOverrides);
      for (const [campo, valor] of Object.entries(manualOverrides)) {
        if (!valor) continue;
        const anterior = campos[campo];
        campos[campo] = campo === "celular" ? formatarTelefoneBR(valor) : valor;
        confidenceMap[campo] = 1;
        if (anterior && digitsOnly(anterior) !== digitsOnly(valor) && anterior.trim().toLowerCase() !== valor.trim().toLowerCase()) {
          warnings.push(`Dado manual prevaleceu sobre o documento: ${campo.toUpperCase()} informado no texto livre substituiu "${anterior}".`);
        }
      }

      if (manualOverrides.cep) {
        const cepData = await lookupCepManual(manualOverrides.cep);
        if (cepData) {
          for (const campo of ["cep", "logradouro", "bairro", "cidade", "estado", "pais"]) {
            if (cepData[campo]) {
              campos[campo] = cepData[campo].toUpperCase();
              confidenceMap[campo] = 1;
            }
          }
          warnings.push("CEP informado manualmente prevaleceu e o endereço foi atualizado pela consulta de CEP.");
        }
      }
      if (camposManuais.length > 0) {
        warnings.push(`Texto livre aplicado como fonte prioritária: ${camposManuais.map((c) => c.toUpperCase()).join(", ")}.`);
      }

      const confidencePairs = Object.entries(confidenceMap).map(([campo, confidence]) => ({
        campo,
        valor: campos[campo] ?? null,
        confidence: typeof confidence === "number" ? confidence : 0,
      }));
      atualizar(2, { status: "ok", detalhe: `${Object.keys(campos).length} campos extraídos` });

      // Passo 3: senha GOV.BR
      const senhaGovOk = !!senhaRaw && !senhaNeedsReview && senhaConfidence >= 0.75;
      const senhaGov = senhaRaw;
      atualizar(3, {
        status: senhaGov ? (senhaGovOk ? "ok" : "error") : "ok",
        detalhe: senhaGov
          ? senhaGovOk
            ? "Senha verificada com alta confiança"
            : "Senha com baixa confiança — revisar manualmente"
          : "Não encontrada nos documentos",
      });

      onConcluido({ campos, confidence_pairs: confidencePairs, warnings, senha_gov: senhaGov, senha_gov_ok: senhaGovOk });
    } catch (e: any) {
      setErro(e?.message || "Erro inesperado durante a extração");
      setLinhas((prev) => prev.map((l) => l.status === "loading" ? { ...l, status: "error" } : l));
    }
  }

  const concluido = linhas.length > 0 && linhas.every((l) => l.status === "ok" || l.status === "error");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 2 — Leitura por IA</h2>
        <p className="text-xs text-muted-foreground">
          Os documentos estão sendo processados pelo Gemini Vision para extração dos dados do cliente.
        </p>
      </div>

      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {l.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 mt-0.5 flex-shrink-0" />}
            {l.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-[#7B1C2E] mt-0.5 flex-shrink-0" />}
            {l.status === "ok" && <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
            {l.status === "error" && <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
            <div>
              <p className={`text-xs font-medium ${l.status === "loading" ? "text-[#7B1C2E]" : l.status === "error" ? "text-red-600" : ""}`}>
                {l.label}
              </p>
              {l.detalhe && <p className="text-[11px] text-muted-foreground">{l.detalhe}</p>}
            </div>
          </div>
        ))}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-xs text-red-700 font-medium">Erro na extração</p>
          <p className="text-xs text-red-600 mt-0.5">{erro}</p>
        </div>
      )}

      {erro && (
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onVoltar} className="text-xs gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Button>
          <Button size="sm" onClick={() => { rodouRef.current = false; executar(); }} className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {!concluido && !erro && (
        <p className="text-[11px] text-muted-foreground italic">Aguarde — isso pode levar alguns segundos...</p>
      )}
    </div>
  );
}
