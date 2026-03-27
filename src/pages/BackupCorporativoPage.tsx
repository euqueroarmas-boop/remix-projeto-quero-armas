import { useTranslation } from "react-i18next";
import { HardDrive, Shield, Cloud, Server, Activity, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const icons = [HardDrive, Cloud, Shield, Server, Activity, Headphones];

const BackupCorporativoPage = () => {
  const { t } = useTranslation();
  const benefits = (t("p.backup.benefits", { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));

  return (
    <ServicePageTemplate
      title={t("p.backup.title")}
      metaTitle={t("p.backup.metaTitle")}
      metaDescription={t("p.backup.metaDescription")}
      tag={t("p.backup.tag")}
      headline={<>{t("p.backup.headline1")}<span className="text-primary">{t("p.backup.headlineHighlight")}</span>{t("p.backup.headline2")}</>}
      description={t("p.backup.description")}
      whatsappMessage={t("p.backup.whatsappMessage")}
      painPoints={t("p.backup.painPoints", { returnObjects: true }) as string[]}
      solutions={t("p.backup.solutions", { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t("p.backup.faq", { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: (t("p.backup.relatedLabels", { returnObjects: true }) as string[])[0], href: "/servidor-dell-poweredge-jacarei" },
        { label: (t("p.backup.relatedLabels", { returnObjects: true }) as string[])[1], href: "/seguranca-de-rede" },
        { label: (t("p.backup.relatedLabels", { returnObjects: true }) as string[])[2], href: "/infraestrutura-ti-corporativa-jacarei" },
      ]}
      localContent={t("p.backup.localContent")}
      showHoursCalculator
    />
  );
};

export default BackupCorporativoPage;
