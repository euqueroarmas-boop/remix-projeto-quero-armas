import { supabase } from "@/integrations/supabase/client";
import type { CmsPage, CmsPricingRule, CmsRedirect, PageType, PageStatus } from "./cmsTypes";

// ─── Pages ───

export async function fetchCmsPages(type?: PageType): Promise<CmsPage[]> {
  let query = supabase.from("cms_pages" as any).select("*").order("updated_at", { ascending: false });
  if (type) query = query.eq("page_type", type);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as CmsPage[];
}

export async function fetchCmsPage(id: string): Promise<CmsPage> {
  const { data, error } = await supabase.from("cms_pages" as any).select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as CmsPage;
}

export async function fetchCmsPageBySlug(slug: string): Promise<CmsPage | null> {
  const { data, error } = await supabase.from("cms_pages" as any).select("*").eq("slug", slug).eq("status", "published").single();
  if (error && error.code !== "PGRST116") throw error;
  return (data as unknown as CmsPage) || null;
}

export async function saveCmsPage(page: Partial<CmsPage> & { id?: string }): Promise<CmsPage> {
  const payload = { ...page, updated_at: new Date().toISOString() };
  
  if (page.id) {
    const { data, error } = await supabase.from("cms_pages" as any).update(payload).eq("id", page.id).select().single();
    if (error) throw error;
    return data as unknown as CmsPage;
  } else {
    const { data, error } = await supabase.from("cms_pages" as any).insert(payload).select().single();
    if (error) throw error;
    return data as unknown as CmsPage;
  }
}

export async function updatePageStatus(id: string, status: PageStatus): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "published") updates.published_at = new Date().toISOString();
  const { error } = await supabase.from("cms_pages" as any).update(updates).eq("id", id);
  if (error) throw error;
}

export async function duplicateCmsPage(id: string): Promise<CmsPage> {
  const original = await fetchCmsPage(id);
  const { id: _id, created_at, updated_at, published_at, ...rest } = original;
  return saveCmsPage({
    ...rest,
    slug: `${rest.slug}-copia`,
    title: `${rest.title} (Cópia)`,
    status: "draft",
  });
}

export async function deleteCmsPage(id: string): Promise<void> {
  const { error } = await supabase.from("cms_pages" as any).delete().eq("id", id);
  if (error) throw error;
}

// ─── Pricing Rules ───

export async function fetchPricingRules(): Promise<CmsPricingRule[]> {
  const { data, error } = await supabase.from("cms_pricing_rules" as any).select("*").eq("active", true).order("resource_type");
  if (error) throw error;
  return (data || []) as unknown as CmsPricingRule[];
}

export async function savePricingRule(rule: Partial<CmsPricingRule> & { id: string }): Promise<void> {
  const { error } = await supabase.from("cms_pricing_rules" as any).update({ ...rule, updated_at: new Date().toISOString() }).eq("id", rule.id);
  if (error) throw error;
}

// ─── Redirects ───

export async function fetchRedirects(): Promise<CmsRedirect[]> {
  const { data, error } = await supabase.from("cms_redirects" as any).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as CmsRedirect[];
}

export async function createRedirect(from: string, to: string): Promise<void> {
  const { error } = await supabase.from("cms_redirects" as any).insert({ from_slug: from, to_slug: to });
  if (error) throw error;
}
