import { ArrowLeft, ArrowRight, Check, Compass, Crosshair, FileSignature, HelpCircle, Leaf, Shield, ShieldCheck, Target, Wrench, Archive } from "lucide-react";

/* =============================================================================
 * Mockups — Assistente de Entrada em Cockpit Z6 Light
 * 5 variações × 2 passos. React puro. Tokens canônicos (sem IA).
 *   Page #F2F2F2 · Card #FFFFFF · Borda #E5E5E5 · Tinta #0A0A0A · Sec #6A6A6A
 *   Bordô #7A1F2B · Âmbar #D6A64B · Oswald (labels/H1) · Inter (corpo)
 * Acesse em /mockups-entrada-wizard
 * ============================================================================= */

const INK = "#0A0A0A";
const SUB = "#6A6A6A";
const LINE = "#E5E5E5";
const SOFT = "#EFEFEF";
const PAPER = "#FFFFFF";
const PAGE = "#F2F2F2";
const BORDO = "#7A1F2B";
const AMBAR = "#D6A64B";
const AMBAR_BG = "#FCEFCE";

const OSWALD = { fontFamily: "Oswald, sans-serif" } as const;
const INTER = { fontFamily: "Inter, sans-serif" } as const;

const objetivos = [
  { key: "inicial", icon: FileSignature, title: "TIRAR OU RENOVAR MEU CR DE CAC", sub: "Concessão de CR, filiação a clube, declarações iniciais — SINARM CAC" },
  { key: "defesa",  icon: Shield,        title: "ADQUIRIR ARMA PARA DEFESA PESSOAL", sub: "Posse, registro, porte, aquisição — Polícia Federal/SINARM" },
  { key: "mexer",   icon: Wrench,        title: "MEXER NUMA ARMA QUE JÁ TENHO",      sub: "Renovar CRAF, transferir, apostilar, GTE, regularizar" },
  { key: "tudo",    icon: Target,        title: "NÃO TENHO CERTEZA, ME MOSTRE TUDO", sub: "Vou navegar e escolher" },
] as const;

const possui = [
  { key: "sim",    icon: ShieldCheck, label: "SIM" },
  { key: "nao",    icon: Crosshair,   label: "NÃO" },
  { key: "nao_sei", icon: HelpCircle, label: "NÃO TENHO CERTEZA" },
] as const;

/* =========================================================================
 * Shell — render two steps side by side com header da variação
 * ========================================================================= */
