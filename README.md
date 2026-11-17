# SideQuest: Toys and Figures

A small shop manager for a toy store, built with Next.js, React, Tailwind CSS and Supabase.

- **Dashboard** (`/`): revenue, restock spend, expenses and net profit for a chosen period, a six-month money in/out chart, expenses by category, and toys that need restocking.
- **Inventory** (`/inventory`): toys with a category, manufacturer, pictures and one or more qualities (MISB, MIB, BIB, Loose, Damaged), each with its own price, cost and stock. Gallery and list views, filters and sorting. Selecting a toy opens its pictures and details, where it can be edited or deleted.
- **Transactions** (`/transactions`): sales, refunds and restocks for a chosen quality. Recording or deleting one adjusts that quality's stock. Each row can be downloaded as a PDF invoice.
- **Expenses** (`/expenses`): running costs such as rent, wages and supplies, with category and date filters.
- **Settings** (`/settings`): everyone's own profile, password and activity; for the admin, people, roles, the shop setup and backups.

## Running it

1. Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and publishable key (Supabase dashboard > Project Settings > API Keys).
2. Apply the database migrations in `supabase/migrations/` to that project, in order (see below), if they aren't there yet.
3. Deploy the `admin-users` edge function in `supabase/functions/` (`supabase functions deploy admin-users --no-verify-jwt`). It checks the caller itself.
4. In the Supabase dashboard, under Authentication > URL Configuration, set the Site URL to where the app runs (for example `http://localhost:3000`) and add `http://localhost:3000/auth/**` to the redirect URLs. Email links (confirmations, password resets, invitations) only go to addresses listed there.
5. Install and start:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The first visit asks you to **set up your shop**: the account you create there becomes the admin. If Supabase asks for email confirmation, open the link it sends, then sign in.

A new database is empty: the admin can fill it with examples from Settings > Backup and restore > Load sample data.

## Sign-in, people and roles

- Everyone signs in with email and password. "Forgot your password?" emails a reset link.
- **The first account is the admin.** After that, the admin adds people in Settings > People, either with a temporary password (they choose their own at first sign-in) or with an email invitation. Anyone who signs up on their own gets no role and sees "Waiting for access" until the admin gives them one. To stop self sign-up entirely, turn off "Allow new users to sign up" in the Supabase dashboard (Authentication > Sign In / Providers) once the admin account exists.
- **Roles** decide which pages someone can open and whether they can add, edit or delete there. The built-in roles are Admin (everything), Manager, Cashier and Viewer. The admin can change these and create new ones in Settings > Roles. Only the Admin role can manage people, roles, the shop setup and backups, and it can't be edited or deleted. There is always at least one active admin.
- The rules are enforced by the database (row level security and checks inside the functions), not just hidden in the screens. Removing someone's account keeps everything they recorded.
- **Email**: Supabase's built-in email service only sends a few messages an hour, and only to your Supabase team's addresses. To send invitations and resets to staff, set up your own SMTP service in the Supabase dashboard (Authentication > Emails > SMTP settings). Adding people with a temporary password works without email.

## Settings

- **Profile**: name, profile picture, and preferences that follow the person to any device (theme, inventory list or gallery view).
- **Sign-in and security**: change email (confirmed by email) and password; sign out other devices or everywhere.
- **Activity**: what the person has recorded and changed. The admin can also see everyone's.
- **People** (admin): add, invite, change role, block, reset password, remove.
- **Roles** (admin): page and action permissions for each role.
- **Shop setup** (admin): shop name, logo, colour scheme, currency, invoice details (address, phone, email, footer message) and defaults for new toys.
- **Backup and restore** (admin): download all shop data as a JSON file, restore it in one step, load the sample data or start over.

## Where the data lives

- **Toys, qualities, transactions and expenses** are stored in Supabase (Postgres), shared by everyone in the shop. The schema is in `supabase/migrations/`. Apply the files in order with the Supabase CLI (`supabase db push`) or paste each one into the dashboard's SQL editor.
- **Stock changes happen in the database**: `record_transaction` saves a sale, refund or restock and adjusts stock in one step, refusing a sale bigger than the stock; `record_restock` saves every toy in a delivery at once, with each line's share of the delivery cost; `delete_transaction` undoes one; `save_toy` saves a toy together with its qualities. Each checks the caller's role first.
- **People and roles**: `profiles` (one per account, with its role), `roles`, and `activity_log`, which triggers fill in as things change.
- **Shop setup**: one row in `shop_settings`, readable by anyone so the sign-in page can show the shop's name and logo.
- **Pictures**: public Supabase Storage buckets `toy-images` (toys, resized to at most 1200 px), `avatars` (profile pictures) and `shop-assets` (the logo).
- **Browser-only**: the light/dark choice is also kept in localStorage so the page doesn't flash before the account loads.

The screens update straight away and save in the background. If a save fails, a "Not saved" message appears at the top and the data is reloaded from the database.

## Code layout

- `src/proxy.ts` and `src/lib/supabase/proxy.ts`: keep the sign-in session fresh and send signed-out visitors to `/login`.
- `src/lib/account.ts`: the signed-in person, their role's permissions, sign-in, sign-out and profile changes.
- `src/lib/permissions.ts`: the list of permissions and which page needs which.
- `src/lib/admin.ts`: people and roles, for the admin.
- `src/lib/shop.ts`: the shop setup (name, logo, colours, currency, invoice details, defaults).
- `src/lib/types.ts`: data shapes and the lists of categories, qualities, payment methods and expense categories.
- `src/lib/store.ts`: loads the shop data from Supabase, saves changes, and holds the screen-side rules for stock changes.
- `src/lib/supabase/client.ts`: the browser's Supabase client.
- `src/lib/images.ts`: toy picture upload, removal and URLs.
- `src/lib/invoice.ts`: PDF invoices.
- `src/lib/seed.ts`: the sample data.
- `src/components/AppShell.tsx`: decides what a visitor sees (sign-in, "waiting for access", or the pages their role allows).
- `src/components/`: one component per screen, `auth/` for the sign-in pages, `settings/` for the settings pages, plus shared pieces (`ui.tsx`, `images.tsx`, `toy-parts.tsx`, `status.tsx`).
- `src/app/`: the routes.
- `supabase/migrations/`: the database schema, in order.
- `supabase/functions/admin-users/`: creates, invites, resets and removes accounts for the admin (it needs the project's secret key, so it can't run in the browser).
