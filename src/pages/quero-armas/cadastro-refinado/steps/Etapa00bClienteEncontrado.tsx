import QACadastroRefinadoShell from "../components/QACadastroRefinadoShell";
import type { CadastroRefinadoState } from "../hooks/useCadastroRefinadoState";

interface Props {
  state: CadastroRefinadoState;
  onContinuar: () => void;
  onAtualizar: () => void;
  onEnviarNovoDocumento: () => void;
  onBack?: () => void;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export default function Etapa00bClienteEncontrado({
  state,
  onContinuar,
  onAtualizar,
  onEnviarNovoDocumento,
  onBack,
}: Props) {
  const docsValidos = state.documentos_reaproveitados || [];
  const docsVencidos = state.documentos_vencidos || [];
  const docsPendentes = state.documentos_pendentes_revisao || [];
  const servicos = state.servicos_anteriores || [];
  const arsenal = state.arsenal_resumo;

  return (
    <QACadastroRefinadoShell
      step={0}
      total={6}
      eyebrow="Cliente identificado"
      title="ENCONTREI SEU CADASTRO"
      subtitle="Vou reaproveitar o que já está válido e pedir somente o que estiver faltando."
      onBack={onBack}
      showBack={Boolean(onBack)}
    >
      <div className="qa-ref-encontrado-grid">
        <div className="qa-ref-found-card">
          <span className="qa-ref-found-title">DADOS CADASTRAIS</span>
          <span className="qa-ref-found-val">
            {state.dadosPessoais.nome_completo || "—"}
          </span>
          <span className="qa-ref-found-meta">
            {state.dadosPessoais.cpf || ""} {state.dadosPessoais.email || ""}
          </span>
        </div>

        <div className="qa-ref-found-card">
          <span className="qa-ref-found-title">DOCUMENTOS VÁLIDOS</span>
          <span className="qa-ref-found-val">{docsValidos.length}</span>
          {docsValidos.slice(0, 3).map((d) => (
            <span key={d.id} className="qa-ref-found-meta">
              {d.tipo_documento}
              {d.data_validade ? ` · até ${fmtDate(d.data_validade)}` : ""}
            </span>
          ))}
        </div>

        {docsVencidos.length > 0 && (
          <div className="qa-ref-found-card qa-ref-found-warn">
            <span className="qa-ref-found-title">DOCUMENTOS VENCIDOS</span>
            <span className="qa-ref-found-val">{docsVencidos.length}</span>
            {docsVencidos.slice(0, 3).map((d) => (
              <span key={d.id} className="qa-ref-found-meta">
                {d.tipo_documento}
              </span>
            ))}
          </div>
        )}

        {docsPendentes.length > 0 && (
          <div className="qa-ref-found-card">
            <span className="qa-ref-found-title">EM ANÁLISE</span>
            <span className="qa-ref-found-val">{docsPendentes.length}</span>
          </div>
        )}

        {servicos.length > 0 && (
          <div className="qa-ref-found-card">
            <span className="qa-ref-found-title">SERVIÇOS NO HISTÓRICO</span>
            <span className="qa-ref-found-val">{servicos.length}</span>
            {servicos.slice(0, 3).map((s) => (
              <span key={String(s.id)} className="qa-ref-found-meta">
                {s.servico_nome || s.servico_slug || "Serviço"}
                {s.status ? ` · ${s.status}` : ""}
              </span>
            ))}
          </div>
        )}

        {arsenal && (
          <div className="qa-ref-found-card">
            <span className="qa-ref-found-title">ARSENAL INTELIGENTE</span>
            {arsenal.cr && (
              <span className="qa-ref-found-meta">CR: {arsenal.cr}</span>
            )}
            {arsenal.craf && (
              <span className="qa-ref-found-meta">SIGMA/CRAF: {arsenal.craf}</span>
            )}
            {typeof arsenal.armas === "number" && (
              <span className="qa-ref-found-meta">
                Armas registradas: {arsenal.armas}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="qa-ref-encontrado-actions">
        <button type="button" className="qa-ref-cta" onClick={onContinuar}>
          CONTINUAR COM MEUS DADOS
        </button>
        <button type="button" className="qa-ref-cta qa-ref-cta-ghost" onClick={onAtualizar}>
          ATUALIZAR MEUS DADOS
        </button>
        <button
          type="button"
          className="qa-ref-cta qa-ref-cta-ghost"
          onClick={onEnviarNovoDocumento}
        >
          ENVIAR NOVO DOCUMENTO
        </button>
      </div>
    </QACadastroRefinadoShell>
  );
}
