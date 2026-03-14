import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import { HomeAuthority, HomeProblems, HomeDifferentials, HomeFaq, HomeCta } from "@/components/HomeNewSections";
import MetricsSection from "@/components/MetricsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import {
  HomeServicos,
  HomeSegmentos,
  HomeBlog,
} from "@/components/HomeSections";

const Index = () => {
  return (
    <div className="min-h-screen">
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
      <WhatsAppButton />
    </div>
  );
};

export default Index;
