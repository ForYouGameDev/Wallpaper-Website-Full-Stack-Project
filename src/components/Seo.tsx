import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from '../lib/supabase';

// Client-side metadata. Search engines that run JavaScript (Google, Bing) will see it;
// social-card scrapers usually will not on a static host — see docs/ARCHITECTURE.md (SEO).
function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

export function Seo({ title, description, image, path }: { title?: string; description?: string; image?: string | null; path?: string }) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — wallpapers for every screen`;
    document.title = full;
    const desc = description ?? 'Free and premium phone and desktop wallpapers: anime, nature, cars, gaming, AMOLED, space and more.';
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', 'website');
    if (image) setMeta('property', 'og:image', image);
    if (SITE_URL && path) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
      link.href = SITE_URL + path;
    }
  }, [title, description, image, path]);
  return null;
}
