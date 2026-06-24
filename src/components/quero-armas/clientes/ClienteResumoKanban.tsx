import { useMemo } from "react";
import { computeExameStatus, formatExameCountdown } from "@/components/quero-armas/clientes/ClienteExames";
import { useQAServicosMap } from "@/hooks/useQAServicosMap";
import { calcularPrazosProcessuais } from "@/lib/quero-armas/prazosProcessuais";

interface Props {
  cliente: any;
  vendas: any[];
  itens: any[];
  crafs: any[];
  gtes: any[];
  filiacoes: any[];
  cadastro: any;
  examesAtuais?: any[];
  armasManual?: any[];
  onNavigate: (tab: string) => void;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return computeExameStatus(dateStr).dias_restantes; } catch { return null; }
}

type Card = {
  tag: string;
  tagTone?: "bordo" | "amber" | "ok";
  title: string;
  text?: string;
  progress?: number;
  checks?: Array<[boolean, string]>;
  due: string;
  dueTone?: "warn" | "bad";
  owner: string;
  initials: string;
  avatarTone?: "dark" | "amber";
};

function fmtDue(days: number | null, prefix = "Vence") {
  if (days === null) return "Sem prazo definido";
  if (days < 0) return `Vencido há ${Math.abs(days)} dias`;
  if (days === 0) return "Vence hoje";
  return `${prefix} em ${days} dias`;
}

function tagFromCategory(cat: string): { tag: string; tone?: Card["tagTone"] } {
  if (cat === "CR" || cat === "CRAF" || cat === "GTE") return { tag: "Arsenal", tone: "bordo" };
  if (cat === "EXAME") return { tag: "Exames", tone: "amber" };
  if (cat === "FILIAÇÃO") return { tag: "Filiação", tone: "amber" };
  if (cat === "PRAZO ADM") return { tag: "Prazo Adm.", tone: "bordo" };
  if (cat === "SERVIÇO") return { tag: "Processo", tone: "bordo" };
  return { tag: cat };
}

