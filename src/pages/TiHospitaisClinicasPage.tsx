import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, CheckCircle2, MessageCircle,
  Server, Shield, HardDrive, Lock, Activity, Wifi,
  Network, Cloud, Monitor, Heart, AlertTriangle, Database,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import hospitalServerRoom from "@/assets/hospital-server-room.jpg";
import hospitalTech from "@/assets/hospital-tech.jpg";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const whatsappMsg = "Olá! Gostaria de um diagnóstico de infraestrutura de TI para minha clínica/hospital.";

const painPoints = [
  { icon: Monitor, text: "Sistemas médicos lentos ou travando" },
  { icon: Database, text: "Perda de exames e prontuários eletrônicos" },
  { icon: AlertTriangle, text: "Ataques ransomware em instituições de saúde" },
  { icon: Server, text: "Falta de redundância de servidores e internet" },
  { icon: HardDrive, text: "Falhas de backup sem recuperação garantida" },
  { icon: Lock, text: "Risco de vazamento de dados médicos (LGPD)" },
];

const solutions = [
  {
    icon: Server,
    title: "Infraestrutura de Servidores",
    desc: "Servidores Dell PowerEdge com virtualização e alta disponibilidade, dimensionados para sistemas médicos como HIS, PACS e RIS.",
    specs: ["Dell PowerEdge R750xs / T550", "Virtualização Hyper-V", "Alta disponibilidade e clustering", "Performance para PACS/DICOM"],
  },
  {
    icon: Shield,
    title: "Segurança da Rede",
    desc: "Firewall pfSense com IDS/IPS Suricata, segmentação de rede por VLANs, VPN segura e proteção contra ransomware.",
    specs: ["Firewall pfSense + Suricata", "Segmentação por VLANs", "VPN site-to-site e remota", "Proteção anti-ransomware"],
  },
  {
    icon: HardDrive,
    title: "Backup Médico Automatizado",
    desc: "Backup local e externo com Veeam, estratégia 3-2-1, recuperação rápida de dados e testes de restauração periódicos.",
    specs: ["Veeam Backup & Replication", "Backup local + nuvem Azure", "RPO e RTO definidos", "Testes de restauração mensais"],
  },
  {
    icon: Activity,
    title: "Monitoramento da Infraestrutura",
    desc: "Monitoramento preventivo 24/7 com Zabbix e alertas automáticos para identificação rápida de falhas.",
    specs: ["Monitoramento Zabbix 24/7", "Alertas automáticos", "NOC próprio", "Suporte técnico especializado"],
  },
  {
    icon: Cloud,
    title: "Microsoft 365 para Equipes Médicas",
    desc: "E-mail corporativo seguro, colaboração com Teams, armazenamento em nuvem OneDrive e SharePoint para documentos médicos.",
    specs: ["Exchange Online seguro", "Microsoft Teams para equipes", "OneDrive e SharePoint", "Compliance e auditoria"],
  },
  {
    icon: Network,
    title: "Rede Estruturada Hospitalar",
    desc: "Cabeamento Cat6A, switches Dell gerenciáveis, Wi-Fi enterprise com cobertura total e VLANs para separação de tráfego.",
    specs: ["Cabeamento Cat6A certificado", "Switches Dell gerenciáveis", "Wi-Fi enterprise UniFi", "VLANs para PACS e dados"],
  },
];

const benefits = [
  { icon: Heart, title: "Continuidade do atendimento", text: "Infraestrutura redundante garante que sistemas médicos nunca parem." },
  { icon: Lock, title: "Proteção de prontuários", text: "Criptografia AES-256 em trânsito e repouso para dados de pacientes." },
  { icon: Activity, title: "Redução de falhas", text: "Monitoramento proativo reduz em até 90% as paradas não planejadas." },
  { icon: Shield, title: "Defesa contra ataques", text: "Firewall, IDS/IPS e anti-ransomware protegem contra ameaças digitais." },
  { icon: Server, title: "Infraestrutura confiável", text: "Servidores Dell enterprise com garantia e suporte direto do fabricante." },
  { icon: Database, title: "Conformidade LGPD", text: "Medidas técnicas e organizacionais para proteção de dados sensíveis de saúde." },
];

