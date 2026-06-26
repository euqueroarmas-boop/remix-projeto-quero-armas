import { useState } from "react";

/**
 * 10 mockups da tela /area-do-cliente/agendar-exame.
 * Cada mockup mostra as 3 TELAS REAIS do fluxo atual (não inventa nada):
 *   TELA A — Aba PSICÓLOGO: filtros + lista de credenciados
 *   TELA B — Aba INSTRUTOR DE TIRO: filtros + lista + bloco PDF oficial PF
 *   TELA C — Estado "fora do raio": aviso amarelo + lista dos mais próximos
 *
 * Os dados, rótulos, abas, filtros, validades, formato de telefone e o link
 * "Abrir no mapa" são copiados do código vivo (QAClienteAgendarExamePage +
 * AgendarExameList). Só a SKIN visual muda entre os 10.
 */

type Skin = {
  id: number;
  nome: string;
  desc: string;
  page: string;     // fundo da página
  paper: string;    // fundo do card
  ink: string;
  inkSoft: string;
  accent: string;   // cor primária (ações / abas ativas / distância)
  warn: string;     // amarelo do aviso fora-do-raio (sutilmente tematizado)
  warnInk: string;
  border: string;
  font: string;
  display: string;
  radius: number;
  shadow: string;
  upperHeadings: boolean;
};

const SKINS: Skin[] = [
  { id: 11, nome: "Arsenal Bordô (atual refinado)", desc: "Identidade vigente · papel + bordô",      page: "#f6f5f1", paper: "#ffffff", ink: "#0A0A0A", inkSoft: "#6A6A6A", accent: "#7A1F2B", warn: "#fff8e1", warnInk: "#5a4500", border: "#e3e3e1", font: "'Arial Narrow', Arial, sans-serif", display: "Oswald, sans-serif", radius: 4, shadow: "none", upperHeadings: true },
  { id: 12, nome: "Concierge Light",        desc: "Premium · serif + bordô mais quente",   page: "#f4efe7", paper: "#ffffff", ink: "#1a1a1a", inkSoft: "#6a6a6a", accent: "#7A1F2B", warn: "#fbf1d5", warnInk: "#5a4500", border: "#e3ddd1", font: "Georgia, serif",                       display: "Oswald, sans-serif", radius: 4, shadow: "0 6px 18px rgba(0,0,0,.05)", upperHeadings: true },
  { id: 13, nome: "Clínica",                desc: "Hospitalar · azul calmo",               page: "#eef3f6", paper: "#ffffff", ink: "#0e2233", inkSoft: "#5a6b7a", accent: "#1f6fb2", warn: "#fff4d6", warnInk: "#6a5200", border: "#dfe7ed", font: "Inter, sans-serif",                    display: "Inter, sans-serif", radius: 10, shadow: "0 6px 18px rgba(15,40,70,.08)", upperHeadings: false },
  { id: 14, nome: "Swiss Minimal",          desc: "Helvética · regra · grid",              page: "#ffffff", paper: "#ffffff", ink: "#0A0A0A", inkSoft: "#7a7a7a", accent: "#000000", warn: "#fff8e1", warnInk: "#5a4500", border: "#000000", font: "'Helvetica Neue', Arial, sans-serif", display: "'Helvetica Neue', Arial, sans-serif", radius: 0, shadow: "none", upperHeadings: true },
  { id: 15, nome: "Editorial Catalog",      desc: "Magazine · serif + numeração",          page: "#faf8f3", paper: "#ffffff", ink: "#111111", inkSoft: "#6a6a6a", accent: "#7A1F2B", warn: "#fbeecf", warnInk: "#5a4500", border: "#e6e1d4", font: "Georgia, serif",                       display: "'Playfair Display', Georgia, serif", radius: 0, shadow: "none", upperHeadings: true },
  { id: 16, nome: "Dossier Oficial",        desc: "Datilografado · papel timbrado",        page: "#ede8db", paper: "#fbf8ee", ink: "#0A0A0A", inkSoft: "#5b5544", accent: "#7A1F2B", warn: "#f2e3a8", warnInk: "#4a3a00", border: "#cdc6ad", font: "'Courier New', monospace",            display: "'Courier New', monospace", radius: 0, shadow: "0 2px 0 rgba(0,0,0,.06)", upperHeadings: true },
  { id: 17, nome: "Bento Mobile",           desc: "App-first · cards arredondados",        page: "#f1efe9", paper: "#ffffff", ink: "#0A0A0A", inkSoft: "#6a6a6a", accent: "#7A1F2B", warn: "#fff3d1", warnInk: "#5a4500", border: "#e6e3da", font: "Inter, sans-serif",                    display: "Inter, sans-serif", radius: 16, shadow: "0 10px 24px rgba(0,0,0,.06)", upperHeadings: false },
  { id: 18, nome: "Operacional Dark",       desc: "Ops center · mono + brass",             page: "#0b0b0c", paper: "#141416", ink: "#f4f4f0", inkSoft: "#8a8a86", accent: "#D6A64B", warn: "#3a3322", warnInk: "#f0d893", border: "#23231f", font: "'JetBrains Mono', monospace",         display: "Oswald, sans-serif", radius: 2, shadow: "0 0 0 1px #1d1d1f", upperHeadings: true },
  { id: 19, nome: "Arsenal Black",          desc: "Preto + bordô · marca cheia",           page: "#0A0A0A", paper: "#141414", ink: "#fafaf7", inkSoft: "#9a9a9a", accent: "#7A1F2B", warn: "#2a2118", warnInk: "#f0d893", border: "#2a2a2a", font: "Inter, sans-serif",                    display: "Oswald, sans-serif", radius: 4, shadow: "0 8px 22px rgba(0,0,0,.45)", upperHeadings: true },
  { id: 20, nome: "Bilhete Kraft",          desc: "Papel kraft · serif + carimbo",         page: "#e9e1cd", paper: "#fbf6e6", ink: "#1a1100", inkSoft: "#6b5a32", accent: "#7A1F2B", warn: "#efd98a", warnInk: "#4a3a00", border: "#c9bd9a", font: "Georgia, serif",                       display: "'Special Elite', 'Courier New', monospace", radius: 0, shadow: "0 2px 0 rgba(0,0,0,.12)", upperHeadings: true },
];

