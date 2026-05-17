/**
 * Mira Prototype Page — /cadastro-mira
 * Implementação fiel das 13 telas do protótipo `mira-prototype.jsx`.
 * Página de PREVIEW — não substitui /cadastro. Backend permanece intacto.
 * Tema dark/brass "Tudo Pronto" oficial (mem://style/quero-armas/cadastro-refinado-dark-brass).
 */
import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, ArrowRight, ChevronRight, Shield, Crosshair, Briefcase, Award,
  HelpCircle, Target, FileText, AlertTriangle, CheckCircle2, Check, User, Home,
  IdCard, Camera, Upload, Sparkles, Lock, Mail, Zap, Info, Phone, Layers, Star,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────── tokens */
const QA = {
  bgDeep: "#050505", bg: "#0a0a0a", card: "#171717", cardHi: "#1c1c1c",
  cardHover: "#202020", border: "#232323", borderHi: "#2e2e2e",
  text: "#e5e5e7", textHi: "#f5f5f7", textDim: "#a0a0a3", textMute: "#6e6e72",
  olive: "#4a5e36", brass: "#D6A64B", brassHi: "#e6b95c", brassDim: "#8a6f3d",
  red: "#c52727", ok: "#5b7345",
} as const;
const F = {
  heading: '"Oswald", "Inter", sans-serif',
  sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  tactical: '"Rajdhani", "Oswald", "Inter", sans-serif',
  mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace',
} as const;
const radP = 10;

/* ──────────────────────────────────────────────────────────── primitives */
function StatusBar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px 0", fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: QA.text, flexShrink: 0 }}>
      <span>9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="6" width="2.5" height="5" rx=".5"/><rect x="3.5" y="4" width="2.5" height="7" rx=".5"/><rect x="7" y="2" width="2.5" height="9" rx=".5"/><rect x="10.5" y="0" width="2.5" height="11" rx=".5"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="18" height="10" rx="2"/><rect x="2.5" y="2.5" width="14" height="6" rx="1" fill="currentColor"/><rect x="19.5" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor"/></svg>
      </div>
    </div>
  );
}

function CPhone({ children }: { children: ReactNode }) {
  return (
    <div className="mira-phone" style={{ width: "100%", maxWidth: 420, height: "100%", maxHeight: 900, background: QA.bgDeep, color: QA.text, fontFamily: F.sans, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderRadius: 32, border: `1px solid ${QA.border}`, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8), 0 0 0 12px #18181a, 0 0 0 13px #2a2a2d" }}>
      <style>{`
        .mira-phone ::-webkit-scrollbar { width: 4px; height: 4px; }
        .mira-phone ::-webkit-scrollbar-track { background: transparent; }
        .mira-phone ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .mira-phone ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
        .mira-phone * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
      `}</style>
      <StatusBar />
      {children}
    </div>
  );
}

function CMiraDot({ size = 24 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${QA.brass} 0%, ${QA.brassDim} 70%)`, boxShadow: `0 0 12px ${QA.brass}60` }} />
      <div style={{ position: "absolute", inset: size * 0.25, borderRadius: "50%", background: QA.bgDeep }} />
      <div style={{ position: "absolute", inset: size * 0.375, borderRadius: "50%", background: QA.brass }} />
    </div>
  );
}

function CTopBar({ back = true, onBack, onClose, breadcrumb = [], progress }: { back?: boolean; onBack?: () => void; onClose?: () => void; breadcrumb?: string[]; progress?: number }) {
  return (
    <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {back && (
            <button onClick={onBack} style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${QA.border}`, background: "transparent", color: QA.textDim, cursor: "pointer", marginRight: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={13} strokeWidth={1.7} />
            </button>
          )}
          <CMiraDot />
          <div>
            <div style={{ fontSize: 10, color: QA.textMute, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }}>ANÁLISE CONCLUÍDA</div>
            <div style={{ fontFamily: F.heading, fontSize: 17, fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.1, marginTop: 2, color: QA.textHi, textTransform: "uppercase" }}>TUDO PRONTO</div>
          </div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${QA.border}`, background: "transparent", color: QA.textDim, cursor: "pointer", fontSize: 14 }}>×</button>
      </div>
      {breadcrumb.length > 0 && (
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11, color: QA.textMute }}>
          {breadcrumb.map((b, i) => {
            const last = i === breadcrumb.length - 1;
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: last ? QA.brass : QA.textMute, fontWeight: last ? 500 : 400 }}>{b}</span>
                {!last && <span style={{ color: QA.borderHi }}>›</span>}
              </span>
            );
          })}
        </div>
      )}
      {progress != null && (
        <div style={{ marginTop: 14, height: 2, background: QA.border, borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: QA.brass, transition: "width 0.4s cubic-bezier(.2,.7,.3,1)" }} />
        </div>
      )}
    </div>
  );
}

function CChip({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 8px", borderRadius: 999, background: `${QA.brass}10`, border: `1px solid ${QA.brass}30`, alignSelf: "flex-start" }}>
      <Sparkles size={11} strokeWidth={2.2} color={QA.brass} />
      <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.brass, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>{children}</div>
    </div>
  );
}

function CPrompt({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 style={{ margin: "16px 0 12px", fontFamily: F.heading, fontSize: 32, lineHeight: 1.05, fontWeight: 600, letterSpacing: "0.01em", textTransform: "uppercase", color: QA.textHi }}>{children}</h1>
      {sub && <p style={{ margin: 0, fontSize: 14, color: QA.textDim, lineHeight: 1.55 }}>{sub}</p>}
    </>
  );
}

type IconCmp = LucideIcon;

function COption({ title, desc, selected, isStep, badge, Icon, onClick }: { title: string; desc: string; selected?: boolean; isStep?: boolean; badge?: string; Icon?: IconCmp; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${selected ? QA.brass : QA.border}`, cursor: "pointer", position: "relative", color: QA.text, fontFamily: F.sans, transition: "all 0.15s ease" }}>
      {Icon && (
        <div style={{ width: 36, height: 36, borderRadius: 18, background: QA.cardHi, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: selected ? QA.brass : QA.textDim, flexShrink: 0 }}>
          <Icon size={17} strokeWidth={1.6} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.heading, fontSize: 15, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", lineHeight: 1.15, color: QA.textHi }}>{title}</div>
        <div style={{ fontSize: 12, color: QA.textMute, marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
      </div>
      {badge && (
        <span style={{ fontFamily: F.tactical, fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, background: `${QA.brass}15`, color: QA.brass, padding: "3px 8px", borderRadius: 4, alignSelf: "flex-start", flexShrink: 0, textTransform: "uppercase" }}>{badge}</span>
      )}
      {selected && !badge && (
        <div style={{ width: 22, height: 22, borderRadius: 11, background: QA.brass, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Check size={12} strokeWidth={3} color={QA.bgDeep} />
        </div>
      )}
      {isStep && !selected && <ChevronRight size={15} strokeWidth={1.6} color={QA.textMute} />}
    </button>
  );
}

function CShortcut({ Icon, title, desc, onClick }: { Icon: IconCmp; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: radP, background: "transparent", border: `1px dashed ${QA.borderHi}`, cursor: "pointer", marginBottom: 14, color: QA.text, fontFamily: F.sans }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: `${QA.brass}15`, display: "flex", alignItems: "center", justifyContent: "center", color: QA.brass, flexShrink: 0 }}>
        <Icon size={15} strokeWidth={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: QA.textHi }}>{title}</div>
        <div style={{ fontSize: 11, color: QA.textMute, marginTop: 2 }}>{desc}</div>
      </div>
      <ChevronRight size={14} strokeWidth={1.7} color={QA.textMute} />
    </button>
  );
}

