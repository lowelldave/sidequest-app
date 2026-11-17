"use client";

import { useCan } from "@/lib/account";
import Link from "next/link";
import { useState } from "react";
import {
  compactMoney,
  daysAgoISO,
  formatDate,
  money,
  monthLabel,
  recentMonthKeys,
  todayISO,
} from "@/lib/format";
import { useShop } from "@/lib/store";
import {
  EXPENSE_CATEGORIES,
  TRANSACTION_LABEL,
  costValue,
  retailValue,
  signedAmount,
  stockStatus,
  totalStock,
  type ShopData,
} from "@/lib/types";
import { ToyCover } from "./images";
import { Badge, Card, PageHeader, StatCard, inputCls } from "./ui";
import { ShopLoading } from "./status";

type Range = "month" | "30d" | "year" | "all";

const RANGE_LABEL: Record<Range, string> = {
  month: "This month",
  "30d": "Last 30 days",
  year: "This year",
  all: "All time",
};

function rangeStart(range: Range): string {
  const today = todayISO();
  if (range === "month") return `${today.slice(0, 7)}-01`;
  if (range === "30d") return daysAgoISO(30);
  if (range === "year") return `${today.slice(0, 4)}-01-01`;
  return "";
}

export function Dashboard() {
  const data = useShop();
  if (!data) return <ShopLoading />;
  return <DashboardView data={data} />;
}

