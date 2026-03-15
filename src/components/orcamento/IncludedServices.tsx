import { motion } from "framer-motion";
import {
  Users, FolderLock, Network, HardDrive, Wifi,
  Server, Shield, Activity, Headphones,
} from "lucide-react";

const services = [
  { icon: Users, title: "Active Directory", desc: "Gerenciamento centralizado de usuários e grupos" },
  { icon: FolderLock, title: "Permissões de usuário", desc: "Controle granular de acessos e pastas" },
  { icon: Network, title: "Pastas de rede", desc: "Compartilhamento seguro de arquivos entre departamentos" },
  { icon: HardDrive, title: "Backup automatizado", desc: "Cópias de segurança a cada 30 minutos" },
  { icon: Wifi, title: "Acesso remoto", desc: "Trabalhe de qualquer lugar com segurança" },
  { icon: Server, title: "Migração de servidor", desc: "Transferência completa dos dados existentes" },
  { icon: Shield, title: "Segurança VPN", desc: "Conexão criptografada com firewall pfSense" },
  { icon: Activity, title: "Monitoramento de rede", desc: "Acompanhamento 24/7 da infraestrutura" },
  { icon: Headphones, title: "Suporte técnico", desc: "Equipe especializada durante todo o contrato" },
];

const IncludedServices = () => (
  <section className="py-20 section-dark">
    <div className="container mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
          Serviços Inclusos
        </span>
        <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
          Tudo que sua empresa <span className="text-primary">precisa</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {services.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <s.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default IncludedServices;
