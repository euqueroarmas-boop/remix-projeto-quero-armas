import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import ClientLogin from "@/components/area-cliente/ClientLogin";
import ClientPortal from "@/components/area-cliente/ClientPortal";

export interface CustomerData {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_ou_cpf: string;
  email: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
  responsavel: string;
}

const AreaDoClientePage = () => {
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const saved = sessionStorage.getItem("wmti_customer");
    if (saved) {
      try { setCustomer(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleLogin = (c: CustomerData) => {
    setCustomer(c);
    sessionStorage.setItem("wmti_customer", JSON.stringify(c));
  };

  const handleLogout = () => {
    setCustomer(null);
    sessionStorage.removeItem("wmti_customer");
  };

  return (
    <>
      <SeoHead
        title="Área do Cliente | WMTi Tecnologia da Informação"
        description="Portal do cliente WMTi — acompanhe serviços, chamados, financeiro, contratos e documentos fiscais."
        canonical="/area-do-cliente"
      />
      {!customer && <Navbar />}
      <main className="min-h-screen bg-background">
        {!customer ? (
          <ClientLogin onLogin={handleLogin} />
        ) : (
          <ClientPortal customer={customer} onLogout={handleLogout} />
        )}
      </main>
      {!customer && <Footer />}
      <WhatsAppButton />
    </>
  );
};

export default AreaDoClientePage;
