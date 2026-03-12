import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  HardDrive,
  Cloud,
  Server,
  Lock,
  Activity,
  FileCheck,
  AlertTriangle,
  Zap,
  Network,
  Eye,
  KeyRound,
  FileWarning,
  Clock,
  BookOpen,
  Database,
  Wifi,
  Shield,
  Users,
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const etapas = [
  {
    number: "01",
    title: "Governança e Conformidade Legal",
    prazo: "90 a 210 dias",
    icon: BookOpen,
    items: [
      "Designação de responsável técnico e DPO",
      "Política de Segurança da Informação (Anexo III)",
      "Autenticação multifator (MFA) obrigatória",
      "Inventário completo de ativos tecnológicos",
      "Revisão contratual com cláusulas LGPD",
      "Registro de operações de tratamento de dados",
    ],
    servicos: [
      "Elaboração da Política de Segurança da Informação",
      "Implantação de MFA com Microsoft 365 / Entra ID",
      "Inventário e auditoria de ativos de TI",
      "Consultoria LGPD para cartórios",
    ],
  },
  {
    number: "02",
    title: "Infraestrutura e Continuidade",
    prazo: "Incluso nos prazos da Etapa 1",
    icon: Server,
    items: [
      "Infraestrutura energética com UPS/nobreak (30 min)",
      "Aterramento técnico com laudo ART",
      "Ambiente físico isolado com controle de acesso",
      "Conectividade compatível com a classe",
      "PCN e PRD formalizados com RTO/RPO",
      "Proteção de endpoint em todas as estações",
    ],
    servicos: [
      "Servidores Dell PowerEdge com RAID redundante",
      "Nobreaks APC com autonomia estendida",
      "Projeto elétrico com aterramento e laudo",
      "Elaboração de PCN e PRD sob medida",
    ],
  },
  {
    number: "03",
    title: "Proteção do Acervo Digital",
    prazo: "Progressivo até 24-36 meses",
    icon: Lock,
    items: [
      "Criptografia AES-256 em trânsito e repouso",
      "Backup full + incremental automatizado",
      "Armazenamento off-site com redundância geográfica",
      "Firewall stateful com IPS/IDS (pfSense + Suricata)",
      "SGBD com integridade transacional e logs",
      "Trilhas de auditoria imutáveis com NTP",
    ],
    servicos: [
      "pfSense Enterprise com IDS/IPS Suricata",
      "Backup Veeam + Dell PowerVault + Azure",
      "Criptografia de disco com BitLocker/LUKS",
      "Monitoramento 24/7 com alertas automáticos",
    ],
  },
  {
    number: "04",
    title: "Monitoramento e Auditoria",
    prazo: "Progressivo conforme classe",
    icon: Eye,
    items: [
      "Relatório de conformidade de trilhas de auditoria",
      "Gestão formal de vulnerabilidades (30 dias/72h)",
      "Testes documentados de restauração de backups",
      "Simulação anual de cenário de desastre",
      "Pentest bienal para Classe 3",
      "Análise de causa raiz para incidentes",
    ],
    servicos: [
      "NOC com monitoramento contínuo (Zabbix/PRTG)",
      "Varredura de vulnerabilidades periódica",
      "Testes de restauração documentados",
      "Simulação de DR com relatório técnico",
    ],
  },
  {
    number: "05",
    title: "Interoperabilidade e Governança Evolutiva",
    prazo: "Conclusão integral",
    icon: Network,
    items: [
      "Integração com plataformas de fiscalização",
      "Padrões abertos (PDF/A, XML) e neutralidade tecnológica",
      "Capacitação periódica com registro formal",
      "Portabilidade e reversibilidade de dados",
      "Simulação de extração integral do acervo",
      "Registros auditáveis por mínimo 5 anos",
    ],
    servicos: [
      "Consultoria em interoperabilidade e integração",
      "Treinamento de equipe com certificado",
      "Plano de portabilidade e migração de dados",
      "Revisão periódica da Política de Segurança",
    ],
  },
];

const classes = [
  {
    name: "Classe 1",
    revenue: "Até R$ 100 mil/semestre",
    rpo: "24 horas",
    rto: "24 horas",
    backupFull: "A cada 72 horas",
    prazoInicial: "210 dias",
    prazoTotal: "36 meses",
    highlights: [
      "Backup periódico testado",
      "Antivírus + Firewall básico",
      "Relatório simplificado",
      "PCN/PRD documentados",
    ],
  },
  {
    name: "Classe 2",
    revenue: "R$ 100 mil a R$ 500 mil/semestre",
    rpo: "12 horas",
    rto: "24 horas",
    backupFull: "A cada 48 horas",
    prazoInicial: "150 dias",
    prazoTotal: "30 meses",
    highlights: [
      "VLANs obrigatórias",
      "Firewall stateful + IDS/IPS",
      "Dossiê técnico com hash",
      "Tolerância a falhas",
    ],
  },
  {
    name: "Classe 3",
    revenue: "Acima de R$ 500 mil/semestre",
    rpo: "4 horas",
    rto: "8 horas",
    backupFull: "A cada 24 horas",
    prazoInicial: "90 dias",
    prazoTotal: "24 meses",
    highlights: [
      "Alta disponibilidade (HA)",
      "Pentest bienal obrigatório",
      "SIEM / correlação de logs",
      "Monitoramento contínuo",
    ],
  },
];

