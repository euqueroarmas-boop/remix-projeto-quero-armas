import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Crosshair,
  Shield,
  Lock as LockIcon,
  Star,
  Briefcase,
} from "lucide-react";
import logoQA from "@/assets/quero-armas-logo.png";
import bgAsset from "@/assets/quero-armas-tactical-bench.png.asset.json";

const BG_URL = bgAsset.url;

const CATEGORIAS = [
  { label: "CAC", Icon: Crosshair },
  { label: "DEFESA PESSOAL", Icon: Shield },
  { label: "SEGURANÇA", Icon: LockIcon },
  { label: "COLECIONADOR", Icon: Star },
  { label: "EMPRESA", Icon: Briefcase },
];

export default function MockupsLoginV9() {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-black font-sans text-white"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Overlays para legibilidade */}
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.8) 100%)",
        }}
      />
      {/* vinheta */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 260px 70px rgba(0,0,0,0.9)" }}
      />
      {/* brilho vermelho discreto atrás do card */}
      <div
        className="pointer-events-none absolute right-[3vw] top-1/2 hidden h-[560px] w-[560px] -translate-y-1/2 rounded-full opacity-40 blur-3xl lg:block"
        style={{ background: "radial-gradient(circle, rgba(180,30,45,0.35) 0%, transparent 70%)" }}
      />

      {/* TOPO ESQUERDO: Patrocínio */}
      <div className="absolute left-6 top-6 z-20 flex items-center gap-3 lg:left-12 lg:top-10">
        <div className="leading-tight">
          <div
            className="mb-1 text-[10px] font-semibold tracking-[0.28em] text-white/65"
            style={{ fontFamily: "Rajdhani, sans-serif" }}
          >
            PATROCINADO POR
          </div>
          <div className="flex items-center gap-2.5">
            <TaurusBull />
            <span
              className="text-[26px] font-bold leading-none tracking-[0.18em] text-white"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              TAURUS<span className="align-top text-[10px] text-white/70">™</span>
            </span>
          </div>
        </div>
      </div>

      {/* ESQUERDA — headline (centro-esquerda) */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col justify-center px-6 pt-28 pb-10 lg:px-12 lg:pt-0 lg:pb-0">
        <div className="max-w-2xl">
            <h1
              className="text-5xl font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-[88px]"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "-0.01em", textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
            >
              CONTROLE TOTAL
            </h1>
            <h2
              className="mt-2 text-3xl font-bold uppercase leading-tight text-white/75 sm:text-4xl lg:text-5xl"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              DOS SEUS DOCUMENTOS
            </h2>

            <div className="mt-6 flex max-w-lg items-start gap-3">
              <div className="mt-1 h-12 w-[3px] bg-[#B41E2D]" />
              <p
                className="text-sm uppercase tracking-[0.12em] text-white/80 sm:text-base"
                style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 500 }}
              >
                CR, CRAF, PORTE, POSSE, GUIAS DE TRÁFEGO,
                <br />
                VENCIMENTOS E PROCESSOS.
              </p>
            </div>

            {/* CHIPS */}
            <div className="mt-8 flex flex-wrap gap-2.5">
              {CATEGORIAS.map(({ label, Icon }) => (
                <div
                  key={label}
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.16] bg-black/55 px-4 backdrop-blur-md transition-colors hover:border-[#B41E2D]/60"
                >
                  <Icon className="h-4 w-4 text-[#B41E2D]" strokeWidth={2} />
                  <span
                    className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90"
                    style={{ fontFamily: "Rajdhani, sans-serif" }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* DIREITA — CARD LOGIN flutuante */}
      <div className="relative z-20 mx-auto w-full max-w-[420px] px-6 pb-10 lg:absolute lg:right-[5vw] lg:top-1/2 lg:mx-0 lg:-translate-y-1/2 lg:px-0 lg:pb-0">
            <div
              className="relative rounded-2xl p-7 sm:p-8"
              style={{
                background: "rgba(10,10,10,0.72)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(180,30,45,0.55)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 32px rgba(180,30,45,0.12)",
              }}
            >
              {/* Logo */}
              <div className="mb-5 flex justify-center">
                <img
                  src={logoQA}
                  alt="Quero Armas"
                  className="h-auto w-[210px] object-contain"
                  draggable={false}
                />
              </div>

              {/* ÁREA RESTRITA */}
              <div className="mb-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B41E2D]/70" />
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70"
                  style={{ fontFamily: "Rajdhani, sans-serif" }}
                >
                  Área Restrita
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B41E2D]/70" />
              </div>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                {/* EMAIL */}
                <div>
                  <label
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80"
                    style={{ fontFamily: "Rajdhani, sans-serif" }}
                  >
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      className="h-[48px] w-full rounded-lg border border-white/[0.16] bg-white/[0.035] pl-10 pr-3 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[#B41E2D] focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(180,30,45,0.18)]"
                    />
                  </div>
                </div>

                {/* SENHA */}
                <div>
                  <label
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80"
                    style={{ fontFamily: "Rajdhani, sans-serif" }}
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-[48px] w-full rounded-lg border border-white/[0.16] bg-white/[0.035] pl-10 pr-11 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[#B41E2D] focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(180,30,45,0.18)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/45 transition-colors hover:text-white"
                      aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* ENTRAR */}
                <button
                  type="submit"
                  className="mt-2 h-[50px] w-full rounded-lg bg-[#B41E2D] text-sm font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_24px_rgba(180,30,45,0.35)] transition-all hover:bg-[#7A1F2B] active:scale-[0.99]"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Entrar
                </button>

                {/* Separador */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="h-px flex-1 bg-white/10" />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50"
                    style={{ fontFamily: "Rajdhani, sans-serif" }}
                  >
                    Ou continue com
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* OAuth */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    className="flex h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-white/[0.14] bg-white/[0.035] text-sm font-medium text-white/85 transition-all hover:border-white/30 hover:bg-white/[0.07]"
                  >
                    <GoogleIcon />
                    Continuar com Google
                  </button>
                  <button
                    type="button"
                    className="flex h-[44px] w-full items-center justify-center gap-3 rounded-lg border border-white/[0.14] bg-white/[0.035] text-sm font-medium text-white/85 transition-all hover:border-white/30 hover:bg-white/[0.07]"
                  >
                    <AppleIcon />
                    Continuar com Apple
                  </button>
                </div>

                {/* Rodapé */}
                <div className="flex items-center justify-between pt-3 text-xs">
                  <button
                    type="button"
                    className="text-white/55 transition-colors hover:text-white/85"
                  >
                    Esqueceu a senha?
                  </button>
                  <button
                    type="button"
                    className="font-semibold text-[#B41E2D] transition-colors hover:text-[#E03546]"
                  >
                    Criar conta →
                  </button>
                </div>
              </form>
            </div>

            <p className="mt-4 text-center text-[10px] uppercase tracking-[0.22em] text-white/35">
              Ambiente Seguro · Acesso Auditado
            </p>
      </div>
    </div>
  );
}

function TaurusBull() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-9 w-9"
      aria-hidden="true"
      fill="none"
    >
      {/* Estilizado: cabeça de touro Taurus */}
      <path
        d="M20 10c-4 0-7 2-9 5-2-1-4-1-5 0-1 1 0 4 2 5 1 1 2 1 3 1 1 4 5 7 9 7s8-3 9-7c1 0 2 0 3-1 2-1 3-4 2-5-1-1-3-1-5 0-2-3-5-5-9-5z"
        fill="#B41E2D"
      />
      <circle cx="16" cy="22" r="1.4" fill="#0a0a0a" />
      <circle cx="24" cy="22" r="1.4" fill="#0a0a0a" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z"/>
      <path fill="#34A853" d="M3.9 7.6l3.2 2.3C8 8.1 9.8 6.8 12 6.8c1.7 0 2.9.7 3.6 1.4l2.5-2.5C16.6 4.1 14.5 3 12 3 8.2 3 4.9 5.1 3.9 7.6z" opacity=".0"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.4 12.6c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.3 2.5 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.2 3.1-2.4.6-.9 1.1-1.9 1.4-2.9-2.3-.9-3.1-2.6-3.1-4zM14 4.7c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.2.1 2.3-.6 3-1.4z"/>
    </svg>
  );
}
