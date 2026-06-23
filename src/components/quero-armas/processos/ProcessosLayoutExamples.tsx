const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
};

const statusLabel = (status?: string) =>
  String(status || "em_analise_orgao")
    .replace(/_/g, " ")
    .toUpperCase();

const serviceLabel = (processo: any, fallback: string) =>
  String(processo?.servico_nome || processo?.servico || fallback).toUpperCase();

const protocolLabel = (processo: any, index: number) => {
  const proto = processo?.respostas_questionario_json?.protocolo?.numero_protocolo || processo?.respostas_questionario_json?.protocolo?.numero;
  return proto ? String(proto).toUpperCase() : ["08210.123456/2025-19", "08505.004432/2025-01", "08777.009118/2025-44"][index] || "—";
};

const deadlineLabel = (days?: number | null) => {
  if (days === null || days === undefined) return "SEM PRAZO";
  if (days < 0) return `VENCIDO HÁ ${Math.abs(days)}D`;
  if (days === 0) return "VENCE HOJE";
  return `${days}D RESTANTES`;
};

const fallbackProcesses = [
  { id: "QA-2025-019", servico_nome: "Posse de Arma de Fogo — Polícia Federal", status: "em_revisao_humana", data_criacao: "2025-01-12", etapa_liberada_ate: 4, prazo_critico_data: "2025-03-05" },
  { id: "QA-2025-042", servico_nome: "Aquisição CAC — SIGMA", status: "aguardando_pagamento", data_criacao: "2025-02-18", etapa_liberada_ate: 1, prazo_critico_data: "2025-03-12" },
  { id: "QA-2024-881", servico_nome: "Renovação CRAF/SIGMA", status: "protocolado", data_criacao: "2024-12-28", etapa_liberada_ate: 5, prazo_critico_data: "2025-04-30" },
];

const officialSteps = ["ENDEREÇO", "CONDIÇÃO PROFISSIONAL", "ANTECEDENTES", "DECLARAÇÕES", "EXAMES TÉCNICOS"];
const kycItems = ["Identidade Gov.br", "Biometria facial", "Comprovante de residência 90d", "Declaração de antecedentes", "Foto 3x4 digital", "Exame psicológico PF", "Capacidade técnica", "CR atual / SIGMA"];
const docRows = [
  ["Certidão Justiça Federal", "90 dias", "08D"],
  ["Comprovante de residência", "90 dias", "14D"],
  ["Laudo psicológico", "Conforme PF", "88D"],
  ["Capacidade técnica", "Conforme PF", "112D"],
];

interface Props {
  processos: any[];
  docs: any[];
  timeline: Array<{ date?: string | null; label?: string; sub?: string | null }>;
  metrics: { total?: number; cumpridos?: number; pendentes?: number };
  dossierLabel: string;
  prazoBase?: any;
  diasPrazo?: number | null;
}

