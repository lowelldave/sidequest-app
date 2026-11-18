"use client";

import { useSyncExternalStore } from "react";
import { getAccount, savePreferences, subscribeAccount } from "./account";
import { removeImages } from "./images";
import { allocateDelivery } from "./restock";
import { createSeed } from "./seed";
import { getShopSettings, subscribeShopSettings } from "./shop";
import { getSupabase } from "./supabase/client";
import type {
  Category,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  Quality,
  ShopData,
  Toy,
  Transaction,
  TransactionType,
} from "./types";

/**
 * The shop's data lives in Supabase (Postgres). This module loads it once,
 * keeps a copy in memory for the screens to read with `useShop()`, and exposes
 * the action functions that change it.
 *
 * Actions update the in-memory copy straight away so the screen responds at
 * once, then save to the database in the background. If a save fails, the
 * error is shown (see `useSyncError`) and the data is reloaded from the
 * database, which undoes the change on screen.
 *
 * Data loads once someone with a role is signed in, and is dropped when they
 * sign out. The currency comes from the shop settings and the list/gallery
 * choice from the person's own preferences.
 */

let data: ShopData | null = null;
/** Why the first load failed, if it did. */
let loadError: string | null = null;
/** The most recent failed save, shown until dismissed. */
let syncError: string | null = null;
let started = false;
/** Whose data is loaded (or loading), so a different sign-in starts afresh. */
let loadedFor: string | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Loads the data when a member signs in and forgets it when they sign out. */
function syncWithAccount() {
  const account = getAccount();
  const member =
    account.status === "signed-in" && account.access?.active && account.access.role_id ? account.user.id : null;
  if (member === loadedFor) {
    applySettings();
    return;
  }
  loadedFor = member;
  data = null;
  loadError = null;
  syncError = null;
  emit();
  if (member) void load();
}

function currentSettings(): ShopData["settings"] {
  const account = getAccount();
  const view = account.status === "signed-in" ? account.profile?.preferences.inventoryView : undefined;
  return { currency: getShopSettings().currency, inventoryView: view ?? "gallery" };
}

/** Picks up a changed currency or view without reloading anything. */
function applySettings() {
  if (!data) return;
  const next = currentSettings();
  if (next.currency !== data.settings.currency || next.inventoryView !== data.settings.inventoryView) {
    data = { ...data, settings: next };
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    subscribeAccount(syncWithAccount);
    subscribeShopSettings(applySettings);
    syncWithAccount();
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Null while loading (or if loading failed, see `useLoadError`), then the shop's data. */
export function useShop(): ShopData | null {
  return useSyncExternalStore<ShopData | null>(
    subscribe,
    () => data,
    () => null,
  );
}

/** A message if the data couldn't be loaded at all, otherwise null. */
export function useLoadError(): string | null {
  return useSyncExternalStore<string | null>(
    subscribe,
    () => loadError,
    () => null,
  );
}

/** A message if a recent change couldn't be saved, otherwise null. */
export function useSyncError(): string | null {
  return useSyncExternalStore<string | null>(
    subscribe,
    () => syncError,
    () => null,
  );
}

export function dismissSyncError() {
  syncError = null;
  emit();
}

/** Tries loading again after a failed load. */
export function retryLoad() {
  loadError = null;
  emit();
  void load();
}

// ---------- Settings ----------

/** Switches between the list and gallery view; remembered in the person's profile. */
export function setInventoryView(view: ShopData["settings"]["inventoryView"]) {
  savePreferences({ inventoryView: view });
  applySettings();
}

// ---------- Loading ----------

type ToyRow = {
  id: string;
  name: string;
  sku: string;
  manufacturer: string;
  category: Category;
  images: string[];
  reorder_level: number;
  notes: string;
  created_at: string;
  toy_qualities: { quality: Quality; price: number; cost: number; stock: number; position: number }[];
};

type TransactionRow = {
  id: string;
  date: string;
  type: TransactionType;
  toy_id: string | null;
  toy_name: string;
  quality: Quality;
  quantity: number;
  unit_price: number;
  amount: number;
  payment: PaymentMethod;
  note: string;
  delivery: number | null;
  batch_id: string | null;
};

type ExpenseRow = {
  id: string;
  date: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
};

function toToy(row: ToyRow): Toy {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    manufacturer: row.manufacturer,
    category: row.category,
    images: row.images ?? [],
    qualities: [...row.toy_qualities]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        quality: q.quality,
        price: Number(q.price),
        cost: Number(q.cost),
        stock: q.stock,
      })),
    reorderLevel: row.reorder_level,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    // Empty once the toy has been deleted; toyName still says what it was.
    toyId: row.toy_id ?? "",
    toyName: row.toy_name,
    quality: row.quality,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    payment: row.payment,
    note: row.note,
    ...(Number(row.delivery) > 0 ? { delivery: Number(row.delivery) } : {}),
    ...(row.batch_id ? { batchId: row.batch_id } : {}),
  };
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    vendor: row.vendor,
    description: row.description,
    amount: Number(row.amount),
  };
}

