import { useParams, Navigate } from "react-router-dom";
import { findPageBySlug } from "@/data/seoPages";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const DynamicSeoPage = () => {
  const { slug } = useParams<{ slug: string }>();

  // Redirect /ti-para-clinicas-{city} → /ti-para-hospitais-{city}
  if (slug?.startsWith("ti-para-clinicas-")) {
    const city = slug.replace("ti-para-clinicas-", "");
    return <Navigate to={`/ti-para-hospitais-${city}`} replace />;
  }

  const page = slug ? findPageBySlug(slug) : undefined;

  if (!page) return <Navigate to="/" replace />;

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
    />
  );
};

export default DynamicSeoPage;
