"use client";

import { dismissSyncError, retryLoad, useLoadError, useSyncError } from "@/lib/store";
import { Button, Loading } from "./ui";

/** What a screen shows until the shop's data arrives: a skeleton, or the reason it couldn't load. */
export function ShopLoading() {
  const error = useLoadError();
  if (!error) return <Loading />;
  return (
    <div role="alert" className="rounded-xl border border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold">Couldn&apos;t load the shop&apos;s data</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{error}</p>
      <Button variant="primary" className="mt-4" onClick={retryLoad}>
        Try again
      </Button>
    </div>
  );
}

/** Appears when a change couldn't be saved to the database. */
export function SyncErrorBanner() {
  const error = useSyncError();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-[60] mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Not saved. </span>
        {error}
      </p>
      <button
        type="button"
        onClick={dismissSyncError}
        className="shrink-0 font-medium underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
