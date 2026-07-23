/**
 * QAEditorModelo — Motor de edição de modelos de documentos Quero Armas.
 *
 * Editor WYSIWYG (Visual) + editor de código com syntax highlighting (HTML).
 * Toggle Visual/HTML integrado na toolbar. Expõe ref com getHtml()/setHtml().
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
  label: string;
  title: string;
  html: string;
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
}

// ── Syntax Highlighting ────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightHtml(raw: string): string {
  // Escape first, then wrap token classes (order matters)
  let s = esc(raw);

  // HTML comments
  s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>');

  // Doctype
  s = s.replace(/(&lt;!DOCTYPE[^&]*&gt;)/gi, '<span class="hl-doctype">$1</span>');

  // Closing tag:  </tagname>
  s = s.replace(/(&lt;\/)([\w-]+)(&gt;)/g,
    '<span class="hl-punct">$1</span><span class="hl-tagname">$2</span><span class="hl-punct">$3</span>');

  // Opening/self-closing tag start: <tagname
  s = s.replace(/(&lt;)([\w-]+)/g,
    '<span class="hl-punct">$1</span><span class="hl-tagname">$2</span>');

  // Tag close: > or />
  s = s.replace(/(\/?&gt;)/g, '<span class="hl-punct">$1</span>');

  // Attribute values "..." or '...'
  s = s.replace(/(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|"[^"]*?"|'[^']*?')/g,
    '<span class="hl-punct">=</span><span class="hl-string">$2</span>');

  // Attribute names (word before =)
  s = s.replace(/([\w-]+)(<span class="hl-punct">=<\/span>)/g,
    '<span class="hl-attr">$1</span>$2');

  // Placeholders {{...}}
  s = s.replace(/(\{\{[\w_]+\}\})/g, '<span class="hl-placeholder">$1</span>');

  return s;
}

// ── Extrair conteúdo do body/article para o editor visual ─────────────────

function extractVisualContent(html: string): string {
  if (!html) return "";
  // Se já é um fragmento (não tem doctype/html), usa direto
  if (!/^\s*<!doctype/i.test(html) && !/^\s*<html/i.test(html)) return html;
  // Tenta extrair <article>
  const art = html.match(/<article[^>]*>[\s\S]*?<\/article>/i);
  if (art) return art[0];
  // Tenta extrair conteúdo do <body>
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) return body[1].trim();
  // Fallback: devolve tudo (editor vai renderizar o que conseguir)
  return html;
}

// ── Subcomponentes de toolbar ──────────────────────────────────────────────

function TBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="h-6 w-6 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition-colors">
      {children}
    </button>
  );
}

function TSep() {
  return <div className="w-px h-4 bg-slate-300 mx-0.5 self-center" />;
}

// ── Componente principal ────────────────────────────────────────────────────

export const QAEditorModelo = forwardRef<QAEditorModeloRef, Props>(function QAEditorModelo(
  { initialHtml = "", onChange, inserts = [], minHeight = 360, placeholder },
  ref,
) {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const rawHtmlRef = useRef<string>(initialHtml); // sempre o HTML bruto atual
  const [modo, setModo] = useState<"visual" | "html">("visual");
  const [htmlBruto, setHtmlBruto] = useState(initialHtml);
  const [highlighted, setHighlighted] = useState(() => highlightHtml(initialHtml));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Popula o editor visual quando initialHtml chega (apenas uma vez, quando vazio)
  useEffect(() => {
    if (!initialHtml) return;
    rawHtmlRef.current = initialHtml;
    setHtmlBruto(initialHtml);
    setHighlighted(highlightHtml(initialHtml));
    if (contentEditableRef.current && !contentEditableRef.current.innerHTML.trim()) {
      contentEditableRef.current.innerHTML = extractVisualContent(initialHtml);
    }
  }, [initialHtml]);

  // Sincroniza scroll do textarea com o pre (highlight)
  function syncScroll() {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  useImperativeHandle(ref, () => ({
    getHtml() {
      if (modo === "html") return rawHtmlRef.current;
      return contentEditableRef.current?.innerHTML ?? "";
    },
    setHtml(html: string) {
      rawHtmlRef.current = html;
      setHtmlBruto(html);
      setHighlighted(highlightHtml(html));
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = extractVisualContent(html);
      }
      onChange?.(html);
    },
  }));

  function syncVisual() {
    const html = contentEditableRef.current?.innerHTML ?? "";
    rawHtmlRef.current = html;
    onChange?.(html);
  }

  function onHtmlBrutoChange(valor: string) {
    rawHtmlRef.current = valor;
    setHtmlBruto(valor);
    setHighlighted(highlightHtml(valor));
    onChange?.(valor);
  }

  function exec(command: string, value?: string) {
    contentEditableRef.current?.focus();
    document.execCommand(command, false, value ?? undefined);
    syncVisual();
  }

  function inserirHtml(html: string) {
    contentEditableRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncVisual();
  }

  function alternarModo(novoModo: "visual" | "html") {
    if (novoModo === modo) return;
    if (novoModo === "html") {
      // Visual → HTML: captura innerHTML atual como rawHtml
      const inner = contentEditableRef.current?.innerHTML ?? "";
      rawHtmlRef.current = inner;
      setHtmlBruto(inner);
      setHighlighted(highlightHtml(inner));
      onChange?.(inner);
    } else {
      // HTML → Visual: aplica rawHtml no contentEditable
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = extractVisualContent(rawHtmlRef.current);
      }
      onChange?.(rawHtmlRef.current);
    }
    setModo(novoModo);
  }

  const toolbarStyle = "flex flex-wrap items-center gap-0.5 border-b bg-slate-100 px-1.5 py-1";

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "hsl(220 15% 82%)" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className={toolbarStyle} style={{ borderColor: "hsl(220 15% 85%)" }}>

        {/* Toggle Visual / HTML */}
        <div className="flex mr-1">
          <button type="button" onClick={() => alternarModo("visual")}
            className={`h-6 px-2.5 text-[10px] rounded-l border font-semibold transition-colors
              ${modo === "visual" ? "bg-[#7B1C2E] text-white border-[#7B1C2E]" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"}`}>
            Visual
          </button>
          <button type="button" onClick={() => alternarModo("html")}
            className={`h-6 px-2 text-[10px] rounded-r border-t border-r border-b font-semibold flex items-center gap-0.5 transition-colors
              ${modo === "html" ? "bg-[#7B1C2E] text-white border-[#7B1C2E]" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50"}`}>
            <Code2 className="w-2.5 h-2.5" /> HTML
          </button>
        </div>

        {modo === "visual" && (
          <>
            <TSep />
            <TBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)"><Bold className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)"><Italic className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)"><Underline className="w-3 h-3" /></TBtn>
            <TSep />
            <TBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda"><AlignLeft className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyCenter")} title="Centralizar"><AlignCenter className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyRight")} title="Alinhar à direita"><AlignRight className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyFull")} title="Justificar"><AlignJustify className="w-3 h-3" /></TBtn>
            <TSep />
            <TBtn onClick={() => exec("formatBlock", "h1")} title="Título H1"><Heading1 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "h2")} title="Subtítulo H2"><Heading2 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "p")} title="Parágrafo normal"><Type className="w-3 h-3" /></TBtn>
            <TSep />
            <TBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="w-3 h-3" /></TBtn>

            {inserts.length > 0 && (
              <>
                <TSep />
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wide px-0.5 select-none">inserir</span>
                {inserts.map((ins, i) => (
                  <button key={i} type="button" title={ins.title}
                    onMouseDown={(e) => { e.preventDefault(); inserirHtml(ins.html); }}
                    className="h-6 px-1.5 text-[10px] rounded border border-slate-300 bg-white text-slate-600
                      hover:bg-slate-50 hover:border-slate-400 transition-colors font-medium whitespace-nowrap">
                    {ins.label}
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {modo === "html" && (
          <span className="text-[10px] text-slate-500 px-1 select-none">
            Edite o HTML diretamente · alterne para <b className="text-slate-700">Visual</b> para ver formatado
          </span>
        )}
      </div>

      {/* ── Editor visual (contentEditable) ──────────────────────────────── */}
      <div
        ref={contentEditableRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncVisual}
        data-placeholder={placeholder}
        className="qa-editor-visual focus:outline-none bg-white"
        style={{
          display: modo === "visual" ? "block" : "none",
          minHeight,
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#1a1a1a",
          fontSize: "15px",
          lineHeight: "1.75",
          padding: "48px",
          textAlign: "justify",
        }}
      />

      {/* ── Editor HTML com syntax highlighting ───────────────────────────── */}
      {modo === "html" && (
        <div className="relative" style={{ minHeight, background: "#0d1117" }}>
          {/* Camada de highlight (por baixo, não editável) */}
          <pre
            ref={preRef}
            aria-hidden
            className="qa-hl-pre"
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
          {/* Textarea transparente (por cima, editável) */}
          <textarea
            ref={textareaRef}
            value={htmlBruto}
            onChange={(e) => onHtmlBrutoChange(e.target.value)}
            onScroll={syncScroll}
            className="qa-hl-textarea"
            spellCheck={false}
            placeholder={placeholder}
          />
        </div>
      )}

      <style>{`
        /* ── Editor visual — CSS espelha PROCURACAO_CSS para WYSIWYG fiel ── */
        .qa-editor-visual:empty:before {
          content: attr(data-placeholder);
          color: #aaa; font-style: italic; pointer-events: none;
        }
        /* h1/h2/h3 — iguais ao export */
        .qa-editor-visual h1,
        .qa-editor-visual h2,
        .qa-editor-visual h3 {
          font-size: 16px; font-weight: 700; text-align: center;
          margin: 28px 0 18px; text-transform: uppercase; line-height: 1.35;
        }
        .qa-editor-visual h2,
        .qa-editor-visual h3 {
          font-size: 14px; margin-top: 22px; text-align: left;
        }
        /* Dentro de .qa-procuracao-template, h2 permanece centralizado */
        .qa-editor-visual .qa-procuracao-template h2 { text-align: center; }
        .qa-editor-visual p { margin: 0 0 14px; }
        .qa-editor-visual ol,
        .qa-editor-visual ul { margin: 12px 0 16px 24px; padding: 0; }
        .qa-editor-visual li { margin: 0 0 8px; }
        .qa-editor-visual strong { font-weight: 700; }
        .qa-editor-visual .qa-procuracao__letterhead {
          margin: 0 0 30px; font-family: Arial, sans-serif;
          font-size: 11px; line-height: 1.45; text-align: right;
        }
        .qa-editor-visual .qa-procuracao__powers { margin-left: 26px; }
        .qa-editor-visual .qa-procuracao__powers li {
          padding-left: 2px; margin-bottom: 14px;
        }
        .qa-editor-visual .qa-doc__date { margin-top: 28px; text-align: right; }
        .qa-editor-visual .qa-doc__signature { margin-top: 52px; text-align: center; }
        .qa-editor-visual .qa-doc__signature::before {
          content: ""; display: block; width: 320px; max-width: 80%;
          border-top: 1px solid #1a1a1a; margin: 0 auto 8px;
        }
        .qa-editor-visual .qa-doc__signature span,
        .qa-editor-visual .qa-doc__signature small { display: block; }

        /* ── Syntax highlighting ── */
        .qa-hl-pre, .qa-hl-textarea {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          margin: 0; padding: 16px 20px;
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 12.5px; line-height: 1.65;
          white-space: pre-wrap; word-wrap: break-word;
          tab-size: 2; overflow: auto;
          min-height: inherit;
        }
        .qa-hl-pre {
          color: #e6edf3; pointer-events: none; z-index: 0;
          background: transparent;
          border: 0; box-shadow: none;
        }
        .qa-hl-textarea {
          color: transparent; background: transparent;
          caret-color: #e6edf3; z-index: 1;
          border: 0; resize: none; outline: none;
          width: 100%; height: 100%;
        }
        .qa-hl-textarea::placeholder { color: #484f58; }
        /* Cores dos tokens (tema GitHub Dark) */
        .hl-comment   { color: #6e7681; font-style: italic; }
        .hl-doctype   { color: #6e7681; }
        .hl-tagname   { color: #7ee787; }
        .hl-punct     { color: #e6edf3; }
        .hl-attr      { color: #79c0ff; }
        .hl-string    { color: #a5d6ff; }
        .hl-placeholder { color: #ffa657; font-weight: 600; }
      `}</style>
    </div>
  );
});
