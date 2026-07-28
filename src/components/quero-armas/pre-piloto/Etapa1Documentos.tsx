import { useRef, useState } from "react";
import { Upload, FileText, Trash2, ChevronRight, Sparkles, Loader2, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ArquivoUpload } from "./PrePilotoWizard";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf", "application/zip"];
const TIPO_LABELS: Record<string, string> = {
  cin: "CIN/RG/CNH",
  comprovante_residencia: "Comprovante de Residência",
  laudo_psicologico: "Laudo Psicológico",
  laudo_capacidade_tecnica: "Laudo de Capacidade Técnica",
  antecedentes_criminais: "Antecedentes Criminais",
  certidao_antecedentes_criminais_federal: "Antecedentes Federais",
  comprovante_pagamento: "Comprovante de Pagamento",
  ocupacao_licita: "Ocupação Lícita",
  comprovante_renda: "Comprovante de Renda",
  cartao_cnpj_mei: "CNPJ / MEI",
  craf: "CRAF / SINARM",
  gte: "GTE / GT",
  nota_fiscal_arma: "Nota Fiscal de Arma",
  gov_br: "Print/Foto GOV.BR (senha)",
  outro: "Outro",
};

interface Props {
  arquivos: ArquivoUpload[];
  setArquivos: (a: ArquivoUpload[]) => void;
  textoPastaColado: string;
  setTextoPastaColado: (t: string) => void;
  onAvancar: () => void;
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

// Redimensiona imagens para no máximo 1024px e qualidade 0.75
// para manter o payload dentro do limite de 5MB da edge function.
function resizeImageToDataUrl(f: File, maxPx = 1024, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!f.type.startsWith("image/")) {
      fileToDataUrl(f).then(resolve);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(String(e.target?.result || "")); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(String(e.target?.result || ""));
      img.src = String(e.target?.result || "");
    };
    reader.onerror = () => fileToDataUrl(f).then(resolve);
    reader.readAsDataURL(f);
  });
}

function BadgeConfianca({ confianca, classifying }: { confianca?: number; classifying?: boolean }) {
  if (classifying) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }
  if (confianca == null) return null;
  if (confianca >= 0.85) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 flex-shrink-0" title={`IA: ${Math.round(confianca * 100)}% de confiança`}>
        <CheckCircle2 className="w-3 h-3" />
        <span className="hidden sm:inline">{Math.round(confianca * 100)}%</span>
      </span>
    );
  }
  if (confianca >= 0.60) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-amber-500 flex-shrink-0" title={`IA: ${Math.round(confianca * 100)}% de confiança — verifique o tipo`}>
        <AlertTriangle className="w-3 h-3" />
        <span className="hidden sm:inline">{Math.round(confianca * 100)}%</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-slate-400 flex-shrink-0" title={`IA com baixa confiança (${Math.round(confianca * 100)}%) — classifique manualmente`}>
      <HelpCircle className="w-3 h-3" />
      <span className="hidden sm:inline">{Math.round(confianca * 100)}%</span>
    </span>
  );
}