// ───── Dados fictícios MAS no formato 1:1 do que vem de useCredenciadosPsico/IAT ─────
type Cred = {
  nome: string;
  registro: string | null;
  endereco: string;
  bairro: string | null;
  cidade: string | null;
  uf: string;
  telefones: string[];
  emails: string[];
  validade_label: string | null;
  distancia_km: number | null;
};

const PSICO: Cred[] = [
  { nome: "DRA. LARA MENDES OLIVEIRA",   registro: "CRP 06/12345", endereco: "Rua Bento de Andrade, 184",  bairro: "Jardim Paulista", cidade: "São José dos Campos", uf: "SP", telefones: ["(12) 99812-4501"], emails: ["lara.mendes@psi.com.br"], validade_label: "12/08/2026", distancia_km: 2.3 },
  { nome: "DR. RAFAEL MONTEIRO COSTA",   registro: "CRP 06/77821", endereco: "Av. São João, 920",          bairro: "Centro",          cidade: "São José dos Campos", uf: "SP", telefones: ["(12) 99711-3322"], emails: [],                         validade_label: "04/03/2027", distancia_km: 3.8 },
  { nome: "DRA. PATRÍCIA NUNES BRAGA",   registro: "CRP 06/55310", endereco: "Rua das Acácias, 47",        bairro: "Vila Adyana",     cidade: "São José dos Campos", uf: "SP", telefones: ["(12) 98221-7890"], emails: ["patricia.braga@psi.com"], validade_label: "27/11/2025", distancia_km: 5.1 },
];

const IAT: Cred[] = [
  { nome: "JOÃO PAULO TAVARES",          registro: "Portaria 028/2024-DELESP", endereco: "Clube de Tiro Alvo Certo · Rod. Pres. Dutra, km 145", bairro: "Clube de Tiro Alvo Certo", cidade: null, uf: "SP", telefones: ["(12) 99440-0211"], emails: ["jp.tavares@iat.com.br"], validade_label: "30/06/2026", distancia_km: 8.4 },
  { nome: "MARCOS ANTÔNIO PERES",        registro: "Portaria 014/2023-DELESP", endereco: "Estande Vale do Tiro · Estr. do Cajuru, 1200",        bairro: "Estande Vale do Tiro",     cidade: null, uf: "SP", telefones: ["(12) 99113-5577"], emails: [],                        validade_label: "10/02/2027", distancia_km: 14.7 },
  { nome: "ALEXANDRE LIMA FERREIRA",     registro: "Portaria 045/2024-DELESP", endereco: "Clube Caçadores SJC · Rua dos Pinhais, 350",          bairro: "Clube Caçadores SJC",      cidade: null, uf: "SP", telefones: ["(12) 98180-7799"], emails: ["alexandre@clubecacadores.com"], validade_label: "Vencido em 02/04/2026", distancia_km: 22.1 },
];

