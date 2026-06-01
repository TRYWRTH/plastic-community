create or replace function public.get_event_save_counts()
returns table (
  event_id uuid,
  going_count bigint,
  interested_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event_id,
    count(*) filter (where status = 'going')::bigint as going_count,
    count(*) filter (where status = 'interested')::bigint as interested_count
  from public.event_saves
  group by event_id;
$$;

grant execute on function public.get_event_save_counts() to anon, authenticated;