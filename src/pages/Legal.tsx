import { Link, useParams } from 'react-router-dom';
import { CONTACT_EMAIL, SITE_NAME } from '../lib/supabase';
import { Seo } from '../components/Seo';

// TEMPLATE TEXT — not legal advice. Payment providers (e.g. Razorpay) require published Terms, Privacy and
// Refund pages before activating live payments. Have these reviewed and adapted to your business.
export default function Legal() {
  const { doc = 'terms' } = useParams();
  const pages: Record<string, { title: string; body: string[] }> = {
    terms: { title: 'Terms of use', body: [
      `${SITE_NAME} sells and distributes digital wallpapers. By using the site you agree to these terms.`,
      'Wallpapers are licensed for personal, non-commercial use on your own devices. You may not resell, redistribute or upload them elsewhere.',
      'Premium wallpapers are delivered as a digital download immediately after payment is confirmed.',
      `Questions? Email ${CONTACT_EMAIL}.`] },
    privacy: { title: 'Privacy policy', body: [
      'We sign you in with Google and store your name, email address and profile picture to run your account, favorites, purchases and download history.',
      'We measure visits with an anonymous random identifier stored in your browser. We do not store your IP address or use advertising cookies. If your browser sends Do Not Track, we do not measure your visit.',
      'Payments are processed by our payment provider. We never see or store your card or UPI details.',
      `To request deletion of your account data, email ${CONTACT_EMAIL}.`] },
    refunds: { title: 'Refund policy', body: [
      'Because wallpapers are digital goods delivered instantly, purchases are generally non-refundable once downloaded.',
      'If you were charged but could not access your purchase, or were charged twice, contact us and we will fix it or refund you.',
      `Contact: ${CONTACT_EMAIL}.`] },
  };
  const p = pages[doc] ?? pages.terms;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Seo title={p.title} path={`/legal/${doc}`} />
      <h1 className="text-3xl font-extrabold">{p.title}</h1>
      <div className="mt-5 space-y-4 leading-7 text-muted">{p.body.map((t, i) => <p key={i}>{t}</p>)}</div>
      <p className="mt-8 rounded-xl border border-line p-3 text-xs text-muted">Template text — the site owner must review and adapt it before launch. <Link className="text-accent" to="/">Home</Link></p>
    </main>
  );
}
