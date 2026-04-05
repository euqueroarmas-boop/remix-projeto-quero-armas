import { useTranslation } from "react-i18next";
import { Server, Shield, Cpu, HardDrive, Activity, Wrench } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import HoursCalculator from "@/components/orcamento/HoursCalculator";

const icons = [Server, Shield, Cpu, HardDrive, Activity, Wrench];

const ServidoresDellPage = () => {
  const { t } = useTranslation();
  const k = "p.dell";
  const benefits = (t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));
  const relatedLabels = t(`${k}.relatedLabels`, { returnObjects: true }) as string[];

  return (
    <ServicePageTemplate
      title={t(`${k}.title`)} metaTitle={t(`${k}.metaTitle`)} metaDescription={t(`${k}.metaDescription`)} tag={t(`${k}.tag`)}
      headline={<>{t(`${k}.headline1`)}<span className="text-primary">{t(`${k}.headlineHighlight`)}</span>{t(`${k}.headline2`)}</>}
      description={t(`${k}.description`)} whatsappMessage={t(`${k}.whatsappMessage`)}
      painPoints={t(`${k}.painPoints`, { returnObjects: true }) as string[]}
      solutions={t(`${k}.solutions`, { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: relatedLabels[0], href: "/microsoft-365-para-empresas-jacarei" },
        { label: relatedLabels[1], href: "/firewall-pfsense-jacarei" },
        { label: relatedLabels[2], href: "/infraestrutura-ti-corporativa" },
        { label: relatedLabels[3], href: "/suporte-ti-empresarial-jacarei" },
      ]}
      localContent={t(`${k}.localContent`)}
      showHoursCalculator={false}
      extraSections={
        <HoursCalculator serviceName="Implantação de Servidores Dell PowerEdge" contractHref="/contratar/servidor-dell-poweredge-jacarei" basePrice={500} hasProgressiveDiscount={false} />
      }
    />
  );
};

export default ServidoresDellPage;
