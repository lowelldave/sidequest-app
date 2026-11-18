-- The data belongs to the shop, not the person who recorded it: removing
-- someone's account must keep their toys, transactions and expenses.
alter table public.toys drop constraint toys_user_id_fkey,
  add constraint toys_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.transactions drop constraint transactions_user_id_fkey,
  add constraint transactions_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.expenses drop constraint expenses_user_id_fkey,
  add constraint expenses_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
