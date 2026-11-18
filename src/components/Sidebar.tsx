"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { displayName, hasPermission, signOut, useAccount } from "@/lib/account";
import type { Permission } from "@/lib/permissions";
import { Avatar } from "./Avatar";
import { ShopLogo } from "./ShopLogo";
import { toast } from "./toast";

const NAV: { href: string; label: string; icon: string; permission: Permission | null }[] = [
  { href: "/", label: "Dashboard", icon: "📊", permission: "dashboard.view" },
  { href: "/inventory", label: "Inventory", icon: "🧸", permission: "inventory.view" },
  { href: "/transactions", label: "Transactions", icon: "🧾", permission: "transactions.view" },
  { href: "/expenses", label: "Expenses", icon: "💸", permission: "expenses.view" },
  { href: "/settings", label: "Settings", icon: "⚙️", permission: null },
];

export function Sidebar() {
  const pathname = usePathname();
  const account = useAccount();
  if (account.status !== "signed-in") return null;
  const profile = account.profile;
  const items = NAV.filter((item) => !item.permission || hasPermission(account, item.permission));

  async function leave() {
    const error = await signOut();
    if (error) toast({ tone: "error", title: "Couldn't sign out", message: error });
  }

  return (
    <aside className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-line bg-surface md:h-dvh md:w-60 md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 pt-4 md:px-5 md:pt-6">
        <Link href="/" aria-label="Home" className="md:flex md:w-full md:justify-center">
          <ShopLogo className="h-12 w-auto md:h-28" />
        </Link>
        <Link
          href="/settings/profile"
          className="ml-auto md:hidden"
          aria-label={`Your profile: ${displayName(profile)}`}
        >
          <Avatar profile={profile} size={36} />
        </Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-3 md:mt-4 md:flex-col md:px-3 md:py-0">
        {items.map((item) => {
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

      <div className="mt-auto hidden border-t border-line p-3 md:block">
        <Link
          href="/settings/profile"
          className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2"
        >
          <Avatar profile={profile} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{displayName(profile)}</span>
            <span className="block truncate text-xs text-muted">{account.access?.role_name ?? "No role"}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void leave()}
          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
