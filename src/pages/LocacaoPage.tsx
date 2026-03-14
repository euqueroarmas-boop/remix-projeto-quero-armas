import Navbar from "@/components/Navbar";
import RentalSection from "@/components/RentalSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const LocacaoPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-14 md:pt-16">
      <RentalSection />
    </div>
    <Footer />
    <WhatsAppButton />
  </div>
);

export default LocacaoPage;
