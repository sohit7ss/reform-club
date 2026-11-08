-- RE:FORM — Supabase Storage: two public buckets
-- Run in Supabase Dashboard > SQL Editor. Free tier: 1 GB storage, bandwidth cap, project pauses after inactivity.
--
-- Buckets:
--   * 'reform-media' (admin content): gallery/, events/, team/, blog/, recognition/, legacy/
--     images plus docs/ PDFs. 10 MB bucket limit, image + PDF mime types.
--   * 'reform-submissions' (public uploads): submissions/ (member artwork) and w2b/
--     (Waste to Best entries) only. 5 MB bucket limit, image mime types only.
--
-- Size split is enforced in layers:
--   * 'reform-submissions' has a 5 MB bucket file_size_limit, so no public upload can
--     exceed 5 MB; the client enforces the same 5 MB limit (validateFile.js
--     MAX_IMAGE_MB) before upload, with compression to WebP.
--   * 'reform-media' has a 10 MB bucket file_size_limit so docs/ PDFs up to 10 MB fit.
--     docs/ uploads are admin-only; admin images stay at 5 MB by client validation.
--   * The anon insert policy on 'reform-submissions' additionally checks the uploaded
--     object's metadata size (<= 5242880) as a server-side backstop; the size value is
--     absent before the storage server records it, so a missing size value does not
--     block the upload and the bucket limit remains the hard cap.
--   * All other writes are admin-only (reform_admin JWT claim, set via
--     scripts/set-admin-claims.js after enabling Firebase third-party auth).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reform-media','reform-media', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reform-submissions','reform-submissions', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];
-- Public read, both buckets
create policy "public read reform-media" on storage.objects for select using (bucket_id = 'reform-media');
create policy "public read reform-submissions" on storage.objects for select using (bucket_id = 'reform-submissions');
-- Public (anon) insert ONLY on submissions/ and w2b/ in the submissions bucket — client
-- uses random UUID names, WebP only, and images are limited to 5 MB here via the stored
-- object metadata size (see note above; the 5 MB bucket limit is the hard cap).
create policy "anon insert submissions w2b" on storage.objects for insert to anon with check (
  bucket_id = 'reform-submissions' and (storage.foldername(name) @> ARRAY['submissions'] or storage.foldername(name) @> ARRAY['w2b'])
  and (name ~ '\.(webp|jpg|jpeg|png)$')
  and ((metadata ->> 'size') is null or (metadata ->> 'size')::bigint <= 5242880)
);
-- Admin insert/update/delete in reform-media: requires JWT claim reform_admin = true.
-- Admin uploads are capped by the 10 MB bucket limit; docs/ PDFs may use the full
-- 10 MB, images stay at 5 MB by client validation.
create policy "admin insert reform-media" on storage.objects for insert to authenticated with check (bucket_id = 'reform-media' and (auth.jwt() ->> 'reform_admin') = 'true');
create policy "admin update reform-media" on storage.objects for update to authenticated using (bucket_id = 'reform-media' and (auth.jwt() ->> 'reform_admin') = 'true') with check (bucket_id = 'reform-media' and (auth.jwt() ->> 'reform_admin') = 'true');
create policy "admin delete reform-media" on storage.objects for delete to authenticated using (bucket_id = 'reform-media' and (auth.jwt() ->> 'reform_admin') = 'true');
-- Admin insert/update/delete in reform-submissions: requires JWT claim reform_admin = true.
-- This is how the coordinator deletes orphaned public submissions; anon users can
-- never update or delete, and can only insert under submissions/ or w2b/.
create policy "admin insert reform-submissions" on storage.objects for insert to authenticated with check (bucket_id = 'reform-submissions' and (auth.jwt() ->> 'reform_admin') = 'true');
create policy "admin update reform-submissions" on storage.objects for update to authenticated using (bucket_id = 'reform-submissions' and (auth.jwt() ->> 'reform_admin') = 'true') with check (bucket_id = 'reform-submissions' and (auth.jwt() ->> 'reform_admin') = 'true');
create policy "admin delete reform-submissions" on storage.objects for delete to authenticated using (bucket_id = 'reform-submissions' and (auth.jwt() ->> 'reform_admin') = 'true');
