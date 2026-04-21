import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, Target, Award, Users, Clock, MapPin, CheckCircle2,
  AlertTriangle, Crosshair, Wrench, BookOpen, Trophy, Coffee,
  MessageCircle, Phone, Mail, Lock, Zap, Flame
} from "lucide-react";
import heroImg from "@/assets/qa-curso-hero.jpg";
import maintImg from "@/assets/qa-curso-manutencao.jpg";
import familyImg from "@/assets/qa-curso-familia.jpg";
import instrutorImg from "@/assets/qa-instrutor.jpg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WPP_NUMBER = "5511978481919";
const WPP_DISPLAY = "(11) 97848-1919";
const EMAIL = "eu@queroarmas.com.br";

const wppLink = (msg: string) =>
  `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent(msg)}`;

const openWpp = (intent: "vaga" | "vip" | "duvida") => {
  const msgs = {
    vaga: "Olá! Vi a página do Curso Operador de Pistola I da Quero Armas e quero garantir minha vaga na próxima turma.",
    vip: "Olá! Tenho interesse no Curso Operador de Pistola I — modalidade VIP. Pode me passar as datas disponíveis?",
    duvida: "Olá! Tenho dúvidas sobre o Curso Operador de Pistola I da Quero Armas.",
  };
  window.open(wppLink(msgs[intent]), "_blank", "noopener,noreferrer");
};

// ============ TACTICAL PALETTE — sóbria ============
// 3 cores reais: OD Green · Steel Blue · Muted Amber (sand)
// + tons neutros gunmetal para o fundo. Sem vermelhos, sem brilhos.
const OD_GREEN   = "hsl(82 18% 26%)";   // verde militar principal
const OD_DEEP    = "hsl(84 22% 13%)";   // verde profundo
const OD_LINE    = "hsl(82 14% 32%)";   // borda discreta verde
const STEEL_BLUE = "hsl(210 22% 32%)";  // azul aço tático
const STEEL_DEEP = "hsl(212 28% 16%)";  // azul profundo
const SAND       = "hsl(42 38% 62%)";   // amarelo areia (muted, não gritante)
const SAND_DIM   = "hsl(42 22% 42%)";   // areia escura para borda
const GUNMETAL   = "hsl(210 12% 10%)";
const GUNMETAL_2 = "hsl(210 14% 7%)";
const STEEL      = "hsl(210 8% 64%)";
const STEEL_DIM  = "hsl(210 6% 48%)";

// aliases (mantidos pra não quebrar referências antigas)
const TAC_BLUE = STEEL_BLUE;
const TAC_OLIVE = OD_GREEN;
const COYOTE_DIM = OD_LINE;
const AMBER = SAND;
const BLOOD = SAND;       // sem vermelho — substituído por areia
const COYOTE = SAND_DIM;
const ACCENT = OD_GREEN;

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-sm font-mono text-[11px] tracking-[0.22em] uppercase font-bold"
      style={{
        background: "rgba(0,0,0,0.45)",
        border: `1px solid ${OD_LINE}`,
        color: SAND,
      }}
    >
      <span className="w-1.5 h-1.5" style={{ background: SAND }} />
      {children}
    </span>
  );
}

