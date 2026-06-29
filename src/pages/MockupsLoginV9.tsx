import { useState } from "react";
import { Link } from "react-router-dom";
import logoSrc from "@/assets/quero-armas-logo.png";

/**
 * 10 mockups REAIS em React/HTML usando fotos reais de armas/tiro (Unsplash).
 * Login é sempre pequeno e discreto, com 10 abordagens diferentes.
 * Acesse: /mockups-login-v9  → grid clicável
 *         /mockups-login-v9/1..10 → tela cheia
 */

const LOGO = logoSrc;

// Fotos REAIS (Unsplash) — universo de armas / tiro esportivo
const PHOTOS = [
  "https://images.unsplash.com/photo-1595590424283-b8f17842773f?auto=format&fit=crop&w=2400&q=80", // pistola sobre mesa
  "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=2400&q=80", // estande de tiro
  "https://images.unsplash.com/photo-1567789884554-0b844b597180?auto=format&fit=crop&w=2400&q=80", // revolver detalhe
  "https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=2400&q=80",   // munição
  "https://images.unsplash.com/photo-1595590425676-7e1a8d5ec1b3?auto=format&fit=crop&w=2400&q=80", // case com pistola
  "https://images.unsplash.com/photo-1517759618572-1392f5d0deef?auto=format&fit=crop&w=2400&q=80", // atirador em pé
  "https://images.unsplash.com/photo-1584824388878-cc01cea69cf4?auto=format&fit=crop&w=2400&q=80", // rifle de caça
  "https://images.unsplash.com/photo-1595590424675-c3cd0d8a37a4?auto=format&fit=crop&w=2400&q=80", // pistola e mira
  "https://images.unsplash.com/photo-1584824486516-0555a07fc511?auto=format&fit=crop&w=2400&q=80", // estande low light
  "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=2400&q=80", // ammo macro
];

const ADS = [
  { brand: "GLOCK", headline: "PERFECTION.", tag: "PATROCINADO POR GLOCK BRASIL" },
  { brand: "CBC", headline: "MUNIÇÃO DE COMPETIÇÃO.", tag: "PATROCINADO POR CBC" },
  { brand: "TAURUS", headline: "FORJADA NO BRASIL.", tag: "PATROCINADO POR TAURUS" },
  { brand: "SIG SAUER", headline: "NEVER SETTLE.", tag: "PATROCINADO POR SIG SAUER" },
  { brand: "PELICAN", headline: "INDESTRUTÍVEL.", tag: "PATROCINADO POR PELICAN" },
  { brand: "IMBEL", headline: "TRADIÇÃO MILITAR.", tag: "PATROCINADO POR IMBEL" },
  { brand: "BROWNING", headline: "PRECISÃO ABSOLUTA.", tag: "PATROCINADO POR BROWNING" },
  { brand: "HOLOSUN", headline: "FOCO INSTANTÂNEO.", tag: "PATROCINADO POR HOLOSUN" },
  { brand: "BERETTA", headline: "ITALIAN HERITAGE.", tag: "PATROCINADO POR BERETTA" },
  { brand: "MAGPUL", headline: "ENGINEERED TO ENDURE.", tag: "PATROCINADO POR MAGPUL" },
];

function AdLayer({ idx }: { idx: number }) {
  const photo = PHOTOS[idx % PHOTOS.length];
  const ad = ADS[idx % ADS.length];
  return (
    <>
      <img
        src={photo}
        alt={ad.brand}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-black/70" />
      <div className="absolute left-10 top-10 text-white/60 text-[11px] tracking-[0.3em] font-mono">
        {ad.tag}
      </div>
      <div className="absolute left-10 bottom-12 max-w-xl">
        <div className="text-white/50 text-xs tracking-[0.4em] mb-3">{ad.brand}</div>
        <h1 className="text-white text-5xl md:text-7xl font-black leading-none tracking-tight">
          {ad.headline}
        </h1>
      </div>
    </>
  );
}

function QaLogo({ className = "h-7" }: { className?: string }) {
  return <img src={LOGO} alt="Quero Armas" className={className} />;
}

