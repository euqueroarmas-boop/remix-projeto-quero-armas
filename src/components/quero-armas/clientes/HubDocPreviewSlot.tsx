/**
 * HubDocPreviewSlot — slot central R43 do modal Adicionar Documento.
 *
 * 3 estados:
 *  - sem file → dropzone branco com filete tracejado (mantém handlers)
 *  - file imagem → <img> centralizado
 *  - file PDF → react-pdf 1ª página com tamanho contido
 *
 * Barras verticais Oswald nas laterais + Stamp98% bordô rotacionado quando há classificação.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Camera, FileText, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Worker via CDN para evitar config Vite específica
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BORDO = "#7A1F2B";
const INK3 = "#7A7A7A";

interface Props {
  file: File | null;
  confianca: number | null; // 0..1
  fileNameDisplay?: string;
  onPickFile: () => void;
  onPickCamera: () => void;
  onRemove: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  dragOver: boolean;
  extracting: boolean;
  incorreta?: boolean;
}

export default function HubDocPreviewSlot({
  file,
  confianca,
  fileNameDisplay,
  onPickFile,
  onPickCamera,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  extracting,
  incorreta = false,
}: Props) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [slotW, setSlotW] = useState<number>(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    if (!slotRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSlotW(cr.width);
    });
    ro.observe(slotRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setNumPages(null);
    setPageLoaded(false);
  }, [file]);

  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const isImage = !!file && file.type.startsWith("image/");
  const isPdf = !!file && file.type === "application/pdf";
  const displayName = fileNameDisplay || file?.name || "arquivo";
  const pct = confianca != null ? Math.round(confianca * 100) : null;
  const RED = "#B91C1C";

  return (
    <div className="relative isolate flex h-full w-full flex-col">
      {/* Barra vertical esquerda */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-5 items-center justify-center md:flex">
        <div
          className="font-heading uppercase"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: 9.5,
            letterSpacing: ".34em",
            color: INK3,
            fontWeight: 600,
          }}
        >
          {file ? `EVIDÊNCIA · ${displayName.toUpperCase()}` : "EVIDÊNCIA · AGUARDANDO ARQUIVO"}
        </div>
      </div>

      {/* Barra vertical direita */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-5 items-center justify-center md:flex">
        <div
          className="font-heading uppercase"
          style={{
            writingMode: "vertical-rl",
            fontSize: 9.5,
            letterSpacing: ".34em",
            color: pct != null ? BORDO : INK3,
            fontWeight: 700,
          }}
        >
          {pct != null ? `IA · ${pct}% · ACIMA DO LIMIAR 85%` : "IA · AGUARDANDO LEITURA"}
        </div>
      </div>

      {/* Slot central */}
      <div
        ref={slotRef}
        className="relative mx-auto flex w-full max-w-[760px] flex-1 flex-col md:mx-[28px] md:w-[calc(100%-56px)]"
      >
        {!file ? (
          <div
            onClick={onPickFile}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "flex min-h-[320px] flex-1 cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed bg-[#FAFAFA] p-8 text-center transition-all",
              dragOver ? "border-[#7A1F2B] bg-[#7A1F2B]/[0.04]" : "border-[#E5E5E5] hover:border-[#7A1F2B]/60 hover:bg-[#7A1F2B]/[0.02]",
            )}
            style={{ borderRadius: 2 }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "rgba(122,31,43,0.08)", color: BORDO }}
            >
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <div className="font-heading text-[13px] font-bold uppercase tracking-[0.24em] text-[#0A0A0A]">
                Anexe o arquivo
              </div>
              <div className="mt-1 text-xs text-[#7A7A7A]">JPG · PNG · PDF · até 20MB</div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-[#A0A0A0]">Toque ou arraste aqui</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPickCamera(); }}
              className="mt-2 inline-flex items-center gap-2 border border-[#0A0A0A] bg-white px-4 py-2 font-heading text-[11px] font-bold uppercase tracking-[0.22em] text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white"
              style={{ borderRadius: 2 }}
            >
              <Camera className="h-3.5 w-3.5" /> Tirar foto
            </button>
          </div>
        ) : (
          <div
            className="relative isolate flex min-h-[360px] flex-1 items-start justify-center overflow-auto border border-[#E5E5E5] bg-[#F4F4F2] p-3 shadow-inner"
            style={{ borderRadius: 2 }}
          >
            {/* Remover — botão vermelho, sempre acima da prévia */}
            <button
              type="button"
              onClick={onRemove}
              className="sticky top-0 z-40 ml-auto flex h-9 w-9 shrink-0 items-center justify-center border-2 border-[#DC2626] bg-white text-[#DC2626] shadow-md transition-colors hover:bg-[#DC2626] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40"
              style={{ borderRadius: 4, position: "absolute", right: 8, top: 8 }}
              aria-label="Excluir arquivo"
              title="Excluir arquivo"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.4} />
            </button>

            {isImage && fileUrl && (
              <img
                src={fileUrl}
                alt={displayName}
                className="relative z-0 max-h-[620px] w-auto max-w-full object-contain shadow-sm"
              />
            )}

            {isPdf && fileUrl && (
              <div className="relative z-0">
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={() => setNumPages(0)}
                loading={
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-[#7A7A7A]">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-heading text-[10px] uppercase tracking-[0.22em]">Carregando PDF…</span>
                  </div>
                }
                error={
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-[#7A1F2B]">
                    <FileText className="h-7 w-7" />
                    <span className="font-heading text-[10px] uppercase tracking-[0.22em]">Preview indisponível</span>
                    <span className="text-[11px] text-[#7A7A7A]">{displayName}</span>
                  </div>
                }
              >
                {slotW > 0 && (
                  <Page
                    pageNumber={1}
                    width={Math.min(slotW - 24, 640)}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onRenderSuccess={() => setPageLoaded(true)}
                  />
                )}
              </Document>
              </div>
            )}

            {!isImage && !isPdf && (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 text-[#7A7A7A]">
                <FileText className="h-7 w-7" />
                <span className="font-heading text-[10px] uppercase tracking-[0.22em]">Arquivo anexado</span>
                <span className="text-[11px]">{displayName}</span>
              </div>
            )}

            {/* Carimbo IA · APROVADO */}
            {pct != null && !incorreta && (
              <div
                className="pointer-events-none absolute z-30"
                style={{
                  top: 18,
                  right: -10,
                  transform: "rotate(-8deg)",
                  border: `5px solid ${BORDO}`,
                  padding: "8px 16px 4px",
                  background: "rgba(255,255,255,.92)",
                  borderRadius: 4,
                  color: BORDO,
                  fontFamily: "'Oswald', sans-serif",
                  boxShadow: "0 6px 18px rgba(122,31,43,.25)",
                }}
              >
                <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 0.9, letterSpacing: "-.02em" }}>{pct}%</div>
                <div style={{ fontSize: 9, letterSpacing: ".3em", textAlign: "center", marginTop: 2 }}>
                  IA · APROVADO
                </div>
              </div>
            )}

            {/* Carimbo CERTIDÃO INCORRETA */}
            {incorreta && (
              <div
                className="pointer-events-none absolute z-40"
                style={{
                  top: "42%",
                  left: "50%",
                  transform: "translate(-50%,-50%) rotate(-14deg)",
                  border: `6px solid ${RED}`,
                  padding: "10px 22px 6px",
                  background: "rgba(255,255,255,.90)",
                  borderRadius: 6,
                  color: RED,
                  fontFamily: "'Oswald', sans-serif",
                  boxShadow: "0 8px 22px rgba(185,28,28,.28)",
                }}
              >
                <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 0.95, letterSpacing: ".04em", textAlign: "center" }}>
                  CERTIDÃO
                </div>
                <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 0.95, letterSpacing: ".04em", textAlign: "center" }}>
                  INCORRETA
                </div>
                <div style={{ fontSize: 10, letterSpacing: ".3em", textAlign: "center", marginTop: 4 }}>
                  NÃO PODE SER SALVA
                </div>
              </div>
            )}

            {extracting && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-white/85 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-[#7A1F2B]" />
                <span className="font-heading text-[10px] uppercase tracking-[0.24em] text-[#0A0A0A]">
                  Lendo o documento…
                </span>
              </div>
            )}

            {/* Legenda inferior do arquivo */}
            <div
              className="pointer-events-none absolute bottom-2 left-3 z-30 rounded-sm bg-white/85 px-1.5 py-0.5 font-heading uppercase backdrop-blur-sm"
              style={{ fontSize: 9, letterSpacing: ".22em", color: "#4A4A4A" }}
            >
              {displayName} · {file ? `${(file.size / 1024).toFixed(0)} KB` : ""}
              {isPdf && numPages ? ` · pg 1/${numPages}` : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}