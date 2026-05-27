// ============================================================================
// QAWizardKycPreviewPage (DEV-ONLY)
// ----------------------------------------------------------------------------
// Rota temporária `/dev/wizard-kyc-preview` para QA visual do
// DocumentDataOnboardingWizard SEM precisar de login real nem banco real.
//
// Estratégia: monkey-patch de `window.fetch` + `supabase.auth.getSession`
// apenas enquanto a página está montada. Restaura no unmount.
//
// Mocka:
//   - probe → devolve 8 placeholders faltando
//   - save (cliente/processo) → ok imediato
//   - generate final → devolve Blob .docx fake (~1KB)
//   - REST qa_clientes / qa_processos / qa_processo_documentos → linhas vazias
//
// Esta rota é montada APENAS quando `import.meta.env.DEV === true`.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DocumentDataOnboardingWizard from "@/components/quero-armas/portal/DocumentDataOnboardingWizard";

const SUPA = (import.meta.env.VITE_SUPABASE_URL as string) || "";

function makeFakeDocxBlob(): Blob {
  // .docx mínimo é zip; aqui só precisamos passar do guard de tamanho (>200).
  const txt = "PK".padEnd(1024, "x");
  return new Blob([txt], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

const MISSING = [
  { token: "[CELULAR]", key: "celular", source: "cliente" },
  { token: "[NOME CLUBE]", key: "nome_clube", source: "processo" },
  { token: "[CNPJ CLUBE]", key: "cnpj_clube", source: "processo" },
  { token: "[NUMERO CR CLUBE]", key: "numero_cr_clube", source: "processo" },
  { token: "[DATA CR CLUBE]", key: "data_cr_clube", source: "processo" },
  { token: "[ENDERECO CLUBE]", key: "endereco_clube", source: "processo" },
  { token: "[NUMERO FILIACAO]", key: "numero_filiacao", source: "processo" },
  { token: "[VALIDADE FILIACAO]", key: "validade_filiacao", source: "processo" },
];

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default function QAWizardKycPreviewPage() {
  const [open, setOpen] = useState(false);
  const [patched, setPatched] = useState(false);
  const [round, setRound] = useState(0);
  const [generated, setGenerated] = useState<string | null>(null);
  const probeCountRef = useRef(0);

  // ---------------- monkey-patch fetch + auth ----------------
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const origFetch = window.fetch.bind(window);
    const origGetSession = supabase.auth.getSession.bind(supabase.auth);

    // Sessão fake (token bobo) só pro engine não estourar.
    (supabase.auth as any).getSession = async () => ({
      data: {
        session: {
          access_token: "dev-preview-fake-token",
          user: { id: "00000000-0000-0000-0000-000000000000" },
        },
      },
      error: null,
    });

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);

      // Edge functions
      if (url.includes("/functions/v1/qa-fill-template-cliente")) {
        let body: any = {};
        try { body = JSON.parse((init?.body as string) ?? "{}"); } catch { /* ignore */ }
        if (body.probe) {
          probeCountRef.current += 1;
          return jsonResp({
            ok: false,
            missing_placeholders: MISSING,
            unknown_placeholders: [],
          });
        }
        // Geração final → blob fake
        return new Response(makeFakeDocxBlob(), {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }
      if (url.includes("/functions/v1/qa-cliente-atualizar-cadastro")) {
        await new Promise((r) => setTimeout(r, 250));
        return jsonResp({ ok: true });
      }
      if (url.includes("/functions/v1/qa-processo-template-data-salvar")) {
        await new Promise((r) => setTimeout(r, 250));
        return jsonResp({ ok: true });
      }

      // REST PostgREST: mocka tabelas-chave como vazias / mínimas
      if (SUPA && url.startsWith(`${SUPA}/rest/v1/`)) {
        if (url.includes("/qa_clientes")) {
          return jsonResp([{ id: 1, celular: "", nome_completo: "CLIENTE DEMO", cpf: "" }]);
        }
        if (url.includes("/qa_processos")) {
          return jsonResp([{ respostas_questionario_json: { template_data: {} } }]);
        }
        if (url.includes("/qa_processo_documentos")) {
          return jsonResp([]);
        }
      }

      return origFetch(input as any, init);
    }) as typeof window.fetch;

    setPatched(true);
    setOpen(true);
    return () => {
      window.fetch = origFetch;
      (supabase.auth as any).getSession = origGetSession;
    };
  }, []);

  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-sm text-slate-600">
          Rota de QA disponível apenas em ambiente de desenvolvimento.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-extrabold text-slate-900">
            QA Visual — Wizard KYC (DEV-ONLY)
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Rota temporária <code className="rounded bg-slate-100 px-1">/dev/wizard-kyc-preview</code>.
            Não acessível em produção. Mocka probe/save/generate sem tocar no banco.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setGenerated(null); setRound((r) => r + 1); setOpen(true); }}
              className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-bold text-white"
            >
              Reabrir wizard
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
            >
              Fechar
            </button>
          </div>
          {generated && (
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
              ✓ Geração simulada concluída — arquivo: <strong>{generated}</strong>
            </p>
          )}
        </header>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-[11px] text-slate-400">
          O wizard abre como Dialog acima desta área.
        </div>
      </div>

      <DocumentDataOnboardingWizard
        key={round}
        open={open}
        onClose={() => setOpen(false)}
        processoId="00000000-0000-0000-0000-000000000abc"
        clienteId={1}
        templateKey="declaracao-cac"
        documentoNome="Declaração CAC (DEMO)"
        onGenerated={(_blob, filename) => setGenerated(filename)}
      />
    </div>
  );
}