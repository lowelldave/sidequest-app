-- SideQuest: switch from open access to per-user access.
--
-- DO NOT APPLY YET. Run this only when sign-in has been added to the app
-- (Supabase Auth, e.g. email + password or magic link), because afterwards
-- the publishable key alone can no longer read or change anything: every
-- request must come from a signed-in user, and each user sees only their
-- own toys, transactions, expenses and pictures.
--
-- Apply it as a new migration (copy it into supabase/migrations/ with a later
-- timestamp) so the history stays in order.

-- ---------------------------------------------------------------------------
-- 1. Hand the existing rows to an owner.
--    Rows created before sign-in have no owner (user_id is null) and would be
--    invisible to everyone after this. Replace the id below with the user id of
--    the account that should keep them (Supabase dashboard > Authentication >
--    Users), then uncomment.
-- ---------------------------------------------------------------------------

-- update public.toys         set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.transactions set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.expenses     set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;

-- Every row must now have an owner.
alter table public.toys alter column user_id set not null;
alter table public.transactions alter column user_id set not null;
alter table public.expenses alter column user_id set not null;

-- ---------------------------------------------------------------------------
-- 2. Replace the open policies with per-owner ones.
--    `(select auth.uid())` is evaluated once per query rather than per row.
-- ---------------------------------------------------------------------------

drop policy "Open access until sign-in is added" on public.toys;
drop policy "Open access until sign-in is added" on public.toy_qualities;
drop policy "Open access until sign-in is added" on public.transactions;
drop policy "Open access until sign-in is added" on public.expenses;

create policy "Owners manage their toys" on public.toys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Qualities belong to a toy, so they follow the toy's owner.
create policy "Owners manage their toys' qualities" on public.toy_qualities
  for all to authenticated
  using (exists (select 1 from public.toys t where t.id = toy_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.toys t where t.id = toy_id and t.user_id = (select auth.uid())));

create policy "Owners manage their transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Owners manage their expenses" on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Signed-out visitors get nothing at all.
revoke all on public.toys, public.toy_qualities, public.transactions, public.expenses from anon;
revoke execute on function public.save_toy(jsonb) from anon;
revoke execute on function public.record_transaction(jsonb) from anon;
revoke execute on function public.delete_transaction(uuid) from anon;
revoke execute on function public.record_restock(jsonb) from anon;

-- ---------------------------------------------------------------------------
-- 3. Pictures: each user may only add and remove files in their own folder.
--    The app already uploads to "<user id>/<file>.jpg" once someone is signed in.
--    Reading stays public because the bucket is public and pictures are shown by
--    URL; make the bucket private and switch the app to signed URLs if pictures
--    must be hidden too.
--    Pictures uploaded before sign-in are in the "shared" folder; move them into
--    the owner's folder (and update toys.images) if they should stay editable.
-- ---------------------------------------------------------------------------

drop policy "toy-images: open upload until sign-in is added" on storage.objects;
drop policy "toy-images: open delete until sign-in is added" on storage.objects;

create policy "toy-images: owners upload to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'toy-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "toy-images: owners delete from their folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'toy-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
