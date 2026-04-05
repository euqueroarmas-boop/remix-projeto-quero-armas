import { useTranslation } from "react-i18next";
import { Cloud, Shield, Users, Mail, HardDrive, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import HoursCalculator from "@/components/orcamento/HoursCalculator";

const icons = [Cloud, Mail, Users, Shield, HardDrive, Activity];

const Microsoft365Page = () => {
  const { t } = useTranslation();
  const k = "p.m365";
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
        { label: relatedLabels[0], href: "/servidores-dell-poweredge-jacarei" },
        { label: relatedLabels[1], href: "/suporte-ti-empresarial-jacarei" },
        { label: relatedLabels[2], href: "/infraestrutura-ti-corporativa" },
      ]}
      localContent={t(`${k}.localContent`)}
      showHoursCalculator={false}
      extraSections={
        <HoursCalculator serviceName="Microsoft 365" contractHref="/contratar/microsoft-365-para-empresas-jacarei" basePrice={200} hasProgressiveDiscount={true} maxDiscountPercent={27.5} />
      }
    />
  );
};

export default Microsoft365Page;
