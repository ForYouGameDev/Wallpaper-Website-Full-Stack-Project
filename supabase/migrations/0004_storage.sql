-- 0004_storage.sql — buckets and Storage policies
--  previews : PUBLIC  — thumbnails, ~500px previews, watermarked previews. Never full-resolution originals.
--  originals: PRIVATE — every original (free and premium). No SELECT policy exists, so the only way to read an
--             original is a short-lived signed URL created by the get-download-url Edge Function (service role).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('previews',  'previews',  true,  5242880,  array['image/webp','image/jpeg','image/png']),
  ('originals', 'originals', false, 52428800, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "previews are public" on storage.objects for select using (bucket_id = 'previews');
create policy "previews admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'previews' and public.is_admin());
create policy "previews admin update" on storage.objects for update to authenticated
  using (bucket_id = 'previews' and public.is_admin()) with check (bucket_id = 'previews' and public.is_admin());
create policy "previews admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'previews' and public.is_admin());

-- originals: admin may upload and delete; NOBODY (except service role) may read.
create policy "originals admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'originals' and public.is_admin());
create policy "originals admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'originals' and public.is_admin());
