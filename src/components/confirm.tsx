"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Button, Modal, ModalActions } from "./ui";

/**
 * Asks the person to confirm before something that can't be undone, in the app's own
 * dialog instead of the browser's pop-up. Use it like `confirm`, but wait for the answer:
 *
 *   if (!(await confirmDialog({ title: "Delete this toy?", confirmLabel: "Delete", tone: "danger" }))) return;
 *
 * `<ConfirmHost />` (mounted once in the root layout) shows the dialog. If several are
 * asked at once they appear one after another.
 */

type Options = {
  title: string;
  /** What will happen and whether it can be undone. Line breaks are kept. */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" makes the confirm button red and puts the cursor on Cancel. */
  tone?: "default" | "danger";
};

type Pending = Options & { id: number; resolve: (confirmed: boolean) => void };

const NONE: Pending[] = [];
let queue: Pending[] = NONE;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function confirmDialog(options: Options): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, id: nextId++, resolve }];
    emit();
  });
}

function answer(item: Pending, confirmed: boolean) {
  // Only the first answer counts (a click on the backdrop and a button could overlap).
  if (!queue.some((q) => q.id === item.id)) return;
  const rest = queue.filter((q) => q.id !== item.id);
  queue = rest.length === 0 ? NONE : rest;
  emit();
  item.resolve(confirmed);
}

export function ConfirmHost() {
  const list = useSyncExternalStore(
    subscribe,
    () => queue,
    () => NONE,
  );
  const item = list[0];
  if (!item) return null;

  const danger = item.tone === "danger";
  return (
    // Keyed so a second question that follows the first starts from a fresh dialog.
    <Modal key={item.id} title={item.title} onClose={() => answer(item, false)}>
      {item.message && <div className="text-sm whitespace-pre-line text-muted">{item.message}</div>}
      <ModalActions>
        {/* A destructive question starts on Cancel, so a stray Enter doesn't confirm it. */}
        <Button onClick={() => answer(item, false)} autoFocus={danger}>
          {item.cancelLabel ?? "Cancel"}
        </Button>
        <Button variant={danger ? "destructive" : "primary"} onClick={() => answer(item, true)} autoFocus={!danger}>
          {item.confirmLabel ?? "Confirm"}
        </Button>
      </ModalActions>
    </Modal>
  );
}
