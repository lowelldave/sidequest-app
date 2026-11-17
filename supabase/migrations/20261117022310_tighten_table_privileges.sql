-- Supabase grants every table to the API roles by default. Narrow the new
-- tables to what the app actually does, so column limits take effect.

-- People may only change their name, picture and preferences; role, active
-- and must_change_password change through admin_set_member / password_changed.
revoke insert, update, delete, truncate, references, trigger on public.profiles from anon, authenticated;
revoke select on public.profiles from anon;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path, preferences) on public.profiles to authenticated;

revoke all on public.shop_settings from anon, authenticated;
grant select on public.shop_settings to anon, authenticated;
grant update (
  name, logo_path, accent, currency, invoice_address, invoice_phone, invoice_email,
  invoice_footer, default_reorder_level, default_quality, updated_at
) on public.shop_settings to authenticated;

-- Written only by triggers.
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

revoke all on public.roles from anon;
revoke truncate, references, trigger on public.roles from authenticated;
