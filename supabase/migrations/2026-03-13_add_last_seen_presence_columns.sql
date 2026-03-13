alter table public.express_profiles
add column if not exists last_seen_at timestamptz;

alter table public.express_sellers
add column if not exists last_seen_at timestamptz;