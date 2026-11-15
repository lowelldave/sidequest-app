"use client";

import { useState, type FormEvent } from "react";
import { money, todayISO } from "@/lib/format";
import { addToy, deleteToy, updateSettings, updateToy, useShop, type ToyInput } from "@/lib/store";
import {
  CATEGORIES,
  CATEGORY_EMOJI,
  QUALITIES,
  TOY_EMOJIS,
  stockStatus,
  type Category,
  type Quality,
  type ShopData,
  type StockStatus,
  type Toy,
} from "@/lib/types";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  FormError,
  Loading,
  Modal,
  PageHeader,
  inputCls,
} from "./ui";

const QUALITY_TONE: Record<Quality, "violet" | "blue" | "green" | "amber" | "red"> = {
  MISB: "violet",
  MIB: "blue",
  BIB: "green",
  Loose: "amber",
  Damaged: "red",
};

const CATEGORY_TILE: Record<Category, string> = {
  "Action Figures": "bg-red-100 dark:bg-red-950/60",
  "Dolls & Plush": "bg-pink-100 dark:bg-pink-950/60",
  "Building Sets": "bg-amber-100 dark:bg-amber-950/60",
  "Games & Puzzles": "bg-violet-100 dark:bg-violet-950/60",
  "Vehicles & RC": "bg-sky-100 dark:bg-sky-950/60",
  Educational: "bg-teal-100 dark:bg-teal-950/60",
  "Outdoor & Sports": "bg-lime-100 dark:bg-lime-950/60",
  Collectibles: "bg-yellow-100 dark:bg-yellow-950/60",
};

const SORTS = {
  name: "Name (A–Z)",
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "stock-asc": "Stock: low to high",
  "stock-desc": "Stock: high to low",
} as const;
type Sort = keyof typeof SORTS;

const SORTERS: Record<Sort, (a: Toy, b: Toy) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  "stock-asc": (a, b) => a.stock - b.stock,
  "stock-desc": (a, b) => b.stock - a.stock,
};

