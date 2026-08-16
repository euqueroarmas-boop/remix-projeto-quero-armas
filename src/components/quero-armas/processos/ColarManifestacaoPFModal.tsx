// ============================================================================
// ColarManifestacaoPFModal — a equipe cola o que a PF escreveu
// ----------------------------------------------------------------------------
// Depois do protocolo, tudo o que acontece está dentro do SINARM, na conta do
// cliente. A equipe entra com o gov.br dele, abre "Ver Notificação",
// "Visualizar Parecer" ou "Ver Manifestação", copia o texto e cola aqui.
// Salvando, o cliente passa a ler no portal — nas palavras do delegado.
//
// O TEXTO É SALVO COMO VEIO. Nada de reescrever para "ficar mais claro": ele é
// prova do que a PF exigiu, é o que fundamenta o recurso, e é o que a IA vai
// ler para dizer o que ainda falta. Editar destrói as três coisas.
//
// Os campos ao lado (delegado, prazo, canal) são preenchidos por quem cola. São
// opcionais de propósito: texto sem metadado ainda serve ao cliente; metadado
// obrigatório faria a equipe adiar o registro — e o cliente ficaria sem saber.
// ============================================================================

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Tipos de documento que a PF publica no SINARM. */
const TIPOS: Array<{ valor: string; label: string; statusSugerido: string }> = [
  { valor: "notificacao", label: "Notificação (a PF pediu algo)", statusSugerido: "notificado" },
  { valor: "parecer", label: "Parecer do delegado", statusSugerido: "em_analise_orgao" },
  { valor: "manifestacao", label: "Manifestação", statusSugerido: "em_analise_orgao" },
  { valor: "decisao", label: "Decisão final", statusSugerido: "indeferido" },
];

const STATUS: Array<{ valor: string; label: string }> = [
  { valor: "em_analise_orgao", label: "Em análise pela PF" },
  { valor: "notificado", label: "Notificado" },
  { valor: "indeferido", label: "Indeferido" },
  { valor: "deferido", label: "Deferido" },
  { valor: "recurso_administrativo", label: "Recurso protocolado" },
];

const CANAIS: Array<{ valor: string; label: string }> = [
  { valor: "sistema", label: "Pelo site da PF" },
  { valor: "email", label: "Por e-mail" },
  { valor: "presencial", label: "Presencialmente" },
];

export interface ColarManifestacaoPFModalProps {
  open: boolean;
  processoId: string;
  onClose: () => void;
  onSalvo?: () => void;
}

export default function ColarManifestacaoPFModal({
  open,
  processoId,
  onClose,
  onSalvo,
}: ColarManifestacaoPFModalProps) {
  const [tipo, setTipo] = useState("notificacao");
  const [statusProcesso, setStatusProcesso] = useState("notificado");
  const [texto, setTexto] = useState("");
  const [delegadoNome, setDelegadoNome] = useState("");
  const [delegadoCargo, setDelegadoCargo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [prazoDias, setPrazoDias] = useState("10");
  const [prazoLimite, setPrazoLimite] = useState("");
  const [canal, setCanal] = useState("sistema");
  const [contato, setContato] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!open) return null;

  const trocarTipo = (v: string) => {
    setTipo(v);
    const sugerido = TIPOS.find((t) => t.valor === v)?.statusSugerido;
    if (sugerido) setStatusProcesso(sugerido);
  };

  const salvar = async () => {
    if (texto.trim().length < 30) {
      toast.error("Cole o texto da PF (mínimo 30 caracteres).");
      return;
    }
    setSalvando(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const { error } = await supabase.from("qa_processo_manifestacoes_pf" as never).insert({
        processo_id: processoId,
        tipo,
        status_processo: statusProcesso || null,
        texto: texto.trim(),
        delegado_nome: delegadoNome.trim() || null,
        delegado_cargo: delegadoCargo.trim() || null,
        unidade_pf: unidade.trim() || null,
        data_documento: dataDocumento || null,
        prazo_dias: prazoDias ? Number(prazoDias) : null,
        prazo_limite: prazoLimite || null,
        canal_resposta: canal || null,
        contato: contato.trim() || null,
        registrado_por: sess?.user?.id ?? null,
      } as never);
      if (error) throw error;

      // O status do processo acompanha o documento: colar a notificação e
      // esquecer de mudar o status deixaria o cliente vendo "em análise"
      // enquanto o prazo dele corre.
      if (statusProcesso) {
        await supabase
          .from("qa_processos")
          .update({ status: statusProcesso, updated_at: new Date().toISOString() })
          .eq("id", processoId);
      }

      toast.success("Registrado. O cliente já vê o texto no portal.");
      setTexto("");
      onSalvo?.();
      onClose();
    } catch (e) {
      toast.error("Erro ao registrar: " + ((e as Error)?.message ?? "desconhecido"));
    } finally {
      setSalvando(false);
    }
  };

  const campo = "h-8 w-full rounded-md border border-slate-300 px-2 text-[12px] outline-none focus:border-[#8A1224]";
  const rotulo = "text-[9px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#7A1F2B]">
              Registrar manifestação da Polícia Federal
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Cole o texto exatamente como está no SINARM. O cliente lê no portal.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[18px] leading-none text-slate-400">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo}>Tipo de documento</label>
            <select className={campo} value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Status do processo</label>
            <select className={campo} value={statusProcesso} onChange={(e) => setStatusProcesso(e.target.value)}>
              {STATUS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-2">
          <label className={rotulo}>Texto da PF — cole sem editar</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            placeholder="Senhor Requerente, Após análise preliminar do seu requerimento…"
            className="w-full rounded-md border border-slate-300 p-2 text-[12px] leading-relaxed outline-none focus:border-[#8A1224]"
          />
          <p className="mt-0.5 text-[10px] text-slate-500">
            {texto.trim().length} caracteres. Mantenha as quebras de linha originais.
          </p>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={rotulo}>Delegado que assina</label>
            <input className={campo} value={delegadoNome} onChange={(e) => setDelegadoNome(e.target.value)} placeholder="EVANDRO GIMENEZ SERRA" />
          </div>
          <div>
            <label className={rotulo}>Data do documento</label>
            <input type="date" className={campo} value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={rotulo}>Cargo</label>
            <input className={campo} value={delegadoCargo} onChange={(e) => setDelegadoCargo(e.target.value)} placeholder="Chefe em exercício da DELEARM" />
          </div>
          <div>
            <label className={rotulo}>Unidade</label>
            <input className={campo} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="DELEARM/DREX/SR/PF/SP" />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <div>
            <label className={rotulo}>Prazo (dias)</label>
            <input type="number" className={campo} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} />
          </div>
          <div>
            <label className={rotulo}>Vence em</label>
            <input type="date" className={campo} value={prazoLimite} onChange={(e) => setPrazoLimite(e.target.value)} />
          </div>
          <div>
            <label className={rotulo}>Responder</label>
            <select className={campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
              {CANAIS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Contato / e-mail</label>
            <input className={campo} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="uarm.sjk.sp@pf.gov.br" />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-8 rounded-md bg-[#8A1224] px-4 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#6f0f1e] disabled:opacity-60"
          >
            {salvando ? "Registrando…" : "Registrar e avisar o cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
