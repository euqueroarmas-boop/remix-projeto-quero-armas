import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tag: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "vantagens-microsoft-365-para-empresas",
    title: "5 vantagens do Microsoft 365 para empresas que ainda usam email POP/IMAP",
    excerpt: "Descubra por que migrar para o Microsoft 365 é essencial para produtividade, segurança e colaboração na sua empresa. Entenda as limitações do email tradicional e os benefícios da nuvem Microsoft.",
    date: "2026-03-10",
    readTime: "5 min",
    tag: "Microsoft 365",
  },
  {
    slug: "quando-trocar-servidor-da-empresa",
    title: "Quando é hora de trocar o servidor da sua empresa? 7 sinais de alerta",
    excerpt: "Seu servidor está lento, fazendo ruídos ou apresentando falhas? Conheça os 7 sinais que indicam que é hora de investir em um novo servidor Dell PowerEdge para sua empresa.",
    date: "2026-03-05",
    readTime: "6 min",
    tag: "Servidores",
  },
];

const BlogPage = () => {
  useEffect(() => {
    document.title = "Blog | WMTi Tecnologia da Informação";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Artigos sobre TI corporativa, servidores Dell, Microsoft 365, segurança de rede, firewall pfSense e infraestrutura para empresas.");
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="section-dark pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Blog
            </p>
            <h1 className="text-3xl md:text-5xl mb-4">
              Conhecimento para sua <span className="text-primary">empresa.</span>
            </h1>
            <p className="font-body text-lg text-gunmetal-foreground/70 max-w-2xl">
              Artigos sobre infraestrutura de TI, segurança, produtividade e tecnologia para empresas.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="section-light py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-px bg-border">
            {blogPosts.map((post, i) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-background p-8 group hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-primary border border-primary/30 px-2 py-0.5">
                    {post.tag}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Calendar size={10} />
                    {new Date(post.date).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {post.readTime}
                  </span>
                </div>

                <h2 className="text-lg md:text-xl mb-3 group-hover:text-primary transition-colors">
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>

                <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                  {post.excerpt}
                </p>

                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary hover:underline"
                >
                  Ler artigo
                  <ArrowRight size={12} />
                </Link>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default BlogPage;
