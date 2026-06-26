import { useState } from "react";

/**
 * 10 mockups visuais para a tela "Agendar Exame".
 * Apenas apresentação (sem dados reais). Acesse: /area-do-cliente/agendar-exame/mockups
 */

type Prof = {
  nome: string;
  registro: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  distancia: string;
  telefone: string;
  validade: string;
};

const MOCK: Prof[] = [
  { nome: "DRA. LARA MENDES OLIVEIRA", registro: "CRP 06/12345", endereco: "Rua Bento de Andrade, 184 — sala 12", bairro: "Jardim Paulista", cidade: "São José dos Campos", uf: "SP", distancia: "2.3 km", telefone: "(12) 99812-4501", validade: "12/08/2026" },
  { nome: "DR. RAFAEL MONTEIRO COSTA", registro: "CRP 06/77821", endereco: "Av. São João, 920 — 4º andar", bairro: "Centro", cidade: "São José dos Campos", uf: "SP", distancia: "3.8 km", telefone: "(12) 99711-3322", validade: "04/03/2027" },
  { nome: "DRA. PATRÍCIA NUNES BRAGA", registro: "CRP 06/55310", endereco: "Rua das Acácias, 47", bairro: "Vila Adyana", cidade: "São José dos Campos", uf: "SP", distancia: "5.1 km", telefone: "(12) 98221-7890", validade: "27/11/2025" },
  { nome: "DR. THIAGO FERREIRA LEAL", registro: "CRP 06/89004", endereco: "Av. Andrômeda, 2200 — sala 305", bairro: "Jardim Satélite", cidade: "São José dos Campos", uf: "SP", distancia: "7.4 km", telefone: "(12) 99102-4400", validade: "18/05/2026" },
  { nome: "DRA. CAMILA RIBEIRO AZEVEDO", registro: "CRP 06/22117", endereco: "Rua Euclides Miragaia, 90", bairro: "Centro", cidade: "Taubaté", uf: "SP", distancia: "12.6 km", telefone: "(12) 98870-1122", validade: "09/02/2027" },
];

const wrap: React.CSSProperties = { maxWidth: 980, margin: "0 auto" };

function MockupShell({ id, titulo, descricao, bg, children }: { id: number; titulo: string; descricao: string; bg: string; children: React.ReactNode }) {
  return (
    <section id={`mockup-${id}`} style={{ background: bg, borderRadius: 6, overflow: "hidden", border: "1px solid #d6d6d4", boxShadow: "0 4px 14px rgba(0,0,0,.05)" }}>
      <div style={{ background: "#0A0A0A", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "baseline", gap: 12, fontFamily: "Oswald, sans-serif" }}>
        <span style={{ fontSize: 11, color: "#D6A64B", letterSpacing: ".24em" }}>MOCKUP {String(id).padStart(2, "0")}</span>
        <strong style={{ letterSpacing: ".10em", fontSize: 14 }}>{titulo.toUpperCase()}</strong>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9a9a9a", letterSpacing: ".14em", textTransform: "uppercase" }}>{descricao}</span>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </section>
  );
}

// ───────────────────────────── 01 · Editorial Catalog ─────────────────────────────
function M01() {
  return (
    <div style={{ background: "#fafaf7", padding: 24, fontFamily: "Georgia, serif", color: "#1a1a1a" }}>
      <div style={{ borderBottom: "1px solid #1a1a1a", paddingBottom: 14, marginBottom: 20 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 10, letterSpacing: ".38em", color: "#7A1F2B" }}>VOL.06 — CREDENCIAMENTO PF</div>
        <h1 style={{ fontSize: 38, fontWeight: 400, fontStyle: "italic", margin: "8px 0 0" }}>Profissionais perto de você</h1>
        <div style={{ fontSize: 12, color: "#6A6A6A", marginTop: 6 }}>São José dos Campos / SP · raio 50 km · 47 resultados</div>
      </div>
      {MOCK.slice(0,3).map((p, i) => (
        <article key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px", gap: 18, padding: "16px 0", borderBottom: "1px dotted #b8b8b8" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, color: "#7A1F2B" }}>{String(i+1).padStart(2,"0")}</div>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: ".06em", color: "#0A0A0A" }}>{p.nome}</div>
            <div style={{ fontStyle: "italic", color: "#6A6A6A", fontSize: 13, marginTop: 2 }}>{p.registro} · {p.endereco}, {p.bairro}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>☎ {p.telefone} &nbsp; · &nbsp; Válido até {p.validade}</div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "Oswald, sans-serif", color: "#7A1F2B", fontSize: 20 }}>{p.distancia}</div>
        </article>
      ))}
    </div>
  );
}