/* ====================== 10 LOGIN APPROACHES ====================== */

// 1 — Faixa vertical fina à direita
function Login01() {
  return (
    <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[280px] rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 p-5 shadow-2xl">
      <div className="flex items-center justify-center mb-4"><QaLogo className="h-6" /></div>
      <div className="text-white/90 text-[11px] tracking-[0.3em] text-center mb-4">ENTRAR</div>
      <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-2" />
      <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-3" />
      <button className="w-full bg-[#B41E2D] hover:bg-[#9A1A26] text-white text-xs font-bold tracking-wider py-2.5 rounded-md">ENTRAR</button>
      <div className="text-center text-white/40 text-[10px] my-3">— OU —</div>
      <button className="w-full border border-white/20 text-white text-xs py-2 rounded-md mb-2">Continuar com Google</button>
      <button className="w-full border border-white/20 text-white text-xs py-2 rounded-md">Continuar com Apple</button>
    </div>
  );
}

// 2 — Barra horizontal slim no rodapé
function Login02() {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-10 w-[720px] max-w-[92vw] rounded-xl bg-black/85 backdrop-blur-md border border-white/10 p-3 flex items-center gap-3 shadow-2xl">
      <QaLogo className="h-8 ml-2" />
      <input placeholder="seu@email.com" className="flex-1 bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40" />
      <input placeholder="Senha" type="password" className="w-32 bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40" />
      <button className="bg-[#B41E2D] hover:bg-[#9A1A26] text-white text-xs font-bold tracking-wider py-2 px-5 rounded-md">ENTRAR</button>
    </div>
  );
}

// 3 — Pílula flutuante (header) + mini card
function Login03() {
  return (
    <div className="absolute right-8 top-8 w-[320px] space-y-3">
      <div className="flex items-center justify-between rounded-full bg-black/85 backdrop-blur-md border border-[#B41E2D]/60 pl-4 pr-1 py-1.5 shadow-xl">
        <QaLogo className="h-6" />
        <button className="bg-[#B41E2D] text-white text-xs font-bold px-4 py-2 rounded-full">ENTRAR →</button>
      </div>
      <div className="rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 p-4 shadow-2xl">
        <div className="text-white/90 text-xs font-bold mb-3">Acesse sua conta</div>
        <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-2" />
        <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-3" />
        <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2 rounded-md">ENTRAR</button>
      </div>
    </div>
  );
}

// 4 — Etiqueta/sticker papel no canto
function Login04() {
  return (
    <div className="absolute left-8 bottom-8 w-[360px] bg-[#f5f0e8] rounded-sm shadow-2xl overflow-hidden flex">
      <div className="w-1.5 bg-[#B41E2D]" />
      <div className="p-5 flex-1">
        <QaLogo className="h-6 mb-3" />
        <div className="text-[11px] tracking-[0.25em] text-black font-bold">ÁREA RESTRITA</div>
        <div className="text-xs text-black/60 mt-1 mb-4">Acesso ao seu painel CAC</div>
        <div className="flex items-center gap-3">
          <button className="bg-black text-[#f5f0e8] text-xs font-bold tracking-wider px-5 py-2 rounded-sm">ENTRAR</button>
          <a className="text-xs text-[#B41E2D] font-bold">Criar conta →</a>
        </div>
      </div>
    </div>
  );
}

// 5 — Top nav + dropdown panel
function Login05() {
  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-16 bg-black/85 backdrop-blur-md border-b-2 border-[#B41E2D] flex items-center px-10">
        <QaLogo className="h-7" />
        <div className="ml-auto flex items-center gap-6 text-white text-xs tracking-wider">
          <span className="font-bold">ENTRAR</span>
          <span className="text-white/40">|</span>
          <span className="text-white/70">CADASTRO</span>
        </div>
      </div>
      <div className="absolute right-10 top-20 w-[300px] rounded-xl bg-black/90 backdrop-blur-md border border-white/10 p-4 shadow-2xl">
        <div className="absolute -top-2 right-20 w-4 h-4 bg-black/90 rotate-45 border-l border-t border-white/10" />
        <div className="text-white text-sm font-bold mb-3">Bem-vindo de volta</div>
        <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-2" />
        <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-3" />
        <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2 rounded-md">ENTRAR</button>
        <div className="text-center text-white/50 text-[11px] mt-3">Esqueceu a senha?</div>
      </div>
    </>
  );
}

