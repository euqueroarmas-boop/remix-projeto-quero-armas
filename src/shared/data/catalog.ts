/**
 * Camada de leitura do catálogo público.
 *
 * FONTE ÚNICA DA VERDADE: `qa_servicos_catalogo`.
 * Tudo que é cadastrado/editado em /quero-armas/precos-servicos
 * reflete IMEDIATAMENTE em /servicos (site público) e demais consumidores.
 *
 * Este módulo mantém o shape legado `ServiceWithCategory` para preservar
 * compatibilidade com componentes antigos (ServicesListPage etc.).
 */

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

/** Mapeia categoria textual de qa_servicos_catalogo -> slug usado pelo agrupador do site. */
function categoriaToSlug(categoria: string): string {
  const c = categoria.toLowerCase();
  if (c.includes('polícia') || c.includes('policia') || c.includes('sinarm') || c.includes('pf')) return 'sinarm-pf';
  if (c.includes('exército') || c.includes('exercito') || c.includes('sigma') || c.includes('eb')) return 'sigma-eb';
  if (c.includes('curso') || c.includes('treinamento')) return 'treinamento';
  if (c.includes('equipamento') || c.includes('colete')) return 'equipamento';
  if (c.includes('consultoria')) return 'consultoria';
  return c.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'outros';
}

interface QACatalogRow {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  tipo: string;
  descricao_curta: string | null;
  descricao_full: string | null;
  preco: string | number | null;
  ativo: boolean;
  display_order: number;
}

function rowToService(r: QACatalogRow): ServiceWithCategory {
  const precoNum = r.preco != null ? Number(r.preco) : 0;
  const catSlug = categoriaToSlug(r.categoria);
  return {
    id: r.id,
    category_id: catSlug,
    slug: r.slug,
    name: r.nome,
    short_description: r.descricao_curta,
    long_description: r.descricao_full,
    base_price_cents: Math.round(precoNum * 100),
    is_active: r.ativo,
    display_order: r.display_order ?? 100,
    category: { id: catSlug, slug: catSlug, name: r.categoria },
  };
}

export const listActiveServices = async (): Promise<ServiceWithCategory[]> => {
  const { data, error } = await supabase
    .from('qa_servicos_catalogo' as any)
    .select('id, slug, nome, categoria, tipo, descricao_curta, descricao_full, preco, ativo, display_order')
    .eq('ativo', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as QACatalogRow[]).map(rowToService);
};

export const listActiveCategories = async (): Promise<ServiceCategory[]> => {
  const services = await listActiveServices();
  const seen = new Map<string, ServiceCategory>();
  services.forEach((s, idx) => {
    if (s.category && !seen.has(s.category.slug)) {
      seen.set(s.category.slug, {
        id: s.category.id,
        slug: s.category.slug,
        name: s.category.name,
        description: null,
        display_order: idx,
        is_active: true,
      });
    }
  });
  return Array.from(seen.values());
};

export const getServiceBySlug = async (
  slug: string,
): Promise<{ service: ServiceWithCategory; landing: ServiceLandingData | null } | null> => {
  const { data, error } = await supabase
    .from('qa_servicos_catalogo' as any)
    .select('id, slug, nome, categoria, tipo, descricao_curta, descricao_full, preco, ativo, display_order')
    .eq('slug', slug)
    .eq('ativo', true)
    .maybeSingle();
  if (error || !data) return null;
  return { service: rowToService(data as unknown as QACatalogRow), landing: null };
};

export const validateCartAgainstCatalog = async (
  serviceIds: string[],
): Promise<Map<string, ServiceWithCategory>> => {
  if (serviceIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('qa_servicos_catalogo' as any)
    .select('id, slug, nome, categoria, tipo, descricao_curta, descricao_full, preco, ativo, display_order')
    .in('id', serviceIds)
    .eq('ativo', true);
  if (error) throw error;
  const map = new Map<string, ServiceWithCategory>();
  for (const r of (data ?? []) as unknown as QACatalogRow[]) {
    const s = rowToService(r);
    map.set(s.id, s);
  }
  return map;
};