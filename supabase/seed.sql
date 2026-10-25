-- seed.sql — categories + SAMPLE demo data. Everything marked is_sample / "[SAMPLE]" can be deleted from /admin.
insert into public.categories (slug, name, sort_order) values
  ('anime','Anime',1),('nature','Nature',2),('cars','Cars',3),('gaming','Gaming',4),
  ('amoled','AMOLED',5),('abstract','Abstract',6),('minimal','Minimal',7),('space','Space',8),
  ('animals','Animals',9),('architecture','Architecture',10),('cityscape','Cityscape',11),('sports','Sports',12)
on conflict (slug) do nothing;

-- SAMPLE wallpapers have no image files (the UI shows generated gradients) and cannot be downloaded.
insert into public.wallpapers (slug, title, description, category_id, tags, width, height, aspect_ratio, is_premium, price_minor, status, featured, is_sample, published_at)
select 'sample-' || s.slug, '[SAMPLE] ' || s.title, 'Sample content for layout testing. Delete from /admin.',
       (select id from public.categories where slug = s.cat), s.tags, 1080, 2400, '9:20', s.premium, s.price, 'published', s.featured, true, now()
from (values
  ('aurora-ridge','Aurora Ridge','nature',array['aurora','mountain'],false,0,true),
  ('neon-garage','Neon Garage','cars',array['neon','supercar'],true,14900,true),
  ('void-black','Void Black','amoled',array['black','battery'],false,0,false),
  ('orbit-bloom','Orbit Bloom','space',array['planet','galaxy'],true,9900,false),
  ('paper-hills','Paper Hills','minimal',array['flat','pastel'],false,0,false),
  ('fox-in-fog','Fox in Fog','animals',array['fox','forest'],true,12900,true)
) as s(slug, title, cat, tags, premium, price, featured)
on conflict (slug) do nothing;

insert into public.coupons (code, discount_type, value, min_order_minor, max_uses, per_user_limit, is_public, is_sample)
values ('WELCOME10', 'percent', 10, 0, 1000, 1, true, true) on conflict (code) do nothing;

insert into public.collections (slug, title, description, is_published, is_featured, sort_order)
values ('staff-picks-sample', '[SAMPLE] Staff picks', 'A sample collection.', true, true, 1) on conflict (slug) do nothing;
insert into public.collection_items (collection_id, wallpaper_id, position)
select c.id, w.id, row_number() over () from public.collections c join public.wallpapers w on w.is_sample
where c.slug = 'staff-picks-sample' on conflict do nothing;
