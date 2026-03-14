import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { blogPosts, blogCategories, type BlogCategory } from "@/data/blogPosts";

export type { BlogPost } from "@/data/blogPosts";
export { blogPosts } from "@/data/blogPosts";

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "Todos">("Todos");

  useEffect(() => {
    document.title = "Blog | WMTi Tecnologia da Informação";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Artigos sobre TI corporativa, servidores Dell, Microsoft 365, segurança de rede, firewall pfSense e infraestrutura para empresas.");
    window.scrollTo(0, 0);
  }, []);

  const filtered = activeCategory === "Todos"
    ? blogPosts
    : blogPosts.filter((p) => p.category === activeCategory);

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

      {/* Category filters */}
      <section className="bg-secondary border-b border-border sticky top-14 md:top-16 z-30">
        <div className="container py-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveCategory("Todos")}
              className={`font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border transition-colors whitespace-nowrap ${
                activeCategory === "Todos"
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
              }`}
            >
              Todos
            </button>
            {blogCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`font-mono text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 border transition-colors whitespace-nowrap ${
                  activeCategory === cat
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section-light py-16 md:py-24">
        <div className="container">
          {activeCategory !== "Todos" && (
            <p className="font-mono text-xs text-muted-foreground mb-6">
              {filtered.length} artigo{filtered.length !== 1 ? "s" : ""} em <span className="text-primary">{activeCategory}</span>
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-px bg-border">
            {filtered.map((post, i) => (
              <motion.article
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 6) * 0.08 }}
                className="bg-background group hover:bg-muted transition-colors"
              >
                <Link to={`/blog/${post.slug}`} className="block overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </Link>

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-primary border border-primary/30 px-2 py-0.5">
                      {post.tag}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground border border-border px-2 py-0.5">
                      {post.category}
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
                </div>
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
