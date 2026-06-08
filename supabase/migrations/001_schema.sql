-- ============================================================
-- Portfolio Tracker — Schema inicial con RLS
-- Pegá esto en el SQL Editor de Supabase y ejecutá.
-- ============================================================

-- Extensión para UUID
create extension if not exists "uuid-ossp";

-- ── Tabla: instrumentos (catálogo) ──────────────────────────
create table public.instrumentos (
  ticker            text primary key,
  nombre            text not null,
  ratio_cedear      int,               -- CEDEARs por acción subyacente (null en cripto)
  ticker_subyacente text,              -- ticker en bolsa US, ej. 'AAPL'
  sector            text,
  pais              text,
  tipo              text not null default 'cedear' check (tipo in ('cedear', 'cripto', 'us'))
);

-- Seed CEDEARs más comunes
insert into public.instrumentos (ticker, nombre, ratio_cedear, ticker_subyacente, sector, pais) values
  ('AAPL',  'Apple Inc.',                          10, 'AAPL',  'Tecnología',          'USA'),
  ('MSFT',  'Microsoft Corp.',                     10, 'MSFT',  'Tecnología',          'USA'),
  ('GOOGL', 'Alphabet Inc.',                       10, 'GOOGL', 'Tecnología',          'USA'),
  ('AMZN',  'Amazon.com Inc.',                     10, 'AMZN',  'Consumo Discrecional','USA'),
  ('TSLA',  'Tesla Inc.',                           5, 'TSLA',  'Consumo Discrecional','USA'),
  ('META',  'Meta Platforms Inc.',                 10, 'META',  'Tecnología',          'USA'),
  ('NVDA',  'NVIDIA Corp.',                         5, 'NVDA',  'Tecnología',          'USA'),
  ('JPM',   'JPMorgan Chase & Co.',               10, 'JPM',   'Financiero',           'USA'),
  ('XOM',   'Exxon Mobil Corp.',                  10, 'XOM',   'Energía',              'USA'),
  ('JNJ',   'Johnson & Johnson',                  10, 'JNJ',   'Salud',                'USA'),
  ('KO',    'The Coca-Cola Co.',                  10, 'KO',    'Consumo Básico',        'USA'),
  ('WMT',   'Walmart Inc.',                        2, 'WMT',   'Consumo Básico',        'USA'),
  ('DIS',   'The Walt Disney Co.',                10, 'DIS',   'Entretenimiento',       'USA'),
  ('BAC',   'Bank of America Corp.',              10, 'BAC',   'Financiero',            'USA'),
  ('MA',    'Mastercard Inc.',                    10, 'MA',    'Financiero',            'USA'),
  ('V',     'Visa Inc.',                          10, 'V',     'Financiero',            'USA'),
  ('BABA',  'Alibaba Group Holding Ltd.',          5, 'BABA',  'Tecnología',           'China'),
  ('GOLD',  'Barrick Gold Corp.',                 10, 'GOLD',  'Materiales',            'Canadá'),
  ('SPY',   'SPDR S&P 500 ETF',                   10, 'SPY',   'ETF',                  'USA'),
  ('QQQ',   'Invesco QQQ Trust',                  10, 'QQQ',   'ETF',                  'USA');

-- Seed cripto
insert into public.instrumentos (ticker, nombre, sector, pais, tipo) values
  ('BTC',  'Bitcoin',  'Cripto', null, 'cripto'),
  ('ETH',  'Ethereum', 'Cripto', null, 'cripto'),
  ('BNB',  'BNB',      'Cripto', null, 'cripto'),
  ('SOL',  'Solana',   'Cripto', null, 'cripto'),
  ('ADA',  'Cardano',  'Cripto', null, 'cripto'),
  ('USDT', 'Tether',   'Cripto', null, 'cripto'),
  ('USDC', 'USD Coin', 'Cripto', null, 'cripto');

-- ── Tabla: portfolios ───────────────────────────────────────
create table public.portfolios (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,
  tipo       text not null check (tipo in ('cedear', 'cripto')),
  created_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

create policy "usuarios ven sus portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

create policy "usuarios crean sus portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

create policy "usuarios editan sus portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id);

create policy "usuarios eliminan sus portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);

-- ── Tabla: transacciones ────────────────────────────────────
create table public.transacciones (
  id              uuid primary key default uuid_generate_v4(),
  portfolio_id    uuid not null references public.portfolios(id) on delete cascade,
  ticker          text not null,
  tipo            text not null check (tipo in ('compra', 'venta')),
  fecha           date not null,
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  comision        numeric not null default 0 check (comision >= 0),
  ccl_snapshot    numeric not null check (ccl_snapshot > 0),
  moneda          text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  notas           text,
  created_at      timestamptz not null default now()
);

alter table public.transacciones enable row level security;

create policy "usuarios ven sus transacciones"
  on public.transacciones for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = transacciones.portfolio_id
        and p.user_id = auth.uid()
    )
  );

create policy "usuarios insertan en sus portfolios"
  on public.transacciones for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = transacciones.portfolio_id
        and p.user_id = auth.uid()
    )
  );

create policy "usuarios eliminan sus transacciones"
  on public.transacciones for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = transacciones.portfolio_id
        and p.user_id = auth.uid()
    )
  );

-- ── Tabla: dividendos ───────────────────────────────────────
create table public.dividendos (
  id           uuid primary key default uuid_generate_v4(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  ticker       text not null,
  fecha        date not null,
  monto        numeric not null check (monto > 0),
  moneda       text not null default 'USD' check (moneda in ('ARS', 'USD')),
  created_at   timestamptz not null default now()
);

alter table public.dividendos enable row level security;

create policy "usuarios ven sus dividendos"
  on public.dividendos for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = dividendos.portfolio_id
        and p.user_id = auth.uid()
    )
  );

create policy "usuarios insertan dividendos en sus portfolios"
  on public.dividendos for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = dividendos.portfolio_id
        and p.user_id = auth.uid()
    )
  );

create policy "usuarios eliminan sus dividendos"
  on public.dividendos for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = dividendos.portfolio_id
        and p.user_id = auth.uid()
    )
  );

-- ── Acceso público a instrumentos (catálogo) ────────────────
-- Los instrumentos son un catálogo compartido; cualquier usuario autenticado puede leer.
alter table public.instrumentos enable row level security;

create policy "autenticados leen instrumentos"
  on public.instrumentos for select
  to authenticated
  using (true);
