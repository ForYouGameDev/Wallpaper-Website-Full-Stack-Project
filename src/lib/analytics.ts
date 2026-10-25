import { supabase } from './supabase';

// Privacy-conscious: random per-browser id, no cookies, no IP stored, respects Do Not Track.
export function visitorId(): string {
  try {
    let id = localStorage.getItem('vid');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('vid', id); }
    return id;
  } catch { return 'anon-' + Math.random().toString(36).slice(2, 12); }
}

const dnt = () => navigator.doNotTrack === '1';

export function trackPage(path: string) {
  if (dnt() || path.startsWith('/admin')) return;
  void supabase.rpc('track_event', { p_type: 'page_view', p_path: path, p_wallpaper_id: null, p_visitor_id: visitorId() });
}

export function trackWallpaperView(id: string) {
  if (dnt()) return;
  void supabase.rpc('track_event', { p_type: 'wallpaper_view', p_path: null, p_wallpaper_id: id, p_visitor_id: visitorId() });
}
