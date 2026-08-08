import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, ShieldCheck, AlertTriangle } from "lucide-react";

/**
 * RESIDÊNCIA EM NOME DE TERCEIRO — único caso do sistema em que dados de
 * terceiros são coletados.
 *
 * Quando o comprovante de endereço está no nome de outra pessoa, o documento
 * NÃO é reprovado: o cliente declara que mora ali, informa estado civil,
 * profissão e desde quando reside, e envia o documento de identidade do
 * responsável pelo imóvel. Esse documento passa pelo MESMO parser/IA de
 * qualquer documento e é confrontado com o titular lido no comprovante.
 *
 * Fechar o modal devolve o cliente à fase inicial (enviar o comprovante),
 * porque ele pode conseguir uma conta no próprio nome.
 */

export type ResidenciaTerceiroPayload = {
  responsavel_nome: string;
  responsavel_documento: string | null;
  responsavel_arquivo_path: string | null;
  responsavel_arquivo_nome: string | null;
  /** Estado civil DO RESPONSÁVEL PELO IMÓVEL (preâmbulo da declaração). */
  estado_civil: string;
  /** Profissão DO RESPONSÁVEL PELO IMÓVEL (preâmbulo da declaração). */
  profissao: string;
  /** Desde quando o REQUERENTE mora no endereço — MM/AAAA. */
  mora_desde: string;
  declarado_em: string;
};

import { profissaoOptionsCom } from "@/lib/quero-armas/profissoesCatalogo";

const ESTADOS_CIVIS = ["SOLTEIRO(A)", "CASADO(A)", "DIVORCIADO(A)", "VIÚVO(A)", "UNIÃO ESTÁVEL"];

function normNome(s: string | null | undefined) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nomes batem quando compartilham o primeiro nome e o último sobrenome. */
function nomesConferem(a: string, b: string) {
  const pa = normNome(a).split(" ").filter((w) => w.length > 2);
  const pb = normNome(b).split(" ").filter((w) => w.length > 2);
  if (pa.length < 2 || pb.length < 2) return false;
  if (pa[0] !== pb[0]) return false;
  return pa[pa.length - 1] === pb[pb.length - 1];
}

function cpfComDigitosVerificadores(valor: string | null | undefined): string | null {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return digitos || null;
  const base = digitos.slice(0, 9);
  const calcular = (parcial: string, pesoInicial: number) => {
    const soma = parcial.split("").reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcular(base, 10);
  const d2 = calcular(`${base}${d1}`, 11);
  return `${base}${d1}${d2}`;
}

function sanitize(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
}

async function fileToDataUrl(f: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(f);
  });
}