export default function ProcessosLayoutExamples({ processos, docs, timeline, metrics, dossierLabel, prazoBase, diasPrazo }: Props) {
  const rows = (processos?.length ? processos : fallbackProcesses).slice(0, 3);
  const primary = rows[0] || fallbackProcesses[0];
  const docTotal = metrics.total || docs.length || 8;
  const docOk = metrics.cumpridos || Math.max(4, docTotal - (metrics.pendentes || 2));
  const docPending = metrics.pendentes || Math.max(1, docTotal - docOk);
  const events = timeline?.length ? timeline.slice(0, 8) : [
    { date: "2025-02-20", label: "Protocolo PF gerado e vinculado ao dossiê" },
    { date: "2025-02-19", label: "Assinatura Gov.br confirmada no contrato" },
    { date: "2025-02-18", label: "Documento de antecedentes validado por IA" },
    { date: "2025-02-17", label: "Checklist documental liberado" },
    { date: "2025-02-15", label: "Pagamento manual confirmado pela equipe" },
  ];

  return (
    <section className="qa-process-layout-previews space-y-8" aria-label="Três modelos visuais para Meus Processos">
      <div className="qa-cat-paper qa-cat-border p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="qa-cat-kicker">Prévia visível · Catálogo Light</p>
            <h2 className="qa-cat-title">3 modelos completos para Meus Processos</h2>
          </div>
          <p className="qa-cat-copy max-w-xl md:text-right">
            Estes modelos usam os dados reais carregados nesta página quando existem, e completam o dossiê com informações oficiais de protocolo, documentos, prazos e etapas PF/SIGMA.
          </p>
        </div>
      </div>

      <article className="qa-cat-page p-4 md:p-6">
        <div className="qa-cat-frame space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="qa-cat-kicker">Modelo 01 · Dossiê pericial 2 colunas</p>
              <h3 className="qa-cat-hero">Área do Cliente — Meus Processos</h3>
              <p className="qa-cat-copy">{dossierLabel} · Lei 10.826/03 · SINARM/SIGMA · auditoria documental em tempo real.</p>
            </div>
            <div className="grid grid-cols-2 gap-px qa-cat-grid min-w-[320px]">
              {[["ATIVOS", rows.length], ["DOCS", `${docOk}/${docTotal}`], ["PENDÊNCIAS", docPending], ["PRAZO", deadlineLabel(diasPrazo)]].map(([label, value]) => (
                <div key={String(label)} className="qa-cat-paper p-3">
                  <p className="qa-cat-micro">{label}</p>
                  <p className="qa-cat-mono qa-cat-strong truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="qa-cat-paper qa-cat-border p-5">
                <div className="flex items-start gap-3">
                  <span className="qa-cat-dot qa-cat-dot-strong mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="qa-cat-kicker">Prazo crítico da documentação</p>
                    <h4 className="qa-cat-section-title">{prazoBase?.prazo_critico_doc_label || "Certidão de antecedentes criminais"}</h4>
                    <p className="qa-cat-copy">Vencimento em <strong>{deadlineLabel(diasPrazo)}</strong> · enviar antes de {fmtDate(prazoBase?.prazo_critico_data)} para evitar reemissão, nova leitura de IA e revalidação humana.</p>
                  </div>
                  <button className="qa-cat-button">Atualizar documento</button>
                </div>
              </section>

              <section className="qa-cat-paper qa-cat-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b qa-cat-border-soft pb-4">
                  <div>
                    <p className="qa-cat-kicker">Contrato e conformidade</p>
                    <h4 className="qa-cat-section-title">Instrumento particular + checklist KYC</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Baixar PDF', 'Enviar via Gov.br', 'Atualizar minuta'].map((item) => <button key={item} className="qa-cat-ghost-button">{item}</button>)}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {kycItems.map((item, idx) => (
                    <div key={item} className="flex items-start gap-2">
                      <span className={`qa-cat-check ${idx < 5 ? 'is-done' : ''}`} />
                      <span className="qa-cat-small">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['ICP-BRASIL', 'GOV.BR OURO', 'MP 2.200-2/2001', 'CARIMBO DE TEMPO'].map((selo) => <span key={selo} className="qa-cat-badge">{selo}</span>)}
                </div>
              </section>

              {rows.map((processo, index) => {
                const etapa = Math.max(1, Math.min(5, Number(processo?.etapa_liberada_ate || index + 3)));
                const docsProc = docs.filter((doc) => String(doc.processo_id) === String(processo.id));
                const total = docsProc.length || (index === 0 ? 8 : index === 1 ? 5 : 7);
                const ok = docsProc.filter((doc) => !String(doc.status || '').includes('pend')).length || Math.max(1, total - index - 2);
                return (
                  <section key={processo.id || index} className="qa-cat-paper qa-cat-border p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="qa-cat-mono qa-cat-muted">ID {processo.id || `QA-2025-0${index + 19}`} · ABERTO EM {fmtDate(processo.data_criacao)}</p>
                        <h4 className="qa-cat-section-title">{serviceLabel(processo, fallbackProcesses[index]?.servico_nome)}</h4>
                        <p className="qa-cat-copy">Protocolo {protocolLabel(processo, index)} · Etapa {etapa}/5 · {officialSteps[etapa - 1]}</p>
                      </div>
                      <div className="qa-cat-status"><span className="qa-cat-dot qa-cat-dot-strong" />{statusLabel(processo.status)}</div>
                    </div>
                    <div className="mt-4 grid gap-px qa-cat-grid sm:grid-cols-4">
                      {[["DOCUMENTOS", `${ok}/${total}`], ["AÇÃO", index === 1 ? "CONFIRMAR PAGAMENTO" : "ACOMPANHAR"], ["PRAZO", deadlineLabel(index === 0 ? diasPrazo : 45 + index * 12)], ["ÓRGÃO", index === 2 ? "SFPC/EB" : "POLÍCIA FEDERAL"]].map(([label, value]) => (
                        <div key={label} className="qa-cat-paper p-3"><p className="qa-cat-micro">{label}</p><p className="qa-cat-small qa-cat-strong truncate">{value}</p></div>
                      ))}
                    </div>
                    <div className="mt-4 qa-cat-timeline-row">
                      {['Cadastro recebido', 'Pagamento confirmado', 'Checklist liberado', 'IA validou documentos', 'Revisão humana', 'Protocolo gerado'].map((item, i) => (
                        <div key={item} className="qa-cat-step"><span className={`qa-cat-dot ${i <= etapa ? 'qa-cat-dot-strong' : 'qa-cat-dot-muted'}`} /><span>{item}</span><small>{fmtDate(new Date(Date.now() - (6 - i) * 86400000).toISOString())}</small></div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <aside className="space-y-5 lg:sticky lg:top-20 self-start">
              <section className="qa-cat-paper qa-cat-border p-5">
                <p className="qa-cat-kicker">Assistente guiado</p>
                <div className="mt-4 space-y-3">
                  {officialSteps.map((step, idx) => <div key={step} className="flex items-center gap-3"><span className={`qa-cat-number ${idx < 4 ? 'is-active' : ''}`}>{idx + 1}</span><span className="qa-cat-small qa-cat-strong">{step}</span></div>)}
                </div>
                <p className="qa-cat-copy mt-4">Próxima ação: assinar declaração de idoneidade e anexar exame técnico para liberação do protocolo.</p>
              </section>
              <section className="qa-cat-paper qa-cat-border p-5">
                <p className="qa-cat-kicker">Validade documental</p>
                <div className="mt-3 qa-cat-table">
                  {docRows.map(([doc, validade, dias]) => <div key={doc} className="qa-cat-table-row"><span>{doc}</span><span>{validade}</span><strong>{dias}</strong></div>)}
                </div>
              </section>
              <section className="qa-cat-paper qa-cat-border p-5">
                <p className="qa-cat-kicker">Linha do tempo global</p>
                <div className="mt-4 space-y-3">
                  {events.slice(0, 6).map((event, idx) => <div key={idx} className="qa-cat-event"><span className="qa-cat-dot qa-cat-dot-muted" /><div><p>{event.label}</p><small>{fmtDate(event.date)}</small></div></div>)}
                </div>
              </section>
              <section className="qa-cat-empty">Histórico arquivado vazio · nenhum processo finalizado há mais de 24 meses.</section>
            </aside>
          </div>
        </div>
      </article>

      <article className="qa-cat-page p-4 md:p-6">
        <div className="qa-cat-frame space-y-5">
          <div className="flex flex-col gap-3 border-b qa-cat-border-soft pb-5">
            <p className="qa-cat-kicker">Modelo 02 · Console SIGMA tabular</p>
            <h3 className="qa-cat-hero">Console operacional de processos</h3>
            <div className="grid gap-px qa-cat-grid md:grid-cols-6">
              {[["Cliente", dossierLabel], ["Ativos", rows.length], ["Pendentes", docPending], ["Docs aprovados", docOk], ["Próx. vencimento", deadlineLabel(diasPrazo)], ["Base legal", "Lei 10.826/03"]].map(([a, b]) => <div key={a} className="qa-cat-paper p-3"><p className="qa-cat-micro">{a}</p><p className="qa-cat-small qa-cat-strong truncate">{b}</p></div>)}
            </div>
          </div>
          <section className="qa-cat-paper qa-cat-border p-5">
            <div className="flex flex-wrap gap-2">
              {['TODOS', 'AGUARDANDO DOCUMENTOS', 'EM VALIDAÇÃO IA', 'REVISÃO HUMANA', 'PROTOCOLADO', 'DEFERIDO', 'POSSE', 'CAC', 'CRAF'].map((chip, idx) => <span key={chip} className={idx === 0 ? 'qa-cat-chip is-active' : 'qa-cat-chip'}>{chip}</span>)}
            </div>
          </section>
          <section className="qa-cat-paper qa-cat-border overflow-hidden">
            <div className="qa-cat-table-header">Tabela mestra de processos</div>
            <div className="overflow-x-auto">
              <table className="qa-cat-data-table">
                <thead><tr><th>Protocolo</th><th>Serviço</th><th>Status</th><th>Etapa</th><th>Docs</th><th>Prazo</th><th>Ação</th></tr></thead>
                <tbody>
                  {rows.map((processo, idx) => (
                    <tr key={processo.id || idx}>
                      <td>{protocolLabel(processo, idx)}</td><td>{serviceLabel(processo, fallbackProcesses[idx]?.servico_nome)}</td><td><span className="qa-cat-dot qa-cat-dot-strong" /> {statusLabel(processo.status)}</td><td>{Math.min(5, Number(processo.etapa_liberada_ate || idx + 2))}/5</td><td>{docOk}/{docTotal}</td><td>{deadlineLabel(idx === 0 ? diasPrazo : 30 + idx * 15)}</td><td>{idx === 1 ? 'Pagar GRU' : 'Abrir dossiê'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="qa-cat-paper qa-cat-border p-5 lg:col-span-2"><p className="qa-cat-kicker">Expansão da linha selecionada</p><h4 className="qa-cat-section-title">{serviceLabel(primary, fallbackProcesses[0].servico_nome)}</h4><div className="mt-4 grid gap-3 sm:grid-cols-2">{kycItems.map((item, i) => <div key={item} className="flex gap-2"><span className={`qa-cat-check ${i < 6 ? 'is-done' : ''}`} /><span className="qa-cat-small">{item}</span></div>)}</div><div className="mt-5 flex flex-wrap gap-2">{['Baixar PDF', 'Enviar via Gov.br', 'Atualizar minuta', 'Abrir checklist'].map((item) => <button key={item} className="qa-cat-ghost-button">{item}</button>)}</div></section>
            <section className="qa-cat-paper qa-cat-border p-5"><p className="qa-cat-kicker">Prazo crítico fixo</p><p className="qa-cat-big-number">{deadlineLabel(diasPrazo)}</p><p className="qa-cat-copy">Documento: {prazoBase?.prazo_critico_doc_label || 'Comprovante de residência'}. Impacto: protocolo suspenso até nova validação.</p></section>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="qa-cat-paper qa-cat-border p-5"><p className="qa-cat-kicker">Assistente oficial · 5 etapas</p><div className="mt-4 qa-cat-timeline-row">{officialSteps.map((step, i) => <div key={step} className="qa-cat-step"><span className={`qa-cat-dot ${i < 4 ? 'qa-cat-dot-strong' : 'qa-cat-dot-muted'}`} /><span>{step}</span><small>{i < 4 ? 'Conferido' : 'Próximo'}</small></div>)}</div></section>
            <section className="qa-cat-paper qa-cat-border p-5"><p className="qa-cat-kicker">Tabela de validade</p><div className="mt-3 qa-cat-table">{docRows.map(([doc, val, dias]) => <div key={doc} className="qa-cat-table-row"><span>{doc}</span><span>{val}</span><strong>{dias}</strong></div>)}</div></section>
          </div>
          <section className="qa-cat-paper qa-cat-border p-5"><p className="qa-cat-kicker">Expediente global</p><div className="mt-4 grid gap-3 md:grid-cols-2">{events.slice(0, 8).map((event, idx) => <div key={idx} className="qa-cat-event"><span className="qa-cat-dot qa-cat-dot-muted" /><div><p>{event.label}</p><small>{fmtDate(event.date)}</small></div></div>)}</div></section>
          <section className="qa-cat-empty">Histórico arquivado: sem publicações antigas no recorte atual.</section>
        </div>
      </article>

      <article className="qa-cat-page p-4 md:p-6">
        <div className="qa-cat-frame space-y-6">
          <header className="text-center border-b qa-cat-border-soft pb-6">
            <p className="qa-cat-kicker">Modelo 03 · Boletim oficial coluna única</p>
            <h3 className="qa-cat-hero">Área do Cliente — Meus Processos</h3>
            <p className="qa-cat-copy mx-auto max-w-3xl">Boletim documental com sumário numerado, extrato contratual, publicações de processo, expediente de eventos e rodapé institucional.</p>
          </header>
          <nav className="grid gap-px qa-cat-grid md:grid-cols-9">{['KPIs', 'Prazo', 'Filtros', 'Contrato', 'Assistente', 'Docs', 'Processos', 'Timeline', 'Histórico'].map((item, i) => <div key={item} className="qa-cat-paper p-3 text-center"><p className="qa-cat-micro">§0{i + 1}</p><p className="qa-cat-small qa-cat-strong">{item}</p></div>)}</nav>
          <section className="qa-cat-paper qa-cat-border p-6"><p className="qa-cat-kicker">§01 — Indicadores oficiais</p><div className="mt-4 grid gap-px qa-cat-grid md:grid-cols-4">{[["Processos ativos", rows.length], ["Documentos aprovados", `${docOk}/${docTotal}`], ["Aguardando perícia", 1], ["Próximo vencimento", deadlineLabel(diasPrazo)]].map(([a, b]) => <div key={a} className="qa-cat-paper p-4"><p className="qa-cat-micro">{a}</p><p className="qa-cat-mono qa-cat-strong">{b}</p></div>)}</div></section>
          <section className="qa-cat-paper qa-cat-border p-6"><p className="qa-cat-kicker">§02 — Extrato de prazo crítico</p><h4 className="qa-cat-section-title">{prazoBase?.prazo_critico_doc_label || 'Certidão de antecedentes criminais'}</h4><p className="qa-cat-copy">O documento vence em <strong>{deadlineLabel(diasPrazo)}</strong>. Caso não seja substituído, o dossiê permanecerá em exigência e não será protocolado no órgão competente.</p></section>
          <section className="qa-cat-paper qa-cat-border p-6"><p className="qa-cat-kicker">§03–§06 — Extrato contratual, filtros e documentos</p><div className="mt-4 grid gap-6 lg:grid-cols-2"><div><h4 className="qa-cat-section-title">Instrumento particular de prestação de serviços</h4><p className="qa-cat-copy">Assinatura ICP-Brasil/Gov.br, carimbo de tempo e referência MP 2.200-2/2001. Ações disponíveis: baixar PDF, enviar via Gov.br e atualizar minuta.</p><div className="mt-4 flex flex-wrap gap-2">{['Todos', 'Em análise', 'Protocolado', 'CAC', 'Posse'].map((chip) => <span key={chip} className="qa-cat-chip">{chip}</span>)}</div></div><div className="grid gap-2">{kycItems.map((item, i) => <div key={item} className="flex gap-2"><span className={`qa-cat-check ${i < 5 ? 'is-done' : ''}`} /><span className="qa-cat-small">{item}</span></div>)}</div></div></section>
          <section className="qa-cat-paper qa-cat-border p-6"><p className="qa-cat-kicker">§07 — Publicações de processo</p><div className="mt-5 space-y-5">{rows.map((processo, idx) => <div key={processo.id || idx} className="border-t qa-cat-border-soft pt-5"><p className="qa-cat-mono qa-cat-muted">PUBLICAÇÃO Nº {String(idx + 1).padStart(3, '0')} · {protocolLabel(processo, idx)}</p><h4 className="qa-cat-section-title">{serviceLabel(processo, fallbackProcesses[idx]?.servico_nome)}</h4><p className="qa-cat-copy">Status: {statusLabel(processo.status)} · etapa {Math.min(5, Number(processo.etapa_liberada_ate || idx + 2))}/5 · documentos {docOk}/{docTotal} · órgão {idx === 2 ? 'SFPC/EB' : 'Polícia Federal'}.</p><div className="mt-3 qa-cat-timeline-row">{['Recebido', 'Pago', 'Checklist', 'IA', 'Revisão', 'Protocolo'].map((item, i) => <div key={item} className="qa-cat-step"><span className={`qa-cat-dot ${i <= 3 ? 'qa-cat-dot-strong' : 'qa-cat-dot-muted'}`} /><span>{item}</span><small>{fmtDate(new Date(Date.now() - (i + idx) * 86400000).toISOString())}</small></div>)}</div></div>)}</div></section>
          <section className="qa-cat-paper qa-cat-border p-6"><p className="qa-cat-kicker">§08 — Expediente do dia</p><div className="mt-4 columns-1 md:columns-2 gap-8 space-y-3">{events.slice(0, 10).map((event, idx) => <p key={idx} className="qa-cat-copy break-inside-avoid"><span className="qa-cat-mono qa-cat-strong">{fmtDate(event.date)}</span> — {event.label}</p>)}</div></section>
          <section className="qa-cat-empty">§09 — Histórico arquivado: nada consta para o período consultado.</section>
        </div>
      </article>
    </section>
  );
}