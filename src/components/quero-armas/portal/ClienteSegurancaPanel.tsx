import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  IconShieldLock,
  IconMailFast,
  IconDeviceDesktop,
  IconLogout2,
  IconKey,
  IconLoader2,
} from "@tabler/icons-react";

interface SegurancaConfig {
  alerta_login: boolean;
  mfa_troca_senha: boolean;
}

interface LoginEvento {
  id: string;
  created_at: string;
  ip: string | null;
  dispositivo: string | null;
  navegador: string | null;
  sistema: string | null;
  local_aproximado: string | null;
  origem: string | null;
}

const BORDO = "#7A1F2B";

function fmt(dt: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dt));
  } catch {
    return dt;
  }
}

async function chamar(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("qa-cliente-seguranca", { body });
  if (error) {
    let detalhe = error.message;
    try { detalhe = JSON.parse(await (error as any).context?.text?.())?.error || detalhe; } catch { /* ignora */ }
    throw new Error(detalhe || "Falha na central de segurança.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

/** Registra o acesso atual e dispara o aviso de login por e-mail (1x por sessão). */
export async function registrarLoginArsenal(origem = "senha") {
  try {
    const chave = "qa_login_alerta_registrado";
    if (sessionStorage.getItem(chave)) return;
    sessionStorage.setItem(chave, "1");
    await chamar({ action: "registrar_login", origem, userAgent: navigator.userAgent });
  } catch {
    /* nunca bloqueia o login */
  }
}

export default function ClienteSegurancaPanel() {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<SegurancaConfig>({ alerta_login: true, mfa_troca_senha: true });
  const [eventos, setEventos] = useState<LoginEvento[]>([]);
  const [email, setEmail] = useState("");

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [salvandoCfg, setSalvandoCfg] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await chamar({ action: "listar" });
      setConfig({
        alerta_login: Boolean(r?.config?.alerta_login),
        mfa_troca_senha: Boolean(r?.config?.mfa_troca_senha),
      });
      setEventos((r?.eventos || []) as LoginEvento[]);
      setEmail(String(r?.email || ""));
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível carregar a segurança da conta.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarConfig = async (patch: Partial<SegurancaConfig>) => {
    const anterior = config;
    setConfig((c) => ({ ...c, ...patch }));
    setSalvandoCfg(true);
    try {
      await chamar({ action: "salvar_config", ...patch });
      toast.success("Preferência de segurança atualizada.");
    } catch (e: any) {
      setConfig(anterior);
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSalvandoCfg(false);
    }
  };

  const pedirCodigo = async () => {
    setEnviandoCodigo(true);
    try {
      const r = await chamar({ action: "solicitar_codigo" });
      setCodigoEnviado(true);
      toast.success(`Contra-senha enviada para ${r?.mascara || email}. Válida por 10 minutos.`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a contra-senha.");
    } finally {
      setEnviandoCodigo(false);
    }
  };

  const trocarSenha = async () => {
    if (novaSenha.length < 8) { toast.error("A nova senha precisa ter ao menos 8 caracteres."); return; }
    if (novaSenha !== confirmaSenha) { toast.error("As senhas não conferem."); return; }
    if (config.mfa_troca_senha && !/^\d{6}$/.test(codigo.trim())) {
      toast.error("Informe a contra-senha de 6 dígitos que enviamos por e-mail.");
      return;
    }
    setSalvandoSenha(true);
    try {
      await chamar({ action: "trocar_senha", novaSenha, codigo: codigo.trim(), encerrarSessoes: false });
      setNovaSenha(""); setConfirmaSenha(""); setCodigo(""); setCodigoEnviado(false);
      toast.success("Senha alterada com sucesso. Enviamos a confirmação para o seu e-mail.");
      carregar();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível trocar a senha.");
    } finally {
      setSalvandoSenha(false);
    }
  };

  const encerrarSessoes = async () => {
    setEncerrando(true);
    try {
      await chamar({ action: "encerrar_sessoes" });
      toast.success("Todas as sessões foram encerradas. Faça login novamente.");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/area-do-cliente/login";
      }, 900);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível encerrar as sessões.");
      setEncerrando(false);
    }
  };

  return (
    <section className="mt-6 border-t border-[#E5E5E5] pt-5" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-sm flex items-center justify-center text-white shrink-0" style={{ background: BORDO }}>
          <IconShieldLock className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="qa-h3">SEGURANÇA DA CONTA</h2>
          <p className="qa-caption">Senha, verificação em duas etapas por e-mail e dispositivos conectados.</p>
        </div>
      </header>

      {carregando ? (
        <div className="rounded-sm border border-[#E5E5E5] bg-white p-6 flex items-center gap-2 text-[#7A7A7A] text-sm">
          <IconLoader2 className="h-4 w-4 animate-spin" /> Carregando segurança…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Trocar senha */}
          <div className="rounded-sm border border-[#E5E5E5] bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <IconKey className="h-4 w-4" style={{ color: BORDO }} />
              <span className="qa-eyebrow" style={{ color: BORDO }}>Trocar minha senha</span>
            </div>
            <p className="qa-caption mb-3">
              {config.mfa_troca_senha
                ? "Com a verificação em duas etapas ativa, enviamos uma contra-senha por e-mail para confirmar que é você."
                : "A troca é imediata. Recomendamos manter a verificação por e-mail ligada."}
            </p>

            <div className="grid gap-2.5">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#7A7A7A]">Nova senha</span>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1 w-full h-9 rounded-sm border border-[#E5E5E5] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#7A1F2B]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#7A7A7A]">Confirmar nova senha</span>
                <input
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  className="mt-1 w-full h-9 rounded-sm border border-[#E5E5E5] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#7A1F2B]"
                />
              </label>

              {config.mfa_troca_senha ? (
                <div className="rounded-sm bg-[#FAFAFA] border border-[#E5E5E5] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#7A7A7A]">Contra-senha por e-mail</span>
                    <button
                      type="button"
                      onClick={pedirCodigo}
                      disabled={enviandoCodigo}
                      className="text-[11px] font-semibold uppercase tracking-wide disabled:opacity-60"
                      style={{ color: BORDO }}
                    >
                      {enviandoCodigo ? "Enviando…" : codigoEnviado ? "Reenviar" : "Enviar contra-senha"}
                    </button>
                  </div>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full h-10 rounded-sm border border-[#E5E5E5] bg-white px-3 text-center text-lg tracking-[0.5em] font-bold text-[#0A0A0A] focus:outline-none focus:border-[#7A1F2B]"
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={trocarSenha}
                disabled={salvandoSenha}
                className="h-10 rounded-sm text-white text-[12px] font-bold uppercase tracking-[0.14em] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: BORDO }}
              >
                {salvandoSenha ? <IconLoader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar nova senha
              </button>
            </div>
          </div>

          {/* Preferências + sessões */}
          <div className="flex flex-col gap-3">
            <div className="rounded-sm border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <IconMailFast className="h-4 w-4" style={{ color: BORDO }} />
                <span className="qa-eyebrow" style={{ color: BORDO }}>Verificação e avisos</span>
              </div>

              {[
                {
                  key: "mfa_troca_senha" as const,
                  titulo: "Contra-senha por e-mail ao trocar a senha",
                  desc: "Exige um código de 6 dígitos enviado para o seu e-mail antes de alterar a senha.",
                },
                {
                  key: "alerta_login" as const,
                  titulo: "Avisar por e-mail a cada novo login",
                  desc: "Você recebe data, IP, local aproximado e dispositivo de cada acesso ao Arsenal Inteligente.",
                },
              ].map((opt) => (
                <div key={opt.key} className="flex items-start justify-between gap-3 py-2.5 border-t border-[#F0F0F0] first:border-t-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#0A0A0A]">{opt.titulo}</div>
                    <p className="qa-caption mt-0.5">{opt.desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config[opt.key]}
                    disabled={salvandoCfg}
                    onClick={() => salvarConfig({ [opt.key]: !config[opt.key] } as Partial<SegurancaConfig>)}
                    className="shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-60"
                    style={{ background: config[opt.key] ? BORDO : "#D4D4D4" }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                      style={{ left: config[opt.key] ? "22px" : "2px" }}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-sm border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <IconLogout2 className="h-4 w-4" style={{ color: BORDO }} />
                <span className="qa-eyebrow" style={{ color: BORDO }}>Não reconheceu um acesso?</span>
              </div>
              <p className="qa-caption mb-3">
                Encerre imediatamente todas as sessões abertas em qualquer dispositivo e troque a senha em seguida.
              </p>
              <button
                type="button"
                onClick={encerrarSessoes}
                disabled={encerrando}
                className="w-full h-10 rounded-sm border text-[12px] font-bold uppercase tracking-[0.14em] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ borderColor: BORDO, color: BORDO, background: "#FFF7F7" }}
              >
                {encerrando ? <IconLoader2 className="h-4 w-4 animate-spin" /> : null}
                Deslogar todos os dispositivos
              </button>
            </div>
          </div>

          {/* Histórico de acessos */}
          <div className="rounded-sm border border-[#E5E5E5] bg-white p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <IconDeviceDesktop className="h-4 w-4" style={{ color: BORDO }} />
              <span className="qa-eyebrow" style={{ color: BORDO }}>Últimos acessos</span>
            </div>
            {eventos.length === 0 ? (
              <p className="qa-caption">Nenhum acesso registrado ainda.</p>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {eventos.map((ev, i) => (
                  <div key={ev.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#0A0A0A]">
                        {(ev.dispositivo || "Dispositivo")} · {(ev.sistema || "—")} · {(ev.navegador || "—")}
                      </div>
                      <p className="qa-caption mt-0.5">
                        {fmt(ev.created_at)} · IP {ev.ip || "—"} · {ev.local_aproximado || "Local não identificado"}
                      </p>
                    </div>
                    {i === 0 ? (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded-sm text-white" style={{ background: "#059669" }}>
                        Atual
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}