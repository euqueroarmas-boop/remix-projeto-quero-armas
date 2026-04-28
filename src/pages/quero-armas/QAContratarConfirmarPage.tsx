import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  CheckCircle2,
  MapPin,
  User,
  FileCheck2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

/**
 * QAContratarConfirmarPage — Cliente logado.
 * 3 passos curtos:
 *  1) Endereço ainda é o mesmo? (se não, atualiza)
 *  2) Estado civil / profissão mudaram? (se sim, atualiza)
 *  3) Confirma — cria processo + checklist (RPC qa_criar_processo_logado)
 *
 * Sem checkout (validação manual conforme decisão do gestor).
 * Reaproveita docs já enviados em outros processos do cliente (CNH, comprovantes etc).
 */

interface Catalogo {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
  gera_processo: boolean;
  servico_id: number | null;
}

interface ClienteData {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  estado_civil: string | null;
  profissao: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const ESTADOS_CIVIS = ["SOLTEIRO(A)", "CASADO(A)", "DIVORCIADO(A)", "VIÚVO(A)", "UNIÃO ESTÁVEL"];

export default function QAContratarConfirmarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [docsReaproveitados, setDocsReaproveitados] = useState<string[]>([]);

  // Step 1: endereço
  const [enderecoOk, setEnderecoOk] = useState<"sim" | "nao" | null>(null);
  const [novoCep, setNovoCep] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComplemento, setNovoComplemento] = useState("");
  const [novoBairro, setNovoBairro] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");

  // Step 2: dados pessoais
  const [dadosOk, setDadosOk] = useState<"sim" | "nao" | null>(null);
  const [novoEstadoCivil, setNovoEstadoCivil] = useState("");
  const [novaProfissao, setNovaProfissao] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/identificar`, { replace: true });
        return;
      }
      const uid = sess.session.user.id;

      // Catálogo
      const { data: cat } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("id, slug, nome, descricao_curta, preco, recorrente, gera_processo, servico_id")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (!cat) {
        toast.error("Serviço não encontrado.");
        navigate("/area-do-cliente/contratar", { replace: true });
        return;
      }
      setCatalogo(cat as any);

      // Cliente vinculado
      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", uid)
        .not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const clienteId = (link as any)?.qa_cliente_id;
      if (!clienteId) {
        toast.error("Cadastro de cliente não encontrado.");
        navigate("/area-do-cliente", { replace: true });
        return;
      }

      const { data: cli } = await supabase
        .from("qa_clientes")
        .select(
          "id, nome_completo, cpf, email, estado_civil, profissao, cep, endereco, numero, complemento, bairro, cidade, estado"
        )
        .eq("id", clienteId)
        .maybeSingle();
      if (cli) setCliente(cli as any);

      // Documentos reaproveitáveis (já validados em outros processos)
      const { data: docs } = await supabase
        .from("qa_processo_documentos")
        .select("tipo_documento, nome_documento, status")
        .eq("cliente_id", clienteId)
        .in("status", ["validado", "aprovado"])
        .limit(50);
      if (docs) {
        const uniques = Array.from(
          new Map(
            (docs as any[]).map((d) => [d.tipo_documento, d.nome_documento as string])
          ).values()
        );
        setDocsReaproveitados(uniques);
      }

      setLoading(false);
    })();
  }, [slug, navigate]);

  const enderecoAtualLinha = useMemo(() => {
    if (!cliente) return "";
    return [
      cliente.endereco,
      cliente.numero,
      cliente.complemento,
      cliente.bairro,
      cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade,
      cliente.cep,
    ]
      .filter(Boolean)
      .join(", ");
  }, [cliente]);

  const podeConfirmar =
    enderecoOk !== null && dadosOk !== null && !submitting && !loading && cliente && catalogo;

  async function handleConfirmar() {
    if (!cliente || !catalogo) return;
    setSubmitting(true);
    try {
      // 1) Atualiza dados básicos se o cliente disse que mudou algo
      if (enderecoOk === "nao" || dadosOk === "nao") {
        const { error: errUpd } = await supabase.rpc(
          "qa_atualizar_dados_basicos_cliente" as any,
          {
            p_cliente_id: cliente.id,
            p_estado_civil: dadosOk === "nao" ? novoEstadoCivil : null,
            p_profissao: dadosOk === "nao" ? novaProfissao : null,
            p_cep: enderecoOk === "nao" ? novoCep : null,
            p_endereco: enderecoOk === "nao" ? novoEndereco : null,
            p_numero: enderecoOk === "nao" ? novoNumero : null,
            p_complemento: enderecoOk === "nao" ? novoComplemento : null,
            p_bairro: enderecoOk === "nao" ? novoBairro : null,
            p_cidade: enderecoOk === "nao" ? novaCidade : null,
            p_estado: enderecoOk === "nao" ? novoEstado : null,
          } as any
        );
        if (errUpd) throw errUpd;
      }

      // 2) Cria processo via RPC
      const { data: novoId, error: errCreate } = await supabase.rpc(
        "qa_criar_processo_logado" as any,
        {
          p_cliente_id: cliente.id,
          p_catalogo_slug: catalogo.slug,
          p_observacoes: `Contratação via portal logado | Docs reaproveitados: ${docsReaproveitados.length}`,
        } as any
      );
      if (errCreate) throw errCreate;

      toast.success("Contratação registrada! Vamos validar o pagamento e ativar seu processo.");
      // Redireciona para o processo ou portal
      if (novoId) {
        navigate(`/area-do-cliente?processo=${novoId}`);
      } else {
        navigate("/area-do-cliente");
      }
    } catch (e: any) {
      console.error("[contratar/confirmar] erro:", e);
      toast.error(e?.message || "Não foi possível concluir a contratação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div data-tactical-portal className="min-h-screen qa-resumo-light flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!catalogo || !cliente) return null;
  const preco = formatBRL(catalogo.preco);

  return (
    <div data-tactical-portal className="min-h-screen">
      <div className="qa-resumo-light">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 bg-white sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate("/area-do-cliente/contratar")}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight">
                Confirmar contratação
              </h1>
              <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 truncate">
                {catalogo.nome} {preco ? `· ${preco}${catalogo.recorrente ? "/mês" : ""}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {/* Resumo do cliente */}
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              <User className="h-3.5 w-3.5" /> Titular
            </div>
            <div className="text-sm font-bold text-slate-900 uppercase">{cliente.nome_completo}</div>
            <div className="text-[12px] text-slate-600 mt-0.5">
              CPF {cliente.cpf || "—"} · {cliente.email || "sem e-mail"}
            </div>
          </div>

          {/* Step 1: Endereço */}
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase">1. Endereço</h2>
            </div>
            <div className="text-[12px] text-slate-600 mb-3 leading-relaxed">
              {enderecoAtualLinha || <span className="italic">Sem endereço cadastrado.</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEnderecoOk("sim")}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition border ${
                  enderecoOk === "sim"
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300"
                }`}
              >
                É o mesmo
              </button>
              <button
                onClick={() => setEnderecoOk("nao")}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition border ${
                  enderecoOk === "nao"
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-amber-300"
                }`}
              >
                Mudou
              </button>
            </div>
            {enderecoOk === "nao" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="CEP"
                  value={novoCep}
                  onChange={(e) => setNovoCep(e.target.value)}
                />
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Estado (UF)"
                  maxLength={2}
                  value={novoEstado}
                  onChange={(e) => setNovoEstado(e.target.value.toUpperCase())}
                />
                <input
                  className="col-span-2 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Endereço (rua/av)"
                  value={novoEndereco}
                  onChange={(e) => setNovoEndereco(e.target.value.toUpperCase())}
                />
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Número"
                  value={novoNumero}
                  onChange={(e) => setNovoNumero(e.target.value)}
                />
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Complemento"
                  value={novoComplemento}
                  onChange={(e) => setNovoComplemento(e.target.value.toUpperCase())}
                />
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Bairro"
                  value={novoBairro}
                  onChange={(e) => setNovoBairro(e.target.value.toUpperCase())}
                />
                <input
                  className="col-span-1 h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Cidade"
                  value={novaCidade}
                  onChange={(e) => setNovaCidade(e.target.value.toUpperCase())}
                />
              </div>
            )}
          </div>

          {/* Step 2: Estado civil / profissão */}
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase">2. Estado civil e profissão</h2>
            </div>
            <div className="text-[12px] text-slate-600 mb-3">
              Atual: <strong className="uppercase">{cliente.estado_civil || "—"}</strong> ·{" "}
              <strong className="uppercase">{cliente.profissao || "—"}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDadosOk("sim")}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition border ${
                  dadosOk === "sim"
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-emerald-300"
                }`}
              >
                Não mudou
              </button>
              <button
                onClick={() => setDadosOk("nao")}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition border ${
                  dadosOk === "nao"
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "bg-white border-slate-200 text-slate-700 hover:border-amber-300"
                }`}
              >
                Mudou algo
              </button>
            </div>
            {dadosOk === "nao" && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <select
                  className="h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400 bg-white"
                  value={novoEstadoCivil}
                  onChange={(e) => setNovoEstadoCivil(e.target.value)}
                >
                  <option value="">Estado civil (manter o atual se vazio)</option>
                  {ESTADOS_CIVIS.map((ec) => (
                    <option key={ec} value={ec}>
                      {ec}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 px-2 text-[12px] uppercase border border-slate-200 rounded-md focus:outline-none focus:border-amber-400"
                  placeholder="Profissão (manter atual se vazio)"
                  value={novaProfissao}
                  onChange={(e) => setNovaProfissao(e.target.value.toUpperCase())}
                />
              </div>
            )}
          </div>

          {/* Step 3: Documentos reaproveitados */}
          <div className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase">3. Documentos reaproveitados</h2>
            </div>
            {docsReaproveitados.length === 0 ? (
              <div className="text-[12px] text-slate-500 italic">
                Nenhum documento prévio validado — você enviará todos no processo novo.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {docsReaproveitados.slice(0, 8).map((d) => (
                  <li key={d} className="flex items-center gap-2 text-[12px] text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="uppercase">{d}</span>
                  </li>
                ))}
                {docsReaproveitados.length > 8 && (
                  <li className="text-[11px] text-slate-500">
                    +{docsReaproveitados.length - 8} outros documentos disponíveis.
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Aviso pagamento manual */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              <strong>Sem pagamento online por enquanto.</strong> Após confirmar, nossa equipe entra em
              contato para combinar o pagamento e liberar seu processo.
            </p>
          </div>

          {/* CTA */}
          <button
            disabled={!podeConfirmar}
            onClick={handleConfirmar}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition ${
              podeConfirmar
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Confirmar contratação
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}