function FeatureCard({
  icon: Icon, title, children,
}: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-5 md:p-6 rounded-lg h-full transition-all hover:-translate-y-1"
      style={{
        background: "linear-gradient(180deg, hsl(220 18% 11%) 0%, hsl(220 22% 8%) 100%)",
        border: "1px solid hsl(220 12% 18%)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div
        className="w-11 h-11 rounded-md flex items-center justify-center mb-4"
        style={{
          background: `linear-gradient(135deg, ${TAC_BLUE}, ${TAC_OLIVE})`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-bold text-white mb-2 text-[15px] tracking-wide">{title}</h3>
      <div className="text-[13.5px] leading-relaxed" style={{ color: "hsl(220 10% 70%)" }}>
        {children}
      </div>
    </div>
  );
}

// ----- Form -----
function InscricaoForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", turma: "padrao", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Preencha nome, e-mail e telefone.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          service_interest: `Curso Operador de Pistola I — ${form.turma === "vip" ? "VIP" : "Padrão"}`,
          message: form.message || `Quero reservar minha vaga no Curso Operador de Pistola I (turma ${form.turma === "vip" ? "VIP" : "Padrão"}).`,
          source_page: "/quero-armas/curso-operador-pistola",
        },
      });
      if (error || !data?.success) throw new Error(data?.errors?.[0] || error?.message || "Erro");
      setDone(true);
      toast.success("Solicitação enviada! Em breve entraremos em contato.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar. Tente pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-10 px-6">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${TAC_OLIVE}, ${TAC_BLUE})` }}
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Vaga pré-reservada!</h3>
        <p className="text-sm" style={{ color: "hsl(220 10% 70%)" }}>
          Nosso instrutor entrará em contato em até <strong className="text-white">1 dia útil</strong>.
          <br />
          Para acelerar, fale agora pelo WhatsApp:
        </p>
        <button
          onClick={() => openWpp("vaga")}
          className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-md font-bold text-white"
          style={{ background: "#25D366" }}
        >
          <MessageCircle className="w-4 h-4" />
          Falar no WhatsApp
        </button>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-3 rounded-md text-[14px] text-white placeholder:text-white/40 focus:outline-none transition-colors";
  const inputStyle = {
    background: "hsl(220 22% 10%)",
    border: "1px solid hsl(220 14% 22%)",
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={inputCls}
        style={inputStyle}
        placeholder="Seu nome completo"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
        maxLength={120}
      />
      <input
        type="email"
        className={inputCls}
        style={inputStyle}
        placeholder="Seu melhor e-mail"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
        maxLength={200}
      />
      <input
        className={inputCls}
        style={inputStyle}
        placeholder="WhatsApp com DDD"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        required
        maxLength={20}
      />
      <select
        className={inputCls}
        style={inputStyle}
        value={form.turma}
        onChange={(e) => setForm({ ...form, turma: e.target.value })}
      >
        <option value="padrao">Turma Padrão — R$ 1.890,00</option>
        <option value="vip">Turma VIP — R$ 2.490,00</option>
      </select>
      <textarea
        className={inputCls}
        style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
        placeholder="Mensagem (opcional) — conte sua experiência e objetivo"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        maxLength={1000}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 rounded-md font-bold text-white text-[14px] tracking-wider uppercase transition-all disabled:opacity-60"
        style={{
          background: `linear-gradient(135deg, ${ACCENT}, hsl(14 88% 42%))`,
          boxShadow: "0 8px 24px hsla(14, 88%, 52%, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {loading ? "Enviando..." : "Garantir minha vaga"}
      </button>
      <p className="text-[11px] text-center pt-1" style={{ color: "hsl(220 10% 55%)" }}>
        <Lock className="w-3 h-3 inline mr-1" />
        Dados protegidos pela LGPD. Nunca repassamos seu contato.
      </p>
    </form>
  );
}

// ============= MAIN =============
export default function QACursoOperadorPistolaPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Curso Operador de Pistola I — Quero Armas | Defesa Pessoal e Porte";
    const setMeta = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith("link") ? "link" : "meta") as any;
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute(selector.startsWith("link") ? "href" : "content", value);
    };
    setMeta('meta[name="description"]', "name", "description",
      "Aprenda a manusear pistolas com segurança, técnica e controle absoluto. Treinamento prático com munição real, instrutor credenciado CTT-CBC. Vagas limitadas.");
    setMeta('meta[property="og:title"]', "property", "og:title", "Curso Operador de Pistola I — Quero Armas");
    setMeta('meta[property="og:description"]', "property", "og:description",
      "Defenda quem você ama. Treinamento tático completo: 10h prático + teórico, 120 disparos, certificado reconhecido.");
    setMeta('meta[property="og:image"]', "property", "og:image", heroImg);
    setMeta('link[rel="canonical"]', "rel", "canonical", "https://wmti.com.br/quero-armas/curso-operador-pistola");
  }, []);

  return (
    <>
      <div
        className="min-h-screen relative"
        style={{
          background: `radial-gradient(1200px 600px at 10% -10%, ${OD_DEEP} 0%, ${GUNMETAL_2} 55%, #000 100%)`,
          color: "white",
        }}
      >
        {/* Grid tático sutil sobre todo o fundo */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* ============ HERO ============ */}
        <section className="relative min-h-[100vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={heroImg}
              alt="Operador de pistola treinado em estande de tiro profissional"
              className="w-full h-full object-cover"
              style={{ filter: "grayscale(0.45) contrast(1.12) brightness(0.75)" }}
              fetchPriority="high"
              width={1920}
              height={1280}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 45%, ${GUNMETAL_2} 100%), radial-gradient(800px 500px at 85% 20%, hsla(2,72%,42%,0.12), transparent 60%)`,
              }}
            />
            {/* Crosshair decorativo */}
            <div
              aria-hidden
              className="absolute top-10 right-10 w-40 h-40 rounded-full hidden md:block opacity-30"
              style={{
                border: `1px solid ${SAND_DIM}`,
                boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.4)`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: 1, height: "100%", background: SAND_DIM, opacity: 0.6 }} />
                <div style={{ height: 1, width: "100%", background: SAND_DIM, opacity: 0.6, position: "absolute" }} />
              </div>
            </div>
          </div>

          <div className="container relative z-10 py-16 md:py-24 max-w-6xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-3xl"
            >
              <SectionTag>OP · CURSO OPERADOR DE PISTOLA I · IAT / CTT-CBC</SectionTag>

              <h1 className="text-3xl md:text-5xl lg:text-[4rem] font-black leading-[1.02] mt-6 mb-6 tracking-tight uppercase">
                Quando alguém invade
                <br />
                <span style={{ color: SAND }}>a sua casa,</span>
                <br />
                <span className="text-white/90">só existe você.</span>
              </h1>

              <p className="text-lg md:text-xl leading-relaxed mb-4 font-medium" style={{ color: "hsl(210 8% 86%)" }}>
                Sua mulher dorme no quarto. Seu filho no outro. Você ouve o portão sendo arrombado.
                <br className="hidden md:block" />
                A polícia leva minutos. Você tem <strong style={{ color: SAND }}>segundos</strong> para proteger quem ama.
              </p>
              <p className="text-base md:text-[17px] leading-relaxed mb-8" style={{ color: STEEL }}>
                O <strong className="text-white">Curso Operador de Pistola I</strong> da <strong className="text-white">Quero Armas</strong> forma cidadãos comuns —
                pais, mães, profissionais — para defender a família, a casa e o patrimônio com técnica, calma e
                respaldo legal pela <strong className="text-white">Lei nº 10.826/2003</strong>. Sem fanfarra. Sem cosplay.
                Treinamento real, com instrutor credenciado.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => openWpp("vaga")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sm font-black text-white tracking-[0.15em] uppercase text-[13.5px] transition-all hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${OD_GREEN}, ${OD_DEEP})`,
                    boxShadow: "0 10px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                    border: `1px solid ${OD_LINE}`,
                  }}
                >
                  <Shield className="w-4 h-4" />
                  Quero proteger minha família
                </button>
                <button
                  onClick={() => openWpp("duvida")}
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-sm font-bold text-white tracking-[0.15em] uppercase text-[12.5px] transition-all hover:bg-white/10"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${OD_LINE}`,
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com o instrutor
                </button>
              </div>

              {/* Trust strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t" style={{ borderColor: COYOTE_DIM }}>
                {[
                  { n: "10h", l: "Instrução ao vivo" },
                  { n: "120", l: "Munições reais" },
                  { n: "05", l: "Operadores / turma" },
                  { n: "IAT", l: "Instrutor credenciado" },
                ].map((s) => (
                  <div key={s.l} className="font-mono">
                    <div className="text-2xl md:text-3xl font-black" style={{ color: AMBER }}>{s.n}</div>
                    <div className="text-[10.5px] uppercase tracking-[0.18em]" style={{ color: STEEL_DIM }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============ DOR REAL ============ */}
        <section className="py-20 md:py-28 relative overflow-hidden" style={{ background: GUNMETAL_2 }}>
          {/* tarja tática */}
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{
              background: `repeating-linear-gradient(90deg, ${BLOOD} 0 20px, transparent 20px 40px, ${AMBER} 40px 60px, transparent 60px 80px)`,
              opacity: 0.55,
            }}
          />
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <img
                  src={familyImg}
                  alt="Família protegida em casa"
                  loading="lazy"
                  width={1280}
                  height={960}
                  className="rounded-sm w-full"
                  style={{ filter: "grayscale(0.5) contrast(1.15) brightness(0.85)" }}
                />
                <div
                  className="absolute inset-0 rounded-sm"
                  style={{
                    boxShadow: `inset 0 0 120px rgba(0,0,0,0.75)`,
                    border: `1px solid ${COYOTE_DIM}`,
                  }}
                />
                {/* Tag militar na imagem */}
                <div
                  className="absolute bottom-3 left-3 px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] uppercase font-bold"
                  style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${AMBER}`, color: AMBER }}
                >
                  ● SEC · ATIVO
                </div>
              </div>
              <div>
                <SectionTag>RECON · BRIEFING TÁTICO</SectionTag>
                <h2 className="text-3xl md:text-[2.6rem] font-black leading-[1.1] mt-5 mb-6 uppercase tracking-tight">
                  Sua família não tem
                  <span style={{ color: BLOOD, textShadow: "0 0 20px hsla(2,72%,42%,0.4)" }}> second best</span>.
                  <br />
                  Ela tem <span style={{ color: AMBER }}>você</span>.
                </h2>
                <div className="space-y-4 text-[15px] leading-[1.7]" style={{ color: STEEL }}>
                  <p>
                    A cada <strong className="text-white">8 minutos</strong> uma residência é invadida neste país.
                    Em <strong style={{ color: BLOOD }}>mais de 90% dos casos</strong>, o morador paralisa —
                    porque nunca treinou saque, empunhadura, nem sabe se pode reagir sem virar réu.
                  </p>
                  <p>
                    Comprar pistola não te torna operador.
                    <br />
                    Ler artigo de blog não te prepara.
                    <br />
                    <strong className="text-white">Só treino com munição real, sob pressão, com instrutor credenciado — torna.</strong>
                  </p>
                  <p
                    className="font-mono uppercase tracking-[0.15em] pt-3 mt-3"
                    style={{ color: AMBER, borderTop: `1px dashed ${COYOTE_DIM}` }}
                  >
                    » Adestrar o homem, antes de municiar a arma.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ O QUE VOCÊ APRENDE ============ */}
        <section className="py-20 md:py-28" style={{ background: GUNMETAL }}>
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <SectionTag>FIELD MANUAL · GRADE DE INSTRUÇÃO</SectionTag>
              <h2 className="text-3xl md:text-[2.4rem] font-black mt-5 mb-4 uppercase tracking-tight">
                Do primeiro saque ao <span style={{ color: AMBER }}>domínio operacional</span>
              </h2>
              <p className="text-[14.5px] font-mono" style={{ color: STEEL }}>
                Currículo oficial baseado no material do Serviço de Armamento e Tiro da Academia Nacional de Polícia,
                conduzido por IAT credenciado · CTT-CBC XXVIII.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard icon={Shield} title="Normas de segurança (SOP)">
                Dedo fora do gatilho. Arma sempre carregada. Cano em direção segura. As regras que separam operador de estatística.
              </FeatureCard>
              <FeatureCard icon={Wrench} title="MCA · Manuseio e Carregamento">
                Alma raiada, antecarga x retrocarga, sistemas manual, semi-automático e automático. Anatomia completa da pistola.
              </FeatureCard>
              <FeatureCard icon={Crosshair} title="Fundamentos de tiro">
                Empunhadura Weaver · Isósceles, controle de gatilho ("esmagamento suave"), alinhamento de aparelhos de pontaria e respiração tática.
              </FeatureCard>
              <FeatureCard icon={Target} title="Linha de tiro · munição real">
                120 disparos supervisionados. Controle de recuo, tiros múltiplos, correção de desvio e tiro sob estresse.
              </FeatureCard>
              <FeatureCard icon={BookOpen} title="Balística & munição">
                Ponta oca x FMJ x expansiva. Calibre errado dentro de casa mata filho no quarto ao lado. Aqui você aprende o certo.
              </FeatureCard>
              <FeatureCard icon={Zap} title="Hammer × Striker · Ação SA/DA">
                Ação simples, ação dupla, sistemas de acionamento. Escolha pistola pela engenharia — não por influencer de YouTube.
              </FeatureCard>
              <FeatureCard icon={BookOpen} title="Legislação aplicada">
                Lei nº 10.826/2003 (Estatuto do Desarmamento), Decreto 11.615/2023 e Portaria COLOG 61/2023 — o que pode, o que não pode, o que te prende.
              </FeatureCard>
              <FeatureCard icon={Shield} title="Resolução de pane">
                Falha de alimentação, falha de extração, double feed, chaminé. O que fazer quando a arma trava no momento exato em que você mais precisa dela.
              </FeatureCard>
              <FeatureCard icon={AlertTriangle} title="Legítima defesa real">
                Quando reagir sem ir preso. Proporcionalidade, retirada tática, comunicação com a polícia no pós-disparo.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* ============ MANUTENÇÃO + IMG ============ */}
        <section className="py-20 md:py-28 relative" style={{ background: GUNMETAL_2 }}>
          <div className="container max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 md:order-1">
              <SectionTag>1º ESCALÃO · MANUTENÇÃO DE CAMPO</SectionTag>
              <h2 className="text-3xl md:text-[2.3rem] font-black mt-5 mb-6 leading-[1.1] uppercase tracking-tight">
                Arma suja <span style={{ color: BLOOD }}>falha</span>. <br />
                Arma mal lubrificada <span style={{ color: BLOOD }}>trava</span>. <br />
                <span style={{ color: AMBER }}>Operador treinado previne.</span>
              </h2>
              <ul className="space-y-3 text-[14.5px]" style={{ color: STEEL }}>
                {[
                  "Desmontagem e limpeza de 1º escalão — passo a passo, em campo",
                  "Lubrificação correta: pontos críticos que evitam travamento em combate",
                  "História das pistolas modernas: Hammer × Striker e quando preferir cada uma",
                  "Inspeção de rotina (pré e pós-treino) que prolonga a vida útil da arma",
                  "Identificação de desgaste: molas, pino percussor, extrator",
                ].map((t) => (
                  <li key={t} className="flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: AMBER }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2 relative">
              <img
                src={maintImg}
                alt="Pistola desmontada para manutenção"
                loading="lazy"
                width={1280}
                height={960}
                className="rounded-sm w-full"
                style={{ filter: "grayscale(0.4) contrast(1.1) brightness(0.9)", border: `1px solid ${COYOTE_DIM}` }}
              />
              <div
                className="absolute top-3 right-3 px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] uppercase font-bold"
                style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${AMBER}`, color: AMBER }}
              >
                FIELD STRIP · 01
              </div>
            </div>
          </div>
        </section>

        {/* ============ INCLUSO ============ */}
        <section className="py-20 md:py-28" style={{ background: GUNMETAL }}>
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <SectionTag>LOADOUT · KIT INCLUSO</SectionTag>
              <h2 className="text-3xl md:text-[2.3rem] font-black mt-5 mb-3 uppercase tracking-tight">
                Sem letra miúda. <span style={{ color: AMBER }}>Sem taxa escondida.</span>
              </h2>
              <p className="font-mono text-[13.5px]" style={{ color: STEEL }}>
                Todo o equipamento e suprimento para operar — <span style={{ color: AMBER }}>já incluso</span>.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { i: Clock, t: "10h de instrução", d: "Teoria + linha de tiro, IAT credenciado" },
                { i: Coffee, t: "Rancho incluso", d: "Café da manhã e almoço — sem custo adicional" },
                { i: Target, t: "120 munições reais", d: "Disparos cronometrados e supervisionados" },
                { i: Shield, t: "EPI completo", d: "Óculos balísticos e protetor auricular fornecidos" },
                { i: Crosshair, t: "Alvos e munição", d: "Todo suprimento por conta da Quero Armas" },
                { i: Award, t: "Certificado oficial", d: "Reconhecido para POSSE, PORTE e CR" },
              ].map((it) => (
                <div
                  key={it.t}
                  className="flex gap-4 p-5 rounded-sm transition-colors hover:border-amber-500/40"
                  style={{
                    background: OD_DEEP,
                    border: `1px solid ${COYOTE_DIM}`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${OD_GREEN}, ${GUNMETAL})`,
                      border: `1px solid ${COYOTE_DIM}`,
                    }}
                  >
                    <it.i className="w-5 h-5" style={{ color: AMBER }} />
                  </div>
                  <div>
                    <div className="font-bold text-white text-[14.5px] uppercase tracking-wide">{it.t}</div>
                    <div className="text-[13px] mt-0.5" style={{ color: STEEL_DIM }}>{it.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bônus */}
            <div
              className="mt-10 p-6 md:p-8 rounded-sm relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${OD_DEEP}, ${GUNMETAL_2})`,
                border: `1px solid ${AMBER}`,
                boxShadow: `0 0 40px hsla(40,85%,55%,0.12) inset`,
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5" style={{ color: AMBER }} />
                <span className="font-mono text-[11px] tracking-[0.25em] uppercase font-black" style={{ color: AMBER }}>
                  Classified · Bônus de Operador
                </span>
              </div>
              <ul className="space-y-2.5 text-[14px]" style={{ color: "hsl(210 8% 88%)" }}>
                {[
                  "Simulações de invasão domiciliar no estande (CQB adaptado para civil)",
                  "Acesso ao canal operacional no WhatsApp — contato direto com o IAT",
                  "Apostila didática completa: doutrina, balística, legislação, manutenção",
                ].map((b) => (
                  <li key={b} className="flex gap-3 items-start">
                    <span className="font-mono font-black mt-0.5" style={{ color: BLOOD }}>[+]</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============ PREÇO + FORM ============ */}
        <section id="inscricao" className="py-20 md:py-28" style={{ background: GUNMETAL_2 }}>
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
              {/* Esquerda: info */}
              <div>
                <SectionTag>ENGAJAMENTO · RESERVA DE POSIÇÃO</SectionTag>
                <h2 className="text-3xl md:text-[2.4rem] font-black mt-5 mb-6 leading-[1.1] uppercase tracking-tight">
                  Pelotão limitado a <span style={{ color: BLOOD }}>05 operadores</span> por turma.
                </h2>
                <p className="text-[15px] mb-8" style={{ color: STEEL }}>
                  Turma pequena não é marketing — é doutrina. Só assim o IAT corrige empunhadura, saque e controle de gatilho
                  de cada aluno, um a um, sob munição real. <strong className="text-white">Curso de massa vira estatística. Aqui, não.</strong>
                </p>

                {/* Pricing cards */}
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div
                    className="p-5 rounded-sm"
                    style={{
                      background: OD_DEEP,
                      border: `1px solid ${COYOTE_DIM}`,
                    }}
                  >
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.2em] mb-2 font-bold" style={{ color: STEEL }}>
                      Operador · Padrão
                    </div>
                    <div className="text-3xl font-black text-white">R$ 1.890</div>
                    <div className="text-[12px] mt-1 font-mono" style={{ color: STEEL_DIM }}>
                      em até 18x no cartão*
                    </div>
                  </div>
                  <div
                    className="p-5 rounded-sm relative"
                    style={{
                      background: `linear-gradient(135deg, ${OD_GREEN}, ${OD_DEEP})`,
                      border: `1px solid ${AMBER}`,
                      boxShadow: `0 8px 32px hsla(40, 85%, 55%, 0.2), inset 0 0 0 1px rgba(255,255,255,0.04)`,
                    }}
                  >
                    <span
                      className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-none text-[9.5px] font-black uppercase tracking-[0.2em] font-mono"
                      style={{ background: AMBER, color: GUNMETAL_2 }}
                    >
                      ▲ ELITE
                    </span>
                    <div className="text-[10.5px] font-mono uppercase tracking-[0.2em] mb-2 font-bold" style={{ color: AMBER }}>
                      Operador · VIP
                    </div>
                    <div className="text-3xl font-black text-white">R$ 2.490</div>
                    <div className="text-[12px] mt-1 font-mono" style={{ color: STEEL }}>
                      em até 18x no cartão*
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-[14px]" style={{ color: STEEL }}>
                  <div className="flex gap-3 items-center">
                    <MapPin className="w-4 h-4" style={{ color: AMBER }} />
                    <span className="font-mono">AO · JACAREÍ / SÃO JOSÉ DOS CAMPOS</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <Clock className="w-4 h-4" style={{ color: AMBER }} />
                    <span className="font-mono">H · SÁB · 07:00–19:00 (rancho 2h)</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <Users className="w-4 h-4" style={{ color: AMBER }} />
                    <span className="font-mono">PAX · MAX 05 OPERADORES / TURMA</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t" style={{ borderColor: COYOTE_DIM }}>
                  <div className="text-[10.5px] font-mono uppercase tracking-[0.22em] mb-3 font-bold" style={{ color: STEEL_DIM }}>
                    ⬢ COMUNICAÇÃO DIRETA · COMANDO
                  </div>
                  <div className="space-y-2 text-[14px]">
                    <a href={`tel:+${WPP_NUMBER}`} className="flex items-center gap-2 text-white hover:underline">
                      <Phone className="w-4 h-4" style={{ color: AMBER }} /> <span className="font-mono">{WPP_DISPLAY}</span>
                    </a>
                    <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 text-white hover:underline">
                      <Mail className="w-4 h-4" style={{ color: AMBER }} /> <span className="font-mono">{EMAIL}</span>
                    </a>
                  </div>
                  <p className="text-[10.5px] mt-4 font-mono" style={{ color: STEEL_DIM }}>
                    *Acréscimo da máquina de cartões aplicado nas parcelas.
                  </p>
                </div>
              </div>

              {/* Direita: formulário */}
              <div
                className="p-6 md:p-8 rounded-sm sticky top-6 relative overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, ${OD_DEEP}, ${GUNMETAL})`,
                  border: `1px solid ${COYOTE_DIM}`,
                  boxShadow: `0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
              >
                {/* faixa militar topo */}
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{
                    background: `repeating-linear-gradient(90deg, ${BLOOD} 0 16px, ${GUNMETAL_2} 16px 18px, ${AMBER} 18px 34px, ${GUNMETAL_2} 34px 36px)`,
                  }}
                />
                <div className="mb-5">
                  <div className="text-[10px] font-mono tracking-[0.25em] uppercase font-bold mb-1.5" style={{ color: AMBER }}>
                    [ FORMULÁRIO DE ALISTAMENTO ]
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white mb-2 uppercase tracking-tight">Reserve sua posição</h3>
                  <p className="text-[13px] font-mono" style={{ color: STEEL }}>
                    Envio protocolado · retorno do IAT em até 1 dia útil.
                  </p>
                </div>
                <InscricaoForm />

                <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: COYOTE_DIM }}>
                  <p className="text-[11.5px] mb-3 font-mono uppercase tracking-[0.15em]" style={{ color: STEEL_DIM }}>
                    » Canal direto / prioritário
                  </p>
                  <button
                    onClick={() => openWpp("vaga")}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-sm font-black text-white text-[12.5px] uppercase tracking-[0.15em] transition-all hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #128C3F, #075E2B)",
                      border: "1px solid #075E2B",
                      boxShadow: "0 6px 20px rgba(18,140,63,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Engajar no WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="py-10 text-center relative" style={{ background: "#000", borderTop: `1px solid ${OD_GREEN}` }}>
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: `repeating-linear-gradient(90deg, ${BLOOD} 0 30px, transparent 30px 50px, ${AMBER} 50px 70px, transparent 70px 90px)`,
              opacity: 0.5,
            }}
          />
          <p className="text-[13px] font-black mb-2 uppercase tracking-[0.15em]" style={{ color: AMBER }}>
            ⬢ Proteja o que é seu · Domine o que é seu · Defenda quem ama
          </p>
          <p className="text-[11px] font-mono" style={{ color: STEEL_DIM }}>
            © {new Date().getFullYear()} QUERO ARMAS · CURSO OPERADOR DE PISTOLA I · IAT WILLIAN RODRIGUES — TODOS OS DIREITOS RESERVADOS
          </p>
        </footer>
      </div>
    </>
  );
}