const faq = [
  { question: "Clínicas precisam de servidor próprio?", answer: "Depende do porte. Para clínicas com mais de 5 estações e sistemas como prontuário eletrônico e PACS, um servidor dedicado Dell PowerEdge garante performance, segurança e backup centralizado. Para consultórios menores, soluções em nuvem podem ser suficientes." },
  { question: "Como proteger prontuários eletrônicos?", answer: "Implementamos backup automatizado com criptografia AES-256, controle de acesso por perfil de usuário, firewall com IDS/IPS, antivírus gerenciado e logs de auditoria — tudo em conformidade com a LGPD para dados sensíveis de saúde." },
  { question: "Clínicas são alvo de ransomware?", answer: "Sim. Instituições de saúde são alvos prioritários de ransomware porque possuem dados sensíveis e alta urgência para restabelecer sistemas. Implementamos defesa em camadas: firewall pfSense, segmentação de rede, backup isolado e plano de resposta a incidentes." },
  { question: "Como garantir backup seguro de exames e dados médicos?", answer: "Utilizamos a estratégia 3-2-1: três cópias dos dados, em dois tipos de mídia diferentes, com uma cópia externa (nuvem Azure). O backup é automatizado, criptografado e testado mensalmente para garantir recuperação rápida." },
  { question: "Por que redundância de internet é importante em clínicas?", answer: "Sistemas médicos modernos dependem de conexão constante para prontuário eletrônico, telemedicina e integração com laboratórios. Implementamos failover automático com duas ou mais conexões para garantir disponibilidade contínua." },
];

