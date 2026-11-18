"use client";

import { useCan } from "@/lib/account";
import { useState, type ReactNode } from "react";
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
                <tr
                  key={t.id}
                  onClick={() => setViewingId(t.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setViewingId(t.id);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`${TRANSACTION_LABEL[t.type]} of ${t.toyName}, ${formatDate(t.date)}. Show details`}
                  className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TYPE_TONE[t.type]}>{TRANSACTION_LABEL[t.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{t.toyName}</p>
                    {t.batchId && (batchSizes.get(t.batchId) ?? 0) > 1 && (
                      <p className="text-xs text-muted">
                        One of {batchSizes.get(t.batchId)} toys in the same{" "}
                        {t.type === "sale" ? "sale" : "delivery"}
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
                  {/* The buttons do their own thing; a click on them doesn't open the details. */}
                  <td className="px-2 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      className="h-8 px-2"
                      onClick={() => void invoice(t)}
                      aria-label={`Download invoice for ${t.toyName}, ${formatDate(t.date)}`}
                    >
                      Invoice
                    </Button>
                    {can("transactions.delete") && (
                      <Button variant="danger" className="h-8 px-2" onClick={() => remove(t)}>
                        Delete
                      </Button>
                    )}
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
