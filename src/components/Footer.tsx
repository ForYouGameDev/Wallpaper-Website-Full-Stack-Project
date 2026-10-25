import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, SITE_NAME } from '../lib/supabase';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {SITE_NAME}. Wallpapers are licensed for personal use.</p>
        <nav className="flex flex-wrap gap-4" aria-label="Footer">
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/refunds">Refunds</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
