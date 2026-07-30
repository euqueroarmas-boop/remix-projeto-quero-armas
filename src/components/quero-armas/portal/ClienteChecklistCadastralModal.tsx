// ============================================================================
// Checklist cadastral — uma pergunta por vez.
//
// Regra de negócio (definida pelo usuário):
//   • Uma pergunta por tela, direta ao cliente.
//   • Cada resposta é salva no banco imediatamente.
//   • Se o cliente parar no meio, o que respondeu fica salvo e NUNCA é
//     perguntado de novo. Ao voltar, retoma na primeira pendência.
//   • Só quando o cadastro está completo é que o checklist processual abre —
//     nenhum documento é gerado antes disso.
//
// O "progresso" não precisa de tabela própria: o campo preenchido em
// qa_clientes É a resposta. Campo vazio = pergunta pendente. Isso torna o
// fluxo idempotente e imune a perda de sessão.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, ArrowRight, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CAMPOS_CADASTRO, type CampoCadastro } from "@/lib/quero-armas/cadastroCompleteness";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Props {
  open: boolean;
  cliente: Record<string, unknown> | null;
  /** Chamado quando não resta nenhuma pendência cadastral. */
  onConcluido: () => void;
  onClose: () => void;
}

function vazio(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

const soDigitos = (v: string) => v.replace(/\D/g, "");
const mascaraCep = (v: string) => {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
const mascaraTel = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const mascaraData = (v: string) => {
  const d = soDigitos(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};
const brParaIso = (br: string): string | null => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime()) ? null : iso;
};

async function salvarCampo(key: string, valor: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return { ok: false, erro: "Sua sessão expirou. Entre novamente." };
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const resp = await fetch(`${base}/functions/v1/qa-cliente-atualizar-cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        fields: { [key]: valor },
        field_origins: { [key]: "cliente_checklist" },
      }),
    });
    if (!resp.ok) return { ok: false, erro: (await resp.text()) || "Não foi possível salvar." };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: (e as Error).message || "Erro de conexão." };
  }
}

export default function ClienteChecklistCadastralModal({ open, cliente, onConcluido, onClose }: Props) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Respondidos nesta sessão — evita depender do refetch do cliente para
  // avançar de pergunta. O banco já tem o valor; isto é só a UI.
  const [respondidos, setRespondidos] = useState<Set<string>>(new Set());

  // Pendências = campos obrigatórios ainda vazios, na ordem do catálogo.
  const pendentes = useMemo<CampoCadastro[]>(() => {
    if (!cliente) return [];
    return CAMPOS_CADASTRO.filter(
      (c) => c.crucial && vazio(cliente[c.key]) && !respondidos.has(c.key),
    );
  }, [cliente, respondidos]);

  const atual = pendentes[0] ?? null;
  const totalObrigatorios = CAMPOS_CADASTRO.filter((c) => c.crucial).length;
  const jaPreenchidos = totalObrigatorios - pendentes.length;

  useEffect(() => { setValor(""); setErro(null); }, [atual?.key]);

  // Sem pendências: o cadastro está completo, segue para o processual.
  //
  // O ref é essencial: `onConcluido` é uma arrow inline do pai, ou seja, uma
  // referência nova a cada render, e `cliente` é objeto. Sem a trava, o efeito
  // redisparava a cada render — e como onConcluido recarrega o portal, o
  // cliente voltava como objeto novo e o ciclo se repetia, derrubando a página.
  const concluiuRef = useRef(false);
  useEffect(() => {
    if (!open) { concluiuRef.current = false; return; }
    if (concluiuRef.current || !cliente || pendentes.length > 0) return;
    concluiuRef.current = true;
    onConcluido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendentes.length]);

  if (!open || !atual) return null;

  async function responder() {
    if (!atual) return;
    const bruto = valor.trim();
    if (!bruto) { setErro("Preencha para continuar."); return; }

    let paraSalvar = bruto;
    if (atual.tipo === "date") {
      const iso = brParaIso(bruto);
      if (!iso) { setErro("Data inválida. Use DD/MM/AAAA."); return; }
      paraSalvar = iso;
    }
    if (atual.tipo === "cep" && soDigitos(bruto).length !== 8) {
      setErro("O CEP precisa ter 8 dígitos."); return;
    }
    if (atual.tipo === "tel" && ![10, 11].includes(soDigitos(bruto).length)) {
      setErro("Informe o celular com DDD."); return;
    }
    if (atual.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bruto)) {
      setErro("E-mail inválido."); return;
    }

    setSalvando(true);
    setErro(null);
    const r = await salvarCampo(atual.key, paraSalvar);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro ?? "Não foi possível salvar."); return; }
    // Salvo no banco — esta pergunta não volta, mesmo que ele feche agora.
    setRespondidos((prev) => new Set(prev).add(atual.key));
  }

  const aplicarMascara = (v: string) => {
    if (atual.tipo === "cep") return mascaraCep(v);
    if (atual.tipo === "tel") return mascaraTel(v);
    if (atual.tipo === "date") return mascaraData(v);
    if (atual.tipo === "uf") return v.toUpperCase().slice(0, 2);
    return v;
  };

  const pct = Math.round((jaPreenchidos / totalObrigatorios) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        {/* Cabeçalho com progresso */}
        <div className="border-b border-zinc-200 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A1F2B]">
                Complete seu cadastro
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {jaPreenchidos} de {totalObrigatorios} · falta{pendentes.length === 1 ? "" : "m"} {pendentes.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              title="Continuar depois — o que você já respondeu fica salvo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-[#7A1F2B] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* A pergunta */}
        <div className="px-6 py-6">
          <h2 className="text-[19px] font-semibold leading-snug text-zinc-900">
            {atual.pergunta ?? atual.label}
          </h2>
          {atual.ajuda && <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{atual.ajuda}</p>}

          <div className="mt-5">
            {atual.tipo === "select" && atual.opcoes ? (
              <div className="grid gap-2">
                {atual.opcoes.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setValor(o.value)}
                    className={`rounded-lg border px-4 py-3 text-left text-[13px] transition-colors ${
                      valor === o.value
                        ? "border-[#7A1F2B] bg-[#7A1F2B]/5 font-semibold text-[#7A1F2B]"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : atual.tipo === "uf" ? (
              <select
                autoFocus
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-[14px] focus:border-[#7A1F2B] focus:outline-none"
              >
                <option value="">Selecione o estado…</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            ) : (
              <input
                autoFocus
                type="text"
                inputMode={["cep", "tel", "date"].includes(atual.tipo ?? "") ? "numeric" : "text"}
                placeholder={atual.placeholder}
                value={valor}
                onChange={(e) => setValor(aplicarMascara(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter" && !salvando) void responder(); }}
                className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-[15px] focus:border-[#7A1F2B] focus:outline-none"
              />
            )}
          </div>

          {erro && <p className="mt-2 text-[12px] font-medium text-red-600">{erro}</p>}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <p className="text-[10px] leading-tight text-zinc-400">
            Cada resposta é salva na hora.<br />Pode parar e continuar quando quiser.
          </p>
          <button
            type="button"
            onClick={() => void responder()}
            disabled={salvando || !valor.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#63161f] disabled:opacity-40"
          >
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : pendentes.length === 1 ? <Check className="h-3.5 w-3.5" />
              : <ArrowRight className="h-3.5 w-3.5" />}
            {pendentes.length === 1 ? "Concluir" : "Continuar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
