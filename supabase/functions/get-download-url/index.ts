import { adminClient, getUser, handler, HttpError, json } from '../_shared/http.ts';

// Issues a 60-second signed URL for the PRIVATE original — only if the caller is eligible. Every success is logged.
Deno.serve(handler(async (req, cors) => {
  const { wallpaper_id, visitor_id } = await req.json();
  if (typeof wallpaper_id !== 'string') throw new HttpError(400, 'Missing wallpaper id.');

  const db = adminClient();
  const user = await getUser(req);

  await db.from('analytics_events').insert({
    event_type: 'download_attempt',
    wallpaper_id,
    user_id: user?.id ?? null,
    visitor_id: typeof visitor_id === 'string' ? visitor_id.slice(0, 64) : null,
  });

  const { data: w } = await db.from('wallpapers').select('id,slug,title,is_premium,status,free_requires_login').eq('id', wallpaper_id).maybeSingle();
  if (!w) throw new HttpError(404, 'Wallpaper not found.');

  let isAdmin = false;
  if (user) {
    const { data: p } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    isAdmin = p?.role === 'admin';
  }
  if (w.status !== 'published' && !isAdmin) throw new HttpError(404, 'Wallpaper not found.');

  if (w.is_premium) {
    if (!user) throw new HttpError(401, 'Sign in to download.');
    if (!isAdmin) {
      const { data: owned } = await db.from('purchases').select('wallpaper_id').eq('user_id', user.id).eq('wallpaper_id', w.id).maybeSingle();
      if (!owned) throw new HttpError(403, 'Buy this wallpaper to download the original.');
    }
  } else if (w.free_requires_login && !user) {
    throw new HttpError(401, 'Sign in to download free wallpapers.');
  }

  const { data: file } = await db.from('wallpaper_files').select('original_path').eq('wallpaper_id', w.id).maybeSingle();
  if (!file) throw new HttpError(404, 'The original file is not available.');

  const ext = file.original_path.split('.').pop() ?? 'jpg';
  const { data: signed, error } = await db.storage.from('originals').createSignedUrl(file.original_path, 60, { download: `${w.slug}.${ext}` });
  if (error || !signed) throw new HttpError(502, 'Could not prepare your download. Please try again.');

  // Admin test downloads are not counted as customer downloads.
  if (!isAdmin) {
    await db.from('downloads').insert({ user_id: user?.id ?? null, wallpaper_id: w.id, kind: w.is_premium ? 'premium' : 'free' });
  }
  return json({ url: signed.signedUrl, expires_in: 60 }, 200, cors);
}));
