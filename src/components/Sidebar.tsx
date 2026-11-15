"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearAllData, loadSampleData, updateSettings, useShop } from "@/lib/store";
import { CURRENCIES, type Currency } from "@/lib/types";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/inventory", label: "Inventory", icon: "🧸" },
  { href: "/transactions", label: "Transactions", icon: "🧾" },
  { href: "/expenses", label: "Expenses", icon: "💸" },
];

export function Sidebar() {
  const pathname = usePathname();
  const data = useShop();

  return (
    <aside className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-line bg-surface md:h-dvh md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-4 md:px-5 md:pt-6">
        <Link
          href="/"
          aria-label="SideQuest Toys and Figures, home"
          className="md:flex md:w-full md:justify-center"
        >
          {/* Two files because the lettering is dark brown in the original;
              logo-dark.png has it recoloured light for dark backgrounds. */}
          <Image
            src="/logo.png"
            alt="SideQuest: Toys and Figures"
            width={480}
            height={318}
            priority
            className="h-12 w-auto md:h-28 dark:hidden"
          />
          <Image
            src="/logo-dark.png"
            alt="SideQuest: Toys and Figures"
            width={480}
            height={318}
            priority
            className="hidden h-12 w-auto md:h-28 dark:block"
          />
        </Link>
        {data && (
          <select
            aria-label="Currency"
            className="ml-auto h-9 rounded-lg border border-line bg-surface px-2 text-sm md:hidden"
            value={data.settings.currency}
            onChange={(e) => updateSettings({ currency: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-3 md:mt-4 md:flex-col md:px-3 md:py-0">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {data && (
        <div className="mt-auto hidden space-y-3 border-t border-line p-4 text-sm md:block">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Currency</span>
            <select
              className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm"
              value={data.settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value as Currency })}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col items-start gap-1 text-xs">
            <button
              type="button"
              className="text-muted underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => {
                if (confirm("Replace everything with the sample data?")) loadSampleData();
              }}
            >
              Load sample data
            </button>
            <button
              type="button"
              className="text-muted underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => {
                if (confirm("Delete all toys, transactions and expenses? This can't be undone.")) {
                  clearAllData();
                }
              }}
            >
              Clear all data
            </button>
          </div>
          <p className="text-xs text-muted">Data is saved in this browser.</p>
        </div>
      )}
    </aside>
  );
}
