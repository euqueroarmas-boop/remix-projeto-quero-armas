import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Package, ChevronRight, Image, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ArquivoUpload } from "./PrePilotoWizard";

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf", "application/zip"];
const TIPO_LABELS: Record<string, string> = {
  cin: "CIN/RG/CNH",
  comprovante_residencia: "Comprovante de Residência",
  laudo_psicologico: "Laudo Psicológico",
  laudo_capacidade_tecnica: "Laudo de Capacidade Técnica",
  antecedentes_criminais: "Antecedentes Criminais",
  comprovante_renda: "Comprovante de Renda",
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

export default function Etapa1Documentos({ arquivos, setArquivos, textoPastaColado, setTextoPastaColado, onAvancar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processandoZip, setProcessandoZip] = useState(false);

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
    if (combinados.length > 0) setArquivos([...arquivos, ...combinados]);
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
    const n = nome.toLowerCase();
    if (n.includes("rg") || n.includes("cin") || n.includes("identidade")) return "cin";
    if (n.includes("cpf")) return "cpf";
    if (n.includes("residencia") || n.includes("endereco") || n.includes("comprovante")) return "comprovante_residencia";
    if (n.includes("psico") || n.includes("laudo") || n.includes("psicolog")) return "laudo_psicologico";
    if (n.includes("tecn") || n.includes("capacidade")) return "laudo_capacidade_tecnica";
    if (n.includes("antecedente") || n.includes("criminal")) return "antecedentes_criminais";
    if (n.includes("renda") || n.includes("holerite") || n.includes("contracheque")) return "comprovante_renda";
    if (n.includes("gov") || n.includes("senha") || n.includes("govbr")) return "gov_br";
    return "outro";
  }

  const remover = (i: number) => {
    const copia = [...arquivos];
    if (copia[i].preview) URL.revokeObjectURL(copia[i].preview!);
    copia.splice(i, 1);
    setArquivos(copia);
  };

  const alterarTipo = (i: number, tipo: string) => {
    const copia = [...arquivos];
    copia[i] = { ...copia[i], tipo };
    setArquivos(copia);
  };

  const podeProsseguir = arquivos.length > 0 || textoPastaColado.trim().length > 50;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold mb-1">Etapa 1 — Envio de Documentos</h2>
        <p className="text-xs text-muted-foreground">
          Faça upload das fotos/PDFs dos documentos do cliente. Você também pode importar um ZIP de conversa do WhatsApp
          (exportação padrão do app) — as imagens serão extraídas automaticamente. Dados processados localmente, nada enviado antes de confirmar.
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
          <Label className="text-xs font-semibold">Arquivos selecionados ({arquivos.length})</Label>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {arquivos.map((a, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1.5">
                {a.preview ? (
                  <img src={a.preview} alt="" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                ) : (
                  <FileText className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-xs flex-1 truncate min-w-0">{a.file.name}</span>
                <select
                  value={a.tipo}
                  onChange={(e) => alterarTipo(i, e.target.value)}
                  className="text-xs border rounded px-1 py-0.5 bg-background max-w-[130px] flex-shrink-0"
                >
                  {Object.entries(TIPO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button onClick={() => remover(i)} className="text-muted-foreground hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
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
          Extrair com IA <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
