import { BadgeCheck, FlaskConical, Gauge, Scale, Sparkles } from "lucide-react";
import ArsenalPremiumBadge from "@/components/quero-armas/portal/ArsenalPremiumBadge";
import recargaHero from "@/assets/recarga-municoes-hero.png.asset.json";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteRecargaMunicoesSection() {
  return (
    <section className="qa-alvo qa-recarga qa-client-summary-print">
      <style>{`
         .qa-alvo{--paper:#f3f3f2;--card:#ffffff;--ink:#0A0A0A;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;font-family:'Arial Narrow',Arial,sans-serif;color:var(--ink);text-transform:none;letter-spacing:0;padding:0;display:flex;flex-direction:column;min-height:calc(100vh - 140px)}
        .qa-alvo__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;flex-shrink:0}
        .qa-alvo__head-main{min-width:0;flex:1}
        .qa-alvo__kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.24em;color:var(--muted);text-transform:uppercase;margin-bottom:8px}
        .qa-alvo__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo)}
        .qa-alvo h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.06;margin:0;letter-spacing:.03em;color:var(--ink);text-transform:uppercase;text-wrap:balance}
        .qa-alvo__lead{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:var(--muted);margin:8px 0 0;max-width:640px;text-wrap:pretty}
        .qa-alvo__grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:22px;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:24px;box-shadow:0 6px 14px rgba(17,17,17,.04);flex:1;min-height:0;align-items:stretch}
        .qa-alvo__target{position:relative;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid var(--line);border-radius:3px;padding:0;min-height:0;height:100%;overflow:hidden}
        .qa-recarga__hero{width:100%;height:100%;max-width:none;object-fit:cover;display:block}
        .qa-alvo__body{display:flex;flex-direction:column;gap:16px;min-width:0;justify-content:center}
        .qa-alvo__h2{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;line-height:1.15;margin:0;color:#0c0c0c;letter-spacing:-.01em}
        .qa-alvo__p{font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .qa-alvo__card{border:1px solid var(--line);background:#fafafa;border-radius:3px;padding:14px 16px;display:grid;grid-template-columns:20px 1fr;gap:12px;align-items:start;min-height:80px}
        .qa-alvo__card svg{width:16px;height:16px;color:var(--ink);margin-top:2px}
        .qa-alvo__card-t{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.18em;color:var(--ink);text-transform:uppercase;line-height:1.1}
        .qa-alvo__card-d{font-family:Arial,sans-serif;font-size:12px;line-height:1.35;color:var(--muted);margin-top:3px}
        .qa-alvo__note{border:1px solid rgba(122,31,43,.25);background:#fff;border-radius:3px;padding:14px 16px;margin-top:2px}
        .qa-alvo__note-k{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;color:var(--bordo);text-transform:uppercase;margin-bottom:4px}
        .qa-alvo__note-p{font-family:Arial,sans-serif;font-size:12px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__note-legal{font-family:Arial,sans-serif;font-size:11px;line-height:1.35;color:#8a8a8a;margin:8px 0 0}
        @media (max-width:900px){.qa-alvo__grid{grid-template-columns:1fr;padding:16px}.qa-alvo__target{min-height:260px;height:auto}.qa-alvo__cards{grid-template-columns:1fr}.qa-alvo h1{font-size:23px}}
      `}</style>

      <div className="qa-alvo__head">
        <div className="qa-alvo__head-main">
          <div className="qa-alvo__kicker"><span className="qa-alvo__dot" />Recarga de Munições</div>
          <h1>Sua munição, calibrada por nós</h1>
          <p className="qa-alvo__lead">
            Em breve, o Arsenal Inteligente orienta cada etapa da recarga, do preparo do estojo à
            aferição do disparo, com segurança, consistência e economia por cartucho.
          </p>
        </div>
        <ArsenalPremiumBadge />
      </div>

      <div className="qa-alvo__grid">
        <div className="qa-alvo__target">
          <img src={recargaHero.url} alt="Componentes de recarga: pólvora, estojo, espoletas e projéteis" className="qa-recarga__hero" />
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
