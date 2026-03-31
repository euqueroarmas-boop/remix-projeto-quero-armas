import { useTranslation } from "react-i18next";
import { Headphones, Clock, Shield, Activity, Wrench, Users } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const icons = [Activity, Wrench, Clock, Shield, Headphones, Users];

const SuporteTiPage = () => {
  const { t } = useTranslation();
  const benefits = (t("p.suporteTi.benefits", { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));
  const painPoints = t("p.suporteTi.painPoints", { returnObjects: true }) as string[];
  const solutions = t("p.suporteTi.solutions", { returnObjects: true }) as string[];
  const faq = t("p.suporteTi.faq", { returnObjects: true }) as { question: string; answer: string }[];
  const relatedLabels = t("p.suporteTi.relatedLabels", { returnObjects: true }) as string[];

  return (
    <ServicePageTemplate
      title={t("p.suporteTi.title")}
      metaTitle={t("p.suporteTi.metaTitle")}
      metaDescription={t("p.suporteTi.metaDescription")}
      tag={t("p.suporteTi.tag")}
      headline={<>{t("p.suporteTi.headline1")}<span className="text-primary">{t("p.suporteTi.headlineHighlight")}</span>{t("p.suporteTi.headline2")}</>}
      description={t("p.suporteTi.description")}
      whatsappMessage={t("p.suporteTi.whatsappMessage")}
      painPoints={painPoints}
      solutions={solutions}
      benefits={benefits}
      faq={faq}
      relatedLinks={[
        { label: relatedLabels[0], href: "/locacao-de-computadores-para-empresas" },
        { label: relatedLabels[1], href: "/microsoft-365-para-empresas-jacarei" },
        { label: relatedLabels[2], href: "/montagem-e-monitoramento-de-redes-jacarei" },
        { label: relatedLabels[3], href: "/infraestrutura-ti-corporativa" },
      ]}
      localContent={t("p.suporteTi.localContent")}
      showHoursCalculator
      allowedModes="recorrente_only"
    />
  );
};

export default SuporteTiPage;
