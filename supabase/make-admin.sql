-- After creating your login in Supabase (Authentication → Users → Add user),
-- put your email below and run this to make that login an admin.
insert into public.admins (user_id)
select id from auth.users where email = 'YOUR-EMAIL@example.com'
on conflict do nothing;
