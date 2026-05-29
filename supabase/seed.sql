insert into public.classes (id, name_ar, sort_order) values
  ('grade1', 'الصف الأول المتوسط', 1),
  ('grade2', 'الصف الثاني المتوسط', 2),
  ('grade3', 'الصف الثالث المتوسط', 3)
on conflict (id) do update set
  name_ar = excluded.name_ar,
  sort_order = excluded.sort_order;

insert into public.subjects (slug, name_ar) values
  ('math', 'الرياضيات'),
  ('science', 'العلوم الطبيعية'),
  ('arabic', 'اللغة العربية'),
  ('islamic', 'التربية الإسلامية'),
  ('english', 'اللغة الإنجليزية'),
  ('social', 'الدراسات الاجتماعية'),
  ('technology', 'الحاسوب وتقنية المعلومات'),
  ('art', 'التربية الفنية'),
  ('general', 'كتاب مدرسي')
on conflict (slug) do update set name_ar = excluded.name_ar;
