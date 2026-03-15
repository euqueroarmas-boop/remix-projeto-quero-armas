import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import { blogPosts, blogCategories, type BlogCategory } from "@/data/blogPosts";

export type { BlogPost } from "@/data/blogPosts";
export { blogPosts } from "@/data/blogPosts";

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "Todos">("Todos");
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  const sorted = [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filtered = activeCategory === "Todos"
    ? sorted
    : sorted.filter((p) => p.category === activeCategory);
  const recentSlugs = new Set(sorted.slice(0, 3).map(p => p.slug));

  const allCategories: (BlogCategory | "Todos")[] = ["Todos", ...blogCategories];

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Blog | WMTi Tecnologia da Informação"
        description="Artigos sobre TI corporativa, servidores Dell, Microsoft 365, segurança de rede, firewall pfSense e infraestrutura para empresas."
        canonical="https://wmti.com.br/blog"
      />
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
      <section className="bg-secondary/95 backdrop-blur-sm border-b border-border sticky top-14 md:top-16 z-30">
        <div className="container py-3 md:py-4">
          {/* Desktop: horizontal scrollable pills */}
          <div className="hidden md:flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap ${
                  activeCategory === cat
                    ? "border-primary text-primary-foreground bg-primary shadow-md shadow-primary/20"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Mobile: dropdown selector */}
          <div className="md:hidden relative">
            <button
              onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 font-mono text-xs uppercase tracking-[0.12em] px-4 py-3 rounded-lg border border-border bg-background text-foreground"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {activeCategory}
              </span>
              <ChevronDown size={14} className={`transition-transform text-muted-foreground ${mobileDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl shadow-black/20 z-50 max-h-[60vh] overflow-y-auto"
              >
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setMobileDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] transition-colors border-b border-border/30 last:border-0 ${
                      activeCategory === cat
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground active:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${activeCategory === cat ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      {cat}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
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
                    {recentSlugs.has(post.slug) && (
                      <span className="font-mono text-[10px] tracking-[0.15em] uppercase bg-primary text-primary-foreground px-2 py-0.5">
                        Recente
                      </span>
                    )}
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
