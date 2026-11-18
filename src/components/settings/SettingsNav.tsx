"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdmin, useAccount } from "@/lib/account";
import { useIsMember } from "../Gate";

const MINE = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Sign-in and security" },
  { href: "/settings/activity", label: "Activity" },
];

const ADMIN = [
  { href: "/settings/people", label: "People" },
  { href: "/settings/roles", label: "Roles" },
  { href: "/settings/shop", label: "Shop setup" },
  { href: "/settings/backup", label: "Backup and restore" },
];

export function SettingsNav() {
  const pathname = usePathname();
  const account = useAccount();
  const admin = isAdmin(account);
  const member = useIsMember();

  const link = (item: { href: string; label: string }) => {
    const active = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
          active ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        {item.label}
      </Link>
    );
  };

  // Until the account is known (or if it can't be used yet), the page's Gate explains why.
  if (!member) return null;

  return (
    <nav aria-label="Settings" className="shrink-0 md:w-52">
      <div className="flex gap-1 overflow-x-auto md:flex-col">
        <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase md:block">
          Your account
        </p>
        {MINE.map(link)}
        {admin && (
          <>
            <p className="hidden px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted uppercase md:block">
              Shop administration
            </p>
            {ADMIN.map(link)}
          </>
        )}
      </div>
    </nav>
  );
}
