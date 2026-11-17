"use client";

import { useShopSettings } from "@/lib/shop";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { removeImages } from "@/lib/images";
import { addToy, updateToy, type ToyInput } from "@/lib/store";
import {
  CATEGORIES,
  QUALITIES,
  type Category,
  type Quality,
  type QualityStock,
  type Toy,
} from "@/lib/types";
import { ImageField } from "./images";
import { Button, Field, FormError, inputCls } from "./ui";

type QualityRow = { quality: Quality; price: string; cost: string; stock: string };

function toRow(q: QualityStock): QualityRow {
  return { quality: q.quality, price: String(q.price), cost: String(q.cost), stock: String(q.stock) };
}

/**
 * Form for adding a toy (`toy` is null) or editing one. It renders no frame of its own,
 * so it can sit inside a modal. `onDone` runs after saving, `onCancel` when the user backs out.
 */
export function ToyForm({
  toy,
  onDone,
  onCancel,
}: {
  toy: Toy | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const defaults = useShopSettings();
  const [rows, setRows] = useState<QualityRow[]>(
    toy ? toy.qualities.map(toRow) : [{ quality: defaults.default_quality, price: "", cost: "0", stock: "0" }],
  );
  const [images, setImages] = useState<string[]>(toy?.images ?? []);

  // Pictures uploaded in this session but not saved yet. If the form closes without
  // saving they are deleted, so abandoned uploads don't pile up in the browser.
  const uploaded = useRef<string[]>([]);
  const saved = useRef(false);
  useEffect(() => {
    return () => {
      if (!saved.current) void removeImages(uploaded.current);
    };
  }, []);

  const unused = QUALITIES.filter((q) => !rows.some((r) => r.quality === q));

  function patchRow(index: number, patch: Partial<QualityRow>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    if (unused.length === 0) return;
    const last = rows[rows.length - 1];
    setRows([...rows, { quality: unused[0], price: last?.price ?? "", cost: last?.cost ?? "0", stock: "0" }]);
  }

  function removePicture(id: string) {
    setImages((list) => list.filter((x) => x !== id));
    // A picture added during this edit can be deleted right away; saved ones wait for Save.
    if (uploaded.current.includes(id)) {
      uploaded.current = uploaded.current.filter((x) => x !== id);
      void removeImages([id]);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const qualities: QualityStock[] = rows.map((r) => ({
      quality: r.quality,
      price: Number(r.price),
      cost: Number(r.cost),
      stock: Number(r.stock),
    }));
    const input: ToyInput = {
      name: text("name"),
      sku: text("sku"),
      manufacturer: text("manufacturer"),
      category: text("category") as Category,
      images,
      qualities,
      reorderLevel: Number(fd.get("reorderLevel")),
      notes: text("notes"),
    };
    if (!input.name) return setError("Give the toy a name.");
    if (qualities.length === 0) return setError("Add at least one quality.");
    if (
      qualities.some((q) => [q.price, q.cost, q.stock].some((n) => Number.isNaN(n) || n < 0)) ||
      Number.isNaN(input.reorderLevel) ||
      input.reorderLevel < 0
    ) {
      return setError("Prices, costs and stock must be zero or more.");
    }
    if (qualities.some((q) => !Number.isInteger(q.stock)) || !Number.isInteger(input.reorderLevel)) {
      return setError("Stock and low-stock level must be whole numbers.");
    }

    saved.current = true;
    if (toy) updateToy(toy.id, input);
    else addToy(input);
    // Pictures that were taken off a saved toy can go now that it's saved.
    void removeImages((toy?.images ?? []).filter((id) => !images.includes(id)));
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Name" className="col-span-2">
        <input name="name" className={inputCls} defaultValue={toy?.name} autoFocus required />
      </Field>

      <div className="col-span-2">
        <p className="mb-1 text-xs font-medium text-muted">Pictures (the first one is the cover)</p>
        <ImageField
          ids={images}
          onAdd={(ids) => {
            uploaded.current = [...uploaded.current, ...ids];
            setImages((list) => [...list, ...ids]);
          }}
          onRemove={removePicture}
          onMakeCover={(id) => setImages((list) => [id, ...list.filter((x) => x !== id)])}
        />
      </div>

      <Field label="Category">
        <select name="category" className={inputCls} defaultValue={toy?.category ?? CATEGORIES[0]}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="SKU">
        <input name="sku" className={inputCls} defaultValue={toy?.sku} placeholder="Optional" />
      </Field>
      <Field label="Manufacturer" className="col-span-2">
        <input
          name="manufacturer"
          className={inputCls}
          defaultValue={toy?.manufacturer}
          placeholder="Optional"
        />
      </Field>

      <fieldset className="col-span-2 space-y-2">
        <legend className="mb-1 text-xs font-medium text-muted">
          Qualities: each has its own price and stock
        </legend>
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-end gap-2">
              <Field label="Quality" className="flex-1">
                <select
                  className={inputCls}
                  value={r.quality}
                  onChange={(e) => patchRow(i, { quality: e.target.value as Quality })}
                >
                  {QUALITIES.filter((q) => q === r.quality || unused.includes(q)).map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
              </Field>
              <Button
                variant="danger"
                className="h-10 px-3"
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                aria-label={`Remove ${r.quality}`}
              >
                Remove
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="Selling price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={inputCls}
                  value={r.price}
                  onChange={(e) => patchRow(i, { price: e.target.value })}
                  required
                />
              </Field>
              <Field label="Unit cost">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={inputCls}
                  value={r.cost}
                  onChange={(e) => patchRow(i, { cost: e.target.value })}
                  required
                />
              </Field>
              <Field label="Stock">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className={inputCls}
                  value={r.stock}
                  onChange={(e) => patchRow(i, { stock: e.target.value })}
                  required
                />
              </Field>
            </div>
          </div>
        ))}
        <Button className="w-full" onClick={addRow} disabled={unused.length === 0}>
          {unused.length === 0 ? "All qualities added" : "+ Add another quality"}
        </Button>
      </fieldset>

      <Field label="Low-stock level (all qualities combined)" className="col-span-2">
        <input
          name="reorderLevel"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          className={inputCls}
          defaultValue={toy?.reorderLevel ?? defaults.default_reorder_level}
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
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">
          {toy ? "Save changes" : "Add toy"}
        </Button>
      </div>
    </form>
  );
}
