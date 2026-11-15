"use client";

import { useState, type FormEvent } from "react";
import { formatDate, money, todayISO } from "@/lib/format";
import { addTransaction, deleteTransaction, useShop } from "@/lib/store";
import {
  PAYMENT_METHODS,
  TRANSACTION_LABEL,
  TRANSACTION_TYPES,
  signedAmount,
  totalStock,
  type PaymentMethod,
  type Quality,
  type QualityStock,
  type ShopData,
  type Toy,
  type Transaction,
  type TransactionType,
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
  QUALITY_TONE,
  StatCard,
  inputCls,
} from "./ui";

const TYPE_TONE: Record<TransactionType, "green" | "red" | "blue"> = {
  sale: "green",
  refund: "red",
  restock: "blue",
};

export function Transactions() {
  const data = useShop();
  if (!data) return <Loading />;
  return <TransactionsView data={data} />;
}

function TransactionsView({ data }: { data: ShopData }) {
  const { currency } = data.settings;
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = data.transactions
    .filter(
      (t) =>
        (!q || `${t.toyName} ${t.quality} ${t.note}`.toLowerCase().includes(q)) &&
        (types.length === 0 || types.includes(t.type)) &&
        (payment === "all" || t.payment === payment) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = (type: TransactionType) =>
    filtered.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const net = filtered.reduce((a, t) => a + signedAmount(t), 0);
  const filtersActive = q !== "" || types.length > 0 || payment !== "all" || !!from || !!to;

  function remove(t: Transaction) {
    if (
      confirm(
        `Delete this ${t.type} of ${t.quantity} × ${t.toyName} (${t.quality})? Stock will be adjusted back.`,
      )
    ) {
      deleteTransaction(t.id);
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Sales, refunds and restocks. Each one updates stock automatically."
        action={
          <Button variant="primary" onClick={() => setAdding(true)} disabled={data.toys.length === 0}>
            + New transaction
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales" value={money(total("sale"), currency)} />
        <StatCard label="Refunds" value={money(total("refund"), currency)} />
        <StatCard label="Restocks" value={money(total("restock"), currency)} />
        <StatCard label="Net cash flow" value={money(net, currency)} hint="For the rows shown below" />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Search" className="col-span-2">
            <input
              type="search"
              className={inputCls}
              placeholder="Toy, quality or note"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Payment">
            <select
              className={inputCls}
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentMethod | "all")}
            >
              <option value="all">Any</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Type</span>
          {TRANSACTION_TYPES.map((type) => (
            <Chip
              key={type}
              active={types.includes(type)}
              onClick={() =>
                setTypes(types.includes(type) ? types.filter((x) => x !== type) : [...types, type])
              }
            >
              {TRANSACTION_LABEL[type]}
            </Chip>
          ))}
        </div>
      </div>

      <p className="my-4 text-sm text-muted" aria-live="polite">
        Showing {filtered.length} of {data.transactions.length} transactions
        {filtersActive && (
          <>
            {" · "}
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => {
                setQuery("");
                setTypes([]);
                setPayment("all");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </button>
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        data.transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            hint={
              data.toys.length === 0
                ? "Add a toy to the inventory first, then record a sale or restock."
                : "Record your first sale, refund or restock."
            }
          />
        ) : (
          <EmptyState title="No transactions match these filters" hint="Try a wider date range or fewer filters." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Toy</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit price</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TYPE_TONE[t.type]}>{TRANSACTION_LABEL[t.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.toyName}</p>
                    {t.note && <p className="text-xs text-muted">{t.note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={QUALITY_TONE[t.quality]}>{t.quality}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {money(t.unitPrice, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {signedAmount(t) > 0 ? "+" : "−"}
                    {money(t.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">{t.payment}</td>
                  <td className="px-2 py-3 text-right">
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

      {adding && (
        <TransactionForm toys={data.toys} currency={currency} onClose={() => setAdding(false)} />
      )}
    </>
  );
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

function TransactionForm({
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
  const [toyId, setToyId] = useState(sorted[0]?.id ?? "");
  const [quality, setQuality] = useState<Quality>(
    pickQuality(sorted[0], "sale")?.quality ?? "Loose",
  );
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(
    defaultUnitPrice(pickQuality(sorted[0], "sale"), "sale"),
  );
  const [error, setError] = useState<string | null>(null);

  const toy = toys.find((t) => t.id === toyId);
  const variant = toy?.qualities.find((q) => q.quality === quality);
  const amount = Number(quantity) * Number(unitPrice);

  /** Changes the toy, type and/or quality together so the quality and price always fit. */
  function choose(next: { toyId?: string; type?: TransactionType; quality?: Quality }) {
    const nextToyId = next.toyId ?? toyId;
    const nextType = next.type ?? type;
    const nextToy = toys.find((t) => t.id === nextToyId);
    const nextVariant = pickQuality(nextToy, nextType, next.quality ?? quality);
    setToyId(nextToyId);
    setType(nextType);
    setQuality(nextVariant?.quality ?? quality);
    setUnitPrice(defaultUnitPrice(nextVariant, nextType));
    setError(null);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const problem = addTransaction({
      type,
      toyId,
      quality,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      date: String(fd.get("date")) || todayISO(),
      payment: String(fd.get("payment")) as PaymentMethod,
      note: String(fd.get("note") ?? "").trim(),
    });
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal title="New transaction" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex gap-2">
          {TRANSACTION_TYPES.map((t) => (
            <Chip
              key={t}
              active={type === t}
              onClick={() => choose({ type: t })}
            >
              {TRANSACTION_LABEL[t]}
            </Chip>
          ))}
        </div>
        <Field label="Toy" className="col-span-2">
          <select
            className={inputCls}
            value={toyId}
            onChange={(e) => choose({ toyId: e.target.value })}
          >
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({totalStock(t)} in stock)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quality" className="col-span-2">
          <select
            className={inputCls}
            value={quality}
            onChange={(e) => choose({ quality: e.target.value as Quality })}
          >
            {toy?.qualities.map((q) => (
              <option key={q.quality} value={q.quality} disabled={!isSelectable(q, type)}>
                {q.quality} · {q.stock} in stock · {money(type === "restock" ? q.cost : q.price, currency)}
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
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
            required
          />
        </Field>
        <Field label={type === "restock" ? "Unit cost" : "Unit price"}>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </Field>
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
        <p className="col-span-2 flex justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">
            {type === "sale" ? "Money in" : "Money out"} · {variant?.quality ?? "quality"} stock{" "}
            {type === "sale" ? "decreases" : "increases"}
          </span>
          <span className="font-semibold tabular-nums">
            {money(Number.isFinite(amount) ? amount : 0, currency)}
          </span>
        </p>
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
  );
}
