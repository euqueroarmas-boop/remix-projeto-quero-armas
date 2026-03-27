import { useTranslation } from "react-i18next";
import { Bot, Zap, BarChart3, RefreshCw, MessageCircle, Workflow } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const icons = [Bot, Zap, RefreshCw, BarChart3, Workflow, MessageCircle];

const AutomacaoIaPage = () => {
  const { t } = useTranslation();
  const k = "p.autoIA";
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
        { label: relatedLabels[0], href: "/suporte-ti-jacarei" },
        { label: relatedLabels[1], href: "/infraestrutura-ti-corporativa-jacarei" },
        { label: relatedLabels[2], href: "/terceirizacao-de-mao-de-obra-ti" },
        { label: relatedLabels[3], href: "/desenvolvimento-de-sites-e-sistemas-web" },
        { label: relatedLabels[4], href: "/monitoramento-de-rede" },
      ]}
      localContent={t(`${k}.localContent`)} showHoursCalculator
    />
  );
};

export default AutomacaoIaPage;
