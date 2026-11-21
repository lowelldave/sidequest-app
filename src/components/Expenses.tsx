"use client";

import { useCan } from "@/lib/account";
import { useState, type FormEvent } from "react";
import { formatDate, money, todayISO } from "@/lib/format";
import { addExpense, deleteExpense, updateExpense, useShop, type ExpenseInput } from "@/lib/store";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type ShopData,
} from "@/lib/types";
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  FormError,
  Modal,
  PageHeader,
  StatCard,
  inputCls,
} from "./ui";
import { Pagination, usePagination } from "./Pagination";
import { ShopLoading } from "./status";

export function Expenses() {
  const data = useShop();
  if (!data) return <ShopLoading />;
  return <ExpensesView data={data} />;
}

function ExpensesView({ data }: { data: ShopData }) {
  const { currency } = data.settings;
  const can = useCan();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = data.expenses
    .filter(
      (e) =>
        (!q || `${e.vendor} ${e.description}`.toLowerCase().includes(q)) &&
        (categories.length === 0 || categories.includes(e.category)) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Back to the first page whenever the filters change. The totals above still count every match.
  const paging = usePagination(filtered, {
    storageKey: "toyshop:page-size:expenses",
    anchorId: "expenses-list",
    resetKey: JSON.stringify([q, categories, from, to]),
  });

  const total = filtered.reduce((a, e) => a + e.amount, 0);
  const thisMonth = todayISO().slice(0, 7);
  const monthTotal = data.expenses
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((a, e) => a + e.amount, 0);
  const largest = filtered.reduce<Expense | null>(
    (max, e) => (!max || e.amount > max.amount ? e : max),
    null,
  );
  const filtersActive = q !== "" || categories.length > 0 || !!from || !!to;

  function remove(e: Expense) {
    if (confirm(`Delete the ${money(e.amount, currency)} expense for "${e.description || e.vendor}"?`)) {
      deleteExpense(e.id);
    }
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Running costs of the shop, such as rent, wages and supplies."
        action={
          can("expenses.create") && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              + Add expense
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total shown" value={money(total, currency)} hint={`${filtered.length} expenses`} />
        <StatCard label="This month" value={money(monthTotal, currency)} hint="All categories" />
        <StatCard
          label="Average"
          value={money(filtered.length ? total / filtered.length : 0, currency)}
          hint="Per expense shown"
        />
        <StatCard
          label="Largest"
          value={money(largest?.amount ?? 0, currency)}
          hint={largest ? `${largest.category} · ${largest.vendor}` : "—"}
        />
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Search" className="col-span-2">
            <input
              type="search"
              className={inputCls}
              placeholder="Vendor or description"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="From">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">Category</p>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={categories.includes(c)}
                onClick={() =>
                  setCategories(
                    categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c],
                  )
                }
              >
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <p className="my-4 text-sm text-muted" aria-live="polite">
        Showing {filtered.length} of {data.expenses.length} expenses
        {filtersActive && (
          <>
            {" · "}
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => {
                setQuery("");
                setCategories([]);
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </button>
          </>
        )}
      </p>

      <div id="expenses-list" className="scroll-mt-4">
      {filtered.length === 0 ? (
        data.expenses.length === 0 ? (
          <EmptyState title="No expenses yet" hint="Add rent, utilities or any other cost of running the shop." />
        ) : (
          <EmptyState title="No expenses match these filters" hint="Try a wider date range or fewer filters." />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paging.pageItems.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <Badge>{e.category}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{e.vendor || "—"}</td>
                  <td className="px-4 py-3 text-muted">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {money(e.amount, currency)}
                  </td>
                  <td className="px-2 py-3 text-right whitespace-nowrap">
                    {can("expenses.edit") && (
                      <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing(e)}>
                        Edit
                      </Button>
                    )}
                    {can("expenses.delete") && (
                      <Button variant="danger" className="h-8 px-2" onClick={() => remove(e)}>
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
      </div>
      <Pagination paging={paging} noun="expenses" />

      {editing && (
        <ExpenseForm expense={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function ExpenseForm({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const input: ExpenseInput = {
      date: text("date") || todayISO(),
      category: text("category") as ExpenseCategory,
      vendor: text("vendor"),
      description: text("description"),
      amount: Number(fd.get("amount")),
    };
    if (!(input.amount > 0)) return setError("Enter an amount above zero.");
    if (expense) updateExpense(expense.id, input);
    else addExpense(input);
    onClose();
  }

  return (
    <Modal title={expense ? "Edit expense" : "Add expense"} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={inputCls}
            defaultValue={expense?.amount}
            autoFocus
            required
          />
        </Field>
        <Field label="Date">
          <input
            name="date"
            type="date"
            className={inputCls}
            defaultValue={expense?.date ?? todayISO()}
            required
          />
        </Field>
        <Field label="Category">
          <select name="category" className={inputCls} defaultValue={expense?.category ?? "Supplies"}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Vendor">
          <input name="vendor" className={inputCls} defaultValue={expense?.vendor} placeholder="Who you paid" />
        </Field>
        <Field label="Description" className="col-span-2">
          <input name="description" className={inputCls} defaultValue={expense?.description} />
        </Field>
        <div className="col-span-2">
          <FormError message={error} />
        </div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit">
            {expense ? "Save changes" : "Add expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
