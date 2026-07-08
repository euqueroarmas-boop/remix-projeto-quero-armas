import { BadgeCheck, FlaskConical, Gauge, Lock, Scale, Sparkles } from "lucide-react";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteRecargaMunicoesSection() {
  return (
    <section className="qa-alvo qa-recarga qa-client-summary-print">
      <style>{`
        .qa-alvo{--paper:#f3f3f2;--card:#ffffff;--ink:#0A0A0A;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;font-family:'Arial Narrow',Arial,sans-serif;color:var(--ink);text-transform:none;letter-spacing:0;padding:0}
        .qa-alvo__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
        .qa-alvo__kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.24em;color:var(--muted);text-transform:uppercase;margin-bottom:8px}
        .qa-alvo__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo)}
        .qa-alvo h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.05;margin:0;letter-spacing:.03em;color:var(--ink);text-transform:uppercase}
        .qa-alvo__lead{font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:var(--muted);margin:8px 0 0;max-width:640px}
        .qa-alvo__badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--bordo);background:#fff;color:var(--bordo);font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;padding:7px 12px;border-radius:999px;text-transform:uppercase;white-space:nowrap}
        .qa-alvo__grid{display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr);gap:18px;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:20px;box-shadow:0 6px 14px rgba(17,17,17,.04)}
        .qa-alvo__target{position:relative;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid var(--line);border-radius:3px;padding:16px;min-height:300px}
        .qa-recarga__cart{position:relative;width:100%;max-width:220px;aspect-ratio:1/2.1;display:flex;flex-direction:column;align-items:center}
        .qa-recarga__bullet{width:70%;aspect-ratio:1/1;border-radius:50% 50% 45% 45%/60% 60% 40% 40%;background:linear-gradient(180deg,#d9b26a 0%,#a67c2a 60%,#7a5a1e 100%);border:1px solid #7a5a1e;box-shadow:inset 0 -6px 10px rgba(0,0,0,.25)}
        .qa-recarga__case{width:88%;flex:1;margin-top:-6px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#c9a24a 0%,#a4801f 55%,#7a5a1e 100%);border:1px solid #7a5a1e;position:relative;box-shadow:inset 0 -8px 14px rgba(0,0,0,.28), inset 4px 0 8px rgba(0,0,0,.15)}
        .qa-recarga__case::before{content:"";position:absolute;left:0;right:0;top:38%;height:1px;background:rgba(0,0,0,.22)}
        .qa-recarga__case::after{content:"";position:absolute;left:50%;bottom:6px;width:22%;aspect-ratio:1/1;transform:translateX(-50%);border-radius:999px;background:#5c4415;border:1px solid #3d2d0e}
        .qa-alvo__body{display:flex;flex-direction:column;gap:12px;min-width:0}
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
          <div className="qa-alvo__kicker"><span className="qa-alvo__dot" />Recarga de Munições</div>
          <h1>Sua Munição, Calibrada por Nós</h1>
          <p className="qa-alvo__lead">
            Em breve, o Arsenal Inteligente vai te orientar em cada etapa da recarga — do preparo do estojo à aferição do disparo — com segurança, consistência e economia.
          </p>
        </div>
        <div className="qa-alvo__badge"><Lock className="h-3 w-3" />Arsenal Premium</div>
      </div>

      <div className="qa-alvo__grid">
        <div className="qa-alvo__target">
          <div className="qa-recarga__cart" aria-hidden="true">
            <div className="qa-recarga__bullet" />
            <div className="qa-recarga__case" />
          </div>
        </div>

        <div className="qa-alvo__body">
          <div className="qa-alvo__kicker" style={{ marginBottom: 0 }}>
            <Sparkles className="h-3 w-3" />Em construção
          </div>
          <h2 className="qa-alvo__h2">Você vai recarregar com precisão, segurança e rastreabilidade.</h2>
          <p className="qa-alvo__p">
            Vamos te orientar em cada passo da recarga: seleção e preparo do estojo, escolha do projétil, dosagem correta do propelente, prensagem, crimpagem e verificação final — respeitando as normas do Exército e a legislação vigente para o CAC habilitado.
          </p>

          <div className="qa-alvo__cards">
            {[
              { icon: Scale, title: "Dosagem", text: "Peso do propelente com margem de segurança por calibre." },
              { icon: Gauge, title: "Pressão", text: "Controle de pressão e velocidade dentro da faixa CIP/SAAMI." },
              { icon: FlaskConical, title: "Componentes", text: "Estojo, espoleta, propelente e projétil compatíveis." },
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
              Recurso exclusivo do Arsenal Inteligente Premium. Base técnica treinada por instrutor CTT/CBC — Centro Técnico de Treinamento da Companhia Brasileira de Cartuchos — e por profissionais que dominam recarga segura, rastreável e dentro da lei.
            </p>
            <p className="qa-alvo__note-legal">Base normativa: {legalBase}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
