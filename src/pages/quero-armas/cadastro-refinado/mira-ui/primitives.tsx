/**
 * Primitivas visuais Mira reutilizáveis.
 * Origem: protótipo /cadastro-mira (MiraPrototypePage). Extraídas para uso
 * compartilhado entre o sandbox visual e as etapas reais do /cadastro.
 *
 * IMPORTANTE: estas primitivas são puramente visuais. NÃO contêm nenhum
 * dado de demonstração (João Carlos, CPF fake, R$ 1.890 etc) — quem renderiza
 * com dados reais é o consumidor.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Check, ChevronRight, Sparkles } from "lucide-react";
import { QA, F, radP } from "./theme";

/* MiraDot — marca brass radial usada no header (CTopBar). */
export function MiraDot({ size = 24 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${QA.brass} 0%, ${QA.brassDim} 70%)`, boxShadow: `0 0 12px ${QA.brass}60` }} />
      <div style={{ position: "absolute", inset: size * 0.25, borderRadius: "50%", background: QA.bgDeep }} />
      <div style={{ position: "absolute", inset: size * 0.375, borderRadius: "50%", background: QA.brass }} />
    </div>
  );
}

/* CPhone — container vertical full-screen (sem moldura de aparelho). */
export function CPhone({ children }: { children: ReactNode }) {
  return (
    <div className="mira-phone" style={{ width: "100%", maxWidth: 480, margin: "0 auto", minHeight: "100dvh", background: QA.bgDeep, color: QA.text, fontFamily: F.sans, display: "flex", flexDirection: "column", position: "relative", border: "none", borderRadius: 0, boxShadow: "none", overflow: "auto" }}>
      <style>{`
        .mira-phone ::-webkit-scrollbar { width: 4px; height: 4px; }
        .mira-phone ::-webkit-scrollbar-track { background: transparent; }
        .mira-phone ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .mira-phone ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
        .mira-phone * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
      `}</style>
      {children}
    </div>
  );
}

/* CTopBar — cabeçalho "ANÁLISE CONCLUÍDA / TUDO PRONTO" + breadcrumb + progress 2px brass. */
export function CTopBar({
  back = true,
  onBack,
  onClose,
  breadcrumb = [],
  progress,
  contextTag = "TUDO PRONTO",
  eyebrow = "ANÁLISE CONCLUÍDA",
}: {
  back?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  breadcrumb?: string[];
  progress?: number;
  contextTag?: string;
  eyebrow?: string;
}) {
  return (
    <div style={{ padding: "16px 22px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {back && (
            <button type="button" onClick={onBack} aria-label="Voltar" style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${QA.border}`, background: "transparent", color: QA.textDim, cursor: "pointer", marginRight: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={13} strokeWidth={1.7} />
            </button>
          )}
          <MiraDot />
          <div>
            <div style={{ fontSize: 10, color: QA.textMute, letterSpacing: "0.08em", lineHeight: 1, textTransform: "uppercase" }}>{eyebrow}</div>
            <div style={{ fontFamily: F.heading, fontSize: 17, fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.1, marginTop: 2, color: QA.textHi, textTransform: "uppercase" }}>{contextTag}</div>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 15, border: `1px solid ${QA.border}`, background: "transparent", color: QA.textDim, cursor: "pointer", fontSize: 14 }}>×</button>
        )}
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

/* CChip — pill brass com sparkles. */
export function CChip({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 8px", borderRadius: 999, background: `${QA.brass}10`, border: `1px solid ${QA.brass}30`, alignSelf: "flex-start" }}>
      <Sparkles size={11} strokeWidth={2.2} color={QA.brass} />
      <div style={{ fontFamily: F.tactical, fontSize: 10, color: QA.brass, letterSpacing: "0.1em", fontWeight: 600, textTransform: "uppercase" }}>{children}</div>
    </div>
  );
}

/* CPrompt — título Oswald + subtítulo. */
export function CPrompt({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 style={{ margin: "16px 0 12px", fontFamily: F.heading, fontSize: 32, lineHeight: 1.05, fontWeight: 600, letterSpacing: "0.01em", textTransform: "uppercase", color: QA.textHi }}>{children}</h1>
      {sub && <p style={{ margin: 0, fontSize: 14, color: QA.textDim, lineHeight: 1.55 }}>{sub}</p>}
    </>
  );
}

/* COption — card dark com ícone + título + descrição + chevron/check. */
export function COption({ title, desc, selected, isStep, badge, Icon, onClick }: { title: string; desc: string; selected?: boolean; isStep?: boolean; badge?: string; Icon?: LucideIcon; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: radP, background: QA.card, border: `1px solid ${selected ? QA.brass : QA.border}`, cursor: "pointer", position: "relative", color: QA.text, fontFamily: F.sans, transition: "all 0.15s ease" }}>
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

/* CPrimary — CTA brass full-width. */
export function CPrimary({ children, icon, onClick, disabled }: { children: ReactNode; icon?: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "14px 22px", borderRadius: radP, border: "none", background: disabled ? QA.cardHi : QA.brass, color: disabled ? QA.textMute : QA.bgDeep, cursor: disabled ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: F.sans }}>
      {children}
      {icon}
    </button>
  );
}