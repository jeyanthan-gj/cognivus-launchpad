
-- Fix search_path on trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tighten contact insert policy with length limits
drop policy "Anyone can submit a message" on public.contact_messages;
create policy "Anyone can submit a message" on public.contact_messages
  for insert
  with check (
    char_length(name) between 1 and 200
    and char_length(email) between 3 and 320
    and char_length(message) between 1 and 5000
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- Lock down SECURITY DEFINER functions: only the postgres role / triggers / policies use them
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
