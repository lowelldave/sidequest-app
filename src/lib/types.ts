export const CATEGORIES = ["Figures", "Plush", "Model Kits", "Collectibles"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Collector-style condition grades:
 * MISB = mint in sealed box, MIB = mint in box, BIB = boxed (used),
 * Loose = no box, Damaged = broken or heavily worn.
 */
export const QUALITIES = ["MISB", "MIB", "BIB", "Loose", "Damaged"] as const;
export type Quality = (typeof QUALITIES)[number];

export const CATEGORY_EMOJI: Record<Category, string> = {
  Figures: "🦸",
  Plush: "🧸",
  "Model Kits": "🛠️",
  Collectibles: "🏆",
};

/** One quality grade of a toy, with its own price and stock. */
export interface QualityStock {
  quality: Quality;
  /** Selling price per unit */
  price: number;
  /** What the shop pays per unit */
  cost: number;
  stock: number;
}

export interface Toy {
  id: string;
  name: string;
  sku: string;
  manufacturer: string;
  category: Category;
  /** Ids of the toy's pictures, first one is the cover. The files are stored by lib/images.ts. */
  images: string[];
  /** The qualities this toy comes in (at least one, no repeats), each with its own stock. */
  qualities: QualityStock[];
  /** Total stock at or below this level counts as "low" */
  reorderLevel: number;
  notes: string;
  createdAt: string;
}

export const TRANSACTION_TYPES = ["sale", "refund", "restock"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_LABEL: Record<TransactionType, string> = {
  sale: "Sale",
  refund: "Refund",
  restock: "Restock",
};

export const PAYMENT_METHODS = ["Cash", "Card", "E-wallet", "Bank transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Transaction {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: TransactionType;
  toyId: string;
  /** Kept so the record still reads well if the toy is later deleted */
  toyName: string;
  /** Which quality of the toy this transaction was for */
  quality: Quality;
  quantity: number;
  unitPrice: number;
  /** quantity × unitPrice, always positive */
  amount: number;
  payment: PaymentMethod;
  note: string;
}

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Wages",
  "Marketing",
  "Shipping",
  "Supplies",
  "Maintenance",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface ShopData {
  toys: Toy[];
  transactions: Transaction[];
  expenses: Expense[];
  settings: {
    currency: Currency;
    inventoryView: "list" | "gallery";
  };
}

export type StockStatus = "in" | "low" | "out";

export function totalStock(toy: Toy): number {
  return toy.qualities.reduce((sum, q) => sum + q.stock, 0);
}

/** Stock status of the toy as a whole, across all its qualities. */
export function stockStatus(toy: Toy): StockStatus {
  const total = totalStock(toy);
  if (total <= 0) return "out";
  if (total <= toy.reorderLevel) return "low";
  return "in";
}

/** Lowest and highest selling price across a toy's qualities. */
export function priceRange(toy: Toy): [min: number, max: number] {
  const prices = toy.qualities.map((q) => q.price);
  return [Math.min(...prices), Math.max(...prices)];
}

export function retailValue(toy: Toy): number {
  return toy.qualities.reduce((sum, q) => sum + q.stock * q.price, 0);
}

export function costValue(toy: Toy): number {
  return toy.qualities.reduce((sum, q) => sum + q.stock * q.cost, 0);
}

/** Money effect of a transaction: sales bring money in, refunds and restocks send it out. */
export function signedAmount(t: Transaction): number {
  return t.type === "sale" ? t.amount : -t.amount;
}
