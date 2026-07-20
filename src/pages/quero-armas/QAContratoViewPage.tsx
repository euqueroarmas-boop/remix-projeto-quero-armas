import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ContratoData = {
  contract_number: string;
  status: string;
  issued_at: string;
  conteudo_html: string;
  venda_id: number | null;
  nome_cliente: string;
};

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    pending_customer_signature: { label: "Aguardando sua assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    generated_pending_company_signature: { label: "Aguardando sua assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    signed_pending_validation: { label: "Assinado — em validação", color: "text-blue-700 bg-blue-50 border-blue-200" },
    validated: { label: "Validado", color: "text-green-700 bg-green-50 border-green-200" },
    cancelled: { label: "Cancelado", color: "text-red-700 bg-red-50 border-red-200" },
  };
  return map[s] ?? { label: s, color: "text-muted-foreground bg-muted border-muted" };
}

export default function QAContratoViewPage() {
  const { id } = useParams<{ id: string }>();
  const [contrato, setContrato] = useState<ContratoData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  function carregar() {
    if (!id) { setErro("Link inválido."); setCarregando(false); return; }
    setCarregando(true);
    supabase.functions.invoke("qa-contrato-view-public", { body: { contract_id: id } })
      .then(({ data, error }) => {
        if (error || !(data as any)?.ok) {
          setErro("Contrato não encontrado ou link inválido.");
        } else {
          setContrato(data as ContratoData);
        }
      })
      .catch(() => setErro("Erro ao carregar o contrato. Tente novamente."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, [id]);

  useEffect(() => {
    if (contrato) {
      const nome = contrato.nome_cliente ? ` - ${contrato.nome_cliente}` : "";
      document.title = `${contrato.contract_number} - Contrato de Adesão${nome}`;
    }
    return () => { document.title = "Eu Quero Armas, e você?"; };
  }, [contrato]);


  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#7A1F2B]" />
          <p className="text-sm text-muted-foreground">Carregando contrato…</p>
        </div>
      </div>
    );
  }

  if (erro || !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f1] px-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Contrato não encontrado</h1>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <Link to="/area-do-cliente" className="text-sm text-[#7A1F2B] underline">
            Ir para a Área do Cliente
          </Link>
        </div>
      </div>
    );
  }

  const st = statusLabel(contrato.status);
  const issuedDate = contrato.issued_at
    ? new Date(contrato.issued_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <div className="min-h-screen bg-[#f6f5f1]">
      {/* Cabeçalho */}
      <header className="bg-[#0a0a0a] text-white py-4 px-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#c9a84c]" />
          <div>
            <p className="text-sm font-semibold">QUERO ARMAS</p>
            <p className="text-xs text-white/60">Contrato de Serviços</p>
          </div>
        </div>
        <a href="https://www.euqueroarmas.com.br" className="text-xs text-white/50 hover:text-white/80">
          euqueroarmas.com.br
        </a>
      </header>

      {/* Barra de info + ações */}
      <div className="max-w-4xl mx-auto px-4 py-4 print:hidden">
        <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#7A1F2B]" />
              <span className="text-sm font-semibold text-foreground">
                Contrato {contrato.contract_number}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${st.color}`}>
                {st.label}
              </span>
              <span className="text-xs text-muted-foreground">Emitido em {issuedDate}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2 bg-[#7A1F2B] hover:bg-[#6a1827] text-white text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Como assinar seu contrato:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Clique em <strong>Imprimir / Salvar PDF</strong> e salve o arquivo no seu computador.</li>
            <li>Acesse o aplicativo <strong>GOV.BR</strong> e assine o PDF eletronicamente.</li>
            <li>Envie o arquivo assinado por <strong>WhatsApp</strong> para nossa equipe.</li>
          </ol>
        </div>
      </div>

      {/* Conteúdo do contrato */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div
          className="bg-white rounded-lg border shadow-sm p-8 print:shadow-none print:border-none print:rounded-none print:p-0 qa-contrato-body"
          dangerouslySetInnerHTML={{ __html: contrato.conteudo_html }}
        />
      </div>

      <style>{`
        .qa-contrato-body {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 14px;
          line-height: 1.8;
          color: #1a1a1a;
        }
        .qa-contrato-body h1 {
          font-size: 15px;
          font-weight: 700;
          text-align: center;
          margin: 24px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .qa-contrato-body h2 {
          font-size: 13.5px;
          font-weight: 700;
          margin: 20px 0 6px;
          text-transform: uppercase;
        }
        .qa-contrato-body h3 {
          font-size: 13px;
          font-weight: 600;
          margin: 16px 0 4px;
        }
        .qa-contrato-body p {
          margin: 8px 0;
          text-align: justify;
        }
        .qa-contrato-body ul, .qa-contrato-body ol {
          padding-left: 20px;
          margin: 8px 0;
        }
        .qa-contrato-body li {
          margin: 4px 0;
        }
        .qa-contrato-body hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 20px 0;
        }
        .qa-contrato-body strong {
          font-weight: 700;
        }
        .qa-contrato-body section {
          margin: 12px 0;
        }
        @media print {
          header, .print\\:hidden { display: none !important; }
          body { background: white; }
          .qa-contrato-body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