function CPrimary({ children, icon, onClick, disabled }: { children: ReactNode; icon?: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "14px 22px", borderRadius: radP, border: "none", background: disabled ? QA.cardHi : QA.brass, color: disabled ? QA.textMute : QA.bgDeep, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: F.sans }}>
      {children}
      {icon}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────── flow */
type Step = "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7" | "t8" | "t9" | "t10" | "t11" | "t12" | "done";
interface FlowData {
  perfil: string | null;
  situacaoDefesa: string | null;
  renovacao: string | null;
  cacStatus: string | null;
  categoriaProf: string | null;
  curso: string | null;
  docs: { identity: boolean; address: boolean; selfie: boolean };
  contract: { read: boolean; accepted: boolean; lgpd: boolean };
  payment: { method: "pix" | "card" | "boleto"; installments: number };
  account: { email: string; password: string };
}
const initialData: FlowData = {
  perfil: null, situacaoDefesa: null, renovacao: null, cacStatus: null,
  categoriaProf: null, curso: null,
  docs: { identity: false, address: false, selfie: false },
  contract: { read: false, accepted: false, lgpd: false },
  payment: { method: "pix", installments: 1 },
  account: { email: "joao.silva@email.com", password: "" },
};

function useFlow() {
  const [step, setStep] = useState<Step>("t1");
  const [history, setHistory] = useState<Step[]>([]);
  const [data, setData] = useState<FlowData>(initialData);
  const go = (next: Step, p: Partial<FlowData> = {}) => {
    setHistory((h) => [...h, step]);
    setData((d) => ({ ...d, ...p }));
    setStep(next);
  };
  const back = () => setHistory((h) => {
    if (!h.length) return h;
    setStep(h[h.length - 1]);
    return h.slice(0, -1);
  });
  const patch = (p: Partial<FlowData>) => setData((d) => ({ ...d, ...p }));
  const reset = () => { setStep("t1"); setHistory([]); setData(initialData); };
  return { step, data, history, go, back, patch, reset };
}
type Flow = ReturnType<typeof useFlow>;

const perfilLabel = (p: string | null) =>
  ({ defesa: "Defesa pessoal", cac: "CAC", profissao: "Profissão ativa", aposentado: "Aposentado", orientacao: "Orientação", curso: "Cursos" } as Record<string, string>)[p ?? ""] ?? "—";

