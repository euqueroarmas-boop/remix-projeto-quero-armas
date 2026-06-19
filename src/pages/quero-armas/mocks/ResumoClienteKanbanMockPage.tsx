const columns = [
  {
    kind: "todo",
    title: "A Fazer",
    count: 2,
    cards: [
      {
        tag: "Aquisição",
        title: "Cadastrar arma no SIGMA",
        text: "Aguardando emissão da Guia de Tráfego para protocolar o registro definitivo.",
        due: "Em 5 dias",
        owner: "Você",
        initials: "JM",
      },
      {
        tag: "Documentos",
        title: "Anexar comprovante de endereço",
        text: "Conta atualizada dos últimos 90 dias em nome do titular.",
        due: "Sem prazo definido",
        dueTone: "warn",
        owner: "Você",
        initials: "JM",
      },
    ],
  },
  {
    kind: "doing",
    title: "Em Andamento",
    count: 3,
    cards: [
      {
        tag: "Aquisição",
        tagTone: "bordo",
        title: "Pistola 9mm — CAC Atirador",
        progress: 65,
        checks: [[true, "Pagamento confirmado"], [true, "SIGMA preenchido"], [false, "Certidões criminais"]],
        due: "Vence em 12 dias",
        dueTone: "warn",
        owner: "Dr. Carlos",
        initials: "CA",
        avatarTone: "dark",
      },
      {
        tag: "Renovação",
        tagTone: "bordo",
        title: "Renovação de CR — Colecionador",
        progress: 30,
        text: "Em análise pelo Exército. Próximo passo: agendar vistoria.",
        due: "Vence em 42 dias",
        owner: "Ana Souza",
        initials: "AN",
        avatarTone: "amber",
      },
      {
        tag: "Porte",
        tagTone: "bordo",
        title: "Porte de Trânsito — Evento de tiro",
        progress: 80,
        text: "Guia de Tráfego emitida. Aguardando assinatura digital do despachante.",
        due: "Pronto em 2 dias",
        owner: "Dr. Carlos",
        initials: "CA",
        avatarTone: "dark",
      },
    ],
  },
  {
    kind: "review",
    title: "Em Revisão",
    count: 2,
    cards: [
      {
        tag: "Documentos",
        tagTone: "amber",
        title: "Certidão criminal estadual",
        text: "Validade expira em 8 dias. Recomendado renovar antes do protocolo.",
        due: "Expira em 8 dias",
        dueTone: "bad",
        owner: "Ana Souza",
        initials: "AN",
        avatarTone: "amber",
      },
      {
        tag: "Renovação",
        tagTone: "amber",
        title: "Comprovante de atividade — Clube de Tiro",
        text: "Aguardando assinatura do diretor técnico do clube.",
        due: "Vence em 15 dias",
        dueTone: "warn",
        owner: "Você",
        initials: "JM",
      },
    ],
  },
  {
    kind: "done",
    title: "Concluído",
    count: 2,
    cards: [
      {
        tag: "Aquisição",
        tagTone: "ok",
        title: "Autorização de compra emitida",
        due: "Concluído em 14/06",
        owner: "Dr. Carlos",
        initials: "CA",
        avatarTone: "dark",
      },
      {
        tag: "Documentos",
        tagTone: "ok",
        title: "Laudo psicológico aprovado",
        due: "Concluído em 02/06",
        owner: "Ana Souza",
        initials: "AN",
        avatarTone: "amber",
      },
    ],
  },
];

const filters = ["Todos 9", "Aquisição 3", "Renovação 2", "Porte 2", "Documentos 2"];
const summary = [
  ["Tarefas Abertas", "7", "de 9"],
  ["Próximo Vencimento", "2", "dias"],
  ["Documentos a Renovar", "1", "urgente"],
  ["Processos Ativos", "3", ""],
];

