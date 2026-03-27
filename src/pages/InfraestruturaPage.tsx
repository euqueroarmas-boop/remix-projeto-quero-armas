import Navbar from "@/components/Navbar";
import InfraSection from "@/components/InfraSection";
import SecuritySection from "@/components/SecuritySection";
import Footer from "@/components/Footer";

const InfraestruturaPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-14 md:pt-16">
      <InfraSection />
      <SecuritySection />
    </div>
    <Footer />
  </div>
);

export default InfraestruturaPage;
