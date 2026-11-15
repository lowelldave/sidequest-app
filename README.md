# SideQuest: Toys and Figures

A small shop manager for a toy store, built with Next.js, React and Tailwind CSS.

- **Dashboard** (`/`): revenue, restock spend, expenses and net profit for a chosen period, a six-month money in/out chart, expenses by category, and toys that need restocking.
- **Inventory** (`/inventory`): toys with a category, quality, price, cost and stock level. Switch between gallery and list views; filter by search text, category, quality, stock status and price range; sort by name, price, stock or newest.
- **Transactions** (`/transactions`): sales, refunds and restocks. Recording or deleting one adjusts the toy's stock.
- **Expenses** (`/expenses`): running costs such as rent, wages and supplies, with category and date filters.

## Running it

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Where the data lives

Everything is stored in the browser's `localStorage` (key `toyshop:data:v1`), so there is no database or server to set up. Data stays on the device and browser you use; clearing site data removes it. The app starts with sample data, which you can reload or clear from the sidebar.

## Code layout

- `src/lib/types.ts`: data shapes and the lists of categories, qualities, payment methods and expense categories. Edit these lists to change the options.
- `src/lib/store.ts`: reads and writes the data and holds the rules for stock changes.
- `src/lib/seed.ts`: the sample data.
- `src/components/`: one component per screen, plus shared UI pieces in `ui.tsx`.
- `src/app/`: the routes.
