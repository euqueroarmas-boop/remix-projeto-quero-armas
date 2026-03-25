import { useParams } from "react-router-dom";
import { findPageBySlug } from "@/data/seoPages";
import { resolveLocalPage } from "@/data/seo/engine";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import NotFound from "@/pages/NotFound";

const DynamicSeoPage = () => {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) return <NotFound />;

  // 1. Redirect /ti-para-clinicas-{city} → /ti-para-hospitais-{city}
  if (slug.startsWith("ti-para-clinicas-")) {
    const city = slug.replace("ti-para-clinicas-", "");
    // Use window.location for SEO redirect
    window.location.replace(`/ti-para-hospitais-${city}`);
    return null;
  }

  // 2. Try the central SEO engine first (handles -em- and old patterns)
  const enginePage = resolveLocalPage(slug);

  // 3. Fallback to the static/pre-generated page registry
  const staticPage = !enginePage ? findPageBySlug(slug) : null;

  const page = enginePage || staticPage;

  // 4. If nothing matches, show 404 — never redirect to home
  if (!page) return <NotFound />;

  return (
    <ServicePageTemplate
      title={page.metaTitle}
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
      tag={page.tag}
      headline={<>{page.headline}<span className="text-primary">{page.headlineHighlight}</span></>}
      description={page.description}
      whatsappMessage={page.whatsappMessage}
      painPoints={page.painPoints}
      solutions={page.solutions}
      benefits={page.benefits}
      faq={page.faq}
      relatedLinks={page.relatedLinks}
      localContent={page.localContent}
      canonicalSlug={page.canonicalSlug}
      shouldIndex={page.shouldIndex}
      cityName={page.cityName}
      citySlug={page.citySlug}
    />
  );
};

export default DynamicSeoPage;
