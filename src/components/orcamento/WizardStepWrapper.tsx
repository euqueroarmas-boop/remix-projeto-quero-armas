import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  stepNumber: number;
  title: string;
  subtitle?: string;
  status: "pending" | "active" | "completed";
  isLast?: boolean;
  children: React.ReactNode;
}

const WizardStepWrapper = ({ stepNumber, title, subtitle, status, isLast, children }: Props) => {
  return (
    <div className="flex gap-4 md:gap-6">
      {/* Step indicator line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300 border-2",
            status === "completed" && "bg-primary border-primary text-primary-foreground",
            status === "active" && "border-primary text-primary bg-primary/10",
            status === "pending" && "border-border text-muted-foreground bg-card"
          )}
        >
          {status === "completed" ? <Check className="w-5 h-5" /> : stepNumber}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-[24px] transition-colors duration-300",
              status === "completed" ? "bg-primary" : "bg-border"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="mb-3">
          <h3
            className={cn(
              "text-lg font-heading font-bold transition-colors",
              status === "active" && "text-foreground",
              status === "completed" && "text-primary",
              status === "pending" && "text-muted-foreground"
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {status === "active" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        )}

        {status === "completed" && (
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Check className="w-4 h-4 text-primary" /> Concluído
          </div>
        )}
      </div>
    </div>
  );
};

export default WizardStepWrapper;
