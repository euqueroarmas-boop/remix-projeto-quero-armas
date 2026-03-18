interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

/** Renders a JSON-LD script tag for structured data */
const JsonLd = ({ data }: JsonLdProps) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
);

export default JsonLd;

/* ─── Helper builders ─── */

export function buildFaqSchema(faq: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildServiceSchema(opts: {
  name: string;
  description: string;
  url: string;
  areaServed?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    provider: {
      "@type": "Organization",
      name: "WMTi Tecnologia da Informação",
      url: "https://www.wmti.com.br",
    },
    ...(opts.areaServed
      ? { areaServed: { "@type": "City", name: opts.areaServed } }
      : {}),
  };
}

export function buildArticleSchema(opts: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    image: opts.image,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: {
      "@type": "Organization",
      name: "WMTi Tecnologia da Informação",
      url: "https://www.wmti.com.br",
    },
    publisher: {
      "@type": "Organization",
      name: "WMTi Tecnologia da Informação",
      logo: {
        "@type": "ImageObject",
        url: "https://www.wmti.com.br/logo-wmti.jpeg",
      },
    },
  };
}
