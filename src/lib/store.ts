"use client";

import { useSyncExternalStore } from "react";
import { createEmpty, createSeed } from "./seed";
import type { Expense, ShopData, Toy, Transaction } from "./types";

/**
 * All shop data lives in the browser's localStorage under this key.
 * Components read it with `useShop()` and change it through the action
 * functions below, which persist and notify every subscriber.
 */
const STORAGE_KEY = "toyshop:data:v1";

let state: ShopData | null = null;
const listeners = new Set<() => void>();

function isShopData(value: unknown): value is ShopData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.toys) &&
    Array.isArray(v.transactions) &&
    Array.isArray(v.expenses) &&
    !!v.settings &&
    typeof v.settings === "object"
  );
}

/** Earlier versions used different quality names; map them to the current grades. */
const LEGACY_QUALITY: Record<string, Toy["quality"]> = {
  Collector: "MISB",
  Premium: "MIB",
  Standard: "BIB",
  Budget: "Loose",
  "Pre-owned": "Loose",
};

function migrate(data: ShopData): ShopData {
  if (!data.toys.some((t) => (t.quality as string) in LEGACY_QUALITY)) return data;
  return {
    ...data,
    toys: data.toys.map((t) => ({ ...t, quality: LEGACY_QUALITY[t.quality as string] ?? t.quality })),
  };
}

function read(): ShopData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isShopData(parsed)) return migrate(parsed);
    }
  } catch {
    // Unreadable or blocked storage: fall through to sample data.
  }
  return createSeed();
}

function commit(next: ShopData) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Pick up changes made in another tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ShopData {
  if (!state) state = read();
  return state;
}

function getServerSnapshot(): ShopData | null {
  return null;
}

/** Returns null while prerendering / before hydration, then the stored data. */
export function useShop(): ShopData | null {
  return useSyncExternalStore<ShopData | null>(subscribe, getSnapshot, getServerSnapshot);
}

function newId(): string {
  return crypto.randomUUID();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Toys ----------

export type ToyInput = Omit<Toy, "id" | "createdAt">;

export function addToy(input: ToyInput, createdAt: string) {
  const s = getSnapshot();
  commit({ ...s, toys: [{ ...input, id: newId(), createdAt }, ...s.toys] });
}

export function updateToy(id: string, input: ToyInput) {
  const s = getSnapshot();
  commit({
    ...s,
    toys: s.toys.map((t) => (t.id === id ? { ...t, ...input } : t)),
    // Keep the name shown on past transactions in step with a rename.
    transactions: s.transactions.map((tx) =>
      tx.toyId === id ? { ...tx, toyName: input.name } : tx,
    ),
  });
}

export function deleteToy(id: string) {
  const s = getSnapshot();
  commit({ ...s, toys: s.toys.filter((t) => t.id !== id) });
}

// ---------- Transactions ----------

export type TransactionInput = Omit<Transaction, "id" | "toyName" | "amount">;

/** Stock change caused by a transaction: sales take stock out, refunds and restocks put it back. */
function stockDelta(type: Transaction["type"], quantity: number): number {
  return type === "sale" ? -quantity : quantity;
}

/** Records a transaction and adjusts the toy's stock. Returns an error message, or null on success. */
export function addTransaction(input: TransactionInput): string | null {
  const s = getSnapshot();
  const toy = s.toys.find((t) => t.id === input.toyId);
  if (!toy) return "Choose a toy for this transaction.";
  if (!(input.quantity > 0) || !Number.isInteger(input.quantity)) {
    return "Quantity must be a whole number above zero.";
  }
  if (input.unitPrice < 0 || Number.isNaN(input.unitPrice)) {
    return "Unit price can't be negative.";
  }
  if (input.type === "sale" && input.quantity > toy.stock) {
    return `Only ${toy.stock} of "${toy.name}" in stock.`;
  }
  const tx: Transaction = {
    ...input,
    id: newId(),
    toyName: toy.name,
    amount: round2(input.quantity * input.unitPrice),
  };
  commit({
    ...s,
    transactions: [tx, ...s.transactions],
    toys: s.toys.map((t) =>
      t.id === toy.id ? { ...t, stock: t.stock + stockDelta(input.type, input.quantity) } : t,
    ),
  });
  return null;
}

/** Removes a transaction and undoes its effect on stock (never below zero). */
export function deleteTransaction(id: string) {
  const s = getSnapshot();
  const tx = s.transactions.find((t) => t.id === id);
  if (!tx) return;
  commit({
    ...s,
    transactions: s.transactions.filter((t) => t.id !== id),
    toys: s.toys.map((t) =>
      t.id === tx.toyId
        ? { ...t, stock: Math.max(0, t.stock - stockDelta(tx.type, tx.quantity)) }
        : t,
    ),
  });
}

// ---------- Expenses ----------

export type ExpenseInput = Omit<Expense, "id">;

export function addExpense(input: ExpenseInput) {
  const s = getSnapshot();
  commit({ ...s, expenses: [{ ...input, id: newId() }, ...s.expenses] });
}

export function updateExpense(id: string, input: ExpenseInput) {
  const s = getSnapshot();
  commit({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...input, id } : e)) });
}

export function deleteExpense(id: string) {
  const s = getSnapshot();
  commit({ ...s, expenses: s.expenses.filter((e) => e.id !== id) });
}

// ---------- Settings & data management ----------

export function updateSettings(patch: Partial<ShopData["settings"]>) {
  const s = getSnapshot();
  commit({ ...s, settings: { ...s.settings, ...patch } });
}

export function loadSampleData() {
  const s = getSnapshot();
  commit({ ...createSeed(), settings: s.settings });
}

export function clearAllData() {
  const s = getSnapshot();
  commit({ ...createEmpty(), settings: s.settings });
}
