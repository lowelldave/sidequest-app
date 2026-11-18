"use client";

import { useCan } from "@/lib/account";
import { useState, type ReactNode } from "react";
import { formatDate, money } from "@/lib/format";
import { downloadInvoice, invoiceNumber } from "@/lib/invoice";
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
  Modal,
  PageHeader,
  QUALITY_TONE,
  StatCard,
  inputCls,
} from "./ui";
import { ShopLoading } from "./status";

const TYPE_TONE: Record<TransactionType, "green" | "red" | "blue"> = {
  sale: "green",
  refund: "red",
  restock: "blue",
};

export function Transactions() {
  const data = useShop();
  if (!data) return <ShopLoading />;
  return <TransactionsView data={data} />;
}

function TransactionsView({ data }: { data: ShopData }) {
  const { currency } = data.settings;
  const can = useCan();
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [payment, setPayment] = useState<PaymentMethod | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adding, setAdding] = useState(false);
  // The transaction whose details are open.
  const [viewingId, setViewingId] = useState<string | null>(null);

  // The table has one row per sale, refund or delivery: the toys of a multi-toy sale
  // are separate transactions that share a batch id, and are listed in the details.
  const groups: Transaction[][] = [];
  {
    const byKey = new Map<string, Transaction[]>();
    for (const t of data.transactions) {
      const key = t.batchId ?? t.id;
      const group = byKey.get(key);
      if (group) group.push(t);
      else {
        const created = [t];
        byKey.set(key, created);
        groups.push(created);
      }
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = groups
    .filter((g) => {
      const t = g[0]; // Type, date and payment are the same across a group.
      return (
        (!q ||
          invoiceNumber(t).toLowerCase().includes(q) ||
          g.some((x) => `${x.toyName} ${x.quality} ${x.note}`.toLowerCase().includes(q))) &&
        (types.length === 0 || types.includes(t.type)) &&
        (payment === "all" || t.payment === payment) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to)
      );
    })
    .sort((a, b) => b[0].date.localeCompare(a[0].date));
  const shownTransactions = filtered.flat();

  const total = (type: TransactionType) =>
    shownTransactions.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const net = shownTransactions.reduce((a, t) => a + signedAmount(t), 0);
  const filtersActive = q !== "" || types.length > 0 || payment !== "all" || !!from || !!to;

  /** A transaction and the others recorded with it (the toys of one sale or delivery). */
  const groupOf = (t: Transaction) =>
    t.batchId ? data.transactions.filter((x) => x.batchId === t.batchId) : [t];

  const viewing = viewingId ? data.transactions.find((t) => t.id === viewingId) : undefined;

  async function invoice(t: Transaction) {
    try {
      const file = await downloadInvoice(groupOf(t), data.toys, currency);
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
      // Keep the details open on what's left of the same sale or delivery, if anything.
      if (viewingId === t.id) {
        const rest = groupOf(t).filter((x) => x.id !== t.id);
        setViewingId(rest[0]?.id ?? null);
      }
      deleteTransaction(t.id);
      toast({
        tone: "success",
        title: "Transaction deleted",
        message: `${t.quantity} × ${t.toyName} (${t.quality}). Stock adjusted back.`,
      });
    }
  }

  /** Deletes a whole row: every toy of the sale or delivery. */
  function removeGroup(group: Transaction[]) {
    if (group.length === 1) return remove(group[0]);
    const t = group[0];
    if (
      confirm(
        `Delete this ${t.type} of ${group.length} toys (${invoiceNumber(t)})? Stock will be adjusted back for all of them.`,
      )
    ) {
      if (viewingId && group.some((x) => x.id === viewingId)) setViewingId(null);
      for (const x of group) deleteTransaction(x.id);
      toast({
        tone: "success",
        title: "Transaction deleted",
        message: `${invoiceNumber(t)}: ${group.length} toys. Stock adjusted back.`,
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Sales, refunds and restocks. Each one updates stock automatically."
        action={
          can("transactions.create") && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              + New transaction
            </Button>
          )
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
              placeholder="Invoice number, toy, quality or note"
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
        Showing {filtered.length} of {groups.length} transactions
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
        groups.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            hint="Record your first sale, refund or restock. Toys that aren't in the inventory yet can be added as you go."
          />
        ) : (
          <EmptyState title="No transactions match these filters" hint="Try a wider date range or fewer filters." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Invoice no.</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((group) => {
                const t = group[0];
                const units = group.reduce((a, x) => a + x.quantity, 0);
                const amount = group.reduce((a, x) => a + x.amount, 0);
                const number = invoiceNumber(t);
                return (
                  <tr
                    key={t.batchId ?? t.id}
                    onClick={() => setViewingId(t.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setViewingId(t.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`${TRANSACTION_LABEL[t.type]} ${number}, ${formatDate(t.date)}. Show details`}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TYPE_TONE[t.type]}>{TRANSACTION_LABEL[t.type]}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {group.length} {group.length === 1 ? "toy" : "toys"} · {units} {units === 1 ? "unit" : "units"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {signedAmount(t) > 0 ? "+" : "−"}
                      {money(amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-muted">{t.payment}</td>
                    {/* The buttons do their own thing; a click on them doesn't open the details. */}
                    <td className="px-2 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => void invoice(t)}
                        aria-label={`Download invoice ${number}`}
                      >
                        Invoice
                      </Button>
                      {can("transactions.delete") && (
                        <Button
                          variant="danger"
                          className="h-8 px-2"
                          onClick={() => removeGroup(group)}
                          aria-label={`Delete ${number}`}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <TransactionForm toys={data.toys} currency={currency} onClose={() => setAdding(false)} />
      )}
      {viewing && (
        <TransactionDetails
          selected={viewing}
          group={groupOf(viewing)}
          currency={currency}
          canDelete={can("transactions.delete")}
          onInvoice={() => void invoice(viewing)}
          onDelete={remove}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}

/** Everything about one transaction, with the other toys of the same sale or delivery. */
function TransactionDetails({
  selected,
  group,
  currency,
  canDelete,
  onInvoice,
  onDelete,
  onClose,
}: {
  selected: Transaction;
  group: Transaction[];
  currency: string;
  canDelete: boolean;
  onInvoice: () => void;
  onDelete: (t: Transaction) => void;
  onClose: () => void;
}) {
  const several = group.length > 1;
  const units = group.reduce((a, t) => a + t.quantity, 0);
  const total = group.reduce((a, t) => a + t.amount, 0);
  const delivery = group.reduce((a, t) => a + (t.delivery ?? 0), 0);
  const hasDelivery = delivery > 0;
  const moneyIn = selected.type === "sale";
  const priceLabel = selected.type === "restock" ? "Unit cost" : "Unit price";

  return (
    <Modal title={`${TRANSACTION_LABEL[selected.type]} details`} onClose={onClose} size="xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONE[selected.type]}>{TRANSACTION_LABEL[selected.type]}</Badge>
          <span className="font-mono text-sm">{invoiceNumber(selected)}</span>
          {several && (
            <span className="text-sm text-muted">
              {group.length} toys · {units} units in one {selected.type === "sale" ? "sale" : "delivery"}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Detail label="Date">{formatDate(selected.date)}</Detail>
          <Detail label="Payment">{selected.payment}</Detail>
          <Detail label={moneyIn ? "Money in" : "Money out"}>
            <span className="font-semibold tabular-nums">
              {moneyIn ? "+" : "−"}
              {money(total, currency)}
            </span>
          </Detail>
          <Detail label="Stock">
            {selected.type === "sale" ? "Taken out" : "Put back"} · {units} {units === 1 ? "unit" : "units"}
          </Detail>
          {selected.note && (
            <Detail label="Note" className="col-span-2 sm:col-span-4">
              {selected.note}
            </Detail>
          )}
        </dl>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Toy</th>
                <th className="px-3 py-2 font-medium">Quality</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">{priceLabel}</th>
                {hasDelivery && <th className="px-3 py-2 text-right font-medium">Delivery</th>}
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                {canDelete && several && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {group.map((t) => (
                <tr
                  key={t.id}
                  aria-current={several && t.id === selected.id ? "true" : undefined}
                  className={`border-b border-line last:border-0 ${
                    several && t.id === selected.id ? "bg-surface-2" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium">{t.toyName}</td>
                  <td className="px-3 py-2">
                    <Badge tone={QUALITY_TONE[t.quality]}>{t.quality}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(t.unitPrice, currency)}</td>
                  {hasDelivery && (
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {money(t.delivery ?? 0, currency)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{money(t.amount, currency)}</td>
                  {canDelete && several && (
                    <td className="px-2 py-1 text-right">
                      <Button
                        variant="danger"
                        className="h-8 px-2"
                        onClick={() => onDelete(t)}
                        aria-label={`Delete ${t.toyName} (${t.quality}) from this ${t.type}`}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {hasDelivery && (
                <tr className="border-t border-line text-muted">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Items {money(total - delivery, currency)} + delivery
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(delivery, currency)}</td>
                  <td />
                  {canDelete && several && <td />}
                </tr>
              )}
              <tr className="border-t border-line font-semibold">
                <td colSpan={hasDelivery ? 5 : 4} className="px-3 py-2 text-right">
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{money(total, currency)}</td>
                {canDelete && several && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <div>
            {canDelete && !several && (
              <Button variant="danger" onClick={() => onDelete(selected)}>
                Delete transaction
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={onInvoice}>
              Download invoice
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
