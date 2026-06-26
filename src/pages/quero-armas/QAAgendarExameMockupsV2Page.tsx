import { useState } from "react";

/**
 * 10 mockups visuais da jornada "Agendar Exame" — cada mockup mostra as 3 TELAS:
 *   01 · Busca por CEP + lista
 *   02 · Seleção do profissional + escolha de data/hora
 *   03 · Confirmação do agendamento
 * Apenas apresentação (dados fictícios). Rota: /area-do-cliente/agendar-exame/mockups-v2
 */

type Theme = {
  id: number;
  nome: string;
  desc: string;
  // tokens
  bg: string;        // fundo da "tela"
  paper: string;    // cartão
  ink: string;      // texto principal
  inkSoft: string;
  accent: string;
  border: string;
  font: string;
  display: string;  // fonte de display
  radius: number;
  shadow: string;
  upper?: boolean;
};

const THEMES: Theme[] = [
  { id: 11, nome: "Concierge Bordô",        desc: "Premium light · serviço de hotel",        bg: "#f4efe7", paper: "#ffffff", ink: "#1a1a1a", inkSoft: "#6a6a6a", accent: "#7A1F2B", border: "#e3ddd1", font: "Georgia, serif", display: "Oswald, sans-serif", radius: 4, shadow: "0 8px 22px rgba(0,0,0,.06)", upper: true },
  { id: 12, nome: "Clínica Limpa",          desc: "Hospitalar · branco + azul calmo",        bg: "#eef3f6", paper: "#ffffff", ink: "#0e2233", inkSoft: "#5a6b7a", accent: "#1f6fb2", border: "#dfe7ed", font: "Inter, sans-serif", display: "Inter, sans-serif", radius: 10, shadow: "0 6px 18px rgba(15,40,70,.08)" },
  { id: 13, nome: "Operacional Dark",       desc: "Tactical · mono · ops center",            bg: "#0b0b0c", paper: "#141416", ink: "#f4f4f0", inkSoft: "#8a8a86", accent: "#D6A64B", border: "#23231f", font: "'JetBrains Mono', monospace", display: "Oswald, sans-serif", radius: 2, shadow: "0 0 0 1px #1d1d1f", upper: true },
  { id: 14, nome: "Bilhete de Estande",     desc: "Ticket · papel kraft · carimbo",          bg: "#e9e1cd", paper: "#fbf6e6", ink: "#1a1100", inkSoft: "#6b5a32", accent: "#7A1F2B", border: "#c9bd9a", font: "Georgia, serif", display: "'Special Elite', monospace", radius: 0, shadow: "0 2px 0 rgba(0,0,0,.12)" },
  { id: 15, nome: "Bento Mobile",           desc: "App-first · cards arredondados",          bg: "#f1efe9", paper: "#ffffff", ink: "#0A0A0A", inkSoft: "#6a6a6a", accent: "#7A1F2B", border: "#e6e3da", font: "Inter, sans-serif", display: "Inter, sans-serif", radius: 18, shadow: "0 10px 24px rgba(0,0,0,.07)" },
  { id: 16, nome: "Editorial Magazine",     desc: "Catálogo · serif + numeração",            bg: "#faf8f3", paper: "#ffffff", ink: "#111", inkSoft: "#6a6a6a", accent: "#7A1F2B", border: "#e6e1d4", font: "Georgia, serif", display: "'Playfair Display', serif", radius: 0, shadow: "none", upper: true },
  { id: 17, nome: "Mapa Split",             desc: "Lista + mapa + pin selecionado",          bg: "#eef0ec", paper: "#ffffff", ink: "#1a1a1a", inkSoft: "#5a5a5a", accent: "#0e6b3e", border: "#dde2db", font: "system-ui, sans-serif", display: "Oswald, sans-serif", radius: 6, shadow: "0 4px 14px rgba(0,0,0,.05)" },
  { id: 18, nome: "Dossier Oficial",        desc: "Papel timbrado · selo · datilografado",   bg: "#ede8db", paper: "#fbf8ee", ink: "#0A0A0A", inkSoft: "#5b5544", accent: "#7A1F2B", border: "#cdc6ad", font: "'Courier New', monospace", display: "'Courier New', monospace", radius: 0, shadow: "0 2px 0 rgba(0,0,0,.08)", upper: true },
  { id: 19, nome: "Swiss Minimal",          desc: "Grid · regra · zero ruído",               bg: "#ffffff", paper: "#ffffff", ink: "#0A0A0A", inkSoft: "#7a7a7a", accent: "#000000", border: "#000000", font: "'Helvetica Neue', Arial, sans-serif", display: "'Helvetica Neue', Arial, sans-serif", radius: 0, shadow: "none", upper: true },
  { id: 20, nome: "Arsenal Vermelho",       desc: "Preto + bordô · marca cheia",             bg: "#0A0A0A", paper: "#141414", ink: "#fafaf7", inkSoft: "#9a9a9a", accent: "#7A1F2B", border: "#2a2a2a", font: "Inter, sans-serif", display: "Oswald, sans-serif", radius: 4, shadow: "0 8px 22px rgba(0,0,0,.45)", upper: true },
];