function DashboardView({ data }: { data: ShopData }) {
  const [range, setRange] = useState<Range>("month");
  const { currency } = data.settings;
  const can = useCan();
  const start = rangeStart(range);

  const txs = data.transactions.filter((t) => t.date >= start);
  const exps = data.expenses.filter((e) => e.date >= start);

  const sum = (type: string) =>
    txs.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const sales = sum("sale");
  const refunds = sum("refund");
  const restocks = sum("restock");
  const expenseTotal = exps.reduce((a, e) => a + e.amount, 0);
  const revenue = sales - refunds;
  const net = revenue - restocks - expenseTotal;

  const units = data.toys.reduce((a, t) => a + totalStock(t), 0);
  const retailTotal = data.toys.reduce((a, t) => a + retailValue(t), 0);
  const costTotal = data.toys.reduce((a, t) => a + costValue(t), 0);
  const attention = data.toys
    .filter((t) => stockStatus(t) !== "in")
    .sort((a, b) => totalStock(a) - totalStock(b));

  const months = recentMonthKeys(6).map((key) => {
    const monthTx = data.transactions.filter((t) => t.date.startsWith(key));
    const moneyIn = monthTx.filter((t) => t.type === "sale").reduce((a, t) => a + t.amount, 0);
    const moneyOut =
      monthTx.filter((t) => t.type !== "sale").reduce((a, t) => a + t.amount, 0) +
      data.expenses.filter((e) => e.date.startsWith(key)).reduce((a, e) => a + e.amount, 0);
    return { key, moneyIn, moneyOut };
  });

  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: exps.filter((e) => e.category === category).reduce((a, e) => a + e.amount, 0),
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const recent = [...data.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="How the shop is doing at a glance."
        action={
          <label className="flex items-center gap-2 text-sm text-muted">
            Period
            <select
              className={`${inputCls} w-40`}
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
            >
              {Object.entries(RANGE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={money(revenue, currency)}
          hint={refunds > 0 ? `After ${money(refunds, currency)} in refunds` : "Sales minus refunds"}
        />
        <StatCard label="Restock spend" value={money(restocks, currency)} hint="Buying inventory" />
        <StatCard label="Expenses" value={money(expenseTotal, currency)} hint="Running costs" />
        <StatCard
          label="Net profit"
          value={money(net, currency)}
          hint={net >= 0 ? "▲ In the black" : "▼ Spending exceeds revenue"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CashflowChart months={months} currency={currency} />
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Expenses by category</h2>
          <p className="text-sm text-muted">{RANGE_LABEL[range]}</p>
          {byCategory.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No expenses in this period.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {byCategory.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{c.category}</span>
                    <span className="tabular-nums text-muted">{money(c.total, currency)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2">
                    <div
                      className="h-2 rounded-full bg-series-out"
                      style={{ width: `${(c.total / byCategory[0].total) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="font-semibold">Inventory</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ["Toys listed", String(data.toys.length)],
              ["Units in stock", String(units)],
              ["Retail value", money(retailTotal, currency)],
              ["Cost value", money(costTotal, currency)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {can("inventory.view") && (
            <Link href="/inventory" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
              Open inventory →
            </Link>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Needs restocking</h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Everything is well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {attention.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-7 shrink-0 overflow-hidden rounded-md border border-line">
                      <ToyCover toy={t} compact />
                    </span>
                    <span className="truncate">{t.name}</span>
                  </span>
                  {totalStock(t) === 0 ? (
                    <Badge tone="red">Out of stock</Badge>
                  ) : (
                    <Badge tone="amber">{totalStock(t)} left</Badge>
                  )}
                </li>
              ))}
              {attention.length > 6 && (
                <li className="text-muted">and {attention.length - 6} more</li>
              )}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Recent transactions</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {TRANSACTION_LABEL[t.type]} · {t.toyName}
                    </span>
                    <span className="text-xs text-muted">{formatDate(t.date)}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {signedAmount(t) > 0 ? "+" : "−"}
                    {money(t.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {can("transactions.view") && (
            <Link href="/transactions" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
              All transactions →
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}

function CashflowChart({
  months,
  currency,
}: {
  months: { key: string; moneyIn: number; moneyOut: number }[];
  currency: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(1, ...months.flatMap((m) => [m.moneyIn, m.moneyOut]));
  const ticks = [1, 0.5, 0];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Money in vs. money out</h2>
          <p className="text-sm text-muted">Last 6 months</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-in" /> Money in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-series-out" /> Money out
          </span>
          <button
            type="button"
            className="text-muted underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>

      {asTable ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-medium">Month</th>
              <th className="py-2 text-right font-medium">Money in</th>
              <th className="py-2 text-right font-medium">Money out</th>
              <th className="py-2 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key} className="border-b border-line last:border-0">
                <td className="py-2">{monthLabel(m.key, true)}</td>
                <td className="py-2 text-right tabular-nums">{money(m.moneyIn, currency)}</td>
                <td className="py-2 text-right tabular-nums">{money(m.moneyOut, currency)}</td>
                <td className="py-2 text-right tabular-nums">
                  {money(m.moneyIn - m.moneyOut, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 flex gap-2">
          <div className="flex h-48 flex-col justify-between text-right text-xs text-muted tabular-nums">
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
                {compactMoney(peak * t, currency)}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-48 border-b border-line">
              <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
              <div className="relative flex h-full">
                {months.map((m, i) => (
                  <div
                    key={m.key}
                    tabIndex={0}
                    aria-label={`${monthLabel(m.key, true)}: ${money(m.moneyIn, currency)} in, ${money(m.moneyOut, currency)} out`}
                    className={`relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md px-1 ${
                      hovered === i ? "bg-surface-2" : ""
                    }`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                  >
                    <div
                      className="w-full max-w-6 rounded-t bg-series-in"
                      style={{ height: `${(m.moneyIn / peak) * 100}%` }}
                    />
                    <div
                      className="w-full max-w-6 rounded-t bg-series-out"
                      style={{ height: `${(m.moneyOut / peak) * 100}%` }}
                    />
                    {hovered === i && (
                      <div
                        className={`pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg ${
                          i >= months.length / 2 ? "right-full mr-1" : "left-full ml-1"
                        }`}
                      >
                        <p className="mb-1.5 font-medium">{monthLabel(m.key, true)}</p>
                        <p className="flex justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="size-2 rounded-sm bg-series-in" /> In
                          </span>
                          <span className="tabular-nums">{money(m.moneyIn, currency)}</span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="size-2 rounded-sm bg-series-out" /> Out
                          </span>
                          <span className="tabular-nums">{money(m.moneyOut, currency)}</span>
                        </p>
                        <p className="mt-1.5 flex justify-between gap-2 border-t border-line pt-1.5">
                          <span className="text-muted">Net</span>
                          <span className="font-medium tabular-nums">
                            {money(m.moneyIn - m.moneyOut, currency)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex text-xs text-muted">
              {months.map((m) => (
                <span key={m.key} className="flex-1 text-center">
                  {monthLabel(m.key)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
