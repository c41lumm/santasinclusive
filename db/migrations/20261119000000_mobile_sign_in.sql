-- Helpers with only a mobile sign in with a code sent by text. Server only: no one else can read these tables.
create table phone_sign_ins (
  user_id    uuid primary key,          -- their Neon Auth account (with a placeholder email they never see)
  phone_norm text not null unique,      -- 447...
  secret     text not null,             -- the account's random password, encrypted with the server's secret
  created_at timestamptz not null default now()
);
create table sign_in_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references phone_sign_ins(user_id) on delete cascade,
  code_hash  text not null,
  attempts   int  not null default 0,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index sign_in_codes_user_idx on sign_in_codes (user_id, created_at desc);
alter table phone_sign_ins enable row level security;
alter table sign_in_codes enable row level security;
