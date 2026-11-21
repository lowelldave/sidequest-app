"use client";

import { useRef, useState } from "react";
import { useCan } from "@/lib/account";
import { money } from "@/lib/format";
import { useShopSettings } from "@/lib/shop";
import { importToys } from "@/lib/store";
import {
  IMPORT_DEFAULT_REORDER_LEVEL,
  MAX_IMPORT_TOYS,
  SAMPLE_IMPORT_FILENAME,
  analyseToyCsv,
  importPayload,
  sampleImportCsv,
  type ImportAnalysis,
  type ImportDuplicate,
} from "@/lib/toyImport";
import type { QualityStock, Toy } from "@/lib/types";
import { toast } from "./toast";
import { Button, FormError, Modal, ModalActions } from "./ui";

/** How many problem rows to list before "and N more". */
const PROBLEMS_SHOWN = 8;

function downloadSample() {
  const blob = new Blob([sampleImportCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = SAMPLE_IMPORT_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

function qualitiesText(qualities: QualityStock[], currency: string) {
  return qualities.map((q) => `${q.quality} · ${q.stock} in stock · ${money(q.price, currency)}`).join(", ");
}

/**
 * Imports many toys from a CSV file. Step 1 reads and checks the file (nothing is
 * saved), step 2 lists the toys that already exist so the person decides which stay
 * as they are, then everything is saved together.
 */
export function ImportToys({
  toys,
  currency,
  onClose,
}: {
  toys: Toy[];
  currency: string;
  onClose: () => void;
}) {
  const shop = useShopSettings();
  const can = useCan();
  const canUpdate = can("inventory.edit");
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [step, setStep] = useState<"file" | "duplicates">("file");
  // Duplicates whose current toy stays as it is. Everything starts kept: nothing is overwritten by accident.
  const [kept, setKept] = useState<Set<ImportDuplicate>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setAnalysis(null);
      return setError(`Couldn't read "${file.name}".`);
    }
    const result = analyseToyCsv(text, toys, {
      reorderLevel: IMPORT_DEFAULT_REORDER_LEVEL,
      quality: shop.default_quality,
    });
    setAnalysis(result);
    setKept(new Set(result.duplicates));
    setStep("file");
  }

  const fresh = analysis?.fresh ?? [];
  const duplicates = analysis?.duplicates ?? [];
  const updates = duplicates.filter((d) => !kept.has(d));
  const toSave = fresh.length + updates.length;

  async function run() {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    const result = await importToys(importPayload(fresh, updates));
    setBusy(false);
    if ("error" in result) return setError(result.error);
    const parts = [
      result.created > 0 ? `${result.created} added` : "",
      result.updated > 0 ? `${result.updated} updated` : "",
    ].filter(Boolean);
    toast({ tone: "success", title: "Toys imported", message: parts.join(" · ") });
    onClose();
  }

  function toggleKept(d: ImportDuplicate) {
    setKept((all) => {
      const next = new Set(all);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  // ---- Step 2: the duplicates ----
  if (step === "duplicates" && analysis) {
    const allKept = kept.size === duplicates.length;
    return (
      <Modal title="Duplicate toys found" onClose={onClose} size="xl">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            These {duplicates.length === 1 ? "toy is" : `${duplicates.length} toys are`} already in your inventory.
            Tick <strong className="text-foreground">Keep current</strong> to leave a toy as it is. Untick it to
            replace its details, prices and the stock of the qualities in the file with the file&apos;s. Its pictures
            and any other qualities are never touched.
          </p>
          {!canUpdate && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              Your role can&apos;t edit toys, so these stay as they are.
            </p>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {kept.size} kept · {updates.length} to replace
            </span>
            {canUpdate && (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => setKept(allKept ? new Set() : new Set(duplicates))}
              >
                {allKept ? "Untick all" : "Keep all"}
              </button>
            )}
          </div>

          {/* The dialog scrolls as a whole on a phone; only a wide screen gets a list with its own scroll. */}
          <ul className="divide-y divide-line rounded-lg border border-line sm:max-h-[50dvh] sm:overflow-y-auto">
            {duplicates.map((d) => {
              const checked = kept.has(d);
              return (
                <li key={d.imported.lines[0]} className="p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-[var(--accent)] sm:mt-1 sm:size-4"
                      checked={checked}
                      disabled={!canUpdate}
                      onChange={() => toggleKept(d)}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{d.existing.name}</span>
                        <span className="text-xs text-muted">
                          matched by {d.matchedBy === "sku" ? `SKU ${d.existing.sku}` : "name"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        <span className="font-medium text-foreground">Current:</span>{" "}
                        {qualitiesText(d.existing.qualities, currency)}
                      </span>
                      <span className="block text-xs text-muted">
                        <span className="font-medium text-foreground">In the file:</span>{" "}
                        {qualitiesText(d.imported.qualities, currency)}
                      </span>
                      {/* On a phone the choice is written under the toy (the pill at the side is for wider screens). */}
                      <span
                        className={`mt-1 block text-xs font-medium sm:hidden ${
                          checked ? "text-muted" : "text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {checked ? "Keep current toy" : "Replace with the file's"}
                      </span>
                    </span>
                    <span
                      className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${
                        checked ? "bg-surface-2 text-muted" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {checked ? "Keep current" : "Replace"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <FormError message={error} />
          <ModalActions
            className="mt-0!"
            start={
              <Button onClick={() => setStep("file")} disabled={busy}>
                Back
              </Button>
            }
          >
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void run()} disabled={busy || toSave === 0}>
              {busy
                ? "Importing…"
                : toSave === 0
                  ? "Nothing to import"
                  : `Import ${toSave} ${toSave === 1 ? "toy" : "toys"}`}
            </Button>
          </ModalActions>
        </div>
      </Modal>
    );
  }

  // ---- Step 1: the file ----
  const problems = analysis?.problems ?? [];
  return (
    <Modal title="Import toys" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Choose a CSV file with one row for each quality of a toy. Rows with the same name and SKU become one toy.
          Nothing is saved until you confirm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button variant="primary" onClick={() => fileInput.current?.click()}>
            {fileName ? "Choose another file" : "Choose CSV file"}
          </Button>
          <Button onClick={downloadSample}>Download sample file</Button>
          {fileName && <span className="truncate text-sm text-muted">{fileName}</span>}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">What the columns mean</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              <strong className="text-foreground">name</strong> and <strong className="text-foreground">price</strong>{" "}
              are required.
            </li>
            <li>
              <strong className="text-foreground">category</strong>: Figures, Plush, Model Kits or Collectibles
              (blank means Figures).
            </li>
            <li>
              <strong className="text-foreground">quality</strong>: MISB, MIB, BIB, Loose or Damaged (blank means{" "}
              {shop.default_quality}).
            </li>
            <li>
              <strong className="text-foreground">cost</strong> and <strong className="text-foreground">stock</strong>{" "}
              default to 0. Stock is set to the number in the file; record deliveries in Transactions.
            </li>
            <li>
              <strong className="text-foreground">reorder_level</strong> blank means {IMPORT_DEFAULT_REORDER_LEVEL}.
              Up to {MAX_IMPORT_TOYS} toys per file.
            </li>
          </ul>
        </details>

        <FormError message={error ?? analysis?.fileError ?? null} />

        {analysis && !analysis.fileError && (
          <div className="space-y-3 rounded-lg bg-surface-2 px-3 py-3 text-sm">
            <p className="font-medium">
              {fresh.length} new {fresh.length === 1 ? "toy" : "toys"} · {duplicates.length}{" "}
              {duplicates.length === 1 ? "duplicate" : "duplicates"} · {problems.length}{" "}
              {problems.length === 1 ? "problem" : "problems"}
            </p>
            {problems.length > 0 && (
              <div>
                <p className="text-muted">
                  These rows can&apos;t be imported. Fix them in the file and choose it again, or import the rest.
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {problems.slice(0, PROBLEMS_SHOWN).map((p) => (
                    <li key={`${p.line}-${p.message}`}>
                      <span className="text-muted">Line {p.line}:</span> {p.message}
                    </li>
                  ))}
                </ul>
                {problems.length > PROBLEMS_SHOWN && (
                  <p className="mt-1 text-muted">and {problems.length - PROBLEMS_SHOWN} more.</p>
                )}
              </div>
            )}
          </div>
        )}

        <ModalActions className="mt-0!">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {duplicates.length > 0 ? (
            <Button variant="primary" onClick={() => setStep("duplicates")} disabled={busy}>
              Review {duplicates.length} {duplicates.length === 1 ? "duplicate" : "duplicates"}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void run()} disabled={busy || toSave === 0}>
              {busy ? "Importing…" : toSave === 0 ? "Import" : `Import ${toSave} ${toSave === 1 ? "toy" : "toys"}`}
            </Button>
          )}
        </ModalActions>
      </div>
    </Modal>
  );
}
