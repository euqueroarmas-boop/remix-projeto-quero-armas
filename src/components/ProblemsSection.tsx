import { motion } from "framer-motion";
import {
  Thermometer,
  HardDrive,
  Wifi,
  Bug,
  Clock,
  AlertTriangle,
  ShieldX,
  Cpu,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import slowComputer from "@/assets/slow-computer.webp";
import MobileSummary from "@/components/MobileSummary";

const problems = [
  {
    icon: Thermometer,
    title: "Superaquecimento",
    desc: "Pasta térmica ressecada e coolers obstruídos por poeira causam travamentos, desligamentos e reduzem a vida útil do processador.",
    solution: "Limpeza interna preventiva + troca de pasta térmica profissional.",
  },
  {
    icon: HardDrive,
    title: "HD Lento ou Defeituoso",
    desc: "Discos rígidos mecânicos degradam com o tempo, causando lentidão extrema na inicialização e abertura de programas.",
    solution: "Upgrade para SSD NVMe — até 10x mais velocidade.",
  },
  {
    icon: Bug,
    title: "Vírus e Malware",
    desc: "Sistemas sem antivírus corporativo ficam vulneráveis a ransomware, roubo de dados e lentidão por processos ocultos.",
    solution: "Implantação de endpoint protection com monitoramento 24/7.",
  },
  {
    icon: Wifi,
    title: "Rede Instável",
    desc: "Cabos deteriorados, switches domésticos e roteadores mal configurados causam quedas constantes e perda de produtividade.",
    solution: "Projeto de rede estruturada com switches gerenciáveis.",
  },
  {
    icon: Clock,
    title: "Sistema Operacional Corrompido",
    desc: "Atualizações ignoradas e softwares piratas degradam o Windows, causando telas azuis e erros constantes.",
    solution: "Reinstalação limpa com licenciamento original Microsoft.",
  },
  {
    icon: ShieldX,
    title: "Sem Backup",
    desc: "Dados críticos armazenados apenas no computador local — um HD queimado significa perda total e irreversível.",
    solution: "Backup automatizado local + nuvem com verificação diária.",
  },
  {
    icon: Cpu,
    title: "Hardware Subdimensionado",
    desc: "Memória RAM insuficiente e processadores defasados não suportam softwares modernos, causando travamentos.",
    solution: "Diagnóstico técnico + upgrade sob medida para sua operação.",
  },
  {
    icon: AlertTriangle,
    title: "Falta de Manutenção Preventiva",
    desc: "Equipamentos sem revisão periódica acumulam problemas silenciosos até uma falha crítica paralisar a operação.",
    solution: "Contrato de manutenção preventiva mensal com relatórios.",
  },
];

const ProblemsSection = () => {
  return (
    <section id="problemas" className="bg-background">
      {/* Mobile summary */}
      <MobileSummary
        tag="Diagnóstico"
        title={<>Seu computador está lento? <span className="text-primary">Nós resolvemos.</span></>}
        description="Superaquecimento, HD lento, vírus, rede instável — identificamos e resolvemos os problemas mais comuns de performance. Solicite um diagnóstico gratuito."
        to="/servicos"
      />

      {/* Full content - desktop only */}
      <div className="hidden md:block py-20 md:py-24">
        <div className="container">
          {/* Hero with image */}
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // Diagnóstico
              </p>
              <h2 className="text-2xl md:text-4xl lg:text-5xl text-foreground mb-4 md:mb-6">
                Seu computador está lento?
                <br />
                <span className="text-primary">Nós resolvemos.</span>
              </h2>
              <p className="font-body text-sm md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                A maioria dos problemas de performance e falhas em computadores, notebooks
                e redes acontecem por falta de manutenção adequada. Conheça os vilões
                mais comuns e como a WMTi elimina cada um deles.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden"
            >
              <img
                src={slowComputer}
                alt="Profissional frustrado com computador lento no escritório"
                className="w-full h-56 md:h-80 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            </motion.div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12 md:mb-16">
            {problems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group bg-secondary border border-border/30 p-5 md:p-6 hover:border-primary/40 transition-all duration-300 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-primary" />
                  </div>
                  <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-secondary-foreground font-bold">
                    {item.title}
                  </h3>
                </div>
                <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed mb-3 flex-1">
                  {item.desc}
                </p>
                <div className="flex items-start gap-2 pt-3 border-t border-border/20">
                  <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="font-body text-xs text-primary/80 leading-relaxed">
                    {item.solution}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-secondary border border-border/30 p-8 md:p-12 text-center"
          >
            <h3 className="text-xl md:text-3xl text-secondary-foreground mb-3 md:mb-4">
              Não espere o problema parar sua empresa
            </h3>
            <p className="font-body text-sm md:text-base text-muted-foreground max-w-xl mx-auto mb-6 md:mb-8 leading-relaxed">
              Solicite um diagnóstico gratuito da sua infraestrutura. Nossa equipe
              técnica identifica gargalos, riscos e oportunidades de melhoria —
              sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
              <a
                href="https://wa.me/5511963166915?text=Olá!%20Gostaria%20de%20solicitar%20um%20diagnóstico%20gratuito%20da%20minha%20infraestrutura."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 md:px-8 py-3 md:py-4 font-mono text-xs md:text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all w-full sm:w-auto justify-center"
              >
                Diagnóstico Gratuito
                <ArrowRight size={16} />
              </a>
              <a
                href="#contato"
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-6 md:px-8 py-3 md:py-4 font-mono text-xs md:text-sm uppercase tracking-wider hover:bg-primary/10 transition-all w-full sm:w-auto justify-center"
              >
                Solicitar Orçamento
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemsSection;
