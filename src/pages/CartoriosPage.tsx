import Navbar from "@/components/Navbar";
import CartoriosSection from "@/components/CartoriosSection";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";

const CartoriosPage = () => (
  <div className="min-h-screen">
    <SeoHead
      title="TI para Cartórios e Serventias | Provimento 74 CNJ | WMTi"
      description="Infraestrutura de TI especializada para cartórios: backup automatizado, firewall, servidores Dell e conformidade com Provimento 74 do CNJ."
      canonical="https://www.wmti.com.br/ti-para-cartorios"
    />
    <Navbar />
    <div className="pt-14 md:pt-16">
      <CartoriosSection />
    </div>
    <Footer />
  </div>
);

export default CartoriosPage;