const diferenciais = [
  {
    icon: Server,
    title: "Dell PowerEdge",
    description: "Servidores com RAID, fontes redundantes e clustering Hyper-V para alta disponibilidade.",
  },
  {
    icon: Shield,
    title: "pfSense + Suricata",
    description: "Firewall stateful com IDS/IPS, VPN site-to-site e segmentação de rede com VLANs.",
  },
  {
    icon: Cloud,
    title: "Backup 3-2-1",
    description: "Veeam + Dell PowerVault local + replicação Azure com imutabilidade e criptografia AES-256.",
  },
  {
    icon: KeyRound,
    title: "Microsoft 365 & Entra ID",
    description: "MFA corporativo, gestão de identidades, licenciamento regular e compliance integrado.",
  },
  {
    icon: Activity,
    title: "NOC 24/7",
    description: "Monitoramento contínuo com Zabbix/PRTG, alertas automáticos e resposta a incidentes.",
  },
  {
    icon: FileCheck,
    title: "Documentação Completa",
    description: "PCN, PRD, dossiê técnico, laudos ART e relatórios de conformidade prontos para fiscalização.",
  },
];

const Provimento213 = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="section-dark pt-28 pb-24 border-b-4 border-primary">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/50 hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft size={14} />
              Voltar ao início
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={20} className="text-primary" />
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary">
                // Provimento 213/2026 — CNJ
              </p>
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              Novo padrão nacional
              <br />
              de <span className="text-primary">segurança digital</span>
              <br />
              para cartórios.
            </h1>

            <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl leading-relaxed mb-8">
              O Provimento 213/2026 revoga o Provimento 74/2018 e estabelece
              requisitos obrigatórios de TIC para todas as serventias
              extrajudiciais do Brasil. A WMTi implementa cada etapa com
              infraestrutura Dell, Microsoft e pfSense.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <a
                href="https://wa.me/5511963166915?text=Olá! Gostaria de um orçamento para adequação do meu cartório ao Provimento 213 do CNJ."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <MessageCircle size={16} />
                Solicitar adequação
              </a>
              <a
                href="https://atos.cnj.jus.br/atos/detalhar/6734"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                Ler provimento completo
              </a>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gunmetal-foreground/10">
              {[
                { value: "5", label: "Etapas obrigatórias" },
                { value: "3", label: "Classes de serventia" },
                { value: "90d", label: "Prazo mín. Classe 3" },
                { value: "36m", label: "Prazo máx. total" },
              ].map((stat) => (
                <div key={stat.label} className="bg-secondary p-5 text-center">
                  <p className="font-mono text-2xl md:text-3xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <p className="font-body text-xs text-gunmetal-foreground/50 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* O que muda */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16 max-w-3xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // O que muda
            </p>
            <h2 className="text-2xl md:text-4xl mb-6">
              Muito além de backup:
              <br />
              <span className="text-primary">governança digital obrigatória.</span>
            </h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              O Provimento 213/2026 vai muito além do antigo Provimento 74. Agora é
              obrigatório ter políticas formais de segurança, planos de
              continuidade (PCN/PRD), criptografia, trilhas de auditoria imutáveis,
              gestão de vulnerabilidades e testes de intrusão. A responsabilidade é
              pessoal do titular da serventia, mesmo com TI terceirizada.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {[
              {
                icon: FileWarning,
                title: "Responsabilidade Pessoal",
                text: "O titular responde pessoalmente pelo cumprimento, mesmo usando sistemas terceirizados ou em nuvem.",
              },
              {
                icon: Clock,
                title: "Prazos Definidos",
                text: "De 90 a 210 dias para as etapas iniciais, com implementação total em até 24-36 meses conforme a classe.",
              },
              {
                icon: Lock,
                title: "Criptografia Obrigatória",
                text: "AES-256 ou superior para dados em trânsito, repouso e backups. Vedados algoritmos obsoletos.",
              },
              {
                icon: Eye,
                title: "Trilhas Imutáveis",
                text: "Logs protegidos contra alteração, com retenção mínima de 5 anos e sincronização NTP.",
              },
              {
                icon: Zap,
                title: "RPO e RTO Definidos",
                text: "Parâmetros obrigatórios de perda máxima de dados (RPO) e tempo de recuperação (RTO) por classe.",
              },
              {
                icon: Users,
                title: "LGPD Integrada",
                text: "Conformidade com Lei 13.709/2018 é requisito explícito: DPO, registro de tratamento e gestão de incidentes.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-background p-8 group hover:bg-muted transition-colors"
              >
                <item.icon size={18} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="text-base font-mono font-bold mb-3">{item.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="section-dark py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Classificação por faturamento
            </p>
            <h2 className="text-2xl md:text-4xl max-w-2xl">
              Requisitos proporcionais
              <br />
              à <span className="text-primary">classe da serventia.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-px bg-gunmetal-foreground/10">
            {classes.map((cls, i) => (
              <motion.div
                key={cls.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-secondary p-8"
              >
                <p className="font-mono text-2xl font-bold text-primary mb-1">
                  {cls.name}
                </p>
                <p className="font-mono text-sm text-gunmetal-foreground/80 mb-4">
                  {cls.revenue}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-gunmetal-foreground/50">RPO máximo</span>
                    <span className="text-primary font-bold">{cls.rpo}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-gunmetal-foreground/50">RTO máximo</span>
                    <span className="text-primary font-bold">{cls.rto}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-gunmetal-foreground/50">Backup full</span>
                    <span className="text-gunmetal-foreground font-bold">{cls.backupFull}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-gunmetal-foreground/50">Prazo inicial</span>
                    <span className="text-gunmetal-foreground font-bold">{cls.prazoInicial}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-gunmetal-foreground/50">Prazo total</span>
                    <span className="text-gunmetal-foreground font-bold">{cls.prazoTotal}</span>
                  </div>
                </div>

                <div className="border-t border-gunmetal-foreground/10 pt-4 space-y-2">
                  {cls.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-primary shrink-0" />
                      <span className="font-body text-xs text-gunmetal-foreground/70">{h}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Etapas */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Roadmap de adequação
            </p>
            <h2 className="text-2xl md:text-4xl max-w-3xl">
              5 etapas obrigatórias.
              <br />
              <span className="text-primary">Implementamos todas.</span>
            </h2>
          </motion.div>

          <div className="space-y-px">
            {etapas.map((etapa, i) => (
              <motion.div
                key={etapa.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-muted border border-border"
              >
                <div className="p-8 md:p-10">
                  <div className="flex items-start gap-6 mb-6">
                    <div className="flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground font-mono text-xl font-bold shrink-0">
                      {etapa.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg md:text-xl font-mono font-bold">
                          {etapa.title}
                        </h3>
                        <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground border border-border px-2 py-0.5">
                          {etapa.prazo}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8 ml-0 md:ml-20">
                    {/* Requisitos */}
                    <div>
                      <p className="font-mono text-xs tracking-wider uppercase text-primary mb-4">
                        Requisitos do CNJ
                      </p>
                      <ul className="space-y-2">
                        {etapa.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span className="font-body text-sm text-muted-foreground">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Nossos serviços */}
                    <div>
                      <p className="font-mono text-xs tracking-wider uppercase text-primary mb-4">
                        Como a WMTi atende
                      </p>
                      <ul className="space-y-2">
                        {etapa.servicos.map((s) => (
                          <li key={s} className="flex items-start gap-2">
                            <CheckCircle2
                              size={14}
                              className="text-primary mt-0.5 shrink-0"
                            />
                            <span className="font-body text-sm text-foreground font-medium">
                              {s}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="section-dark py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Stack tecnológico
            </p>
            <h2 className="text-2xl md:text-4xl max-w-2xl">
              Infraestrutura de
              <br />
              <span className="text-primary">nível enterprise.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-gunmetal-foreground/10">
            {diferenciais.map((dif, i) => (
              <motion.div
                key={dif.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-secondary p-8"
              >
                <dif.icon size={20} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-mono text-base font-bold mb-3">{dif.title}</h3>
                <p className="font-body text-sm text-gunmetal-foreground/60 leading-relaxed">
                  {dif.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div
            {...fadeIn}
            className="border border-border p-8 md:p-16 text-center"
          >
            <AlertTriangle size={32} className="text-primary mx-auto mb-6" />
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Adequação obrigatória
            </p>
            <h2 className="text-xl md:text-3xl mb-4">
              O prazo para Classe 3 já começou.
              <br />
              <span className="text-primary">90 dias para as primeiras etapas.</span>
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              O descumprimento pode gerar procedimento administrativo
              disciplinar, além de responsabilidades civis e penais. A WMTi
              faz um diagnóstico gratuito da sua serventia e apresenta um
              plano completo de adequação.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://wa.me/5511963166915?text=Olá! Preciso adequar meu cartório ao Provimento 213 do CNJ. Gostaria de um diagnóstico gratuito."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <MessageCircle size={16} />
                Diagnóstico gratuito via WhatsApp
              </a>
              <a
                href="mailto:contato@wmti.com.br"
                className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                contato@wmti.com.br
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Provimento213;