export default function ResumoClienteKanbanMockPage() {
  return (
    <main className="qa-kanban-mock">
      <style>{`
        .qa-kanban-mock{--paper:#f6f5f1;--paper-2:#efece4;--ink:#141414;--ink-2:#3a3a3a;--muted:#7a756c;--line:#d9d4c7;--line-2:#c4bea9;--bordo:#7A1F2B;--bordo-soft:#f1dee0;--amber:#a8741a;--amber-soft:#f5e6c8;--danger:#8a1414;--danger-soft:#f3d6d6;--ok:#1f4d2b;--ok-soft:#dfead9;min-height:100vh;background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:20px 16px 80px}
        .qa-kanban-mock *{box-sizing:border-box}.qa-kanban-mock__wrap{max-width:1400px;margin:0 auto}.qa-kanban-mock__top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}.qa-kanban-mock__brand{font-family:Georgia,serif;font-weight:700;font-size:22px;color:var(--bordo);white-space:nowrap}.qa-kanban-mock__crumb{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}.qa-kanban-mock h1{font-family:Georgia,serif;font-weight:700;font-size:28px;line-height:1.1;margin:0}.qa-kanban-mock__meta{display:flex;gap:14px;align-items:center;font-size:12px;color:var(--ink-2);margin-top:6px;flex-wrap:wrap}.qa-kanban-mock__meta b{color:var(--ink)}.qa-kanban-mock__dot{width:6px;height:6px;border-radius:50%;background:var(--bordo);display:inline-block;margin-right:6px}.qa-kanban-mock__toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.qa-kanban-mock__chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border:1px solid var(--line);background:#fff;color:var(--ink-2);border-radius:999px}.qa-kanban-mock__chip:first-child{background:var(--ink);color:var(--paper);border-color:var(--ink)}
        .qa-kanban-mock__board{display:grid;grid-template-columns:repeat(4,minmax(260px,1fr));gap:14px}.qa-kanban-mock__col{background:var(--paper-2);border:1px solid var(--line);border-radius:10px;padding:10px;min-height:300px;display:flex;flex-direction:column}.qa-kanban-mock__strip{height:3px;border-radius:3px;background:var(--line-2);margin:-2px 4px 10px}.qa-kanban-mock__col.doing .qa-kanban-mock__strip{background:var(--bordo)}.qa-kanban-mock__col.review .qa-kanban-mock__strip{background:var(--amber)}.qa-kanban-mock__col.done .qa-kanban-mock__strip{background:var(--ok)}.qa-kanban-mock h2{margin:2px 4px 10px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2);display:flex;align-items:center;justify-content:space-between}.qa-kanban-mock__col.doing h2{color:var(--bordo)}.qa-kanban-mock__col.review h2{color:var(--amber)}.qa-kanban-mock__col.done h2{color:var(--ok)}.qa-kanban-mock__count{background:#fff;border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:10px;letter-spacing:.1em;color:var(--ink)}
        .qa-kanban-mock__card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:11px 12px 12px;margin-bottom:10px;box-shadow:0 1px 0 rgba(0,0,0,.02)}.qa-kanban-mock__tag{display:inline-block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:2px 7px;border-radius:3px;background:var(--paper-2);color:var(--ink-2);border:1px solid var(--line);margin-bottom:6px}.qa-kanban-mock__tag.bordo{background:var(--bordo-soft);color:var(--bordo);border-color:#e6c8cc}.qa-kanban-mock__tag.amber{background:var(--amber-soft);color:#7a5410;border-color:#e6d3a3}.qa-kanban-mock__tag.ok{background:var(--ok-soft);color:var(--ok);border-color:#c9dabd}.qa-kanban-mock h3{margin:2px 0 6px;font-size:14px;font-weight:600;line-height:1.25}.qa-kanban-mock p{margin:0 0 8px;font-size:12px;color:var(--ink-2);line-height:1.45}.qa-kanban-mock__progress{height:4px;background:var(--paper-2);border-radius:2px;overflow:hidden;margin:4px 0 8px;border:1px solid var(--line)}.qa-kanban-mock__progress span{display:block;height:100%;background:var(--bordo)}.qa-kanban-mock__check{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--ink-2);margin:3px 0}.qa-kanban-mock__box{width:11px;height:11px;border:1.5px solid var(--line-2);border-radius:2px;flex-shrink:0;background:#fff}.qa-kanban-mock__check.ok .qa-kanban-mock__box{background:var(--ok);border-color:var(--ok);position:relative}.qa-kanban-mock__check.ok .qa-kanban-mock__box:after{content:"";position:absolute;left:2px;top:0;width:4px;height:7px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}.qa-kanban-mock__check.ok span:last-child{text-decoration:line-through;color:var(--muted)}
        .qa-kanban-mock__foot{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px dashed var(--line);padding-top:7px;margin-top:8px}.qa-kanban-mock__due{font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:5px}.qa-kanban-mock__due.warn{color:var(--amber)}.qa-kanban-mock__due.bad{color:var(--danger)}.qa-kanban-mock__ic{width:10px;height:10px;border-radius:2px;background:currentColor;opacity:.6}.qa-kanban-mock__who{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-2);white-space:nowrap}.qa-kanban-mock__avatar{width:18px;height:18px;border-radius:50%;background:var(--bordo);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}.qa-kanban-mock__avatar.dark{background:#3a3a3a}.qa-kanban-mock__avatar.amber{background:var(--amber)}.qa-kanban-mock__add{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:center;padding:10px;border:1px dashed var(--line);border-radius:8px;margin-top:auto}.qa-kanban-mock__summary{margin-top:22px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.qa-kanban-mock__sm{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 12px}.qa-kanban-mock__k{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.qa-kanban-mock__v{font-family:Georgia,serif;font-size:22px;font-weight:700;color:var(--ink);margin-top:2px}.qa-kanban-mock__v small{font-family:Inter,sans-serif;font-size:11px;font-weight:500;color:var(--muted);margin-left:6px}
        @media (max-width:1100px){.qa-kanban-mock__board{grid-template-columns:repeat(2,1fr)}.qa-kanban-mock__summary{grid-template-columns:repeat(2,1fr)}}@media (max-width:560px){.qa-kanban-mock{padding:16px 12px 64px}.qa-kanban-mock__top{align-items:flex-start}.qa-kanban-mock__brand{font-size:16px}.qa-kanban-mock h1{font-size:22px}.qa-kanban-mock__board{grid-template-columns:1fr}.qa-kanban-mock__summary{grid-template-columns:1fr 1fr}.qa-kanban-mock__foot{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="qa-kanban-mock__wrap">
        <header className="qa-kanban-mock__top">
          <div>
            <div className="qa-kanban-mock__crumb">Quero Armas · Resumo do Cliente</div>
            <h1>João da Silva Mendes</h1>
            <div className="qa-kanban-mock__meta">
              <span><span className="qa-kanban-mock__dot" />CAC Ativo</span>
              <span><b>CR</b> 12345-67</span>
              <span><b>3</b> processos em andamento</span>
            </div>
          </div>
          <div className="qa-kanban-mock__brand">Quero Armas</div>
        </header>

        <div className="qa-kanban-mock__toolbar" aria-label="Filtros do kanban">
          {filters.map((filter) => <span className="qa-kanban-mock__chip" key={filter}>{filter}</span>)}
        </div>

        <div className="qa-kanban-mock__board">
          {columns.map((column) => (
            <section className={`qa-kanban-mock__col ${column.kind}`} key={column.title}>
              <div className="qa-kanban-mock__strip" />
              <h2>{column.title}<span className="qa-kanban-mock__count">{column.count}</span></h2>
              {column.cards.map((card) => (
                <article className="qa-kanban-mock__card" key={card.title}>
                  <span className={`qa-kanban-mock__tag ${card.tagTone ?? ""}`}>{card.tag}</span>
                  <h3>{card.title}</h3>
                  {typeof card.progress === "number" && <div className="qa-kanban-mock__progress"><span style={{ width: `${card.progress}%` }} /></div>}
                  {card.text && <p>{card.text}</p>}
                  {card.checks?.map(([ok, text]) => (
                    <div className={`qa-kanban-mock__check ${ok ? "ok" : ""}`} key={String(text)}><span className="qa-kanban-mock__box" /><span>{text}</span></div>
                  ))}
                  <div className="qa-kanban-mock__foot">
                    <span className={`qa-kanban-mock__due ${card.dueTone ?? ""}`}><span className="qa-kanban-mock__ic" />{card.due}</span>
                    <span className="qa-kanban-mock__who"><span className={`qa-kanban-mock__avatar ${card.avatarTone ?? ""}`}>{card.initials}</span>{card.owner}</span>
                  </div>
                </article>
              ))}
              {column.kind === "todo" && <div className="qa-kanban-mock__add">+ Nova tarefa</div>}
            </section>
          ))}
        </div>

        <div className="qa-kanban-mock__summary">
          {summary.map(([label, value, small]) => (
            <div className="qa-kanban-mock__sm" key={label}>
              <div className="qa-kanban-mock__k">{label}</div>
              <div className="qa-kanban-mock__v">{value}{small && <small>{small}</small>}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}