import { daysAgoISO } from "./format";
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

type ToySeed = [
  name: string,
  sku: string,
  category: Category,
  quality: Quality,
  emoji: string,
  price: number,
  cost: number,
  stock: number,
  reorderLevel: number,
  notes: string,
];

const TOYS: ToySeed[] = [
  ["Galaxy Ranger Figure", "AF-1001", "Action Figures", "MIB", "🦸", 24.99, 12.5, 18, 5, "12-inch, 20 points of articulation"],
  ["Mech Titan X", "AF-1002", "Action Figures", "MISB", "🤖", 89.0, 52.0, 3, 3, "Limited run, numbered box"],
  ["Cuddle Bear Benny", "DP-2001", "Dolls & Plush", "BIB", "🧸", 19.5, 8.0, 26, 8, "40 cm plush, washable"],
  ["Rainbow Unicorn Plush", "DP-2002", "Dolls & Plush", "MIB", "🦄", 27.0, 11.75, 0, 6, "Best seller, waiting on supplier"],
  ["Nesting Doll Set", "DP-2003", "Dolls & Plush", "MISB", "🪆", 64.0, 35.0, 4, 2, "Hand-painted, 7 pieces"],
  ["City Builder 500pc", "BS-3001", "Building Sets", "BIB", "🧱", 39.99, 21.0, 14, 5, "Compatible with major brick brands"],
  ["Space Station Mega Set", "BS-3002", "Building Sets", "MIB", "🚀", 119.0, 72.0, 5, 3, "1,800 pieces, ages 10+"],
  ["Family Quest Board Game", "GP-4001", "Games & Puzzles", "BIB", "🎲", 29.99, 14.0, 11, 4, "2–6 players"],
  ["World Map Puzzle 1000pc", "GP-4002", "Games & Puzzles", "Loose", "🧩", 12.5, 5.25, 22, 6, ""],
  ["Turbo Drift RC Car", "VR-5001", "Vehicles & RC", "MIB", "🚗", 54.0, 30.0, 7, 4, "2.4 GHz, rechargeable"],
  ["Classic Wooden Train", "VR-5002", "Vehicles & RC", "Loose", "🚂", 22.0, 6.0, 2, 2, "Minor paint wear, complete set"],
  ["Junior Microscope Kit", "ED-6001", "Educational", "BIB", "🔬", 34.5, 17.5, 9, 4, "Includes 12 prepared slides"],
  ["Starter Telescope", "ED-6002", "Educational", "MIB", "🔭", 74.0, 44.0, 4, 3, ""],
  ["Street Skateboard Mini", "OS-7001", "Outdoor & Sports", "Loose", "🛹", 18.0, 8.5, 15, 5, ""],
  ["Stunt Kite", "OS-7002", "Outdoor & Sports", "BIB", "🪁", 16.0, 6.75, 5, 5, "Dual-line"],
  ["Vintage Tin Robot", "CL-8001", "Collectibles", "MISB", "🤖", 145.0, 80.0, 1, 1, "1960s reproduction, wind-up"],
  ["Retro Yo-Yo", "CL-8002", "Collectibles", "Damaged", "🪀", 9.0, 2.5, 12, 4, ""],
  ["Dino Explorer T-Rex", "AF-1003", "Action Figures", "Loose", "🦖", 11.99, 4.75, 30, 10, "Roaring sound button"],
];

type TxSeed = [daysAgo: number, type: TransactionType, toyIndex: number, qty: number, payment: PaymentMethod, note: string];

