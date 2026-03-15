import { motion } from "framer-motion";
import { Headphones, Server, Calculator } from "lucide-react";
import type { QualificationData } from "./QualificationForm";

interface Props {
  qualification: QualificationData;
}

const PRICE_NEW_PC = 120;
const PRICE_OLD_PC = 150;
const PRICE_SERVER = 300;

export const calculateSupportTotal = (q: QualificationData) => {
  const isOld = q.averageAge === "5+";
  const pcPrice = isOld ? PRICE_OLD_PC : PRICE_NEW_PC;
  const pcTotal = pcPrice * q.computersQty;
  const serverTotal = PRICE_SERVER * q.serversQty;
  return { pcPrice, pcTotal, serverTotal, total: pcTotal + serverTotal, isOld };
};

const SupportCalculator = ({ qualification }: Props) => {
  const { pcPrice, pcTotal, serverTotal, total, isOld } = calculateSupportTotal(qualification);

  return (
    <section id="support-calculator" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Suporte Mensal
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Estimativa do <span className="text-primary">suporte mensal</span>
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background/50 border border-border rounded-2xl p-8 space-y-6"
          >
            {/* PCs */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Headphones className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {qualification.computersQty} computador{qualification.computersQty > 1 ? "es" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isOld ? "Mais de 4 anos — R$150/computador" : "Até 4 anos — R$120/computador"}
                  </p>
                </div>
              </div>
              <span className="font-heading font-bold text-lg">
                R${pcTotal.toLocaleString("pt-BR")}
              </span>
            </div>

            {/* Servers */}
            {qualification.serversQty > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {qualification.serversQty} Windows Server
                    </p>
                    <p className="text-xs text-muted-foreground">R$300/servidor/mês</p>
                  </div>
                </div>
                <span className="font-heading font-bold text-lg">
                  R${serverTotal.toLocaleString("pt-BR")}
                </span>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calculator className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Total estimado</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-heading font-bold text-primary">
                    R${total.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-muted-foreground text-sm block">/mês</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SupportCalculator;
