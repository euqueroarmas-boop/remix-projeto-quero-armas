import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import InfraSection from "@/components/InfraSection";
import SecuritySection from "@/components/SecuritySection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <InfraSection />
      <SecuritySection />
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
