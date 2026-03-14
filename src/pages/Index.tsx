import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ClientLogosSection from "@/components/ClientLogosSection";
import MetricsSection from "@/components/MetricsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import {
  HomeInstitucional,
  HomeServicos,
  HomeSegmentos,
  HomeInfraestrutura,
  HomeBlog,
} from "@/components/HomeSections";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ClientLogosSection />
      <HomeInstitucional />
      <MetricsSection />
      <HomeServicos />
      <HomeSegmentos />
      <HomeInfraestrutura />
      <TestimonialsSection />
      <HomeBlog />
      <ContactSection />
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
