import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { findPageBySlug } from "@/data/seoPages";
import { resolveLocalPage, parseLocalSlug } from "@/data/seo/engine";
import ServicePageTemplate from "@/components/ServicePageTemplate";
import NotFound from "@/pages/NotFound";

const DynamicSeoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // 1. Redirect /ti-para-clinicas-{city} → /ti-para-hospitais-e-clinicas-em-{city}
  const isClinicRedirect = slug?.startsWith("ti-para-clinicas-");
  const clinicCity = isClinicRedirect ? slug!.replace("ti-para-clinicas-", "") : null;

  useEffect(() => {
    if (isClinicRedirect && clinicCity) {
      navigate(`/ti-para-hospitais-e-clinicas-em-${clinicCity}`, { replace: true });
    }
  }, [isClinicRedirect, clinicCity, navigate]);

  if (!slug || isClinicRedirect) return null;

  // 2. Try the central SEO engine first (handles -em- and old patterns)
  const enginePage = resolveLocalPage(slug);

  // 3. Fallback to the static/pre-generated page registry
  const staticPage = !enginePage ? findPageBySlug(slug) : null;

  const page = enginePage || staticPage;

  // 4. If nothing matches, show 404 — never redirect to home
  if (!page) return <NotFound />;

  // Detect problem pages for emergency form
  const parsed = enginePage ? parseLocalSlug(slug) : null;
  const isProblemPage = parsed?.entity.type === "problem" || page.category === "problema" || page.category === "problem-page";
  const problemName = parsed?.entity.type === "problem" ? parsed.entity.name : undefined;

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
      isProblemPage={isProblemPage}
      problemName={problemName}
    />
  );
};

export default DynamicSeoPage;
