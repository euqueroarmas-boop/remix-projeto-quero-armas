import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import CartoriosSection from "@/components/CartoriosSection";
import ProblemsSection from "@/components/ProblemsSection";
import InfraSection from "@/components/InfraSection";
import RentalSection from "@/components/RentalSection";
import SecuritySection from "@/components/SecuritySection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

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
      <ContactSection />
      <Footer />
    </div>
  );
};

export default Index;
