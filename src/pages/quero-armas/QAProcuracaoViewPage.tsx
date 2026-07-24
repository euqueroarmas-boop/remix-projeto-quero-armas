import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { baixarHtmlProcuracao } from "@/lib/quero-armas/procuracaoHtml";
import { jsPDF } from "jspdf";

// ── Title Case: converte ALL-CAPS → primeira letra maiúscula ─────────────
// Abreviações ≤4 letras (SP, RG, CPF, CEP…) são preservadas.
// Nomes de pessoas (outorgante/outorgado) são protegidos via placeholder.
const PREPS_VIEW = new Set(["da","das","de","do","dos","e","a","ao","em","na","no","por","sob","sobre","com","sem","entre","até","ante","após"]);

function titleWord(w: string): string {
  if (/^[A-ZÁÉÍÓÚÀÃÕÂÊÔÜ0-9]{1,4}$/.test(w)) return w; // abreviação curta
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function titleCaseSeq(match: string): string {
  return match.split(/\s+/).map((w, i) =>
    (i > 0 && PREPS_VIEW.has(w.toLowerCase())) ? w.toLowerCase() : titleWord(w)
  ).join(" ");
}

function normalizeHtml(html: string, protectedNames: string[] = []): string {
  // 1. Protege nomes (ALL-CAPS) substituindo por placeholders
  let working = html;
  const validNames = protectedNames.filter((n) => n && n.trim().length > 0);
  for (let i = 0; i < validNames.length; i++) {
    working = working.split(validNames[i]).join(`\x00N${i}\x00`);
  }

  // 2. Converte ALL-CAPS → Title Case nos nós de texto HTML
  working = working.replace(/>([^<]+)</g, (_, text) => {
    let t = text;
    // sequências de ≥2 palavras ALL-CAPS (endereços, cidades compostas…)
    t = t.replace(
      /\b([A-ZÁÉÍÓÚÀÃÕÂÊÔÜ]{3,}(?:\s+[A-ZÁÉÍÓÚÀÃÕÂÊÔÜ]{2,})+)\b/g,
      titleCaseSeq
    );
    // palavras únicas ALL-CAPS com 5+ letras (JACAREÍ, BRASIL, TAUBATÉ…)
    t = t.replace(/\b([A-ZÁÉÍÓÚÀÃÕÂÊÔÜ]{5,})\b/g, (w) => titleWord(w));
    return ">" + t + "<";
  });

  // 3. Corrige abreviações que o editor possa ter Title-Cased indevidamente
  working = working
    .replace(/\bCpf\b/g, "CPF")
    .replace(/\bRg\b/g, "RG")
    .replace(/\bCnpj\b/g, "CNPJ")
    .replace(/\bCep\b/g, "CEP");

  // 4. Remove linha de emissor de RG quando os campos estão vazios
  working = working.replace(
    /Expedido\s+(pela|pelo|por)\s+[\/\s]*(?=<|$)/gi,
    ""
  );

  // 5. Restaura nomes protegidos (mantém ALL-CAPS originais)
  for (let i = 0; i < validNames.length; i++) {
    working = working.split(`\x00N${i}\x00`).join(validNames[i]);
  }

  return working;
}

// ── Geração de PDF a partir do mesmo HTML exibido ao cliente ───────────────
// Usa doc.html() + html2canvas renderizando o DOM real (com CSS aplicado),
// garantindo fidelidade visual total em relação à tela.
function adicionarCarimboSessao(doc: jsPDF, vendaId?: number | null) {
  const pageH = doc.internal.pageSize.getHeight();
  const mLeft = 76;
  const mTop = 42;
  const mBottom = 42;
  const stampRuleX = 24;
  const stampTop = mTop;
  const stampBottom = pageH - mBottom;
  const availH = stampBottom - stampTop;
  const titleX = 32;
  const fieldStartX = 44;
  const columnGap = 9;
  const textGutter = 16;
  const maxColumns = Math.max(1, Math.floor((mLeft - fieldStartX - textGutter) / columnGap));
  const fontSize = 6.8;
  const charAdvance = 3.1;
  const maxCharsPerCol = Math.max(20, Math.floor(availH / charAdvance));

  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
  const numero = vendaId ? `VENDA ${vendaId}` : "PROCURAÇÃO";
  const stampRows: [string, string][] = [
    ["PROCURAÇÃO", numero],
    ["DATA/HORA (BRT)", agora],
    ["IDIOMA", navigator.language || "—"],
    ["REFERÊNCIA", document.referrer || "—"],
    ["USER-AGENT", navigator.userAgent],
    ["AÇÃO", "download"],
  ];

  const fieldsLine = stampRows.map(([l, v]) => `${l}: ${v}`).join(", ");
  const parts = fieldsLine.split(/(, )/);
  const columns: string[] = [];
  let current = "";
  for (const part of parts) {
    if ((current + part).length > maxCharsPerCol && current.length > 0) {
      columns.push(current.replace(/,\s*$/, ""));
      current = part.replace(/^,\s*/, "");
    } else {
      current += part;
    }
    if (columns.length >= maxColumns - 1) break;
  }
  const consumed = columns.join(", ").length + (columns.length ? 2 : 0);
  const remaining = fieldsLine.slice(consumed);
  if (remaining) {
    if (columns.length < maxColumns) columns.push(remaining);
    else columns[columns.length - 1] = (columns[columns.length - 1] + ", " + remaining).slice(0, maxCharsPerCol - 1) + "…";
  } else if (current) {
    columns.push(current);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(190);
    doc.setLineWidth(0.4);
    doc.line(stampRuleX, stampTop, stampRuleX, stampBottom);

    doc.setFont("times", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90);
    doc.text("REGISTRO DE SESSÃO — DOWNLOAD DO INSTRUMENTO · MP 2.200-2/2001", titleX, stampBottom, { angle: 90, baseline: "alphabetic" } as any);

    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(70);
    for (let c = 0; c < columns.length; c++) {
      doc.text(columns[c], fieldStartX + c * columnGap, stampBottom, { angle: 90, baseline: "alphabetic" } as any);
    }

    doc.setFontSize(6.5);
    doc.setTextColor(140);
    doc.text(`PÁG. ${p}/${totalPages}`, titleX, stampTop + 26, { angle: 90, baseline: "alphabetic" } as any);
  }
}

async function gerarPdf(
  elemento: HTMLElement,
  larguraHtml: number,
  nomeArquivo: string,
  vendaId?: number | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margemEsquerda = 76;
  const margemDireita = 42;
  const margemVertical = 42;
  const larguraPdf = pageW - margemEsquerda - margemDireita;

  await document.fonts.ready;
  await (doc as any).html(elemento, {
    x: 0,
    y: 0,
    width: larguraPdf,
    windowWidth: larguraHtml,
    margin: [margemVertical, margemDireita, margemVertical, margemEsquerda],
    autoPaging: "text",
    html2canvas: {
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    },
  });

  adicionarCarimboSessao(doc, vendaId);
  doc.save(nomeArquivo);
}

type ProcuracaoData = {
  id: string;
  status: string;
  issued_at: string | null;
  outorgado_ate: string | null;
  conteudo_html: string;
  venda_id: number | null;
  nome_cliente: string;
};

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    generated_pending_customer_signature: { label: "Aguardando sua assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    customer_signature_uploaded: { label: "Assinada — em validação", color: "text-blue-700 bg-blue-50 border-blue-200" },
    validated: { label: "Validada", color: "text-green-700 bg-green-50 border-green-200" },
    rejected: { label: "Correção necessária", color: "text-red-700 bg-red-50 border-red-200" },
    reaproveitada: { label: "Reaproveitada", color: "text-green-700 bg-green-50 border-green-200" },
  };
  return map[status] ?? { label: status, color: "text-muted-foreground bg-muted border-muted" };
}

