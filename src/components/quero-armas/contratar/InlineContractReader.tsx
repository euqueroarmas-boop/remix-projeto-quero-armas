import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterContractAnexosBySlugs } from "@/lib/quero-armas/contractAnexoFilter";

interface Vars {
  cliente_nome: string;
  cliente_cpf_cnpj: string;
  cliente_endereco: string;
  cliente_email: string;
  cliente_telefone: string;
  servico_slug: string;
  servico_nome: string;
  servico_preco: string;
}

interface Props {
  servicoSlug: string;
  vars: Vars;
}

function renderVariables(html: string, vars: Record<string, string>) {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? "");
  }
  out = out.replace(/\{\{[a-z_]+\}\}/gi, "—");
  return out;
}

export default function InlineContractReader({ servicoSlug, vars }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [template, setTemplate] = useState<{ titulo: string; corpo_html: string; versao: number } | null>(null);

  useEffect(() => {
    if (!open || template) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("qa_contract_templates")
        .select("titulo, corpo_html, versao")
        .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
        .eq("vigente", true)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        setErro("Não foi possível carregar a minuta agora. Você pode prosseguir; o contrato será registrado no aceite.");
      } else {
        setTemplate(data as any);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, template]);

  const renderedHtml = useMemo(() => {
    if (!template) return "";
    const filled = renderVariables(template.corpo_html, {
      ...vars,
      aceite_data: "",
      aceite_ip: "",
      aceite_user_agent: "",
      aceite_hash: "",
    });
    return filterContractAnexosBySlugs(filled, [servicoSlug]);
  }, [template, vars, servicoSlug]);

  function handlePrint() {
    if (!template) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${template.titulo} — v${template.versao}</title>
      <style>
        body{font-family:Georgia,'Times New Roman',serif;color:#0a0a0a;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.65;font-size:13px;}
        h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:0.04em;}
        h2,h3{font-size:13px;text-transform:uppercase;letter-spacing:0.04em;margin-top:24px;}
        p{margin:10px 0;text-align:justify;}
        ul,ol{padding-left:22px;} li{margin:6px 0;}
        @media print { body{margin:0;} }
      </style></head><body>${renderedHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
  }

  return (
    <div style={{ marginTop: 14, border: "1px solid #E5E5E5", background: "#FFFFFF" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          borderBottom: open ? "1px solid #E5E5E5" : "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#0A0A0A" }}>
          <FileText size={14} />
          <span style={{
            fontFamily: "Oswald, sans-serif",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em",
          }}>
            Ler o contrato completo agora
          </span>
        </span>
        <ChevronDown
          size={16}
          color="#737373"
          style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div style={{ padding: "14px 16px" }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#737373", fontSize: 12 }}>
              <Loader2 size={14} style={{ animation: "qa-spin 1s linear infinite" }} />
              Carregando minuta…
            </div>
          )}
          {erro && !loading && (
            <div style={{ fontSize: 12, color: "#7A1F2B" }}>{erro}</div>
          )}
          {!loading && template && (
            <>
              <div
                style={{
                  maxHeight: 420,
                  overflowY: "auto",
                  border: "1px solid #F5F5F5",
                  background: "#FAFAFA",
                  padding: "16px 18px",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  color: "#171717",
                }}
                className="qa-inline-contract-prose"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
                    padding: "8px 12px",
                    background: "transparent",
                    border: "1px solid #E5E5E5",
                    color: "#0A0A0A",
                    cursor: "pointer",
                  }}
                >
                  Baixar / Imprimir
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}