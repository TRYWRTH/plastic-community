-- Columns backing the link-unfurl fallback for event card images: when an
-- organiser hasn't uploaded a photo but did enter a link, a Supabase Edge
-- Function fetches that link's og:image, re-hosts it in our own storage,
-- and writes the result here. Never stores the source CDN URL directly —
-- those (e.g. Instagram's) are signed and expire.
alter table public.events
  add column if not exists link_preview_image_url text,
  add column if not exists link_preview_title text,
  add column if not exists link_preview_description text,
  add column if not exists link_preview_site_name text,
  add column if not exists link_preview_fetched_at timestamptz,
  add column if not exists link_preview_status text;
