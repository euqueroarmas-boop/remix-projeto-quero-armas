export interface SeoIntent {
  slug: string;
  name: string;
  /** Prefix for H1 — city is appended */
  h1Template: string;
  /** Extra description paragraph */
  descriptionExtra: string;
  ctaText: string;
}

export const intents: SeoIntent[] = [
  {
    slug: "orcamento",
    name: "Orçamento",
    h1Template: "Orçamento de {service} em ",
    descriptionExtra:
      "Solicite um orçamento personalizado sem compromisso. Nossa equipe realiza um diagnóstico gratuito da sua infraestrutura e apresenta uma proposta adequada ao porte e às necessidades da sua empresa.",
    ctaText: "Solicitar orçamento gratuito",
  },
  {
    slug: "terceirizacao",
    name: "Terceirização",
    h1Template: "Terceirização de {service} em ",
    descriptionExtra:
      "Terceirize a gestão de TI da sua empresa com a WMTi. Reduza custos operacionais, elimine a necessidade de equipe interna de TI e conte com especialistas dedicados à sua operação.",
    ctaText: "Conhecer planos de terceirização",
  },
  {
    slug: "consultoria",
    name: "Consultoria",
    h1Template: "Consultoria em {service} em ",
    descriptionExtra:
      "Consultoria especializada para avaliar, planejar e otimizar a infraestrutura de TI da sua empresa. Identificamos gargalos, riscos e oportunidades de melhoria.",
    ctaText: "Agendar consultoria gratuita",
  },
  {
    slug: "implantacao",
    name: "Implantação",
    h1Template: "Implantação de {service} em ",
    descriptionExtra:
      "Implantação profissional com planejamento, execução e documentação técnica. Garantimos que sua nova infraestrutura funcione com estabilidade desde o primeiro dia.",
    ctaText: "Solicitar proposta de implantação",
  },
];
