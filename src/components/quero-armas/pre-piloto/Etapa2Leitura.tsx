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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
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

      // Aplica classificação da IA sobre os arquivos (por índice/nome).
      // Só sobrescreve se: (a) tipo atual for "outro"/"cin" (fallback do
      // regex de nome), OU (b) confiança da IA ≥ 0.85. Preserva escolha
      // manual explícita do admin em Etapa 1.
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
          const tipoIA = sug.tipo_sugerido.trim();
          if (!tipoIA || tipoIA === arq.tipo) return arq;
          const admDefiniuManual = arq.tipo !== "outro" && (sug.confianca ?? 0) < 0.85;
          if (admDefiniuManual) return arq;
          return { ...arq, tipo: tipoIA, tipo_ia_confianca: sug.confianca, tipo_ia_motivo: sug.motivo } as ArquivoUpload;
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
