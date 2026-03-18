import { useEffect } from "react";
import { motion } from "framer-motion";
import { Construction, Headphones, FileText, DollarSign } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";

const features = [
  { icon: Headphones, label: "Abertura de Chamados", desc: "Registre solicitações de suporte técnico e acompanhe em tempo real." },
  { icon: FileText, label: "Acompanhamento de Chamados", desc: "Veja o status, histórico e todas as atualizações dos seus chamados." },
  { icon: DollarSign, label: "Financeiro", desc: "Consulte faturas, boletos e o histórico financeiro da sua empresa." },
];

const AreaDoClientePage = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <SeoHead
        title="Área do Cliente | WMTi Tecnologia da Informação"
        description="Área do cliente WMTi — em breve um CRM completo para abertura e acompanhamento de chamados e financeiro."
        canonical="/area-do-cliente"
      />
      <Navbar />
      <main className="min-h-screen bg-background pt-16">
        <section className="relative flex flex-col items-center justify-center py-24 md:py-36 px-4 text-center overflow-hidden">
          {/* Animated glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[500px] rounded-full bg-red-500/5 blur-[120px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 mb-8">
              <Construction size={40} className="text-red-500" />
            </div>

            <h1 className="text-3xl md:text-5xl font-heading font-bold text-primary-foreground mb-4">
              Área do <span className="text-red-500">Cliente</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed">
              Em breve, um <strong className="text-foreground">CRM completo</strong> para abertura e acompanhamento de chamados e gestão financeira.
            </p>

            <div className="grid gap-6 sm:grid-cols-3 mb-12">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.15 }}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card"
                  >
                    <Icon size={28} className="text-red-500" />
                    <h3 className="font-heading text-sm font-bold text-foreground">{f.label}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-red-500/30 bg-red-500/5 text-sm text-red-400 font-mono uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Em desenvolvimento
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default AreaDoClientePage;
