import { useTranslation } from "react-i18next";
import { Server, HardDrive, Shield, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/escritorios-contabilidade.webp";

const icons = [HardDrive, Server, Lock, Shield, Activity, Headphones];

const TiContabilidadesPage = () => {
  const { t } = useTranslation();
  const k = "p.tiContab";
  const benefits = (t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));
  const relatedLabels = t(`${k}.relatedLabels`, { returnObjects: true }) as string[];

  return (
    <ServicePageTemplate
      title={t(`${k}.title`)} metaTitle={t(`${k}.metaTitle`)} metaDescription={t(`${k}.metaDescription`)} tag={t(`${k}.tag`)}
      headline={<>{t(`${k}.headline1`)}<span className="text-primary">{t(`${k}.headlineHighlight`)}</span>{t(`${k}.headline2`)}</>}
      description={t(`${k}.description`)} whatsappMessage={t(`${k}.whatsappMessage`)}
      heroImage={heroImg} heroImageAlt="Modern accounting office with IT infrastructure"
      painPoints={t(`${k}.painPoints`, { returnObjects: true }) as string[]}
      solutions={t(`${k}.solutions`, { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: relatedLabels[0], href: "/infraestrutura-ti-corporativa-jacarei" },
        { label: relatedLabels[1], href: "/servidor-dell-poweredge-jacarei" },
        { label: relatedLabels[2], href: "/microsoft-365-para-empresas-jacarei" },
        { label: relatedLabels[3], href: "/suporte-ti-jacarei" },
      ]}
      localContent={t(`${k}.localContent`)}
    />
  );
};

export default TiContabilidadesPage;
