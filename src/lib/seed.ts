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

type QualitySeed = [quality: Quality, price: number, cost: number, stock: number];

type ToySeed = [
  name: string,
  sku: string,
  manufacturer: string,
  category: Category,
  reorderLevel: number,
  notes: string,
  qualities: QualitySeed[],
];

const TOYS: ToySeed[] = [
  ["Galaxy Ranger Figure", "FG-1001", "Starforge Toys", "Figures", 5, "12-inch, 20 points of articulation", [["MIB", 24.99, 12.5, 18], ["Loose", 14.99, 7.5, 9]]],
  ["Mech Titan X", "FG-1002", "Starforge Toys", "Figures", 3, "Limited run, numbered box", [["MISB", 89.0, 52.0, 3], ["MIB", 64.0, 40.0, 2]]],
  ["Cuddle Bear Benny", "PL-2001", "Cozy Cloud", "Plush", 8, "40 cm plush, washable", [["BIB", 19.5, 8.0, 26]]],
  ["Rainbow Unicorn Plush", "PL-2002", "Cozy Cloud", "Plush", 6, "Best seller, waiting on supplier", [["MIB", 27.0, 11.75, 0], ["Loose", 17.0, 8.0, 0]]],
  ["Nesting Doll Set", "CL-8003", "Matryoshka Works", "Collectibles", 2, "Hand-painted, 7 pieces", [["MISB", 64.0, 35.0, 4]]],
  ["City Skyline Diorama Kit", "MK-3001", "BrickLane Models", "Model Kits", 5, "Snap-fit, no glue needed", [["BIB", 39.99, 21.0, 14]]],
  ["Space Station Model Kit", "MK-3002", "Orbit Hobby", "Model Kits", 3, "1:200 scale, 1,800 pieces", [["MIB", 119.0, 72.0, 5], ["MISB", 149.0, 95.0, 2]]],
  ["Samurai Armor Model Kit", "MK-3003", "Kabuto Craft", "Model Kits", 4, "Paintable, display stand included", [["BIB", 29.99, 14.0, 11]]],
  ["Snap-Fit Robot Kit", "MK-3004", "Orbit Hobby", "Model Kits", 6, "", [["Loose", 12.5, 5.25, 22]]],
  ["Turbo Racer Model Kit", "MK-3005", "Apex Scale Models", "Model Kits", 4, "1:24 scale, decals included", [["MIB", 54.0, 30.0, 7], ["Damaged", 24.0, 10.0, 1]]],
  ["Vintage Plush Rabbit", "PL-2003", "Cozy Cloud", "Plush", 2, "Minor wear, complete", [["Loose", 22.0, 6.0, 2]]],
  ["Dragon Hatchling Plush", "PL-2004", "Wyrmling Plush Co.", "Plush", 4, "Posable wings", [["BIB", 34.5, 17.5, 9]]],
  ["Starship Fleet Figure Set", "FG-1003", "Starforge Toys", "Figures", 3, "", [["MIB", 74.0, 44.0, 4]]],
  ["Pocket Heroes 6-Pack", "FG-1004", "Pocket Studio", "Figures", 5, "", [["Loose", 18.0, 8.5, 15]]],
  ["Pocket Ninja Figure", "FG-1005", "Pocket Studio", "Figures", 5, "Includes two weapons", [["BIB", 16.0, 6.75, 5]]],
  ["Vintage Tin Robot", "CL-8001", "Tinplate Heritage", "Collectibles", 1, "1960s reproduction, wind-up", [["MISB", 145.0, 80.0, 1], ["Damaged", 60.0, 30.0, 0]]],
  ["Retro Yo-Yo", "CL-8002", "Retro Spin Co.", "Collectibles", 4, "", [["Damaged", 9.0, 2.5, 12], ["Loose", 14.0, 5.0, 6]]],
  ["Dino Explorer T-Rex", "FG-1006", "Dino Works", "Figures", 10, "Roaring sound button", [["Loose", 11.99, 4.75, 30], ["MIB", 19.99, 9.0, 10]]],
];

