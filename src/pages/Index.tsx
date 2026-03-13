import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import CartoriosSection from "@/components/CartoriosSection";
import ProblemsSection from "@/components/ProblemsSection";
import InfraSection from "@/components/InfraSection";
import RentalSection from "@/components/RentalSection";
import SecuritySection from "@/components/SecuritySection";
import TestimonialsSection from "@/components/TestimonialsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <CartoriosSection />
      <ServicesSection />
      <ProblemsSection />
      <RentalSection />
      <InfraSection />
      <SecuritySection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
