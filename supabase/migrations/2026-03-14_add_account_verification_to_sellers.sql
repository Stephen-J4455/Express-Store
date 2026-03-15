alter table public.express_sellers
add column if not exists account_verified boolean not null default false;

create index if not exists idx_express_sellers_account_verified
on public.express_sellers using btree (account_verified) tablespace pg_default;
