import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Phone, Mail, ShieldCheck, ChevronLeft } from "lucide-react";
import logoColor from "@/assets/logo-color.png";

/**
 * MOCKUP VISUAL — Login da Área do Cliente com login social (Google, Apple, Telefone).
 * Página apenas demonstrativa. Nenhum botão dispara autenticação real.
 * Rota: /area-do-cliente/login-mockup
 */
export default function QAClienteLoginMockupPage() {
  const [tab, setTab] = useState<"email" | "telefone">("email");
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "#f6f5f1" }}
    >
      {/* Faixa superior */}
      <div className="w-full border-b border-black/10 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to="/area-do-cliente"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-black/60 hover:text-[#7A1F2B]"
          >
            <ChevronLeft size={14} /> Voltar
          </Link>
          <span className="text-[10px] uppercase tracking-[0.3em] text-black/40">
            Mockup · Não funcional
          </span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brasão / logo */}
          <div className="flex flex-col items-center mb-8">
            <img src={logoColor} alt="Quero Armas" className="h-14 w-auto mb-4" />
            <h1 className="text-2xl font-bold uppercase tracking-wide text-black text-center">
              Acesso do Cliente
            </h1>
            <p className="text-sm text-black/60 mt-1 text-center">
              Entre na sua área para acompanhar seus processos e documentos.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white border border-black/10 rounded-xl shadow-sm p-6">
            {/* Botões sociais */}
            <div className="space-y-2.5">
              <button
                type="button"
                className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg border border-black/15 bg-white hover:bg-black/[0.03] transition text-sm font-medium text-black"
              >
                <GoogleIcon />
                Continuar com Google
              </button>
              <button
                type="button"
                className="w-full h-11 inline-flex items-center justify-center gap-3 rounded-lg bg-black hover:bg-black/90 transition text-sm font-medium text-white"
              >
                <AppleIcon />
                Continuar com Apple
              </button>
            </div>

            {/* Divisor */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-black/10" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-black/40">
                ou
              </span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            {/* Tabs e-mail / telefone */}
            <div className="flex rounded-lg bg-black/5 p-1 mb-4">
              <TabButton active={tab === "email"} onClick={() => setTab("email")}>
                <Mail size={14} /> E-mail
              </TabButton>
              <TabButton active={tab === "telefone"} onClick={() => setTab("telefone")}>
                <Phone size={14} /> Telefone
              </TabButton>
            </div>

            {tab === "email" ? (
              <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                <Field label="E-mail">
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    className="qa-input"
                  />
                </Field>
                <Field label="Senha">
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder="••••••••"
                      className="qa-input pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs uppercase tracking-wider text-[#7A1F2B] hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <SubmitBtn>Entrar</SubmitBtn>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                <Field label="Celular com DDD">
                  <div className="flex gap-2">
                    <select className="qa-input w-24 shrink-0">
                      <option>+55</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      className="qa-input flex-1"
                    />
                  </div>
                </Field>
                <p className="text-xs text-black/55 leading-relaxed">
                  Enviaremos um <strong>código SMS de 6 dígitos</strong> para confirmar
                  seu acesso. Nenhuma senha necessária.
                </p>
                <SubmitBtn>Receber código</SubmitBtn>
              </form>
            )}
          </div>

          {/* Criar conta */}
          <p className="text-center text-sm text-black/60 mt-6">
            Ainda não tem conta?{" "}
            <Link
              to="/area-do-cliente/criar-conta"
              className="text-[#7A1F2B] font-semibold uppercase tracking-wider text-xs hover:underline"
            >
              Criar cadastro
            </Link>
          </p>

          {/* Selo segurança */}
          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] uppercase tracking-wider text-black/40">
            <ShieldCheck size={14} />
            Conexão protegida · LGPD
          </div>
        </div>
      </main>

      <style>{`
        .qa-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.15);
          background: #fff;
          font-size: 14px;
          color: #000;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .qa-input:focus {
          border-color: #7A1F2B;
          box-shadow: 0 0 0 3px rgba(122,31,43,0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-black/70 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-xs uppercase tracking-wider font-semibold transition ${
        active
          ? "bg-white text-black shadow-sm"
          : "text-black/55 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full h-11 rounded-lg bg-[#7A1F2B] hover:bg-[#651822] transition text-white text-sm font-semibold uppercase tracking-wider"
    >
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.18 3.02-.81.87-2.13 1.55-3.22 1.46-.13-1.1.42-2.25 1.16-3.05.83-.9 2.24-1.55 3.24-1.43zM20.5 17.2c-.55 1.27-.81 1.83-1.51 2.94-.97 1.55-2.34 3.49-4.05 3.5-1.51.01-1.9-.99-3.95-.98-2.05.01-2.48 1-3.99.98-1.71-.01-3.01-1.77-3.98-3.32-2.71-4.34-3-9.43-1.32-12.14 1.19-1.93 3.07-3.06 4.85-3.06 1.81 0 2.94 1 4.43 1 1.45 0 2.34-1 4.42-1 1.58 0 3.25.86 4.45 2.34-3.91 2.14-3.28 7.74.65 9.74z"/>
    </svg>
  );
}