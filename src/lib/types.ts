export type Category = { id: string; slug: string; name: string; sort_order: number };

export type Wallpaper = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category_id: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  aspect_ratio: string | null;
  is_premium: boolean;
  price_minor: number;
  currency: string;
  status: 'draft' | 'published';
  featured: boolean;
  free_requires_login: boolean;
  thumb_path: string | null;
  preview_path: string | null;
  watermark_path: string | null;
  view_count: number;
  download_count: number;
  is_sample: boolean;
  created_at: string;
  categories?: { slug: string; name: string } | null;
};

export type Collection = {
  id: string; slug: string; title: string; description: string | null;
  is_published: boolean; is_featured: boolean; sort_order: number;
  items?: Wallpaper[];
};

export type Profile = { id: string; email: string | null; full_name: string | null; avatar_url: string | null; role: 'user' | 'admin'; created_at: string };

export type Coupon = {
  id: string; code: string; discount_type: 'percent' | 'fixed'; value: number; min_order_minor: number;
  max_uses: number | null; used_count: number; per_user_limit: number; expires_at: string | null;
  is_active: boolean; is_public: boolean; is_sample: boolean; created_at: string;
};

export type Quote = {
  currency: string;
  items: { id: string; title: string; price_minor: number }[];
  subtotal_minor: number; discount_minor: number; total_minor: number;
  coupon: { id: string; code: string } | null;
  coupon_error: string | null;
};

export type OrderResult =
  | { order_id: string; status: 'paid'; provider: 'free' }
  | { order_id: string; status: 'created'; provider: string; provider_order_id: string; public_key: string | null; amount_minor: number; currency: string };

export type OrderRow = {
  id: string; user_id: string; subtotal_minor: number; discount_minor: number; amount_minor: number; currency: string;
  provider: string; provider_order_id: string | null; provider_payment_id: string | null;
  status: 'created' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  created_at: string; paid_at: string | null;
  profiles?: { email: string | null } | null;
  order_items?: { wallpaper_id: string; price_minor: number; wallpapers: { title: string } | null }[];
};

export type AdminStats = {
  page_views: number; wallpaper_views: number; unique_visitors: number; registered_users: number;
  free_downloads: number; premium_downloads: number; download_attempts: number;
  orders_paid: number; orders_total: number; revenue_minor: number; refunded_minor: number;
  top_wallpapers: { id: string; title: string; is_premium: boolean; downloads: number; view_count: number }[];
  top_categories: { name: string; downloads: number }[];
  daily: { day: string; views: number; revenue_minor: number }[];
};
