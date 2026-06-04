/** Camada de leitura do catálogo (lp_services, lp_service_categories, lp_service_landing_pages). */

import { supabase } from '@/integrations/supabase/client';
import type { Service, ServiceCategory } from '@/shared/types/domain';

export interface ServiceWithCategory extends Service {
  category: Pick<ServiceCategory, 'id' | 'slug' | 'name'> | null;
}

export interface ServiceLandingData {
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  blocks: unknown;
  seo_title: string | null;
  seo_description: string | null;
}

export const listActiveServices = async (): Promise<ServiceWithCategory[]> => {
  const { data, error } = await supabase
    .from('lp_services' as any)
    .select('*, category:lp_service_categories(id, slug, name)')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ServiceWithCategory[];
};

export const listActiveCategories = async (): Promise<ServiceCategory[]> => {
  const { data, error } = await supabase
    .from('lp_service_categories' as any)
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ServiceCategory[];
};

export const getServiceBySlug = async (
  slug: string,
): Promise<{ service: ServiceWithCategory; landing: ServiceLandingData | null } | null> => {
  const { data: service, error } = await supabase
    .from('lp_services' as any)
    .select('*, category:lp_service_categories(id, slug, name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !service) return null;

  const { data: landing } = await supabase
    .from('lp_service_landing_pages' as any)
    .select('hero_title, hero_subtitle, hero_image_url, blocks, seo_title, seo_description')
    .eq('service_id', (service as any).id)
    .eq('is_published', true)
    .maybeSingle();

  return {
    service: service as unknown as ServiceWithCategory,
    landing: (landing as unknown as ServiceLandingData | null) ?? null,
  };
};

export const validateCartAgainstCatalog = async (
  serviceIds: string[],
): Promise<Map<string, ServiceWithCategory>> => {
  if (serviceIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('lp_services' as any)
    .select('*, category:lp_service_categories(id, slug, name)')
    .in('id', serviceIds)
    .eq('is_active', true);
  if (error) throw error;
  const map = new Map<string, ServiceWithCategory>();
  for (const s of (data ?? []) as unknown as ServiceWithCategory[]) map.set(s.id, s);
  return map;
};