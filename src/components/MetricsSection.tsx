import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function AnimatedCounter({ value, suffix, duration = 2 }: { value: number; suffix: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const isDecimal = value % 1 !== 0;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
      }
    }, (duration * 1000) / steps);
    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className="font-heading text-4xl md:text-6xl font-bold text-primary">
      {count}{suffix}
    </span>
  );
}

const MetricsSection = () => {
  const { t } = useTranslation();
  const metrics = [
    { value: 15, suffix: "+", labelKey: "metrics.years" },
    { value: 150, suffix: "+", labelKey: "metrics.companies" },
    { value: 99.9, suffix: "%", labelKey: "metrics.uptime" },
    { value: 24, suffix: "/7", labelKey: "metrics.support" },
  ];

  return (
    <section className="py-16 md:py-20 bg-secondary">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.labelKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <AnimatedCounter value={m.value} suffix={m.suffix} />
              <p className="font-mono text-xs md:text-sm text-muted-foreground tracking-wider uppercase mt-2">
                {t(m.labelKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MetricsSection;
