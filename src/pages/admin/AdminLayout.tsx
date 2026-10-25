import { NavLink, Outlet } from 'react-router-dom';
import { Seo } from '../../components/Seo';

const tabs = [['/admin', 'Dashboard'], ['/admin/upload', 'Upload'], ['/admin/wallpapers', 'Wallpapers'], ['/admin/catalog', 'Categories & collections'], ['/admin/coupons', 'Coupons'], ['/admin/orders', 'Orders']] as const;

export default function AdminLayout() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-6">
      <Seo title="Admin" />
      <h1 className="text-3xl font-extrabold">Admin</h1>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Admin sections">
        {tabs.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => `chip whitespace-nowrap ${isActive ? 'chip-on' : ''}`}>{label}</NavLink>
        ))}
      </nav>
      <div className="mt-6"><Outlet /></div>
    </main>
  );
}
