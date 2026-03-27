import { useTranslation } from "react-i18next";
import { Server, Shield, HardDrive, Activity, Headphones, Lock } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import heroImg from "@/assets/segments/industrias-petroliferas.webp";

const icons = [Server, Shield, HardDrive, Activity, Lock, Headphones];

const TiIndustriasPetroliferasPage = () => {
  const { t } = useTranslation();
  const k = "p.tiPetro";
  const benefits = (t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));
  const relatedLabels = t(`${k}.relatedLabels`, { returnObjects: true }) as string[];

  return (
    <ServicePageTemplate
      title={t(`${k}.title`)} metaTitle={t(`${k}.metaTitle`)} metaDescription={t(`${k}.metaDescription`)} tag={t(`${k}.tag`)}
      headline={<>{t(`${k}.headline1`)}<span className="text-primary">{t(`${k}.headlineHighlight`)}</span>{t(`${k}.headline2`)}</>}
      description={t(`${k}.description`)} whatsappMessage={t(`${k}.whatsappMessage`)}
      heroImage={heroImg} heroImageAlt="Oil refinery at sunset"
      painPoints={t(`${k}.painPoints`, { returnObjects: true }) as string[]}
      solutions={t(`${k}.solutions`, { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: relatedLabels[0], href: "/infraestrutura-ti-corporativa-jacarei" },
        { label: relatedLabels[1], href: "/firewall-pfsense-jacarei" },
        { label: relatedLabels[2], href: "/servidor-dell-poweredge-jacarei" },
        { label: relatedLabels[3], href: "/suporte-ti-jacarei" },
      ]}
      localContent={t(`${k}.localContent`)}
    />
  );
};

export default TiIndustriasPetroliferasPage;
