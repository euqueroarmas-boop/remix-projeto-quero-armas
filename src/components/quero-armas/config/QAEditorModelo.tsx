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

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Calibri", value: "Calibri" },
  { label: "Georgia", value: "Georgia" },
  { label: "Verdana", value: "Verdana" },
] as const;

const FONT_SIZES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;

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

function TBtn({
  onClick, title, children, active = false,
}: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`h-6 w-6 flex items-center justify-center rounded transition-all duration-100
        ${active
          ? "bg-[#7B1C2E] text-white shadow-inner scale-95 ring-1 ring-[#7B1C2E]/40"
          : "text-slate-600 hover:bg-slate-200"}`}>
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
  const rawHtmlRef = useRef<string>(initialHtml);
  const [modo, setModo] = useState<"visual" | "html">("visual");
  const [htmlBruto, setHtmlBruto] = useState(initialHtml);
  const [highlighted, setHighlighted] = useState(() => highlightHtml(initialHtml));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [fontSizePt, setFontSizePt] = useState("11");

  // Estado de formatação ativa (atualizado a cada mudança de seleção)
  const [fmt, setFmt] = useState({
    bold: false, italic: false, underline: false,
    alignLeft: false, alignCenter: false, alignRight: false, alignFull: false,
    h1: false, h2: false, p: false,
    caseUpper: false, caseLower: false,
  });

  // Feedback visual dos botões AA/aa/Aa após clique (fica aceso por 1.5s)
  const [caseAtivo, setCaseAtivo] = useState<"upper" | "lower" | "sentence" | null>(null);
  const caseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ativarCaseFeedback(tipo: "upper" | "lower" | "sentence") {
    if (caseTimerRef.current) clearTimeout(caseTimerRef.current);
    setCaseAtivo(tipo);
    caseTimerRef.current = setTimeout(() => setCaseAtivo(null), 1500);
  }

  useEffect(() => {
    function onSelectionChange() {
      const ed = contentEditableRef.current;
      const sel = document.getSelection();
      if (!ed || !sel || !ed.contains(sel.anchorNode ?? null)) return;

      if (sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();

      const anchor = sel.anchorNode;
      const selectionElement = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
      if (selectionElement) {
        const style = window.getComputedStyle(selectionElement);
        const activeFamilies = style.fontFamily
          .replace(/["']/g, "")
          .toLowerCase()
          .split(",")
          .map((item) => item.trim());
        const matchedFamily = FONT_FAMILIES.find((font) =>
          activeFamilies.includes(font.value.toLowerCase()),
        );
        if (matchedFamily) setFontFamily(matchedFamily.value);

        const px = Number.parseFloat(style.fontSize);
        if (Number.isFinite(px)) {
          const pt = (px * 72) / 96;
          const nearest = FONT_SIZES_PT.reduce<number>((best, size) =>
            Math.abs(size - pt) < Math.abs(best - pt) ? size : best,
          );
          setFontSizePt(String(nearest));
        }
      }

      // Detecta o case do texto selecionado para iluminar AA / aa automaticamente
      let caseUpper = false;
      let caseLower = false;
      if (sel && !sel.isCollapsed) {
        const txt = sel.toString().replace(/[\s\{\}_]/g, ""); // ignora espaços e placeholders
        const letras = txt.replace(/[^A-Za-zÀ-ÿ]/g, "");
        if (letras.length > 0) {
          if (letras === letras.toUpperCase()) caseUpper = true;
          else if (letras === letras.toLowerCase()) caseLower = true;
        }
      }

      setFmt({
        bold:        document.queryCommandState("bold"),
        italic:      document.queryCommandState("italic"),
        underline:   document.queryCommandState("underline"),
        alignLeft:   document.queryCommandState("justifyLeft"),
        alignCenter: document.queryCommandState("justifyCenter"),
        alignRight:  document.queryCommandState("justifyRight"),
        alignFull:   document.queryCommandState("justifyFull"),
        h1:  document.queryCommandValue("formatBlock").toLowerCase() === "h1",
        h2:  document.queryCommandValue("formatBlock").toLowerCase() === "h2",
        p:   document.queryCommandValue("formatBlock").toLowerCase() === "p",
        caseUpper,
        caseLower,
      });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

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

  function saveEditorSelection() {
    const selection = window.getSelection();
    const editor = contentEditableRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function restoreEditorSelection() {
    const selection = window.getSelection();
    const range = savedRangeRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function aplicarFonte(value: string) {
    setFontFamily(value);
    contentEditableRef.current?.focus();
    restoreEditorSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontName", false, value);
    syncVisual();
  }

  function aplicarTamanhoFonte(value: string) {
    setFontSizePt(value);
    const editor = contentEditableRef.current;
    editor?.focus();
    restoreEditorSelection();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    editor?.querySelectorAll<HTMLElement>('font[size="7"]').forEach((node) => {
      node.removeAttribute("size");
      node.style.fontSize = `${value}pt`;
    });
    document.execCommand("styleWithCSS", false, "true");
    syncVisual();
  }

  function transformarTexto(tipo: "upper" | "lower" | "sentence") {
    ativarCaseFeedback(tipo);
    contentEditableRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);

    // Isola os nós de texto nos limites da seleção com splitText,
    // para que cada nó percorrido esteja INTEIRAMENTE dentro do range.
    // Faz o end antes para não invalidar os offsets do start.
    if (
      range.endContainer.nodeType === Node.TEXT_NODE &&
      range.endOffset < (range.endContainer as Text).length
    ) {
      (range.endContainer as Text).splitText(range.endOffset);
    }
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const novoInicio = (range.startContainer as Text).splitText(range.startOffset);
      range.setStart(novoInicio, 0);
    }

    // Coleta todos os nós de texto dentro do range
    const raiz =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode!
        : range.commonAncestorContainer;

    const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nos: Text[] = [];
    let n = walker.nextNode();
    while (n) {
      if (range.intersectsNode(n)) nos.push(n as Text);
      n = walker.nextNode();
    }

    // Transforma o textContent de cada nó preservando a estrutura HTML pai
    if (tipo === "upper") {
      for (const no of nos) no.textContent = (no.textContent ?? "").toUpperCase();
    } else if (tipo === "lower") {
      for (const no of nos) no.textContent = (no.textContent ?? "").toLowerCase();
    } else {
      // ── Title Case ───────────────────────────────────────────────────
      // Regras (em ordem de prioridade):
      // 1. {{placeholder}} → mantido intacto (o valor vem do banco)
      // 2. Palavra ALL-CAPS com ≥2 letras → mantida (abreviação: CPF, RG, SP…)
      // 3. Preposição/artigo (não é a 1ª palavra) → minúsculo
      // 4. Demais → 1ª letra maiúscula, resto minúsculo

      const PREPS = new Set([
        "a","ao","aos","à","às","e","é","o","os","as","um","uma","uns","umas",
        "de","da","das","do","dos","no","na","nos","nas","em","por","para",
        "com","sem","sob","sobre","ante","após","até","entre","contra","desde",
        "perante","salvo","que","se","ou","mas","nem","porém","contudo","todavia",
      ]);

      // Combina o texto de todos os nós para tokenizar por palavra completa
      const textoTotal = nos.map(n => n.textContent ?? "").join("");

      // Divide em tokens: palavras e espaços (alterna)
      const tokens = textoTotal.split(/(\s+)/);
      let primeiraWord = true;

      const tokensTransformados = tokens.map(tok => {
        if (/^\s+$/.test(tok)) return tok; // espaço → inalterado

        // {{placeholder}} → mantém como está
        if (/^\{\{[^}]*\}\}$/.test(tok)) { primeiraWord = false; return tok; }

        // Abreviação: token cujas LETRAS são todas maiúsculas (CPF, RG, SP, CEP…)
        const apenasLetras = tok.replace(/[^A-Za-zÀ-ÿ]/g, "");
        const eAbreviacao = apenasLetras.length >= 2
          && apenasLetras === apenasLetras.toUpperCase()
          && /[A-ZÀÁÂÃÉÊÍÓÔÕÚÜ]/.test(apenasLetras);
        if (eAbreviacao) { primeiraWord = false; return tok; }

        // Preposição/artigo (mas nunca a primeira palavra da seleção)
        const limpo = tok.toLowerCase().replace(/[^a-záéíóúàãõâêôüç]/gi, "");
        if (!primeiraWord && PREPS.has(limpo)) return tok.toLowerCase();

        primeiraWord = false;
        return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
      });

      const textoFinal = tokensTransformados.join("");

      // Distribui os caracteres de volta para cada nó de texto
      let offset = 0;
      for (const no of nos) {
        const len = (no.textContent ?? "").length;
        no.textContent = textoFinal.slice(offset, offset + len);
        offset += len;
      }
    }

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
            <TBtn onClick={() => exec("bold")} title="Negrito (Ctrl+B)" active={fmt.bold}><Bold className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("italic")} title="Itálico (Ctrl+I)" active={fmt.italic}><Italic className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("underline")} title="Sublinhado (Ctrl+U)" active={fmt.underline}><Underline className="w-3 h-3" /></TBtn>
            <TSep />
            <select
              value={fontFamily}
              onMouseDown={saveEditorSelection}
              onChange={(event) => aplicarFonte(event.target.value)}
              aria-label="Tipo de fonte"
              title={`Fonte atual: ${fontFamily}`}
              className="h-6 max-w-[132px] rounded border border-slate-300 bg-white px-1 text-[10px] text-slate-700"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
            <select
              value={fontSizePt}
              onMouseDown={saveEditorSelection}
              onChange={(event) => aplicarTamanhoFonte(event.target.value)}
              aria-label="Tamanho da fonte"
              title={`Tamanho atual: ${fontSizePt} pt`}
              className="h-6 w-[62px] rounded border border-slate-300 bg-white px-1 text-[10px] text-slate-700"
            >
              {FONT_SIZES_PT.map((size) => (
                <option key={size} value={size}>{size} pt</option>
              ))}
            </select>
            <TSep />
            <TBtn onClick={() => exec("justifyLeft")} title="Alinhar à esquerda" active={fmt.alignLeft}><AlignLeft className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyCenter")} title="Centralizar" active={fmt.alignCenter}><AlignCenter className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyRight")} title="Alinhar à direita" active={fmt.alignRight}><AlignRight className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("justifyFull")} title="Justificar" active={fmt.alignFull}><AlignJustify className="w-3 h-3" /></TBtn>
            <TSep />
            <TBtn onClick={() => exec("formatBlock", "h1")} title="Título H1" active={fmt.h1}><Heading1 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "h2")} title="Subtítulo H2" active={fmt.h2}><Heading2 className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("formatBlock", "p")} title="Parágrafo normal" active={fmt.p}><Type className="w-3 h-3" /></TBtn>
            <TSep />
            <TBtn onClick={() => exec("insertUnorderedList")} title="Lista com marcadores"><List className="w-3 h-3" /></TBtn>
            <TBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="w-3 h-3" /></TBtn>
            <TSep />
            {(["upper", "lower", "sentence"] as const).map((tipo) => {
              const isActive =
                tipo === "upper"    ? (caseAtivo === "upper"    || fmt.caseUpper) :
                tipo === "lower"    ? (caseAtivo === "lower"    || fmt.caseLower) :
                                      (caseAtivo === "sentence");
              const labels = { upper: "AA", lower: "aa", sentence: "Aa" };
              const titles = {
                upper:    "MAIÚSCULAS — transforma o texto selecionado em caixa alta",
                lower:    "minúsculas — transforma o texto selecionado em caixa baixa",
                sentence: "Title Case — primeira letra de cada palavra em maiúscula, exceto preposições",
              };
              return (
                <button key={tipo} type="button" title={titles[tipo]}
                  onMouseDown={(e) => { e.preventDefault(); transformarTexto(tipo); }}
                  className={`h-6 px-1.5 text-[10px] rounded border transition-all duration-100
                    ${tipo === "upper" ? "font-bold tracking-wide" : "font-medium"}
                    ${isActive
                      ? "bg-[#7B1C2E] text-white border-[#7B1C2E] shadow-inner scale-95 ring-1 ring-[#7B1C2E]/40"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400"}`}>
                  {labels[tipo]}
                </button>
              );
            })}

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
