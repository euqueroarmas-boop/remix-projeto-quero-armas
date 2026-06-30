import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Crosshair, Shield, ShieldCheck, Star, Briefcase } from "lucide-react";
import logo from "@/assets/quero-armas-logo.png";

/**
 * Tela de login PREMIUM — mockup (rota /mockups-login-v9).
 * Hero fullscreen com foto da bancada tática + card de login flutuante.
 *
 * IMAGEM DE FUNDO: coloque a foto em  public/login-hero.jpg
 * (referenciada por URL, então se faltar o arquivo o fundo tático de
 *  reserva aparece — nunca quebra a tela.)
 *
 * Mockup visual: sem auth real. O login funcional fica em area-do-cliente/login.
 */
const HERO_IMAGE = "/login-hero.jpg";
const OSWALD = "Oswald,'Arial Narrow',Arial,sans-serif";

const CHIPS = [
  { label: "CAC", Icon: Crosshair },
  { label: "Defesa Pessoal", Icon: Shield },
  { label: "Segurança", Icon: ShieldCheck },
  { label: "Colecionador", Icon: Star },
  { label: "Empresa", Icon: Briefcase },
];

export default function QALoginV9MockPage() {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white" style={{ background: "#0a0a0a" }}>
      {/* Fundo tático de reserva (nunca quebra) */}
      <div className="absolute inset-0" aria-hidden style={{ background: "radial-gradient(120% 100% at 28% 38%, #1b1b1b 0%, #0c0c0c 55%, #050505 100%)" }} />
      {/* Foto da bancada */}
      <div className="absolute inset-0 bg-cover bg-center" aria-hidden style={{ backgroundImage: `url('${HERO_IMAGE}')` }} />
      {/* Overlays de legibilidade */}
      <div className="absolute inset-0" aria-hidden style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.66) 100%)" }} />
      <div className="absolute inset-0" aria-hidden style={{ background: "radial-gradient(125% 120% at 50% 50%, transparent 52%, rgba(0,0,0,0.7) 100%)" }} />
      <div className="absolute inset-y-0 right-0 w-[48%] hidden lg:block" aria-hidden style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.6))" }} />

      {/* Conteúdo */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="mx-auto w-full max-w-[1500px] px-6 lg:px-14 py-10 grid lg:grid-cols-2 gap-10 lg:gap-6 items-center">

          {/* ===================== ESQUERDA ===================== */}
          <div className="max-w-[660px]">
            <div className="mb-9">
              <div className="text-[10px] tracking-[0.34em] text-white/45 mb-1.5">PATROCINADO POR</div>
              <div className="text-[28px] lg:text-[34px] font-bold tracking-[0.12em] leading-none" style={{ fontFamily: OSWALD, color: "#E5E5E5" }}>
                TAURUS<span style={{ color: "#B41E2D" }}>®</span>
              </div>
            </div>

            <h1 className="font-bold leading-[0.88]" style={{ fontFamily: OSWALD }}>
              <span className="block text-white text-[58px] lg:text-[96px] tracking-[-0.02em]" style={{ textShadow: "0 4px 30px rgba(0,0,0,0.6)" }}>CONTROLE TOTAL</span>
              <span className="block text-[#B7B7B7] text-[30px] lg:text-[50px] tracking-[-0.01em] mt-1">DOS SEUS DOCUMENTOS</span>
            </h1>

            <div className="mt-7 flex items-stretch gap-3 max-w-md">
              <div className="w-[3px] rounded-full" style={{ background: "#B41E2D" }} />
              <p className="text-[12.5px] tracking-[0.08em] text-white/70 leading-[1.7] uppercase">
                CR, CRAF, Porte, Posse, Guias de Tráfego,<br />Vencimentos e Processos.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {CHIPS.map(({ label, Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85"
                  style={{ border: "1px solid rgba(255,255,255,0.16)", background: "rgba(10,10,10,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                >
                  <Icon size={15} style={{ color: "#B41E2D" }} /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* ===================== DIREITA · CARD ===================== */}
          <div className="w-full flex lg:justify-end">
            <div
              className="w-full max-w-[420px] rounded-2xl p-7 lg:p-8"
              style={{
                background: "rgba(10,10,10,0.70)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(180,30,45,0.55)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 32px rgba(180,30,45,0.12)",
              }}
            >
              <img src={logo} alt="Quero Armas" className="block mx-auto w-[210px] max-w-full h-auto mb-5" />

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #B41E2D)" }} />
                <span className="text-[12px] tracking-[0.32em] text-[#AFAFAF]">ÁREA RESTRITA</span>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #B41E2D, transparent)" }} />
              </div>

              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-[12px] font-semibold tracking-[0.08em] mb-1.5" style={{ color: "#E5E5E5" }}>E-MAIL</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="email" placeholder="seu@email.com" className="v9-input pl-10" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold tracking-[0.08em] mb-1.5" style={{ color: "#E5E5E5" }}>SENHA</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type={showPwd ? "text" : "password"} placeholder="••••••••" className="v9-input pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPwd((s) => !s)} aria-label="Mostrar ou ocultar senha" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="w-full h-[50px] rounded-lg text-white text-sm font-bold uppercase tracking-[0.12em] transition hover:brightness-110" style={{ background: "#B41E2D", boxShadow: "0 8px 24px -8px rgba(180,30,45,0.6)" }}>
                  Entrar
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">ou continue com</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="space-y-2.5">
                <button type="button" className="v9-oauth"><GoogleIcon /> Continuar com Google</button>
                <button type="button" className="v9-oauth"><AppleIcon /> Continuar com Apple</button>
              </div>

              <div className="flex items-center justify-between mt-6 text-xs">
                <button type="button" className="text-white/60 hover:text-white transition">Esqueceu a senha?</button>
                <Link to="/cadastro" className="font-semibold inline-flex items-center gap-1" style={{ color: "#B41E2D" }}>Criar conta →</Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .v9-input{ width:100%; height:48px; border-radius:8px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.16); color:#fff; font-size:14px; outline:none; transition:border-color .15s, box-shadow .15s; }
        .v9-input::placeholder{ color:rgba(255,255,255,0.35); }
        .v9-input:focus{ border-color:#B41E2D; background:rgba(255,255,255,0.05); box-shadow:0 0 0 3px rgba(180,30,45,0.18); }
        .v9-oauth{ width:100%; height:44px; display:inline-flex; align-items:center; justify-content:center; gap:10px; border-radius:8px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.14); color:#E5E5E5; font-size:14px; transition:border-color .15s, background .15s; cursor:pointer; }
        .v9-oauth:hover{ border-color:rgba(255,255,255,0.28); background:rgba(255,255,255,0.06); }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.02-.81.87-2.13 1.55-3.22 1.46-.13-1.1.42-2.25 1.16-3.05.83-.9 2.24-1.55 3.24-1.43zM20.5 17.2c-.55 1.27-.81 1.83-1.51 2.94-.97 1.55-2.34 3.49-4.05 3.5-1.51.01-1.9-.99-3.95-.98-2.05.01-2.48 1-3.99.98-1.71-.01-3.01-1.77-3.98-3.32-2.71-4.34-3-9.43-1.32-12.14 1.19-1.93 3.07-3.06 4.85-3.06 1.81 0 2.94 1 4.43 1 1.45 0 2.34-1 4.42-1 1.58 0 3.25.86 4.45 2.34-3.91 2.14-3.28 7.74.65 9.74z" />
    </svg>
  );
}
