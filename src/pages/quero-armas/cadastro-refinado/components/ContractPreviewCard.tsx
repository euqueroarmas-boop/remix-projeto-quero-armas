import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  filterContractAnexosBySlugs,
  type ContractAnexoFilterDebug,
} from "@/lib/quero-armas/contractAnexoFilter";
import type { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  precoServico: number;
  nomeServico?: string | null;
}

function renderVariables(html: string, vars: Record<string, string>) {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? "");
  }
  // Limpa variáveis ainda não resolvidas (mantém placeholder visual)
  out = out.replace(/\{\{[a-z_]+\}\}/gi, "—");
  return out;
}

export default function ContractPreviewCard({ state, precoServico, nomeServico }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<{ titulo: string; corpo_html: string; versao: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("qa_contract_templates")
        .select("titulo, corpo_html, versao")
        .eq("codigo", "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS")
        .eq("vigente", true)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        setErro("Não foi possível carregar a minuta. Você pode prosseguir; o contrato será gerado no aceite.");
      } else {
        setTemplate(data as any);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const renderedHtml = useMemo(() => {
    if (!template) return "";
    const d = state.dadosPessoais;
    const endereco = [
      d.endereco_logradouro,
      d.endereco_numero && `nº ${d.endereco_numero}`,
      d.endereco_complemento,
      d.endereco_bairro,
      d.endereco_cidade && d.endereco_estado ? `${d.endereco_cidade}/${d.endereco_estado}` : d.endereco_cidade,
      d.endereco_cep && `CEP ${d.endereco_cep}`,
    ].filter(Boolean).join(", ");

    const preco = `R$ ${(precoServico || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Bundle: serviço resumo mostra a lista completa dos slugs.
    const slugsBundle =
      state.servicosSlugs && state.servicosSlugs.length > 0
        ? state.servicosSlugs
        : state.servicoSlug
          ? [state.servicoSlug]
          : [];
    const servicoNomeFinal =
      slugsBundle.length > 1
        ? `${slugsBundle.length} serviços contratados em conjunto: ${slugsBundle.join("; ")}`
        : nomeServico || state.servicoSlug || "—";
    const servicoSlugFinal =
      slugsBundle.length > 0 ? slugsBundle.join(",") : (state.servicoSlug || "—");

    const vars: Record<string, string> = {
      cliente_nome: d.nome_completo || "—",
      cliente_cpf_cnpj: d.cpf || "—",
      cliente_endereco: endereco || "—",
      cliente_email: d.email || "—",
      cliente_telefone: d.telefone || "—",
      servico_slug: servicoSlugFinal,
      servico_nome: servicoNomeFinal,
      servico_preco: preco,
      // Campos só preenchidos no momento do aceite (edge function)
      aceite_data: "",
      aceite_ip: "",
      aceite_user_agent: "",
      aceite_hash: "",
    };

    const filled = renderVariables(template.corpo_html, vars);
    // Filtra para manter apenas as <section data-anexo-slug> dos serviços
    // contratados (slug único ou bundle). Sem match → fail-open.
    // Array-only. NUNCA usar join(",") para filtrar anexos.
    const slugsParaFiltrar: string[] =
      state.servicosSlugs && state.servicosSlugs.length > 0
        ? state.servicosSlugs
        : state.servicoSlug
          ? [state.servicoSlug]
          : [];
    const debug: ContractAnexoFilterDebug | undefined = import.meta.env.DEV
      ? {
          slugsContratados: [],
          sectionsAnexoSlugFound: [],
          sectionsAnexoSlugKept: [],
          anexoIBlocksFound: [],
          anexoIBlocksKept: [],
          anexoIBlocksRemoved: [],
        }
      : undefined;
    const out = filterContractAnexosBySlugs(
      filled,
      slugsParaFiltrar,
      debug ? { debug } : undefined,
    );
    if (import.meta.env.DEV && debug) {
      // eslint-disable-next-line no-console
      console.debug("[ContractPreviewCard] filtro de anexos", {
        servicoSlug: state.servicoSlug,
        servicosSlugs: state.servicosSlugs,
        slugsParaFiltrar,
        ...debug,
      });
    }
    return out;
  }, [template, state.dadosPessoais, state.servicoSlug, state.servicosSlugs, nomeServico, precoServico]);

  function handleDownload() {
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
        .qa-ref-contract-anexo{background:#fdecee;border-left:3px solid #7a1f2b;padding:8px 12px;}
        @media print { body{margin:0;} }
      </style></head><body>${renderedHtml}</body></html>`);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 400);
  }

  return (
    <div className="qa-ref-contract-card">
      <button
        type="button"
        className="qa-ref-contract-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <span className="qa-ref-caps" style={{ display: "block", fontSize: 10.5, marginBottom: 4 }}>
            Contrato de prestação de serviços {template ? `· v${template.versao}` : ""}
          </span>
          <span className="qa-ref-serif" style={{ fontSize: 17 }}>
            {template?.titulo || "Carregando minuta…"}
          </span>
        </span>
        <ChevronDown
          size={18}
          style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div className={`qa-ref-contract-body is-open`}>
          {loading && <div className="qa-ref-empty">Carregando minuta…</div>}
          {erro && <div className="qa-ref-error-text">{erro}</div>}
          {!loading && template && (
            <>
              <div className="qa-ref-contract-prose" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
              <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="qa-ref-btn qa-ref-btn-ghost" onClick={handleDownload}>
                  Baixar PDF (imprimir)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}