// ============================================================================
// AcessoGovBrPanel — Bloco 2: acesso ao gov.br para a equipe protocolar
// ----------------------------------------------------------------------------
// O protocolo do requerimento é feito no site da Polícia Federal com a conta do
// PRÓPRIO cliente — não existe acesso de despachante. Para a equipe entregar o
// dossiê e acompanhar o processo, ela precisa entrar como ele.
//
// São DUAS coisas diferentes, e confundir as duas é o que trava o passo:
//
//   1. A SENHA do gov.br. Guardada aqui, cifrada, uma vez só.
//   2. O CÓDIGO de acesso da verificação em duas etapas. Esse NÃO dá para
//      guardar: é gerado no aplicativo gov.br do cliente, vale por instantes e
//      só existe no celular dele.
//
// O que resolve o item 2 sem virar pedido eterno de código: na primeira vez que
// a equipe entra, ela marca "Não solicitar verificação em duas etapas novamente
// neste navegador". A partir daí o navegador da equipe consta como dispositivo
// AUTORIZADO e o código não é mais pedido. Ou seja: o cliente gera UM código,
// uma vez, e pronto.
//
// Fonte: gov.br/governodigital — Segurança da conta (prints de 16/08/2026).
// O código só sai do app gov.br, nunca por SMS, e nenhum outro autenticador
// (Google Authenticator, Authy, Microsoft) consegue gerar.
//
// Renderizado como `corpo` de uma pendência do PendenciasGuiadasPopup.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const URL_SEGURANCA_GOVBR =
  "https://www.gov.br/governodigital/pt-br/identidade/conta-gov-br/seguranca-da-conta";

/** Passos para gerar o código de acesso, na ordem do app gov.br. */
const PASSOS_CODIGO: string[] = [
  "Abra o aplicativo gov.br no seu celular e faça login.",
  'Toque em "Gerar código de acesso". O código aparece na tela e vale por pouco tempo.',
  "Mande esse código para a nossa equipe assim que ela pedir — só será preciso uma vez.",
];

/** O que costuma dar errado na hora de gerar o código. */
const ARMADILHAS_CODIGO: string[] = [
  "O código NÃO chega por SMS. Só existe dentro do aplicativo gov.br.",
  "Google Authenticator, Authy e Microsoft Authenticator não geram esse código.",
  'No celular, deixe "data e hora automáticas" ligado — senão o código nasce inválido.',
];

interface StatusSenha {
  tem_senha: boolean;
  atualizada_em: string | null;
}

export interface AcessoGovBrPanelProps {
  /** Chamado depois de guardar, para o portal recarregar o checklist. */
  onConcluido?: () => void;
}

