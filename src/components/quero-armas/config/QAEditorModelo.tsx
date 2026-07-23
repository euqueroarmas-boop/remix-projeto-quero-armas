/**
 * QAEditorModelo — Motor de edição de modelos de documentos Quero Armas.
 *
 * Editor WYSIWYG com toggle Visual/HTML, toolbar de formatação (negrito,
 * itálico, alinhamento, H1/H2, listas) e seção de inserção rápida de
 * trechos predefinidos (placeholders, cláusulas, assinatura, etc.).
 *
 * Expõe um ref com getHtml() / setHtml() para o componente pai.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Heading1, Heading2, Type,
  List, ListOrdered,
  Code2,
} from "lucide-react";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export interface QAEditorInsert {
  label: string;   // texto curto no botão (≤5 chars)
  title: string;   // tooltip completo ao passar o mouse
  html: string;    // HTML inserido na posição do cursor
}

export interface QAEditorModeloRef {
  getHtml(): string;
  setHtml(html: string): void;
}

interface Props {
  initialHtml?: string;
  onChange?: (html: string) => void;
  inserts?: QAEditorInsert[];
  minHeight?: number;
  placeholder?: string;
  monoHtml?: boolean;  // textarea HTML usa fundo escuro/mono (padrão true)
}

// ── Subcomponentes de toolbar ───────────────────────────────────────────────

function TBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 transition-colors"
    >
      {children}
    </button>
  );
}

function TSep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 self-center" />;
}

// ── Componente principal ────────────────────────────────────────────────────

export const QAEditorModelo = forwardRef<QAEditorModeloRef, Props>(function QAEditorModelo(
  { initialHtml = "", onChange, inserts = [], minHeight = 360, placeholder, monoHtml = true },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [modo, setModo] = useState<"visual" | "html">("visual");
  const [htmlBruto, setHtmlBruto] = useState(initialHtml);
  const populadoRef = useRef(false);

  // Popula o editor na primeira montagem / quando o html inicial chega
  useEffect(() => {
    if (!populadoRef.current && initialHtml && editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      setHtmlBruto(initialHtml);
      populadoRef.current = true;
    }
  }, [initialHtml]);

  useImperativeHandle(ref, () => ({
    getHtml() {
      return modo === "html" ? htmlBruto : (editorRef.current?.innerHTML ?? "");
    },
    setHtml(html: string) {
      setHtmlBruto(html);
      if (editorRef.current) editorRef.current.innerHTML = html;
      onChange?.(html);
    },
  }));

  function syncHtml() {
    const html = editorRef.current?.innerHTML ?? "";
    onChange?.(html);
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    syncHtml();
  }

  function inserirHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncHtml();
  }

  function alternarModo(novoModo: "visual" | "html") {
    if (novoModo === modo) return;
    if (novoModo === "html") {
      const html = editorRef.current?.innerHTML ?? "";
      setHtmlBruto(html);
      onChange?.(html);
    } else {
      if (editorRef.current) editorRef.current.innerHTML = htmlBruto;
      onChange?.(htmlBruto);
    }
    setModo(novoModo);
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "hsl(220 15% 85%)" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-slate-50 px-1.5 py-1"
        style={{ borderColor: "hsl(220 15% 88%)" }}>

        {/* Toggle Visual / HTML */}
        <div className="flex mr-1">
          <button type="button" onClick={() => alternarModo("visual")}
            className={`h-6 px-2.5 text-[10px] rounded-l border font-semibold transition-colors
              ${modo === "visual" ? "bg-[#7B1C2E] text-white border-[#7B1C2E]" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-100"}`}>
            Visual
          </button>
          <button type="button" onClick={() => alternarModo("html")}
            className={`h-6 px-2 text-[10px] rounded-r border-t border-r border-b font-semibold flex items-center gap-0.5 transition-colors
              ${modo === "html" ? "bg-[#7B1C2E] text-white border-[#7B1C2E]" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-100"}`}>
            <Code2 className="w-2.5 h-2.5" /> HTML
          </button>
        </div>

        {modo === "visual" && (
          <>
            <TSep />
            {/* Texto */}
            <TBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><Bold className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><Italic className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><Underline className="w-3 h-3" /></TBtn>
            <TSep />
            {/* Alinhamento */}
            <TBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda"><AlignLeft className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyCenter")} title="Centralizar"><AlignCenter className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyRight")} title="Alinhar à direita"><AlignRight className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyFull")} title="Justificar"><AlignJustify className="w-3 h-3" /></TBtn>
            <TSep />
            {/* Títulos */}
            <TBtn onClick={() => exec("formatBlock", "h1")} title="Título principal (H1)"><Heading1 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "h2")} title="Subtítulo / Seção (H2)"><Heading2 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "p")} title="Parágrafo normal"><Type className="w-3 h-3" /></TBtn>
            <TSep />
            {/* Listas */}
            <TBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="w-3 h-3" /></TBtn>

            {/* Inserção rápida de trechos */}
            {inserts.length > 0 && (
              <>
                <TSep />
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide px-0.5 select-none">
                  inserir
                </span>
                {inserts.map((ins, i) => (
                  <button
                    key={i}
                    type="button"
                    title={ins.title}
                    onMouseDown={(e) => { e.preventDefault(); inserirHtml(ins.html); }}
                    className="h-6 px-1.5 text-[10px] rounded border border-slate-200 bg-white text-slate-600
                      hover:bg-slate-100 hover:border-slate-300 transition-colors font-medium whitespace-nowrap"
                  >
                    {ins.label}
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {modo === "html" && (
          <span className="text-[10px] text-slate-400 px-1">
            Cole ou edite o HTML. Mude para <b className="text-slate-600">Visual</b> para renderizar.
          </span>
        )}
      </div>

      {/* ── Área de edição visual (contentEditable) ─────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHtml}
        data-placeholder={placeholder}
        className="w-full focus:outline-none bg-white qa-editor-modelo"
        style={{
          display: modo === "visual" ? "block" : "none",
          minHeight,
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#1a1a1a",
          fontSize: "14px",
          lineHeight: "1.8",
          padding: "20px 24px",
          textAlign: "justify",
        }}
      />

      {/* ── Área de edição HTML bruto ────────────────────────────────────── */}
      {modo === "html" && (
        <textarea
          value={htmlBruto}
          onChange={(e) => {
            setHtmlBruto(e.target.value);
            onChange?.(e.target.value);
          }}
          placeholder={placeholder ?? "Cole ou edite o HTML aqui."}
          rows={18}
          className="w-full focus:outline-none resize-y text-[12px] font-mono"
          style={{
            minHeight,
            padding: "16px 20px",
            background: monoHtml ? "#0d1117" : "#fff",
            color: monoHtml ? "#7ee787" : "#1a1a1a",
            borderColor: "transparent",
          }}
          spellCheck={false}
        />
      )}

      {/* Estilos do editor visual */}
      <style>{`
        .qa-editor-modelo:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          font-style: italic;
        }
        .qa-editor-modelo h1 {
          text-align: center; font-size: 15px; line-height: 1.35;
          margin: 0 0 18px; text-transform: uppercase; font-weight: bold;
        }
        .qa-editor-modelo h2 {
          font-size: 13px; margin: 18px 0 8px;
          text-align: center; text-transform: uppercase; font-weight: bold;
        }
        .qa-editor-modelo h3 {
          font-size: 13px; margin: 14px 0 6px; font-weight: bold;
        }
        .qa-editor-modelo p { margin: 0 0 12px; }
        .qa-editor-modelo ol { margin: 10px 0 14px 22px; }
        .qa-editor-modelo ul { margin: 8px 0 10px 18px; }
        .qa-editor-modelo li { margin-bottom: 8px; }
        .qa-editor-modelo .qa-procuracao__letterhead {
          margin: 0 0 24px; font-family: Arial, sans-serif;
          font-size: 11px; line-height: 1.45; text-align: right;
        }
        .qa-editor-modelo .qa-doc__signature {
          margin-top: 36px; text-align: center;
        }
        .qa-editor-modelo .qa-doc__signature:before {
          content: ""; display: block; width: 280px; max-width: 80%;
          border-top: 1px solid #111; margin: 0 auto 8px;
        }
        .qa-editor-modelo .qa-doc__signature span,
        .qa-editor-modelo .qa-doc__signature small { display: block; }
        .qa-editor-modelo:focus { outline: none; }
      `}</style>
    </div>
  );
});
