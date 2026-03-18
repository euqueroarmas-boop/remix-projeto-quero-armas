import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Building2,
  Server,
  Shield,
  Monitor,
  Users,
  Network,
  Cloud,
  HardDrive,
  Lock,
  Briefcase,
  Heart,
  Scale,
  Calculator,
  Factory,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { blogPosts } from "@/data/blogPosts";
import institucionalHero from "@/assets/institucional-hero.webp";
import poweredgeImage from "@/assets/poweredge-server.webp";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

/* ─── INSTITUCIONAL ─── */
export const HomeInstitucional = () => (
  <section className="py-16 md:py-24 section-dark">
    <div className="container">
      <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
        <motion.div {...fade}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Institucional
          </p>
          <h2 className="text-2xl md:text-4xl lg:text-5xl mb-4 md:mb-6">
            Quem é a <span className="text-primary">WMTi</span>.
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base leading-relaxed mb-4">
            Há mais de 15 anos construímos infraestrutura de TI segura e
            confiável para empresas de todos os portes. Nossa missão é garantir
            estabilidade operacional, proteção de dados e continuidade dos
            negócios.
          </p>
          <p className="font-body text-muted-foreground/70 text-sm leading-relaxed mb-8">
            Somos referência no Vale do Paraíba em servidores Dell PowerEdge,
            Microsoft 365, firewalls pfSense e suporte técnico especializado.
          </p>
          <Link
            to="/institucional"
            className="group inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-primary hover:brightness-110 transition-all"
          >
            Conheça a WMTi
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.15 }}>
          <img
            src={institucionalHero}
            alt="Equipe WMTi em ambiente corporativo de TI"
            className="w-full aspect-[4/3] object-cover border border-border"
            loading="lazy"
          />
        </motion.div>
      </div>
    </div>
  </section>
);

/* ─── SERVIÇOS ─── */
const serviceSummary = [
  { icon: Monitor, label: "Locação de Computadores", href: "/locacao-de-computadores-para-empresas-jacarei" },
  { icon: Server, label: "Suporte de TI", href: "/suporte-ti-jacarei" },
  { icon: Network, label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" },
  { icon: Users, label: "Terceirização de TI", href: "/terceirizacao-de-mao-de-obra-ti" },
  { icon: HardDrive, label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
  { icon: Cloud, label: "Microsoft 365", href: "/microsoft-365-empresas-jacarei" },
  { icon: Shield, label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" },
  { icon: Lock, label: "Segurança da Informação", href: "/seguranca-informacao-empresarial" },
];

export const HomeServicos = () => (
  <section id="servicos" className="py-16 md:py-24 bg-background">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Serviços
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Soluções completas em <span className="text-primary">TI</span>.
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
          Da locação de equipamentos à gestão completa de infraestrutura — tudo
          que sua empresa precisa para operar com segurança e performance.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {serviceSummary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <Link
              to={s.href}
              className="flex flex-col items-start gap-3 p-5 md:p-8 bg-background hover:bg-muted/50 transition-colors group h-full"
            >
              <s.icon size={24} className="text-primary" strokeWidth={1.5} />
              <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                {s.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.div {...fade} className="mt-8 md:mt-10 text-center">
        <Link
          to="/servicos"
          className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
        >
          Ver todos os serviços
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </div>
  </section>
);

/* ─── SEGMENTOS ─── */
const segmentSummary = [
  { icon: Scale, label: "Cartórios", href: "/ti-para-cartorios" },
  { icon: Heart, label: "Hospitais e Clínicas", href: "/ti-para-hospitais-e-clinicas" },
  { icon: Briefcase, label: "Escritórios de Advocacia", href: "/ti-para-escritorios-de-advocacia" },
  { icon: Calculator, label: "Contabilidades", href: "/ti-para-contabilidades" },
  { icon: Factory, label: "Empresas Corporativas", href: "/ti-para-escritorios-corporativos" },
];

export const HomeSegmentos = () => (
  <section id="segmentos" className="py-16 md:py-24 section-dark">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Segmentos
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Atendimento <span className="text-primary">especializado</span>.
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
          Cada segmento tem necessidades únicas de infraestrutura. A WMTi adapta
          soluções específicas para cada tipo de operação.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        {segmentSummary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Link
              to={s.href}
              className="flex flex-col items-center gap-4 p-6 md:p-8 border border-border hover:border-primary/40 bg-background/50 hover:bg-muted/30 transition-all group text-center h-full"
            >
              <div className="w-12 h-12 flex items-center justify-center border border-primary/30 bg-primary/5 group-hover:bg-primary/10 transition-colors">
                <s.icon size={22} className="text-primary" strokeWidth={1.5} />
              </div>
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                {s.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── INFRAESTRUTURA ─── */
export const HomeInfraestrutura = () => (
  <section id="infraestrutura" className="py-16 md:py-24 bg-background">
    <div className="container">
      <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
        <motion.div {...fade} transition={{ duration: 0.5, delay: 0.1 }}>
          <img
            src={poweredgeImage}
            alt="Servidor Dell PowerEdge em rack corporativo"
            className="w-full aspect-[4/3] object-cover border border-border"
            loading="lazy"
          />
        </motion.div>
        <motion.div {...fade}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Infraestrutura
          </p>
          <h2 className="text-2xl md:text-4xl lg:text-5xl mb-4 md:mb-6">
            Hardware <span className="text-primary">enterprise</span>.
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base leading-relaxed mb-4">
            Servidores Dell PowerEdge, redes corporativas, firewalls pfSense e
            soluções de backup. Projetamos e implementamos ambientes que garantem
            alta disponibilidade e desempenho.
          </p>
          <p className="font-body text-muted-foreground/70 text-sm leading-relaxed mb-8">
            Infraestrutura dimensionada sob medida para a realidade de cada empresa,
            com monitoramento 24/7 e suporte técnico especializado.
          </p>
          <Link
            to="/infraestrutura"
            className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            Ver soluções de infraestrutura
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ─── BLOG ─── */
export const HomeBlog = () => {
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <section className="py-16 md:py-24 section-dark">
      <div className="container">
        <motion.div {...fade} className="mb-10 md:mb-14">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Blog
          </p>
          <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
            Conteúdo <span className="text-primary">técnico</span>.
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
            Artigos sobre segurança da informação, infraestrutura de TI e
            tendências tecnológicas para empresas.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-px bg-border">
          {recentPosts.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="flex flex-col bg-background hover:bg-muted/50 transition-colors group h-full"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 md:p-6 flex flex-col flex-1">
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary mb-2">
                    {post.tag}
                  </span>
                  <h3 className="font-heading text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="font-body text-xs text-muted-foreground line-clamp-2 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                    <BookOpen size={12} className="text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>

        <motion.div {...fade} className="mt-8 md:mt-10 text-center">
          <Link
            to="/blog"
            className="group inline-flex items-center gap-2 border border-primary text-primary px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground transition-all"
          >
            Acessar blog
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
