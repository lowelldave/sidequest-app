"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { displayName, hasPermission, signOut, useAccount, type Profile } from "@/lib/account";
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

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Shown to a signed-in person who can use the app; see Navigation for what it looks like. */
export function Sidebar() {
  const pathname = usePathname();
  const account = useAccount();
  if (account.status !== "signed-in") return null;
  return (
    <Navigation
      pathname={pathname}
      profile={account.profile}
      roleName={account.access?.role_name ?? "No role"}
      items={NAV.filter((item) => !item.permission || hasPermission(account, item.permission))}
      onSignOut={async () => {
        const error = await signOut();
        if (error) toast({ tone: "error", title: "Couldn't sign out", message: error });
      }}
    />
  );
}

type NavItem = (typeof NAV)[number];

/**
 * Navigation. From the "md" size up it's a sidebar. On a phone it's a top bar with the
 * logo and one button that combines the profile picture and a burger icon; the button
 * opens a menu from the right with the profile, the pages and Sign out.
 */
export function Navigation({
  pathname,
  profile,
  roleName,
  items,
  onSignOut,
}: {
  pathname: string;
  profile: Profile | null;
  roleName: string;
  items: NavItem[];
  onSignOut: () => void | Promise<void>;
}) {
  // The page the menu was opened on: if the page changes (a link, the back button), it closes.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = openedOn === pathname;

  // The page behind the menu doesn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [open]);

  // Growing the window to the desktop layout closes the menu, since the sidebar takes over.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (wide.matches) setOpenedOn(null);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  function closeMenu() {
    setOpenedOn(null);
    menuButton.current?.focus();
  }

  // Escape closes the menu, and Tab stays inside it while it's open.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeMenu();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Phone: the top bar. */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface px-4 py-2 md:hidden">
        <Link href="/" aria-label="Home">
          <ShopLogo className="h-10 w-auto" />
        </Link>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpenedOn(pathname)}
          aria-label={`Open the menu. Signed in as ${displayName(profile)}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="ml-auto flex h-11 items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 transition-colors active:bg-surface-2"
        >
          <Avatar profile={profile} size={36} />
          <svg
            viewBox="0 0 20 20"
            className="size-5 text-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
      </header>

      {/* Phone: the menu. */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onKeyDown={onKeyDown}>
          <div className="modal-backdrop absolute inset-0 bg-black/50" onMouseDown={closeMenu} aria-hidden="true" />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="drawer-panel absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto overscroll-contain border-l border-line bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl"
          >
            <div className="flex items-start gap-1 border-b border-line p-2 pr-2">
              <Link
                href="/settings/profile"
                onClick={() => setOpenedOn(null)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 active:bg-surface-2"
              >
                <Avatar profile={profile} size={48} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{displayName(profile)}</span>
                  <span className="block truncate text-sm text-muted">{roleName}</span>
                  <span className="block text-xs font-medium text-accent">View your profile</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close the menu"
                autoFocus
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>

            <nav aria-label="Pages" className="flex flex-col gap-1 p-2">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenedOn(null)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors ${
                      active ? "bg-accent text-accent-fg" : "text-foreground active:bg-surface-2"
                    }`}
                  >
                    <span aria-hidden="true" className="w-6 text-center">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-line p-2">
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-muted active:bg-surface-2"
              >
                <span aria-hidden="true" className="w-6 text-center">
                  ↩
                </span>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop: the sidebar. */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 px-5 pt-6">
          <Link href="/" aria-label="Home" className="flex w-full justify-center">
            <ShopLogo className="h-28 w-auto" />
          </Link>
        </div>

        <nav className="mt-4 flex flex-col gap-1 px-3">
          {items.map((item) => {
            const active = isActive(item.href);
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

        <div className="mt-auto border-t border-line p-3">
          <Link href="/settings/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-2">
            <Avatar profile={profile} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{displayName(profile)}</span>
              <span className="block truncate text-xs text-muted">{roleName}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
