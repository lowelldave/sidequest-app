"use client";

import { useState, type FormEvent } from "react";
import { addToy } from "@/lib/store";
import { CATEGORIES, QUALITIES, type Category, type Quality, type Toy, type TransactionType } from "@/lib/types";
import { toast } from "./toast";
import { Button, Field, FormError, Modal, inputCls } from "./ui";

/**
 * A short form for adding a toy to the inventory without leaving a transaction.
 * Only the essentials: the rest (pictures, SKU, more qualities and so on) can be
 * filled in later from the Inventory page.
 */
export function QuickAddToy({
  name,
  type,
  onCreated,
  onClose,
}: {
  /** What was typed in the toy search; becomes the toy's name. */
  name: string;
  /** The kind of transaction being recorded, which changes the advice on starting stock. */
  type: TransactionType;
  /** Called with the new toy, which is already in the inventory. */
  onCreated: (toy: Toy) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const price = Number(fd.get("price"));
    const cost = Number(fd.get("cost"));
    const stock = Number(fd.get("stock"));

    if (!text("name")) return setError("Give the toy a name.");
    if ([price, cost, stock].some((n) => Number.isNaN(n) || n < 0)) {
      return setError("Price, cost and stock must be zero or more.");
    }
    if (!Number.isInteger(stock)) return setError("Stock must be a whole number.");

    const toy = addToy(
      {
        name: text("name"),
        sku: "",
        manufacturer: text("manufacturer"),
        category: text("category") as Category,
        images: [],
        qualities: [{ quality: text("quality") as Quality, price, cost, stock }],
        reorderLevel: 5,
        notes: "",
      },

    );
    toast({
      tone: "success",
      title: "Toy added to inventory",
      message: `${toy.name} (${toy.qualities[0].quality})`,
    });
    onCreated(toy);
  }

  const stockHint =
    type === "restock"
      ? "Leave at 0: this restock adds the stock."
      : type === "sale"
        ? "A sale needs stock to sell, so enter how many you have."
        : "How many you have now.";

  return (
    <Modal title="Add toy to inventory" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-6 gap-3">
        <Field label="Name" className="col-span-6">
          <input name="name" className={inputCls} defaultValue={name} autoFocus={!name} required />
        </Field>
        <Field label="Category" className="col-span-3">
          <select name="category" className={inputCls} defaultValue={CATEGORIES[0]}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Quality" className="col-span-3">
          <select name="quality" className={inputCls} defaultValue="MIB">
            {QUALITIES.map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </Field>
        <Field label="Selling price" className="col-span-2">
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            // With a name typed in, the price is the next thing to fill in.
            autoFocus={!!name}
            required
          />
        </Field>
        <Field label="Unit cost" className="col-span-2">
          <input
            name="cost"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            defaultValue="0"
            required
          />
        </Field>
        <Field label="Starting stock" className="col-span-2">
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className={inputCls}
            defaultValue="0"
            required
          />
        </Field>
        <p className="col-span-6 -mt-1 text-xs text-muted">{stockHint}</p>
        <Field label="Manufacturer" className="col-span-6">
          <input name="manufacturer" className={inputCls} placeholder="Optional" />
        </Field>
        <p className="col-span-6 text-xs text-muted">
          You can add pictures, more qualities and other details later from the Inventory page.
        </p>
        <div className="col-span-6">
          <FormError message={error} />
        </div>
        <div className="col-span-6 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            Add to inventory
          </Button>
        </div>
      </form>
    </Modal>
  );
}
