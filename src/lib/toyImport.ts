import { parseCsv, toCsv } from "./csv";
import { CATEGORIES, QUALITIES, type Category, type Quality, type QualityStock, type Toy } from "./types";

/** The most toys one import can add or change, matching the database's limit. */
export const MAX_IMPORT_TOYS = 500;

/** Each row of the file is one quality of one toy; rows of the same toy are grouped. */
export const IMPORT_COLUMNS = [
  "name",
  "sku",
  "manufacturer",
  "category",
  "reorder_level",
  "notes",
  "quality",
  "price",
  "cost",
  "stock",
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];

/** Other ways a heading may be written, after lowercasing and turning spaces into underscores. */
const ALIASES: Record<string, Column> = {
  toy: "name",
  toy_name: "name",
  product: "name",
  brand: "manufacturer",
  maker: "manufacturer",
  reorder: "reorder_level",
  reorder_at: "reorder_level",
  low_stock_level: "reorder_level",
  note: "notes",
  condition: "quality",
  selling_price: "price",
  unit_price: "price",
  unit_cost: "cost",
  quantity: "stock",
  qty: "stock",
  in_stock: "stock",
};

export type ImportDefaults = { reorderLevel: number; quality: Quality };

export type ImportedToy = {
  name: string;
  sku: string;
  manufacturer: string;
  category: Category;
  reorderLevel: number;
  notes: string;
  qualities: QualityStock[];
  /** The file's line numbers this toy came from, for messages. */
  lines: number[];
};

export type ImportProblem = { line: number; message: string };

/** A toy in the file that matches one already in the inventory. */
export type ImportDuplicate = { imported: ImportedToy; existing: Toy; matchedBy: "sku" | "name" };

export type ImportAnalysis = {
  /** Toys in the file that aren't in the inventory yet. */
  fresh: ImportedToy[];
  duplicates: ImportDuplicate[];
  problems: ImportProblem[];
  /** Set when the file can't be used at all (empty, or a needed column is missing). */
  fileError: string | null;
  rowCount: number;
};

const key = (s: string) => s.trim().toLowerCase();

function headingToColumn(heading: string): Column | null {
  const k = heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if ((IMPORT_COLUMNS as readonly string[]).includes(k)) return k as Column;
  return ALIASES[k] ?? null;
}

/** Reads a price, cost or stock cell: allows a currency sign and thousands separators. */
function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/^[^\d.\-]+/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads and checks a CSV file against the current inventory. Nothing is changed.
 * A toy with any problem row is left out entirely, so a half-read toy is never saved.
 */
