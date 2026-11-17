"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useIsMember } from "./Gate";
import { Sidebar } from "./Sidebar";

/** Pages that work without signing in. */
export function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/auth/");
}

/**
 * The frame around every page: the sidebar for people who can use the app, and
 * the main column. It always renders the page itself; each page decides who may
 * see it with a <Gate> (see Gate.tsx).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const member = useIsMember();

  if (isPublicPath(pathname)) {
    return <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-10">{children}</main>;
  }
  return (
    <>
      {member && <Sidebar />}
      <main className="min-w-0 flex-1 px-4 pt-6 pb-20 md:px-8 md:pt-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </>
  );
}
