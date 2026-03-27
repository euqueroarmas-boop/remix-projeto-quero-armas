import { useTranslation } from "react-i18next";
import { Activity, Network, AlertTriangle, Eye, Shield, Headphones } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const icons = [Activity, Network, AlertTriangle, Eye, Shield, Headphones];

const MonitoramentoDeRedePage = () => {
  const { t } = useTranslation();
  const k = "p.monRede";
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
        { label: relatedLabels[0], href: "/montagem-e-monitoramento-de-redes-jacarei" },
        { label: relatedLabels[1], href: "/seguranca-de-rede" },
        { label: relatedLabels[2], href: "/suporte-ti-jacarei" },
      ]}
      localContent={t(`${k}.localContent`)} showHoursCalculator
    />
  );
};

export default MonitoramentoDeRedePage;
