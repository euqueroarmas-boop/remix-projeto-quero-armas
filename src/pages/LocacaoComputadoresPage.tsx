import { Monitor, Wrench, DollarSign, RefreshCw, Headphones, ShieldCheck } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const LocacaoComputadoresPage = () => (
  <ServicePageTemplate
    title="Locação de Computadores para Empresas"
    metaTitle="Locação de Computadores para Empresas em Jacareí | A partir de R$ 249/mês | WMTi"
    metaDescription="Aluguel de computadores Dell OptiPlex para empresas em Jacareí, São José dos Campos e Vale do Paraíba. A partir de R$ 249/mês com manutenção, troca e suporte 24/7 inclusos."
    tag="Locação de Computadores"
    headline={<>Computador completo a partir de <span className="text-primary">R$ 249/mês.</span></>}
    description="Estação Dell OptiPlex completa com monitor, teclado e mouse. Todas as manutenções inclusas, trocas sem custo e suporte 24/7. Sem investimento inicial — foque no seu negócio."
    whatsappMessage="Olá! Gostaria de saber mais sobre a locação de computadores para minha empresa."
    painPoints={[
      "Investimento alto na compra de computadores novos",
      "Equipamentos obsoletos causando lentidão e perda de produtividade",
      "Custos inesperados com manutenções e peças de reposição",
      "Depreciação acelerada — equipamento perde valor rapidamente",
      "Dificuldade em escalar o parque de máquinas conforme demanda",
    ]}
    solutions={[
      "Estações Dell OptiPlex completas (CPU + monitor + periféricos) a partir de R$ 249/mês",
      "Todas as manutenções preventivas e corretivas inclusas no valor",
      "Troca de qualquer componente sem custo adicional — teclado, mouse, monitor ou CPU",
      "Suporte técnico 24/7 com atendimento remoto e presencial",
      "Equipamentos renovados periodicamente — sempre hardware atualizado",
    ]}
    benefits={[
      { icon: Monitor, title: "Estação completa", text: "Dell OptiPlex + monitor + teclado + mouse — tudo incluso, pronto para uso." },
      { icon: Wrench, title: "Manutenção inclusa", text: "Preventiva e corretiva sem custo extra. Sem surpresas na fatura." },
      { icon: RefreshCw, title: "Troca sem custo", text: "Queimou qualquer componente? Substituímos sem burocracia nem cobrança." },
      { icon: Headphones, title: "Suporte 24/7", text: "Equipe técnica disponível 24 horas para atendimento remoto e presencial." },
      { icon: DollarSign, title: "Economia real", text: "Sem investimento inicial, sem depreciação, sem custos com técnicos avulsos." },
      { icon: ShieldCheck, title: "Sempre atualizado", text: "Equipamentos renovados periodicamente para máxima produtividade." },
    ]}
    faq={[
      { question: "A partir de quantos computadores posso alugar?", answer: "Não temos mínimo. Atendemos desde empresas com 1 estação até contratos de 200+ máquinas. O valor unitário diminui conforme o volume." },
      { question: "O que está incluso nos R$ 249/mês?", answer: "Estação Dell OptiPlex completa (CPU + monitor + teclado + mouse), todas as manutenções (preventiva e corretiva), troca de peças sem custo e suporte técnico 24/7." },
      { question: "Posso devolver os computadores antes do fim do contrato?", answer: "Sim. Nossos contratos são flexíveis. Se sua equipe diminuir, você pode devolver estações sem multa após o período mínimo." },
      { question: "Os computadores são novos ou usados?", answer: "Trabalhamos com equipamentos seminovos Dell OptiPlex em excelente estado, todos revisados e com garantia. Para projetos que exigem máquinas novas, também oferecemos essa opção." },
    ]}
    relatedLinks={[
      { label: "Suporte de TI", href: "/suporte-ti-empresarial-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Montagem de redes", href: "/montagem-e-monitoramento-de-redes-jacarei" },
    ]}
    localContent="Atendemos empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba com entrega, instalação e retirada presencial. Os computadores são entregues configurados, com sistema operacional e pronto para uso. Ideal para escritórios, clínicas, lojas, indústrias e cartórios."
  />
);

export default LocacaoComputadoresPage;