export default function Etapa1Documentos({ arquivos, setArquivos, textoPastaColado, setTextoPastaColado, onAvancar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref de cancelamento: incrementado a cada nova classificação; a função verifica se ainda é válido
  const classificacaoTokenRef = useRef(0);
  const [processandoZip, setProcessandoZip] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [previewItem, setPreviewItem] = useState<{ url: string; tipo: string; nome: string } | null>(null);
  // Índices dos arquivos que ainda estão sendo classificados pela IA
  const [classificandoIdx, setClassificandoIdx] = useState<Set<number>>(new Set());

  function abrirPreview(a: ArquivoUpload) {
    if (a.file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreviewItem({ url: dataUrl, tipo: a.file.type, nome: a.file.name });
      };
      reader.readAsDataURL(a.file);
    } else {
      const url = a.preview ?? URL.createObjectURL(a.file);
      setPreviewItem({ url, tipo: a.file.type, nome: a.file.name });
    }
  }

  // Chama a edge function para classificar os arquivos com IA.
  // Processa em lotes de 5 para não ultrapassar o limite de ~5MB da edge function.
  async function classificarComIA(novos: ArquivoUpload[], offsetIdx: number) {
    if (novos.length === 0) return;

    // Token desta sessão de classificação — se o usuário excluir arquivos durante o processo,
    // cancelRef será incrementado e este token ficará obsoleto, abortando a atualização.
    classificacaoTokenRef.current += 1;
    const meuToken = classificacaoTokenRef.current;
    const cancelado = () => classificacaoTokenRef.current !== meuToken;

    const idxSet = new Set(novos.map((_, i) => offsetIdx + i));
    setClassificandoIdx((prev) => new Set([...prev, ...idxSet]));
    setClassificando(true);

    const LOTE = 5;
    const todosResultados: any[] = new Array(novos.length).fill(null);

    try {
      for (let i = 0; i < novos.length; i += LOTE) {
        if (cancelado()) return; // abortado pelo usuário

        const fatia = novos.slice(i, i + LOTE);

        const payload = await Promise.all(
          fatia.map(async (a) => {
            const isPdf = a.file.type === "application/pdf";
            return {
              nome: a.file.name,
              mime: isPdf ? "application/pdf" : "image/jpeg",
              data_url: isPdf
                ? await fileToDataUrl(a.file)
                : await resizeImageToDataUrl(a.file),
            };
          })
        );

        if (cancelado()) return; // abortado enquanto preparava payload

        const { data, error } = await supabase.functions.invoke("qa-extract-documents", {
          body: { mode: "classify", arquivos: payload },
        });

        if (cancelado()) return; // abortado enquanto aguardava resposta da IA

        if (error) throw error;

        const loteResultados: any[] = data?.resultados ?? [];
        loteResultados.forEach((r, j) => { todosResultados[i + j] = r; });
      }

      if (cancelado()) return; // abortado após último lote

      // Usa forma funcional para ler o estado atual (não o snapshot capturado no início)
      // e só atualiza arquivos que ainda existem na lista
      setArquivos((prev) => {
        const nomeNovos = new Set(novos.map((a) => a.file.name));
        return prev.map((a) => {
          if (!nomeNovos.has(a.file.name)) return a; // não era um dos arquivos desta sessão
          const localIdx = novos.findIndex((n) => n.file.name === a.file.name);
          if (localIdx < 0) return a;
          const r = todosResultados[localIdx];
          if (!r || r.erro) return a;
          return {
            ...a,
            tipo: r.tipo_detectado ?? a.tipo,
            tipo_ia_confianca: r.confianca,
            tipo_ia_motivo: r.motivo,
          };
        });
      });

      const altaConfianca = todosResultados.filter((r) => r?.confianca >= 0.85).length;
      const baixaConfianca = todosResultados.filter((r) => r && !r.erro && r.confianca < 0.60).length;

      if (altaConfianca > 0) toast.success(`IA classificou ${altaConfianca} documento(s) automaticamente`);
      if (baixaConfianca > 0) toast.warning(`${baixaConfianca} documento(s) com baixa confiança — verifique o tipo manualmente`);
    } catch (e: any) {
      if (cancelado()) return;
      const msg = e?.message || e?.error_description || JSON.stringify(e) || "erro desconhecido";
      console.error("[classificarComIA]", e);
      toast.error(`IA: ${msg.slice(0, 120)}`);
    } finally {
      if (!cancelado()) {
        setClassificandoIdx(new Set());
        setClassificando(false);
      }
    }
  }

  const adicionarArquivos = async (files: FileList | File[]) => {
    const lista = Array.from(files);
    const novosNaoZip: ArquivoUpload[] = [];
    const novosDoZip: ArquivoUpload[] = [];
    let textoAcumuladoZip = "";
    const nomesFonteZip: string[] = [];

    for (const f of lista) {
      if (f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")) {
        const { arquivos: extraidos, texto } = await processarZip(f);
        novosDoZip.push(...extraidos);
        if (texto) textoAcumuladoZip += (textoAcumuladoZip ? "\n\n" : "") + texto;
        nomesFonteZip.push(f.name);
        continue;
      }
      if (!TIPOS_ACEITOS.includes(f.type)) {
        toast.warning(`Arquivo ignorado: ${f.name} (tipo não suportado)`);
        continue;
      }
      novosNaoZip.push({ file: f, tipo: inferirTipo(f.name), preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
    }

    const combinados = [...novosNaoZip, ...novosDoZip];

    if (combinados.length > 0) {
      // Adiciona imediatamente com classificação por nome (feedback visual rápido)
      setArquivos([...arquivos, ...combinados]);

      // Em seguida classifica com IA em background
      classificarComIA(combinados, arquivos.length);
    }

    if (textoAcumuladoZip || nomesFonteZip.length > 0 || combinados.length > 0) {
      const listaNomes = [
        ...nomesFonteZip,
        ...combinados.map((c) => c.file.name),
      ].filter(Boolean);
      const blocoNomes = listaNomes.length > 0
        ? `=== NOMES DE ARQUIVO (podem conter telefone/e-mail/nome) ===\n${listaNomes.join("\n")}`
        : "";
      const merged = textoPastaColado
        ? [textoPastaColado, blocoNomes, textoAcumuladoZip ? `=== CONVERSA WHATSAPP (ZIP) ===\n${textoAcumuladoZip}` : ""].filter(Boolean).join("\n\n")
        : [blocoNomes, textoAcumuladoZip ? `=== CONVERSA WHATSAPP (ZIP) ===\n${textoAcumuladoZip}` : ""].filter(Boolean).join("\n\n");
      setTextoPastaColado(merged);
      if (textoAcumuladoZip) toast.success("Texto da conversa do WhatsApp adicionado para extração");
    }
  };

  const processarZip = async (zipFile: File): Promise<{ arquivos: ArquivoUpload[]; texto: string }> => {
    setProcessandoZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(zipFile);
      const novos: ArquivoUpload[] = [];
      let textoConversa = "";

      for (const [nome, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const ext = nome.split(".").pop()?.toLowerCase() ?? "";
        if (ext === "txt") {
          try {
            const txt = await entry.async("string");
            if (txt && txt.trim()) {
              textoConversa += (textoConversa ? "\n\n" : "") + txt.slice(0, 60000);
            }
          } catch { /* ignore */ }
          continue;
        }
        if (!["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) continue;

        const blob = await entry.async("blob");
        const mime = ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`;
        const file = new File([blob], nome.split("/").pop() || nome, { type: mime });
        novos.push({
          file,
          tipo: inferirTipo(file.name),
          preview: mime.startsWith("image/") ? URL.createObjectURL(blob) : undefined,
        });
      }

      if (novos.length === 0 && !textoConversa) {
        toast.warning("ZIP não continha imagens, PDFs ou conversa reconhecível.");
      } else if (novos.length > 0) {
        toast.success(`${novos.length} arquivo(s) extraído(s) do ZIP`);
      }
      return { arquivos: novos, texto: textoConversa };
    } catch {
      toast.error("Erro ao processar ZIP. Verifique se o arquivo não está corrompido.");
      return { arquivos: [], texto: "" };
    } finally {
      setProcessandoZip(false);
    }
  };

  function inferirTipo(nome: string): string {
    const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    // Identidade
    if (n.includes("cnh") || n.includes("habilitacao") || n.includes("motorista")) return "cin";
    if (n.includes("cin") || n.includes("identidade") || n.includes("passaporte")) return "cin";
    if (n.match(/\brg\b/) || n.includes("registro geral")) return "cin";
    // Antecedentes
    if (n.includes("crimes-eleitorais") || n.includes("eleitoral") || n.includes("tse") || n.includes("federal")) return "certidao_antecedentes_criminais_federal";
    if (n.includes("antecedente") || n.includes("criminal") || n.includes("certidaocriminal") || n.includes("nada consta") || n.includes("tjsp") || n.includes("tjmsp") || n.includes("tjrj")) return "antecedentes_criminais";
    // Laudos
    if (n.includes("psico") || n.includes("psicolog")) return "laudo_psicologico";
    if (n.includes("tecn") || n.includes("capacidade") || n.includes("tiro")) return "laudo_capacidade_tecnica";
    // Comprovante de pagamento
    if (n.includes("pix") || n.includes("transferencia") || n.includes("ted") || n.includes("doc") || n.includes("recibo")) return "comprovante_pagamento";
    // Ocupação lícita
    if (
      n.includes("holerite") || n.includes("contracheque") || n.includes("decore") ||
      n.includes("ctps") || n.includes("cnis") || n.includes("contrato social") ||
      n.includes("requerimento") || n.includes("qsa") || n.includes("ccmei") ||
      n.includes("cnpj") || n.includes("mei") || n.includes("servico") || n.includes("servicos")
    ) return "ocupacao_licita";
    // Comprovante de residência — "comprovante" e "fatura" genéricos só depois das anteriores
    if (
      n.includes("residencia") || n.includes("endereco") ||
      n.includes("edp") || n.includes("enel") || n.includes("cpfl") || n.includes("light") ||
      n.includes("eletropaulo") || n.includes("energisa") || n.includes("sabesp") ||
      n.includes("sanasa") || n.includes("saneamento") || n.includes("comgas") || n.includes("gasmig") ||
      n.includes("vivo") || n.includes("claro") || n.includes("tim") || n.includes("oi") ||
      n.includes("net") || n.includes("telefonica") || n.includes("iptu")
    ) return "comprovante_residencia";
    if (n.includes("renda")) return "comprovante_renda";
    if (n.includes("craf") || n.includes("sinarm")) return "craf";
    if (n.includes("gte")) return "gte";
    if (n.includes("nota fiscal") || n.includes("nfe") || n.includes("nota_fiscal")) return "nota_fiscal_arma";
    if (n.includes("gov") || n.includes("senha") || n.includes("govbr")) return "gov_br";
    return "outro";
  }

  const remover = (i: number) => {
    // Cancela qualquer classificação em andamento — token muda, função detecta e para
    classificacaoTokenRef.current += 1;
    setClassificando(false);
    setClassificandoIdx(new Set());
    const copia = [...arquivos];
    if (copia[i].preview) URL.revokeObjectURL(copia[i].preview!);
    copia.splice(i, 1);
    setArquivos(copia);
  };

  const alterarTipo = (i: number, tipo: string) => {
    const copia = [...arquivos];
    // Ao corrigir manualmente, zera a confiança da IA (indicando intervenção humana)
    copia[i] = { ...copia[i], tipo, tipo_ia_confianca: undefined, tipo_ia_motivo: undefined };
    setArquivos(copia);
  };

  const podeProsseguir = (arquivos.length > 0 || textoPastaColado.trim().length > 50) && !classificando;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 1 — Envio de Documentos</h2>
        <p className="text-xs text-muted-foreground">
          Faça upload das fotos/PDFs dos documentos do cliente. Você também pode importar um ZIP de conversa do WhatsApp
          (exportação padrão do app) — as imagens serão extraídas e <strong>classificadas automaticamente pela IA</strong>.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-[#7B1C2E]/40 hover:bg-[#7B1C2E]/5 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); adicionarArquivos(e.dataTransfer.files); }}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          Clique ou arraste arquivos aqui
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WEBP, PDF, ou ZIP do WhatsApp
        </p>
        {processandoZip && <p className="text-xs text-[#7B1C2E] mt-2 animate-pulse">Extraindo ZIP...</p>}
        {classificando && !processandoZip && (
          <p className="text-xs text-[#7B1C2E] mt-2 animate-pulse flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" /> IA classificando documentos...
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,.zip"
        onChange={(e) => e.target.files && adicionarArquivos(e.target.files)}
      />

      {/* Lista de arquivos */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Arquivos selecionados ({arquivos.length})</Label>
            {classificando && (
              <span className="text-[10px] text-[#7B1C2E] flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" /> Classificando com IA...
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {arquivos.map((a, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5">
                {/* Thumbnail / ícone clicável */}
                <button type="button" onClick={() => abrirPreview(a)} title="Ver arquivo" className="flex-shrink-0 focus:outline-none">
                  {a.preview ? (
                    <img src={a.preview} alt="" className="w-8 h-8 object-cover rounded hover:opacity-80 transition" />
                  ) : (
                    <FileText className="w-6 h-6 text-muted-foreground hover:text-slate-700 transition" />
                  )}
                </button>

                {/* Nome do arquivo */}
                <span className="text-xs flex-1 truncate min-w-0" title={a.file.name}>{a.file.name}</span>

                {/* Badge de confiança da IA */}
                <BadgeConfianca
                  confianca={a.tipo_ia_confianca}
                  classifying={classificandoIdx.has(i)}
                />

                {/* Dropdown de tipo — pré-preenchido pela IA, editável */}
                <select
                  value={a.tipo}
                  onChange={(e) => alterarTipo(i, e.target.value)}
                  title={a.tipo_ia_motivo || undefined}
                  className={`text-xs border rounded px-1 py-0.5 bg-background max-w-[130px] flex-shrink-0 ${
                    a.tipo_ia_confianca != null && a.tipo_ia_confianca < 0.60
                      ? "border-amber-400"
                      : a.tipo_ia_confianca != null && a.tipo_ia_confianca >= 0.85
                      ? "border-emerald-400"
                      : ""
                  }`}
                >
                  {Object.entries(TIPO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                {/* Botão remover */}
                <button onClick={() => remover(i)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Legenda dos badges */}
          {arquivos.some((a) => a.tipo_ia_confianca != null) && (
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
              <span className="flex items-center gap-0.5 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Alta confiança</span>
              <span className="flex items-center gap-0.5 text-amber-500"><AlertTriangle className="w-3 h-3" /> Verifique</span>
              <span className="flex items-center gap-0.5"><HelpCircle className="w-3 h-3" /> Classifique manualmente</span>
            </div>
          )}
        </div>
      )}

      {/* Texto colado (histórico WhatsApp, email, etc.) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Texto adicional (opcional)</Label>
        <p className="text-[11px] text-muted-foreground">
          Cole aqui transcrições, histórico de conversa ou qualquer texto com dados do cliente.
        </p>
        <Textarea
          placeholder="Exemplo: mensagens do WhatsApp, e-mail com dados, formulário preenchido..."
          value={textoPastaColado}
          onChange={(e) => setTextoPastaColado(e.target.value)}
          className="text-xs min-h-[100px] resize-none"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={onAvancar}
          disabled={!podeProsseguir}
          className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1"
        >
          {classificando ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguardando IA...</>
          ) : (
            <>Extrair com IA <ChevronRight className="w-3.5 h-3.5" /></>
          )}
        </Button>
      </div>

      {/* Modal de preview do arquivo */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl overflow-hidden max-w-[90vw] max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b bg-slate-50">
              <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[60vw]">{previewItem.nome}</span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none font-bold"
              >✕</button>
            </div>
            <div className="flex-1 overflow-auto">
              {previewItem.tipo.startsWith("image/") ? (
                <img src={previewItem.url} alt={previewItem.nome} className="max-w-full max-h-[80vh] object-contain" />
              ) : previewItem.tipo === "application/pdf" ? (
                <embed src={previewItem.url} type="application/pdf" style={{ width: "80vw", height: "80vh" }} />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-slate-500">
                  <FileText className="w-12 h-12" />
                  <span className="text-sm">Preview não disponível para este tipo de arquivo.</span>
                  <button
                    type="button"
                    onClick={() => window.open(previewItem.url, "_blank")}
                    className="text-[11px] font-semibold text-[#7A1F2B] underline hover:opacity-80"
                  >
                    Abrir em nova aba →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
