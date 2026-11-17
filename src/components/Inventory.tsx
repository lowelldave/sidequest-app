"use client";

import { useCan } from "@/lib/account";
import { useState } from "react";
import { money } from "@/lib/format";
import { setInventoryView, useShop } from "@/lib/store";
import {
  CATEGORIES,
  CATEGORY_EMOJI,
  QUALITIES,
  priceRange,
  retailValue,
  stockStatus,
  totalStock,
  type Category,
  type Quality,
  type ShopData,
  type StockStatus,
  type Toy,
} from "@/lib/types";
import { ToyCover } from "./images";
import { ToyDetail } from "./ToyDetail";
import { ToyForm } from "./ToyForm";
import { QualityBadges, StockBadge, costRange, priceText } from "./toy-parts";
import { Button, Chip, EmptyState, Field, Modal, PageHeader, inputCls } from "./ui";
import { ShopLoading } from "./status";

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
  "price-asc": (a, b) => priceRange(a)[0] - priceRange(b)[0],
  "price-desc": (a, b) => priceRange(b)[1] - priceRange(a)[1],
  "stock-asc": (a, b) => totalStock(a) - totalStock(b),
  "stock-desc": (a, b) => totalStock(b) - totalStock(a),
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Inventory() {
  const data = useShop();
  if (!data) return <ShopLoading />;
  return <InventoryView data={data} />;
}

function InventoryView({ data }: { data: ShopData }) {
  const { currency, inventoryView: view } = data.settings;
  const can = useCan();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [qualities, setQualities] = useState<Quality[]>([]);
  const [stock, setStock] = useState<StockStatus | "all">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [adding, setAdding] = useState(false);
  // The toy open in the details modal. Kept as an id so the modal always shows current data.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.toys.find((t) => t.id === selectedId);

  const q = query.trim().toLowerCase();
  const filtered = data.toys
    .filter(
      (t) =>
        (!q || `${t.name} ${t.sku} ${t.manufacturer} ${t.notes}`.toLowerCase().includes(q)) &&
        (categories.length === 0 || categories.includes(t.category)) &&
        // A toy matches a quality or a price range if any one of its qualities does.
        (qualities.length === 0 || t.qualities.some((x) => qualities.includes(x.quality))) &&
        (stock === "all" || stockStatus(t) === stock) &&
        ((minPrice === "" && maxPrice === "") ||
          t.qualities.some(
            (x) =>
              (minPrice === "" || x.price >= Number(minPrice)) &&
              (maxPrice === "" || x.price <= Number(maxPrice)),
          )),
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

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every toy in the shop. Select one to see its pictures and details."
        action={
          can("inventory.create") && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              + Add toy
            </Button>
          )
        }
      />

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Search" className="col-span-2">
            <input
              type="search"
              className={inputCls}
              placeholder="Name, SKU, manufacturer or notes"
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
              onClick={() => setInventoryView(v)}
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
              className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow focus-within:ring-2 focus-within:ring-accent hover:shadow-md"
            >
              <div className="aspect-[4/3] w-full overflow-hidden">
                <ToyCover toy={t} />
              </div>
              <div className="flex flex-1 flex-col p-3">
                {/* The name is the button; its ::after stretches over the whole card. */}
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className="text-left font-medium leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {t.name}
                </button>
                <p className="mt-0.5 text-xs text-muted">{t.manufacturer || "No manufacturer"}</p>
                <p className="text-xs text-muted">
                  {t.category} · {t.sku}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <QualityBadges toy={t} />
                </div>
                <div className="mt-1.5">
                  <StockBadge toy={t} />
                </div>
                <p className="mt-auto pt-3 text-lg font-semibold whitespace-nowrap tabular-nums">
                  {priceText(...priceRange(t), currency)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Toy</th>
                <th className="px-4 py-3 font-medium">Manufacturer</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Qualities (in stock)</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Stock value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-line">
                        <ToyCover toy={t} compact />
                      </span>
                      <div>
                        {/* A real button so the row can be opened from the keyboard. */}
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="text-left font-medium hover:underline"
                        >
                          {t.name}
                        </button>
                        <p className="text-xs text-muted">{t.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{t.manufacturer || <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <QualityBadges toy={t} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {priceText(...priceRange(t), currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {priceText(...costRange(t), currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge toy={t} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {money(retailValue(t), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <Modal title="Add toy" onClose={() => setAdding(false)}>
          <ToyForm toy={null} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {selected && (
        <ToyDetail
          key={selected.id}
          toy={selected}
          currency={currency}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