/* ──────────────────────────────────────────────────────────── T1 */
function T1({ flow }: { flow: Flow }) {
  const handle = (perfil: string) => {
    if (perfil === "defesa") flow.go("t2", { perfil });
    else if (perfil === "cac") flow.go("t4", { perfil });
    else if (perfil === "profissao") flow.go("t5", { perfil });
    else if (perfil === "aposentado") flow.go("t7", { perfil });
    else if (perfil === "orientacao") flow.go("t7", { perfil });
    else if (perfil === "curso") flow.go("t6", { perfil: "curso" });
  };
  const sel = flow.data.perfil;
  return (
    <CPhone>
      <CTopBar back={false} progress={11} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Pergunta 01 · 01 de 06</CChip>
        <CPrompt sub="Vou te conduzir até o serviço certo. Pode escolher o que mais se aproxima do seu caso.">
          Para que você precisa da arma de fogo?
        </CPrompt>
        <div style={{ marginTop: 24 }}>
          <CShortcut Icon={Target} title="Quero fazer um curso de tiro" desc="Atalho · qualquer perfil" onClick={() => handle("curso")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <COption Icon={Shield} title="Defesa pessoal" desc="Proteger eu e minha família em casa ou no trabalho" badge="Popular" selected={sel === "defesa"} onClick={() => handle("defesa")} />
            <COption Icon={Crosshair} title="Esporte, caça ou colecionamento" desc="Atirador, caçador ou colecionador (CAC)" selected={sel === "cac"} onClick={() => handle("cac")} />
            <COption Icon={Briefcase} title="Por causa da minha profissão" desc="Segurança pública, magistratura, FFAA ou vigilante" selected={sel === "profissao"} onClick={() => handle("profissao")} />
            <COption Icon={Award} title="Aposentado das FFAA / segurança pública" desc="Direito a porte como inativo · Art. 6º §1º" selected={sel === "aposentado"} onClick={() => handle("aposentado")} />
            <COption Icon={HelpCircle} title="Ainda não sei, preciso de orientação" desc="Quero entender qual é o melhor caminho" isStep onClick={() => handle("orientacao")} />
          </div>
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T2 */
function T2({ flow }: { flow: Flow }) {
  const handle = (sit: string) => {
    flow.patch({ situacaoDefesa: sit });
    if (sit === "renovar") flow.go("t3", { situacaoDefesa: sit });
    else flow.go("t7", { situacaoDefesa: sit });
  };
  const sel = flow.data.situacaoDefesa;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", "Defesa pessoal"]} progress={22} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Pergunta 02 · Defesa pessoal</CChip>
        <CPrompt sub="Cada situação leva a um documento diferente. Me conta a sua.">Qual é a sua situação hoje?</CPrompt>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <COption Icon={Shield} title="Quero minha primeira arma" desc="Nunca tive registro de arma" selected={sel === "primeira"} onClick={() => handle("primeira")} />
          <COption Icon={IdCard} title="Já tenho arma e quero porte" desc="Sair de casa com a arma legalmente" selected={sel === "porte"} onClick={() => handle("porte")} />
          <COption Icon={Layers} title="Preciso renovar" desc="Meu CRAF ou porte está vencendo" isStep selected={sel === "renovar"} onClick={() => handle("renovar")} />
          <COption Icon={AlertTriangle} title="Tive pedido negado pela PF" desc="A PF indeferiu meu requerimento" isStep selected={sel === "negado"} onClick={() => handle("negado")} />
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T3 */
function T3({ flow }: { flow: Flow }) {
  const handle = (ren: string) => flow.go("t7", { renovacao: ren });
  const sel = flow.data.renovacao;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", "Defesa pessoal", "Renovar"]} progress={33} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Sub-pergunta · Renovação</CChip>
        <CPrompt sub="Vou identificar exatamente qual processo de renovação você precisa.">O que você quer renovar?</CPrompt>
        <div style={{ marginTop: 22, padding: "12px 14px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Sparkles size={14} strokeWidth={2} color={QA.brass} />
          <div style={{ fontSize: 12, color: QA.textDim, lineHeight: 1.5 }}>
            <span style={{ color: QA.brass, fontWeight: 500 }}>Dica da Mira:</span> deixar vencer pode abrir processo e custar até <strong style={{ color: QA.textHi }}>4× mais</strong>. Renove com 30 dias de antecedência.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          <COption Icon={FileText} title="Renovar posse / CRAF" desc="Renovação do registro da arma (CRAF/SINARM)" selected={sel === "craf"} onClick={() => handle("craf")} />
          <COption Icon={Shield} title="Renovar porte" desc="Renovação do porte de arma de fogo" selected={sel === "porte"} onClick={() => handle("porte")} />
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T4 */
function T4({ flow }: { flow: Flow }) {
  const handle = (st: string) => flow.go("t7", { cacStatus: st });
  const sel = flow.data.cacStatus;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", "CAC"]} progress={22} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Pergunta 02 · CAC</CChip>
        <CPrompt sub="O CR é o documento base de todo CAC. Antes de mais nada, preciso saber se você já tem.">Você já tem o CR?</CPrompt>
        <div style={{ marginTop: 12, fontSize: 11, color: QA.textMute, letterSpacing: "0.02em" }}>CR · Certificado de Registro do Exército</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
          <COption Icon={Crosshair} title="Ainda não tenho CR" desc="Quero começar como atirador, caçador ou colecionador" selected={sel === "novo"} onClick={() => handle("novo")} />
          <COption Icon={CheckCircle2} title="Tenho CR ativo" desc="Preciso comprar, registrar, transportar ou atualizar" isStep selected={sel === "ativo"} onClick={() => handle("ativo")} />
          <COption Icon={AlertTriangle} title="CR vencendo / vencido" desc="Renovar antes do prazo de 3 anos" selected={sel === "vencido"} onClick={() => handle("vencido")} />
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T5 */
function T5({ flow }: { flow: Flow }) {
  const handle = (cat: string) => flow.go("t7", { categoriaProf: cat });
  const sel = flow.data.categoriaProf;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", "Profissão ativa"]} progress={22} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Pergunta 02 · Profissão ativa</CChip>
        <CPrompt sub="Cada categoria tem direitos e documentos próprios. Me conta qual é a sua.">Qual é a sua categoria?</CPrompt>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <COption Icon={Shield} title="Segurança Pública" desc="PM, PC, PF, PRF, Penal, Guarda Municipal · Art. 6º I-IV, VI" selected={sel === "seg"} onClick={() => handle("seg")} />
          <COption Icon={Briefcase} title="Magistratura e MP" desc="Juízes, Promotores, Procuradores · Art. 6º VII, VIII" selected={sel === "mag"} onClick={() => handle("mag")} />
          <COption Icon={Star} title="Forças Armadas / GSI" desc="Exército, Marinha, Aeronáutica, GSI · Art. 6º V, IX" selected={sel === "ffaa"} onClick={() => handle("ffaa")} />
          <COption Icon={User} title="Vigilante em serviço" desc="Empresa privada com registro ativo · Lei 7.102/83" selected={sel === "vig"} onClick={() => handle("vig")} />
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T6 */
function CursoCard({ badge, eyebrow, title, desc, priceLabel, price, priceColor, primary, onClick }: { badge?: string | null; eyebrow: string; title: string; desc: string; priceLabel: string; price: string; priceColor: string; primary?: boolean; onClick: () => void }) {
  return (
    <div style={{ background: QA.card, borderRadius: radP, border: `1px solid ${primary ? QA.brass + "50" : QA.border}`, padding: "18px 18px", position: "relative" }}>
      {badge && (
        <div style={{ position: "absolute", top: 14, right: 14, fontFamily: F.tactical, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.14em", background: QA.brass, color: QA.bgDeep }}>{badge}</div>
      )}
      <div style={{ fontFamily: F.tactical, fontSize: 10, letterSpacing: "0.12em", color: QA.brass, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>{eyebrow}</div>
      <div style={{ fontFamily: F.heading, fontSize: 22, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", lineHeight: 1.05, color: QA.textHi }}>{title}</div>
      <div style={{ fontSize: 12, color: QA.textMute, marginTop: 8, lineHeight: 1.5 }}>{desc}</div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${QA.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: QA.textMute, letterSpacing: "0.06em", textTransform: "uppercase" }}>{priceLabel}</div>
          <div style={{ fontFamily: F.heading, fontSize: 24, fontWeight: 600, color: priceColor, letterSpacing: "0.005em" }}>{price}</div>
        </div>
        <button onClick={onClick} style={{ padding: "10px 16px", borderRadius: 8, border: primary ? "none" : `1px solid ${QA.border}`, background: primary ? QA.brass : "transparent", color: primary ? QA.bgDeep : QA.textHi, fontSize: 13, fontWeight: primary ? 600 : 500, cursor: "pointer" }}>Selecionar →</button>
      </div>
    </div>
  );
}

function T6({ flow }: { flow: Flow }) {
  const handle = (c: string) => flow.go("t7", { curso: c });
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", "Cursos de tiro"]} progress={22} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Atalho · Cursos</CChip>
        <CPrompt sub="Disponíveis para qualquer perfil — civis, CAC ou profissionais.">Escolha seu curso de tiro</CPrompt>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <CursoCard badge={null} eyebrow="Nível I · Iniciante-Intermediário" title="Operador de Pistola" desc="Curso prático de tiro com pistola — turmas regulares." priceLabel="A partir de" price="R$ 890" priceColor={QA.textHi} onClick={() => handle("operador")} />
          <CursoCard badge="VIP" eyebrow="Exclusivo · Individual" title="VIP Operador" desc="Versão exclusiva, individual, com instrução personalizada." priceLabel="Sob consulta" price="R$ 2.400+" priceColor={QA.brass} primary onClick={() => handle("vip")} />
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T7 Upload */
function T7({ flow }: { flow: Flow }) {
  const docs = flow.data.docs;
  const allDone = docs.identity && docs.address && docs.selfie;
  const toggle = (k: keyof FlowData["docs"]) => flow.patch({ docs: { ...docs, [k]: !docs[k] } });
  const missing = 3 - Object.values(docs).filter(Boolean).length;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Documentos"]} progress={66} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 16px" }}>
        <CChip>Etapa · Documentos</CChip>
        <CPrompt sub="Eu leio e preencho seu cadastro automaticamente. Você só revisa no final.">Pode me mostrar seus documentos?</CPrompt>
        <div style={{ marginTop: 22, borderRadius: radP, background: QA.card, border: `1.5px dashed ${QA.borderHi}`, padding: "22px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, margin: "0 auto", background: `${QA.brass}15`, border: `1px solid ${QA.brass}40`, display: "flex", alignItems: "center", justifyContent: "center", color: QA.brass }}>
            <Upload size={20} strokeWidth={1.7} />
          </div>
          <div style={{ marginTop: 12, fontFamily: F.heading, fontSize: 16, fontWeight: 600, color: QA.textHi, letterSpacing: "0.02em", textTransform: "uppercase", lineHeight: 1.2 }}>Arraste, fotografe<br/>ou selecione</div>
          <div style={{ marginTop: 6, fontSize: 11, color: QA.textMute }}>Foto · PDF · até 20MB</div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.14em", marginBottom: 10, textTransform: "uppercase" }}>Clique nos itens para simular o envio</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {([
              { key: "identity" as const, Icon: IdCard, label: "Documento com CPF", sub: "RG, CNH ou CIN" },
              { key: "address" as const, Icon: Home, label: "Comprovante de endereço", sub: "Luz, água ou internet" },
              { key: "selfie" as const, Icon: Camera, label: "Selfie com o documento", sub: "Foto sua com o doc" },
            ]).map((c) => {
              const done = docs[c.key];
              return (
                <button key={c.key} onClick={() => toggle(c.key)} style={{ width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 8, marginLeft: -10, background: "transparent", border: "none", color: QA.text, fontFamily: F.sans }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: done ? QA.brass : "transparent", border: done ? "none" : `1.5px solid ${QA.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {done && <Check size={12} strokeWidth={3} color={QA.bgDeep} />}
                  </div>
                  <c.Icon size={14} strokeWidth={1.6} color={QA.textMute} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: done ? QA.textHi : QA.textDim, lineHeight: 1.2 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: QA.textMute, marginTop: 2 }}>{c.sub}</div>
                  </div>
                  {done && <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.brass, letterSpacing: "0.1em", textTransform: "uppercase" }}>Recebido</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${QA.border}` }}>
        <CPrimary disabled={!allDone} icon={<Sparkles size={15} strokeWidth={2.2} />} onClick={() => allDone && flow.go("t8")}>
          {allDone ? "Está tudo certo" : `Faltam ${missing} documento(s)`}
        </CPrimary>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T8 Mira lendo */
const T8_SECTIONS = [
  { id: "rg", title: "RG / Identidade", Icon: IdCard, range: [0, 30] as [number, number], fields: [
    { l: "Nome completo", v: "João Carlos da Silva", at: 5 },
    { l: "CPF", v: "123.456.789-00", at: 9, mono: true },
    { l: "RG", v: "12.345.678-9 SSP/SP", at: 13, mono: true },
    { l: "Data nasc.", v: "14/05/1985", at: 16, mono: true },
    { l: "Naturalidade", v: "São Paulo / SP", at: 19 },
    { l: "Filiação (mãe)", v: "Maria Aparecida Silva", at: 23 },
    { l: "Filiação (pai)", v: "Antônio Pedro Silva", at: 26 },
    { l: "Sexo", v: "Masculino", at: 29 },
  ]},
  { id: "addr", title: "Comprovante de endereço", Icon: Home, range: [30, 60] as [number, number], fields: [
    { l: "Titular", v: "Maria Aparecida Silva", at: 35 },
    { l: "Tipo", v: "Energia elétrica", at: 40 },
    { l: "Endereço", v: "Av. Paulista, 1578 — Apto 92", at: 46 },
    { l: "CEP", v: "01310-100", at: 51, mono: true },
    { l: "Cidade / UF", v: "São Paulo / SP", at: 55 },
    { l: "Emissão", v: "10/04/2026", at: 59, mono: true },
  ]},
  { id: "bio", title: "Selfie · Biometria", Icon: Camera, range: [60, 80] as [number, number], fields: [
    { l: "Match com RG", v: "98%", at: 67, mono: true },
    { l: "Liveness", v: "OK", at: 73 },
    { l: "Qualidade", v: "Boa", at: 79 },
  ]},
  { id: "cross", title: "Cruzando informações", Icon: Sparkles, range: [80, 100] as [number, number], fields: [
    { l: "CPF na Receita", v: "Regular", at: 86 },
    { l: "Identidade", v: "Confirmada", at: 91 },
    { l: "Comprovante", v: "Terceiro detectado", at: 97, warn: true },
  ]},
];

function T8({ flow }: { flow: Flow }) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const duration = 7000;
    const tick = (t: number) => {
      const p = Math.min(100, ((t - start) / duration) * 100);
      setProgress(p);
      if (p < 100) rafRef.current = requestAnimationFrame(tick);
      else setTimeout(() => flow.go("t9"), 700);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const phase = progress < 30 ? "Lendo seu RG" : progress < 60 ? "Lendo o comprovante" : progress < 80 ? "Verificando biometria" : "Cruzando informações";
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Análise"]} progress={77} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px", display: "flex", flexDirection: "column" }}>
        <CChip>{`Lendo · ${Math.round(progress)}%`}</CChip>
        <CPrompt sub="Estou extraindo cada campo dos seus documentos e cruzando para detectar divergências.">{phase}</CPrompt>
        <style>{`@keyframes cpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}@keyframes cdot{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          {T8_SECTIONS.map((sec) => {
            const sectionActive = progress >= sec.range[0];
            const sectionDone = progress >= sec.range[1];
            return (
              <div key={sec.id} style={{ borderRadius: radP, background: sectionActive ? QA.card : "transparent", border: `1px solid ${QA.border}`, opacity: sectionActive ? 1 : 0.4, transition: "opacity 0.3s, background 0.3s", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: sectionActive ? `1px solid ${QA.border}` : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: sectionDone ? QA.ok : sectionActive ? `${QA.brass}20` : "transparent", border: sectionActive ? "none" : `1px solid ${QA.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.3s" }}>
                    {sectionDone ? <Check size={12} strokeWidth={3} color={QA.textHi} /> : sectionActive ? <div style={{ width: 6, height: 6, borderRadius: 3, background: QA.brass, animation: "cdot 1s ease-in-out infinite" }} /> : <sec.Icon size={11} strokeWidth={1.7} color={QA.textMute} />}
                  </div>
                  <div style={{ fontFamily: F.tactical, fontSize: 11, color: sectionActive ? QA.textHi : QA.textMute, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, flex: 1 }}>{sec.title}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: QA.textMute, letterSpacing: "0.04em" }}>{sectionDone ? `${sec.fields.length} campos` : sectionActive ? "lendo..." : `${sec.fields.length} campos`}</div>
                </div>
                {sectionActive && (
                  <div style={{ padding: "4px 14px 8px" }}>
                    {sec.fields.map((f, i) => {
                      const state = progress >= f.at ? "check" : progress >= f.at - 2.5 ? "pulse" : "wait";
                      const color = state === "check" ? (f.warn ? QA.brass : QA.textHi) : state === "pulse" ? QA.brass : QA.textMute;
                      return (
                        <div key={i} style={{ padding: "6px 0", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, background: state === "check" ? (f.warn ? QA.brass : QA.ok) : state === "pulse" ? QA.brass : QA.border, animation: state === "pulse" ? "cpulse 1.4s ease-in-out infinite" : "none" }} />
                          <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.08em", textTransform: "uppercase", flex: "0 0 110px" }}>{f.l}</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color, fontFamily: f.mono && state === "check" ? F.mono : F.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, transition: "color 0.3s" }}>{state === "wait" ? "—" : state === "pulse" ? "lendo..." : `${f.v}${f.warn ? " ⚠" : ""}`}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 22 }}>
          <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.14em", marginBottom: 6, display: "flex", justifyContent: "space-between", textTransform: "uppercase" }}>
            <span>Progresso</span><span style={{ color: QA.brass }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 2, background: QA.border, borderRadius: 1 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: QA.brass, borderRadius: 1, transition: "width 0.1s linear" }} />
          </div>
        </div>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T9 Revisão */
const T9_SECTIONS = [
  { title: "RG / Identidade", Icon: IdCard, fields: [
    { label: "Nome completo", val: "João Carlos da Silva", conf: 99 },
    { label: "CPF", val: "123.456.789-00", conf: 99, mono: true },
    { label: "RG", val: "12.345.678-9 SSP/SP", conf: 96, mono: true },
    { label: "Data nascimento", val: "14/05/1985", conf: 98, mono: true },
    { label: "Naturalidade", val: "São Paulo / SP", conf: 95 },
    { label: "Filiação (mãe)", val: "Maria Aparecida Silva", conf: 94 },
    { label: "Filiação (pai)", val: "Antônio Pedro Silva", conf: 93 },
    { label: "Sexo", val: "Masculino", conf: 99 },
  ]},
  { title: "Comprovante de endereço", Icon: Home, fields: [
    { label: "Titular", val: "Maria Aparecida Silva", conf: 97, warn: "terceiro" },
    { label: "Tipo", val: "Energia elétrica · Enel", conf: 96 },
    { label: "Endereço", val: "Av. Paulista, 1578 — Apto 92", conf: 94 },
    { label: "CEP", val: "01310-100", conf: 99, mono: true },
    { label: "Cidade / UF", val: "São Paulo / SP", conf: 99 },
    { label: "Emissão", val: "10/04/2026", conf: 99, mono: true },
  ]},
  { title: "Selfie · Biometria", Icon: Camera, fields: [
    { label: "Match com RG", val: "98%", conf: 98, mono: true },
    { label: "Liveness", val: "OK · pessoa real", conf: 99 },
    { label: "Qualidade da foto", val: "Boa", conf: 95 },
  ]},
];

function T9({ flow }: { flow: Flow }) {
  const totalFields = T9_SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Revisão"]} progress={88} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 100px" }}>
        <CChip>{`Verificação concluída · ${totalFields} campos`}</CChip>
        <CPrompt sub="Cruzei os dados dos 3 documentos. Encontrei 1 ponto que você precisa saber antes de avançar.">Está quase tudo certo</CPrompt>
        <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.brass}50` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={15} strokeWidth={2} color={QA.brass} />
            <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.brass, letterSpacing: "0.14em", fontWeight: 700, textTransform: "uppercase" }}>Atenção · Anuência necessária</div>
          </div>
          <div style={{ fontFamily: F.heading, fontSize: 16, fontWeight: 600, color: QA.textHi, letterSpacing: "0.01em", lineHeight: 1.2, textTransform: "uppercase" }}>Comprovante em nome de terceiro</div>
          <div style={{ marginTop: 8, fontSize: 12, color: QA.textDim, lineHeight: 1.55 }}>O comprovante está em nome de <strong style={{ color: QA.textHi }}>Maria Aparecida Silva</strong> — identificada como sua mãe no RG.</div>
          <div style={{ marginTop: 6, fontSize: 12, color: QA.textDim, lineHeight: 1.55 }}>Durante o processo, ela vai precisar assinar uma <strong style={{ color: QA.brass }}>declaração de anuência</strong>. Vou te mandar o modelo no próximo passo.</div>
          <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: QA.bgDeep, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={13} strokeWidth={1.7} color={QA.textMute} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: QA.textDim }}>declaracao-anuencia.docx</div>
              <div style={{ fontSize: 10, color: QA.textMute }}>Será gerado automaticamente</div>
            </div>
            <span style={{ fontFamily: F.tactical, fontSize: 9, color: QA.brass, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pendente</span>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke={QA.border} strokeWidth="2.5" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={QA.ok} strokeWidth="2.5" strokeDasharray={`${2 * Math.PI * 18 * 0.96} ${2 * Math.PI * 18}`} strokeDashoffset={2 * Math.PI * 18 * 0.25} strokeLinecap="round" transform="rotate(-90 22 22)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.heading, fontSize: 11, fontWeight: 700, color: QA.ok }}>96%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.heading, fontSize: 13, fontWeight: 600, color: QA.textHi, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sem divergências</div>
            <div style={{ fontSize: 11, color: QA.textMute, marginTop: 2 }}>CPF regular na Receita · Identidade confirmada · Biometria OK</div>
          </div>
        </div>
        {T9_SECTIONS.map((sec, si) => (
          <div key={si} style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
              <sec.Icon size={12} strokeWidth={1.8} />
              {sec.title}
              <div style={{ flex: 1, height: 1, background: QA.border, marginLeft: 4 }} />
            </div>
            <div style={{ borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
              {sec.fields.map((f, i) => (
                <div key={i} style={{ padding: "11px 14px", borderBottom: i < sec.fields.length - 1 ? `1px solid ${QA.border}` : "none", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: (f as { warn?: string }).warn ? QA.brass : QA.textHi, fontFamily: f.mono ? F.mono : F.sans, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                      {f.val}
                      {(f as { warn?: string }).warn === "terceiro" && <AlertTriangle size={12} strokeWidth={2.2} color={QA.brass} />}
                    </div>
                  </div>
                  <div style={{ width: 30, fontFamily: F.mono, fontSize: 10, color: f.conf >= 95 ? QA.ok : QA.brass, textAlign: "right" }}>{f.conf}%</div>
                  <ChevronRight size={13} strokeWidth={1.7} color={QA.textMute} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: 20, background: QA.bgDeep, borderTop: `1px solid ${QA.border}` }}>
        <CPrimary onClick={() => flow.go("t10")} icon={<ArrowRight size={15} strokeWidth={2.2} />}>Entendi, avançar para o contrato</CPrimary>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T10 Contrato */
function T10({ flow }: { flow: Flow }) {
  const contract = flow.data.contract;
  const setContract = (p: Partial<typeof contract>) => flow.patch({ contract: { ...contract, ...p } });
  const ready = contract.accepted && contract.lgpd;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Contrato"]} progress={92} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Contrato · revise antes de assinar</CChip>
        <CPrompt sub="Gerei o contrato com base nos seus dados e no serviço escolhido. Confira tudo antes de prosseguir.">Seu contrato está pronto</CPrompt>
        <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
          <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.brass, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>Serviço contratado</div>
          <div style={{ fontFamily: F.heading, fontSize: 17, fontWeight: 600, color: QA.textHi, lineHeight: 1.2, letterSpacing: "0.01em", textTransform: "uppercase" }}>Posse de Arma de Fogo</div>
          <div style={{ fontSize: 12, color: QA.textDim, marginTop: 6, lineHeight: 1.5 }}>Defesa pessoal · Primeira aquisição · Acompanhamento jurídico completo até a emissão do CRAF.</div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${QA.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.12em", textTransform: "uppercase" }}>Prazo estimado</div>
              <div style={{ fontSize: 13, color: QA.textHi, marginTop: 2, fontWeight: 500 }}>30–60 dias úteis</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.12em", textTransform: "uppercase" }}>Honorários</div>
              <div style={{ fontFamily: F.heading, fontSize: 22, fontWeight: 600, color: QA.textHi, letterSpacing: "0.005em" }}>R$ 1.890</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <FileText size={12} strokeWidth={1.7} />
            Contrato-QA-2026-04891-JS.pdf
            <div style={{ flex: 1 }} />
            <button style={{ background: "transparent", border: "none", color: QA.brass, fontSize: 10, cursor: "pointer", fontFamily: F.tactical, letterSpacing: "0.1em" }}>VER COMPLETO</button>
          </div>
          <div style={{ fontSize: 12, color: QA.textDim, lineHeight: 1.6, maxHeight: 130, overflow: "auto", paddingRight: 4 }}>
            <p style={{ margin: "0 0 8px" }}><strong style={{ color: QA.textHi }}>CONTRATANTE:</strong> João Carlos da Silva, CPF 123.456.789-00, residente em Av. Paulista, 1578 — Apto 92.</p>
            <p style={{ margin: "0 0 8px" }}><strong style={{ color: QA.textHi }}>CONTRATADA:</strong> Quero Armas Serviços Ltda., CNPJ XX.XXX.XXX/0001-XX.</p>
            <p style={{ margin: "0 0 8px" }}><strong style={{ color: QA.textHi }}>OBJETO:</strong> Prestação de serviços jurídicos para concessão de posse de arma de fogo nos termos do Decreto 11.615/2023…</p>
            <p style={{ margin: 0 }}><strong style={{ color: QA.textHi }}>ANUÊNCIA DE TERCEIRO:</strong> Considerando que o comprovante de endereço está em nome de Maria Aparecida Silva, a referida titular deverá firmar declaração de anuência…</p>
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {([
            { key: "accepted" as const, label: "Li e aceito os termos do contrato" },
            { key: "lgpd" as const, label: "Autorizo o tratamento dos meus dados (LGPD) para fins de cadastro, validação e atendimento" },
          ]).map((c) => {
            const checked = contract[c.key];
            return (
              <button key={c.key} onClick={() => setContract({ [c.key]: !checked })} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: radP, background: QA.card, border: `1px solid ${checked ? QA.brass : QA.border}`, color: QA.text, cursor: "pointer", textAlign: "left", fontFamily: F.sans, width: "100%" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, marginTop: 1, flexShrink: 0, background: checked ? QA.brass : "transparent", border: checked ? "none" : `1.5px solid ${QA.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {checked && <Check size={11} strokeWidth={3} color={QA.bgDeep} />}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: QA.textHi, lineHeight: 1.45 }}>{c.label}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${QA.border}` }}>
        <CPrimary disabled={!ready} onClick={() => ready && flow.go("t11")} icon={<ArrowRight size={15} strokeWidth={2.2} />}>
          {ready ? "Aceitar e assinar" : "Aceite os termos para continuar"}
        </CPrimary>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T11 Pagamento */
const PAY_OPTIONS = [
  { id: "pix" as const, label: "PIX", sub: "À vista · 5% de desconto", Icon: Zap, discount: 0.05 },
  { id: "card" as const, label: "Cartão de crédito", sub: "Até 12× sem juros", Icon: IdCard, discount: 0 },
  { id: "boleto" as const, label: "Boleto bancário", sub: "À vista · vencimento em 3 dias", Icon: FileText, discount: 0 },
];
const ORDER_BASE = 1890;

function T11({ flow }: { flow: Flow }) {
  const payment = flow.data.payment;
  const setPayment = (p: Partial<typeof payment>) => flow.patch({ payment: { ...payment, ...p } });
  const selOpt = PAY_OPTIONS.find((o) => o.id === payment.method) || PAY_OPTIONS[0];
  const total = ORDER_BASE * (1 - selOpt.discount);
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Pagamento"]} progress={95} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Pagamento · escolha a forma</CChip>
        <CPrompt sub="No PIX você tem 5% de desconto. No cartão, parcele em até 12× sem juros.">Como você quer pagar?</CPrompt>
        <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${QA.border}` }}>
            <div>
              <div style={{ fontSize: 12, color: QA.textDim }}>Posse de Arma de Fogo</div>
              <div style={{ fontSize: 11, color: QA.textMute, marginTop: 2 }}>Defesa pessoal · Primeira aquisição</div>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 13, color: QA.textHi }}>R$ {ORDER_BASE.toFixed(2).replace(".", ",")}</div>
          </div>
          {selOpt.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, fontSize: 12, color: QA.ok }}>
              <span>Desconto PIX ({Math.round(selOpt.discount * 100)}%)</span>
              <span style={{ fontFamily: F.mono }}>−R$ {(ORDER_BASE * selOpt.discount).toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 10 }}>
            <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase" }}>Total</div>
            <div style={{ fontFamily: F.heading, fontSize: 26, fontWeight: 600, color: QA.textHi, letterSpacing: "0.005em" }}>R$ {total.toFixed(2).replace(".", ",")}</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {PAY_OPTIONS.map((o) => {
            const isSel = payment.method === o.id;
            return (
              <button key={o.id} onClick={() => setPayment({ method: o.id })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${isSel ? QA.brass : QA.border}`, color: QA.text, cursor: "pointer", textAlign: "left", fontFamily: F.sans, width: "100%" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: QA.cardHi, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: isSel ? QA.brass : QA.textDim, flexShrink: 0 }}>
                  <o.Icon size={17} strokeWidth={1.6} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.heading, fontSize: 14, fontWeight: 600, color: QA.textHi, textTransform: "uppercase", letterSpacing: "0.03em" }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: QA.textMute, marginTop: 2 }}>{o.sub}</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: 9, border: `1.5px solid ${isSel ? QA.brass : QA.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSel && <div style={{ width: 9, height: 9, borderRadius: 5, background: QA.brass }} />}
                </div>
              </button>
            );
          })}
        </div>
        {payment.method === "pix" && (
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 6, flexShrink: 0, background: "#fff", backgroundImage: `repeating-linear-gradient(0deg, ${QA.bgDeep} 0 3px, transparent 3px 6px), repeating-linear-gradient(90deg, ${QA.bgDeep} 0 3px, transparent 3px 6px)`, backgroundSize: "6px 6px" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: QA.textMute, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: F.tactical }}>QR Code PIX</div>
              <div style={{ fontSize: 12, color: QA.textHi, marginTop: 4 }}>Vou gerar o QR após confirmar. Pagamento expira em 30 min.</div>
            </div>
          </div>
        )}
        {payment.method === "card" && (
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
            <div style={{ fontSize: 11, color: QA.textMute, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: F.tactical, marginBottom: 10 }}>Parcelamento</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[1, 3, 6, 12].map((n) => {
                const isSel = payment.installments === n;
                return (
                  <button key={n} onClick={() => setPayment({ installments: n })} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${isSel ? QA.brass : QA.border}`, background: isSel ? `${QA.brass}15` : "transparent", color: isSel ? QA.brass : QA.textDim, fontFamily: F.mono, fontSize: 11, cursor: "pointer" }}>{n}× R$ {(total / n).toFixed(2).replace(".", ",")}</button>
                );
              })}
            </div>
          </div>
        )}
        {payment.method === "boleto" && (
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle size={14} strokeWidth={2} color={QA.brass} />
            <div style={{ fontSize: 12, color: QA.textDim, lineHeight: 1.5 }}>Boleto vence em 3 dias. Compensação leva 1–2 dias úteis após o pagamento.</div>
          </div>
        )}
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${QA.border}` }}>
        <CPrimary onClick={() => flow.go("t12")} icon={<Lock size={14} strokeWidth={2} />}>Confirmar pagamento</CPrimary>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── T12 Conta */
function T12({ flow }: { flow: Flow }) {
  const account = flow.data.account;
  const setAccount = (p: Partial<typeof account>) => flow.patch({ account: { ...account, ...p } });
  const ready = account.email && account.password && account.password.length >= 6;
  return (
    <CPhone>
      <CTopBar onBack={flow.back} breadcrumb={["Cadastro", perfilLabel(flow.data.perfil), "Conta"]} progress={98} />
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px 24px" }}>
        <CChip>Arsenal Inteligente · sua área pessoal</CChip>
        <CPrompt sub="Acompanhe seu processo, baixe documentos e receba alertas. Grátis pra sempre.">Crie sua conta no app</CPrompt>
        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
            {([
              { Icon: FileText, label: "Modelos jurídicos" },
              { Icon: AlertTriangle, label: "Alertas de vencimento" },
              { Icon: Home, label: "Histórico SINARM" },
              { Icon: Phone, label: "Atendimento direto" },
            ]).map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <f.Icon size={14} strokeWidth={1.6} color={QA.brass} />
                <span style={{ fontSize: 12, color: QA.textDim }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 14px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mail size={15} strokeWidth={1.6} color={QA.textMute} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>E-mail</div>
                <div style={{ fontSize: 13, color: QA.textHi }}>{account.email}</div>
              </div>
              <Check size={13} strokeWidth={2.5} color={QA.ok} />
            </div>
          </div>
          <div style={{ padding: "12px 14px", borderRadius: radP, background: QA.card, border: `1px solid ${account.password.length >= 6 ? QA.brass : QA.border}` }}>
            <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Senha</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Lock size={15} strokeWidth={1.6} color={QA.textMute} />
              <input type="password" value={account.password} onChange={(e) => setAccount({ password: e.target.value })} placeholder="Mín. 6 caracteres" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: F.mono, fontSize: 14, color: QA.textHi, letterSpacing: "0.1em" }} />
            </div>
            {account.password && (
              <div style={{ marginTop: 8, display: "flex", gap: 3 }}>
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} style={{ flex: 1, height: 2, borderRadius: 1, background: j < Math.min(4, Math.floor(account.password.length / 2)) ? QA.ok : QA.border }} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: radP, background: "transparent", border: `1px dashed ${QA.border}`, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Info size={13} strokeWidth={1.7} color={QA.textMute} />
          <div style={{ fontSize: 11, color: QA.textMute, lineHeight: 1.5 }}>Sua conta é gratuita pra sempre. Pode encerrar quando quiser, conforme LGPD.</div>
        </div>
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${QA.border}` }}>
        <CPrimary disabled={!ready} onClick={() => ready && flow.go("done")} icon={<Shield size={14} strokeWidth={2} />}>
          {ready ? "Criar minha conta" : "Digite uma senha de 6+ caracteres"}
        </CPrimary>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── Done */
function TDone({ flow }: { flow: Flow }) {
  return (
    <CPhone>
      <CTopBar back={false} progress={100} />
      <div style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ width: 112, height: 112, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${QA.cardHi} 0%, ${QA.bgDeep} 70%)`, marginBottom: 28, position: "relative" }}>
          <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: `1px solid ${QA.border}` }} />
          <div style={{ position: "absolute", inset: -22, borderRadius: "50%", border: `1px dashed ${QA.border}` }} />
          <CMiraDot size={72} />
          <div style={{ position: "absolute", bottom: -2, right: -2, width: 32, height: 32, borderRadius: 16, background: QA.ok, border: `3px solid ${QA.bgDeep}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={16} strokeWidth={3} color={QA.textHi} />
          </div>
        </div>
        <CChip>Tudo pronto · contratação concluída</CChip>
        <h1 style={{ margin: "16px 0 10px", fontFamily: F.heading, fontSize: 32, lineHeight: 1.05, fontWeight: 600, letterSpacing: "0.01em", textTransform: "uppercase", color: QA.textHi }}>Pronto, João!</h1>
        <p style={{ margin: 0, fontSize: 14, color: QA.textDim, lineHeight: 1.55, maxWidth: 300 }}>Pagamento confirmado, contrato assinado, conta criada. Nossa equipe já recebeu seu processo.</p>
        <div style={{ marginTop: 28, width: "100%", maxWidth: 320, padding: "12px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${QA.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: F.tactical, fontSize: 9, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase" }}>Protocolo</div>
            <div style={{ marginTop: 2, fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: QA.textHi }}>QA-2026-04891-JS</div>
          </div>
          <span style={{ fontFamily: F.tactical, fontSize: 9, color: QA.ok, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 8px", borderRadius: 4, background: `${QA.ok}20` }}>Em análise</span>
        </div>
        <div style={{ marginTop: 14, width: "100%", maxWidth: 320, fontSize: 11, color: QA.textMute, textAlign: "left", display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            "Mando o modelo de anuência pra Maria Aparecida no app",
            "Acompanhe o processo no Arsenal Inteligente",
            "Aviso por push assim que tiver novidade",
          ].map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Check size={11} strokeWidth={2.5} color={QA.brass} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <CPrimary onClick={flow.reset} icon={<ArrowRight size={15} strokeWidth={2.2} />}>Abrir Arsenal Inteligente</CPrimary>
        <button onClick={flow.reset} style={{ width: "100%", padding: "11px 20px", borderRadius: radP, background: "transparent", border: "none", color: QA.textMute, cursor: "pointer", fontSize: 12, fontWeight: 500, fontFamily: F.sans }}>
          Reiniciar protótipo
        </button>
      </div>
    </CPhone>
  );
}

/* ──────────────────────────────────────────────────────────── Page */
const STEPS: Record<Step, ComponentType<{ flow: Flow }>> = {
  t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6,
  t7: T7, t8: T8, t9: T9, t10: T10, t11: T11, t12: T12, done: TDone,
};

export default function MiraPrototypePage() {
  const flow = useFlow();
  const Step = STEPS[flow.step];
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a1c", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: F.sans }}>
      <div style={{ position: "fixed", top: 24, left: 24, zIndex: 10, fontFamily: F.tactical, fontSize: 11, color: QA.textMute, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        Quero Armas · Protótipo · {flow.step.toUpperCase()}
      </div>
      <div style={{ height: 900, width: "100%", maxWidth: 420 }}>
        <Step flow={flow} />
      </div>
      <button onClick={flow.reset} style={{ position: "fixed", top: 22, right: 22, zIndex: 10, padding: "8px 14px", borderRadius: 999, background: QA.card, border: `1px solid ${QA.border}`, color: QA.textDim, cursor: "pointer", fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6, fontFamily: F.sans }}>
        <ArrowLeft size={11} strokeWidth={1.7} /> Reiniciar
      </button>
    </div>
  );
}
