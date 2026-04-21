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

// ----- Tactical primitives -----
const TAC_BLUE = "hsl(215 52% 25%)";
const TAC_OLIVE = "hsl(86 23% 30%)";
const ACCENT = "hsl(14 88% 52%)"; // tactical orange/red

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px] tracking-[0.18em] uppercase font-semibold"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "hsl(45 90% 70%)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
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
      <div className="min-h-screen" style={{ background: "hsl(220 25% 6%)", color: "white" }}>
        {/* ============ HERO ============ */}
        <section className="relative min-h-[100vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img
              src={heroImg}
              alt="Operador de pistola treinado em estande de tiro profissional"
              className="w-full h-full object-cover"
              fetchPriority="high"
              width={1920}
              height={1280}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, hsl(220 30% 6% / 0.85) 0%, hsl(220 30% 6% / 0.7) 50%, hsl(220 30% 6% / 0.95) 100%)",
              }}
            />
          </div>

          <div className="container relative z-10 py-16 md:py-24 max-w-6xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-3xl"
            >
              <SectionTag>CURSO OPERADOR DE PISTOLA I · CTT-CBC</SectionTag>

              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-[1.05] mt-6 mb-6 tracking-tight">
                Quando alguém invadir sua casa,
                <br />
                <span style={{ color: "hsl(45 90% 60%)" }}>você vai estar pronto</span> —
                <br />
                ou vai depender da sorte?
              </h1>

              <p className="text-lg md:text-xl leading-relaxed mb-4" style={{ color: "hsl(220 10% 80%)" }}>
                Toda noite, milhares de famílias brasileiras dormem rezando para que <strong className="text-white">não seja a vez delas</strong>.
                A polícia chega em minutos. O criminoso age em <strong style={{ color: "hsl(14 88% 60%)" }}>segundos</strong>.
              </p>
              <p className="text-base md:text-lg leading-relaxed mb-8" style={{ color: "hsl(220 10% 70%)" }}>
                O Curso Operador de Pistola I da <strong className="text-white">Quero Armas</strong> existe para que você
                deixe de ser refém da burocracia e do despreparo, e passe a ter o <strong className="text-white">conhecimento técnico, jurídico e prático</strong>
                {" "}para defender quem você ama — com segurança, dentro da lei.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => openWpp("vaga")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-bold text-white tracking-wider uppercase text-[14px] transition-all hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, hsl(14 88% 42%))`,
                    boxShadow: "0 12px 32px hsla(14, 88%, 52%, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  <Flame className="w-4 h-4" />
                  Quero garantir minha vaga
                </button>
                <button
                  onClick={() => openWpp("duvida")}
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-md font-bold text-white tracking-wider uppercase text-[13px] transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com instrutor
                </button>
              </div>

              {/* Trust strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                {[
                  { n: "10h", l: "Prático + teórico" },
                  { n: "120", l: "Disparos reais" },
                  { n: "5", l: "Alunos / turma" },
                  { n: "100%", l: "Insumos inclusos" },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="text-2xl md:text-3xl font-bold" style={{ color: "hsl(45 90% 60%)" }}>{s.n}</div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: "hsl(220 10% 60%)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============ DOR REAL ============ */}
        <section className="py-20 md:py-28 relative overflow-hidden" style={{ background: "hsl(220 25% 5%)" }}>
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="relative">
                <img
                  src={familyImg}
                  alt="Família protegida em casa"
                  loading="lazy"
                  width={1280}
                  height={960}
                  className="rounded-lg w-full"
                  style={{ filter: "contrast(1.1)" }}
                />
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.6)" }}
                />
              </div>
              <div>
                <SectionTag>POR QUE ISSO IMPORTA</SectionTag>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mt-5 mb-6">
                  Você confiaria a vida da sua família
                  <span style={{ color: "hsl(14 88% 60%)" }}> à sorte</span>?
                </h2>
                <div className="space-y-4 text-[15px] leading-relaxed" style={{ color: "hsl(220 10% 75%)" }}>
                  <p>
                    A cada hora, dezenas de residências são invadidas no Brasil. Em <strong className="text-white">90% dos casos</strong>,
                    o morador não tinha condição técnica ou legal de reagir.
                  </p>
                  <p>
                    Você sabe atirar? Sabe a diferença entre uma munição que perfura paredes e uma que protege a sua família?
                    Sabe quando pode reagir <strong className="text-white">sem ir preso</strong>?
                  </p>
                  <p style={{ color: "hsl(45 90% 75%)", fontWeight: 600 }}>
                    Comprar uma arma não te torna preparado. <span className="text-white">Treinar te torna.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ O QUE VOCÊ APRENDE ============ */}
        <section className="py-20 md:py-28" style={{ background: "hsl(220 25% 7%)" }}>
          <div className="container max-w-6xl mx-auto px-4">
            <div className="text-center mb-14 max-w-2xl mx-auto">
              <SectionTag>CONTEÚDO PROGRAMÁTICO</SectionTag>
              <h2 className="text-3xl md:text-4xl font-bold mt-5 mb-4">
                Do primeiro disparo ao <span style={{ color: "hsl(45 90% 60%)" }}>controle absoluto</span>
              </h2>
              <p className="text-[15px]" style={{ color: "hsl(220 10% 70%)" }}>
                Conteúdo construído por instrutor credenciado CTT-CBC (XXVIII turma), aplicado de forma prática, sem enrolação.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FeatureCard icon={Shield} title="Regras essenciais de segurança">
                As 4 regras universais. Transporte, armazenamento e manuseio que evitam tragédias dentro de casa.
              </FeatureCard>
              <FeatureCard icon={Wrench} title="Funcionamento completo">
                Carregamento, descarregamento e resolução de panes (chaminé, falha de ejeção, dupla alimentação).
              </FeatureCard>
              <FeatureCard icon={Crosshair} title="Técnicas avançadas de tiro">
                Empunhadura firme, controle de gatilho ("esmagamento suave"), alinhamento de mira e postura tática real.
              </FeatureCard>
              <FeatureCard icon={Target} title="Treinamento no estande">
                Disparo real com supervisão profissional. Aprenda a controlar o recuo e executar tiros precisos sob pressão.
              </FeatureCard>
              <FeatureCard icon={BookOpen} title="Tipos de munição">
                Penetrantes vs. expansivas. Saber qual usar dentro de casa pode salvar — ou destruir — uma vida inocente.
              </FeatureCard>
              <FeatureCard icon={Zap} title="Como escolher sua pistola">
                Hammer x Striker, mecanismos de segurança, gatilhos. Pare de comprar arma errada por influência de YouTube.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* ============ MANUTENÇÃO + IMG ============ */}
        <section className="py-20 md:py-28 relative" style={{ background: "hsl(220 25% 5%)" }}>
          <div className="container max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="order-2 md:order-1">
              <SectionTag>MANUTENÇÃO E HISTÓRIA</SectionTag>
              <h2 className="text-3xl md:text-4xl font-bold mt-5 mb-6 leading-tight">
                Sua arma não é um enfeite. <br />
                Aprenda a <span style={{ color: "hsl(45 90% 60%)" }}>mantê-la operacional</span>.
              </h2>
              <ul className="space-y-3 text-[14.5px]" style={{ color: "hsl(220 10% 75%)" }}>
                {[
                  "Desmontagem e limpeza de 1º escalão (passo a passo)",
                  "Lubrificação correta para evitar travamentos críticos",
                  "História das pistolas: Hammers x Strikers e quando preferir cada uma",
                  "Rotina de inspeção que prolonga a vida útil da arma",
                ].map((t) => (
                  <li key={t} className="flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "hsl(86 50% 55%)" }} />
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
                className="rounded-lg w-full"
              />
            </div>
          </div>
        </section>

        {/* ============ INCLUSO ============ */}
        <section className="py-20 md:py-28" style={{ background: "hsl(220 25% 7%)" }}>
          <div className="container max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <SectionTag>O QUE ESTÁ INCLUSO</SectionTag>
              <h2 className="text-3xl md:text-4xl font-bold mt-5 mb-3">
                Sem letra miúda. Sem custo extra.
              </h2>
              <p style={{ color: "hsl(220 10% 70%)" }}>Tudo que você precisa para sair operador — já está pago.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { i: Clock, t: "10h de treinamento", d: "Prático + teórico, com instrutor CTT-CBC" },
                { i: Coffee, t: "Café da manhã + almoço", d: "Refeições completas, sem custo adicional" },
                { i: Target, t: "120 disparos reais", d: "Técnica nova a cada 20 disparos" },
                { i: Shield, t: "EPIs inclusos", d: "Óculos de proteção e abafadores de ruído" },
                { i: Crosshair, t: "Alvos e munições", d: "Tudo por conta da Quero Armas" },
                { i: Award, t: "Certificado de conclusão", d: "Reconhecido para POSSE, PORTE e CR" },
              ].map((it) => (
                <div
                  key={it.t}
                  className="flex gap-4 p-5 rounded-lg"
                  style={{
                    background: "hsl(220 22% 9%)",
                    border: "1px solid hsl(220 14% 16%)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TAC_BLUE}, ${TAC_OLIVE})` }}
                  >
                    <it.i className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-[14.5px]">{it.t}</div>
                    <div className="text-[13px] mt-0.5" style={{ color: "hsl(220 10% 65%)" }}>{it.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bônus */}
            <div
              className="mt-10 p-6 md:p-8 rounded-lg"
              style={{
                background: `linear-gradient(135deg, hsl(14 50% 12%), hsl(220 25% 8%))`,
                border: "1px solid hsl(14 60% 25%)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5" style={{ color: "hsl(45 90% 60%)" }} />
                <span className="font-mono text-[11px] tracking-[0.2em] uppercase font-bold" style={{ color: "hsl(45 90% 70%)" }}>
                  Bônus exclusivos
                </span>
              </div>
              <ul className="space-y-2 text-[14px]" style={{ color: "hsl(220 10% 80%)" }}>
                <li>💣 Simulações práticas de situações reais no estande</li>
                <li>💣 Acesso ao Grupo VIP no WhatsApp — tire dúvidas direto com o instrutor</li>
                <li>💣 Material didático completo: conceitos, técnicas e procedimentos detalhados</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============ PREÇO + FORM ============ */}
        <section id="inscricao" className="py-20 md:py-28" style={{ background: "hsl(220 25% 5%)" }}>
          <div className="container max-w-6xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
              {/* Esquerda: info */}
              <div>
                <SectionTag>RESERVE SUA VAGA</SectionTag>
                <h2 className="text-3xl md:text-4xl font-bold mt-5 mb-6 leading-tight">
                  Vagas <span style={{ color: "hsl(14 88% 60%)" }}>limitadas a 5 alunos</span> por turma.
                </h2>
                <p className="text-[15px] mb-8" style={{ color: "hsl(220 10% 75%)" }}>
                  Turmas pequenas garantem acompanhamento individual real. Não é curso de massa — é treinamento sério com quem precisa
                  estar pronto.
                </p>

                {/* Pricing cards */}
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div
                    className="p-5 rounded-lg"
                    style={{
                      background: "hsl(220 22% 9%)",
                      border: "1px solid hsl(220 14% 18%)",
                    }}
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "hsl(220 10% 60%)" }}>
                      Turma Padrão
                    </div>
                    <div className="text-3xl font-bold text-white">R$ 1.890</div>
                    <div className="text-[12px] mt-1" style={{ color: "hsl(220 10% 60%)" }}>
                      em até 18x no cartão*
                    </div>
                  </div>
                  <div
                    className="p-5 rounded-lg relative"
                    style={{
                      background: `linear-gradient(135deg, hsl(220 30% 12%), hsl(220 22% 9%))`,
                      border: `1px solid hsl(45 90% 50%)`,
                      boxShadow: "0 8px 24px hsla(45, 90%, 50%, 0.15)",
                    }}
                  >
                    <span
                      className="absolute -top-2.5 right-4 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "hsl(45 90% 55%)", color: "hsl(220 30% 10%)" }}
                    >
                      Recomendado
                    </span>
                    <div className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "hsl(45 90% 70%)" }}>
                      Turma VIP
                    </div>
                    <div className="text-3xl font-bold text-white">R$ 2.490</div>
                    <div className="text-[12px] mt-1" style={{ color: "hsl(220 10% 65%)" }}>
                      em até 18x no cartão*
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-[14px]" style={{ color: "hsl(220 10% 75%)" }}>
                  <div className="flex gap-3 items-center">
                    <MapPin className="w-4 h-4" style={{ color: "hsl(45 90% 60%)" }} />
                    <span>Jacareí ou São José dos Campos</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <Clock className="w-4 h-4" style={{ color: "hsl(45 90% 60%)" }} />
                    <span>Sábados, das 7h às 19h (com 2h de almoço)</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <Users className="w-4 h-4" style={{ color: "hsl(45 90% 60%)" }} />
                    <span>Máximo 5 alunos por turma</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "hsl(220 10% 55%)" }}>
                    Contato direto
                  </div>
                  <div className="space-y-2 text-[14px]">
                    <a href={`tel:+${WPP_NUMBER}`} className="flex items-center gap-2 text-white hover:underline">
                      <Phone className="w-4 h-4" /> {WPP_DISPLAY}
                    </a>
                    <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 text-white hover:underline">
                      <Mail className="w-4 h-4" /> {EMAIL}
                    </a>
                  </div>
                  <p className="text-[10.5px] mt-4" style={{ color: "hsl(220 10% 50%)" }}>
                    *Acréscimo da máquina de cartões aplicado nas parcelas.
                  </p>
                </div>
              </div>

              {/* Direita: formulário */}
              <div
                className="p-6 md:p-8 rounded-xl sticky top-6"
                style={{
                  background: "linear-gradient(180deg, hsl(220 25% 9%), hsl(220 25% 7%))",
                  border: "1px solid hsl(220 14% 20%)",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                }}
              >
                <div className="mb-5">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Garanta sua vaga</h3>
                  <p className="text-[13px]" style={{ color: "hsl(220 10% 65%)" }}>
                    Preencha abaixo e nosso instrutor entra em contato em até 1 dia útil.
                  </p>
                </div>
                <InscricaoForm />

                <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <p className="text-[12px] mb-3" style={{ color: "hsl(220 10% 60%)" }}>Prefere conversar agora?</p>
                  <button
                    onClick={() => openWpp("vaga")}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md font-bold text-white text-[13px]"
                    style={{ background: "#25D366" }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Falar pelo WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="py-10 text-center" style={{ background: "hsl(220 30% 4%)", borderTop: "1px solid hsl(220 14% 12%)" }}>
          <p className="text-[13px] font-bold mb-2" style={{ color: "hsl(45 90% 60%)" }}>
            🛡️ Proteja o que é seu. Domine o que é seu. Tenha o direito de defender quem ama.
          </p>
          <p className="text-[11px]" style={{ color: "hsl(220 10% 45%)" }}>
            © {new Date().getFullYear()} Quero Armas — Curso Operador de Pistola I · Todos os direitos reservados.
          </p>
        </footer>
      </div>
    </>
  );
}
