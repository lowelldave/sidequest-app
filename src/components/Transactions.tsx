"use client";

import { useState } from "react";
import { formatDate, money } from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";
import { deleteTransaction, useShop } from "@/lib/store";
import { TransactionForm } from "./TransactionForm";
import { toast } from "./toast";
import {
  PAYMENT_METHODS,
  TRANSACTION_LABEL,
  TRANSACTION_TYPES,
  signedAmount,
  type PaymentMethod,
  type ShopData,
  type Transaction,
  type TransactionType,
} from "@/lib/types";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Loading,
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

  const batchSizes = new Map<string, number>();
  for (const t of data.transactions) {
    if (t.batchId) batchSizes.set(t.batchId, (batchSizes.get(t.batchId) ?? 0) + 1);
  }

  const total = (type: TransactionType) =>
    filtered.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const net = filtered.reduce((a, t) => a + signedAmount(t), 0);
  const filtersActive = q !== "" || types.length > 0 || payment !== "all" || !!from || !!to;

  async function invoice(t: Transaction) {
    try {
      const group = t.batchId ? data.transactions.filter((x) => x.batchId === t.batchId) : [t];
      const file = await downloadInvoice(group, data.toys, currency);
      toast({ tone: "success", title: "Invoice downloaded", message: file });
    } catch {
      toast({
        tone: "error",
        title: "Couldn't create the invoice",
        message: "Something went wrong while making the PDF. Please try again.",
      });
    }
  }

  function remove(t: Transaction) {
    if (
      confirm(
        `Delete this ${t.type} of ${t.quantity} × ${t.toyName} (${t.quality})? Stock will be adjusted back.`,
      )
    ) {
      deleteTransaction(t.id);
      toast({
        tone: "success",
        title: "Transaction deleted",
        message: `${t.quantity} × ${t.toyName} (${t.quality}). Stock adjusted back.`,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Sales, refunds and restocks. Each one updates stock automatically."
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
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
            hint="Record your first sale, refund or restock. Toys that aren't in the inventory yet can be added as you go."
          />
        ) : (
          <EmptyState title="No transactions match these filters" hint="Try a wider date range or fewer filters." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Toy</th>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 text-right font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Unit price / cost</th>
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
                    {t.batchId && (batchSizes.get(t.batchId) ?? 0) > 1 && (
                      <p className="text-xs text-muted">
                        One of {batchSizes.get(t.batchId)} toys in the same delivery
                      </p>
                    )}
                    {t.note && <p className="text-xs text-muted">{t.note}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={QUALITY_TONE[t.quality]}>{t.quality}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{t.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {t.delivery ? (
                      <>
                        {/* Final unit cost, with the delivery share included. */}
                        <span className="text-foreground">{money(t.amount / t.quantity, currency)}</span>
                        <span className="block text-xs">
                          {money(t.unitPrice, currency)} + {money(t.delivery / t.quantity, currency)} delivery
                        </span>
                      </>
                    ) : (
                      money(t.unitPrice, currency)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {signedAmount(t) > 0 ? "+" : "−"}
                    {money(t.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">{t.payment}</td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => void invoice(t)}
                      aria-label={`Download invoice for ${t.toyName}, ${formatDate(t.date)}`}
                    >
                      Invoice
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

      {adding && (
        <TransactionForm toys={data.toys} currency={currency} onClose={() => setAdding(false)} />
      )}
    </>
  );
}
