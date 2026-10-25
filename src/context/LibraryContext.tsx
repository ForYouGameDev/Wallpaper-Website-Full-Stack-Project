import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { addFavorite, fetchFavoriteIds, fetchPurchasedIds, removeFavorite } from '../lib/api';

type Ctx = {
  favorites: Set<string>;
  purchased: Set<string>;
  toggleFavorite: (wallpaperId: string) => Promise<boolean>;   // returns false if sign-in is needed
  refresh: () => Promise<void>;
};
const LibCtx = createContext<Ctx>(null as unknown as Ctx);
export const useLibrary = () => useContext(LibCtx);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [favorites, setFav] = useState<Set<string>>(new Set());
  const [purchased, setPur] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) { setFav(new Set()); setPur(new Set()); return; }
    try {
      const [f, p] = await Promise.all([fetchFavoriteIds(), fetchPurchasedIds()]);
      setFav(new Set(f)); setPur(new Set(p));
    } catch { /* non-fatal */ }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!user) return false;
    const had = favorites.has(id);
    setFav((s) => { const n = new Set(s); if (had) n.delete(id); else n.add(id); return n; });   // optimistic
    try {
      if (had) await removeFavorite(user.id, id); else await addFavorite(user.id, id);
    } catch {
      setFav((s) => { const n = new Set(s); if (had) n.add(id); else n.delete(id); return n; });
      toast('Could not update favorites. Please try again.', 'error');
    }
    return true;
  }, [user, favorites, toast]);

  return <LibCtx.Provider value={{ favorites, purchased, toggleFavorite, refresh }}>{children}</LibCtx.Provider>;
}
