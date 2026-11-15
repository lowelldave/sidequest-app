"use client";

import { useState, type FormEvent } from "react";
import { money, todayISO } from "@/lib/format";
import { allocateDelivery } from "@/lib/restock";
import { addRestock, addTransaction } from "@/lib/store";
import {
  PAYMENT_METHODS,
  TRANSACTION_LABEL,
  TRANSACTION_TYPES,
  totalStock,
  type PaymentMethod,
  type Quality,
  type QualityStock,
  type Toy,
  type TransactionType,
} from "@/lib/types";
import { QuickAddToy } from "./QuickAddToy";
import { ToyPicker } from "./ToyPicker";
import { toast } from "./toast";
import { Button, Chip, Field, FormError, Modal, inputCls } from "./ui";

/** One toy in the form: a single one for sales and refunds, as many as needed for a restock. */
type Line = {
  /** Stable key for React, since lines can be removed from the middle. */
  key: string;
  toyId: string;
  quality: Quality;
  quantity: string;
  unitPrice: string;
};

function newLine(): Line {
  // No toy chosen to start: the picker is searchable, and a long inventory makes
  // "the first toy alphabetically" a poor default.
  return { key: crypto.randomUUID(), toyId: "", quality: "MIB", quantity: "1", unitPrice: "" };
}

function defaultUnitPrice(variant: QualityStock | undefined, type: TransactionType): string {
  if (!variant) return "";
  return String(type === "restock" ? variant.cost : variant.price);
}

/** A sale needs stock to sell, so it can't use a quality that's sold out; refunds and restocks can. */
function isSelectable(variant: QualityStock, type: TransactionType): boolean {
  return type !== "sale" || variant.stock > 0;
}

/** Keeps the preferred quality if it can be used for this kind of transaction, else the first one that can. */
function pickQuality(toy: Toy | undefined, type: TransactionType, preferred?: Quality): QualityStock | undefined {
  if (!toy) return undefined;
  const usable = toy.qualities.filter((q) => isSelectable(q, type));
  return usable.find((q) => q.quality === preferred) ?? usable[0] ?? toy.qualities[0];
}

