import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SITE_URL = 'https://www.euqueroarmas.com.br';
const DEFAULT_OG = `${SITE_URL}/og/home.jpg`;
const SITE_NAME = 'Quero Armas';

function absoluteUrl(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  if (!v) return fallback;
  if (/^https?:\/\//i.test(v)) return v;
  return `${SITE_URL}${v.startsWith('/') ? '' : '/'}${v}`;
}

/**
 * Componente SEO unificado: title, meta description, Open Graph, Twitter Card e JSON-LD.
 * Title é truncado em 60 chars, description em 160 chars.
 */
export const SEO = ({ title, description, canonical, image, type = 'website', jsonLd }: SEOProps) => {
  const safeTitle = title.length > 60 ? `${title.slice(0, 57)}...` : title;
  const safeDesc = description.length > 160 ? `${description.slice(0, 157)}...` : description;
  const url = canonical ? absoluteUrl(canonical, SITE_URL) : SITE_URL;
  const ogImage = absoluteUrl(image, DEFAULT_OG);
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{safeTitle}</title>
      <meta name="description" content={safeDesc} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDesc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="pt_BR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDesc} />
      <meta name="twitter:image" content={ogImage} />
      {jsonLdArray.map((data, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
};