// ───────────────────────────── 02 · Map-Split ─────────────────────────────
function M02() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#fff", border: "1px solid #e3e3e1", borderRadius: 4, maxHeight: 460, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #e3e3e1", display: "flex", gap: 8 }}>
          <button style={{ flex: 1, background: "#7A1F2B", color: "#fff", border: 0, padding: "8px 0", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11 }}>PSICÓLOGO</button>
          <button style={{ flex: 1, background: "#fff", color: "#0A0A0A", border: "1px solid #d6d6d4", padding: "8px 0", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11 }}>TIRO</button>
        </div>
        {MOCK.slice(0,4).map((p, i) => (
          <div key={i} style={{ padding: "12px 14px", borderBottom: "1px solid #f0eeea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0A0A0A" }}>{i+1}. {p.nome}</div>
              <div style={{ fontSize: 11, color: "#6A6A6A" }}>{p.bairro} · {p.cidade}/{p.uf}</div>
            </div>
            <span style={{ background: "#7A1F2B", color: "#fff", fontFamily: "Oswald, sans-serif", fontSize: 11, padding: "3px 8px", borderRadius: 999 }}>{p.distancia}</span>
          </div>
        ))}
      </div>
      <div style={{ background: "linear-gradient(135deg, #e8eef2, #d6e0e8)", borderRadius: 4, position: "relative", minHeight: 460, border: "1px solid #c5d0d8" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#c5d0d8 1px, transparent 1px), linear-gradient(90deg, #c5d0d8 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: .55 }} />
        {[{t:"24%",l:"38%"},{t:"48%",l:"58%"},{t:"38%",l:"22%"},{t:"66%",l:"46%"}].map((pos,i) => (
          <div key={i} style={{ position: "absolute", top: pos.t, left: pos.l, width: 30, height: 30, borderRadius: "50% 50% 50% 0", background: "#7A1F2B", transform: "rotate(-45deg)", boxShadow: "0 4px 10px rgba(0,0,0,.25)", display: "grid", placeItems: "center" }}>
            <span style={{ color: "#fff", fontFamily: "Oswald, sans-serif", fontSize: 12, transform: "rotate(45deg)" }}>{i+1}</span>
          </div>
        ))}
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "rgba(10,10,10,.82)", color: "#fff", padding: "8px 12px", fontSize: 11, fontFamily: "Oswald, sans-serif", letterSpacing: ".10em" }}>RAIO 50 KM · 47 PROFISSIONAIS NO MAPA</div>
      </div>
    </div>
  );
}