// ─────────────────────────── helpers de skin ───────────────────────────
function fmtKm(d: number | null) {
  if (d == null) return null;
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return `${d.toFixed(d < 10 ? 1 : 0)} km`;
}

function Tabs({ s, ativo }: { s: Skin; ativo: "psicologo" | "instrutor_tiro" }) {
  const opts: Array<{ k: "psicologo" | "instrutor_tiro"; label: string }> = [
    { k: "psicologo",       label: "EXAME PSICOLÓGICO" },
    { k: "instrutor_tiro",  label: "EXAME DE TIRO" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {opts.map((o) => {
        const on = ativo === o.k;
        return (
          <div key={o.k} style={{
            flex: 1, padding: "10px 12px",
            border: `1px solid ${on ? s.accent : s.border}`,
            background: on ? s.accent : s.paper,
            color: on ? "#fff" : s.ink,
            fontFamily: s.display, fontSize: 11, letterSpacing: ".14em",
            textAlign: "center", borderRadius: s.radius,
          }}>{o.label}</div>
        );
      })}
    </div>
  );
}

function Filtros({ s, cep = "12.309-000", uf = "SP", raio = "50 km" }: { s: Skin; cep?: string; uf?: string; raio?: string }) {
  const lbl: React.CSSProperties = { display: "grid", gap: 3, fontSize: 10, letterSpacing: ".12em", color: s.inkSoft, fontFamily: s.display };
  const inp: React.CSSProperties = { border: `1px solid ${s.border}`, padding: "6px 8px", fontFamily: s.font, fontSize: 12, background: s.paper, color: s.ink, borderRadius: Math.min(s.radius, 4) };
  return (
    <div style={{ background: s.paper, border: `1px solid ${s.border}`, borderRadius: s.radius, padding: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 12, boxShadow: s.shadow }}>
      <label style={lbl}>CEP<span style={inp}>{cep}</span></label>
      <label style={lbl}>UF<span style={inp}>{uf}</span></label>
      <label style={lbl}>RAIO<span style={inp}>{raio}</span></label>
      <label style={lbl}>BUSCAR<span style={{ ...inp, color: s.inkSoft }}>Nome, bairro, cidade…</span></label>
      <label style={{ ...lbl, alignSelf: "end", flexDirection: "row" as const, display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, border: `1px solid ${s.border}`, display: "inline-block" }} /> Incluir vencidos
      </label>
    </div>
  );
}

function Card({ s, c }: { s: Skin; c: Cred }) {
  const vencido = (c.validade_label || "").toLowerCase().startsWith("vencido");
  return (
    <article style={{ border: `1px solid ${s.border}`, background: s.paper, borderRadius: s.radius, padding: "12px 14px", display: "grid", gap: 5, boxShadow: s.shadow }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div style={{ fontFamily: s.display, fontSize: 13, fontWeight: 700, color: s.ink, letterSpacing: s.upperHeadings ? ".04em" : 0, textTransform: s.upperHeadings ? "uppercase" : "none" }}>{c.nome}</div>
          {c.registro && <div style={{ fontSize: 11, color: s.inkSoft, marginTop: 2 }}>{c.registro}</div>}
        </div>
        {c.distancia_km != null && (
          <span style={{ fontFamily: s.display, fontSize: 12, fontWeight: 700, color: s.accent, letterSpacing: ".06em" }}>{fmtKm(c.distancia_km)}</span>
        )}
      </header>
      <div style={{ fontSize: 11, color: s.ink }}>
        {c.endereco}{c.bairro ? ` — ${c.bairro}` : ""}{c.cidade ? ` · ${c.cidade}/${c.uf}` : ` · ${c.uf}`}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, marginTop: 3 }}>
        {c.telefones.map((t) => (
          <span key={t} style={{ color: s.ink, borderBottom: `1px dotted ${s.accent}` }}>📞 {t}</span>
        ))}
        {c.emails.map((e) => (
          <span key={e} style={{ color: s.ink, borderBottom: `1px dotted ${s.accent}` }}>✉ {e}</span>
        ))}
        <span style={{ color: s.ink, borderBottom: `1px dotted ${s.accent}` }}>📍 Abrir no mapa</span>
      </div>
      {c.validade_label && (
        <div style={{ fontSize: 11, color: vencido ? "#df2727" : s.inkSoft, marginTop: 3 }}>
          {vencido ? "⚠ Credenciamento " : "Credenciamento válido até "}{c.validade_label}
        </div>
      )}
    </article>
  );
}

