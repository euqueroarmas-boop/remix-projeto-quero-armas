import { motion } from "framer-motion";
import { Monitor, Headphones, HelpCircle, ArrowRight, AlertTriangle, Wrench } from "lucide-react";

import imgEmergencial from "@/assets/orcamento/path-emergencial.webp";
import imgAvulso from "@/assets/orcamento/path-avulso.webp";
import imgLocacao from "@/assets/orcamento/path-locacao.webp";
import imgSuporte from "@/assets/orcamento/path-suporte.webp";
import imgAjuda from "@/assets/orcamento/path-ajuda.webp";

export type CommercialPath = "locacao" | "suporte" | "ajuda" | "emergencial" | "avulso";

interface Props {
  onSelect: (path: CommercialPath) => void;
  selected: CommercialPath | null;
}

const paths = [
  {
    id: "emergencial" as CommercialPath,
    icon: AlertTriangle,
    image: imgEmergencial,
    title: "Suporte técnico emergencial",
    description:
      "Problema urgente na sua empresa? Nossa equipe pode prestar atendimento técnico imediato para restaurar servidores, rede, sistemas ou computadores que pararam de funcionar, em servidores Windows Server, Linux ou estações de trabalho.\n\nPague por hora e use quando quiser. Aproveite a promoção de horas.",
    highlight: "Atendimento emergencial sob demanda",
  },
  {
    id: "avulso" as CommercialPath,
    icon: Wrench,
    image: imgAvulso,
    title: "Contratar serviço avulso",
    description:
      "Solicite atendimento técnico pontual para sua empresa sem necessidade de contrato mensal. Ideal para instalações, configurações, manutenção, melhorias de rede, servidores ou infraestrutura.\n\nPague por hora e use quando quiser. Aproveite a promoção de horas.",
    highlight: "Serviço técnico sob demanda",
  },
  {
    id: "locacao" as CommercialPath,
    icon: Monitor,
    image: imgLocacao,
    title: "Alugar computadores com suporte incluso",
    description:
      "Computadores Dell OptiPlex novos com manutenção, backup e suporte técnico durante todo o contrato. Sem investimento inicial.",
    highlight: "A partir de R$249/mês por computador",
  },
  {
    id: "suporte" as CommercialPath,
    icon: Headphones,
    image: imgSuporte,
    title: "Contratar apenas o suporte mensal para minha rede atual",
    description:
      "Mantenha seus computadores atuais e conte com nossa equipe de TI para cuidar da infraestrutura, servidores e segurança.",
    highlight: "A partir de R$120/mês por computador",
  },
  {
    id: "ajuda" as CommercialPath,
    icon: HelpCircle,
    image: imgAjuda,
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
          <h2 className="text-2xl md:text-4xl font-heading font-bold text-foreground mb-3">
            O que sua empresa <span className="text-primary">precisa</span> hoje?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha a opção que mais se aproxima da sua necessidade. Vamos montar
            um orçamento personalizado.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto md:items-stretch">
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
                className={`relative text-left cursor-pointer rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] flex flex-col h-full ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-background hover:border-primary/30"
                }`}
              >
                {/* Image */}
                <div className="relative h-40 w-full overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className={`absolute top-3 left-3 w-10 h-10 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-primary/90" : "bg-background/80 backdrop-blur-sm"
                  }`}>
                    <p.icon className={`w-5 h-5 ${isSelected ? "text-primary-foreground" : "text-primary"}`} />
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  {/* Title */}
                  <h3 className="text-lg font-heading font-bold text-foreground mb-2 min-h-[3.5rem]">{p.title}</h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{p.description}</p>

                  {/* Highlight + arrow */}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-xs font-semibold text-primary">{p.highlight}</span>
                    <ArrowRight
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </div>
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
