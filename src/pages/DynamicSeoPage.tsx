import { useParams, Navigate } from "react-router-dom";
import { findPageBySlug } from "@/data/seoPages";
import ServicePageTemplate from "@/components/ServicePageTemplate";

const DynamicSeoPage = () => {
  const { slug } = useParams<{ slug: string }>();
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
    />
  );
};

export default DynamicSeoPage;
