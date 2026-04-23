import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = 'https://queroarmas.com.br';
const DEFAULT_OG = `${SITE_URL}/og-default.jpg`;

/**
 * Componente SEO unificado: title, meta description, Open Graph, Twitter Card e JSON-LD.
 * Title é truncado em 60 chars, description em 160 chars.
 */
export const SEO = ({ title, description, canonical, image, type = 'website', jsonLd }: SEOProps) => {
  const safeTitle = title.length > 60 ? `${title.slice(0, 57)}...` : title;
  const safeDesc = description.length > 160 ? `${description.slice(0, 157)}...` : description;
  const url = canonical
    ? canonical.startsWith('http') ? canonical : `${SITE_URL}${canonical}`
    : SITE_URL;
  const ogImage = image || DEFAULT_OG;
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{safeTitle}</title>
      <meta name="description" content={safeDesc} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDesc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
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