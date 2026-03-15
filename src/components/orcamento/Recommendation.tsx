import { motion } from "framer-motion";
import { Lightbulb, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import type { QualificationData } from "./QualificationForm";
import type { CommercialPath } from "./PathSelector";

interface Props {
  qualification: QualificationData;
  chosenPath: CommercialPath;
  rentalMonthly: number;
  supportMonthly: number;
}

export const getRecommendation = (q: QualificationData): "locacao" | "suporte" => {
  const isOld = q.averageAge === "5+";
  const notI3 = !q.isMinCoreI3;
  const frequentIssues = q.frequentMaintenance;
  const highImpact = q.downtimeImpact;

  // Strong signals for rental
  if (isOld && notI3) return "locacao";
  if (isOld && frequentIssues) return "locacao";
  if (isOld && highImpact) return "locacao";

  // Newer machines with decent specs → support
  if (!isOld && q.isMinCoreI3) return "suporte";

  // Default to rental if old
  if (isOld) return "locacao";

  return "suporte";
};

const Recommendation = ({ qualification, chosenPath, rentalMonthly, supportMonthly }: Props) => {
  const recommended = getRecommendation(qualification);
  const isOld = qualification.averageAge === "5+";

  const persuasiveMessages = isOld
    ? [
        "Equipamentos mais antigos costumam gerar mais custo com suporte, lentidão e paradas.",
        "Em muitos casos, a locação com suporte incluso oferece mais previsibilidade do que manter máquinas antigas.",
        "Com a locação, sua empresa recebe computadores novos Dell OptiPlex sem investimento inicial.",
      ]
    : [
        "Como seu parque é mais recente, o suporte mensal pode ser uma alternativa eficiente para manter a operação estável.",
        "Computadores com boas especificações aproveitam melhor o suporte preventivo e corretivo.",
      ];

  return (
    <section id="recommendation" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Recomendação
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Recomendação para sua <span className="text-primary">empresa</span>
            </h2>
          </div>

          {/* Persuasive messages */}
          <div className="space-y-3 mb-8">
            {persuasiveMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card"
              >
                {isOld ? (
                  <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                ) : (
                  <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-foreground/90">{msg}</p>
              </motion.div>
            ))}
          </div>

          {/* Recommendation card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/10 via-card to-primary/5 border-2 border-primary/30 rounded-2xl p-8 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="w-7 h-7 text-primary" />
            </div>

            <h3 className="text-xl font-heading font-bold mb-2">
              {recommended === "locacao"
                ? "Locação de computadores com suporte incluso"
                : "Suporte mensal para sua infraestrutura atual"}
            </h3>

            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              {recommended === "locacao"
                ? "Com base nas informações fornecidas, a locação é a opção mais vantajosa para sua empresa. Computadores novos, suporte incluso e custo previsível."
                : "Seus computadores estão em boas condições. O suporte mensal garante estabilidade, segurança e atendimento especializado sem necessidade de trocar os equipamentos."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="bg-card border border-border rounded-xl px-6 py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {recommended === "locacao" ? "Locação" : "Suporte"}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-heading font-bold text-primary">
                    R${(recommended === "locacao" ? rentalMonthly : supportMonthly).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
              </div>

              {chosenPath === "ajuda" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>
                    Alternativa:{" "}
                    <span className="font-medium text-foreground">
                      R${(recommended === "locacao" ? supportMonthly : rentalMonthly).toLocaleString("pt-BR")}/mês
                    </span>{" "}
                    ({recommended === "locacao" ? "suporte" : "locação"})
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Recommendation;
