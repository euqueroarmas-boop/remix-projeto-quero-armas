import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HomeAuthority, HomeProblems, HomeDifferentials, HomeFaq, HomeCta } from "@/components/HomeNewSections";
import MetricsSection from "@/components/MetricsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import JsonLd from "@/components/JsonLd";
import {
  HomeServicos,
  HomeSegmentos,
  HomeBlog,
} from "@/components/HomeSections";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "WMTi Tecnologia da Informação",
  url: "https://www.wmti.com.br",
  logo: "https://www.wmti.com.br/wmti-preview.jpg",
  telephone: "+5511963166915",
  email: "contato@wmti.com.br",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua José Benedito Duarte, 140",
    addressLocality: "Jacareí",
    addressRegion: "SP",
    postalCode: "12306-700",
    addressCountry: "BR",
  },
  areaServed: {
    "@type": "State",
    name: "São Paulo",
  },
  sameAs: [],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "18:00",
  },
};

const Index = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      <SeoHead
        title={t("hero.metaTitle", { defaultValue: "WMTi Tecnologia da Informação | Suporte e Infraestrutura de TI Corporativa" })}
        description={t("hero.metaDescription", { defaultValue: "Suporte técnico, infraestrutura corporativa, servidores Dell, firewall pfSense e locação de computadores para empresas em Jacareí e Vale do Paraíba." })}
        canonical="https://www.wmti.com.br/"
        ogType="website"
      />
      <JsonLd data={organizationSchema} />
      <Navbar />
      <HeroSection />
      <HomeAuthority />
      <MetricsSection />
      <HomeProblems />
      <HomeServicos />
      <HomeSegmentos />
      <HomeDifferentials />
      <TestimonialsSection />
      <HomeFaq />
      <HomeBlog />
      <HomeCta />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