function StockBadge({ toy }: { toy: Toy }) {
  const status = stockStatus(toy);
  if (status === "out") return <Badge tone="red">Out of stock</Badge>;
  if (status === "low") return <Badge tone="amber">Low · {toy.stock}</Badge>;
  return <Badge tone="green">In stock · {toy.stock}</Badge>;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Inventory() {
  const data = useShop();
  if (!data) return <Loading />;
  return <InventoryView data={data} />;
}

function InventoryView({ data }: { data: ShopData }) {
  const { currency, inventoryView: view } = data.settings;
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [stock, setStock] = useState<StockStatus | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  // `null` = closed, "new" = adding, otherwise the toy being edited
  const [editing, setEditing] = useState<Toy | "new" | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = data.toys
    .filter(
      (t) =>
        (!q || `${t.name} ${t.sku} ${t.notes}`.toLowerCase().includes(q)) &&
        (categories.length === 0 || categories.includes(t.category)) &&
        (qualities.length === 0 || qualities.includes(t.quality)) &&
        (stock === "all" || stockStatus(t) === stock) &&
        (minPrice === "" || t.price >= Number(minPrice)) &&
        (maxPrice === "" || t.price <= Number(maxPrice)),
    )
    .sort(SORTERS[sort]);

  const filtersActive =
    q !== "" ||
    categories.length > 0 ||
    qualities.length > 0 ||
    stock !== "all" ||
    minPrice !== "" ||
    maxPrice !== "";

  function resetFilters() {
    setQuery("");
    setCategories([]);
    setQualities([]);
    setStock("all");
    setMinPrice("");
    setMaxPrice("");
  }

  function remove(toy: Toy) {
    if (confirm(`Delete "${toy.name}" from inventory? Past transactions are kept.`)) {
      deleteToy(toy.id);
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every toy in the shop, by category and quality."
        action={
          <Button variant="primary" onClick={() => setEditing("new")}>
            + Add toy
          </Button>
        }
      />

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Search" className="col-span-2">
            <input
              type="search"
              className={inputCls}
              placeholder="Name, SKU or notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Stock">
            <select
              className={inputCls}
              value={stock}
              onChange={(e) => setStock(e.target.value as StockStatus | "all")}
            >
              <option value="all">Any</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </Field>
          <Field label="Min price">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={inputCls}
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </Field>
          <Field label="Max price">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={inputCls}
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </Field>
          <Field label="Sort by">
            <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={categories.includes(c)}
                onClick={() => setCategories(toggle(categories, c))}
              >
                <span aria-hidden="true">{CATEGORY_EMOJI[c]} </span>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">Quality</p>
          <div className="flex flex-wrap gap-2">
            {QUALITIES.map((qual) => (
              <Chip
                key={qual}
                active={qualities.includes(qual)}
                onClick={() => setQualities(toggle(qualities, qual))}
              >
                {qual}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          Showing {filtered.length} of {data.toys.length} toys
          {filtersActive && (
            <>
              {" · "}
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={resetFilters}
              >
                Clear filters
              </button>
            </>
          )}
        </p>
        <div className="flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="View">
          {(["gallery", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => updateSettings({ inventoryView: v })}
              className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors ${
                view === v ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground"
              }`}
            >
              {v === "gallery" ? "▦ Gallery" : "☰ List"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        data.toys.length === 0 ? (
          <EmptyState title="No toys yet" hint="Add your first toy to start tracking stock." />
        ) : (
          <EmptyState title="No toys match these filters" hint="Try loosening or clearing the filters." />
        )
      ) : view === "gallery" ? (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <li
              key={t.id}
              className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div
                className={`flex aspect-[4/3] items-center justify-center text-6xl ${CATEGORY_TILE[t.category]}`}
                aria-hidden="true"
              >
                {t.emoji}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="font-medium leading-snug">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.category} · {t.sku}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={QUALITY_TONE[t.quality]}>{t.quality}</Badge>
                  <StockBadge toy={t} />
                </div>
                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                  <p className="text-lg font-semibold tabular-nums">{money(t.price, currency)}</p>
                  <div className="flex">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                    <Button variant="danger" className="h-8 px-2" onClick={() => remove(t)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Toy</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Stock value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg ${CATEGORY_TILE[t.category]}`}
                        aria-hidden="true"
                      >
                        {t.emoji}
                      </span>
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted">{t.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3">
                    <Badge tone={QUALITY_TONE[t.quality]}>{t.quality}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(t.price, currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {money(t.cost, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge toy={t} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(t.stock * t.price, currency)}
                  </td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                    <Button variant="danger" className="h-8 px-2" onClick={() => remove(t)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ToyForm toy={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function ToyForm({ toy, onClose }: { toy: Toy | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const num = (key: string) => Number(fd.get(key));
    const input: ToyInput = {
      name: text("name"),
      sku: text("sku"),
      category: text("category") as Category,
      quality: text("quality") as Quality,
      emoji: text("emoji"),
      price: num("price"),
      cost: num("cost"),
      stock: num("stock"),
      reorderLevel: num("reorderLevel"),
      notes: text("notes"),
    };
    if (!input.name) return setError("Give the toy a name.");
    if ([input.price, input.cost, input.stock, input.reorderLevel].some((n) => Number.isNaN(n) || n < 0)) {
      return setError("Price, cost and stock must be zero or more.");
    }
    if (!Number.isInteger(input.stock) || !Number.isInteger(input.reorderLevel)) {
      return setError("Stock and low-stock level must be whole numbers.");
    }
    if (toy) updateToy(toy.id, input);
    else addToy(input, todayISO());
    onClose();
  }

  return (
    <Modal title={toy ? "Edit toy" : "Add toy"} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <input name="name" className={inputCls} defaultValue={toy?.name} autoFocus required />
        </Field>
        <Field label="Category">
          <select name="category" className={inputCls} defaultValue={toy?.category ?? CATEGORIES[0]}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Quality">
          <select name="quality" className={inputCls} defaultValue={toy?.quality ?? "MIB"}>
            {QUALITIES.map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </Field>
        <Field label="SKU">
          <input name="sku" className={inputCls} defaultValue={toy?.sku} placeholder="Optional" />
        </Field>
        <Field label="Picture">
          <select name="emoji" className={inputCls} defaultValue={toy?.emoji ?? TOY_EMOJIS[0]}>
            {TOY_EMOJIS.map((em) => (
              <option key={em}>{em}</option>
            ))}
          </select>
        </Field>
        <Field label="Selling price">
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            defaultValue={toy?.price}
            required
          />
        </Field>
        <Field label="Unit cost">
          <input
            name="cost"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            defaultValue={toy?.cost ?? 0}
            required
          />
        </Field>
        <Field label="Stock on hand">
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={inputCls}
            defaultValue={toy?.stock ?? 0}
            required
          />
        </Field>
        <Field label="Low-stock level">
          <input
            name="reorderLevel"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={inputCls}
            defaultValue={toy?.reorderLevel ?? 5}
            required
          />
        </Field>
        <Field label="Notes" className="col-span-2">
          <textarea
            name="notes"
            rows={2}
            className={`${inputCls} h-auto py-2`}
            defaultValue={toy?.notes}
          />
        </Field>
        <div className="col-span-2">
          <FormError message={error} />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            {toy ? "Save changes" : "Add toy"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
