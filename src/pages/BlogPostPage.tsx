import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ArrowRight, ChevronRight, MapPin } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import JsonLd, { buildArticleSchema, buildBreadcrumbSchema } from "@/components/JsonLd";
import { blogPosts, blogContent as blogContentData } from "@/data/blogPosts";
import { cities } from "@/data/seo/cities";
import { useLocalizedBlogPosts, useLocalizedBlogContent } from "@/hooks/useBlogLocalized";

/** Try to match a slug like "vantagens-microsoft-365-para-empresas-campinas" */
function resolveBlogSlug(slug: string | undefined) {
  if (!slug) return { post: undefined, city: undefined, baseSlug: undefined };

  // Direct match first
  const directPost = blogPosts.find((p) => p.slug === slug);
  if (directPost) return { post: directPost, city: undefined, baseSlug: slug };

  // Try city suffix match
  for (const city of cities) {
    const suffix = `-${city.slug}`;
    if (slug.endsWith(suffix)) {
      const base = slug.slice(0, -suffix.length);
      const post = blogPosts.find((p) => p.slug === base);
      if (post) return { post, city, baseSlug: base };
    }
  }

  return { post: undefined, city: undefined, baseSlug: undefined };
}

// Legacy content for original posts
const legacyContent = {
  "vantagens-microsoft-365-para-empresas": {
    sections: [
      { body: "Muitas empresas ainda dependem de servidores de email locais com protocolos POP3 ou IMAP. Embora funcionais, essas soluções apresentam limitações significativas em segurança, colaboração e escalabilidade. O Microsoft 365 resolve essas limitações e vai além." },
      { heading: "1. Email profissional com Exchange Online", body: "Com o Exchange Online, sua empresa ganha email corporativo com domínio próprio, calendário compartilhado, salas de reunião virtuais e busca avançada. Tudo sincronizado entre computador, celular e web — diferente do POP3, que baixa emails apenas em um dispositivo." },
      { heading: "2. Colaboração em tempo real com Teams e SharePoint", body: "O Microsoft Teams substitui reuniões presenciais improdutivas por videoconferências organizadas, chat corporativo e compartilhamento de arquivos em tempo real. O SharePoint centraliza documentos da empresa, eliminando a confusão de versões diferentes em pendrives e emails." },
      { heading: "3. Segurança empresarial com Azure AD", body: "O Azure Active Directory oferece autenticação multifator (MFA), acesso condicional e proteção contra ameaças avançadas. Quando um colaborador sai da empresa, você desativa o acesso a tudo em segundos — email, arquivos, Teams e aplicativos." },
      { heading: "4. Armazenamento na nuvem com OneDrive", body: "Cada usuário recebe 1TB de armazenamento na nuvem com o OneDrive. Arquivos ficam acessíveis de qualquer dispositivo, com versionamento automático e recuperação de arquivos excluídos. Fim da dependência de servidores de arquivo locais vulneráveis." },
      { heading: "5. Custo previsível e escalável", body: "Com licenciamento mensal por usuário, sua empresa paga apenas pelo que usa. Quando contrata um novo colaborador, adiciona uma licença em minutos. Quando alguém sai, remove. Sem investimento em servidores, sem manutenção de hardware, sem custos surpresa." },
      { heading: "Conclusão", body: "A migração para o Microsoft 365 não é apenas uma troca de email — é uma transformação na forma como sua empresa se comunica, colabora e protege seus dados. A WMTi realiza a migração completa sem downtime, com treinamento para sua equipe." },
    ],
  },
  "quando-trocar-servidor-da-empresa": {
    sections: [
      { body: "O servidor é o coração da infraestrutura de TI da sua empresa. Quando ele começa a apresentar problemas, toda a operação é impactada. Conheça os sinais de que está na hora de investir em um novo servidor Dell PowerEdge." },
      { heading: "1. Lentidão progressiva", body: "Se o servidor está cada vez mais lento para responder, abrir arquivos ou processar dados, pode ser sinal de hardware subdimensionado ou degradação de componentes. Processadores antigos e memória insuficiente não acompanham softwares modernos." },
      { heading: "2. Ruídos anormais", body: "Cliques repetitivos do HD, ventiladores em alta rotação constante ou vibrações incomuns são sinais de desgaste mecânico. HDs mecânicos têm vida útil de 3-5 anos em uso contínuo — e quando falham, podem levar dados críticos junto." },
      { heading: "3. Reinicializações e telas azuis", body: "Reinicializações espontâneas e telas azuis (BSOD) indicam problemas graves: memória RAM com defeito, superaquecimento ou falha de disco. Cada reinicialização não planejada pode corromper dados e causar perda de trabalho." },
      { heading: "4. Sem redundância (RAID)", body: "Se seu servidor tem apenas um disco, a falha desse disco significa perda total dos dados. Servidores modernos como o Dell PowerEdge R750xs usam RAID com múltiplos discos para que a falha de um deles não afete a operação." },
      { heading: "5. Mais de 5 anos de uso", body: "Servidores com mais de 5 anos estão fora da garantia, com peças difíceis de encontrar e eficiência energética inferior. O custo de manutenção de um servidor antigo frequentemente supera o de um novo." },
      { heading: "6. Sistema operacional sem suporte", body: "Se o servidor roda Windows Server 2012 R2 ou anterior, está sem atualizações de segurança da Microsoft. Isso expõe sua empresa a vulnerabilidades conhecidas e pode gerar problemas de compliance." },
      { heading: "7. Crescimento da empresa", body: "Se a empresa cresceu e o servidor não acompanhou — mais usuários, mais dados, mais aplicações — é hora de dimensionar um novo servidor que atenda a demanda atual e suporte o crescimento futuro." },
      { heading: "Conclusão", body: "Se seu servidor apresenta um ou mais desses sinais, é hora de agir antes que uma falha crítica pare sua operação. A WMTi faz um diagnóstico gratuito do seu servidor atual e projeta a migração para um Dell PowerEdge novo, sem downtime." },
    ],
  },
};

