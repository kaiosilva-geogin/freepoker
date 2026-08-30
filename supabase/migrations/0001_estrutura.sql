create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_sala') then
    create type public.estado_sala as enum ('votando', 'revelado', 'encerrado');
  end if;
end
$$;

create table if not exists public.salas (
  id uuid primary key default extensions.gen_random_uuid(),
  codigo varchar(6) not null unique,
  nome varchar(80) not null,
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  conjunto_cartas varchar(30) not null,
  estado public.estado_sala not null default 'votando',
  numero_rodada integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '24 hours'),
  constraint salas_codigo_valido check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  constraint salas_nome_valido check (char_length(btrim(nome)) between 1 and 80),
  constraint salas_conjunto_valido check (
    conjunto_cartas in ('fibonacci', 'fibonacci_estendida', 'sequencial')
  ),
  constraint salas_rodada_valida check (numero_rodada > 0)
);

create table if not exists public.participantes (
  id uuid primary key default extensions.gen_random_uuid(),
  sala_id uuid not null references public.salas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome varchar(40) not null,
  ativo boolean not null default true,
  removido_em timestamptz,
  votou boolean not null default false,
  entrou_em timestamptz not null default now(),
  ultima_atividade_em timestamptz not null default now(),
  unique (sala_id, usuario_id),
  constraint participantes_nome_valido check (char_length(btrim(nome)) between 1 and 40),
  constraint participantes_remocao_coerente check (
    (ativo and removido_em is null) or (not ativo and removido_em is not null)
  )
);

create table if not exists public.votos (
  sala_id uuid not null references public.salas(id) on delete cascade,
  participante_id uuid not null references public.participantes(id) on delete cascade,
  numero_rodada integer not null,
  valor varchar(10) not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (sala_id, participante_id, numero_rodada),
  constraint votos_rodada_valida check (numero_rodada > 0),
  constraint votos_valor_valido check (
    valor in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '20', '21', '40', '100', '?', 'cafe')
  )
);

create index if not exists participantes_sala_ativos_idx
  on public.participantes (sala_id, ativo);

create index if not exists participantes_usuario_idx
  on public.participantes (usuario_id);

create index if not exists participantes_atividade_idx
  on public.participantes (ultima_atividade_em);

create index if not exists votos_sala_rodada_idx
  on public.votos (sala_id, numero_rodada);

create index if not exists salas_expiracao_idx
  on public.salas (expira_em);

alter table public.salas enable row level security;
alter table public.participantes enable row level security;
alter table public.votos enable row level security;

revoke all on public.salas from anon, authenticated;
revoke all on public.participantes from anon, authenticated;
revoke all on public.votos from anon, authenticated;
