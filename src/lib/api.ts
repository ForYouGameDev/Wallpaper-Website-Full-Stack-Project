import { supabase, invoke } from './supabase';
import { visitorId } from './analytics';
import type { Category, Collection, Coupon, OrderResult, Quote, Wallpaper } from './types';

export const WP_COLS =
  'id,slug,title,description,category_id,tags,width,height,aspect_ratio,is_premium,price_minor,currency,status,featured,free_requires_login,thumb_path,preview_path,watermark_path,view_count,download_count,is_sample,created_at,categories(slug,name)';

export const PAGE_SIZE = 24;
export type Sort = 'new' | 'popular' | 'price_asc' | 'price_desc';
export type Access = 'all' | 'free' | 'premium';

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  return data as Category[];
}

export type ListArgs = { q?: string; category?: string; access?: Access; sort?: Sort; page?: number; featured?: boolean; limit?: number };

export async function listWallpapers(a: ListArgs = {}): Promise<{ rows: Wallpaper[]; hasMore: boolean }> {
  const size = a.limit ?? PAGE_SIZE;
  const page = a.page ?? 0;
  let q = supabase.from('wallpapers').select(WP_COLS, { count: 'exact' }).eq('status', 'published');
  if (a.category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', a.category).maybeSingle();
    if (!cat) return { rows: [], hasMore: false };
    q = q.eq('category_id', cat.id);
  }
  if (a.access === 'free') q = q.eq('is_premium', false);
  if (a.access === 'premium') q = q.eq('is_premium', true);
  if (a.featured) q = q.eq('featured', true);
  const term = (a.q ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
  if (term) q = q.or(`title.ilike.%${term}%,tags.cs.{${term.toLowerCase().replace(/\s+/g, '-')}}`);
  switch (a.sort ?? 'new') {
    case 'popular': q = q.order('download_count', { ascending: false }).order('view_count', { ascending: false }); break;
    case 'price_asc': q = q.order('price_minor', { ascending: true }); break;
    case 'price_desc': q = q.order('price_minor', { ascending: false }); break;
    default: q = q.order('created_at', { ascending: false });
  }
  const from = page * size;
  const { data, error } = await q.range(from, from + size - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Wallpaper[];
  return { rows, hasMore: rows.length === size };
}

export async function getWallpaperBySlug(slug: string): Promise<Wallpaper | null> {
  const { data, error } = await supabase.from('wallpapers').select(WP_COLS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as unknown as Wallpaper | null;
}

export async function listCollections(onlyFeatured = false): Promise<Collection[]> {
  let q = supabase.from('collections').select(`id,slug,title,description,is_published,is_featured,sort_order,collection_items(position,wallpapers(${WP_COLS}))`).eq('is_published', true).order('sort_order');
  if (onlyFeatured) q = q.eq('is_featured', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    items: (c.collection_items ?? [])
      .sort((x: any, y: any) => x.position - y.position)
      .map((i: any) => i.wallpapers)
      .filter((w: Wallpaper | null) => w && w.status === 'published'),
  }));
}

export async function getCollection(slug: string): Promise<Collection | null> {
  return (await listCollections()).find((c) => c.slug === slug) ?? null;
}

// ---- library (favorites / purchases) ----
export async function fetchFavoriteIds(): Promise<string[]> {
  const { data, error } = await supabase.from('favorites').select('wallpaper_id');
  if (error) throw error;
  return (data ?? []).map((r) => r.wallpaper_id as string);
}
export async function addFavorite(userId: string, wallpaperId: string) {
  const { error } = await supabase.from('favorites').insert({ user_id: userId, wallpaper_id: wallpaperId });
  if (error && error.code !== '23505') throw error;
}
export async function removeFavorite(userId: string, wallpaperId: string) {
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('wallpaper_id', wallpaperId);
  if (error) throw error;
}
export async function listFavorites(): Promise<Wallpaper[]> {
  const { data, error } = await supabase.from('favorites').select(`created_at,wallpapers(${WP_COLS})`).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => r.wallpapers).filter(Boolean);
}
export async function fetchPurchasedIds(): Promise<string[]> {
  const { data, error } = await supabase.from('purchases').select('wallpaper_id');
  if (error) throw error;
  return (data ?? []).map((r) => r.wallpaper_id as string);
}
export async function listPurchases(): Promise<Wallpaper[]> {
  const { data, error } = await supabase.from('purchases').select(`created_at,wallpapers(${WP_COLS})`).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => r.wallpapers).filter(Boolean);
}
export async function listDownloadHistory() {
  const { data, error } = await supabase.from('downloads').select('id,kind,created_at,wallpapers(title,slug)').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as { id: number; kind: string; created_at: string; wallpapers: { title: string; slug: string } | null }[];
}
export async function listMyOrders() {
  const { data, error } = await supabase.from('orders').select('id,amount_minor,currency,status,created_at,order_items(wallpapers(title))').order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []) as unknown as { id: number; amount_minor: number; currency: string; status: string; created_at: string; order_items: { wallpapers: { title: string } | null }[] }[];
}
export async function listPublicOffers(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*');
  if (error) throw error;
  return data as Coupon[];
}

// ---- server-verified operations ----
export const requestDownload = (wallpaperId: string) =>
  invoke<{ url: string }>('get-download-url', { wallpaper_id: wallpaperId, visitor_id: visitorId() });
export const getQuote = (ids: string[], code?: string) => invoke<Quote>('validate-coupon', { wallpaper_ids: ids, coupon_code: code || null });
export const createOrder = (ids: string[], code?: string) => invoke<OrderResult>('create-order', { wallpaper_ids: ids, coupon_code: code || null });
export const verifyPayment = (p: { order_id: string; payment_id: string; signature: string }) => invoke<{ status: string }>('verify-payment', p);