type Prof = { nome: string; reg: string; bairro: string; cidade: string; distancia: string; validade: string };
const PROFS: Prof[] = [
  { nome: "Dra. Lara Mendes Oliveira",  reg: "CRP 06/12345", bairro: "Jardim Paulista", cidade: "São José dos Campos/SP", distancia: "2,3 km", validade: "12/08/2026" },
  { nome: "Dr. Rafael Monteiro Costa",  reg: "CRP 06/77821", bairro: "Centro",          cidade: "São José dos Campos/SP", distancia: "3,8 km", validade: "04/03/2027" },
  { nome: "Dra. Patrícia Nunes Braga",  reg: "CRP 06/55310", bairro: "Vila Adyana",     cidade: "São José dos Campos/SP", distancia: "5,1 km", validade: "27/11/2025" },
];

const HORARIOS = ["09:00", "10:30", "14:00", "15:30", "17:00"];

function tx(t: Theme, s: string) { return t.upper ? s.toUpperCase() : s; }

// ─────────────────────────────── Screen 1: Busca ───────────────────────────────
function Screen1({ t }: { t: Theme }) {
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.font, padding: 18, height: 520, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: t.display, fontSize: 10, letterSpacing: ".28em", color: t.accent }}>{tx(t, "Etapa 1 de 3")}</div>
      <div style={{ fontFamily: t.display, fontSize: 22, lineHeight: 1.1, letterSpacing: t.upper ? ".04em" : 0 }}>{tx(t, "Profissionais perto de você")}</div>
      <div style={{ background: t.paper, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: 12, display: "flex", gap: 8, alignItems: "center", boxShadow: t.shadow }}>
        <span style={{ fontSize: 11, color: t.inkSoft, fontFamily: t.display, letterSpacing: ".14em" }}>{tx(t, "CEP")}</span>
        <span style={{ fontWeight: 700 }}>12.309-000</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: t.inkSoft }}>{tx(t, "raio 50 km")}</span>
        <button style={{ background: t.accent, color: "#fff", border: 0, padding: "6px 10px", fontFamily: t.display, fontSize: 10, letterSpacing: ".14em", borderRadius: t.radius }}>{tx(t, "Buscar")}</button>
      </div>
      {PROFS.map((p, i) => (
        <div key={i} style={{ background: t.paper, border: `1px solid ${t.border}`, borderLeft: i === 0 ? `3px solid ${t.accent}` : `1px solid ${t.border}`, borderRadius: t.radius, padding: 12, boxShadow: t.shadow, display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
          <div>
            <div style={{ fontFamily: t.display, fontSize: 13, letterSpacing: t.upper ? ".06em" : 0 }}>{tx(t, p.nome)}</div>
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{p.reg} · {p.bairro}</div>
          </div>
          <div style={{ textAlign: "right", fontFamily: t.display, color: t.accent, fontSize: 14 }}>{p.distancia}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────── Screen 2: Seleção ───────────────────────────────
function Screen2({ t }: { t: Theme }) {
  const p = PROFS[0];
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.font, padding: 18, height: 520, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: t.display, fontSize: 10, letterSpacing: ".28em", color: t.accent }}>{tx(t, "Etapa 2 de 3")}</div>
      <div style={{ background: t.paper, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: 14, boxShadow: t.shadow }}>
        <div style={{ fontFamily: t.display, fontSize: 15, letterSpacing: t.upper ? ".06em" : 0 }}>{tx(t, p.nome)}</div>
        <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 3 }}>{p.reg} · {p.bairro} · {p.cidade}</div>
        <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 4 }}>{tx(t, "Validade do credenciamento")}: <strong style={{ color: t.ink }}>{p.validade}</strong></div>
      </div>
      <div style={{ fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", color: t.inkSoft }}>{tx(t, "Escolha a data")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {["27","28","29","30","01","02","03"].map((d, i) => (
          <div key={i} style={{ background: i === 2 ? t.accent : t.paper, color: i === 2 ? "#fff" : t.ink, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: "10px 0", textAlign: "center", fontFamily: t.display, fontSize: 13 }}>{d}</div>
        ))}
      </div>
      <div style={{ fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", color: t.inkSoft, marginTop: 4 }}>{tx(t, "Horário disponível")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {HORARIOS.map((h, i) => (
          <div key={i} style={{ background: i === 1 ? t.accent : t.paper, color: i === 1 ? "#fff" : t.ink, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: "8px 12px", fontFamily: t.display, fontSize: 12, letterSpacing: ".08em" }}>{h}</div>
        ))}
      </div>
      <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
        <button style={{ flex: 1, background: "transparent", color: t.ink, border: `1px solid ${t.border}`, padding: "10px 0", fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", borderRadius: t.radius }}>{tx(t, "Voltar")}</button>
        <button style={{ flex: 2, background: t.accent, color: "#fff", border: 0, padding: "10px 0", fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", borderRadius: t.radius }}>{tx(t, "Confirmar agendamento")}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────── Screen 3: Confirmação ───────────────────────────────
function Screen3({ t }: { t: Theme }) {
  const p = PROFS[0];
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.font, padding: 18, height: 520, overflow: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: t.display, fontSize: 10, letterSpacing: ".28em", color: t.accent }}>{tx(t, "Etapa 3 de 3")}</div>
      <div style={{ width: 56, height: 56, borderRadius: 999, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontFamily: t.display }}>✓</div>
      <div style={{ fontFamily: t.display, fontSize: 22, lineHeight: 1.15, letterSpacing: t.upper ? ".04em" : 0 }}>{tx(t, "Agendamento confirmado")}</div>
      <div style={{ fontSize: 12, color: t.inkSoft }}>{tx(t, "Comprovante enviado para seu e-mail e WhatsApp.")}</div>

      <div style={{ background: t.paper, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: 14, boxShadow: t.shadow, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.inkSoft, fontFamily: t.display, letterSpacing: ".14em" }}>
          <span>{tx(t, "Profissional")}</span><span>{tx(t, "Protocolo")} #QA-2026-00184</span>
        </div>
        <div style={{ fontFamily: t.display, fontSize: 14, letterSpacing: t.upper ? ".06em" : 0 }}>{tx(t, p.nome)}</div>
        <div style={{ fontSize: 12, color: t.inkSoft }}>{p.reg} · {p.bairro} · {p.cidade}</div>
        <hr style={{ border: 0, borderTop: `1px dashed ${t.border}`, margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: t.display, letterSpacing: ".14em" }}>{tx(t, "Data")}</div>
            <div style={{ fontFamily: t.display, fontSize: 16 }}>29/06/2026</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: t.display, letterSpacing: ".14em" }}>{tx(t, "Horário")}</div>
            <div style={{ fontFamily: t.display, fontSize: 16 }}>10:30</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: t.display, letterSpacing: ".14em" }}>{tx(t, "Duração")}</div>
            <div style={{ fontFamily: t.display, fontSize: 16 }}>≈ 60 min</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
        <button style={{ flex: 1, background: "transparent", color: t.ink, border: `1px solid ${t.border}`, padding: "10px 0", fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", borderRadius: t.radius }}>{tx(t, "Adicionar à agenda")}</button>
        <button style={{ flex: 1, background: t.accent, color: "#fff", border: 0, padding: "10px 0", fontFamily: t.display, fontSize: 11, letterSpacing: ".14em", borderRadius: t.radius }}>{tx(t, "Ver meus exames")}</button>
      </div>
    </div>
  );
}

