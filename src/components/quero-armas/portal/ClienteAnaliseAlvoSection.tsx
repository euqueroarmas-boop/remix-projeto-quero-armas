import { BadgeCheck, Crosshair, Lock, Sparkles, Target, Zap } from "lucide-react";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteAnaliseAlvoSection() {
  return (
    <section className="qa-alvo qa-client-summary-print">
      <style>{`
        .qa-alvo{--paper:#f3f3f2;--card:#ffffff;--ink:#0A0A0A;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;font-family:'Arial Narrow',Arial,sans-serif;color:var(--ink);text-transform:none;letter-spacing:0;padding:0;display:flex;flex-direction:column;min-height:calc(100vh - 140px)}
        .qa-alvo__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
        .qa-alvo__kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.24em;color:var(--muted);text-transform:uppercase;margin-bottom:8px}
        .qa-alvo__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo)}
        .qa-alvo h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.05;margin:0;letter-spacing:.03em;color:var(--ink);text-transform:uppercase}
        .qa-alvo__lead{font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:var(--muted);margin:8px 0 0;max-width:640px}
        .qa-alvo__badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bordo);background:#fff;color:var(--bordo);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:7px 12px;border-radius:999px;text-transform:uppercase;white-space:nowrap}
        .qa-alvo__grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:18px;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:20px;box-shadow:0 6px 14px rgba(17,17,17,.04);flex:1;min-height:0;align-items:stretch}
        .qa-alvo__target{position:relative;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid var(--line);border-radius:3px;padding:0;min-height:300px;height:100%;overflow:hidden}
        .qa-alvo__ring{position:relative;aspect-ratio:1/1;width:100%;max-width:none;border-radius:999px;border:1px solid var(--line);background:radial-gradient(circle,#fff 0 36%,#f2f2f0 37% 39%,#fff 40% 54%,#f2f2f0 55% 57%,#fff 58% 100%)}
        .qa-alvo__ring::before,.qa-alvo__ring::after{content:"";position:absolute;background:#e0e0dd}
        .qa-alvo__ring::before{left:50%;top:0;bottom:0;width:1px;transform:translateX(-50%)}
        .qa-alvo__ring::after{top:50%;left:0;right:0;height:1px;transform:translateY(-50%)}
        .qa-alvo__bulls{position:absolute;inset:36%;border-radius:999px;background:var(--bordo)}
        .qa-alvo__hit{position:absolute;width:16px;height:16px;border-radius:999px;background:#fff;border:3px solid var(--bordo)}
        .qa-alvo__body{display:flex;flex-direction:column;gap:16px;min-width:0;justify-content:center}
        .qa-alvo__h2{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;line-height:1.15;margin:0;color:#0c0c0c;letter-spacing:-.01em}
        .qa-alvo__p{font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .qa-alvo__card{border:1px solid var(--line);background:#fafafa;border-radius:3px;padding:10px 12px;display:grid;grid-template-columns:16px 1fr;gap:10px;align-items:start;min-height:68px}
        .qa-alvo__card svg{width:14px;height:14px;color:var(--ink);margin-top:2px}
        .qa-alvo__card-t{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.18em;color:var(--ink);text-transform:uppercase;line-height:1.1}
        .qa-alvo__card-d{font-family:Arial,sans-serif;font-size:12px;line-height:1.35;color:var(--muted);margin-top:3px}
        .qa-alvo__note{border:1px solid rgba(122,31,43,.25);background:#fff;border-radius:3px;padding:12px 14px;margin-top:2px}
        .qa-alvo__note-k{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;color:var(--bordo);text-transform:uppercase;margin-bottom:4px}
        .qa-alvo__note-p{font-family:Arial,sans-serif;font-size:12px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__note-legal{font-family:Arial,sans-serif;font-size:11px;line-height:1.35;color:#8a8a8a;margin:8px 0 0}
        @media (max-width:900px){.qa-alvo__grid{grid-template-columns:1fr}.qa-alvo__target{min-height:220px}.qa-alvo__cards{grid-template-columns:1fr}}
      `}</style>

      <div className="qa-alvo__head">
        <div>
          <div className="qa-alvo__kicker"><span className="qa-alvo__dot" />Análise de Alvo</div>
          <h1>Seu Disparo, Explicado por Nós</h1>
          <p className="qa-alvo__lead">
            Em breve, o Arsenal Inteligente analisará seus alvos e apontará correções pontuais para você evoluir com precisão, consistência e segurança.
          </p>
        </div>
        <div className="qa-alvo__badge"><Lock className="h-3 w-3" />Arsenal Premium</div>
      </div>

      <div className="qa-alvo__grid">
        <div className="qa-alvo__target">
          <div className="qa-alvo__ring">
            <div className="qa-alvo__bulls" />
            <div className="qa-alvo__hit" style={{ left: "58%", top: "42%" }} />
            <div className="qa-alvo__hit" style={{ left: "53%", top: "49%" }} />
            <div className="qa-alvo__hit" style={{ left: "62%", top: "53%" }} />
            <div className="qa-alvo__hit" style={{ left: "47%", top: "45%" }} />
          </div>
        </div>

        <div className="qa-alvo__body">
          <div className="qa-alvo__kicker" style={{ marginBottom: 0 }}>
            <Sparkles className="h-3 w-3" />Em construção
          </div>
          <h2 className="qa-alvo__h2">Você vai saber exatamente o que melhorar no próximo treino.</h2>
          <p className="qa-alvo__p">
            Analisaremos seus alvos, interpretaremos a dispersão dos impactos e transformaremos cada sessão em orientações objetivas: postura, empunhadura, visada, acionamento de gatilho, controle de recuo e repetição do fundamento.
          </p>

          <div className="qa-alvo__cards">
            {[
              { icon: Target, title: "Agrupamento", text: "Tendência dos impactos e perda de consistência." },
              { icon: Crosshair, title: "Correção Pontual", text: "Ajuste prático para o próximo disparo." },
              { icon: Zap, title: "Evolução", text: "Compara treinos e mede ganho real de precisão." },
              { icon: BadgeCheck, title: "Instrução Premium", text: "Conteúdo por instrutor CTT/CBC." },
            ].map((it) => (
              <div key={it.title} className="qa-alvo__card">
                <it.icon />
                <div>
                  <div className="qa-alvo__card-t">{it.title}</div>
                  <div className="qa-alvo__card-d">{it.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="qa-alvo__note">
            <div className="qa-alvo__note-k">Para membros pagantes</div>
            <p className="qa-alvo__note-p">
              Recurso exclusivo do Arsenal Inteligente Premium. Base técnica treinada por instrutor CTT/CBC — Centro Técnico de Treinamento da Companhia Brasileira de Cartuchos — e por profissionais que traduzem fundamento em resultado no alvo.
            </p>
            <p className="qa-alvo__note-legal">Base normativa: {legalBase}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
