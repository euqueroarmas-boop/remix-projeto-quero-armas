import { motion } from "framer-motion";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  visible: boolean;
}

const OutsourcingOffer = ({ visible }: Props) => {
  const navigate = useNavigate();

  if (!visible) return null;

  return (
    <section className="py-12 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto bg-background border border-primary/20 rounded-2xl p-8 text-center space-y-4"
        >
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl md:text-2xl font-heading font-bold text-foreground">
            Terceirização Estratégica de TI
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-lg mx-auto">
            Mesmo com técnico interno, muitas empresas terceirizam a gestão da infraestrutura para reduzir riscos,
            aumentar segurança e garantir continuidade operacional.
          </p>
          <Button
            onClick={() => navigate("/terceirizacao-de-mao-de-obra-ti")}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Quero conhecer a terceirização de TI
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default OutsourcingOffer;