function formatarData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function AcessoGovBrPanel({ onConcluido }: AcessoGovBrPanelProps) {
  const [status, setStatus] = useState<StatusSenha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [trocando, setTrocando] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("qa-senha-gov-cliente", {
        body: { action: "status" },
      });
      if (error) throw error;
      setStatus(data as StatusSenha);
    } catch {
      setStatus(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus]);

  const salvar = async () => {
    if (senha.trim().length < 6) {
      toast.error("Digite a sua senha do gov.br.");
      return;
    }
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-senha-gov-cliente", {
        body: { action: "set", senha },
      });
      if (error || (data as { error?: string })?.error) {
        toast.error((data as { error?: string })?.error ?? "Não foi possível guardar. Tente de novo.");
        return;
      }
      // A senha sai da memória da tela assim que é guardada — não fica em
      // estado do React esperando alguém tirar print.
      setSenha("");
      setMostrar(false);
      setTrocando(false);
      toast.success("Acesso guardado com segurança.");
      await carregarStatus();
      onConcluido?.();
    } catch {
      toast.error("Erro ao guardar o acesso. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const jaTem = !!status?.tem_senha;
  const mostrarFormulario = !jaTem || trocando;

  return (
    <div className="space-y-3">
      {/* Por que estamos pedindo isso */}
      <div className="rounded-lg border border-[#E5C2C6] bg-[#FBF3F4] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7A1F2B]">
          <Lock className="h-3.5 w-3.5" />
          Chegou o momento de entregar à delegacia
        </p>
        <p className="mt-1 text-[12px] leading-snug text-[#7A1F2B]">
          A sua documentação está completa e a petição está pronta. Agora falta liberar o acesso
          para a nossa equipe fazer a última conferência e enviar os seus documentos à Polícia
          Federal. O protocolo é feito na sua conta gov.br — não existe acesso de despachante.
          Você autoriza, a gente protocola.
        </p>
      </div>

      {/* Senha */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
            Parte 1 · Sua senha do gov.br
          </h4>
        </header>

        <div className="p-3">
          {carregando ? (
            <p className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando…
            </p>
          ) : jaTem && !trocando ? (
            <>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" />
                Senha guardada
                {status?.atualizada_em ? ` em ${formatarData(status.atualizada_em)}` : ""}.
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                Se você trocou a senha no gov.br, atualize aqui — senão a equipe não consegue
                entrar e o processo para.
              </p>
              <button
                type="button"
                onClick={() => setTrocando(true)}
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#8A1224] bg-white px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#8A1224] transition-colors hover:bg-[#FFF7F8]"
              >
                Atualizar a senha
              </button>
            </>
          ) : null}

          {mostrarFormulario && (
            <>
              <label className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Senha da sua conta gov.br
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type={mostrar ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Digite a sua senha"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-[13px] outline-none focus:border-[#8A1224]"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#8A1224] px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#6f0f1e] disabled:opacity-60"
              >
                {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {salvando ? "Guardando" : "Guardar com segurança"}
              </button>
              {trocando && (
                <button
                  type="button"
                  onClick={() => { setTrocando(false); setSenha(""); }}
                  className="mt-1.5 w-full text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-500"
                >
                  Cancelar
                </button>
              )}
            </>
          )}

          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-600">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              A senha é guardada criptografada. Ninguém da equipe consegue vê-la na tela do
              sistema, e toda vez que ela é usada fica registrado quem usou, quando e de onde.
            </span>
          </p>
        </div>
      </section>

      {/* Código de acesso (2 etapas) */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700">
            Parte 2 · O código de acesso, uma vez só
          </h4>
          <p className="mt-1 text-[11px] leading-snug text-slate-600">
            Gere o código agora, no seu celular, para a nossa equipe fazer a última conferência e
            enviar os seus documentos. Não adianta gerar antes: ele vale por poucos minutos e
            nasce no seu aparelho, então tem que ser no momento em que a equipe estiver entrando.
          </p>
        </header>

        <div className="p-3">
          <ol className="space-y-1.5 border-l-2 border-[#E5C2C6] pl-3">
            {PASSOS_CODIGO.map((passo, i) => (
              <li key={i} className="text-[12px] leading-snug text-slate-700">
                <span className="mr-1 font-bold text-[#8A1224]">{i + 1}.</span>
                {passo}
              </li>
            ))}
          </ol>

          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-900">
              Por que só uma vez
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-900">
              Ao usar o seu código, a nossa equipe marca a opção{" "}
              <em>"Não solicitar verificação em duas etapas novamente neste navegador"</em>. O
              computador da equipe passa a constar como dispositivo autorizado e o gov.br para de
              pedir código. Você não vai ficar gerando código toda hora.
            </p>
          </div>

          <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              O que costuma dar errado
            </p>
            <ul className="mt-1 space-y-0.5">
              {ARMADILHAS_CODIGO.map((t) => (
                <li key={t} className="text-[11px] leading-snug text-amber-900">• {t}</li>
              ))}
            </ul>
          </div>

          <p className="mt-2 text-[11px] leading-snug text-slate-600">
            O controle continua seu. No aplicativo gov.br, em{" "}
            <strong>Segurança da conta → Verificação em duas etapas → Dispositivos autorizados</strong>,
            você vê o histórico de acessos à sua conta e pode remover o nosso acesso quando quiser.
          </p>
          <a
            href={URL_SEGURANCA_GOVBR}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-700 transition-colors hover:bg-slate-50"
          >
            Ver a página oficial do gov.br
          </a>
        </div>
      </section>
    </div>
  );
}