// 6 — Modal central pequeno com backdrop
function Login06() {
  return (
    <>
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] rounded-2xl bg-black/90 backdrop-blur-md border border-white/10 p-6 shadow-2xl">
        <div className="flex justify-center mb-3"><QaLogo className="h-8" /></div>
        <div className="text-white text-center font-bold tracking-widest text-sm">BEM-VINDO</div>
        <div className="text-white/50 text-center text-xs mb-5">Acesse sua conta</div>
        <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/40 mb-2" />
        <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/40 mb-3" />
        <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2.5 rounded-md mb-3">ENTRAR</button>
        <div className="flex items-center gap-2 text-white/30 text-[10px] my-3"><div className="flex-1 h-px bg-white/15" />OU<div className="flex-1 h-px bg-white/15" /></div>
        <button className="w-full border border-white/20 text-white text-xs py-2 rounded-md mb-2">Continuar com Google</button>
        <button className="w-full border border-white/20 text-white text-xs py-2 rounded-md">Continuar com Apple</button>
      </div>
    </>
  );
}

// 7 — Badge canto inferior direito com selo vermelho
function Login07() {
  return (
    <div className="absolute right-8 bottom-8 w-[300px] rounded-xl overflow-hidden border-2 border-[#B41E2D] bg-black/90 backdrop-blur-md shadow-2xl">
      <div className="bg-[#B41E2D] text-white text-[10px] tracking-[0.3em] font-bold text-center py-2">ACESSO RESTRITO</div>
      <div className="p-4">
        <div className="flex justify-center mb-3"><QaLogo className="h-6" /></div>
        <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-2" />
        <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-3" />
        <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2 rounded-md mb-3">ENTRAR</button>
        <div className="text-center text-white/40 text-[10px] mb-2">ou continuar com</div>
        <div className="grid grid-cols-2 gap-2">
          <button className="border border-white/20 text-white text-xs py-1.5 rounded-md">Google</button>
          <button className="border border-white/20 text-white text-xs py-1.5 rounded-md">Apple</button>
        </div>
      </div>
    </div>
  );
}

// 8 — Ultra-minimal: pílula topo + faixa branca rodapé
function Login08() {
  return (
    <>
      <div className="absolute top-8 left-10"><QaLogo className="h-9" /></div>
      <div className="absolute top-8 right-10 flex items-center gap-3 bg-black/60 backdrop-blur border border-white/20 rounded-full px-2 py-1.5">
        <span className="text-white text-xs font-bold tracking-wider px-3">ENTRAR</span>
        <span className="w-px h-4 bg-white/30" />
        <span className="text-white/70 text-xs tracking-wider px-3">CADASTRO</span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-10 w-[380px] flex items-center bg-white rounded-full pl-5 pr-1 py-1 shadow-2xl">
        <input placeholder="seu@email.com" className="flex-1 bg-transparent text-sm text-black placeholder:text-black/40 outline-none py-2" />
        <button className="bg-[#B41E2D] text-white text-[11px] font-bold tracking-wider px-5 py-2 rounded-full">CONTINUAR →</button>
      </div>
    </>
  );
}

