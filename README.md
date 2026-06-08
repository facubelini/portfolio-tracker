# Portfolio Tracker — CEDEARs & Cripto

Webapp personal para registrar movimientos de inversión y ver P&L en ARS y USD.

## Setup local

### 1. Clonar y dependencias
```bash
git clone https://github.com/facubelini/portfolio-tracker
cd portfolio-tracker
npm install
```

### 2. Variables de entorno
```bash
cp .env.example .env.local
```
Completar con los valores de tu proyecto Supabase:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### 3. Correr local
```bash
npm run dev
```

---

## Setup Supabase (una sola vez)

1. Crear proyecto en [supabase.com](https://supabase.com) (Free tier es suficiente).
2. Copiar **Project URL** y **anon key** (Settings → API).
3. Ir a **SQL Editor** y ejecutar el contenido de `supabase/migrations/001_schema.sql`.
4. Crear tu usuario: Authentication → Users → Add user.

## Deploy en GitHub Pages

El repo debe ser **privado**. Deploy automático en cada push a `main` via GitHub Actions.

Antes del primer push, configurar secrets (Settings → Secrets → Actions):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Luego activar GitHub Pages: Settings → Pages → Source: **GitHub Actions**.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4 (dark mode)
- Supabase (Postgres + Auth + RLS)
- TanStack Query (cache de precios, ~60s stale)
- Recharts (gráficos)
- HashRouter (compatible con GitHub Pages)

## Fuentes de datos

| Dato | Fuente |
|------|--------|
| CEDEARs (ARS), MEP/CCL, OHLC | data912.com |
| Cripto spot (USD) | Binance API |
| CCL/MEP/Blue fallback | dolarapi.com |
