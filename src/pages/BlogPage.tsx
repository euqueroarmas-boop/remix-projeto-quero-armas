import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, Search, X, Filter, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import { blogPosts, blogCategories, type BlogCategory } from "@/data/blogPosts";

export type { BlogPost } from "@/data/blogPosts";
export { blogPosts } from "@/data/blogPosts";

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState<BlogCategory | "Todos">("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const sorted = useMemo(
    () => [...blogPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    []
  );

  const filtered = useMemo(() => {
    let results = activeCategory === "Todos" ? sorted : sorted.filter((p) => p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tag.toLowerCase().includes(q)
      );
    }
    return results;
  }, [activeCategory, searchQuery, sorted]);

  const featuredPost = filtered[0];
  const restPosts = filtered.slice(1);
  const recentSlugs = new Set(sorted.slice(0, 3).map((p) => p.slug));
  const allCategories: (BlogCategory | "Todos")[] = ["Todos", ...blogCategories];

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Blog | WMTi Tecnologia da Informação"
        description="Artigos sobre TI corporativa, servidores Dell, Microsoft 365, segurança de rede, firewall pfSense e infraestrutura para empresas."
        canonical="https://wmti.com.br/blog"
      />
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative pt-28 md:pt-36 pb-20 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="container relative z-10 max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-block font-mono text-[11px] tracking-[0.3em] uppercase text-primary mb-5 border border-primary/20 rounded-full px-4 py-1.5">
              // Blog
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-5">
              Blog <span className="text-primary">WMTi</span>
            </h1>
            <p className="font-body text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Conteúdos sobre infraestrutura de TI, servidores, redes corporativas, Microsoft 365, segurança da informação e tecnologia para empresas.
            </p>
          </motion.div>

          {/* ── Search ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-8 max-w-xl mx-auto"
          >
            <div className="relative group">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                type="text"
                placeholder="Buscar artigos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground/60 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section className="sticky top-14 md:top-16 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container py-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full border transition-all duration-200 ${
                  activeCategory === cat
                    ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="py-12 md:py-20">
        <div className="container">
          {/* Result count */}
          {(activeCategory !== "Todos" || searchQuery) && (
            <p className="font-mono text-xs text-muted-foreground mb-8">
              {filtered.length} artigo{filtered.length !== 1 ? "s" : ""}
              {activeCategory !== "Todos" && (
                <> em <span className="text-primary">{activeCategory}</span></>
              )}
              {searchQuery && (
                <> para "<span className="text-primary">{searchQuery}</span>"</>
              )}
            </p>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground font-body text-lg">Nenhum artigo encontrado.</p>
              <button
                onClick={() => { setActiveCategory("Todos"); setSearchQuery(""); }}
                className="mt-4 font-mono text-xs uppercase tracking-wider text-primary hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* ── Featured Post ── */}
          {featuredPost && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-12 md:mb-16"
            >
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group block rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="grid md:grid-cols-2">
                  <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden">
                    <img
                      src={featuredPost.image}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/10" />
                    {recentSlugs.has(featuredPost.slug) && (
                      <span className="absolute top-4 left-4 font-mono text-[10px] tracking-[0.15em] uppercase bg-primary text-primary-foreground px-3 py-1 rounded-full">
                        Recente
                      </span>
                    )}
                  </div>
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-primary border border-primary/30 px-2.5 py-1 rounded-full">
                        {featuredPost.category}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <Calendar size={10} />
                        {new Date(featuredPost.date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {featuredPost.readTime}
                      </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-4 group-hover:text-primary transition-colors">
                      {featuredPost.title}
                    </h2>
                    <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-primary group-hover:gap-3 transition-all">
                      Ler artigo
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          )}

          {/* ── Post Grid ── */}
          {restPosts.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {restPosts.map((post, i) => (
                <motion.article
                  key={post.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: (i % 6) * 0.06 }}
                >
                  <Link
                    to={`/blog/${post.slug}`}
                    className="group block h-full rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-300"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      {recentSlugs.has(post.slug) && (
                        <span className="absolute top-3 left-3 font-mono text-[9px] tracking-[0.15em] uppercase bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full">
                          Recente
                        </span>
                      )}
                    </div>

                    <div className="p-5 md:p-6 flex flex-col">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-primary border border-primary/25 px-2 py-0.5 rounded-full">
                          {post.category}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          <Calendar size={9} />
                          {new Date(post.date).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <h2 className="text-base md:text-lg font-semibold leading-snug mb-2.5 group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h2>

                      <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 flex-grow">
                        {post.excerpt}
                      </p>

                      <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-primary group-hover:gap-3 transition-all mt-auto">
                        Ler artigo
                        <ArrowRight size={12} />
                      </span>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default BlogPage;
