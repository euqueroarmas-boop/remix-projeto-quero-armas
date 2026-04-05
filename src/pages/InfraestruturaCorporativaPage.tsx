import { useTranslation } from "react-i18next";
import { Server, Network, Shield, Cloud, Activity, HardDrive } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/dell-infrastructure.webp";

const icons = [Server, Network, Shield, Cloud, HardDrive, Activity];

const InfraestruturaCorporativaPage = () => {
  const { t } = useTranslation();
  const k = "p.infraCorp";
  const benefits = (t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));
  const relatedLabels = t(`${k}.relatedLabels`, { returnObjects: true }) as string[];

  return (
    <ServicePageTemplate
      title={t(`${k}.title`)} metaTitle={t(`${k}.metaTitle`)} metaDescription={t(`${k}.metaDescription`)} tag={t(`${k}.tag`)}
      headline={<>{t(`${k}.headline1`)}<span className="text-primary">{t(`${k}.headlineHighlight`)}</span>{t(`${k}.headline2`)}</>}
      description={t(`${k}.description`)} whatsappMessage={t(`${k}.whatsappMessage`)}
      heroImage={heroImg}
      heroImageAlt="Corporate IT infrastructure with Dell desktops, workstations and PowerEdge servers"
      painPoints={t(`${k}.painPoints`, { returnObjects: true }) as string[]}
      solutions={t(`${k}.solutions`, { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: relatedLabels[0], href: "/servidores-dell-poweredge-jacarei" },
        { label: relatedLabels[1], href: "/montagem-e-monitoramento-de-redes-jacarei" },
        { label: relatedLabels[2], href: "/firewall-pfsense-jacarei" },
        { label: relatedLabels[3], href: "/microsoft-365-para-empresas-jacarei" },
        { label: relatedLabels[4], href: "/suporte-ti-empresarial-jacarei" },
      ]}
      localContent={t(`${k}.localContent`)}
      showHoursCalculator
    />
  );
};

export default InfraestruturaCorporativaPage;