// ───────────────────────────── 03 · Dark Tactical ─────────────────────────────
function M03() {
  return (
    <div style={{ background: "#0A0A0A", color: "#e6e6e6", padding: 22, fontFamily: "'JetBrains Mono', monospace", borderRadius: 4 }}>
      <div style={{ fontSize: 11, color: "#D6A64B", letterSpacing: ".24em" }}># PF_CREDENCIAMENTO --tipo=psico --uf=SP --raio=50km</div>
      <div style={{ fontSize: 22, fontFamily: "Oswald, sans-serif", letterSpacing: ".08em", margin: "10px 0 18px", color: "#fff" }}>AGENDAR EXAME — 47 RESULTADOS</div>
      <div style={{ border: "1px solid #1f1f1f", borderRadius: 3 }}>
        {MOCK.slice(0,5).map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 1fr 100px 110px", padding: "12px 14px", borderBottom: i<4 ? "1px solid #1f1f1f" : 0, fontSize: 12, alignItems: "center" }}>
            <span style={{ color: "#D6A64B" }}>{String(i+1).padStart(2,"0")}</span>
            <div>
              <div style={{ color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: ".04em", fontSize: 13 }}>{p.nome}</div>
              <div style={{ color: "#888" }}>{p.registro} · {p.bairro}, {p.cidade}/{p.uf}</div>
            </div>
            <span style={{ color: "#7fc28a" }}>● ATIVO</span>
            <span style={{ color: "#D6A64B", textAlign: "right", fontFamily: "Oswald, sans-serif", letterSpacing: ".08em" }}>{p.distancia}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, color: "#666", fontSize: 11 }}>$ sync_status=OK · last_update=hoje 03:30 · source=gov.br/PF</div>
    </div>
  );
}

