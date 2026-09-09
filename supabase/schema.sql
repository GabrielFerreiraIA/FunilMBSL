-- =============================================================================
-- Telemetria do funil MBSL — tabela de eventos
-- Rode uma vez no SQL Editor do Supabase (é idempotente).
-- =============================================================================

create table if not exists public.eventos (
  id            bigint generated always as identity primary key,

  -- ts é o relógio do NAVEGADOR (quando a pessoa agiu); recebido_em é o do
  -- SERVIDOR. Guardamos os dois porque relógio de cliente mente, e sem o do
  -- servidor não dá para confiar em nenhuma ordenação.
  ts            timestamptz not null,
  recebido_em   timestamptz not null default now(),

  visitante_id  text not null,   -- localStorage: atravessa sessões
  sessao_id     text not null,   -- sessionStorage: uma visita

  tipo          text not null,   -- 'pageview' | 'clique' | 'nomeado'
  evento        text not null,   -- 'click_assinar', 'clique', 'pageview'...
  etapa         text,

  url           text,
  referrer      text,

  -- Preenchidos a partir do momento em que a pessoa envia o formulário; antes
  -- disso o evento é anônimo e só o visitante_id o liga aos posteriores.
  nome          text,
  email         text,

  utms          jsonb not null default '{}'::jsonb,
  dados         jsonb not null default '{}'::jsonb,
  ua            text
);

create index if not exists eventos_visitante_ts_idx on public.eventos (visitante_id, ts);
create index if not exists eventos_evento_ts_idx    on public.eventos (evento, ts desc);
create index if not exists eventos_ts_idx           on public.eventos (ts desc);
create index if not exists eventos_email_idx        on public.eventos (email) where email is not null;

-- RLS ligado e SEM políticas: nenhuma chave anônima lê ou escreve nada. O
-- acesso é só pela service_role key, que vive no servidor (rotas /api/*).
alter table public.eventos enable row level security;
