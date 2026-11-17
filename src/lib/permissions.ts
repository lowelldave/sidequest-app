/**
 * What a role can be allowed to do. The database checks the same names (see
 * the roles table in supabase/migrations), so keep the two lists in step.
 *
 * People, roles, the shop setup and backups aren't listed: only the built-in
 * Admin role can manage those.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.delete",
  "transactions.view",
  "transactions.create",
  "transactions.delete",
  "expenses.view",
  "expenses.create",
  "expenses.edit",
  "expenses.delete",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Action = "view" | "create" | "edit" | "delete";

export const ACTION_LABEL: Record<Action, string> = {
  view: "Open page",
  create: "Add",
  edit: "Edit",
  delete: "Delete",
};

/** Each page and the actions a role can be given on it, for the roles editor. */
export const PERMISSION_GROUPS: {
  page: string;
  path: string;
  actions: Partial<Record<Action, { permission: Permission; hint: string }>>;
}[] = [
  {
    page: "Dashboard",
    path: "/",
    actions: {
      view: { permission: "dashboard.view", hint: "Sales, expenses and stock summaries. Shows sales and expense totals." },
    },
  },
  {
    page: "Inventory",
    path: "/inventory",
    actions: {
      view: { permission: "inventory.view", hint: "See the toy list, prices and stock." },
      create: { permission: "inventory.create", hint: "Add toys, including from a transaction." },
      edit: { permission: "inventory.edit", hint: "Change toys, prices, stock and pictures." },
      delete: { permission: "inventory.delete", hint: "Delete toys." },
    },
  },
  {
    page: "Transactions",
    path: "/transactions",
    actions: {
      view: { permission: "transactions.view", hint: "See sales, refunds and restocks and download invoices." },
      create: { permission: "transactions.create", hint: "Record sales, refunds and restocks." },
      delete: { permission: "transactions.delete", hint: "Delete transactions (stock is adjusted back)." },
    },
  },
  {
    page: "Expenses",
    path: "/expenses",
    actions: {
      view: { permission: "expenses.view", hint: "See the shop's running costs." },
      create: { permission: "expenses.create", hint: "Add expenses." },
      edit: { permission: "expenses.edit", hint: "Change expenses." },
      delete: { permission: "expenses.delete", hint: "Delete expenses." },
    },
  },
];

/** Where to send someone whose role can't open the page they asked for. */
export function firstAllowedPage(can: (p: Permission) => boolean): string {
  if (can("dashboard.view")) return "/";
  if (can("inventory.view")) return "/inventory";
  if (can("transactions.view")) return "/transactions";
  if (can("expenses.view")) return "/expenses";
  return "/settings/profile";
}