function BlocoPdfPf({ s, uf = "SP" }: { s: Skin; uf?: string }) {
  return (
    <div style={{ marginTop: 12, background: s.paper, border: `1px solid ${s.border}`, padding: 12, borderRadius: s.radius, fontSize: 11, color: s.ink, boxShadow: s.shadow }}>
      <strong style={{ display: "block", fontFamily: s.display, letterSpacing: ".14em", marginBottom: 4 }}>LISTA OFICIAL PF (PDF)</strong>
      A Polícia Federal publica os instrutores de tiro credenciados em PDFs por UF.
      <div style={{ marginTop: 4 }}>
        <span style={{ color: s.accent, fontWeight: 700 }}>Baixar lista atualizada — {uf}</span>
      </div>
    </div>
  );
}

function AvisoForaDoRaio({ s }: { s: Skin }) {
  return (
    <div style={{ background: s.warn, border: `1px solid ${s.warn}`, padding: 10, borderRadius: s.radius, fontSize: 11, color: s.warnInk, marginBottom: 10 }}>
      Nenhum credenciado dentro de 50 km de São José dos Campos. Mostrando os mais próximos — o mais perto está a 78 km. Amplie o raio se quiser.
    </div>
  );
}

// ─────────────────────── 3 telas, montadas sobre 1 skin ───────────────────────
function ScreenWrapper({ s, children }: { s: Skin; children: React.ReactNode }) {
  return (
    <div style={{ background: s.page, color: s.ink, fontFamily: s.font, padding: 14, minHeight: 560 }}>
      <div style={{ fontFamily: s.display, fontSize: 10, color: s.accent, letterSpacing: ".18em", cursor: "default" }}>← VOLTAR</div>
      <h1 style={{ fontFamily: s.display, fontWeight: 700, fontSize: 18, color: s.ink, margin: "8px 0 4px", letterSpacing: s.upperHeadings ? ".04em" : 0, textTransform: s.upperHeadings ? "uppercase" : "none" }}>
        Agendar exame — profissionais credenciados PF
      </h1>
      <p style={{ fontSize: 11, color: s.inkSoft, margin: "0 0 12px" }}>
        Lista oficial da Polícia Federal sincronizada diariamente.
      </p>
      {children}
      <p style={{ fontSize: 10, color: s.inkSoft, marginTop: 12, textAlign: "center" }}>
        Dados oficiais da Polícia Federal — atualização diária automática.
      </p>
    </div>
  );
}

function TelaA({ s }: { s: Skin }) { // Aba PSICÓLOGO
  return (
    <ScreenWrapper s={s}>
      <Tabs s={s} ativo="psicologo" />
      <Filtros s={s} />
      <div style={{ fontSize: 10, color: s.inkSoft, marginBottom: 8 }}>Origem: São José dos Campos/SP</div>
      <div style={{ display: "grid", gap: 8 }}>
        {PSICO.map((c, i) => <Card key={i} s={s} c={c} />)}
      </div>
    </ScreenWrapper>
  );
}

function TelaB({ s }: { s: Skin }) { // Aba INSTRUTOR DE TIRO
  return (
    <ScreenWrapper s={s}>
      <Tabs s={s} ativo="instrutor_tiro" />
      <Filtros s={s} />
      <div style={{ fontSize: 10, color: s.inkSoft, marginBottom: 8 }}>Origem: São José dos Campos/SP</div>
      <div style={{ display: "grid", gap: 8 }}>
        {IAT.slice(0,2).map((c, i) => <Card key={i} s={s} c={c} />)}
      </div>
      <BlocoPdfPf s={s} />
    </ScreenWrapper>
  );
}