const TiHospitaisClinicasPage = () => {
  useEffect(() => {
    document.title = "Infraestrutura de TI para Hospitais e Clínicas | WMTi";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Soluções de infraestrutura de TI para hospitais e clínicas médicas. Servidores, segurança, backup e monitoramento para garantir estabilidade e proteção de dados.");
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero with image */}
      <section className="relative pt-14 md:pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={hospitalTech} alt="Tecnologia em hospitais" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-secondary/90" />
        </div>
        <div className="relative container py-20 md:py-32">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft size={14} /> Voltar ao início
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// TI para Saúde</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              Infraestrutura de TI para Hospitais e{" "}
              <span className="text-primary">Clínicas Médicas</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-8">
              Tecnologia segura e estável para garantir continuidade do atendimento, proteção de dados médicos e operação sem interrupções.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <MessageCircle size={16} /> Solicitar diagnóstico
              </a>
              <a
                href="#contato-saude"
                className="inline-flex items-center gap-2 border border-muted-foreground/30 text-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                Falar com especialista
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Introduction */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Por que TI para saúde é crítica</p>
              <h2 className="text-2xl md:text-3xl mb-6">
                Hospitais e clínicas não podem <span className="text-primary">parar.</span>
              </h2>
              <div className="font-body text-muted-foreground leading-relaxed space-y-4">
                <p>
                  Instituições de saúde dependem fortemente da tecnologia para funcionar. Prontuários eletrônicos, sistemas de imagens médicas (PACS/DICOM), agendamento, faturamento e telemedicina exigem uma infraestrutura robusta, segura e sempre disponível.
                </p>
                <p>
                  Uma falha no servidor pode impedir o acesso a prontuários durante uma emergência. Um ataque ransomware pode paralisar todo o hospital. Um backup mal configurado pode significar a perda irreversível de dados de pacientes.
                </p>
                <p>
                  A WMTi é especialista em projetar e manter infraestrutura de TI para o setor de saúde, com foco em disponibilidade contínua, segurança de dados e conformidade com a LGPD.
                </p>
              </div>
            </motion.div>
            <motion.div {...fadeIn} className="relative">
              <img
                src={hospitalServerRoom}
                alt="Sala de servidores para hospitais"
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-secondary/90 p-4">
                <p className="font-mono text-xs text-primary">// INFRAESTRUTURA CRÍTICA</p>
                <p className="font-body text-sm text-muted-foreground">Servidores Dell dimensionados para sistemas médicos</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive mb-4">// Riscos comuns</p>
            <h2 className="text-2xl md:text-4xl">
              Problemas de TI em <span className="text-primary">clínicas e hospitais</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {painPoints.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-secondary p-8"
              >
                <p.icon size={20} className="text-destructive mb-4" strokeWidth={1.5} />
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Como a WMTi resolve</p>
            <h2 className="text-2xl md:text-4xl">
              Soluções completas para <span className="text-primary">infraestrutura médica</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {solutions.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="border border-border p-8 hover:border-primary/40 transition-colors"
              >
                <s.icon size={24} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-3">{s.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                <ul className="space-y-2">
                  {s.specs.map((spec) => (
                    <li key={spec} className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-primary shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">{spec}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Benefícios</p>
            <h2 className="text-2xl md:text-4xl">
              Por que escolher a <span className="text-primary">WMTi</span> para sua clínica
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-secondary p-8"
              >
                <b.icon size={20} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-mono text-sm font-bold mb-2">{b.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{b.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* LGPD Section */}
      <section className="section-light py-16 md:py-24">
        <div className="container max-w-4xl">
          <motion.div {...fadeIn}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// LGPD e proteção de dados</p>
            <h2 className="text-2xl md:text-3xl mb-6">
              Proteção de dados de <span className="text-primary">pacientes</span>
            </h2>
            <div className="font-body text-muted-foreground leading-relaxed space-y-4">
              <p>
                A Lei Geral de Proteção de Dados (LGPD) classifica dados de saúde como <strong className="text-foreground">dados pessoais sensíveis</strong>, exigindo medidas técnicas e organizacionais reforçadas para seu tratamento.
              </p>
              <p>
                Clínicas e hospitais que não protegem adequadamente prontuários eletrônicos, resultados de exames e dados cadastrais de pacientes estão sujeitos a sanções que incluem multas de até 2% do faturamento.
              </p>
              <p>
                A WMTi implementa as medidas técnicas exigidas pela LGPD: <strong className="text-foreground">criptografia de dados em trânsito e repouso</strong>, controle de acesso granular por perfil de usuário, backup criptografado com testes de restauração, firewall com logs de auditoria e plano documentado de resposta a incidentes de segurança.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              {[
                { label: "Criptografia AES-256", desc: "Dados protegidos em trânsito e repouso" },
                { label: "Controle de acesso", desc: "Perfis granulares por função" },
                { label: "Auditoria completa", desc: "Logs de acesso e alterações" },
              ].map((item) => (
                <div key={item.label} className="border border-border p-4">
                  <p className="font-mono text-xs font-bold text-primary mb-1">{item.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Perguntas frequentes</p>
            <h2 className="text-2xl md:text-4xl">FAQ — TI para Saúde</h2>
          </motion.div>
          <div className="space-y-px">
            {faq.map((item, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-secondary group"
              >
                <summary className="p-6 cursor-pointer font-mono text-sm font-bold hover:text-primary transition-colors list-none flex justify-between items-center">
                  {item.question}
                  <ArrowRight size={16} className="text-primary group-open:rotate-90 transition-transform shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato-saude" className="section-light py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-2xl md:text-4xl mb-4">
              Avalie a infraestrutura de TI da sua <span className="text-primary">clínica</span>
            </h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Nossa equipe pode realizar uma análise técnica da infraestrutura da sua clínica ou hospital e indicar melhorias para garantir estabilidade, segurança e continuidade dos serviços.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <MessageCircle size={16} /> Solicitar diagnóstico de TI
              </a>
              <a
                href="https://wa.me/5511963166915"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                Falar no WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Related services */}
      <section className="section-dark py-12 border-t border-border">
        <div className="container">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">// Serviços relacionados</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Infraestrutura corporativa", href: "/infraestrutura-ti-corporativa-jacarei" },
              { label: "Backup empresarial", href: "/backup-empresarial-jacarei" },
              { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
              { label: "Diagnóstico TI", href: "/diagnostico-ti-empresarial" },
              { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="inline-flex items-center gap-2 border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {link.label} <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default TiHospitaisClinicasPage;