function VarShell({ id, title, sub, children }: { id: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded border shadow-sm overflow-hidden" style={{ background: PAPER, borderColor: LINE }}>
      <header className="flex items-center justify-between px-5 py-3" style={{ background: BORDO, color: "#fff" }}>
        <div>
          <div className="text-[10px] font-bold opacity-80" style={OSWALD}>AMOSTRA {id}</div>
          <div className="text-[15px] font-bold uppercase tracking-wider" style={OSWALD}>{title}</div>
        </div>
        <div className="text-[10px] opacity-80" style={OSWALD}>{sub}</div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5" style={{ background: PAGE }}>
        {children}
      </div>
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded border ${className}`} style={{ background: PAPER, borderColor: LINE }}>
      {children}
    </div>
  );
}

function StepBadge({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-sm text-[12px] font-bold" style={{ ...OSWALD, background: BORDO, color: "#fff" }}>
        {step}
      </div>
      <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: SUB }}>
        PASSO {step} DE 2
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex gap-1">
      <div className="h-[3px] flex-1 rounded-sm" style={{ background: BORDO }} />
      <div className="h-[3px] flex-1 rounded-sm" style={{ background: step === 2 ? BORDO : SOFT }} />
    </div>
  );
}

/* =========================================================================
 * V1 — CLÁSSICA: Cards verticais com radio bordô, header Oswald
 * ========================================================================= */
function V1({ step }: { step: 1 | 2 }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 pb-3 border-b" style={{ borderColor: SOFT }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-sm" style={{ background: `${BORDO}14` }}>
          <Compass className="h-4 w-4" style={{ color: BORDO }} />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider" style={{ ...OSWALD, color: BORDO }}>ASSISTENTE DE NOVOS SERVIÇOS</div>
          <h3 className="text-[18px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
            Quer adquirir um novo serviço? Iremos te guiar pelo caminho certo
          </h3>
        </div>
        <StepBadge step={step} />
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed" style={{ ...INTER, color: SUB }}>
        Escolha a opção que mais combina com o que você precisa — isso só ajuda a mostrar os serviços certos. Você pode mudar depois.
      </p>

      <div className="mt-4 space-y-2">
        {step === 1 ? objetivos.map((o, i) => (
          <button key={o.key} className="flex w-full items-start gap-3 rounded border p-3 text-left transition hover:border-[#0A0A0A]"
            style={{ borderColor: i === 1 ? BORDO : LINE, background: i === 1 ? `${BORDO}08` : PAPER }}>
            <o.icon className="h-5 w-5 mt-0.5" style={{ color: BORDO }} />
            <div className="flex-1">
              <div className="text-[13px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{o.title}</div>
              <div className="mt-0.5 text-[11.5px]" style={{ ...INTER, color: SUB }}>{o.sub}</div>
            </div>
            <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: i === 1 ? BORDO : "#CFCFCF" }}>
              {i === 1 && <span className="h-2 w-2 rounded-full" style={{ background: BORDO }} />}
            </span>
          </button>
        )) : (
          <>
            <div className="text-[12px] font-bold uppercase tracking-wider" style={{ ...OSWALD, color: INK }}>VOCÊ JÁ POSSUI ARMA REGISTRADA?</div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {possui.map((p, i) => (
                <button key={p.key} className="flex flex-col items-center justify-center gap-1 rounded border py-4"
                  style={{ borderColor: i === 0 ? BORDO : LINE, background: i === 0 ? `${BORDO}08` : PAPER }}>
                  <p.icon className="h-5 w-5" style={{ color: i === 0 ? BORDO : SUB }} />
                  <span className="text-[11.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{p.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: SOFT }}>
        <button className="inline-flex items-center gap-1 text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>
          <ArrowLeft className="h-3 w-3" /> {step === 2 ? "VOLTAR" : "CANCELAR"}
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white"
          style={{ ...OSWALD, background: BORDO }}>
          {step === 2 ? "VER MEUS SERVIÇOS" : "CONTINUAR"} <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V2 — STEPPER LATERAL: barra de etapas vertical à esquerda
 * ========================================================================= */
function V2({ step }: { step: 1 | 2 }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[140px_1fr]">
        <aside className="border-r p-4" style={{ background: "#FAFAFA", borderColor: SOFT }}>
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: SUB }}>ASSISTENTE</div>
          <div className="mt-4 space-y-4">
            {[
              { n: 1, label: "OBJETIVO" },
              { n: 2, label: "CONTEXTO" },
            ].map(s => {
              const done = s.n < step;
              const active = s.n === step;
              return (
                <div key={s.n} className="flex items-start gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ ...OSWALD, background: done ? "#2F8F4A" : active ? AMBAR : SOFT, color: done || active ? "#fff" : SUB }}>
                    {done ? <Check className="h-3 w-3" /> : s.n}
                  </div>
                  <div className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: active ? INK : SUB }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="p-5">
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>NOVO SERVIÇO</div>
          <h3 className="mt-1 text-[20px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
            Quer adquirir um novo serviço?
          </h3>
          <p className="mt-1 text-[12.5px]" style={{ ...INTER, color: SUB }}>
            Iremos te guiar pelo caminho certo. Escolha o que mais combina.
          </p>

          {step === 1 ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {objetivos.map((o, i) => (
                <button key={o.key} className="flex flex-col items-start gap-2 rounded border p-3 text-left"
                  style={{ borderColor: i === 0 ? BORDO : LINE, background: i === 0 ? `${BORDO}08` : PAPER }}>
                  <o.icon className="h-5 w-5" style={{ color: BORDO }} />
                  <div className="text-[12px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>{o.title}</div>
                  <div className="text-[10.5px]" style={{ ...INTER, color: SUB }}>{o.sub}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <div className="text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>QUAL FINALIDADE DA ARMA?</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "TIRO ESPORTIVO", icon: Crosshair },
                  { label: "CAÇA", icon: Leaf },
                  { label: "COLECIONAMENTO", icon: Archive },
                  { label: "DEFESA PESSOAL", icon: Shield },
                ].map((f, i) => (
                  <button key={f.label} className="flex items-center gap-2 rounded border p-3"
                    style={{ borderColor: i === 0 ? BORDO : LINE, background: i === 0 ? `${BORDO}08` : PAPER }}>
                    <f.icon className="h-4 w-4" style={{ color: BORDO }} />
                    <span className="text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button className="inline-flex items-center gap-1 text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>
              <ArrowLeft className="h-3 w-3" /> VOLTAR
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white"
              style={{ ...OSWALD, background: BORDO }}>
              CONTINUAR <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V3 — KPI-STYLE: barra de progresso superior + cards numerados
 * ========================================================================= */
function V3({ step }: { step: 1 | 2 }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: SUB }}>ASSISTENTE · ETAPA {step}/2</div>
          <h3 className="mt-1 text-[19px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
            QUER ADQUIRIR UM NOVO SERVIÇO?
          </h3>
        </div>
        <div className="text-right">
          <div className="text-[36px] font-bold leading-none" style={{ ...OSWALD, color: BORDO }}>{step === 1 ? "50" : "100"}<span className="text-[16px]">%</span></div>
          <div className="text-[10px] font-bold tracking-[0.18em]" style={{ ...OSWALD, color: SUB }}>PROGRESSO</div>
        </div>
      </div>
      <div className="mt-3"><ProgressBar step={step} /></div>
      <p className="mt-3 text-[12px]" style={{ ...INTER, color: SUB }}>
        Iremos te guiar pelo caminho certo. Escolha a opção que mais combina.
      </p>

      {step === 1 ? (
        <div className="mt-4 space-y-2">
          {objetivos.map((o, i) => (
            <button key={o.key} className="flex w-full items-center gap-3 rounded border p-3 text-left"
              style={{ borderColor: i === 2 ? BORDO : LINE, background: i === 2 ? `${BORDO}08` : PAPER }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-sm text-[12px] font-bold"
                style={{ ...OSWALD, background: i === 2 ? BORDO : SOFT, color: i === 2 ? "#fff" : SUB }}>{i + 1}</div>
              <div className="flex-1">
                <div className="text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{o.title}</div>
                <div className="text-[11px]" style={{ ...INTER, color: SUB }}>{o.sub}</div>
              </div>
              <o.icon className="h-5 w-5" style={{ color: i === 2 ? BORDO : SUB }} />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {possui.map((p, i) => (
            <button key={p.key} className="rounded border p-4 text-center"
              style={{ borderColor: i === 1 ? BORDO : LINE, background: i === 1 ? `${BORDO}08` : PAPER }}>
              <p.icon className="mx-auto h-6 w-6" style={{ color: i === 1 ? BORDO : SUB }} />
              <div className="mt-2 text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{p.label}</div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 rounded p-2 text-[10.5px] font-bold uppercase tracking-wider" style={{ ...OSWALD, background: AMBAR_BG, color: "#7A5A0E" }}>
        Suas escolhas só filtram os serviços mostrados — nada é cobrado aqui.
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button className="inline-flex items-center gap-1 text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>
          <ArrowLeft className="h-3 w-3" /> VOLTAR
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white"
          style={{ ...OSWALD, background: BORDO }}>
          CONTINUAR <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V4 — DENSO ENXUTO: lista única, foco no que importa
 * ========================================================================= */
function V4({ step }: { step: 1 | 2 }) {
  return (
    <Card>
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: SOFT }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>NOVO SERVIÇO · {step}/2</div>
        <ProgressBar step={step} />
      </div>
      <div className="px-5 pt-4">
        <h3 className="text-[20px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
          Quer adquirir um novo serviço?<br/>Iremos te guiar pelo caminho certo.
        </h3>
      </div>
      <div className="px-5 pb-5 pt-3">
        {step === 1 ? (
          <ul className="divide-y rounded border" style={{ borderColor: LINE }}>
            {objetivos.map((o, i) => (
              <li key={o.key} className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                style={{ borderColor: SOFT, background: i === 0 ? `${BORDO}08` : PAPER }}>
                <o.icon className="h-4 w-4" style={{ color: BORDO }} />
                <div className="flex-1">
                  <div className="text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{o.title}</div>
                  <div className="text-[11px]" style={{ ...INTER, color: SUB }}>{o.sub}</div>
                </div>
                <ArrowRight className="h-4 w-4" style={{ color: i === 0 ? BORDO : SUB }} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y rounded border" style={{ borderColor: LINE }}>
            {possui.map((p, i) => (
              <li key={p.key} className="flex items-center gap-3 px-3 py-3" style={{ background: i === 0 ? `${BORDO}08` : PAPER }}>
                <p.icon className="h-4 w-4" style={{ color: BORDO }} />
                <div className="flex-1 text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{p.label}</div>
                <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: i === 0 ? BORDO : "#CFCFCF" }}>
                  {i === 0 && <span className="h-2 w-2 rounded-full" style={{ background: BORDO }} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-between">
          <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>VOLTAR</button>
          <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: BORDO }}>
            {step === 2 ? "VER SERVIÇOS" : "CONTINUAR →"}
          </button>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V5 — HERO ÂMBAR: cabeçalho com tira âmbar (estilo "FOCO DO DIA")
 * ========================================================================= */
function V5({ step }: { step: 1 | 2 }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-l-[4px]" style={{ borderColor: AMBAR, background: PAPER }}>
        <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: AMBAR }}>NOVO SERVIÇO · PASSO {step} DE 2</div>
        <h3 className="mt-1 text-[20px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
          Quer adquirir um novo serviço?
        </h3>
        <p className="text-[12.5px] mt-1" style={{ ...INTER, color: SUB }}>
          Iremos te guiar pelo caminho certo — em 2 escolhas rápidas filtramos só o que serve pra você.
        </p>
      </div>
      <div className="px-5 pb-5 pt-4">
        {step === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {objetivos.map((o, i) => (
              <button key={o.key} className="flex items-start gap-3 rounded border p-3 text-left"
                style={{ borderColor: i === 3 ? BORDO : LINE, background: i === 3 ? `${BORDO}08` : PAPER }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-sm" style={{ background: `${BORDO}14` }}>
                  <o.icon className="h-4 w-4" style={{ color: BORDO }} />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>{o.title}</div>
                  <div className="mt-0.5 text-[11px]" style={{ ...INTER, color: SUB }}>{o.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>VOCÊ JÁ POSSUI ARMA REGISTRADA?</div>
            <div className="grid grid-cols-3 gap-2">
              {possui.map((p, i) => (
                <button key={p.key} className="flex flex-col items-center gap-2 rounded border py-4"
                  style={{ borderColor: i === 2 ? BORDO : LINE, background: i === 2 ? `${BORDO}08` : PAPER }}>
                  <p.icon className="h-5 w-5" style={{ color: i === 2 ? BORDO : SUB }} />
                  <div className="text-[11.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{p.label}</div>
                </button>
              ))}
            </div>
            <div className="rounded p-2 text-[10.5px] italic" style={{ ...INTER, background: SOFT, color: SUB }}>
              Essa resposta só organiza seu Meu Arsenal — não restringe nada.
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: SOFT }}>
          <button className="inline-flex items-center gap-1 text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>
            <ArrowLeft className="h-3 w-3" /> VOLTAR
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white"
            style={{ ...OSWALD, background: BORDO }}>
            {step === 2 ? "VER MEUS SERVIÇOS" : "CONTINUAR"} <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V6 — TERMINAL / ARQUIVO TÉCNICO: mono-style, prompt > opções, header preto
 * ========================================================================= */
function V6({ step }: { step: 1 | 2 }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: INK }}>
        <div className="text-[10px] font-bold tracking-[0.22em] text-white" style={OSWALD}>
          ARQUIVO · ASSISTENTE.QA / STEP {step}
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "#FF5A1F" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: AMBAR }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#2F8F4A" }} />
        </div>
      </div>
      <div className="p-5">
        <div className="text-[11px]" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: SUB }}>
          &gt; qa.assistente.iniciar()
        </div>
        <h3 className="mt-1 text-[18px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
          Quer adquirir um novo serviço?
        </h3>
        <div className="text-[12px]" style={{ ...INTER, color: SUB }}>
          Iremos te guiar pelo caminho certo.
        </div>

        <div className="mt-4 space-y-1">
          {(step === 1 ? objetivos : possui).map((o, i) => {
            const Icon = (o as any).icon;
            const title = (o as any).title ?? (o as any).label;
            const sub = (o as any).sub;
            const sel = i === 0;
            return (
              <button key={(o as any).key} className="flex w-full items-center gap-3 border-l-[3px] px-3 py-2 text-left"
                style={{ borderColor: sel ? BORDO : "transparent", background: sel ? `${BORDO}0A` : "transparent" }}>
                <span className="text-[10px] w-6" style={{ fontFamily: "ui-monospace, monospace", color: SUB }}>0{i + 1}</span>
                <Icon className="h-4 w-4" style={{ color: sel ? BORDO : SUB }} />
                <div className="flex-1">
                  <div className="text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{title}</div>
                  {sub && <div className="text-[10.5px]" style={{ ...INTER, color: SUB }}>{sub}</div>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: SOFT }}>
          <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>← VOLTAR</button>
          <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: INK }}>
            EXECUTAR →
          </button>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V7 — DOSSIÊ: numeração romana, cabeçalho serifa, ar de processo oficial
 * ========================================================================= */
function V7({ step }: { step: 1 | 2 }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b" style={{ borderColor: INK, background: "#FAFAFA" }}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: INK }}>DOSSIÊ · NOVO SERVIÇO</div>
          <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>FOLHA {step} / 2</div>
        </div>
        <h3 className="mt-1 text-[19px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
          Quer adquirir um novo serviço?
        </h3>
        <div className="text-[12px]" style={{ ...INTER, color: SUB }}>Iremos te guiar pelo caminho certo.</div>
      </div>
      <div className="p-5">
        <ol className="space-y-2">
          {(step === 1 ? objetivos : possui).map((o, i) => {
            const Icon = (o as any).icon;
            const title = (o as any).title ?? (o as any).label;
            const sub = (o as any).sub;
            const sel = i === 1;
            const roman = ["I", "II", "III", "IV"][i];
            return (
              <li key={(o as any).key}>
                <button className="flex w-full items-start gap-3 rounded-sm border p-3 text-left"
                  style={{ borderColor: sel ? BORDO : LINE, background: sel ? `${BORDO}08` : PAPER }}>
                  <div className="flex h-9 w-9 items-center justify-center border" style={{ borderColor: sel ? BORDO : LINE }}>
                    <span className="text-[14px] font-bold" style={{ ...OSWALD, color: sel ? BORDO : INK }}>{roman}</span>
                  </div>
                  <Icon className="h-4 w-4 mt-2" style={{ color: BORDO }} />
                  <div className="flex-1">
                    <div className="text-[12.5px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{title}</div>
                    {sub && <div className="text-[11px]" style={{ ...INTER, color: SUB }}>{sub}</div>}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: SOFT }}>
          <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>← VOLTAR</button>
          <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: BORDO }}>
            PROSSEGUIR →
          </button>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V8 — BIG-TILE: 4 quadrantes grandes (passo 1) / 3 quadrantes (passo 2)
 * ========================================================================= */
function V8({ step }: { step: 1 | 2 }) {
  return (
    <Card className="p-5">
      <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>NOVO SERVIÇO · {step}/2</div>
      <h3 className="mt-1 text-[20px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
        Quer adquirir um novo serviço?
      </h3>
      <p className="text-[12.5px] mt-1" style={{ ...INTER, color: SUB }}>Toque numa área pra começar.</p>

      <div className={`mt-4 grid gap-2 ${step === 1 ? "grid-cols-2" : "grid-cols-3"}`}>
        {(step === 1 ? objetivos : possui).map((o, i) => {
          const Icon = (o as any).icon;
          const title = (o as any).title ?? (o as any).label;
          const sub = (o as any).sub;
          const sel = i === 0;
          return (
            <button key={(o as any).key}
              className="flex flex-col items-start gap-3 rounded border p-4 text-left transition hover:border-[#0A0A0A]"
              style={{ borderColor: sel ? BORDO : LINE, background: sel ? `${BORDO}08` : PAPER, minHeight: step === 1 ? 130 : 100 }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-sm" style={{ background: sel ? BORDO : `${BORDO}14` }}>
                <Icon className="h-5 w-5" style={{ color: sel ? "#fff" : BORDO }} />
              </div>
              <div>
                <div className="text-[12.5px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>{title}</div>
                {sub && <div className="mt-0.5 text-[10.5px]" style={{ ...INTER, color: SUB }}>{sub}</div>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-3" style={{ borderColor: SOFT }}>
        <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>VOLTAR</button>
        <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: BORDO }}>
          CONTINUAR →
        </button>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V9 — CHIP-LINE: pergunta + chips horizontais selecionáveis
 * ========================================================================= */
function V9({ step }: { step: 1 | 2 }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ ...OSWALD, background: BORDO }}>{step}</div>
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ ...OSWALD, color: SUB }}>De 2</div>
      </div>
      <h3 className="mt-2 text-[19px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
        Quer adquirir um novo serviço?<br/>Iremos te guiar pelo caminho certo.
      </h3>

      <div className="mt-4 flex flex-wrap gap-2">
        {(step === 1 ? objetivos : possui).map((o, i) => {
          const Icon = (o as any).icon;
          const title = (o as any).title ?? (o as any).label;
          const sel = i === 1;
          return (
            <button key={(o as any).key}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2"
              style={{ borderColor: sel ? BORDO : LINE, background: sel ? BORDO : PAPER, color: sel ? "#fff" : INK }}>
              <Icon className="h-3.5 w-3.5" style={{ color: sel ? "#fff" : BORDO }} />
              <span className="text-[11.5px] font-bold uppercase" style={OSWALD}>{title}</span>
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <div className="mt-3 text-[11px]" style={{ ...INTER, color: SUB }}>
          Toque numa opção pra filtrar os serviços. Você pode mudar depois.
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t pt-3" style={{ borderColor: SOFT }}>
        <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>← VOLTAR</button>
        <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: BORDO }}>
          CONTINUAR →
        </button>
      </div>
    </Card>
  );
}

/* =========================================================================
 * V10 — SPLIT MILITAR: faixa lateral preta com brasão + lista à direita
 * ========================================================================= */
function V10({ step }: { step: 1 | 2 }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[110px_1fr]">
        <aside className="flex flex-col items-center justify-between p-4 text-white" style={{ background: INK }}>
          <div className="text-[9px] font-bold tracking-[0.22em] opacity-70" style={OSWALD}>QUERO ARMAS</div>
          <div className="flex flex-col items-center">
            <Compass className="h-10 w-10" style={{ color: AMBAR }} />
            <div className="mt-2 text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: AMBAR }}>ASSISTENTE</div>
          </div>
          <div className="text-[9px] font-bold tracking-[0.22em] opacity-70" style={OSWALD}>{step}/2</div>
        </aside>
        <div className="p-5">
          <h3 className="text-[19px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
            Quer adquirir um novo serviço?
          </h3>
          <p className="text-[12px]" style={{ ...INTER, color: SUB }}>
            Iremos te guiar pelo caminho certo — escolha a opção que mais combina.
          </p>

          <ul className="mt-4 space-y-1.5">
            {(step === 1 ? objetivos : possui).map((o, i) => {
              const Icon = (o as any).icon;
              const title = (o as any).title ?? (o as any).label;
              const sub = (o as any).sub;
              const sel = i === 0;
              return (
                <li key={(o as any).key}>
                  <button className="flex w-full items-center gap-3 rounded-sm border-l-[3px] bg-white border px-3 py-2.5 text-left"
                    style={{
                      borderLeftColor: sel ? BORDO : AMBAR,
                      borderTopColor: LINE, borderRightColor: LINE, borderBottomColor: LINE,
                      background: sel ? `${BORDO}08` : PAPER,
                    }}>
                    <Icon className="h-4 w-4" style={{ color: sel ? BORDO : INK }} />
                    <div className="flex-1">
                      <div className="text-[12px] font-bold uppercase" style={{ ...OSWALD, color: INK }}>{title}</div>
                      {sub && <div className="text-[10.5px]" style={{ ...INTER, color: SUB }}>{sub}</div>}
                    </div>
                    <ArrowRight className="h-4 w-4" style={{ color: sel ? BORDO : SUB }} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: SOFT }}>
            <button className="text-[11px] font-bold uppercase" style={{ ...OSWALD, color: SUB }}>← VOLTAR</button>
            <button className="rounded-sm px-4 py-2 text-[11.5px] font-bold uppercase text-white" style={{ ...OSWALD, background: BORDO }}>
              AVANÇAR →
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
 * Page
 * ========================================================================= */
export default function MockupsEntradaWizardPreview() {
  const variants: { id: number; title: string; sub: string; Comp: (p: { step: 1 | 2 }) => JSX.Element }[] = [
    { id: 1,  title: "V1 · CLÁSSICA",        sub: "Cards verticais + radio bordô",  Comp: V1 },
    { id: 2,  title: "V2 · STEPPER LATERAL", sub: "Etapas na coluna esquerda",      Comp: V2 },
    { id: 3,  title: "V3 · KPI-STYLE",       sub: "Progresso 50/100% + numeração",  Comp: V3 },
    { id: 4,  title: "V4 · DENSO ENXUTO ✓",  sub: "Aplicado no modal real",         Comp: V4 },
    { id: 5,  title: "V5 · HERO ÂMBAR",      sub: "Tira âmbar foco do dia",         Comp: V5 },
    { id: 6,  title: "V6 · TERMINAL",        sub: "Header preto + prompt técnico",  Comp: V6 },
    { id: 7,  title: "V7 · DOSSIÊ",          sub: "Numeração romana + folha",       Comp: V7 },
    { id: 8,  title: "V8 · BIG-TILE",        sub: "Quadrantes grandes em grid",     Comp: V8 },
    { id: 9,  title: "V9 · CHIP-LINE",       sub: "Chips horizontais redondos",     Comp: V9 },
    { id: 10, title: "V10 · SPLIT MILITAR",  sub: "Faixa preta com brasão lateral", Comp: V10 },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: PAGE }}>
      <header className="mb-6">
        <div className="text-[10px] font-bold tracking-[0.22em]" style={{ ...OSWALD, color: BORDO }}>QUERO ARMAS · COCKPIT Z6 LIGHT</div>
        <h1 className="text-[28px] font-bold uppercase leading-tight" style={{ ...OSWALD, color: INK }}>
          Assistente de Novos Serviços — 10 mockups × 2 passos
        </h1>
        <p className="text-[13px] mt-1" style={{ ...INTER, color: SUB }}>
          Escolha a variação preferida. Tudo renderizado em React puro com os tokens canônicos (Oswald + Inter, paleta papel + bordô + âmbar).
        </p>
      </header>

      <div className="space-y-8">
        {variants.map(v => (
          <VarShell key={v.id} id={v.id} title={v.title} sub={v.sub}>
            <v.Comp step={1} />
            <v.Comp step={2} />
          </VarShell>
        ))}
      </div>
    </div>
  );
}