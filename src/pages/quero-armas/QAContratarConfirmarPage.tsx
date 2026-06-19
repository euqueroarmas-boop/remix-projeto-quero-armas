import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  MapPin,
  User,
  FileCheck2,
  AlertCircle,
  ChevronRight,
  BadgeDollarSign,
  Check,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import CheckoutShell from "@/components/quero-armas/checkout/CheckoutShell";
import { fetchChecklistEtapa02 } from "@/lib/quero-armas/etapa02Checklist";
import { useCart } from "@/shared/cart/CartProvider";

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

const ESTADOS_CIVIS = ["SOLTEIRO(A)", "CASADO(A)", "DIVORCIADO(A)", "VIÚVO(A)", "UNIÃO ESTÁVEL"];

function SectionBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <div
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold border transition-all ${
        done
          ? "bg-emerald-500 border-emerald-400 text-white"
          : "bg-slate-100 border-slate-300 text-slate-500"
      }`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </div>
  );
}

type Confirmacao = "sim" | "nao" | null;

function ConfirmButtons({
  value,
  onChange,
  labelSim,
  labelNao,
}: {
  value: Confirmacao;
  onChange: (v: "sim" | "nao") => void;
  labelSim: string;
  labelNao: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <button
        type="button"
        onClick={() => onChange("sim")}
        className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-[12px] font-bold uppercase tracking-wider transition-all ${
          value === "sim"
            ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50"
        }`}
      >
        {value === "sim" && (
          <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-emerald-500" />
        )}
        <Check className={`h-4 w-4 ${value === "sim" ? "text-emerald-500" : "text-slate-400"}`} />
        {labelSim}
      </button>
      <button
        type="button"
        onClick={() => onChange("nao")}
        className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-[12px] font-bold uppercase tracking-wider transition-all ${
          value === "nao"
            ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
        }`}
      >
        {value === "nao" && (
          <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-amber-500" />
        )}
        <Pencil className={`h-4 w-4 ${value === "nao" ? "text-amber-500" : "text-slate-400"}`} />
        {labelNao}
      </button>
    </div>
  );
}

export default function QAContratarConfirmarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [docsReaproveitados, setDocsReaproveitados] = useState<string[]>([]);

  const [enderecoOk, setEnderecoOk] = useState<Confirmacao>(null);
  const [novoCep, setNovoCep] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComplemento, setNovoComplemento] = useState("");
  const [novoBairro, setNovoBairro] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");

  const [dadosOk, setDadosOk] = useState<Confirmacao>(null);
  const [novoEstadoCivil, setNovoEstadoCivil] = useState("");
  const [novaProfissao, setNovaProfissao] = useState("");

  const [legadoBlock, setLegadoBlock] = useState<{
    homologacao_status?: string | null;
    recadastramento_status?: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/identificar`, { replace: true });
        return;
      }
      const uid = sess.session.user.id;

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

      try {
        const [checklist, docsResp] = await Promise.all([
          fetchChecklistEtapa02(slug),
          supabase.functions.invoke("qa-cadastro-carregar-cliente", { body: {} }),
        ]);
        const docsValidos = Array.isArray((docsResp.data as any)?.documentos_validos)
          ? ((docsResp.data as any).documentos_validos as Array<{ tipo_documento?: string | null }>)
          : [];
        const itensCompativeis = checklist.filter((item) =>
          docsValidos.some((doc) =>
            item.tiposCompativeis.includes(String(doc.tipo_documento || "").toUpperCase())
          )
        );
        setDocsReaproveitados(
          Array.from(new Set(itensCompativeis.map((item) => item.shortName || item.label)))
        );
      } catch {
        setDocsReaproveitados([]);
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
      cliente.cidade && cliente.estado ? `${cliente.cidade} / ${cliente.estado}` : cliente.cidade,
      cliente.cep,
    ]
      .filter(Boolean)
      .join(", ");
  }, [cliente]);

  const valorNumerico = useMemo(() => {
    const n = Number(catalogo?.preco ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [catalogo]);

  const podeConfirmar =
    enderecoOk !== null && dadosOk !== null && !submitting && !loading && cliente && catalogo;

  const iniciaisNome = useMemo(() => {
    if (!cliente?.nome_completo) return "?";
    const parts = cliente.nome_completo.trim().split(" ").filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : parts[0]?.[0] ?? "?";
  }, [cliente]);

  async function handleConfirmar() {
    if (!cliente || !catalogo) return;
    setSubmitting(true);
    try {
      const { data: verifData, error: verifErr } = await supabase.rpc(
        "qa_verificar_cliente_pode_contratar" as any,
        { p_cliente_id: cliente.id, p_catalogo_slug: catalogo.slug } as any
      );
      if (verifErr) throw verifErr;
      const verif = (verifData ?? {}) as {
        pode_contratar?: boolean;
        motivo?: string;
        homologacao_status?: string | null;
        recadastramento_status?: string | null;
      };
      if (verif.pode_contratar === false) {
        setLegadoBlock({
          homologacao_status: verif.homologacao_status ?? null,
          recadastramento_status: verif.recadastramento_status ?? null,
        });
        toast.error("Recadastramento obrigatório antes de contratar.");
        setSubmitting(false);
        return;
      }

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

      if (!catalogo.servico_id || !valorNumerico) {
        toast.error("Serviço sem preço configurado no catálogo. Fale com a equipe.");
        return;
      }
      addItem({
        service_id: String(catalogo.servico_id),
        service_slug: catalogo.slug,
        service_name: catalogo.nome,
        unit_price_cents: Math.round(valorNumerico * 100),
        quantity: 1,
      });
      toast.success("Tudo certo! Escolha como pagar.");
      navigate("/checkout/finalizar");
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

  if (legadoBlock) {
    const waLink =
      "https://wa.me/5562994040220?text=" +
      encodeURIComponent(
        `Olá! Sou cliente antigo da Quero Armas (CPF ${cliente.cpf || "—"}) e quero atualizar meu cadastro para contratar o serviço ${catalogo.nome}.`
      );
    return (
      <div data-tactical-portal className="min-h-screen">
        <div className="qa-resumo-light min-h-screen">
          <div className="max-w-xl mx-auto px-4 py-10">
            <div className="rounded-2xl bg-white border border-amber-200 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900 uppercase">
                    Recadastramento obrigatório
                  </h1>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    Seu cadastro veio do sistema antigo da Quero Armas. Para comprar um novo
                    serviço, precisamos atualizar seus documentos no sistema novo.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-3 uppercase tracking-wider">
                    Status: {legadoBlock.homologacao_status || "pendente"} ·{" "}
                    Recadastramento: {legadoBlock.recadastramento_status || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => navigate("/area-do-cliente?secao=arsenal")}
                  className="w-full px-4 py-2.5 rounded-lg bg-amber-500 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-amber-600"
                >
                  Enviar documentos agora
                </button>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-emerald-700"
                >
                  Falar com a Equipe Quero Armas
                </a>
                <button
                  onClick={() => navigate("/area-do-cliente")}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 text-[12px] font-bold uppercase tracking-wider hover:bg-slate-200"
                >
                  Voltar ao portal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CheckoutShell
      step={3}
      slug={slug}
      backTo="/area-do-cliente/contratar"
      summary={{
        nome: catalogo.nome,
        descricao_curta: catalogo.descricao_curta,
        preco: catalogo.preco,
        recorrente: catalogo.recorrente,
      }}
    >
      {/* ── Titular ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-white text-[13px] font-extrabold uppercase tracking-wider select-none">
            {iniciaisNome}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Titular
              </span>
            </div>
            <div className="text-[14px] font-extrabold text-slate-900 uppercase leading-tight mt-0.5 truncate">
              {cliente.nome_completo}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              CPF {cliente.cpf || "—"} · {cliente.email || "sem e-mail"}
            </div>
          </div>
        </div>
      </div>

      {/* ── 1. Endereço ────────────────────────────────────────────────────── */}
      <div
        className={`rounded-xl bg-white border shadow-sm p-4 transition-all ${
          enderecoOk ? "border-slate-200" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <SectionBadge n={1} done={enderecoOk !== null} />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
            <h2 className="text-[13px] font-extrabold text-slate-900 uppercase tracking-tight">
              Endereço
            </h2>
          </div>
          {enderecoOk === "sim" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              Confirmado
            </span>
          )}
          {enderecoOk === "nao" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Atualizar
            </span>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-[12px] text-slate-700 leading-relaxed">
          {enderecoAtualLinha || <span className="italic text-slate-400">Sem endereço cadastrado.</span>}
        </div>

        <ConfirmButtons
          value={enderecoOk}
          onChange={setEnderecoOk}
          labelSim="É o mesmo"
          labelNao="Mudou"
        />

        {enderecoOk === "nao" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { col: 1, placeholder: "CEP", value: novoCep, setter: setNovoCep, transform: (v: string) => v },
              { col: 1, placeholder: "Estado (UF)", value: novoEstado, setter: setNovoEstado, transform: (v: string) => v.toUpperCase(), maxLength: 2 },
              { col: 2, placeholder: "Rua / Avenida", value: novoEndereco, setter: setNovoEndereco, transform: (v: string) => v.toUpperCase() },
              { col: 1, placeholder: "Número", value: novoNumero, setter: setNovoNumero, transform: (v: string) => v },
              { col: 1, placeholder: "Complemento", value: novoComplemento, setter: setNovoComplemento, transform: (v: string) => v.toUpperCase() },
              { col: 1, placeholder: "Bairro", value: novoBairro, setter: setNovoBairro, transform: (v: string) => v.toUpperCase() },
              { col: 1, placeholder: "Cidade", value: novaCidade, setter: setNovaCidade, transform: (v: string) => v.toUpperCase() },
            ].map(({ col, placeholder, value, setter, transform, maxLength }) => (
              <input
                key={placeholder}
                className={`${col === 2 ? "col-span-2" : "col-span-1"} h-9 px-3 text-[12px] uppercase border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 placeholder:text-slate-400`}
                placeholder={placeholder}
                value={value}
                maxLength={maxLength}
                onChange={(e) => setter(transform(e.target.value))}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Estado civil e profissão ─────────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <SectionBadge n={2} done={dadosOk !== null} />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <User className="h-4 w-4 text-amber-600 shrink-0" />
            <h2 className="text-[13px] font-extrabold text-slate-900 uppercase tracking-tight">
              Estado civil e profissão
            </h2>
          </div>
          {dadosOk === "sim" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              Confirmado
            </span>
          )}
          {dadosOk === "nao" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Atualizar
            </span>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-[12px] text-slate-700 flex gap-4">
          <span><span className="text-slate-400 uppercase text-[10px] font-bold block">Estado civil</span>{cliente.estado_civil || "—"}</span>
          <span><span className="text-slate-400 uppercase text-[10px] font-bold block">Profissão</span>{cliente.profissao || "—"}</span>
        </div>

        <ConfirmButtons
          value={dadosOk}
          onChange={setDadosOk}
          labelSim="Não mudou"
          labelNao="Mudou algo"
        />

        {dadosOk === "nao" && (
          <div className="mt-3 grid grid-cols-1 gap-2">
            <select
              className="h-9 px-3 text-[12px] uppercase border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 text-slate-700"
              value={novoEstadoCivil}
              onChange={(e) => setNovoEstadoCivil(e.target.value)}
            >
              <option value="">Estado civil (manter o atual se vazio)</option>
              {ESTADOS_CIVIS.map((ec) => (
                <option key={ec} value={ec}>{ec}</option>
              ))}
            </select>
            <input
              className="h-9 px-3 text-[12px] uppercase border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 placeholder:text-slate-400"
              placeholder="Profissão (manter atual se vazio)"
              value={novaProfissao}
              onChange={(e) => setNovaProfissao(e.target.value.toUpperCase())}
            />
          </div>
        )}
      </div>

      {/* ── 3. Documentos reaproveitados ───────────────────────────────────── */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500 border border-emerald-400">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <h2 className="text-[13px] font-extrabold text-slate-900 uppercase tracking-tight">
              Documentos reaproveitados
            </h2>
          </div>
          {docsReaproveitados.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              {docsReaproveitados.length} doc{docsReaproveitados.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {docsReaproveitados.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 text-[12px] text-slate-500 italic">
            Nenhum documento prévio validado — você enviará todos no processo novo.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {docsReaproveitados.slice(0, 8).map((d) => (
              <li key={d} className="flex items-center gap-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 px-3 py-2 text-[12px]">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="uppercase font-bold text-emerald-800 tracking-wide">{d}</span>
              </li>
            ))}
            {docsReaproveitados.length > 8 && (
              <li className="text-[11px] text-slate-500 px-1">
                +{docsReaproveitados.length - 8} outros documentos disponíveis.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── 4. Valor ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-sm p-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <BadgeDollarSign className="h-4 w-4 text-amber-400 shrink-0" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
            Valor do serviço
          </h2>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              Total
            </div>
            <div className="text-3xl font-extrabold text-white leading-none">
              {valorNumerico > 0
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                : "—"}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
            Preço oficial
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          Pagamento via PIX, boleto ou cartão na próxima etapa. Processo iniciado após confirmação.
        </p>
      </div>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <button
        disabled={!podeConfirmar}
        onClick={handleConfirmar}
        className={`w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-[14px] font-extrabold uppercase tracking-wider transition-all ${
          podeConfirmar
            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
        }`}
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        Ir para pagamento
        <ChevronRight className="h-5 w-5" />
      </button>
    </CheckoutShell>
  );
}