// 9 — QR Code card
function Login09() {
  return (
    <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[360px] rounded-2xl bg-black/90 backdrop-blur-md border border-white/10 p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <QaLogo className="h-6" />
        <span className="text-white/40 text-[10px]">v2.6</span>
      </div>
      <div className="bg-[#f5f0e8] rounded-lg p-4 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-36 h-36">
          {Array.from({ length: 14 }).map((_, r) =>
            Array.from({ length: 14 }).map((__, c) => {
              const seed = (r * 31 + c * 17) % 7;
              return seed > 2 ? <rect key={`${r}-${c}`} x={c * 7} y={r * 7} width="6" height="6" fill="#0a0a0a" /> : null;
            })
          )}
          {[[0,0],[12,0],[0,12]].map(([x,y],i)=>(
            <g key={i}><rect x={x*7} y={y*7} width="18" height="18" fill="#0a0a0a"/><rect x={x*7+4} y={y*7+4} width="10" height="10" fill="#f5f0e8"/><rect x={x*7+7} y={y*7+7} width="4" height="4" fill="#0a0a0a"/></g>
          ))}
        </svg>
      </div>
      <div className="text-white text-xs font-bold tracking-widest text-center mt-3">ESCANEIE COM O APP</div>
      <div className="text-white/50 text-[11px] text-center mb-3">ou entre com e-mail</div>
      <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2 rounded-md">ENTRAR COM E-MAIL</button>
    </div>
  );
}

// 10 — Notch lateral esquerdo + painel
function Login10() {
  const items = [["⌂","Início"],["→","Entrar"],["+","Cadastro"],["?","Ajuda"]];
  return (
    <>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[90px] h-[480px] rounded-r-2xl bg-black/90 backdrop-blur-md flex flex-col items-center pt-4">
        <div className="w-full bg-[#B41E2D] text-white text-center font-black py-2 text-sm rounded-tr-2xl">QA</div>
        <div className="flex flex-col gap-5 mt-6">
          {items.map(([ic,lbl])=>(
            <div key={lbl} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white">{ic}</div>
              <div className="text-white/60 text-[10px] mt-1">{lbl}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute left-28 top-1/2 -translate-y-1/2 w-[280px] rounded-xl bg-black/90 backdrop-blur-md border border-white/10 p-4 shadow-2xl">
        <QaLogo className="h-6 mb-2" />
        <div className="text-white font-bold text-sm mb-3">Entrar</div>
        <input placeholder="E-mail" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-2" />
        <input placeholder="Senha" type="password" className="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40 mb-3" />
        <button className="w-full bg-[#B41E2D] text-white text-xs font-bold tracking-wider py-2 rounded-md">ENTRAR</button>
        <div className="text-center text-white/50 text-[11px] mt-3">Esqueceu a senha?</div>
      </div>
    </>
  );
}

const VARIANTS = [Login01, Login02, Login03, Login04, Login05, Login06, Login07, Login08, Login09, Login10];
const TITLES = [
  "Faixa vertical à direita","Barra horizontal slim","Pílula + mini card","Etiqueta de papel",
  "Top nav + dropdown","Modal central pequeno","Badge canto + selo","Ultra-minimal",
  "QR Code","Notch lateral esquerdo",
];

function Stage({ idx }: { idx: number }) {
  const Login = VARIANTS[idx];
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <AdLayer idx={idx} />
      <Login />
    </div>
  );
}

export default function MockupsLoginV9() {
  const [active, setActive] = useState<number | null>(null);

  if (active !== null) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <Stage idx={active} />
        <button
          onClick={() => setActive(null)}
          className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur border border-white/20 text-white text-xs font-bold tracking-wider px-4 py-2 rounded-full hover:bg-black"
        >
          ← VOLTAR À GRADE
        </button>
        <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur border border-white/20 text-white text-xs font-bold tracking-wider px-4 py-2 rounded-full">
          v9-{String(active + 1).padStart(2, "0")} · {TITLES[active]}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Mockups Login v9 — HTML/React real</h1>
            <p className="text-white/50 text-sm mt-1">Fotos reais (Unsplash) · 10 abordagens de login pequeno · clique para abrir em tela cheia</p>
          </div>
          <Link to="/" className="text-xs text-white/60 hover:text-white">← Home</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VARIANTS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="group relative aspect-[16/9] rounded-lg overflow-hidden border border-white/10 hover:border-[#B41E2D] transition-colors text-left"
            >
              <Stage idx={i} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 flex items-center justify-between">
                <span className="text-white text-xs font-bold tracking-wider">v9-{String(i + 1).padStart(2, "0")}</span>
                <span className="text-white/80 text-[11px]">{TITLES[i]}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}