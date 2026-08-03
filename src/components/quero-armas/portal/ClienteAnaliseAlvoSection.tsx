import { BadgeCheck, Crosshair, Sparkles, Target, Zap } from "lucide-react";
import ArsenalPremiumBadge from "@/components/quero-armas/portal/ArsenalPremiumBadge";
import alvoHumanoide from "@/assets/alvo-humanoide-palco.jpg.asset.json";

const legalBase = "Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e IN DG/PF 311";

export default function ClienteAnaliseAlvoSection() {
  return (
    <section className="qa-alvo qa-client-summary-print">
      <style>{`
        .qa-alvo{--paper:#f3f3f2;--card:#ffffff;--ink:#0A0A0A;--muted:#6A6A6A;--line:#e3e3e1;--bordo:#7A1F2B;font-family:'Arial Narrow',Arial,sans-serif;color:var(--ink);text-transform:none;letter-spacing:0;padding:0;display:flex;flex-direction:column;min-height:calc(100vh - 140px)}
        .qa-alvo__head{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
        .qa-alvo__row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
        .qa-alvo__head-main{min-width:0}
        .qa-alvo__badge-slot{flex-shrink:0;position:static;z-index:2}
        .qa-alvo__kicker{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.24em;color:var(--muted);text-transform:uppercase;margin:0;padding-right:0}
        .qa-alvo__dot{width:7px;height:7px;border-radius:999px;background:var(--bordo)}
        .qa-alvo h1{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-weight:700;font-size:22px;line-height:1.06;margin:8px 0 0;letter-spacing:.01em;color:var(--ink);text-transform:uppercase;white-space:nowrap}
        .qa-alvo__lead{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:var(--muted);margin:8px 0 0;max-width:none;width:100%;text-wrap:pretty}
        .qa-alvo__grid{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:18px;background:var(--card);border:1px solid var(--line);border-radius:3px;padding:20px;box-shadow:0 6px 14px rgba(17,17,17,.04);flex:1;min-height:0;align-items:stretch}
        .qa-alvo__target{position:relative;display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-radius:3px;padding:0;min-height:300px;height:100%;overflow:hidden}
        .qa-alvo__figure{position:relative;height:100%;max-height:520px;display:block}
        .qa-alvo__figure img{height:100%;width:auto;max-width:100%;display:block;object-fit:contain}
        /* Furo de projétil: cratera irregular + fuligem/anel de graxa ao redor */
        .qa-alvo__hit{isolation:isolate;position:absolute;width:13px;height:13px;transform:translate(-50%,-50%);border-radius:52% 48% 55% 45%/48% 55% 45% 52%;background:radial-gradient(circle at 42% 40%,#000 0 46%,#0d0d0d 62%,#2a2a2a 78%,rgba(60,60,60,.55) 100%);box-shadow:0 0 0 1px rgba(40,40,40,.55),0 0 5px 2px rgba(0,0,0,.28)}
        .qa-alvo__hit::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,.30) 0 32%,rgba(0,0,0,.14) 52%,rgba(0,0,0,0) 74%);filter:blur(1.6px);z-index:-1}
        .qa-alvo__hit::after{content:"";position:absolute;inset:1.5px;border-radius:46% 54% 42% 58%/56% 44% 58% 42%;background:#000;box-shadow:inset 0 0 2px 1px rgba(0,0,0,.9)}
        .qa-alvo__hit.sm{width:9px;height:9px}
        .qa-alvo__hit:nth-of-type(2n){transform:translate(-50%,-50%) rotate(38deg)}
        .qa-alvo__hit:nth-of-type(3n){transform:translate(-50%,-50%) rotate(-27deg) scale(1.06)}
        .qa-alvo__hit:nth-of-type(5n){transform:translate(-50%,-50%) rotate(72deg) scale(.94)}
        .qa-alvo__body{display:flex;flex-direction:column;gap:16px;min-width:0;justify-content:center}
        .qa-alvo__h2{font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:18px;line-height:1.15;margin:0;color:#0c0c0c;letter-spacing:-.01em}
        .qa-alvo__p{font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .qa-alvo__card{border:1px solid var(--line);background:#fafafa;border-radius:3px;padding:14px 16px;display:grid;grid-template-columns:16px 1fr;gap:14px;align-items:start;min-height:80px}
        .qa-alvo__card svg{width:14px;height:14px;color:var(--ink);margin-top:2px}
        .qa-alvo__card-t{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.18em;color:var(--ink);text-transform:uppercase;line-height:1.1}
        .qa-alvo__card-d{font-family:Arial,sans-serif;font-size:12px;line-height:1.35;color:var(--muted);margin-top:3px}
        .qa-alvo__note{border:1px solid rgba(122,31,43,.25);background:#fff;border-radius:3px;padding:12px 14px;margin-top:2px}
        .qa-alvo__note-k{font-family:Oswald,'Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:.22em;color:var(--bordo);text-transform:uppercase;margin-bottom:4px}
        .qa-alvo__note-p{font-family:Arial,sans-serif;font-size:12px;line-height:1.45;color:#4a4a4a;margin:0}
        .qa-alvo__note-legal{font-family:Arial,sans-serif;font-size:11px;line-height:1.35;color:#8a8a8a;margin:8px 0 0}
        @media (max-width:900px){.qa-alvo__grid{grid-template-columns:1fr;padding:14px}.qa-alvo__target{min-height:340px}.qa-alvo__figure{max-height:400px}.qa-alvo__cards{grid-template-columns:1fr}.qa-alvo__kicker{padding-right:0}}
      `}</style>

      <div className="qa-alvo__head">
        <div className="qa-alvo__row">
          <div className="qa-alvo__kicker"><span className="qa-alvo__dot" />Análise de Alvo</div>
          <div className="qa-alvo__badge-slot"><ArsenalPremiumBadge /></div>
        </div>
        <div className="qa-alvo__head-main">
          <h1>Seu disparo, explicado por nós</h1>
          <p className="qa-alvo__lead">
            Fotografe o alvo ao fim do treino e o Arsenal Inteligente lê o agrupamento por você:
            mede a dispersão, identifica o desvio dominante e devolve, em segundos, o que corrigir
            no próximo carregador — em linguagem de instrutor, sem achismo.
          </p>
        </div>
      </div>

      <div className="qa-alvo__grid">
        <div className="qa-alvo__target">
          <div className="qa-alvo__figure">
            <img src={alvoHumanoide.url} alt="Alvo humanoide de treinamento com impactos agrupados na região central do tórax" />
            {/* Impactos na obreia central do tórax e no entorno imediato */}
            <div className="qa-alvo__hit" style={{ left: "48.4%", top: "39.2%" }} />
            <div className="qa-alvo__hit" style={{ left: "44.9%", top: "36.9%" }} />
            <div className="qa-alvo__hit sm" style={{ left: "52.1%", top: "36.4%" }} />
            <div className="qa-alvo__hit" style={{ left: "50.6%", top: "42.6%" }} />
            <div className="qa-alvo__hit sm" style={{ left: "43.6%", top: "42.1%" }} />
            <div className="qa-alvo__hit sm" style={{ left: "54.0%", top: "40.8%" }} />
            <div className="qa-alvo__hit" style={{ left: "46.6%", top: "45.3%" }} />
            <div className="qa-alvo__hit sm" style={{ left: "56.4%", top: "33.6%" }} />
            <div className="qa-alvo__hit sm" style={{ left: "41.4%", top: "48.4%" }} />
          </div>
        </div>

        <div className="qa-alvo__body">
          <div className="qa-alvo__kicker" style={{ marginBottom: 0 }}>
            <Sparkles className="h-3 w-3" />Em construção
          </div>
          <h2 className="qa-alvo__h2">Você vai saber exatamente o que melhorar no próximo treino.</h2>
          <p className="qa-alvo__p">
            Cada grupamento conta uma história. Impacto baixo à esquerda costuma ser antecipação de recuo;
            disparos altos denunciam empunhadura frouxa; dispersão vertical aponta respiração e cadência.
            O módulo cruza a posição dos furos com distância, calibre e arma utilizada e devolve um
            diagnóstico objetivo — postura, empunhadura, visada, acionamento do gatilho e follow-through.
          </p>
          <p className="qa-alvo__p">
            Todo treino fica registrado no seu histórico e alimenta a habitualidade: você acompanha a
            evolução do agrupamento sessão após sessão, com metas de precisão por distância e um plano
            de correção que evolui junto com você.
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
