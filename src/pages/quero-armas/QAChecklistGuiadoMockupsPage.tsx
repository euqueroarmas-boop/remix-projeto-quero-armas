import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

type Mockup = {
  id: number;
  nome: string;
  direcao: string;
  largura: number;
  skin: "command" | "paper" | "dark" | "steel" | "wine";
  layout: "hero" | "split" | "rail" | "table" | "timeline";
};

const mockups: Mockup[] = [
  { id: 1, nome: "Comando Resumo", direcao: "Cabeçalho forte, métricas densas e ação principal no trilho.", largura: 1500, skin: "command", layout: "hero" },
  { id: 2, nome: "Dossiê Tático", direcao: "Visual documental com blocos largos e hierarquia jurídica.", largura: 1460, skin: "paper", layout: "split" },
  { id: 3, nome: "Arsenal Dark", direcao: "Mais próximo do menu Resumo: preto, vinho e superfície operacional.", largura: 1520, skin: "dark", layout: "rail" },
  { id: 4, nome: "Mesa de Triagem", direcao: "Checklist em formato de painel de trabalho, bom para leitura rápida.", largura: 1480, skin: "steel", layout: "table" },
  { id: 5, nome: "Fluxo Passo a Passo", direcao: "Linha do tempo lateral para deixar claro onde o cliente está.", largura: 1500, skin: "wine", layout: "timeline" },
  { id: 6, nome: "Central do Cliente", direcao: "Mais limpo, com CTA grande e área de upload dominante.", largura: 1440, skin: "command", layout: "split" },
  { id: 7, nome: "Radar de Pendências", direcao: "Foco em pendência atual, com cards compactos e indicadores.", largura: 1540, skin: "steel", layout: "hero" },
  { id: 8, nome: "Operação Guiada", direcao: "Navegação lateral interna para alternar entre documentos.", largura: 1500, skin: "dark", layout: "rail" },
  { id: 9, nome: "Pasta Premium", direcao: "Mais elegante e editorial, mantendo a tipografia condensada.", largura: 1460, skin: "paper", layout: "timeline" },
  { id: 10, nome: "Painel Final", direcao: "Equilíbrio entre amplitude, CTA e resumo jurídico.", largura: 1560, skin: "wine", layout: "table" },
];

const skinVars = {
  command: { bg: "#f6f5f1", panel: "#ffffff", ink: "#151515", muted: "#667085", line: "#dedbd4", wine: "#8b1e32", soft: "#fbf3f4" },
  paper: { bg: "#f8f6f0", panel: "#fffdf8", ink: "#171717", muted: "#6c665d", line: "#ded6c8", wine: "#7A1F2B", soft: "#f4eee4" },
  dark: { bg: "#141414", panel: "#1f1f1f", ink: "#f4f1ea", muted: "#b3afa8", line: "#383532", wine: "#9b2438", soft: "#25191b" },
  steel: { bg: "#eff2f3", panel: "#ffffff", ink: "#151922", muted: "#697386", line: "#d6dde4", wine: "#8b1e32", soft: "#eef3f7" },
  wine: { bg: "#f6f1f2", panel: "#ffffff", ink: "#181114", muted: "#70656a", line: "#e4d5d8", wine: "#8b1e32", soft: "#fbedef" },
} as const;

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="qa-metric">
      <div className="qa-metric-value" style={{ color: tone }}>{value}</div>
      <div className="qa-metric-label">{label}</div>
    </div>
  );
}

