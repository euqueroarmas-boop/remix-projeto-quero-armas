import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://dell-shine-solutions.lovable.app";
const CANONICAL_URL = "https://www.wmti.com.br";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Blog Prerender Edge Function
 * 
 * Serves a fully-rendered HTML page for /blog with real links to all published posts.
 * This ensures crawlers (Googlebot, test bots) can discover blog article URLs
 * without executing JavaScript.
 *
 * Usage:
 * GET /blog-prerender              → Full HTML page with all posts
 * GET /blog-prerender?format=links → JSON array of {slug, title, url} for tests
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const supabase = getSupabase();

  // Fetch all published posts
  const { data: posts, error } = await supabase
    .from("blog_posts_ai")
    .select("slug, title, excerpt, image_url, category, tag, read_time, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allPosts = posts || [];

  // JSON format for tests
  if (format === "links") {
    const links = allPosts.map((p) => ({
      slug: p.slug,
      title: p.title,
      url: `/blog/${p.slug}`,
    }));
    return new Response(JSON.stringify({ count: links.length, links }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Full HTML for crawlers
  const postCards = allPosts.map((p) => {
    const pubDate = p.published_at
      ? new Date(p.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : "";
    const imgSrc = p.image_url || "/placeholder.svg";
    const excerpt = p.excerpt ? escapeHtml(p.excerpt).substring(0, 200) : "";

    return `
    <article class="blog-card" itemscope itemtype="https://schema.org/BlogPosting">
      <a href="/blog/${escapeHtml(p.slug)}" class="card-link">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.title)}" loading="lazy" width="400" height="225" />
        <div class="card-body">
          <span class="category">${escapeHtml(p.category || p.tag || "")}</span>
          <h2 itemprop="headline">${escapeHtml(p.title)}</h2>
          <p itemprop="description">${excerpt}</p>
          <div class="meta">
            <time itemprop="datePublished" datetime="${p.published_at || ""}">${pubDate}</time>
            <span>${escapeHtml(p.read_time || "5 min")}</span>
          </div>
        </div>
      </a>
    </article>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog WMTi - Artigos sobre TI Corporativa, Segurança e Infraestrutura</title>
  <meta name="description" content="Artigos especializados sobre TI corporativa, segurança da informação, infraestrutura de redes, servidores e soluções para empresas." />
  <link rel="canonical" href="${CANONICAL_URL}/blog" />
  <meta property="og:title" content="Blog WMTi - TI Corporativa" />
  <meta property="og:description" content="Artigos sobre TI, segurança e infraestrutura para empresas." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${CANONICAL_URL}/blog" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 2rem; margin-bottom: 1.5rem; color: #fff; }
    .post-count { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
    .blog-card { background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #333; }
    .card-link { text-decoration: none; color: inherit; display: block; }
    .blog-card img { width: 100%; height: 200px; object-fit: cover; }
    .card-body { padding: 1.25rem; }
    .category { font-size: 0.75rem; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; }
    h2 { font-size: 1.1rem; margin: 0.5rem 0; color: #fff; line-height: 1.4; }
    p { font-size: 0.9rem; color: #aaa; line-height: 1.5; }
    .meta { display: flex; justify-content: space-between; margin-top: 1rem; font-size: 0.8rem; color: #666; }
    nav.breadcrumb { margin-bottom: 1rem; font-size: 0.85rem; }
    nav.breadcrumb a { color: #60a5fa; text-decoration: none; }
    .noscript-note { background: #1e293b; color: #94a3b8; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.85rem; }
  </style>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Blog WMTi",
    "description": "Artigos sobre TI corporativa para empresas",
    "url": "${CANONICAL_URL}/blog",
    "publisher": {
      "@type": "Organization",
      "name": "WMTi Soluções em TI"
    },
    "blogPost": [${allPosts.slice(0, 20).map(p => `{
      "@type": "BlogPosting",
      "headline": "${escapeHtml(p.title)}",
      "url": "${CANONICAL_URL}/blog/${p.slug}",
      "datePublished": "${p.published_at || ""}"
    }`).join(",")}]
  }
  </script>
</head>
<body>
  <div class="container">
    <nav class="breadcrumb">
      <a href="/">Home</a> › <span>Blog</span>
    </nav>
    <h1>Blog WMTi — TI Corporativa</h1>
    <p class="post-count">${allPosts.length} artigos publicados</p>
    <div class="grid">
${postCards}
    </div>
  </div>
  <noscript>
    <div class="noscript-note">Esta é a versão estática do blog. Para a experiência completa, habilite JavaScript.</div>
  </noscript>
  <script>
    // Redirect to SPA if JS is available (real users)
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/bot|crawl|spider|slurp|Googlebot/i)) {
      window.location.replace('${SITE_URL}/blog');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});
