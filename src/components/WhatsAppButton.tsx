import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { openWhatsApp } from "@/lib/whatsapp";

const WhatsAppButton = () => {
  const { t } = useTranslation();

  return (
    <motion.button
      onClick={() => openWhatsApp({ intent: "general" })}
      aria-label={t("whatsapp.ariaLabel")}
      className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full p-4 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 no-glow"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle size={28} fill="white" strokeWidth={0} />
    </motion.button>
  );
};

export default WhatsAppButton;