export function analyseToyCsv(text: string, toys: Toy[], defaults: ImportDefaults): ImportAnalysis {
  const empty = (fileError: string | null, rowCount = 0): ImportAnalysis => ({
    fresh: [],
    duplicates: [],
    problems: [],
    fileError,
    rowCount,
  });

  const rows = parseCsv(text);
  if (rows.length === 0) return empty("The file is empty.");

  const columns = rows[0].map(headingToColumn);
  const at = (c: Column) => columns.indexOf(c);
  if (at("name") < 0) return empty('The first row must be headings, and one of them must be "name".');
  if (at("price") < 0) return empty('The file needs a "price" column.');
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) return empty("The file has headings but no toys.");

  const cell = (row: string[], c: Column) => (at(c) >= 0 ? (row[at(c)] ?? "").trim() : "");

  const problems: ImportProblem[] = [];
  type Group = { toy: ImportedToy; bad: boolean; seen: Set<Quality> };
  const groups = new Map<string, Group>();

  dataRows.forEach((row, i) => {
    const line = i + 2; // Line 1 is the headings.
    const problem = (message: string) => problems.push({ line, message });
    const name = cell(row, "name");
    if (!name) return problem("The toy has no name.");

    const rawCategory = cell(row, "category");
    const category = rawCategory ? CATEGORIES.find((c) => key(c) === key(rawCategory)) : CATEGORIES[0];
    const rawQuality = cell(row, "quality");
    const quality = rawQuality ? QUALITIES.find((q) => key(q) === key(rawQuality)) : defaults.quality;
    const price = toNumber(cell(row, "price"));
    const costCell = cell(row, "cost");
    const cost = costCell === "" ? 0 : toNumber(costCell);
    const stockCell = cell(row, "stock");
    const stock = stockCell === "" ? 0 : toNumber(stockCell);
    const reorderCell = cell(row, "reorder_level");
    const reorder = reorderCell === "" ? defaults.reorderLevel : toNumber(reorderCell);

    const errors: string[] = [];
    if (!category) errors.push(`category "${rawCategory}" isn't one of ${CATEGORIES.join(", ")}`);
    if (!quality) errors.push(`quality "${rawQuality}" isn't one of ${QUALITIES.join(", ")}`);
    if (price === null || price < 0) errors.push("price must be a number, zero or more");
    if (cost === null || cost < 0) errors.push("cost must be a number, zero or more");
    if (stock === null || stock < 0 || !Number.isInteger(stock)) errors.push("stock must be a whole number, zero or more");
    if (reorder === null || reorder < 0 || !Number.isInteger(reorder)) {
      errors.push("reorder_level must be a whole number, zero or more");
    }

    const sku = cell(row, "sku");
    const groupKey = `${key(sku)}\u0000${key(name)}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        toy: {
          name,
          sku,
          manufacturer: cell(row, "manufacturer"),
          category: category ?? CATEGORIES[0],
          reorderLevel: reorder ?? defaults.reorderLevel,
          notes: cell(row, "notes"),
          qualities: [],
          lines: [],
        },
        bad: false,
        seen: new Set(),
      };
      groups.set(groupKey, group);
    }
    group.toy.lines.push(line);

    if (errors.length > 0) {
      group.bad = true;
      return problem(`${name}: ${errors.join("; ")}.`);
    }
    // Details come from the toy's first row; later rows can fill in what was left blank.
    const t = group.toy;
    if (!t.manufacturer) t.manufacturer = cell(row, "manufacturer");
    if (!t.notes) t.notes = cell(row, "notes");

    if (group.seen.has(quality!)) {
      group.bad = true;
      return problem(`${name}: ${quality} is listed twice. Put each quality on one row.`);
    }
    group.seen.add(quality!);
    t.qualities.push({ quality: quality!, price: price!, cost: cost!, stock: stock! });
  });

  // The same SKU on two different toys in the file is ambiguous: leave both out.
  const bySku = new Map<string, Group[]>();
  for (const g of groups.values()) {
    if (!g.toy.sku) continue;
    bySku.set(key(g.toy.sku), [...(bySku.get(key(g.toy.sku)) ?? []), g]);
  }
  for (const [sku, list] of bySku) {
    if (list.length < 2) continue;
    for (const g of list) {
      if (!g.bad) problems.push({ line: g.toy.lines[0], message: `${g.toy.name}: the SKU "${sku}" is used by more than one toy in the file.` });
      g.bad = true;
    }
  }

  const good = [...groups.values()].filter((g) => !g.bad).map((g) => g.toy);
  if (good.length > MAX_IMPORT_TOYS) {
    return empty(`The file has ${good.length} toys. Import at most ${MAX_IMPORT_TOYS} at a time.`, dataRows.length);
  }

  const fresh: ImportedToy[] = [];
  const duplicates: ImportDuplicate[] = [];
  for (const imported of good) {
    const bySkuMatch = imported.sku ? toys.find((t) => t.sku && key(t.sku) === key(imported.sku)) : undefined;
    const byNameMatch = !imported.sku ? toys.find((t) => key(t.name) === key(imported.name)) : undefined;
    if (bySkuMatch) duplicates.push({ imported, existing: bySkuMatch, matchedBy: "sku" });
    else if (byNameMatch) duplicates.push({ imported, existing: byNameMatch, matchedBy: "name" });
    else fresh.push(imported);
  }

  problems.sort((a, b) => a.line - b.line);
  return { fresh, duplicates, problems, fileError: null, rowCount: dataRows.length };
}

/** What the database import function is sent. */
export function importPayload(fresh: ImportedToy[], updates: ImportDuplicate[]) {
  const body = (t: ImportedToy) => ({
    name: t.name,
    sku: t.sku,
    manufacturer: t.manufacturer,
    category: t.category,
    reorder_level: t.reorderLevel,
    notes: t.notes,
    qualities: t.qualities,
  });
  return [
    ...fresh.map((t) => ({ action: "create", ...body(t) })),
    ...updates.map((d) => ({ action: "update", id: d.existing.id, ...body(d.imported) })),
  ];
}

/** A sample file for people to start from: three toys, one with two qualities and a note with a comma. */
export function sampleImportCsv(): string {
  return (
    "﻿" +
    toCsv([
      [...IMPORT_COLUMNS],
      ["Dino Explorer T-Rex", "DNO-001", "PlayCo", "Figures", "5", "Poseable, with a roar button", "MIB", "24.99", "12.50", "10"],
      ["Dino Explorer T-Rex", "DNO-001", "PlayCo", "Figures", "5", "", "Loose", "14.99", "7", "30"],
      ["Cuddle Bear Benny", "PLU-014", "SoftToys Ltd", "Plush", "8", "", "MISB", "19.5", "9", "12"],
      ["Snap-Fit Robot Kit", "KIT-203", "BuildIt", "Model Kits", "", "Needs glue-free snap parts", "", "32", "16", "6"],
    ])
  );
}

export const SAMPLE_IMPORT_FILENAME = "sidequest-toy-import-sample.csv";