function MockupRow({ t }: { t: Theme }) {
  return (
    <section id={`mockup-${t.id}`} style={{ border: "1px solid #d6d6d4", borderRadius: 8, overflow: "hidden", background: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,.06)" }}>
      <header style={{ background: "#0A0A0A", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 12, fontFamily: "Oswald, sans-serif" }}>
        <span style={{ fontSize: 11, color: "#D6A64B", letterSpacing: ".24em" }}>MOCKUP {t.id}</span>
        <strong style={{ letterSpacing: ".10em", fontSize: 14 }}>{t.nome.toUpperCase()}</strong>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9a9a9a", letterSpacing: ".14em", textTransform: "uppercase" }}>{t.desc}</span>
      </header>
      <div style={{ background: "#ece9e2", padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {[Screen1, Screen2, Screen3].map((Scr, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #d6d6d4", boxShadow: "0 4px 12px rgba(0,0,0,.05)" }}>
            <div style={{ background: "#fafaf7", padding: "6px 10px", borderBottom: "1px solid #e6e3da", fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".22em", color: "#6A6A6A" }}>
              TELA {i + 1} · {["BUSCA", "SELEÇÃO", "CONFIRMAÇÃO"][i]}
            </div>
            <Scr t={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function QAAgendarExameMockupsV2Page() {
  const [foco, setFoco] = useState<number | null>(null);
  return (
    <main style={{ background: "#ece9e2", minHeight: "100vh", padding: "32px 18px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".30em", fontSize: 11, color: "#7A1F2B" }}>QUERO ARMAS · DESIGN LAB · V2</div>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 30, letterSpacing: ".06em", color: "#0A0A0A", margin: "6px 0 4px" }}>
            10 MOCKUPS — AGENDAR EXAME · 3 TELAS CADA
          </h1>
          <p style={{ color: "#5a5a5a", fontSize: 13, margin: 0 }}>
            Cada linha mostra a mesma direção visual aplicada às 3 telas do fluxo: busca → seleção de data/hora → confirmação. Dados fictícios. Me diga o número escolhido.
          </p>
        </header>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
          {THEMES.map((m) => (
            <button
              key={m.id}
              onClick={() => { setFoco(m.id); document.getElementById(`mockup-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ background: foco === m.id ? "#7A1F2B" : "#fff", color: foco === m.id ? "#fff" : "#0A0A0A", border: "1px solid #d6d6d4", padding: "6px 11px", fontFamily: "Oswald, sans-serif", letterSpacing: ".10em", fontSize: 11, cursor: "pointer", borderRadius: 999 }}
            >
              {m.id} · {m.nome}
            </button>
          ))}
        </nav>

        <div style={{ display: "grid", gap: 26 }}>
          {THEMES.map((t) => <MockupRow key={t.id} t={t} />)}
        </div>

        <p style={{ textAlign: "center", color: "#6A6A6A", fontSize: 12, marginTop: 28 }}>
          Me diga o número do mockup escolhido (ou combine 2) que eu aplico nas telas reais.
        </p>
      </div>
    </main>
  );
}