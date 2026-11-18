"use client";

import type { ReactNode } from "react";
import { useShopSettings } from "@/lib/shop";
import { ShopLogo } from "../ShopLogo";

/** The centred card used by the sign-in and password pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const shop = useShopSettings();
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <ShopLogo className="h-24 w-auto" />
        <p className="sr-only">{shop.name}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