function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return /failed to fetch|networkerror|load failed/i.test(message)
    ? "Couldn't reach the database. Check your internet connection."
    : message;
}

/** Reads every row of a table. The API returns at most 1,000 rows per request, so this pages. */
async function fetchAll<T>(
  table: string,
  columns: string,
  orderBy: [column: string, ascending: boolean][],
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = getSupabase().from(table).select(columns);
    for (const [column, ascending] of orderBy) query = query.order(column, { ascending });
    const { data: page, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((page ?? []) as T[]));
    if (!page || page.length < PAGE) return rows;
  }
}

async function load() {
  const forUser = loadedFor;
  try {
    const [toys, transactions, expenses] = await Promise.all([
      fetchAll<ToyRow>("toys", "*, toy_qualities(*)", [
        ["name", true],
        ["id", true],
      ]),
      fetchAll<TransactionRow>("transactions", "*", [
        ["date", false],
        ["created_at", false],
        ["id", true],
      ]),
      fetchAll<ExpenseRow>("expenses", "*", [
        ["date", false],
        ["created_at", false],
        ["id", true],
      ]),
    ]);
    // Signed out (or someone else signed in) while this was loading.
    if (forUser !== loadedFor) return;
    data = {
      toys: toys.map(toToy),
      transactions: transactions.map(toTransaction),
      expenses: expenses.map(toExpense),
      settings: currentSettings(),
    };
    loadError = null;
  } catch (e) {
    // With data already on screen, a failed refresh is reported as a save problem
    // rather than replacing the whole screen with an error.
    if (data) syncError = `Couldn't refresh from the database. ${errorText(e)}`;
    else loadError = errorText(e);
  }
  emit();
}

// ---------- Saving ----------

type Result = { error: { message: string } | null };

/** Saves run one after another, in the order the changes were made. */
let queue: Promise<void> = Promise.resolve();

/**
 * Applies a change on screen immediately, then saves it. If the save fails the
 * error is shown and the data is reloaded, which reverts the change on screen.
 */