function StepRail() {
  return (
    <aside className="qa-step-rail" aria-label="Etapas do checklist">
      {["Cadastro", "Exames", "Upload", "Validação", "Protocolo"].map((item, idx) => (
        <div className={`qa-step ${idx === 1 ? "active" : idx < 1 ? "done" : ""}`} key={item}>
          <span>{String(idx + 1).padStart(2, "0")}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </aside>
  );
}

function ChecklistTable() {
  return (
    <div className="qa-table">
      {[
        ["Laudo psicológico", "Atual", "Ação imediata"],
        ["Psicólogo PF", "Jacareí/SP", "Encontrar"],
        ["Upload", "PDF ou foto", "Pendente"],
      ].map(([a, b, c]) => (
        <div className="qa-row" key={a}>
          <span>{a}</span>
          <strong>{b}</strong>
          <em>{c}</em>
        </div>
      ))}
    </div>
  );
}

function Timeline() {
  return (
    <div className="qa-timeline">
      {["Checar profissional credenciado", "Realizar avaliação", "Anexar laudo", "Validação automática"].map((item, idx) => (
        <div className="qa-time-item" key={item}>
          <span>{idx === 0 ? <Search size={15} /> : <CheckCircle2 size={15} />}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

function PopupPreview({ mockup }: { mockup: Mockup }) {
  const v = skinVars[mockup.skin];
  const showRail = mockup.layout === "rail";
  const showTable = mockup.layout === "table";
  const showTimeline = mockup.layout === "timeline";
  const showSplit = mockup.layout === "split";

  return (
    <div className="qa-stage" style={{ background: mockup.skin === "dark" ? "#090909" : "#d8d5cf" }}>
      <div
        className={`qa-popup qa-popup-${mockup.skin} qa-layout-${mockup.layout}`}
        style={{
          maxWidth: mockup.largura,
          background: v.bg,
          color: v.ink,
          borderColor: v.line,
          ["--qa-panel" as string]: v.panel,
          ["--qa-ink" as string]: v.ink,
          ["--qa-muted" as string]: v.muted,
          ["--qa-line" as string]: v.line,
          ["--qa-wine" as string]: v.wine,
          ["--qa-soft" as string]: v.soft,
        }}
      >
        <button className="qa-close" aria-label="Fechar"><X size={20} /></button>
        <header className="qa-head">
          <div className="qa-shield"><ShieldCheck size={26} /></div>
          <div>
            <span className="qa-kicker">Assistente de documentação</span>
            <h1>Vamos montar sua pasta, passo a passo</h1>
            <p>Aquisição / Registro / Posse de Arma de Fogo</p>
          </div>
          <div className="qa-progress-copy">12 de 20 itens resolvidos · 8 pendências restantes</div>
        </header>

        <div className="qa-progress"><span style={{ width: "60%" }} /></div>

        <section className="qa-summary">
          <div className="qa-summary-copy">
            <span>23 itens cadastrados no checklist</span>
            <p>Documentos permanentes vivem no Hub. Esta etapa usa a base legal da Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311.</p>
          </div>
          <div className="qa-metrics">
            <Metric label="Seus dados" value="21" tone={v.wine} />
            <Metric label="Arma" value="0" />
            <Metric label="Processo" value="2" />
          </div>
        </section>

        <main className="qa-body">
          {showRail && <StepRail />}
          <section className="qa-current">
            <div className="qa-current-head">
              <div>
                <span>Tarefa atual · Exames técnicos</span>
                <h2>Laudo Psicológico</h2>
                <p>Psicólogo credenciado pela Polícia Federal.</p>
              </div>
              <div className="qa-doc-badge"><FileText size={18} /> Pendente</div>
            </div>

            {showSplit ? (
              <div className="qa-split">
                <CredentialCard mode={mockup.skin} />
                <UploadBox compact />
              </div>
            ) : showTable ? (
              <>
                <ChecklistTable />
                <CredentialCard mode={mockup.skin} />
              </>
            ) : showTimeline ? (
              <div className="qa-split">
                <Timeline />
                <CredentialCard mode={mockup.skin} />
              </div>
            ) : (
              <>
                <CredentialCard mode={mockup.skin} />
                <UploadBox />
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CredentialCard({ mode }: { mode: Mockup["skin"] }) {
  const dark = mode === "dark";
  return (
    <div className="qa-credential">
      <div className="qa-search-icon"><Search size={24} /></div>
      <div className="qa-credential-copy">
        <span>Profissionais credenciados</span>
        <h3>Psicólogos credenciados pela PF em Jacareí/SP</h3>
        <p>Use a busca oficial integrada para localizar profissionais próximos antes de anexar o laudo.</p>
        <small>Fonte oficial: gov.br/PF · dados sincronizados pela Quero Armas</small>
      </div>
      <button className="qa-action">
        Buscar psicólogos
        <ArrowRight size={17} />
      </button>
      {dark && <div className="qa-credential-stripe" />}
    </div>
  );
}

function UploadBox({ compact = false }: { compact?: boolean }) {
  return (
    <button className={`qa-upload ${compact ? "compact" : ""}`}>
      <span><Upload size={22} /></span>
      <strong>Anexar documento</strong>
      <p>Tire uma foto ou selecione um arquivo</p>
    </button>
  );
}

export default function QAChecklistGuiadoMockupsPage() {
  const [selected, setSelected] = useState(1);
  const current = useMemo(() => mockups.find((m) => m.id === selected) ?? mockups[0], [selected]);

  return (
    <main className="qa-mockups-page">
      <style>{css}</style>
      <aside className="qa-picker">
        <div className="qa-picker-head">
          <span>Mockups</span>
          <h1>Popup do assistente</h1>
          <p>10 opções para aprovar antes de implantar. Nenhuma altera o fluxo real.</p>
        </div>
        <div className="qa-options">
          {mockups.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === selected ? "active" : ""}
              onClick={() => setSelected(m.id)}
            >
              <span>{String(m.id).padStart(2, "0")}</span>
              <strong>{m.nome}</strong>
              <small>{m.direcao}</small>
            </button>
          ))}
        </div>
      </aside>
      <section className="qa-preview">
        <div className="qa-preview-top">
          <div>
            <span>Opção {String(current.id).padStart(2, "0")}</span>
            <h2>{current.nome}</h2>
          </div>
          <div className="qa-width-pill">Popup mais largo · max {current.largura}px</div>
        </div>
        <PopupPreview mockup={current} />
      </section>
    </main>
  );
}

const css = `
.qa-mockups-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  background: #101010;
  color: #f6f1ea;
  font-family: "Arial Narrow", Arial, sans-serif;
}
.qa-picker {
  border-right: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, #181818, #0d0d0d);
  padding: 24px 18px;
  overflow: auto;
}
.qa-picker-head span, .qa-preview-top span, .qa-kicker, .qa-summary-copy span, .qa-current-head span, .qa-credential-copy span {
  display: block;
  color: #9b2438;
  font-family: Oswald, "Arial Narrow", Arial, sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .22em;
  text-transform: uppercase;
}
.qa-picker-head h1, .qa-preview-top h2, .qa-head h1, .qa-current h2, .qa-credential h3 {
  margin: 4px 0 0;
  font-family: Oswald, "Arial Narrow", Arial, sans-serif;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.qa-picker-head p {
  margin: 8px 0 18px;
  color: #a9a29b;
  font-size: 13px;
  line-height: 1.45;
}
.qa-options {
  display: grid;
  gap: 8px;
}
.qa-options button {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 3px 10px;
  border: 1px solid rgba(255,255,255,.11);
  background: rgba(255,255,255,.04);
  color: #f3eee8;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
}
.qa-options button.active {
  border-color: #9b2438;
  background: rgba(155,36,56,.22);
}
.qa-options button span {
  grid-row: span 2;
  color: #9b2438;
  font-family: Oswald, sans-serif;
  font-size: 18px;
  font-weight: 800;
}
.qa-options button strong {
  font-family: Oswald, sans-serif;
  font-size: 13px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.qa-options button small {
  color: #aaa39b;
  line-height: 1.35;
}
.qa-preview {
  min-width: 0;
  padding: 24px;
  overflow: auto;
}
.qa-preview-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
  margin-bottom: 18px;
}
.qa-width-pill {
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px;
  padding: 8px 12px;
  color: #d6d0c8;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .12em;
}
.qa-stage {
  min-height: 770px;
  border-radius: 10px;
  padding: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
}
.qa-popup {
  position: relative;
  width: min(100%, 1500px);
  max-height: 720px;
  overflow: hidden;
  border: 1px solid;
  border-radius: 8px;
  box-shadow: 0 26px 80px rgba(0,0,0,.34);
}
.qa-close {
  position: absolute;
  right: 22px;
  top: 22px;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--qa-line);
  border-radius: 8px;
  background: var(--qa-panel);
  color: var(--qa-muted);
}
.qa-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 26px 34px 18px;
}
.qa-head h1 {
  color: var(--qa-ink);
  font-size: 25px;
}
.qa-head p, .qa-progress-copy, .qa-summary-copy p, .qa-current-head p, .qa-credential-copy p, .qa-upload p {
  margin: 5px 0 0;
  color: var(--qa-muted);
  font-size: 14px;
  line-height: 1.45;
}
.qa-shield {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 12px;
  background: var(--qa-wine);
  color: white;
}
.qa-progress {
  height: 10px;
  margin: 0 34px 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--qa-line) 70%, transparent);
  overflow: hidden;
}
.qa-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--qa-wine);
}
.qa-summary {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.25fr);
  gap: 18px;
  margin: 0 34px 22px;
  padding: 18px;
  border: 1px solid var(--qa-line);
  border-radius: 8px;
  background: var(--qa-soft);
}
.qa-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.qa-metric {
  min-height: 92px;
  border: 1px solid var(--qa-line);
  border-radius: 6px;
  background: var(--qa-panel);
  padding: 14px;
}
.qa-metric-value {
  font-family: Oswald, sans-serif;
  font-size: 31px;
  font-weight: 800;
}
.qa-metric-label {
  margin-top: 5px;
  color: var(--qa-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.qa-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  padding: 24px 34px 34px;
  border-top: 1px solid var(--qa-line);
}
.qa-layout-rail .qa-body {
  grid-template-columns: 230px minmax(0, 1fr);
}
.qa-step-rail {
  display: grid;
  align-content: start;
  gap: 8px;
}
.qa-step {
  border: 1px solid var(--qa-line);
  border-radius: 6px;
  padding: 12px;
  background: var(--qa-panel);
}
.qa-step span {
  color: var(--qa-wine);
  font-family: Oswald, sans-serif;
  font-weight: 800;
}
.qa-step strong {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.qa-step.active {
  border-color: var(--qa-wine);
  background: var(--qa-soft);
}
.qa-current {
  min-width: 0;
}
.qa-current-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: start;
  margin-bottom: 18px;
}
.qa-current h2 {
  font-size: 24px;
}
.qa-doc-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--qa-line);
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--qa-panel);
  color: var(--qa-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.qa-credential {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--qa-wine) 35%, var(--qa-line));
  border-radius: 8px;
  background: var(--qa-panel);
  padding: 20px;
  overflow: hidden;
}
.qa-search-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid var(--qa-line);
  border-radius: 8px;
  background: var(--qa-soft);
  color: var(--qa-wine);
}
.qa-credential h3 {
  font-size: 21px;
  color: var(--qa-ink);
}
.qa-credential-copy small {
  display: block;
  margin-top: 8px;
  color: var(--qa-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.qa-action {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 8px;
  background: var(--qa-wine);
  color: white;
  padding: 14px 20px;
  font-family: Oswald, sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.qa-upload {
  margin-top: 18px;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 150px;
  border: 2px dashed color-mix(in srgb, var(--qa-wine) 28%, var(--qa-line));
  border-radius: 8px;
  background: var(--qa-soft);
  color: var(--qa-ink);
}
.qa-upload.compact {
  min-height: auto;
  margin-top: 0;
  padding: 24px;
}
.qa-upload span {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border-radius: 999px;
  background: var(--qa-wine);
  color: white;
}
.qa-upload strong {
  margin-top: 10px;
  font-family: Oswald, sans-serif;
  font-size: 16px;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.qa-split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
  gap: 16px;
}
.qa-table {
  display: grid;
  border: 1px solid var(--qa-line);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}
.qa-row {
  display: grid;
  grid-template-columns: 1fr 180px 150px;
  gap: 14px;
  align-items: center;
  min-height: 48px;
  padding: 0 16px;
  background: var(--qa-panel);
  border-bottom: 1px solid var(--qa-line);
}
.qa-row:last-child {
  border-bottom: 0;
}
.qa-row span, .qa-row strong, .qa-row em {
  font-size: 12px;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.qa-row em {
  color: var(--qa-wine);
  font-weight: 800;
}
.qa-timeline {
  display: grid;
  gap: 10px;
  align-content: start;
}
.qa-time-item {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 54px;
  border: 1px solid var(--qa-line);
  border-radius: 8px;
  background: var(--qa-panel);
  padding: 12px;
}
.qa-time-item span {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--qa-wine);
  color: white;
}
.qa-time-item p {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
@media (max-width: 980px) {
  .qa-mockups-page {
    grid-template-columns: 1fr;
  }
  .qa-picker {
    border-right: 0;
    border-bottom: 1px solid rgba(255,255,255,.12);
  }
  .qa-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .qa-stage {
    padding: 16px;
  }
  .qa-head, .qa-summary, .qa-body {
    margin-left: 16px;
    margin-right: 16px;
    padding-left: 0;
    padding-right: 0;
  }
  .qa-head, .qa-summary, .qa-layout-rail .qa-body, .qa-split {
    grid-template-columns: 1fr;
  }
}
`;