export default function ResidenciaTerceiroModal({
  open,
  titularComprovante,
  interessadoNome,
  ownerKey,
  onCancelar,
  onConfirmado,
}: {
  open: boolean;
  /** Nome lido no comprovante de endereço (titular da conta). */
  titularComprovante: string | null;
  interessadoNome: string | null;
  /** customer_id ou `qa-<id>`, usado no caminho do storage. */
  ownerKey: string;
  onCancelar: () => void;
  onConfirmado: (dados: ResidenciaTerceiroPayload) => void;
}) {
  const [etapa, setEtapa] = useState<"pergunta" | "dados">("pergunta");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [profissao, setProfissao] = useState("");
  const [moraDesde, setMoraDesde] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [leitura, setLeitura] = useState<{ nome: string | null; cpf: string | null } | null>(null);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    setEtapa("pergunta");
    setEstadoCivil("");
    setProfissao("");
    setMoraDesde("");
    setArquivo(null);
    setLeitura(null);
    setErroLeitura(null);
  }, [open]);

  const confere = useMemo(
    () => (leitura?.nome && titularComprovante ? nomesConferem(leitura.nome, titularComprovante) : false),
    [leitura?.nome, titularComprovante],
  );

  if (!open) return null;

  async function lerDocumentoResponsavel(f: File) {
    setArquivo(f);
    setLeitura(null);
    setErroLeitura(null);
    setLendo(true);
    try {
      const dataUrl = await fileToDataUrl(f);
      const { data, error } = await supabase.functions.invoke("qa-classificar-documento-arma", {
        body: { imageDataUrl: dataUrl },
      });
      if (error) throw error;
      const campos = ((data as any)?.camposExtraidos || {}) as Record<string, string>;
      const nome = campos.nome_completo || campos.nome || null;
       const cpf = cpfComDigitosVerificadores(campos.cpf);
      if (!nome) {
        setErroLeitura("Não conseguimos ler o nome neste documento. Envie o RG, a CNH ou a CIN do responsável em boa qualidade.");
      }
      setLeitura({ nome, cpf });
    } catch (e) {
      setErroLeitura(e instanceof Error ? e.message : "Falha ao ler o documento do responsável.");
    } finally {
      setLendo(false);
    }
  }

  async function confirmar() {
    if (!estadoCivil || !profissao.trim() || !/^\d{2}\/\d{4}$/.test(moraDesde)) {
      toast.error("Preencha o estado civil e a profissão do dono do imóvel e desde quando você mora neste endereço (MM/AAAA).");
      return;
    }
    if (!arquivo) {
      toast.error("Envie o documento de identidade do responsável pelo imóvel.");
      return;
    }
    setSalvando(true);
    try {
      const path = `cliente-docs/${ownerKey}/endereco/responsavel_imovel/${Date.now()}_${sanitize(arquivo.name)}`;
      const { error: upErr } = await supabase.storage
        .from("qa-documentos")
        .upload(path, arquivo, { upsert: false, contentType: arquivo.type });
      if (upErr) throw upErr;
      onConfirmado({
        responsavel_nome: (leitura?.nome || titularComprovante || "").toUpperCase(),
        responsavel_documento: leitura?.cpf ?? null,
        responsavel_arquivo_path: path,
        responsavel_arquivo_nome: arquivo.name,
        estado_civil: estadoCivil,
        profissao: profissao.trim().toUpperCase(),
        mora_desde: moraDesde,
        declarado_em: new Date().toISOString(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o documento do responsável.");
    } finally {
      setSalvando(false);
    }
  }

  const podeConfirmar =
    !!estadoCivil && !!profissao.trim() && /^\d{2}\/\d{4}$/.test(moraDesde) && !!arquivo;

  const requerente = (interessadoNome || "VOCÊ").toUpperCase();
  const titular = (titularComprovante || "OUTRA PESSOA").toUpperCase();

  // MESMO pop-up das pendências guiadas (PendenciasGuiadasPopup): mesma
  // moldura branca, mesmos chips no topo, mesma lista numerada com linha
  // vertical e mesmo rodapé com botão bordô. Nenhuma interface nova.
  const passos: { titulo: string; corpo: React.ReactNode }[] =
    etapa === "pergunta"
      ? [
          {
            titulo: "Confirme se você mora neste imóvel",
            corpo: (
              <>
                A conta está em nome de <strong>{titular}</strong> e não de <strong>{requerente}</strong>.
                Isso <strong>não reprova</strong> o documento — a Polícia Federal só precisa saber onde você
                tem residência fixa, porque é nesse imóvel que a arma ficará guardada.
              </>
            ),
          },
          {
            titulo: "Informe o estado civil e a profissão do dono do imóvel",
            corpo: (
              <>
                Estado civil e profissão de <strong>{titular}</strong> compõem o preâmbulo da declaração do
                responsável pelo imóvel, que será gerada na sequência. De <strong>{requerente}</strong> pedimos
                apenas desde quando mora neste endereço.
              </>
            ),
          },
          {
            titulo: "Depois, envie o documento de identidade do dono da conta",
            corpo: (
              <>
                RG, CNH ou CIN de <strong>{titular}</strong> — a pessoa que aparece no comprovante. É o
                cruzamento final: o documento é conferido com o titular lido na conta.
              </>
            ),
          },
        ]
      : [];

  const conteudo = (
    <div
      // Este overlay fica dentro do DialogContent pai. Não use captura de
      // pointerdown aqui: ela interrompe o evento antes de chegar aos inputs
      // e impede que eles recebam foco/teclado.
      data-qa-overlay="residencia-terceiro"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full sm:max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh]">
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header — mesmos chips do pop-up de pendências */}
        <div className="px-6 pt-8 pb-4 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              Comprovação de endereço
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              Exigência do processo
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              Conta em nome de terceiro
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] leading-tight tracking-tight">
            {etapa === "pergunta"
              ? "Este endereço está no nome de outra pessoa"
              : "Sobre você e sobre o dono da conta"}
          </h2>
          <p className="mt-2 rounded-md border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[13px] leading-relaxed text-[#3A3A3A]">
            Titular da conta: <strong>{titular}</strong> · Interessado no processo: <strong>{requerente}</strong>
          </p>
        </div>

        {/* Corpo rolável (com fade suave no topo/base para o corte não parecer borda) */}
        <div className="relative flex-1 min-h-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5 z-10 bg-gradient-to-b from-white to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 z-10 bg-gradient-to-t from-white to-transparent" />
          <div className="h-full overflow-y-auto px-6 pt-2 pb-4">
          {etapa === "pergunta" ? (
            <div className="relative">
              <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#E4E4E4]" />
              <ul className="space-y-5 relative">
                {passos.map((p, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFF7F8] text-[#8A1224] border border-[#8A1224]/10 flex items-center justify-center text-xs font-bold z-10">
                      {i + 1}
                    </span>
                    <div className="pt-1">
                      <p className="text-[14px] font-semibold leading-snug text-[#0A0A0A]">{p.titulo}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-[#3A3A3A]">{p.corpo}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-6">
              {/* BLOCO 1 — dados DO REQUERENTE (fica explícito de quem são) */}
              <section className="rounded-xl border border-[#8A1224]/15 bg-[#FFF7F8] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A1224]">
                  Bloco 1 · Dados de {titular} — dono do imóvel
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#3A3A3A]">
                  <strong>Estado civil e profissão são de {titular}</strong>, o responsável pelo imóvel — não
                  seus. Eles formam o preâmbulo da <strong>declaração do responsável pelo imóvel</strong> que
                  será gerada na sequência.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#6A6A6A]">
                      Estado civil de {titular}
                    </span>
                    <select
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-[#CFCFCF] bg-white px-3 text-[13px] uppercase text-[#0A0A0A] focus:border-[#8A1224] focus:outline-none"
                    >
                      <option value="">SELECIONE</option>
                      {ESTADOS_CIVIS.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#6A6A6A]">
                      Profissão de {titular}
                    </span>
                    <select
                      value={profissao}
                      onChange={(e) => setProfissao(e.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border border-[#CFCFCF] bg-white px-3 text-[13px] uppercase text-[#0A0A0A] focus:border-[#8A1224] focus:outline-none"
                    >
                      <option value="">SELECIONE</option>
                      {profissaoOptionsCom(profissao).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#6A6A6A]">
                      {requerente} mora neste endereço desde (dado seu)
                    </span>
                    <input
                      value={moraDesde}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setMoraDesde(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                      }}
                      inputMode="numeric"
                      placeholder="MM/AAAA"
                      autoComplete="off"
                      className="mt-1 h-11 w-full rounded-lg border border-[#CFCFCF] bg-white px-3 text-[13px] text-[#0A0A0A] focus:border-[#8A1224] focus:outline-none"
                    />
                  </label>
                </div>
              </section>

              {/* BLOCO 2 — documento DO DONO DO IMÓVEL */}
              <section className="rounded-xl border border-[#E4E4E4] bg-[#FAFAFA] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6A6A6A]">
                  Bloco 2 · Documento de {titular}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#3A3A3A]">
                  <strong>Este documento NÃO é seu</strong>: é o RG, a CNH ou a CIN de <strong>{titular}</strong>,
                  a pessoa que aparece na conta. Ele passa pela mesma leitura automática e é confrontado com o
                  titular do comprovante.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void lerDocumentoResponsavel(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={lendo}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#0A0A0A] bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-60 transition-colors"
                >
                  {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {lendo ? "Lendo documento" : arquivo ? "Trocar documento" : "Anexar documento"}
                </button>
                {arquivo ? (
                  <p className="mt-2 truncate text-[11px] text-[#6A6A6A]">{arquivo.name}</p>
                ) : null}

                {leitura?.nome ? (
                  <div
                    className={`mt-3 flex gap-2 rounded-lg border p-3 text-[12px] ${
                      confere
                        ? "border-[#1F7A3F]/40 bg-[#1F7A3F]/5 text-[#1F5F33]"
                        : "border-[#8A1224]/40 bg-[#8A1224]/5 text-[#8A1224]"
                    }`}
                  >
                    {confere ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>
                      {confere
                        ? `Confere: o documento é de ${leitura.nome.toUpperCase()}, mesmo titular da conta.`
                        : `O documento é de ${leitura.nome.toUpperCase()}, que não é o titular do comprovante (${titular}).`}
                    </span>
                  </div>
                ) : null}
                {erroLeitura ? (
                  <p className="mt-2 text-[12px] text-[#8A1224]">{erroLeitura}</p>
                ) : null}
              </section>
            </div>
          )}
        </div>

        {/* Rodapé — mesmo padrão do pop-up de pendências */}
        <div className="mt-auto border-t border-[#E4E4E4] bg-white shrink-0">
          <div className="px-6 py-3 flex justify-between items-center border-b border-[#F0F0F0]">
            <span className="text-[10px] font-bold text-[#6A6A6A] tracking-widest uppercase">
              Resolva um por vez
            </span>
            <span className="text-[10px] font-bold text-[#8A1224] tracking-widest uppercase">
              {etapa === "pergunta" ? "Passo 1 de 2" : "Passo 2 de 2"}
            </span>
          </div>

          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 items-stretch gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-[#E4E4E4] bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              {etapa === "pergunta" ? "Não · enviar outra conta" : "Enviar outra conta"}
            </button>
            {etapa === "pergunta" ? (
              <button
                type="button"
                onClick={() => setEtapa("dados")}
                className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[#8A1224] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-[#6f0f1e] transition-colors"
              >
                Sim, eu moro aqui
              </button>
            ) : (
              <button
                type="button"
                onClick={confirmar}
                disabled={salvando || lendo || !podeConfirmar}
                className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[#8A1224] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-[#6f0f1e] disabled:opacity-50 transition-colors"
              >
                {salvando ? "Enviando" : "Confirmar residência"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Renderizado dentro da árvore do Dialog pai: assim o focus trap do Radix
  // reconhece os campos como internos e libera a digitação.
  return conteudo;
}