const TRANSACTIONS: TxSeed[] = [
  [1, "sale", 0, 2, "Card", ""],
  [2, "sale", 2, 3, "Cash", ""],
  [3, "sale", 5, 1, "E-wallet", ""],
  [5, "restock", 17, 20, "Bank transfer", "Monthly supplier order"],
  [6, "sale", 9, 1, "Card", ""],
  [8, "refund", 7, 1, "Card", "Missing pieces"],
  [9, "sale", 7, 2, "Card", ""],
  [12, "sale", 15, 1, "Bank transfer", "Collector pickup"],
  [14, "sale", 3, 4, "Cash", "Sold out"],
  [18, "sale", 11, 2, "E-wallet", ""],
  [21, "restock", 2, 24, "Bank transfer", ""],
  [25, "sale", 6, 1, "Card", ""],
  [33, "sale", 17, 6, "Cash", "Birthday party order"],
  [36, "sale", 1, 1, "Card", ""],
  [40, "restock", 5, 12, "Bank transfer", ""],
  [44, "sale", 8, 5, "Cash", ""],
  [47, "sale", 13, 3, "E-wallet", ""],
  [52, "sale", 12, 1, "Card", ""],
  [58, "refund", 9, 1, "Card", "Faulty remote"],
  [63, "sale", 4, 1, "Card", ""],
  [67, "sale", 0, 3, "Cash", ""],
  [71, "restock", 9, 6, "Bank transfer", ""],
  [78, "sale", 5, 2, "Card", ""],
  [84, "sale", 16, 4, "Cash", ""],
  [92, "sale", 6, 2, "Card", "Holiday gift"],
  [96, "sale", 2, 5, "E-wallet", ""],
  [101, "restock", 0, 15, "Bank transfer", ""],
  [110, "sale", 10, 1, "Cash", ""],
  [118, "sale", 14, 3, "Cash", ""],
  [126, "sale", 7, 3, "Card", ""],
  [133, "restock", 8, 20, "Bank transfer", ""],
  [140, "sale", 11, 1, "Card", ""],
  [147, "sale", 17, 8, "Cash", "School fair"],
];

type ExpenseSeed = [daysAgo: number, category: ExpenseCategory, vendor: string, description: string, amount: number];

const EXPENSES: ExpenseSeed[] = [
  [2, "Marketing", "Local Gazette", "Weekend flyer insert", 85],
  [4, "Supplies", "PackRight", "Gift wrap and bags", 46.2],
  [7, "Utilities", "City Power", "Electricity", 132.4],
  [10, "Rent", "Maple Street Properties", "Shop rent", 950],
  [15, "Wages", "Part-time staff", "Weekend help", 420],
  [22, "Shipping", "QuickShip", "Online order postage", 58.75],
  [35, "Utilities", "City Power", "Electricity", 127.1],
  [40, "Rent", "Maple Street Properties", "Shop rent", 950],
  [45, "Wages", "Part-time staff", "Weekend help", 420],
  [50, "Maintenance", "FixIt Bros", "Display shelf repair", 110],
  [66, "Utilities", "City Power", "Electricity", 141.9],
  [70, "Rent", "Maple Street Properties", "Shop rent", 950],
  [75, "Wages", "Part-time staff", "Holiday season help", 610],
  [80, "Marketing", "SocialBoost", "Holiday ad campaign", 200],
  [100, "Rent", "Maple Street Properties", "Shop rent", 950],
  [104, "Wages", "Part-time staff", "Weekend help", 420],
  [108, "Supplies", "PackRight", "Price tags and tape", 31.5],
  [130, "Rent", "Maple Street Properties", "Shop rent", 950],
  [135, "Wages", "Part-time staff", "Weekend help", 420],
  [138, "Other", "City Hall", "Business permit renewal", 75],
];

/** Sample data so the app has something to show on first run. */
export function createSeed(): ShopData {
  const toys: Toy[] = TOYS.map(
    ([name, sku, category, quality, emoji, price, cost, stock, reorderLevel, notes], i) => ({
      id: `seed-toy-${i}`,
      name,
      sku,
      category,
      quality,
      emoji,
      price,
      cost,
      stock,
      reorderLevel,
      notes,
      createdAt: daysAgoISO(160 - i * 6),
    }),
  );

  const transactions: Transaction[] = TRANSACTIONS.map(
    ([daysAgo, type, toyIndex, quantity, payment, note], i) => {
      const toy = toys[toyIndex];
      const unitPrice = type === "restock" ? toy.cost : toy.price;
      return {
        id: `seed-tx-${i}`,
        date: daysAgoISO(daysAgo),
        type,
        toyId: toy.id,
        toyName: toy.name,
        quantity,
        unitPrice,
        amount: Math.round(unitPrice * quantity * 100) / 100,
        payment,
        note,
      };
    },
  );

  const expenses: Expense[] = EXPENSES.map(
    ([daysAgo, category, vendor, description, amount], i) => ({
      id: `seed-exp-${i}`,
      date: daysAgoISO(daysAgo),
      category,
      vendor,
      description,
      amount,
    }),
  );

  return {
    toys,
    transactions,
    expenses,
    settings: { currency: "USD", inventoryView: "gallery" },
  };
}

export function createEmpty(): ShopData {
  return {
    toys: [],
    transactions: [],
    expenses: [],
    settings: { currency: "USD", inventoryView: "gallery" },
  };
}