const BlogPostPage = () => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { post, city, baseSlug } = useMemo(() => resolveBlogSlug(slug), [slug]);
  const structuredContent = baseSlug ? blogContentData[baseSlug] : undefined;
  const legacy = baseSlug ? (legacyContent as Record<string, any>)[baseSlug] : undefined;
  const localizedPosts = useLocalizedBlogPosts(post ? [post] : []);
  const localizedPost = localizedPosts[0] || post;
  const localizedStructuredContent = useLocalizedBlogContent(structuredContent, baseSlug);
  const localizedLegacy = legacy; // legacy content stays in PT (only 2 old posts)

  const baseUrl = "https://wmti.com.br";
  const pageUrl = `${baseUrl}${location.pathname}`;

  const cityTitle = city ? ` em ${city.name}` : "";
  const seoTitle = city
    ? `${post?.title}${cityTitle} | Blog WMTi`
    : structuredContent?.metaTitle || (post ? `${post.title} | Blog WMTi` : "Blog | WMTi");
  const seoDesc = city
    ? `${post?.excerpt} Saiba como a WMTi atende empresas em ${city.name} e região de ${city.region}.`
    : structuredContent?.metaDescription || post?.excerpt || "";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) return <Navigate to="/blog" replace />;
  if (!structuredContent && !legacy) return <Navigate to="/blog" replace />;

  const canonicalUrl = city ? `${baseUrl}/blog/${baseSlug}` : pageUrl;

  const breadcrumbItems = [
    { name: "Home", url: `${baseUrl}/` },
    { name: t("blogPost.blog"), url: `${baseUrl}/blog` },
    ...(city ? [{ name: city.name, url: pageUrl }] : []),
    { name: post.title, url: pageUrl },
  ];

  return (
    <div className="min-h-screen">
      <SeoHead
        title={seoTitle}
        description={seoDesc}
        canonical={canonicalUrl}
        ogType="article"
        ogImage={post.image.startsWith("http") ? post.image : `${baseUrl}${post.image}`}
      />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
      <JsonLd
        data={buildArticleSchema({
          title: localizedPost.title,
          description: localizedPost.excerpt,
          url: pageUrl,
          image: post.image.startsWith("http") ? post.image : `${baseUrl}${post.image}`,
          datePublished: post.date,
        })}
      />
      {structuredContent && structuredContent.faq.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: structuredContent.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }}
        />
      )}
      <Navbar />

      {/* Featured image banner */}
      <div className="relative w-full h-48 md:h-64 mt-14 md:mt-16 overflow-hidden">
        <img
          src={post.image}
          alt={localizedPost.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-transparent" />
      </div>

      <section className="section-dark pb-16 md:pb-20 -mt-20 relative z-10">
        <div className="container max-w-3xl px-5 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="mb-6">
              <ol className="flex items-center gap-1 font-mono text-xs text-gunmetal-foreground/50">
                <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li><Link to="/blog" className="hover:text-primary transition-colors">{t("blogPost.blog")}</Link></li>
                <ChevronRight size={10} className="shrink-0" />
                <li className="text-primary truncate max-w-[200px]" aria-current="page">{post.title}</li>
              </ol>
            </nav>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-primary border border-primary/30 px-2 py-0.5">
                {localizedPost.tag}
              </span>
              <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground border border-border px-2 py-0.5">
                {localizedPost.category}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-gunmetal-foreground/50">
                <Calendar size={10} />
                {new Date(post.date).toLocaleDateString(t("blogPost.locale"))}
              </span>
              <span className="font-mono text-[10px] text-gunmetal-foreground/50">
                {post.readTime}
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl mb-4">{localizedPost.title}{cityTitle}</h1>
            {city && (
              <div className="flex items-center gap-2 mt-1 mb-2">
                <MapPin size={14} className="text-primary" />
                <span className="font-mono text-xs text-primary uppercase tracking-wider">
                  {t("blogPost.localContent", { city: city.name, region: city.region })}
                </span>
              </div>
            )}
            <p className="font-body text-lg text-gunmetal-foreground/70 leading-relaxed">
              {localizedPost.excerpt}
              {city && ` ${t("blogPost.cityExcerpt", { city: city.name })}`}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="section-light py-16 md:py-24">
        <div className="container max-w-3xl px-5 md:px-6">
          <div className="font-body text-foreground leading-relaxed [&_h2]:font-heading [&_h2]:text-xl [&_h2]:md:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground [&_p]:text-muted-foreground [&_p]:mb-4">
            {(localizedLegacy || localizedStructuredContent) && (
              <div className="space-y-6">
                {(localizedStructuredContent?.sections || localizedLegacy?.sections || []).map((section, i) => (
                  <div key={i}>
                    {section.heading && <h2>{section.heading}</h2>}
                    <p>{section.body}</p>
                  </div>
                ))}

                {localizedStructuredContent?.faq?.length > 0 && (
                  <div className="mt-12">
                    <h2>{t("blogPost.faq")}</h2>
                    <div className="space-y-6 mt-4">
                      {localizedStructuredContent.faq.map((item, i) => (
                        <div key={i}>
                          <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                          <p>{item.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {localizedStructuredContent?.internalLinks?.length > 0 && (
                  <div className="mt-8 p-6 bg-muted/50 border border-border">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">{t("blogPost.relatedServices")}</p>
                    <div className="flex flex-wrap gap-3">
                      {localizedStructuredContent.internalLinks.map((link, i) => (
                        <Link
                          key={i}
                          to={link.href}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {link.label}
                          <ArrowRight size={12} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* City-specific local context */}
          {city && (
            <div className="mt-10 p-6 md:p-8 bg-muted/30 border border-border rounded-lg">
              <h2 className="font-heading text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                 {localizedPost.tag} {t("blogPost.inCity", { city: city.name })}
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
                 {t("blogPost.companyLocalBlock", { city: city.name, state: city.state, region: city.region })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to={`/empresa-ti-${city.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono uppercase tracking-wider">
                   {t("blogPost.links.company", { city: city.name })} <ArrowRight size={10} />
                </Link>
                <Link to={`/suporte-ti-${city.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono uppercase tracking-wider">
                   {t("blogPost.links.support", { city: city.name })} <ArrowRight size={10} />
                </Link>
                <Link to={`/infraestrutura-ti-${city.slug}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono uppercase tracking-wider">
                   {t("blogPost.links.infrastructure", { city: city.name })} <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          )}

          {/* Related blog posts in other cities */}
          {city && (
            <div className="mt-6 p-6 bg-muted/20 border border-border rounded-lg">
               <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">{t("blogPost.otherCities")}</p>
              <div className="flex flex-wrap gap-2">
                {cities.filter(c => c.slug !== city.slug).slice(0, 8).map(c => (
                  <Link
                    key={c.slug}
                    to={`/blog/${baseSlug}-${c.slug}`}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors font-body"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 bg-secondary p-8 md:p-12 text-center border border-border">
            <h3 className="text-xl md:text-2xl text-secondary-foreground mb-3">
              {t("blog.ctaTitle")} <span className="text-primary">{t("blog.ctaTitleHighlight")}{city ? t("blog.ctaTitleCitySuffix", { city: city.name }) : ""}?</span>
            </h3>
            <p className="font-body text-sm text-secondary-foreground/70 max-w-md mx-auto mb-6">
               {localizedStructuredContent?.cta || t("blog.ctaDesc")}
              {city && t("blog.ctaCitySuffix", { city: city.name, region: city.region })}
            </p>
            <a
               href={`https://wa.me/5511963166915?text=${encodeURIComponent(t("blogPost.whatsappMessage", { title: localizedPost.title, city: city?.name || "" }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
            >
              {t("blog.ctaBtn")}
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default BlogPostPage;
