import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { BlogPost, BlogCategory, BlogPostContent } from "@/data/blogPosts";

/** Category translation map */
const categoryTranslations: Record<BlogCategory, string> = {
  "Hospitais e Clínicas": "Hospitals & Clinics",
  "Cartórios": "Notary Offices",
  "Escritórios de Advocacia": "Law Firms",
  "Escritórios de Contabilidade": "Accounting Firms",
  "Empresas Corporativas": "Corporate Enterprises",
  "Tecnologia Empresarial": "Business Technology",
  "Infraestrutura de TI": "IT Infrastructure",
  "Segurança Digital": "Digital Security",
  "Problemas de TI": "IT Issues",
  "Custos de TI": "IT Costs",
  "Conteúdo Regional": "Regional Content",
  "Casos de Sucesso": "Success Stories",
};

export function useLocalizedCategory(category: BlogCategory): string {
  const { i18n } = useTranslation();
  if (i18n.language.startsWith("pt")) return category;
  return categoryTranslations[category] || category;
}

export function useLocalizedCategories(categories: BlogCategory[]): string[] {
  const { i18n } = useTranslation();
  return useMemo(() => {
    if (i18n.language.startsWith("pt")) return categories;
    return categories.map((c) => categoryTranslations[c] || c);
  }, [categories, i18n.language]);
}

export function useLocalizedBlogPosts(posts: BlogPost[]): BlogPost[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    if (i18n.language.startsWith("pt")) return posts;
    return posts.map((post) => {
      const titleKey = `blog.posts.${post.slug}.title`;
      const excerptKey = `blog.posts.${post.slug}.excerpt`;
      const translatedTitle = t(titleKey, { defaultValue: "" });
      const translatedExcerpt = t(excerptKey, { defaultValue: "" });
      return {
        ...post,
        title: translatedTitle || post.title,
        excerpt: translatedExcerpt || post.excerpt,
        tag: t(`blog.tags.${post.tag}`, { defaultValue: post.tag }),
        category: (categoryTranslations[post.category] || post.category) as BlogCategory,
      };
    });
  }, [posts, i18n.language, t]);
}

export function useLocalizedBlogContent(
  content: BlogPostContent | undefined,
  slug: string | undefined
): BlogPostContent | undefined {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    if (!content || !slug) return content;
    if (i18n.language.startsWith("pt")) return content;

    const key = `blog.posts.${slug}`;
    const sections = t(`${key}.sections`, { returnObjects: true, defaultValue: null });
    const faq = t(`${key}.faq`, { returnObjects: true, defaultValue: null });
    const cta = t(`${key}.cta`, { defaultValue: "" });

    return {
      ...content,
      metaTitle: t(`${key}.metaTitle`, { defaultValue: content.metaTitle }),
      metaDescription: t(`${key}.metaDescription`, { defaultValue: content.metaDescription }),
      sections: Array.isArray(sections) ? sections : content.sections,
      faq: Array.isArray(faq) ? faq : content.faq,
      cta: cta || content.cta,
      internalLinks: content.internalLinks, // keep original hrefs
    };
  }, [content, slug, i18n.language, t]);
}
