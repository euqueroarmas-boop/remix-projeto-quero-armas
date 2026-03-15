import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, Search, X, Filter, Layers } from "lucide-react";
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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

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

  // Count posts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: sorted.length };
    for (const post of sorted) {
      counts[post.category] = (counts[post.category] || 0) + 1;
    }
    return counts;
  }, [sorted]);

  const handleCategoryClick = (cat: BlogCategory | "Todos") => {
    setActiveCategory(cat);
    setMobileFilterOpen(false);
  };

  /* ── Sidebar category item ── */
  const CategoryItem = ({ cat }: { cat: BlogCategory | "Todos" }) => (
    <button
      onClick={() => handleCategoryClick(cat)}
      className={`group flex items-center justify-between w-full text-left px-3 py-2.5 rounded-lg font-body text-[13px] transition-all duration-150 ${
        activeCategory === cat
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span className="truncate">{cat}</span>
      <span className={`font-mono text-[10px] tabular-nums shrink-0 ml-2 ${
        activeCategory === cat ? "text-primary" : "text-muted-foreground/50"
      }`}>
        {categoryCounts[cat] || 0}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Blog | WMTi Tecnologia da Informação"
        description="Artigos sobre TI corporativa, servidores Dell, Microsoft 365, segurança de rede, firewall pfSense e infraestrutura para empresas."
        canonical="https://wmti.com.br/blog"
      />
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative pt-28 md:pt-36 pb-16 md:pb-20 overflow-hidden">
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

      {/* ── Two-Column Layout ── */}
      <section className="pb-16 md:pb-24">
        <div className="container">
          {/* ── Mobile filter button ── */}
          <div className="lg:hidden mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-lg border border-border bg-card hover:border-primary/40 text-foreground transition-all duration-200 w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Filter size={14} className="text-primary" />
                    {activeCategory === "Todos" ? "Todas as categorias" : activeCategory}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-sm p-2 bg-card border border-border rounded-xl shadow-xl">
                <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto">
                  {allCategories.map((cat) => (
                    <CategoryItem key={cat} cat={cat} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-8 lg:gap-10 items-start">
            {/* ── Desktop Sidebar ── */}
            <aside className="hidden lg:block w-64 shrink-0 sticky top-20">
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 px-3 mb-3">
                  <Layers size={14} className="text-primary" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    Categorias
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {allCategories.map((cat) => (
                    <CategoryItem key={cat} cat={cat} />
                  ))}
                </div>
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {/* Result count */}
              {(activeCategory !== "Todos" || searchQuery) && (
                <div className="flex items-center justify-between mb-6">
                  <p className="font-mono text-xs text-muted-foreground">
                    {filtered.length} artigo{filtered.length !== 1 ? "s" : ""}
                    {activeCategory !== "Todos" && (
                      <> em <span className="text-primary">{activeCategory}</span></>
                    )}
                    {searchQuery && (
                      <> para &ldquo;<span className="text-primary">{searchQuery}</span>&rdquo;</>
                    )}
                  </p>
                  <button
                    onClick={() => { setActiveCategory("Todos"); setSearchQuery(""); }}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                  >
                    <X size={12} />
                    Limpar
                  </button>
                </div>
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
                  className="mb-10"
                >
                  <Link
                    to={`/blog/${featuredPost.slug}`}
                    className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="grid md:grid-cols-2">
                      <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px] overflow-hidden">
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
                      <div className="p-6 md:p-8 flex flex-col justify-center">
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
                        <h2 className="text-xl md:text-2xl font-bold leading-tight mb-3 group-hover:text-primary transition-colors">
                          {featuredPost.title}
                        </h2>
                        <p className="font-body text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
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
                <div className="grid sm:grid-cols-2 gap-6">
                  {restPosts.map((post, i) => (
                    <motion.article
                      key={post.slug}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: (i % 4) * 0.06 }}
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

                        <div className="p-5 flex flex-col">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-primary border border-primary/25 px-2 py-0.5 rounded-full">
                              {post.category}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              <Calendar size={9} />
                              {new Date(post.date).toLocaleDateString("pt-BR")}
                            </span>
                          </div>

                          <h2 className="text-base font-semibold leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
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
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default BlogPage;
