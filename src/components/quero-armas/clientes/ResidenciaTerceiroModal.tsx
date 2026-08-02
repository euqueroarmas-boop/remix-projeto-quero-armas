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
  estado_civil: string;
  profissao: string;
  mora_desde: string; // MM/AAAA
  declarado_em: string;
};

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
      const cpf = campos.cpf || null;
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
      toast.error("Preencha estado civil, profissão e desde quando você mora neste endereço (MM/AAAA).");
      return;
    }
    if (!arquivo || !leitura?.nome) {
      toast.error("Envie o documento de identidade do responsável pelo imóvel.");
      return;
    }
    if (!confere) {
      toast.error("O documento enviado não é da pessoa que consta como titular do comprovante de endereço.");
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
        responsavel_nome: leitura.nome.toUpperCase(),
        responsavel_documento: leitura.cpf,
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

  return (
    <div
      // O Dialog do Radix aplica pointer-events:none no body enquanto está
      // aberto — sem forçar auto aqui, nenhum clique deste modal chega.
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-sm border border-[#E5E5E5] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4">
          <div>
            <p className="font-['Oswald'] text-[10px] tracking-[0.2em] uppercase text-[#7A1F2B]">
              Comprovação de endereço
            </p>
            <h2 className="font-['Oswald'] text-[18px] uppercase tracking-[0.06em] text-[#0A0A0A]">
              Este endereço é de outro titular
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Fechar"
            className="rounded-full bg-[#7A1F2B] p-1.5 text-white hover:bg-[#5f1721]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 text-[13px] text-[#2A2A2A]">
          <p>
            A conta está em nome de{" "}
            <strong className="uppercase">{titularComprovante || "outra pessoa"}</strong>
            {interessadoNome ? (
              <> e não de <strong className="uppercase">{interessadoNome}</strong></>
            ) : null}
            . Isso não reprova o documento — a Polícia Federal só precisa saber onde você tem residência fixa,
            porque é nesse imóvel que a arma ficará guardada.
          </p>

          {etapa === "pergunta" ? (
            <div className="space-y-3">
              <p className="font-['Oswald'] uppercase tracking-[0.08em] text-[#0A0A0A]">
                Você realmente mora neste endereço?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEtapa("dados")}
                  className="flex-1 rounded-sm bg-[#7A1F2B] px-4 py-3 font-['Oswald'] text-[12px] uppercase tracking-[0.14em] text-white hover:bg-[#5f1721]"
                >
                  Sim, moro aqui
                </button>
                <button
                  type="button"
                  onClick={onCancelar}
                  className="flex-1 rounded-sm border border-[#CFCFCF] px-4 py-3 font-['Oswald'] text-[12px] uppercase tracking-[0.14em] text-[#0A0A0A] hover:border-[#0A0A0A]"
                >
                  Não · enviar outra conta
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="block font-['Oswald'] text-[10px] uppercase tracking-[0.16em] text-[#6B6B6B]">Estado civil</span>
                  <select
                    value={estadoCivil}
                    onChange={(e) => setEstadoCivil(e.target.value)}
                    className="mt-1 h-9 w-full rounded-sm border border-[#CFCFCF] px-2 text-[13px] uppercase"
                  >
                    <option value="">SELECIONE</option>
                    {ESTADOS_CIVIS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block font-['Oswald'] text-[10px] uppercase tracking-[0.16em] text-[#6B6B6B]">Profissão</span>
                  <input
                    value={profissao}
                    onChange={(e) => setProfissao(e.target.value.toUpperCase())}
                    placeholder="EX.: EMPRESÁRIO"
                    className="mt-1 h-9 w-full rounded-sm border border-[#CFCFCF] px-2 text-[13px] uppercase"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="block font-['Oswald'] text-[10px] uppercase tracking-[0.16em] text-[#6B6B6B]">
                    Mora neste endereço desde
                  </span>
                  <input
                    value={moraDesde}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setMoraDesde(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                    }}
                    placeholder="MM/AAAA"
                    className="mt-1 h-9 w-full rounded-sm border border-[#CFCFCF] px-2 text-[13px]"
                  />
                </label>
              </div>

              <div className="rounded-sm border border-[#E5E5E5] bg-[#FAFAFA] p-3">
                <p className="font-['Oswald'] text-[10px] uppercase tracking-[0.16em] text-[#6B6B6B]">
                  Documento de identidade do responsável pelo imóvel
                </p>
                <p className="mt-1 text-[12px] text-[#4A4A4A]">
                  RG, CNH ou CIN de quem consta na conta. O documento passa pela mesma leitura automática e é
                  confrontado com o titular do comprovante.
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
                  className="mt-3 inline-flex items-center gap-2 rounded-sm border border-[#0A0A0A] px-3 py-2 font-['Oswald'] text-[11px] uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-60"
                >
                  {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {lendo ? "Lendo documento" : arquivo ? "Trocar documento" : "Anexar documento"}
                </button>
                {arquivo ? (
                  <p className="mt-2 truncate text-[11px] text-[#6B6B6B]">{arquivo.name}</p>
                ) : null}

                {leitura?.nome ? (
                  <div
                    className={`mt-3 flex gap-2 rounded-sm border p-2 text-[12px] ${
                      confere
                        ? "border-[#1F7A3F]/40 bg-[#1F7A3F]/5 text-[#1F5F33]"
                        : "border-[#7A1F2B]/40 bg-[#7A1F2B]/5 text-[#7A1F2B]"
                    }`}
                  >
                    {confere ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>
                      {confere
                        ? `Confere: o documento é de ${leitura.nome.toUpperCase()}, mesmo titular da conta.`
                        : `O documento é de ${leitura.nome.toUpperCase()}, que não é o titular do comprovante (${(titularComprovante || "").toUpperCase()}).`}
                    </span>
                  </div>
                ) : null}
                {erroLeitura ? (
                  <p className="mt-2 text-[12px] text-[#7A1F2B]">{erroLeitura}</p>
                ) : null}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="flex-1 rounded-sm border border-[#CFCFCF] px-4 py-3 font-['Oswald'] text-[12px] uppercase tracking-[0.14em] text-[#0A0A0A] hover:border-[#0A0A0A]"
                >
                  Enviar outra conta
                </button>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={salvando || lendo || !confere}
                  className="flex-1 rounded-sm bg-[#7A1F2B] px-4 py-3 font-['Oswald'] text-[12px] uppercase tracking-[0.14em] text-white hover:bg-[#5f1721] disabled:opacity-50"
                >
                  {salvando ? "Enviando" : "Confirmar residência"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}