export default function QAProcuracaoViewPage() {
  const { id } = useParams<{ id: string }>();
  const [procuracao, setProcuracao] = useState<ProcuracaoData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      setErro("Link inválido.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    supabase.functions.invoke("qa-procuracao-view-public", { body: { procuracao_id: id } })
      .then(({ data, error }) => {
        if (error || !(data as any)?.ok) {
          setErro("Procuração não encontrada ou link inválido.");
        } else {
          const d = data as ProcuracaoData;
          // Normaliza ALL-CAPS → Title Case antes de renderizar/baixar
          // Nome do cliente é protegido para permanecer em ALL-CAPS
          setProcuracao({ ...d, conteudo_html: normalizeHtml(d.conteudo_html, [d.nome_cliente]) });
        }
      })
      .catch(() => setErro("Erro ao carregar a procuração. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    if (procuracao) {
      const nome = procuracao.nome_cliente ? ` - ${procuracao.nome_cliente}` : "";
      document.title = `Procuração Quero Armas${nome}`;
    }
    return () => { document.title = "Eu Quero Armas, e você?"; };
  }, [procuracao]);

  async function baixarPdf() {
    if (!procuracao || !conteudoRef.current) return;
    setBaixando(true);
    try {
      const nomeCliente = procuracao.nome_cliente ? ` - ${procuracao.nome_cliente}` : "";
      const nome = `${procuracao.venda_id ? `VENDA ${procuracao.venda_id}` : "PROCURACAO"} - Procuração Quero Armas${nomeCliente}.pdf`;
      const larguraHtml = Math.max(
        conteudoRef.current.scrollWidth,
        conteudoRef.current.getBoundingClientRect().width,
      );
      const documento = conteudoRef.current.cloneNode(true) as HTMLDivElement;
      documento.className = "qa-procuracao-body";
      documento.style.cssText = [
        "width: 100%",
        "max-width: none",
        "margin: 0",
        "padding: 0",
        "border: 0",
        "border-radius: 0",
        "box-shadow: none",
        "background: #fff",
      ].join(";");
      await gerarPdf(documento, larguraHtml, nome, procuracao.venda_id);
      toast.success("Procuração baixada");
    } catch (e) {
      console.error("[baixarProcuracaoPdf]", e);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBaixando(false);
    }
  }

  function baixarHtml() {
    if (!procuracao) return;
    const nomeCliente = procuracao.nome_cliente ? ` - ${procuracao.nome_cliente}` : "";
    const nome = `${procuracao.venda_id ? `VENDA ${procuracao.venda_id}` : "PROCURACAO"} - Procuração Quero Armas${nomeCliente}`;
    baixarHtmlProcuracao(procuracao.conteudo_html, nome, nome);
    toast.success("HTML da procuração baixado");
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7A1F2B]" />
          <p className="text-sm text-muted-foreground">Carregando procuração...</p>
        </div>
      </div>
    );
  }

  if (erro || !procuracao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1] px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Procuração não encontrada</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <Link to="/area-do-cliente" className="text-sm text-[#7A1F2B] underline">
            Ir para a Área do Cliente
          </Link>
        </div>
      </div>
    );
  }

  const st = statusLabel(procuracao.status);
  const issuedDate = procuracao.issued_at
    ? new Date(procuracao.issued_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : "-";

  return (
    <div className="min-h-screen bg-[#f6f5f1]">
      <header className="bg-[#0a0a0a] text-white py-4 px-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#c9a84c]" />
          <div>
            <p className="text-sm font-semibold">QUERO ARMAS</p>
            <p className="text-xs text-white/60">Procuração de Serviços</p>
          </div>
        </div>
        <a href="https://www.euqueroarmas.com.br" className="text-xs text-white/50 hover:text-white/80">
          euqueroarmas.com.br
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 print:hidden">
        <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#7A1F2B]" />
              <span className="text-sm font-semibold text-foreground">Procuração Quero Armas</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${st.color}`}>
                {st.label}
              </span>
              <span className="text-xs text-muted-foreground">Emitida em {issuedDate}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={baixarPdf} disabled={baixando} className="gap-2 bg-[#7A1F2B] hover:bg-[#6a1827] text-white text-xs">
              {baixando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {baixando ? "Gerando PDF..." : "Baixar procuração (PDF)"}
            </Button>
            <Button size="sm" variant="outline" onClick={baixarHtml} className="gap-2 text-xs border-[#7A1F2B]/30 bg-white text-[#7A1F2B] hover:bg-[#7A1F2B]/5 hover:text-[#7A1F2B]">
              <Download className="w-3.5 h-3.5" />
              Baixar HTML
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2 text-xs border-[#7A1F2B]/30 bg-white text-[#7A1F2B] hover:bg-[#7A1F2B]/5 hover:text-[#7A1F2B]">
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
          </div>
        </div>

        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Como assinar sua procuração:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Clique em <strong>Baixar procuração (PDF)</strong> para salvar o arquivo no seu dispositivo.</li>
            <li>Acesse o aplicativo <strong>GOV.BR</strong> e assine o PDF eletronicamente.</li>
            <li>Volte para a Área do Cliente e envie o PDF assinado.</li>
          </ol>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div
          ref={conteudoRef}
          className="bg-white rounded-lg border shadow-sm p-8 print:shadow-none print:border-none print:rounded-none print:p-0 qa-procuracao-body"
          dangerouslySetInnerHTML={{ __html: procuracao.conteudo_html }}
        />
      </div>

      <style>{`
        .qa-procuracao-body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 15px;
          line-height: 1.75;
          color: #1a1a1a;
          text-align: justify;
        }
        .qa-procuracao-body .qa-doc,
        .qa-procuracao-body article {
          max-width: 720px;
          margin: 0 auto;
        }
        .qa-procuracao-body .qa-procuracao__letterhead {
          margin: 0 0 30px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.45;
          text-align: right;
        }
        .qa-procuracao-body p {
          margin: 0 0 14px;
        }
        .qa-procuracao-body ol,
        .qa-procuracao-body ul {
          margin: 12px 0 16px 24px;
          padding: 0;
        }
        .qa-procuracao-body li {
          margin: 0 0 8px;
        }
        .qa-procuracao-body h1,
        .qa-procuracao-body h2,
        .qa-procuracao-body h3 {
          font-size: 16px;
          font-weight: 700;
          text-align: center;
          margin: 28px 0 18px;
          text-transform: uppercase;
          line-height: 1.35;
        }
        .qa-procuracao-body h2,
        .qa-procuracao-body h3 {
          font-size: 14px;
          margin-top: 22px;
          text-align: left;
        }
        .qa-procuracao-body .qa-procuracao-template h2 {
          text-align: center;
        }
        .qa-procuracao-body .qa-procuracao__powers {
          margin-left: 26px;
        }
        .qa-procuracao-body .qa-procuracao__powers li {
          padding-left: 2px;
          margin-bottom: 14px;
        }
        .qa-procuracao-body strong {
          font-weight: 700;
        }
        .qa-procuracao-body .qa-doc__date {
          margin-top: 28px;
          text-align: right;
        }
        .qa-procuracao-body .qa-doc__signature {
          margin-top: 52px;
          text-align: center;
        }
        .qa-procuracao-body .qa-doc__signature::before {
          content: "";
          display: block;
          width: 320px;
          max-width: 80%;
          border-top: 1px solid #1a1a1a;
          margin: 0 auto 8px;
        }
        .qa-procuracao-body .qa-doc__signature span,
        .qa-procuracao-body .qa-doc__signature small {
          display: block;
        }
        @media print {
          header, button, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .qa-procuracao-body { font-size: 12pt; }
        }
      `}</style>
    </div>
  );
}