const num = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function TransactionForm({
  toys,
  currency,
  onClose,
}: {
  toys: Toy[];
  currency: string;
  onClose: () => void;
}) {
  const sorted = [...toys].sort((a, b) => a.name.localeCompare(b.name));
  const [type, setType] = useState<TransactionType>("sale");
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [deliveryCost, setDeliveryCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set while the "add a toy to the inventory" dialog is open: which line asked, and the typed name.
  const [adding, setAdding] = useState<{ lineKey: string; name: string } | null>(null);

  const isRestock = type === "restock";
  // Sales and refunds are for one toy; any extra lines wait, unseen, if you switch back and forth.
  const shown = isRestock ? lines : lines.slice(0, 1);

  const toyOf = (line: Line) => toys.find((t) => t.id === line.toyId);

  function setLine(key: string, patch: Partial<Line>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setError(null);
  }

  /** Changes a line's toy and/or quality together so the quality and price always fit. */
  function chooseForLine(line: Line, next: { toyId?: string; quality?: Quality }, newToy?: Toy) {
    const toy = newToy ?? toys.find((t) => t.id === (next.toyId ?? line.toyId));
    const variant = pickQuality(toy, type, next.quality ?? line.quality);
    setLine(line.key, {
      toyId: next.toyId ?? line.toyId,
      quality: variant?.quality ?? line.quality,
      unitPrice: defaultUnitPrice(variant, type),
    });
  }

  function chooseType(next: TransactionType) {
    setType(next);
    // The suggested price differs (cost when restocking, price otherwise), and so can which qualities are usable.
    setLines((all) =>
      all.map((l) => {
        const variant = pickQuality(toyOf(l), next, l.quality);
        return { ...l, quality: variant?.quality ?? l.quality, unitPrice: defaultUnitPrice(variant, next) };
      }),
    );
    setError(null);
  }

  // ---- Totals (restock) ----
  const delivery = Math.max(0, num(deliveryCost));
  const shares = allocateDelivery(
    shown.map((l) => num(l.quantity)),
    isRestock ? delivery : 0,
  );
  const subtotal = shown.reduce((sum, l) => sum + num(l.quantity) * num(l.unitPrice), 0);
  const totalUnits = shown.reduce((sum, l) => sum + Math.max(0, num(l.quantity)), 0);
  const grandTotal = subtotal + shares.reduce((a, b) => a + b, 0);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date")) || todayISO();
    const payment = String(fd.get("payment")) as PaymentMethod;
    const note = String(fd.get("note") ?? "").trim();

    if (isRestock) {
      const problem = addRestock({
        date,
        payment,
        note,
        deliveryCost: delivery,
        lines: lines.map((l) => ({
          toyId: l.toyId,
          quality: l.quality,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitPrice),
        })),
      });
      if (problem) {
        setError(problem);
        return;
      }
      toast({
        tone: "success",
        title: "Restock recorded",
        message: `${lines.length} ${lines.length === 1 ? "toy" : "toys"} · ${totalUnits} units · ${money(grandTotal, currency)}${
          delivery > 0 ? ` (includes ${money(delivery, currency)} delivery)` : ""
        }`,
      });
      onClose();
      return;
    }

    const line = lines[0];
    const toy = toyOf(line);
    const problem = addTransaction({
      type,
      toyId: line.toyId,
      quality: line.quality,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      date,
      payment,
      note,
    });
    if (problem) {
      setError(problem);
      return;
    }
    toast({
      tone: "success",
      title: `${TRANSACTION_LABEL[type]} recorded`,
      message: `${line.quantity} × ${toy?.name ?? "toy"} (${line.quality}) · ${money(
        num(line.quantity) * num(line.unitPrice),
        currency,
      )}`,
    });
    onClose();
  }

  const addingLine = adding ? lines.find((l) => l.key === adding.lineKey) : undefined;

  return (
    <>
    <Modal title="New transaction" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-2">
          {TRANSACTION_TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => chooseType(t)}>
              {TRANSACTION_LABEL[t]}
            </Chip>
          ))}
        </div>

        {isRestock ? (
          <div className="col-span-2 space-y-3">
            {lines.map((line, i) => (
              <RestockLine
                key={line.key}
                index={i}
                line={line}
                toy={toyOf(line)}
                toys={sorted}
                currency={currency}
                canRemove={lines.length > 1}
                finalUnitCost={
                  delivery > 0 && num(line.quantity) > 0
                    ? { unit: num(line.unitPrice), perUnitDelivery: shares[i] / num(line.quantity) }
                    : null
                }
                onChoose={(next) => chooseForLine(line, next)}
                onAddNew={(name) => setAdding({ lineKey: line.key, name })}
                onChange={(patch) => setLine(line.key, patch)}
                onRemove={() => setLines((all) => all.filter((l) => l.key !== line.key))}
              />
            ))}
            <Button className="w-full" onClick={() => setLines((all) => [...all, newLine()])}>
              + Add another toy
            </Button>
          </div>
        ) : (
          <SingleLine
            line={shown[0]}
            toy={toyOf(shown[0])}
            toys={sorted}
            type={type}
            currency={currency}
            onChoose={(next) => chooseForLine(shown[0], next)}
            onAddNew={(name) => setAdding({ lineKey: shown[0].key, name })}
            onChange={(patch) => setLine(shown[0].key, patch)}
          />
        )}

        {isRestock && (
          <Field label="Total delivery cost" className="col-span-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className={inputCls}
              placeholder="0.00"
              value={deliveryCost}
              onChange={(e) => {
                setDeliveryCost(e.target.value);
                setError(null);
              }}
            />
            <span className="mt-1 block text-xs text-muted">
              For the whole delivery. It&apos;s split across every unit and added to each item&apos;s unit
              cost.
            </span>
          </Field>
        )}

        <Field label="Date">
          <input name="date" type="date" className={inputCls} defaultValue={todayISO()} required />
        </Field>
        <Field label="Payment">
          <select name="payment" className={inputCls}>
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Note" className="col-span-2">
          <input name="note" className={inputCls} placeholder="Optional" />
        </Field>

        {isRestock ? (
          <dl className="col-span-2 space-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">
                Items ({totalUnits} {totalUnits === 1 ? "unit" : "units"})
              </dt>
              <dd className="tabular-nums">{money(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">
                Delivery
                {delivery > 0 && totalUnits > 0 && (
                  <> ({money(delivery / totalUnits, currency)} per unit)</>
                )}
              </dt>
              <dd className="tabular-nums">{money(delivery, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <dt>Total money out · stock increases</dt>
              <dd className="tabular-nums">{money(grandTotal, currency)}</dd>
            </div>
          </dl>
        ) : (
          <p className="col-span-2 flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">
              {type === "sale" ? "Money in" : "Money out"} ·{" "}
              {toyOf(shown[0])?.qualities.find((q) => q.quality === shown[0].quality)?.quality ?? "quality"}{" "}
              stock {type === "sale" ? "decreases" : "increases"}
            </span>
            <span className="font-semibold tabular-nums">
              {money(num(shown[0].quantity) * num(shown[0].unitPrice), currency)}
            </span>
          </p>
        )}

        <div className="col-span-2">
          <FormError message={error} />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            Record {type}
          </Button>
        </div>
      </form>
    </Modal>
    {adding && addingLine && (
      <QuickAddToy
        name={adding.name}
        type={type}
        onClose={() => setAdding(null)}
        onCreated={(toy) => {
          // Select the new toy on the line that asked for it, with its price filled in.
          chooseForLine(addingLine, { toyId: toy.id }, toy);
          setAdding(null);
        }}
      />
    )}
    </>
  );
}

/** The toy, quality, quantity and price of a sale or refund. */
function SingleLine({
  line,
  toy,
  toys,
  type,
  currency,
  onChoose,
  onAddNew,
  onChange,
}: {
  line: Line;
  toy: Toy | undefined;
  toys: Toy[];
  type: TransactionType;
  currency: string;
  onChoose: (next: { toyId?: string; quality?: Quality }) => void;
  onAddNew: (name: string) => void;
  onChange: (patch: Partial<Line>) => void;
}) {
  return (
    <>
      <div className="col-span-2">
        <ToyPicker
          toys={toys}
          value={line.toyId}
          onChange={(id) => onChoose({ toyId: id })}
          // A sale needs something to sell; refunds don't.
          isDisabled={type === "sale" ? (t) => totalStock(t) <= 0 : undefined}
          onAddNew={onAddNew}
          autoFocus
        />
      </div>
      <Field label="Quality" className="col-span-2">
        <select
          className={inputCls}
          value={toy ? line.quality : ""}
          disabled={!toy}
          onChange={(e) => onChoose({ quality: e.target.value as Quality })}
        >
          {!toy && <option value="">Choose a toy first</option>}
          {toy?.qualities.map((q) => (
            <option key={q.quality} value={q.quality} disabled={!isSelectable(q, type)}>
              {q.quality} · {q.stock} in stock · {money(q.price, currency)}
              {!isSelectable(q, type) ? " (sold out)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity">
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          className={inputCls}
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          required
        />
      </Field>
      <Field label="Unit price">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className={inputCls}
          value={line.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value })}
          // With no toy chosen the price is blank; let the "Choose a toy" message come first.
          required={!!toy}
        />
      </Field>
    </>
  );
}

/** One toy of a restock, in a card of its own. */
function RestockLine({
  index,
  line,
  toy,
  toys,
  currency,
  canRemove,
  finalUnitCost,
  onChoose,
  onAddNew,
  onChange,
  onRemove,
}: {
  index: number;
  line: Line;
  toy: Toy | undefined;
  toys: Toy[];
  currency: string;
  canRemove: boolean;
  /** Set when a delivery cost applies: the bought unit cost and the delivery added to each unit. */
  finalUnitCost: { unit: number; perUnitDelivery: number } | null;
  onChoose: (next: { toyId?: string; quality?: Quality }) => void;
  onAddNew: (name: string) => void;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3">
      <legend className="sr-only">Item {index + 1}</legend>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted" aria-hidden="true">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove item ${index + 1}`}
            className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
          >
            Remove
          </button>
        )}
      </div>
      <ToyPicker
        toys={toys}
        value={line.toyId}
        onChange={(id) => onChoose({ toyId: id })}
        onAddNew={onAddNew}
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Quality">
          <select
            className={inputCls}
            value={toy ? line.quality : ""}
            disabled={!toy}
            onChange={(e) => onChoose({ quality: e.target.value as Quality })}
          >
            {!toy && <option value="">—</option>}
            {toy?.qualities.map((q) => (
              <option key={q.quality} value={q.quality}>
                {q.quality} ({q.stock})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantity">
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className={inputCls}
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
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
            value={line.unitPrice}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            required={!!toy}
          />
        </Field>
      </div>
      {finalUnitCost && (
        <p className="text-xs text-muted">
          Final unit cost{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {money(finalUnitCost.unit + finalUnitCost.perUnitDelivery, currency)}
          </span>{" "}
          = {money(finalUnitCost.unit, currency)} + {money(finalUnitCost.perUnitDelivery, currency)} delivery
        </p>
      )}
    </fieldset>
  );
}
