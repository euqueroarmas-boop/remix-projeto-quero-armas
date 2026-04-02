import { useTranslation } from "react-i18next";
import { Shield, Server, HardDrive, Activity, Lock, Headphones, FileCheck, AlertTriangle } from "lucide-react";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import CartorioDowntimeCalculator from "@/components/CartorioDowntimeCalculator";
import UnifiedInfraCalculator from "@/components/orcamento/UnifiedInfraCalculator";
import heroImg from "@/assets/segments/cartorio-moderno.jpg";

const icons = [Shield, Server, HardDrive, FileCheck, Lock, Activity, AlertTriangle, Headphones];

const TiServentiasCartoriaisPage = () => {
  const { t } = useTranslation();
  const k = "p.tiServentias";
  const benefits = (t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[]).map((b, i) => ({ ...b, icon: icons[i % icons.length] }));
  const relatedLabels = t(`${k}.relatedLabels`, { returnObjects: true }) as string[];

  return (
    <>
      <ServicePageTemplate
        title={t(`${k}.title`)} metaTitle={t(`${k}.metaTitle`)} metaDescription={t(`${k}.metaDescription`)} tag={t(`${k}.tag`)}
        headline={<>{t(`${k}.headline1`)}<span className="text-primary">{t(`${k}.headlineHighlight`)}</span>{t(`${k}.headline2`)}</>}
        description={t(`${k}.description`)} whatsappMessage={t(`${k}.whatsappMessage`)}
        heroImage={heroImg} heroImageAlt="Serventia cartorial com infraestrutura de TI moderna e segura"
        painPoints={t(`${k}.painPoints`, { returnObjects: true }) as string[]}
        solutions={t(`${k}.solutions`, { returnObjects: true }) as string[]}
        benefits={benefits}
        faq={t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[]}
        relatedLinks={[
          { label: relatedLabels[0], href: "/ti-para-cartorios" },
          { label: relatedLabels[1], href: "/cartorios/provimento-213" },
          { label: relatedLabels[2], href: "/servidor-dell-poweredge-jacarei" },
          { label: relatedLabels[3], href: "/firewall-pfsense-jacarei" },
          { label: relatedLabels[4], href: "/ti-para-tabelionatos-de-notas" },
          { label: relatedLabels[5], href: "/ti-para-oficios-de-registro" },
          { label: relatedLabels[6], href: "/ti-para-tabelionatos-de-protesto" },
        ]}
        localContent={t(`${k}.localContent`)}
        allowedModes="recorrente_only"
        extraSections={<><CartorioDowntimeCalculator /><UnifiedInfraCalculator contractHref="/contratar/administracao-de-servidores" pageTitle={t(`${k}.title`)} /></>}
      />
    </>
  );
};

export default TiServentiasCartoriaisPage;
