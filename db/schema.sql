-- Prenda de Natal — schema
create table if not exists players (
  id            text primary key,              -- 'duda' | 'filipino'
  display_name  text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- Every finished game is one row. day = the calendar day it counts for (null = free play after day 25).
create table if not exists plays (
  id          bigserial primary key,
  player_id   text not null references players(id) on delete cascade,
  day         int check (day between 1 and 25),
  game_id     text not null,
  score       double precision not null,
  duration_ms int,
  created_at  timestamptz not null default now()
);

create index if not exists plays_player_day_idx on plays (player_id, day);
create index if not exists plays_game_idx on plays (game_id);