function TelaC({ s }: { s: Skin }) { // Estado "fora do raio"
  return (
    <ScreenWrapper s={s}>
      <Tabs s={s} ativo="psicologo" />
      <Filtros s={s} raio="10 km" />
      <AvisoForaDoRaio s={s} />
      <div style={{ display: "grid", gap: 8 }}>
        {[{ ...PSICO[2], distancia_km: 78.4 }, IAT[2]].map((c, i) => <Card key={i} s={s} c={c as Cred} />)}
      </div>
    </ScreenWrapper>
  );
}

// ─────────────────────────── linha do mockup ───────────────────────────
function MockupRow({ s }: { s: Skin }) {
  const telas: Array<{ titulo: string; render: React.ReactNode }> = [
    { titulo: "TELA A · ABA PSICÓLOGO",       render: <TelaA s={s} /> },
    { titulo: "TELA B · ABA INSTRUTOR DE TIRO", render: <TelaB s={s} /> },
    { titulo: "TELA C · ESTADO FORA DO RAIO",  render: <TelaC s={s} /> },
  ];
  return (
    <section id={`mockup-${s.id}`} style={{ border: "1px solid #d6d6d4", borderRadius: 8, overflow: "hidden", background: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,.06)" }}>
      <header style={{ background: "#0A0A0A", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 12, fontFamily: "Oswald, sans-serif" }}>
        <span style={{ fontSize: 11, color: "#D6A64B", letterSpacing: ".24em" }}>MOCKUP {s.id}</span>
        <strong style={{ letterSpacing: ".10em", fontSize: 14 }}>{s.nome.toUpperCase()}</strong>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9a9a9a", letterSpacing: ".14em", textTransform: "uppercase" }}>{s.desc}</span>
      </header>
      <div style={{ background: "#ece9e2", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {telas.map((t, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #d6d6d4", boxShadow: "0 4px 12px rgba(0,0,0,.04)" }}>
            <div style={{ background: "#fafaf7", padding: "6px 10px", borderBottom: "1px solid #e6e3da", fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".22em", color: "#6A6A6A" }}>
              {t.titulo}
            </div>
            {t.render}
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
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".30em", fontSize: 11, color: "#7A1F2B" }}>QUERO ARMAS · DESIGN LAB · V2</div>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, letterSpacing: ".06em", color: "#0A0A0A", margin: "6px 0 4px" }}>
            10 MOCKUPS — AGENDAR EXAME (FLUXO REAL)
          </h1>
          <p style={{ color: "#5a5a5a", fontSize: 13, margin: 0, maxWidth: 900 }}>
            Cada linha aplica uma <strong>skin visual</strong> diferente sobre as <strong>3 telas que já existem</strong> em
            <code style={{ background: "#f6f5f1", padding: "1px 6px", margin: "0 4px", border: "1px solid #d6d6d4", borderRadius: 3 }}>/area-do-cliente/agendar-exame</code>:
            aba Psicólogo, aba Instrutor de Tiro (com PDF oficial PF) e estado "fora do raio".
            Nenhum elemento novo foi inventado — mesmos filtros, mesmas abas, mesmos campos do card de credenciado.
          </p>
        </header>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {SKINS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setFoco(m.id); document.getElementById(`mockup-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ background: foco === m.id ? "#7A1F2B" : "#fff", color: foco === m.id ? "#fff" : "#0A0A0A", border: "1px solid #d6d6d4", padding: "6px 11px", fontFamily: "Oswald, sans-serif", letterSpacing: ".10em", fontSize: 11, cursor: "pointer", borderRadius: 999 }}
            >
              {m.id} · {m.nome}
            </button>
          ))}
        </nav>

        <div style={{ display: "grid", gap: 22 }}>
          {SKINS.map((s) => <MockupRow key={s.id} s={s} />)}
        </div>

        <p style={{ textAlign: "center", color: "#6A6A6A", fontSize: 12, marginTop: 28 }}>
          Me diga o número da skin escolhida que eu aplico em <code>QAClienteAgendarExamePage</code> + <code>AgendarExameList</code>.
        </p>
      </div>
    </main>
  );
}