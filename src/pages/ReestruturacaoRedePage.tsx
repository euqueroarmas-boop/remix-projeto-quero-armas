import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Monitor, ShieldCheck, Server, HardDrive, Network, FolderLock,
  CheckCircle2, Star, ArrowRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";

const deliverables = [
  {
    icon: Monitor,
    title: "Padronização Completa Dos Equipamentos",
    items: [
      "Formatação de todos os computadores e notebooks com Windows 11 Pro",
      "Otimização de performance e padronização corporativa",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Proteção Avançada",
    items: [
      "Remoção total de vírus, malwares e ameaças ocultas",
      "Implantação de antivírus corporativo com proteção ativa",
    ],
  },
  {
    icon: Server,
    title: "Servidor Corporativo Com Windows Server 2016",
    items: [
      "Implantação completa do servidor",
      "Active Directory com controle total da rede",
      "Criação de usuários, grupos e permissões",
      "Políticas de segurança (GPO)",
      "Pastas auditadas e monitoradas",
      "Centralização total da gestão",
    ],
  },
  {
    icon: HardDrive,
    title: "Backup Profissional E Restauração Segura",
    items: [
      "Backup completo antes de qualquer intervenção",
      "Armazenamento em servidor seguro fornecido por nós ou em nuvem",
      "Devolução dos arquivos totalmente limpos e organizados",
    ],
  },
  {
    icon: Network,
    title: "Reconfiguração Completa Da Rede",
    items: [
      "Instalação de programas, impressoras e sistemas",
      "Integração com banco de dados",
      "Configuração de backups automáticos",
      "Estruturação de rede corporativa profissional",
    ],
  },
  {
    icon: FolderLock,
    title: "Organização E Controle De Acesso",
    items: [
      "Organização de pastas por setor com controle de acesso",
      "Permissões granulares por usuário e grupo",
    ],
  },
];

const ReestruturacaoRedePage = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Reestruturação Completa De Rede Corporativa",
    provider: { "@type": "Organization", name: "WMTi Tecnologia da Informação" },
    description: "Pacote premium sem limite de horas para reestruturação completa de rede corporativa — servidores, segurança, backup e padronização.",
    areaServed: { "@type": "Country", name: "BR" },
  };

  return (
    <>
      <SeoHead
        title="Reestruturação Completa De Rede Corporativa | WMTi"
        description="Pacote premium sem limite de horas. Servidores, Active Directory, backup, antivírus, padronização e reconfiguração completa da rede corporativa."
        canonical="/reestruturacao-completa-de-rede-corporativa"
      />
      <JsonLd data={jsonLd} />
      <Navbar />

      <main className="min-h-screen bg-background pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[140px]" />
          </div>
          <div className="container relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Pacote Premium — Sem Limite De Horas</p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl max-w-4xl mb-6">
                Reestruturação Completa De{" "}
                <span className="text-primary">Rede Corporativa</span>
              </h1>
              <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                Transformamos sua rede em uma estrutura profissional, segura e altamente confiável. Se sua empresa enfrenta lentidão, vírus constantes, perda de arquivos ou falta de controle — este serviço resolve tudo de forma definitiva.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="https://wa.me/5512981156856?text=Olá!%20Tenho%20interesse%20no%20pacote%20de%20Reestruturação%20Completa%20de%20Rede%20Corporativa."
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  Solicitar Proposta <ArrowRight size={16} />
                </a>
                <Link
                  to="/orcamento-ti"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-mono text-sm uppercase tracking-wider hover:bg-muted transition-colors"
                >
                  Orçamento Online
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Diferencial */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
                <Star size={16} className="text-primary" />
                <span className="font-mono text-xs uppercase tracking-wider text-primary">Diferencial Absoluto</span>
              </div>
              <h2 className="text-2xl md:text-4xl mb-4">
                Pacote fechado — <span className="text-primary">sem limite de horas.</span>
              </h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">
                Você não paga por tempo. <strong className="text-foreground">Você paga pelo resultado.</strong> Nosso objetivo é colocar sua empresa dentro dos padrões mais exigentes de segurança, estabilidade e controle.
              </p>
            </motion.div>
          </div>
        </section>

        {/* O que entregamos */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// O Que Entregamos</p>
            <h2 className="text-2xl md:text-4xl mb-12">Escopo completo do serviço</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
              {deliverables.map((block, i) => {
                const Icon = block.icon;
                return (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-background p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={20} className="text-primary" strokeWidth={1.5} />
                      <h3 className="text-base md:text-lg font-heading">{block.title}</h3>
                    </div>
                    <ul className="space-y-2">
                      {block.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                          <span className="font-body text-sm text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Resultado final */}
        <section className="py-16 md:py-24 border-t border-border">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="text-2xl md:text-4xl mb-4">Após esse serviço, a forma como sua empresa trabalha <span className="text-primary">muda completamente.</span></h2>
              <p className="font-body text-base text-muted-foreground mb-8">
                Segurança, estabilidade, controle de usuários e organização de dados — tudo em padrão corporativo profissional.
              </p>
              <a
                href="https://wa.me/5512981156856?text=Olá!%20Quero%20saber%20mais%20sobre%20a%20Reestruturação%20Completa%20de%20Rede."
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                Fale com um especialista <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default ReestruturacaoRedePage;