function change(optimistic: (d: ShopData) => ShopData, save: () => PromiseLike<Result>, failed: string) {
  if (!data) return;
  data = optimistic(data);
  emit();
  queue = queue.then(async () => {
    let problem: string | null = null;
    try {
      const { error } = await save();
      if (error) problem = error.message;
    } catch (e) {
      problem = errorText(e);
    }
    if (problem) {
      syncError = `${failed} ${errorText(problem)}`;
      emit();
      await load();
    }
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Toys ----------

export type ToyInput = Omit<Toy, "id" | "createdAt">;

function toyPayload(id: string, input: ToyInput) {
  return {
    id,
    name: input.name,
    sku: input.sku,
    manufacturer: input.manufacturer,
    category: input.category,
    images: input.images,
    reorder_level: input.reorderLevel,
    notes: input.notes,
    qualities: input.qualities,
  };
}

/** Adds a toy to the inventory and returns it. */
export function addToy(input: ToyInput): Toy {
  const toy: Toy = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  change(
    (d) => ({ ...d, toys: [toy, ...d.toys] }),
    () => getSupabase().rpc("save_toy", { p_toy: { ...toyPayload(toy.id, input), created_at: toy.createdAt } }),
    `Couldn't save "${input.name}".`,
  );
  return toy;
}

export function updateToy(id: string, input: ToyInput) {
  change(
    (d) => ({
      ...d,
      toys: d.toys.map((t) => (t.id === id ? { ...t, ...input } : t)),
      // Keep the name shown on past transactions in step with a rename (the database does the same).
      transactions: d.transactions.map((tx) => (tx.toyId === id ? { ...tx, toyName: input.name } : tx)),
    }),
    () => getSupabase().rpc("save_toy", { p_toy: toyPayload(id, input) }),
    `Couldn't save "${input.name}".`,
  );
}

export function deleteToy(id: string) {
  const toy = data?.toys.find((t) => t.id === id);
  if (!toy) return;
  change(
    (d) => ({ ...d, toys: d.toys.filter((t) => t.id !== id) }),
    async () => {
      const result = await getSupabase().from("toys").delete().eq("id", id);
      // Only once the toy is really gone are its pictures safe to delete.
      if (!result.error) void removeImages(toy.images);
      return result;
    },
    `Couldn't delete "${toy.name}".`,
  );
}

// ---------- Transactions ----------

export type TransactionInput = Omit<Transaction, "id" | "toyName" | "amount">;

/** Stock change caused by a transaction: sales take stock out, refunds and restocks put it back. */
function stockDelta(type: Transaction["type"], quantity: number): number {
  return type === "sale" ? -quantity : quantity;
}

/** Applies a stock change to one quality of one toy. Stock never goes below zero. */
function adjustStock(toys: Toy[], toyId: string, quality: Quality, delta: number): Toy[] {
  return toys.map((t) =>
    t.id === toyId
      ? {
          ...t,
          qualities: t.qualities.map((q) =>
            q.quality === quality ? { ...q, stock: Math.max(0, q.stock + delta) } : q,
          ),
        }
      : t,
  );
}

/**
 * Records a transaction and adjusts that quality's stock. Returns an error message
 * if the input is invalid, or null once the change is accepted. The database checks
 * stock again when saving, in case it changed elsewhere in the meantime.
 */
export function addTransaction(input: TransactionInput): string | null {
  if (!data) return "The shop's data hasn't loaded yet.";
  const toy = data.toys.find((t) => t.id === input.toyId);
  if (!toy) return "Choose a toy for this transaction.";
  const variant = toy.qualities.find((q) => q.quality === input.quality);
  if (!variant) return `"${toy.name}" doesn't come in ${input.quality}.`;
  if (!(input.quantity > 0) || !Number.isInteger(input.quantity)) {
    return "Quantity must be a whole number above zero.";
  }
  if (input.unitPrice < 0 || Number.isNaN(input.unitPrice)) {
    return "Unit price can't be negative.";
  }
  if (input.type === "sale" && input.quantity > variant.stock) {
    return `Only ${variant.stock} of "${toy.name}" (${variant.quality}) in stock.`;
  }
  const tx: Transaction = {
    ...input,
    id: crypto.randomUUID(),
    toyName: toy.name,
    amount: round2(input.quantity * input.unitPrice),
  };
  change(
    (d) => ({
      ...d,
      transactions: [tx, ...d.transactions],
      toys: adjustStock(d.toys, toy.id, input.quality, stockDelta(input.type, input.quantity)),
    }),
    () =>
      getSupabase().rpc("record_transaction", {
        p_tx: {
          id: tx.id,
          date: tx.date,
          type: tx.type,
          toy_id: tx.toyId,
          quality: tx.quality,
          quantity: tx.quantity,
          unit_price: tx.unitPrice,
          payment: tx.payment,
          note: tx.note,
        },
      }),
    `Couldn't record the ${input.type} of "${toy.name}".`,
  );
  return null;
}

/** Removes a transaction and undoes its effect on that quality's stock. */
export function deleteTransaction(id: string) {
  const tx = data?.transactions.find((t) => t.id === id);
  if (!tx) return;
  change(
    (d) => ({
      ...d,
      transactions: d.transactions.filter((t) => t.id !== id),
      toys: adjustStock(d.toys, tx.toyId, tx.quality, -stockDelta(tx.type, tx.quantity)),
    }),
    () => getSupabase().rpc("delete_transaction", { p_id: id }),
    "Couldn't delete the transaction.",
  );
}

export type RestockInput = {
  date: string;
  payment: Transaction["payment"];
  note: string;
  /** What the delivery cost in total. Shared across the lines by quantity. */
  deliveryCost: number;
  lines: { toyId: string; quality: Quality; quantity: number; unitCost: number }[];
};

/**
 * Records a delivery of several toys at once and adds their stock. Each line becomes
 * its own transaction, all sharing one `batchId`, and the delivery cost is split
 * across them so each line's amount (and so its final unit cost) includes its share.
 * Returns an error message, or null on success.
 */
export function addRestock(input: RestockInput): string | null {
  if (!data) return "The shop's data hasn't loaded yet.";
  const s = data;
  if (input.lines.length === 0) return "Add at least one toy to restock.";
  if (!(input.deliveryCost >= 0) || !Number.isFinite(input.deliveryCost)) {
    return "Delivery cost can't be negative.";
  }

  const seen = new Set<string>();
  for (const [i, line] of input.lines.entries()) {
    const toy = s.toys.find((t) => t.id === line.toyId);
    const item = `Item ${i + 1}`;
    if (!toy) return `${item}: choose a toy.`;
    if (!toy.qualities.some((q) => q.quality === line.quality)) {
      return `${item}: "${toy.name}" doesn't come in ${line.quality}.`;
    }
    if (!(line.quantity > 0) || !Number.isInteger(line.quantity)) {
      return `${item} (${toy.name}): quantity must be a whole number above zero.`;
    }
    if (!(line.unitCost >= 0) || !Number.isFinite(line.unitCost)) {
      return `${item} (${toy.name}): unit cost can't be negative.`;
    }
    const key = `${line.toyId}|${line.quality}`;
    if (seen.has(key)) {
      return `"${toy.name}" (${line.quality}) is listed twice. Combine them into one line.`;
    }
    seen.add(key);
  }

  const shares = allocateDelivery(
    input.lines.map((l) => l.quantity),
    input.deliveryCost,
  );
  const batchId = crypto.randomUUID();
  const transactions: Transaction[] = input.lines.map((line, i) => {
    const toy = s.toys.find((t) => t.id === line.toyId)!;
    return {
      id: crypto.randomUUID(),
      date: input.date,
      type: "restock",
      toyId: toy.id,
      toyName: toy.name,
      quality: line.quality,
      quantity: line.quantity,
      unitPrice: line.unitCost,
      delivery: shares[i],
      amount: round2(line.quantity * line.unitCost + shares[i]),
      payment: input.payment,
      note: input.note,
      batchId,
    };
  });

  change(
    (d) => {
      let toys = d.toys;
      for (const tx of transactions) toys = adjustStock(toys, tx.toyId, tx.quality, tx.quantity);
      return { ...d, transactions: [...transactions, ...d.transactions], toys };
    },
    () =>
      getSupabase().rpc("record_restock", {
        p_lines: transactions.map((tx) => ({
          id: tx.id,
          batch_id: tx.batchId,
          date: tx.date,
          toy_id: tx.toyId,
          quality: tx.quality,
          quantity: tx.quantity,
          unit_price: tx.unitPrice,
          delivery: tx.delivery,
          payment: tx.payment,
          note: tx.note,
        })),
      }),
    "Couldn't record the restock.",
  );
  return null;
}

export type SaleInput = {
  date: string;
  payment: Transaction["payment"];
  note: string;
  lines: { toyId: string; quality: Quality; quantity: number; unitPrice: number }[];
};

/**
 * Records a sale of one or more toys and takes them out of stock. Each line becomes
 * its own transaction; with more than one line they share a `batchId`, so they show
 * and print as one sale. Returns an error message, or null on success.
 */
export function addSale(input: SaleInput): string | null {
  if (!data) return "The shop's data hasn't loaded yet.";
  const s = data;
  if (input.lines.length === 0) return "Add at least one toy to sell.";

  const seen = new Set<string>();
  for (const [i, line] of input.lines.entries()) {
    const toy = s.toys.find((t) => t.id === line.toyId);
    const item = input.lines.length > 1 ? `Item ${i + 1}: ` : "";
    if (!toy) return `${item}Choose a toy to sell.`;
    const variant = toy.qualities.find((q) => q.quality === line.quality);
    if (!variant) return `${item}"${toy.name}" doesn't come in ${line.quality}.`;
    if (!(line.quantity > 0) || !Number.isInteger(line.quantity)) {
      return `${item}quantity of "${toy.name}" must be a whole number above zero.`;
    }
    if (!(line.unitPrice >= 0) || !Number.isFinite(line.unitPrice)) {
      return `${item}unit price of "${toy.name}" can't be negative.`;
    }
    if (line.quantity > variant.stock) {
      return `${item}only ${variant.stock} of "${toy.name}" (${variant.quality}) in stock.`;
    }
    const key = `${line.toyId}|${line.quality}`;
    if (seen.has(key)) {
      return `"${toy.name}" (${line.quality}) is listed twice. Combine them into one line.`;
    }
    seen.add(key);
  }

  // A one-toy sale stays a plain transaction, as before.
  const batchId = input.lines.length > 1 ? crypto.randomUUID() : undefined;
  const transactions: Transaction[] = input.lines.map((line) => {
    const toy = s.toys.find((t) => t.id === line.toyId)!;
    return {
      id: crypto.randomUUID(),
      date: input.date,
      type: "sale",
      toyId: toy.id,
      toyName: toy.name,
      quality: line.quality,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: round2(line.quantity * line.unitPrice),
      payment: input.payment,
      note: input.note,
      ...(batchId ? { batchId } : {}),
    };
  });

  change(
    (d) => {
      let toys = d.toys;
      for (const tx of transactions) toys = adjustStock(toys, tx.toyId, tx.quality, -tx.quantity);
      return { ...d, transactions: [...transactions, ...d.transactions], toys };
    },
    () =>
      getSupabase().rpc("record_sale", {
        p_lines: transactions.map((tx) => ({
          id: tx.id,
          batch_id: tx.batchId ?? null,
          date: tx.date,
          toy_id: tx.toyId,
          quality: tx.quality,
          quantity: tx.quantity,
          unit_price: tx.unitPrice,
          payment: tx.payment,
          note: tx.note,
        })),
      }),
    "Couldn't record the sale.",
  );
  return null;
}

// ---------- Expenses ----------

export type ExpenseInput = Omit<Expense, "id">;

export function addExpense(input: ExpenseInput) {
  const expense: Expense = { ...input, id: crypto.randomUUID() };
  change(
    (d) => ({ ...d, expenses: [expense, ...d.expenses] }),
    () => getSupabase().from("expenses").insert(expense),
    "Couldn't save the expense.",
  );
}

export function updateExpense(id: string, input: ExpenseInput) {
  change(
    (d) => ({ ...d, expenses: d.expenses.map((e) => (e.id === id ? { ...input, id } : e)) }),
    () => getSupabase().from("expenses").update(input).eq("id", id),
    "Couldn't save the expense.",
  );
}

export function deleteExpense(id: string) {
  change(
    (d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }),
    () => getSupabase().from("expenses").delete().eq("id", id),
    "Couldn't delete the expense.",
  );
}

// ---------- Replacing everything (admin only) ----------

/** The shop's data as stored in the database, for backups and `admin_replace_data`. */
export type DataRows = {
  toys: Record<string, unknown>[];
  toy_qualities: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
};

/** Reads every toy, quality, transaction and expense straight from the database. */
export async function exportRows(): Promise<DataRows> {
  const [toys, toy_qualities, transactions, expenses] = await Promise.all([
    fetchAll<Record<string, unknown>>("toys", "*", [["id", true]]),
    fetchAll<Record<string, unknown>>("toy_qualities", "*", [
      ["toy_id", true],
      ["position", true],
    ]),
    fetchAll<Record<string, unknown>>("transactions", "*", [["id", true]]),
    fetchAll<Record<string, unknown>>("expenses", "*", [["id", true]]),
  ]);
  return { toys, toy_qualities, transactions, expenses };
}

/** The sample data in the database's row format. */
function seedRows(seed: ShopData): DataRows {
  return {
    toys: seed.toys.map((t) => ({
      id: t.id,
      name: t.name,
      sku: t.sku,
      manufacturer: t.manufacturer,
      category: t.category,
      images: t.images,
      reorder_level: t.reorderLevel,
      notes: t.notes,
      created_at: t.createdAt,
    })),
    toy_qualities: seed.toys.flatMap((t) =>
      t.qualities.map((q, position) => ({ toy_id: t.id, ...q, position })),
    ),
    transactions: seed.transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      toy_id: tx.toyId,
      toy_name: tx.toyName,
      quality: tx.quality,
      quantity: tx.quantity,
      unit_price: tx.unitPrice,
      delivery: tx.delivery ?? 0,
      amount: tx.amount,
      payment: tx.payment,
      note: tx.note,
      batch_id: tx.batchId ?? null,
    })),
    expenses: seed.expenses.map((e) => ({ ...e })),
  };
}

/**
 * Replaces every toy, transaction and expense with `rows`, in one step: if
 * anything is wrong, nothing changes. Only the admin may do this.
 * Returns an error message, or null.
 */
export async function replaceAllData(rows: DataRows, label: string): Promise<string | null> {
  const oldImages = data?.toys.flatMap((t) => t.images) ?? [];
  // Show the loading state while the database is rewritten.
  data = null;
  emit();
  await queue;
  const { error } = await getSupabase().rpc("admin_replace_data", { p_data: rows, p_label: label });
  if (!error) {
    // Pictures no longer used by any toy can go.
    const kept = new Set(rows.toys.flatMap((t) => (Array.isArray(t.images) ? (t.images as string[]) : [])));
    void removeImages(oldImages.filter((path) => !kept.has(path)));
  }
  await load();
  return error ? errorText(error.message) : null;
}

/** Replaces everything in the database with the sample data. */
export function loadSampleData() {
  return replaceAllData(seedRows(createSeed()), "Loaded the sample data");
}

/** Deletes every toy, transaction and expense, and all toy pictures. */
export function clearAllData() {
  return replaceAllData({ toys: [], toy_qualities: [], transactions: [], expenses: [] }, "Cleared all data");
}
