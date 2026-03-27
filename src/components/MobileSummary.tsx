import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface MobileSummaryProps {
  tag: string;
  title: React.ReactNode;
  description: string;
  to: string;
  className?: string;
}

const MobileSummary = ({ tag, title, description, to, className = "" }: MobileSummaryProps) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`md:hidden py-16 ${className}`}
    >
      <div className="container">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // {tag}
        </p>
        <h2 className="text-2xl mb-4">{title}</h2>
        <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">
          {description}
        </p>
        <Link
          to={to}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          {t("cta.learnMore")}
          <ArrowRight size={16} />
        </Link>
      </div>
    </motion.div>
  );
};

export default MobileSummary;
