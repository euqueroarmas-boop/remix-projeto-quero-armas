import { motion } from "framer-motion";
import { ShieldCheck, HardDrive, Cloud, Server, Lock, Activity, FileCheck, AlertTriangle } from "lucide-react";

const requirements = [
  {
    icon: HardDrive,
    tag: "ART. 3º, §1º",
    title: "Backup a cada 24 horas",
    description:
      "Cópias de segurança completas dos livros e atos eletrônicos em intervalos não superiores a 24 horas. Configuramos rotinas automatizadas com Veeam sobre servidores Dell PowerEdge.",
    compliance: "Backup full diário automatizado",
  },
  {
    icon: Activity,
    tag: "ART. 3º, §2º",
    title: "Cópias incrementais a cada 30 min",
    description:
      "Imagens ou cópias incrementais dos dados para recuperação dos atos praticados até pelo menos 30 minutos antes de qualquer incidente que comprometa a base.",
    compliance: "RPO máximo de 30 minutos",
  },
  {
    icon: Cloud,
    tag: "ART. 3º, §3º",
    title: "Backup local + Nuvem",
    description:
      "Cópia de segurança obrigatória em mídia eletrônica local e em serviço de backup na internet (cloud). Implementamos storage Dell PowerVault + backup em nuvem Azure.",
    compliance: "Estratégia 3-2-1 completa",
  },
  {
    icon: Lock,
    tag: "ART. 3º, §4º",
    title: "Armazenamento externo seguro",
    description:
      "Mídia eletrônica armazenada em local distinto da serventia, com segurança física e lógica garantida. Cofres digitais e replicação geográfica.",
    compliance: "Offsite storage criptografado",
  },
  {
    icon: Server,
    tag: "ART. 3º, §5º",
    title: "Tolerância a falhas",
    description:
      "Servidores Dell PowerEdge com RAID redundante, fontes hot-swap e clustering Hyper-V para garantir que nenhuma falha de hardware comprometa os dados do cartório.",
    compliance: "RAID + PSU redundante + Cluster",
  },
  {
    icon: ShieldCheck,
    tag: "SEGURANÇA",
    title: "Firewall & Antivírus gerenciado",
    description:
      "pfSense como firewall de perímetro com IDS/IPS Suricata, VPN para acesso remoto seguro, e antivírus corporativo gerenciado em todas as estações.",
    compliance: "Firewall + IDS/IPS + Antivírus",
  },
];

const classes = [
  {
    name: "Classe 1",
    revenue: "Até R$ 100 mil/semestre",
    description: "Requisitos essenciais de backup, antivírus e firewall básico.",
    percentage: "30,1% dos cartórios",
  },
  {
    name: "Classe 2",
    revenue: "R$ 100 mil a R$ 500 mil/semestre",
    description: "Requisitos da Classe 1 + servidor dedicado, RAID e monitoramento.",
    percentage: "26,5% dos cartórios",
  },
  {
    name: "Classe 3",
    revenue: "Acima de R$ 500 mil/semestre",
    description: "Requisitos completos: alta disponibilidade, redundância total e NOC.",
    percentage: "21,5% dos cartórios",
  },
];

const CartoriosSection = () => {
  return (
    <section id="cartorios" className="relative">
      {/* Hero banner */}
      <div className="section-dark py-24 border-b-4 border-primary">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <FileCheck size={20} className="text-primary" />
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary">
                // Provimento 74/2018 — CNJ
              </p>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              Seu cartório em
              <br />
              <span className="text-primary">conformidade total</span>
              <br />
              com o CNJ.
            </h2>
            <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl leading-relaxed mb-8">
              Somos especialistas em infraestrutura de TI para cartórios.
              Atendemos serventias de todo o Brasil, garantindo conformidade com
              todos os requisitos do Provimento 74/2018 do Conselho Nacional de
              Justiça.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <a
                href="https://wa.me/5511963166915?text=Olá! Gostaria de um orçamento para adequação do meu cartório ao Provimento 74 do CNJ."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <AlertTriangle size={16} />
                Adequar meu cartório
              </a>
              <a
                href="#contato"
                className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                Solicitar diagnóstico
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-px bg-gunmetal-foreground/10">
              {[
                { value: "100%", label: "Conformidade CNJ" },
                { value: "Brasil", label: "Atendimento Nacional" },
                { value: "24/7", label: "Monitoramento" },
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
      </div>

      {/* Requirements grid */}
      <div className="section-light py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Requisitos atendidos
            </p>
            <h3 className="text-2xl md:text-4xl max-w-2xl">
              Cada artigo do Provimento 74,
              <br />
              <span className="text-primary">implementado e monitorado.</span>
            </h3>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {requirements.map((req, i) => (
              <motion.div
                key={req.tag}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-background p-8 group hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <req.icon size={18} className="text-primary" strokeWidth={1.5} />
                  <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-muted-foreground border border-border px-2 py-0.5">
                    {req.tag}
                  </span>
                </div>
                <h4 className="text-base font-mono font-bold mb-3">{req.title}</h4>
                <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                  {req.description}
                </p>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <div className="w-2 h-2 rounded-full bg-green-500 led-pulse" />
                  <span className="font-mono text-[10px] text-green-600 uppercase tracking-wider">
                    {req.compliance}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Classes */}
      <div className="section-dark py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Classificação por faturamento
            </p>
            <h3 className="text-2xl md:text-4xl max-w-2xl">
              Adequação por classe
              <br />
              de serventia.
            </h3>
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
                <p className="font-mono text-xs text-gunmetal-foreground/40 mb-4">
                  {cls.percentage}
                </p>
                <p className="font-mono text-sm text-gunmetal-foreground/80 mb-3">
                  {cls.revenue}
                </p>
                <p className="font-body text-sm text-gunmetal-foreground/60 leading-relaxed">
                  {cls.description}
                </p>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 border border-gunmetal-foreground/20 p-8 md:p-12 text-center"
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Diagnóstico gratuito
            </p>
            <h3 className="text-xl md:text-3xl mb-4">
              Não sabe em qual classe sua serventia se enquadra?
            </h3>
            <p className="font-body text-gunmetal-foreground/60 max-w-xl mx-auto mb-8">
              Nossa equipe técnica faz uma análise completa da sua infraestrutura
              atual e identifica todos os pontos de adequação necessários ao
              Provimento 74.
            </p>
            <a
              href="https://wa.me/5511963166915?text=Olá! Gostaria de solicitar um diagnóstico gratuito do meu cartório para adequação ao Provimento 74 do CNJ."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
            >
              Falar com especialista via WhatsApp
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CartoriosSection;
