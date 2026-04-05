import { useTranslation } from "react-i18next";
import { Shield, Lock, Eye, Wifi, Server, Activity } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import HoursCalculator from "@/components/orcamento/HoursCalculator";

const icons = [Shield, Lock, Eye, Wifi, Server, Activity];

const FirewallPfsensePage = () => {
  const { t } = useTranslation();
  const benefits = (t("p.firewall.benefits", { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i] }));

  return (
    <ServicePageTemplate
      title={t("p.firewall.title")} metaTitle={t("p.firewall.metaTitle")} metaDescription={t("p.firewall.metaDescription")} tag={t("p.firewall.tag")}
      headline={<>{t("p.firewall.headline1")}<span className="text-primary">{t("p.firewall.headlineHighlight")}</span>{t("p.firewall.headline2")}</>}
      description={t("p.firewall.description")} whatsappMessage={t("p.firewall.whatsappMessage")}
      painPoints={t("p.firewall.painPoints", { returnObjects: true }) as string[]}
      solutions={t("p.firewall.solutions", { returnObjects: true }) as string[]}
      benefits={benefits}
      faq={t("p.firewall.faq", { returnObjects: true }) as { question: string; answer: string }[]}
      relatedLinks={[
        { label: (t("p.firewall.relatedLabels", { returnObjects: true }) as string[])[0], href: "/montagem-e-monitoramento-de-redes-jacarei" },
        { label: (t("p.firewall.relatedLabels", { returnObjects: true }) as string[])[1], href: "/servidores-dell-poweredge-jacarei" },
        { label: (t("p.firewall.relatedLabels", { returnObjects: true }) as string[])[2], href: "/suporte-ti-empresarial-jacarei" },
        { label: (t("p.firewall.relatedLabels", { returnObjects: true }) as string[])[3], href: "/infraestrutura-ti-corporativa" },
      ]}
      localContent={t("p.firewall.localContent")}
      showHoursCalculator={false}
      extraSections={
        <HoursCalculator serviceName="Firewall Corporativo pfSense" contractHref="/contratar/firewall-pfsense-jacarei" basePrice={400} hasProgressiveDiscount={true} maxDiscountPercent={27.5} />
      }
    />
  );
};

export default FirewallPfsensePage;
