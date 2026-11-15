export const CATEGORIES = [
  "Action Figures",
  "Dolls & Plush",
  "Building Sets",
  "Games & Puzzles",
  "Vehicles & RC",
  "Educational",
  "Outdoor & Sports",
  "Collectibles",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Collector-style condition grades:
 * MISB = mint in sealed box, MIB = mint in box, BIB = boxed (used),
 * Loose = no box, Damaged = broken or heavily worn.
 */
export const QUALITIES = ["MISB", "MIB", "BIB", "Loose", "Damaged"] as const;
export type Quality = (typeof QUALITIES)[number];

export const CATEGORY_EMOJI: Record<Category, string> = {
  "Action Figures": "🦸",
  "Dolls & Plush": "🧸",
  "Building Sets": "🧱",
  "Games & Puzzles": "🎲",
  "Vehicles & RC": "🚗",
  Educational: "🔬",
  "Outdoor & Sports": "⚽",
  Collectibles: "🏆",
};

export const TOY_EMOJIS = [
  "🧸", "🦸", "🤖", "🧱", "🎲", "🧩", "🚗", "🚂", "🚀", "✈️", "🚁", "🦖",
  "🦄", "🪀", "🪁", "⚽", "🏀", "🛹", "🎨", "🔬", "🔭", "🎸", "🏆", "🪆",
];

export interface Toy {
  id: string;
  name: string;
  sku: string;
  category: Category;
  quality: Quality;
  emoji: string;
  /** Selling price per unit */
  price: number;
  /** What the shop pays per unit */
  cost: number;
  stock: number;
  /** Stock at or below this level counts as "low" */
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

export function stockStatus(toy: Toy): StockStatus {
  if (toy.stock <= 0) return "out";
  if (toy.stock <= toy.reorderLevel) return "low";
  return "in";
}

/** Money effect of a transaction: sales bring money in, refunds and restocks send it out. */
export function signedAmount(t: Transaction): number {
  return t.type === "sale" ? t.amount : -t.amount;
}