// ───────────────────────────── 04 · Card Grid ─────────────────────────────
function M04() {
  return (
    <div style={{ background: "#f6f5f1", padding: 18, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {MOCK.map((p, i) => {
          const inicial = p.nome.replace("DRA. ","").replace("DR. ","")[0];
          return (
            <div key={i} style={{ background: "#fff", border: "1px solid #e3e3e1", borderRadius: 6, padding: 14, position: "relative" }}>
              <div style={{ position: "absolute", top: -10, right: 12, background: "#7A1F2B", color: "#fff", fontFamily: "Oswald, sans-serif", fontSize: 11, padding: "3px 9px", letterSpacing: ".10em" }}>{p.distancia}</div>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#7A1F2B,#3a0d12)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "Oswald, sans-serif", fontSize: 20 }}>{inicial}</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 10, color: "#0A0A0A" }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 2 }}>{p.registro}</div>
              <div style={{ fontSize: 11, color: "#303030", marginTop: 8, lineHeight: 1.4 }}>{p.bairro} · {p.cidade}/{p.uf}</div>
              <button style={{ width: "100%", marginTop: 12, background: "#0A0A0A", color: "#fff", border: 0, padding: "8px 0", fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".14em", cursor: "pointer" }}>AGENDAR</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────── 05 · Timeline ─────────────────────────────
function M05() {
  return (
    <div style={{ background: "#fff", padding: 22, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "relative", paddingLeft: 32 }}>
        <div style={{ position: "absolute", left: 12, top: 8, bottom: 8, width: 2, background: "#7A1F2B" }} />
        {MOCK.slice(0,4).map((p, i) => (
          <div key={i} style={{ position: "relative", marginBottom: 18 }}>
            <div style={{ position: "absolute", left: -26, top: 4, width: 26, height: 26, borderRadius: "50%", background: "#7A1F2B", color: "#fff", display: "grid", placeItems: "center", fontFamily: "Oswald, sans-serif", fontSize: 12 }}>{i+1}</div>
            <div style={{ background: "#f6f5f1", border: "1px solid #e3e3e1", padding: 14, borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".06em", color: "#0A0A0A" }}>{p.nome}</div>
                <div style={{ fontFamily: "Oswald, sans-serif", color: "#7A1F2B" }}>{p.distancia}</div>
              </div>
              <div style={{ fontSize: 12, color: "#6A6A6A", marginTop: 4 }}>{p.endereco} · {p.bairro} · {p.cidade}/{p.uf}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 11 }}>
                <span style={{ background: "#e8efe6", color: "#2b5d2b", padding: "2px 8px", borderRadius: 999 }}>Vigente até {p.validade}</span>
                <span style={{ color: "#6A6A6A" }}>☎ {p.telefone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 06 · Swiss minimal ─────────────────────────────
function M06() {
  return (
    <div style={{ background: "#fff", padding: 26, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#0A0A0A" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 30, borderBottom: "2px solid #0A0A0A", paddingBottom: 12 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".18em", color: "#6A6A6A" }}>§ 04 · PF</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 300, letterSpacing: "-.01em" }}>Profissionais credenciados</h1>
      </div>
      {MOCK.slice(0,4).map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 110px", gap: 12, padding: "14px 0", borderBottom: "1px solid #ececec", alignItems: "baseline" }}>
          <div style={{ fontSize: 11, color: "#6A6A6A" }}>{String(i+1).padStart(3,"0")}</div>
          <div style={{ fontSize: 14 }}>{p.nome}<div style={{ color: "#6A6A6A", fontSize: 11 }}>{p.registro}</div></div>
          <div style={{ fontSize: 12, color: "#303030" }}>{p.endereco}<div style={{ color: "#6A6A6A" }}>{p.bairro} · {p.cidade}/{p.uf}</div></div>
          <div style={{ textAlign: "right", fontSize: 16, fontWeight: 300 }}>{p.distancia}</div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── 07 · Arsenal Bold ─────────────────────────────
function M07() {
  return (
    <div style={{ background: "#0A0A0A", padding: 22, fontFamily: "Oswald, sans-serif", color: "#fff", borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #7A1F2B", paddingBottom: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".30em", color: "#7A1F2B" }}>QUERO ARMAS · ARSENAL</div>
          <div style={{ fontSize: 26, letterSpacing: ".06em" }}>AGENDAR EXAME PSICOLÓGICO</div>
        </div>
        <div style={{ fontSize: 11, letterSpacing: ".16em", color: "#aaa" }}>SJC/SP · 50KM</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {MOCK.slice(0,4).map((p, i) => (
          <div key={i} style={{ border: "1px solid #1f1f1f", padding: 14, position: "relative", background: "linear-gradient(135deg, rgba(122,31,43,.16), transparent)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, background: "#7A1F2B", color: "#fff", fontSize: 10, padding: "2px 8px", letterSpacing: ".16em" }}>{String(i+1).padStart(2,"0")}</div>
            <div style={{ marginTop: 12, fontSize: 14, letterSpacing: ".06em" }}>{p.nome}</div>
            <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#9a9a9a", marginTop: 4 }}>{p.endereco}, {p.bairro}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 18, color: "#D6A64B" }}>{p.distancia}</span>
              <button style={{ background: "#7A1F2B", color: "#fff", border: 0, padding: "6px 12px", fontFamily: "Oswald, sans-serif", letterSpacing: ".18em", fontSize: 10 }}>CONTATAR ›</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 08 · Dossier Table ─────────────────────────────
function M08() {
  return (
    <div style={{ background: "#fafaf7", padding: 22, fontFamily: "'Courier New', monospace", color: "#0A0A0A" }}>
      <div style={{ borderBottom: "1px solid #0A0A0A", paddingBottom: 8, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
        <strong style={{ letterSpacing: ".18em" }}>DOSSIÊ — CREDENCIAMENTO PF/SP</strong>
        <span style={{ fontSize: 11 }}>FOLHA 01/05 · CONFIDENCIAL</span>
      </div>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#0A0A0A", color: "#fff", letterSpacing: ".10em" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>#</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>PROFISSIONAL</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>REGISTRO</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>LOCAL</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>DIST.</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>VALIDADE</th>
          </tr>
        </thead>
        <tbody>
          {MOCK.map((p,i) => (
            <tr key={i} style={{ borderBottom: "1px dashed #c4c4c0", background: i%2 ? "#f0eeea" : "transparent" }}>
              <td style={{ padding: "6px 8px" }}>{String(i+1).padStart(2,"0")}</td>
              <td style={{ padding: "6px 8px" }}>{p.nome}</td>
              <td style={{ padding: "6px 8px" }}>{p.registro}</td>
              <td style={{ padding: "6px 8px" }}>{p.bairro} · {p.cidade}/{p.uf}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#7A1F2B", fontWeight: 700 }}>{p.distancia}</td>
              <td style={{ padding: "6px 8px" }}>{p.validade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────── 09 · Mobile Bento ─────────────────────────────
function M09() {
  return (
    <div style={{ background: "#f6f5f1", padding: 22 }}>
      <div style={{ maxWidth: 380, margin: "0 auto", background: "#fff", borderRadius: 22, padding: 18, boxShadow: "0 8px 30px rgba(0,0,0,.10)", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button style={{ border: 0, background: "transparent", fontSize: 18 }}>←</button>
          <strong style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".10em", fontSize: 13 }}>AGENDAR EXAME</strong>
          <span style={{ width: 18 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: "#7A1F2B", color: "#fff", padding: 12, borderRadius: 12, fontFamily: "Oswald, sans-serif" }}>🧠 PSICÓLOGO</div>
          <div style={{ background: "#0A0A0A", color: "#fff", padding: 12, borderRadius: 12, fontFamily: "Oswald, sans-serif" }}>🎯 TIRO</div>
        </div>
        <div style={{ background: "#0A0A0A", color: "#fff", borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#D6A64B", letterSpacing: ".16em" }}>MAIS PRÓXIMO</div>
          <div style={{ fontFamily: "Oswald, sans-serif", marginTop: 4, fontSize: 16 }}>{MOCK[0].nome}</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>{MOCK[0].bairro} · {MOCK[0].distancia}</div>
          <button style={{ marginTop: 10, background: "#D6A64B", color: "#0A0A0A", border: 0, padding: "8px 14px", borderRadius: 999, fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11 }}>LIGAR AGORA</button>
        </div>
        {MOCK.slice(1,4).map((p,i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #f0eeea" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: "#6A6A6A" }}>{p.bairro}</div>
            </div>
            <span style={{ background: "#f0e6e7", color: "#7A1F2B", padding: "3px 10px", borderRadius: 999, fontFamily: "Oswald, sans-serif", fontSize: 11 }}>{p.distancia}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── 10 · Wizard Clínico ─────────────────────────────
function M10() {
  return (
    <div style={{ background: "#fff", padding: 22, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {["Tipo","Localização","Profissional","Confirmação"].map((s,i) => (
          <div key={s} style={{ flex: 1, padding: "8px 10px", borderBottom: `3px solid ${i===2?"#7A1F2B":"#e3e3e1"}`, fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".12em", color: i<=2?"#0A0A0A":"#bbb" }}>
            <span style={{ color: "#7A1F2B" }}>0{i+1}</span> · {s.toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18 }}>
        <aside style={{ background: "#f6f5f1", border: "1px solid #e3e3e1", padding: 14, borderRadius: 4, fontSize: 12 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11, color: "#6A6A6A" }}>FILTROS</div>
          <div style={{ marginTop: 10 }}>CEP <strong>12.309-000</strong></div>
          <div style={{ marginTop: 6 }}>Raio <strong>50 km</strong></div>
          <div style={{ marginTop: 6 }}>Vencidos <strong>ocultos</strong></div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #d6d6d4", color: "#6A6A6A" }}>47 profissionais ativos<br/>3 cidades</div>
        </aside>
        <div>
          {MOCK.slice(0,3).map((p,i) => (
            <label key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr 90px", gap: 12, padding: 14, border: "1px solid #e3e3e1", borderLeft: i===0?"4px solid #7A1F2B":"1px solid #e3e3e1", borderRadius: 4, marginBottom: 8, cursor: "pointer", background: i===0?"#fffaf3":"#fff" }}>
              <input type="radio" name="prof" defaultChecked={i===0} style={{ marginTop: 4 }} />
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".06em" }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: "#6A6A6A" }}>{p.endereco} · {p.bairro}</div>
                <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 4 }}>☎ {p.telefone} · válido até {p.validade}</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "Oswald, sans-serif", color: "#7A1F2B", fontSize: 18 }}>{p.distancia}</div>
            </label>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button style={{ background: "transparent", border: "1px solid #d6d6d4", padding: "8px 14px", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11 }}>VOLTAR</button>
            <button style={{ background: "#7A1F2B", color: "#fff", border: 0, padding: "8px 14px", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", fontSize: 11 }}>CONTINUAR →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCKUPS = [
  { id: 1, titulo: "Editorial Catalog", desc: "Magazine · serif · numerado", bg: "#fafaf7", render: <M01/> },
  { id: 2, titulo: "Map Split", desc: "Lista + mapa interativo", bg: "#f6f5f1", render: <M02/> },
  { id: 3, titulo: "Dark Tactical", desc: "Terminal · mono · operacional", bg: "#0f0f0f", render: <M03/> },
  { id: 4, titulo: "Card Grid", desc: "Cards quadrados · ação direta", bg: "#f6f5f1", render: <M04/> },
  { id: 5, titulo: "Timeline", desc: "Vertical numerada · biográfico", bg: "#fff", render: <M05/> },
  { id: 6, titulo: "Swiss Minimal", desc: "Tipografia · regra · grid", bg: "#fff", render: <M06/> },
  { id: 7, titulo: "Arsenal Bold", desc: "Preto + bordô · agressivo", bg: "#0f0f0f", render: <M07/> },
  { id: 8, titulo: "Dossier Table", desc: "Folha de inteligência · datilografada", bg: "#fafaf7", render: <M08/> },
  { id: 9, titulo: "Mobile Bento", desc: "App-first · cards arredondados", bg: "#f6f5f1", render: <M09/> },
  { id: 10, titulo: "Wizard Clínico", desc: "Steps + filtros · escolha guiada", bg: "#fff", render: <M10/> },
];

export default function QAAgendarExameMockupsPage() {
  const [foco, setFoco] = useState<number | null>(null);
  return (
    <main style={{ background: "#ece9e2", minHeight: "100vh", padding: "32px 18px", fontFamily: "system-ui, sans-serif" }}>
      <div style={wrap}>
        <header style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", letterSpacing: ".30em", fontSize: 11, color: "#7A1F2B" }}>QUERO ARMAS · DESIGN LAB</div>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, letterSpacing: ".06em", color: "#0A0A0A", margin: "6px 0 4px" }}>10 MOCKUPS — AGENDAR EXAME</h1>
          <p style={{ color: "#5a5a5a", fontSize: 13, margin: 0 }}>Cada mockup é uma direção visual diferente, usando dados fictícios. Escolha 1, 2 ou combinações para evoluirmos para a versão final.</p>
        </header>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
          {MOCKUPS.map((m) => (
            <button key={m.id} onClick={() => { setFoco(m.id); document.getElementById(`mockup-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              style={{ background: foco===m.id ? "#7A1F2B" : "#fff", color: foco===m.id ? "#fff" : "#0A0A0A", border: "1px solid #d6d6d4", padding: "6px 11px", fontFamily: "Oswald, sans-serif", letterSpacing: ".10em", fontSize: 11, cursor: "pointer", borderRadius: 999 }}>
              {String(m.id).padStart(2,"0")} · {m.titulo}
            </button>
          ))}
        </nav>

        <div style={{ display: "grid", gap: 26 }}>
          {MOCKUPS.map((m) => (
            <MockupShell key={m.id} id={m.id} titulo={m.titulo} descricao={m.desc} bg={m.bg}>
              {m.render}
            </MockupShell>
          ))}
        </div>

        <p style={{ textAlign: "center", color: "#6A6A6A", fontSize: 12, marginTop: 28 }}>
          Me diga o número do mockup escolhido (ou 2 favoritos) que eu aplico na tela real.
        </p>
      </div>
    </main>
  );
}