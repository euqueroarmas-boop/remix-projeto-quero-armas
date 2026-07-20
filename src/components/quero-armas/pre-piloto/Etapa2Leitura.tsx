import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArquivoUpload, DadosExtraidos } from "./PrePilotoWizard";

interface Props {
  arquivos: ArquivoUpload[];
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

export default function Etapa2Leitura({ arquivos, textoPastaColado, onConcluido, onVoltar }: Props) {
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
      const parts: { tipo: string; mime: string; data: string; nome: string }[] = [];
      for (const a of arquivos) {
        const b64 = await fileToBase64(a.file);
        parts.push({ tipo: a.tipo, mime: a.file.type, data: b64, nome: a.file.name });
      }
      atualizar(0, { status: "ok" });

      // Passo 1: chamar qa-cliente-prefill
      atualizar(1, { status: "loading" });
      const body: Record<string, unknown> = { arquivos: parts };
      if (textoPastaColado.trim()) body.texto_extra = textoPastaColado.trim();

      const { data, error } = await supabase.functions.invoke("qa-cliente-prefill", { body });
      if (error) throw new Error(error.message || "Erro na edge function");
      if (!data) throw new Error("Resposta vazia da IA");
      atualizar(1, { status: "ok" });

      // Passo 2: processar campos
      atualizar(2, { status: "loading" });
      const campos: Record<string, string | null> = data.campos || {};
      const confidencePairs: { campo: string; valor: string | null; confidence: number }[] = data.confidence_pairs || [];
      const warnings: string[] = data.warnings || [];
      atualizar(2, { status: "ok", detalhe: `${Object.keys(campos).length} campos extraídos` });

      // Passo 3: senha GOV.BR
      const senhaGovOk = data.senha_gov_ok === true;
      const senhaGov = data.senha_gov || null;
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
