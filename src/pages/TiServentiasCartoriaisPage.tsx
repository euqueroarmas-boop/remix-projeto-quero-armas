import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/serventias-cartoriais.webp";

const TiServentiasCartoriaisPage = () => (
  <ServicePageTemplate
    title="Infraestrutura de TI para Serventias Notariais"
    metaTitle="Infraestrutura de TI para Serventias Notariais | Provimento 213 CNJ | WMTi"
    metaDescription="Soluções de infraestrutura de TI para serventias notariais em conformidade com o Provimento 213 do CNJ. Servidores Dell PowerEdge, backup Veeam, firewall pfSense e monitoramento 24/7."
    tag="TI para Serventias Notariais"
    headline={<>Sua serventia pode estar vulnerável — e o <span className="text-primary">Provimento 213 exige adequação agora</span></>}
    description="O prazo está correndo. O Provimento 213 do CNJ define requisitos obrigatórios de TIC para todas as serventias extrajudiciais. Backup inadequado, servidor sem redundância, sem firewall, sem plano de continuidade — tudo isso é não-conformidade. E não-conformidade gera sanção. A maioria das serventias sabe que precisa se adequar, mas não tem por onde começar. A WMTi é especialista nisso. Fazemos o diagnóstico, implementamos a infraestrutura e garantimos que sua serventia esteja em conformidade total."
    whatsappMessage="Olá! Gostaria de uma análise da infraestrutura de TI da minha serventia notarial."
    heroImage={heroImg}
    heroImageAlt="Fachada de serventia notarial com arquitetura clássica"
    painPoints={[
      "Dificuldade em entender e atender os requisitos do Provimento 213",
      "Sistemas cartoriais instáveis comprometendo operações jurídicas",
      "Backup manual ou inexistente — risco real de perda de acervo",
      "Sem firewall e sem segmentação de rede",
      "Servidores sem monitoramento — problemas descobertos pelo usuário",
      "Suporte reativo que só aparece depois do problema",
    ]}
    solutions={[
      "Diagnóstico completo de conformidade com o Provimento 213",
      "Servidores Windows Server para operação contínua e alta disponibilidade",
      "Backup corporativo automatizado com replicação local e em nuvem",
      "Firewall com segmentação de rede e políticas de segurança",
      "Monitoramento contínuo para identificar falhas preventivamente",
      "Suporte especializado com manutenção preventiva programada",
    ]}
    benefits={[
      { icon: Server, title: "Servidores profissionais", text: "Windows Server configurado para alto desempenho e disponibilidade dos sistemas cartoriais." },
      { icon: HardDrive, title: "Backup que funciona", text: "Replicação local e em nuvem com testes periódicos. Não é cópia manual em HD externo." },
      { icon: Shield, title: "Rede protegida", text: "Firewall, segmentação e políticas de segurança. Dados sigilosos protegidos de verdade." },
      { icon: Activity, title: "Monitoramento real", text: "Servidores e rede monitorados para agir antes da falha, não depois." },
      { icon: Lock, title: "Conformidade total", text: "Todos os requisitos do Provimento 213 atendidos e documentados." },
      { icon: Headphones, title: "Suporte especializado", text: "Equipe que conhece a rotina de serventia e resolve com a urgência necessária." },
    ]}
    faq={[
      { question: "A WMTi atende serventias notariais com adequação ao Provimento 213?", answer: "Sim. Somos especialistas. Fazemos o diagnóstico, implementamos tudo e garantimos conformidade total. Sem deixar pendência." },
      { question: "Qual a importância do backup corporativo para serventias?", answer: "Perda de dados em ambiente cartorial pode gerar impactos operacionais e jurídicos graves. Nosso backup é automatizado, replicado e testado. Funciona quando precisa." },
      { question: "Vocês realizam monitoramento contínuo?", answer: "Sim. 24/7 com alertas automáticos. Problemas detectados e resolvidos antes de impactar a operação." },
      { question: "Atendem fora da região de Jacareí?", answer: "Sim. Brasil inteiro. Vale do Paraíba com presencial, demais localidades com suporte remoto e visitas técnicas." },
    ]}
    relatedLinks={[
      { label: "TI para Cartórios", href: "/ti-para-cartorios" },
      { label: "Provimento 213", href: "/cartorios/provimento-213" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
    ]}
    localContent="Solicite uma análise da infraestrutura de TI da sua serventia notarial. Atendemos em Jacareí, Vale do Paraíba e em todo o Brasil."
  />
);

export default TiServentiasCartoriaisPage;
