-- Storage bucket for user-uploaded event images/icons. Public read (images
-- are shown to everyone on Home/event detail), authenticated write scoped
-- to the uploader's own folder (path: "<user_id>/<file>"), so a user can
-- only create/replace/remove their own uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Event images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "Authenticated users can upload their own event images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own event images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own event images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
