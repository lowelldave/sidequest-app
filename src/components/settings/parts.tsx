"use client";

import type { ReactNode } from "react";

/** A titled block on a settings page. */
export function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="p-5">
        <h2 className="font-semibold">{title}</h2>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        <div className="mt-4">{children}</div>
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
      )}
    </section>
  );
}

export function SettingsStack({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
