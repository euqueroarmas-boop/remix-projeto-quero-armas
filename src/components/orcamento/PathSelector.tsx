import { motion } from "framer-motion";
import { Monitor, Headphones, HelpCircle, ArrowRight } from "lucide-react";

export type CommercialPath = "locacao" | "suporte" | "ajuda";

interface Props {
  onSelect: (path: CommercialPath) => void;
  selected: CommercialPath | null;
}

const paths = [
  {
    id: "locacao" as CommercialPath,
    icon: Monitor,
    title: "Alugar computadores com suporte incluso",
    description:
      "Computadores Dell OptiPlex novos com manutenção, backup e suporte técnico durante todo o contrato. Sem investimento inicial.",
    highlight: "A partir de R$249/mês por computador",
  },
  {
    id: "suporte" as CommercialPath,
    icon: Headphones,
    title: "Contratar apenas o suporte mensal para minha rede atual",
    description:
      "Mantenha seus computadores atuais e conte com nossa equipe de TI para cuidar da infraestrutura, servidores e segurança.",
    highlight: "A partir de R$120/mês por computador",
  },
  {
    id: "ajuda" as CommercialPath,
    icon: HelpCircle,
    title: "Ainda não tenho certeza, quero entender qual opção compensa mais",
    description:
      "Responda algumas perguntas rápidas sobre sua empresa e nós vamos recomendar a melhor opção para o seu caso.",
    highlight: "Diagnóstico gratuito em 2 minutos",
  },
];

const PathSelector = ({ onSelect, selected }: Props) => {
  return (
    <section id="path-selector" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Como podemos ajudar?
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            O que sua empresa <span className="text-primary">precisa</span> hoje?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha a opção que mais se aproxima da sua necessidade. Vamos montar
            um orçamento personalizado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto md:items-stretch">
          {paths.map((p, i) => {
            const isSelected = selected === p.id;
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => onSelect(p.id)}
                className={`relative text-left cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] flex flex-col h-full ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-background hover:border-primary/30"
                }`}
              >
                {/* Icon block */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 shrink-0 ${
                    isSelected ? "bg-primary/20" : "bg-primary/10"
                  }`}
                >
                  <p.icon className="w-6 h-6 text-primary" />
                </div>

                {/* Title block — fixed min height */}
                <h3 className="text-lg font-heading font-bold mb-2 min-h-[3.5rem]">{p.title}</h3>

                {/* Description block — grows to fill */}
                <p className="text-sm text-muted-foreground mb-4 flex-1">{p.description}</p>

                {/* Highlight + arrow — anchored to bottom */}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-xs font-semibold text-primary">{p.highlight}</span>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PathSelector;
