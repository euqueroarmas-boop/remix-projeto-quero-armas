import Navbar from "@/components/Navbar";
import ServicesSection from "@/components/ServicesSection";
import ProblemsSection from "@/components/ProblemsSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const ServicosPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-14 md:pt-16">
      <ServicesSection />
      <ProblemsSection />
    </div>
    <Footer />
    <WhatsAppButton />
  </div>
);

export default ServicosPage;
