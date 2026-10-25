import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LibraryProvider } from './context/LibraryContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Footer } from './components/Footer';
import { RequireAdmin, RequireAuth } from './components/Guards';
import { Navbar } from './components/Navbar';
import { Spinner } from './components/States';
import { trackPage } from './lib/analytics';
import Home from './pages/Home';
import Explore from './pages/Explore';
import WallpaperDetail from './pages/WallpaperDetail';
import CollectionPage from './pages/Collection';
import Login from './pages/Login';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';

// Lazy-load everything that is not on the first-visit path to keep the initial bundle small on mobile.
const Favorites = lazy(() => import('./pages/Favorites'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Upload = lazy(() => import('./pages/admin/Upload'));
const Wallpapers = lazy(() => import('./pages/admin/Wallpapers'));
const Catalog = lazy(() => import('./pages/admin/Catalog'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const Orders = lazy(() => import('./pages/admin/Orders'));

function PageViews() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); trackPage(pathname); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <LibraryProvider>
            <PageViews />
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
            <Navbar />
            <div id="main" className="min-h-[70vh]">
              <Suspense fallback={<Spinner />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/w/:slug" element={<WallpaperDetail />} />
                  <Route path="/collections/:slug" element={<CollectionPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/legal/:doc" element={<Legal />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>
                  <Route element={<RequireAdmin />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<Dashboard />} />
                      <Route path="upload" element={<Upload />} />
                      <Route path="wallpapers" element={<Wallpapers />} />
                      <Route path="catalog" element={<Catalog />} />
                      <Route path="coupons" element={<Coupons />} />
                      <Route path="orders" element={<Orders />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
            <Footer />
          </LibraryProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
