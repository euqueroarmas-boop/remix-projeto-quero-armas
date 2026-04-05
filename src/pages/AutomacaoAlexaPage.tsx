import { useTranslation } from "react-i18next";
import { Home, Building2, Wifi, ShieldCheck, Clock, Zap } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import HoursCalculator from "@/components/orcamento/HoursCalculator";
import GuaranteeBlock from "@/components/GuaranteeBlock";
import ServiceContactForm from "@/components/ServiceContactForm";

const icons = [Home, Building2, Wifi, ShieldCheck, Clock, Zap];

const AutomacaoAlexaPage = () => {
  const { t } = useTranslation();
  const k = "p.autoAlexa";
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
        { label: relatedLabels[3], href: "/automacao-de-ti-com-inteligencia-artificial" },
        { label: relatedLabels[4], href: "/monitoramento-de-rede" },
      ]}
      localContent={t(`${k}.localContent`)}
      showHoursCalculator={false}
      extraSections={
        <>
          <HoursCalculator serviceName="Automação com Alexa" contractHref="/contratar/automacao-alexa" basePrice={350} hasProgressiveDiscount={true} maxDiscountPercent={27.5} />
          <GuaranteeBlock />
          <ServiceContactForm serviceName="Automação com Alexa" />
        </>
      }
    />
  );
};

export default AutomacaoAlexaPage;