/** qualityIndex picks which of the toy's qualities (in the order listed above) the transaction is for. */
type TxSeed = [daysAgo: number, type: TransactionType, toyIndex: number, qualityIndex: number, qty: number, payment: PaymentMethod, note: string];

const TRANSACTIONS: TxSeed[] = [
  [1, "sale", 0, 0, 2, "Card", ""],
  [2, "sale", 2, 0, 3, "Cash", ""],
  [3, "sale", 5, 0, 1, "E-wallet", ""],
  [5, "restock", 17, 0, 20, "Bank transfer", "Monthly supplier order"],
  [6, "sale", 9, 0, 1, "Card", ""],
  [8, "refund", 7, 0, 1, "Card", "Missing parts"],
  [9, "sale", 7, 0, 2, "Card", ""],
  [12, "sale", 15, 0, 1, "Bank transfer", "Collector pickup"],
  [14, "sale", 3, 0, 4, "Cash", "Sold out"],
  [18, "sale", 11, 0, 2, "E-wallet", ""],
  [21, "restock", 2, 0, 24, "Bank transfer", ""],
  [25, "sale", 6, 1, 1, "Card", ""],
  [33, "sale", 17, 0, 6, "Cash", "Birthday party order"],
  [36, "sale", 1, 0, 1, "Card", ""],
  [40, "restock", 5, 0, 12, "Bank transfer", ""],
  [44, "sale", 8, 0, 5, "Cash", ""],
  [47, "sale", 13, 0, 3, "E-wallet", ""],
  [52, "sale", 12, 0, 1, "Card", ""],
  [58, "refund", 9, 0, 1, "Card", "Warped parts"],
  [63, "sale", 4, 0, 1, "Card", ""],
  [67, "sale", 0, 1, 3, "Cash", ""],
  [71, "restock", 9, 0, 6, "Bank transfer", ""],
  [78, "sale", 5, 0, 2, "Card", ""],
  [84, "sale", 16, 0, 4, "Cash", ""],
  [92, "sale", 6, 0, 2, "Card", "Holiday gift"],
  [96, "sale", 2, 0, 5, "E-wallet", ""],
  [101, "restock", 0, 0, 15, "Bank transfer", ""],
  [110, "sale", 10, 0, 1, "Cash", ""],
  [118, "sale", 14, 0, 3, "Cash", ""],
  [126, "sale", 7, 0, 3, "Card", ""],
  [133, "restock", 8, 0, 20, "Bank transfer", ""],
  [140, "sale", 11, 0, 1, "Card", ""],
  [147, "sale", 17, 1, 8, "Cash", "School fair"],
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

/** Sample data, loaded into the database from the sidebar's "Load sample data". */
export function createSeed(): ShopData {
  const toys: Toy[] = TOYS.map(
    ([name, sku, manufacturer, category, reorderLevel, notes, qualities], i) => ({
      id: crypto.randomUUID(),
      name,
      sku,
      manufacturer,
      category,
      images: [],
      qualities: qualities.map(([quality, price, cost, stock]) => ({ quality, price, cost, stock })),
      reorderLevel,
      notes,
      createdAt: daysAgoISO(160 - i * 6),
    }),
  );

  const transactions: Transaction[] = TRANSACTIONS.map(
    ([daysAgo, type, toyIndex, qualityIndex, quantity, payment, note]) => {
      const toy = toys[toyIndex];
      const variant = toy.qualities[qualityIndex];
      const unitPrice = type === "restock" ? variant.cost : variant.price;
      return {
        id: crypto.randomUUID(),
        date: daysAgoISO(daysAgo),
        type,
        toyId: toy.id,
        toyName: toy.name,
        quality: variant.quality,
        quantity,
        unitPrice,
        amount: Math.round(unitPrice * quantity * 100) / 100,
        payment,
        note,
        recordedBy: "Sample data",
      };
    },
  );

  const expenses: Expense[] = EXPENSES.map(
    ([daysAgo, category, vendor, description, amount]) => ({
      id: crypto.randomUUID(),
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