export default function ClienteResumoKanban({
  cliente, vendas, itens, crafs, gtes, filiacoes, cadastro,
  examesAtuais = [], armasManual = [], onNavigate,
}: Props) {
  const { map: SERVICO_MAP } = useQAServicosMap();

  const data = useMemo(() => {
    // ── Vencimentos / documentos ────────────────────────────────────
    type Exp = { label: string; date: string | null; days: number | null; category: string };
    const exp: Exp[] = [];
    if (cadastro?.validade_cr)
      exp.push({ label: "Certificado de Registro (CR)", date: cadastro.validade_cr, days: daysUntil(cadastro.validade_cr), category: "CR" });

    const exameByTipo = new Map<string, any>();
    for (const e of examesAtuais) if (e?.tipo && !exameByTipo.has(e.tipo)) exameByTipo.set(e.tipo, e);
    const psi = exameByTipo.get("psicologico");
    const tiro = exameByTipo.get("tiro");
    if (psi?.data_vencimento)
      exp.push({ label: "Laudo Psicológico", date: psi.data_vencimento, days: daysUntil(psi.data_vencimento), category: "EXAME" });
    if (tiro?.data_vencimento)
      exp.push({ label: "Exame de Tiro", date: tiro.data_vencimento, days: daysUntil(tiro.data_vencimento), category: "EXAME" });

    crafs.forEach((cr: any) => { if (cr.data_validade) exp.push({ label: `CRAF — ${cr.nome_arma || cr.nome_craf || "Arma"}`, date: cr.data_validade, days: daysUntil(cr.data_validade), category: "CRAF" }); });
    gtes.forEach((g: any) => { if (g.data_validade) exp.push({ label: `GTE — ${g.nome_arma || g.nome_gte || "Arma"}`, date: g.data_validade, days: daysUntil(g.data_validade), category: "GTE" }); });
    filiacoes.forEach((f: any) => { if (f.validade_filiacao) exp.push({ label: `Filiação — ${f.nome_filiacao || `Clube #${f.clube_id}`}`, date: f.validade_filiacao, days: daysUntil(f.validade_filiacao), category: "FILIAÇÃO" }); });

    const prazosProc = calcularPrazosProcessuais(
      itens.map((it: any) => ({
        id: it.id,
        servico_id: it.servico_id,
        servico_nome: SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`,
        status: it.status,
        numero_processo: it.numero_processo,
        data_notificacao: it.data_notificacao,
        data_indeferimento: it.data_indeferimento,
        data_recurso_administrativo: it.data_recurso_administrativo,
        data_indeferimento_recurso: it.data_indeferimento_recurso,
      })),
    );
    for (const p of prazosProc) {
      const nome = p.servicoNome || `Serviço #${p.servicoId ?? "?"}`;
      const suf = p.evento === "MANDADO DE SEGURANÇA"
        ? "MS (120d)"
        : p.evento === "RESTITUIÇÃO" ? "Manifestação (10d)" : "Recurso (10d)";
      exp.push({
        label: `${p.evento} — ${nome} · ${suf}`,
        date: p.dataLimite,
        days: p.diasRestantes,
        category: "PRAZO ADM",
      });
    }

    // ── Serviços / processos ────────────────────────────────────────
    const ativos = itens.filter((i: any) => !["CONCLUÍDO", "DEFERIDO", "INDEFERIDO", "DESISTIU", "RESTITUÍDO"].includes((i.status || "").toUpperCase()));
    const concluidos = itens.filter((i: any) => ["CONCLUÍDO", "DEFERIDO"].includes((i.status || "").toUpperCase()));

    // ── Colunas ─────────────────────────────────────────────────────
    const todo: Card[] = [];
    const doing: Card[] = [];
    const review: Card[] = [];
    const done: Card[] = [];

    // A Fazer = vencidos OR ≤ 30 dias OR sem data
    exp.forEach((d) => {
      const t = tagFromCategory(d.category);
      const isUrgent = d.days !== null && d.days <= 30;
      const noDate = d.days === null;
      if (!isUrgent && !noDate) return;
      todo.push({
        tag: t.tag, tagTone: t.tone,
        title: d.label,
        text: noDate ? "Documento sem data de validade cadastrada." : undefined,
        due: noDate ? "Sem prazo definido" : fmtDue(d.days),
        dueTone: d.days !== null && d.days < 0 ? "bad" : "warn",
        owner: "Equipe Quero Armas",
        initials: "QA",
        avatarTone: "dark",
      });
    });

    // Em Andamento = serviços ativos
    ativos.forEach((it: any) => {
      const nome = SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`;
      // progresso simples baseado em marcos
      const marcos = [
        !!it.data_protocolo,
        !!it.numero_processo,
        !!it.data_ultima_atualizacao,
        !!it.data_deferimento,
      ];
      const progress = Math.round((marcos.filter(Boolean).length / marcos.length) * 100);
      const dVenc = daysUntil(it.data_vencimento);
      doing.push({
        tag: it.status || "Em andamento", tagTone: "bordo",
        title: nome,
        progress,
        text: it.numero_processo ? `Processo nº ${it.numero_processo}` : undefined,
        checks: [
          [marcos[0], "Protocolado"],
          [marcos[1], "Número de processo"],
          [marcos[3], "Deferimento"],
        ],
        due: dVenc !== null ? fmtDue(dVenc) : (it.status || "Em análise"),
        dueTone: dVenc !== null && dVenc <= 30 ? (dVenc < 0 ? "bad" : "warn") : undefined,
        owner: "Equipe Quero Armas",
        initials: "QA",
        avatarTone: "dark",
      });
    });

    // Em Revisão = documentos 31–90 dias
    exp.forEach((d) => {
      if (d.days === null) return;
      if (d.days <= 30 || d.days > 90) return;
      const t = tagFromCategory(d.category);
      review.push({
        tag: t.tag, tagTone: "amber",
        title: d.label,
        text: "Planeje a renovação antes do vencimento para evitar reprotocolo.",
        due: fmtDue(d.days),
        dueTone: "warn",
        owner: "Você",
        initials: (cliente?.nome_completo || "C").slice(0, 2).toUpperCase(),
        avatarTone: "amber",
      });
    });

    // Concluído
    concluidos.slice(0, 6).forEach((it: any) => {
      const nome = SERVICO_MAP[it.servico_id] || `Serviço #${it.servico_id}`;
      const data = it.data_deferimento || it.data_ultima_atualizacao;
      done.push({
        tag: it.status || "Concluído", tagTone: "ok",
        title: nome,
        due: data ? `Concluído em ${new Date(data).toLocaleDateString("pt-BR")}` : "Concluído",
        owner: "Equipe Quero Armas",
        initials: "QA",
        avatarTone: "dark",
      });
    });

    const proximoVenc = exp
      .filter((d) => d.days !== null && d.days >= 0)
      .sort((a, b) => (a.days! - b.days!))[0];
    const docsUrg = exp.filter((d) => d.days !== null && d.days <= 30).length;

    const summary: Array<[string, string, string]> = [
      ["Tarefas Abertas", String(todo.length + doing.length), `de ${todo.length + doing.length + review.length + done.length}`],
      ["Próximo Vencimento", proximoVenc ? String(Math.max(proximoVenc.days!, 0)) : "—", proximoVenc ? "dias" : ""],
      ["Documentos a Renovar", String(docsUrg), docsUrg > 0 ? "urgente" : ""],
      ["Processos Ativos", String(ativos.length), ""],
    ];

    return { todo, doing, review, done, summary, prazosCount: prazosProc.length };
  }, [cliente, vendas, itens, crafs, gtes, filiacoes, cadastro, examesAtuais, armasManual, SERVICO_MAP]);

  const filters = [
    `Todos ${data.todo.length + data.doing.length + data.review.length + data.done.length}`,
    `Arsenal ${crafs.length + gtes.length}`,
    `Exames ${(examesAtuais || []).length}`,
    `Processos ${itens.length}`,
  ];

  const columns: Array<{ kind: "todo" | "doing" | "review" | "done"; title: string; cards: Card[]; addLabel?: string; navTo?: string }> = [
    { kind: "todo", title: "A Fazer", cards: data.todo, addLabel: "+ Ver arsenal", navTo: "arsenal" },
    { kind: "doing", title: "Em Andamento", cards: data.doing, navTo: "servicos" },
    { kind: "review", title: "Em Revisão", cards: data.review, navTo: "exames" },
    { kind: "done", title: "Concluído", cards: data.done, navTo: "historico" },
  ];

  return (
    <main className="qa-kanban-resumo">
      <style>{`
        .qa-kanban-resumo{--paper:#ffffff;--paper-2:#f7f7f8;--ink:#141414;--ink-2:#3a3a3a;--muted:#7a7a82;--line:#e6e6ea;--line-2:#cfcfd6;--bordo:#7A1F2B;--bordo-soft:#fbeaec;--amber:#a8741a;--amber-soft:#fbf0d6;--danger:#8a1414;--danger-soft:#f8dada;--ok:#1f4d2b;--ok-soft:#e3efdd;background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:18px 14px 24px;border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(15,15,20,.03)}
        .qa-kanban-resumo *{box-sizing:border-box}
        .qa-kanban-resumo__wrap{max-width:1400px;margin:0 auto}
        .qa-kanban-resumo__top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px}
        .qa-kanban-resumo__brand{font-family:Georgia,serif;font-weight:700;font-size:18px;color:var(--bordo);white-space:nowrap}
        .qa-kanban-resumo__crumb{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
        .qa-kanban-resumo h1{font-family:Georgia,serif;font-weight:700;font-size:22px;line-height:1.1;margin:0}
        .qa-kanban-resumo__meta{display:flex;gap:14px;align-items:center;font-size:12px;color:var(--ink-2);margin-top:6px;flex-wrap:wrap}
        .qa-kanban-resumo__meta b{color:var(--ink)}
        .qa-kanban-resumo__dot{width:6px;height:6px;border-radius:50%;background:var(--bordo);display:inline-block;margin-right:6px}
        .qa-kanban-resumo__toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
        .qa-kanban-resumo__chip{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;border:1px solid var(--line);background:#fff;color:var(--ink-2);border-radius:999px}
        .qa-kanban-resumo__chip:first-child{background:var(--ink);color:var(--paper);border-color:var(--ink)}
        .qa-kanban-resumo__board{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:12px}
        .qa-kanban-resumo__col{background:var(--paper-2);border:1px solid var(--line);border-radius:10px;padding:10px;min-height:240px;display:flex;flex-direction:column}
        .qa-kanban-resumo__strip{height:3px;border-radius:3px;background:var(--line-2);margin:-2px 4px 10px}
        .qa-kanban-resumo__col.doing .qa-kanban-resumo__strip{background:var(--bordo)}
        .qa-kanban-resumo__col.review .qa-kanban-resumo__strip{background:var(--amber)}
        .qa-kanban-resumo__col.done .qa-kanban-resumo__strip{background:var(--ok)}
        .qa-kanban-resumo h2{margin:2px 4px 10px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-2);display:flex;align-items:center;justify-content:space-between;font-weight:700}
        .qa-kanban-resumo__col.doing h2{color:var(--bordo)}
        .qa-kanban-resumo__col.review h2{color:var(--amber)}
        .qa-kanban-resumo__col.done h2{color:var(--ok)}
        .qa-kanban-resumo__count{background:#fff;border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:10px;letter-spacing:.1em;color:var(--ink)}
        .qa-kanban-resumo__card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 11px 11px;margin-bottom:8px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
        .qa-kanban-resumo__tag{display:inline-block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:2px 7px;border-radius:3px;background:var(--paper-2);color:var(--ink-2);border:1px solid var(--line);margin-bottom:6px;font-weight:700}
        .qa-kanban-resumo__tag.bordo{background:var(--bordo-soft);color:var(--bordo);border-color:#e6c8cc}
        .qa-kanban-resumo__tag.amber{background:var(--amber-soft);color:#7a5410;border-color:#e6d3a3}
        .qa-kanban-resumo__tag.ok{background:var(--ok-soft);color:var(--ok);border-color:#c9dabd}
        .qa-kanban-resumo h3{margin:2px 0 6px;font-size:13px;font-weight:700;line-height:1.25;color:var(--ink)}
        .qa-kanban-resumo p{margin:0 0 8px;font-size:11.5px;color:var(--ink-2);line-height:1.45}
        .qa-kanban-resumo__progress{height:4px;background:var(--paper-2);border-radius:2px;overflow:hidden;margin:4px 0 8px;border:1px solid var(--line)}
        .qa-kanban-resumo__progress span{display:block;height:100%;background:var(--bordo)}
        .qa-kanban-resumo__check{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--ink-2);margin:3px 0}
        .qa-kanban-resumo__box{width:11px;height:11px;border:1.5px solid var(--line-2);border-radius:2px;flex-shrink:0;background:#fff;position:relative}
        .qa-kanban-resumo__check.ok .qa-kanban-resumo__box{background:var(--ok);border-color:var(--ok)}
        .qa-kanban-resumo__check.ok .qa-kanban-resumo__box:after{content:"";position:absolute;left:2px;top:0;width:4px;height:7px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
        .qa-kanban-resumo__check.ok span:last-child{text-decoration:line-through;color:var(--muted)}
        .qa-kanban-resumo__foot{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px dashed var(--line);padding-top:7px;margin-top:8px;flex-wrap:wrap}
        .qa-kanban-resumo__due{font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:5px;font-weight:600}
        .qa-kanban-resumo__due.warn{color:var(--amber)}
        .qa-kanban-resumo__due.bad{color:var(--danger)}
        .qa-kanban-resumo__ic{width:8px;height:8px;border-radius:2px;background:currentColor;opacity:.6}
        .qa-kanban-resumo__who{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-2);white-space:nowrap}
        .qa-kanban-resumo__avatar{width:18px;height:18px;border-radius:50%;background:var(--bordo);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
        .qa-kanban-resumo__avatar.dark{background:#3a3a3a}
        .qa-kanban-resumo__avatar.amber{background:var(--amber)}
        .qa-kanban-resumo__add{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:center;padding:10px;border:1px dashed var(--line);border-radius:8px;margin-top:auto;background:transparent;cursor:pointer;font-weight:700}
        .qa-kanban-resumo__add:hover{color:var(--bordo);border-color:var(--bordo)}
        .qa-kanban-resumo__empty{font-size:11px;color:var(--muted);text-align:center;padding:14px 8px;font-style:italic}
        .qa-kanban-resumo__summary{margin-top:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .qa-kanban-resumo__sm{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 12px}
        .qa-kanban-resumo__k{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700}
        .qa-kanban-resumo__v{font-family:Georgia,serif;font-size:22px;font-weight:700;color:var(--ink);margin-top:2px}
        .qa-kanban-resumo__v small{font-family:Inter,sans-serif;font-size:11px;font-weight:600;color:var(--muted);margin-left:6px}
        @media (max-width:1100px){.qa-kanban-resumo__board{grid-template-columns:repeat(2,1fr)}.qa-kanban-resumo__summary{grid-template-columns:repeat(2,1fr)}}
        @media (max-width:640px){.qa-kanban-resumo{padding:14px 10px}.qa-kanban-resumo__top{align-items:flex-start;flex-direction:column;gap:6px}.qa-kanban-resumo h1{font-size:18px}.qa-kanban-resumo__board{grid-template-columns:1fr}.qa-kanban-resumo__summary{grid-template-columns:1fr 1fr}.qa-kanban-resumo__foot{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="qa-kanban-resumo__wrap">
        <header className="qa-kanban-resumo__top">
          <div>
            <h1>{cliente?.nome_completo || "Cliente"}</h1>
            <div className="qa-kanban-resumo__meta">
              <span><span className="qa-kanban-resumo__dot" />{cadastro?.categoria_titular || (cliente?.status_cliente || "Cliente")}</span>
              {cadastro?.numero_cr && <span><b>CR</b> {cadastro.numero_cr}</span>}
              <span><b>{itens.filter((i: any) => !["CONCLUÍDO","DEFERIDO","INDEFERIDO","DESISTIU","RESTITUÍDO"].includes((i.status||"").toUpperCase())).length}</b> processos em andamento</span>
            </div>
          </div>
        </header>

        <div className="qa-kanban-resumo__toolbar" aria-label="Filtros do kanban">
          {filters.map((f) => <span className="qa-kanban-resumo__chip" key={f}>{f}</span>)}
        </div>

        <div className="qa-kanban-resumo__board">
          {columns.map((col) => (
            <section className={`qa-kanban-resumo__col ${col.kind}`} key={col.kind}>
              <div className="qa-kanban-resumo__strip" />
              <h2>{col.title}<span className="qa-kanban-resumo__count">{col.cards.length}</span></h2>
              {col.cards.length === 0 && <div className="qa-kanban-resumo__empty">Nada por aqui.</div>}
              {col.cards.map((card, i) => (
                <article className="qa-kanban-resumo__card" key={`${col.kind}-${i}-${card.title}`}>
                  <span className={`qa-kanban-resumo__tag ${card.tagTone ?? ""}`}>{card.tag}</span>
                  <h3>{card.title}</h3>
                  {typeof card.progress === "number" && (
                    <div className="qa-kanban-resumo__progress"><span style={{ width: `${card.progress}%` }} /></div>
                  )}
                  {card.text && <p>{card.text}</p>}
                  {card.checks?.map(([ok, text]) => (
                    <div className={`qa-kanban-resumo__check ${ok ? "ok" : ""}`} key={String(text)}>
                      <span className="qa-kanban-resumo__box" /><span>{text}</span>
                    </div>
                  ))}
                  <div className="qa-kanban-resumo__foot">
                    <span className={`qa-kanban-resumo__due ${card.dueTone ?? ""}`}>
                      <span className="qa-kanban-resumo__ic" />{card.due}
                    </span>
                    <span className="qa-kanban-resumo__who">
                      <span className={`qa-kanban-resumo__avatar ${card.avatarTone ?? ""}`}>{card.initials}</span>{card.owner}
                    </span>
                  </div>
                </article>
              ))}
              {col.navTo && (
                <button type="button" className="qa-kanban-resumo__add" onClick={() => onNavigate(col.navTo!)}>
                  Abrir {col.navTo}
                </button>
              )}
            </section>
          ))}
        </div>

        <div className="qa-kanban-resumo__summary">
          {data.summary.map(([label, value, small]) => (
            <div className="qa-kanban-resumo__sm" key={label}>
              <div className="qa-kanban-resumo__k">{label}</div>
              <div className="qa-kanban-resumo__v">{value}{small && <small>{small}</small>}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}