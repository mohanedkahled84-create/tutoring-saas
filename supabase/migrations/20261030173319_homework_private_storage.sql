-- Deploy the backend signing support before migrating existing submission files.
-- Public teaching materials/question images continue using the legacy bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homework-private', 'homework-private', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','image/bmp','image/jpg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- All uploads/deletes are authorized by the backend using its service client.
-- A public bucket still serves existing public assets without a SELECT policy.
drop policy if exists "Public homework read policy" on storage.objects;
drop policy if exists "Public homework upload policy" on storage.objects;
drop policy if exists "Public homework update policy" on storage.objects;
drop policy if exists "Public homework delete policy" on storage.objects;

-- No anon/authenticated object policies for homework-private: server access only.
