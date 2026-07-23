import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
          setProcuracao(data as ProcuracaoData);
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
    if (!procuracao || !id) return;
    setBaixando(true);
    try {
      const endpoint = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-procuracao-view-public`);
      endpoint.searchParams.set("procuracao_id", id);
      endpoint.searchParams.set("action", "download");
      endpoint.searchParams.set("format", "pdf");
      endpoint.searchParams.set("_cb", String(Date.now()));

      const res = await fetch(endpoint.toString(), {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          Accept: "application/pdf",
        },
      });
      if (!res.ok) throw new Error(`Falha HTTP ${res.status}`);

      const blob = await res.blob();
      if (!blob.size) throw new Error("PDF vazio");

      const nome = `${procuracao.venda_id ? `VENDA ${procuracao.venda_id}` : "PROCURACAO"} - Procuração Quero Armas.pdf`;
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success("Procuração baixada");
    } catch (e) {
      console.error("[baixarProcuracaoPdf]", e);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setBaixando(false);
    }
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
          className="bg-white rounded-lg border shadow-sm p-8 print:shadow-none print:border-none print:rounded-none print:p-0 qa-procuracao-body"
          dangerouslySetInnerHTML={{ __html: procuracao.conteudo_html }}
        />
      </div>

      <style>{`
        .qa-procuracao-body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 14px;
          line-height: 1.8;
          color: #1a1a1a;
        }
        .qa-procuracao-body h1,
        .qa-procuracao-body h2,
        .qa-procuracao-body h3 {
          font-size: 15px;
          font-weight: 700;
          text-align: center;
          margin: 24px 0 8px;
          text-transform: uppercase;
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
