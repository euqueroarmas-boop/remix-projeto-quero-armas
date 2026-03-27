import Navbar from "@/components/Navbar";
import CartoriosSection from "@/components/CartoriosSection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const CartoriosPage = () => (
  <div className="min-h-screen">
    <Navbar />
    <div className="pt-14 md:pt-16">
      <CartoriosSection />
    </div>
    <Footer />
  </div>
);

export default CartoriosPage;
