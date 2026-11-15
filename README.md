# SideQuest: Toys and Figures

A small shop manager for a toy store, built with Next.js, React, Tailwind CSS and Supabase.

- **Dashboard** (`/`): revenue, restock spend, expenses and net profit for a chosen period, a six-month money in/out chart, expenses by category, and toys that need restocking.
- **Inventory** (`/inventory`): toys with a category, manufacturer, pictures and one or more qualities (MISB, MIB, BIB, Loose, Damaged), each with its own price, cost and stock. Gallery and list views, filters and sorting. Selecting a toy opens its pictures and details, where it can be edited or deleted.
- **Transactions** (`/transactions`): sales, refunds and restocks for a chosen quality. Recording or deleting one adjusts that quality's stock.
- **Expenses** (`/expenses`): running costs such as rent, wages and supplies, with category and date filters.

## Running it

1. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and publishable key (Supabase dashboard > Project Settings > API Keys).
2. Apply the database schema in `supabase/migrations/` to that project (see below), if it isn't there yet.
3. Install and start:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). A new database is empty: use **Load sample data** in the sidebar to fill it with examples.

## Where the data lives

- **Toys, qualities, transactions and expenses** are stored in Supabase (Postgres). The schema is in `supabase/migrations/`. Apply the files in order with the Supabase CLI (`supabase db push`) or paste each one into the dashboard's SQL editor.
- **Stock changes happen in the database**: `record_transaction` saves a sale, refund or restock and adjusts stock in one step, refusing a sale bigger than the stock; `record_restock` saves every toy in a delivery at once, with each line's share of the delivery cost; `delete_transaction` undoes one; `save_toy` saves a toy together with its qualities.
- **Toy pictures** are stored in the public Supabase Storage bucket `toy-images`. They are resized to at most 1200 px and compressed before upload.
- **Display preferences** (currency, gallery or list view, light or dark theme) stay in each browser's localStorage.

The screens update straight away and save in the background. If a save fails, a "Not saved" message appears at the top and the data is reloaded from the database.

## Sign-in (not built yet)

> **Warning:** until sign-in is added, the database is open: anyone with the project URL and publishable key, both of which are in the app's browser code, can read and change all data and pictures. Don't deploy it publicly in this state.

The database is already prepared for sign-in:

- Every table has a `user_id` column that fills itself in from the signed-in user, and row level security is switched on.
- The app uses `@supabase/ssr`, so a session will be kept in cookies that both the browser and the server can read.
- Pictures upload into a folder named after the signed-in user's id (`shared/` until then).

To add it: build the sign-in screens with Supabase Auth, then apply `supabase/auth/enable_auth.sql`, which assigns the existing rows to an owner and replaces the open policies with per-user ones. Read the notes at the top of that file first.

## Code layout

- `src/lib/types.ts`: data shapes and the lists of categories, qualities, payment methods and expense categories.
- `src/lib/store.ts`: loads the data from Supabase, saves changes, and holds the screen-side rules for stock changes.
- `src/lib/supabase/client.ts`: the Supabase client.
- `src/lib/images.ts`: picture upload, removal and URLs.
- `src/lib/seed.ts`: the sample data.
- `src/components/`: one component per screen, plus shared pieces (`ui.tsx`, `images.tsx`, `toy-parts.tsx`, `status.tsx`).
- `src/app/`: the routes.
- `supabase/`: database migrations and the future sign-in policies.
