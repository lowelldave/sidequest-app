"use client";

import { useRef, useState } from "react";
import { getShopSettings } from "@/lib/shop";
import { clearAllData, exportRows, loadSampleData, replaceAllData, type DataRows } from "@/lib/store";
import { toast } from "../toast";
import { Button } from "../ui";
import { Section, SettingsStack } from "./parts";

/** What a backup file holds. */
type Backup = DataRows & {
  app: "sidequest";
  version: 1;
  exported_at: string;
  shop_name: string;
};

function isBackup(value: unknown): value is Backup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "sidequest" &&
    Array.isArray(v.toys) &&
    Array.isArray(v.toy_qualities) &&
    Array.isArray(v.transactions) &&
    Array.isArray(v.expenses)
  );
}

function counts(rows: DataRows): string {
  return `${rows.toys.length} toys, ${rows.transactions.length} transactions and ${rows.expenses.length} expenses`;
}

export function BackupSettings() {
  const [busy, setBusy] = useState<"export" | "restore" | "sample" | "clear" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function download() {
    setBusy("export");
    try {
      const rows = await exportRows();
      const backup: Backup = {
        app: "sidequest",
        version: 1,
        exported_at: new Date().toISOString(),
        shop_name: getShopSettings().name,
        ...rows,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sidequest-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ tone: "success", title: "Backup downloaded", message: counts(rows) });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't make the backup", message: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(null);
    }
  }

  async function restore(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    let backup: unknown;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      toast({ tone: "error", title: "That isn't a backup file", message: `"${file.name}" couldn't be read.` });
      return;
    }
    if (!isBackup(backup)) {
      toast({ tone: "error", title: "That isn't a SideQuest backup", message: `"${file.name}" is missing shop data.` });
      return;
    }
    const taken = new Date(backup.exported_at).toLocaleString();
    if (
      !confirm(
        `Replace everything in the shop with this backup from ${taken}?\n\nIt has ${counts(backup)}. ` +
          "Everything recorded since will be lost. Download a backup of the current data first if you might need it.",
      )
    ) {
      return;
    }
    setBusy("restore");
    const error = await replaceAllData(backup, `Restored a backup from ${taken}`);
    setBusy(null);
    if (error) toast({ tone: "error", title: "Couldn't restore the backup", message: `Nothing was changed. ${error}` });
    else toast({ tone: "success", title: "Backup restored", message: counts(backup) });
  }

  async function sample() {
    if (!confirm("Replace everything in the shop with the sample data? The current data will be lost.")) return;
    setBusy("sample");
    const error = await loadSampleData();
    setBusy(null);
    if (error) toast({ tone: "error", title: "Couldn't load the sample data", message: error });
    else toast({ tone: "success", title: "Sample data loaded" });
  }

  async function clear() {
    if (!confirm("Delete every toy, transaction and expense? This can't be undone.")) return;
    if (!confirm("Are you sure? Download a backup first if you might need this data.")) return;
    setBusy("clear");
    const error = await clearAllData();
    setBusy(null);
    if (error) toast({ tone: "error", title: "Couldn't clear the data", message: error });
    else toast({ tone: "success", title: "All shop data deleted" });
  }

  return (
    <SettingsStack>
      <Section
        title="Download a backup"
        description="Saves every toy, quality, transaction and expense to a file on this device. Keep it somewhere safe."
        footer={
          <Button variant="primary" onClick={() => void download()} disabled={!!busy}>
            {busy === "export" ? "Preparing…" : "Download backup"}
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Toy pictures aren&apos;t in the file: it lists them, and they stay in storage. People, roles and the shop setup
          aren&apos;t included either.
        </p>
      </Section>

      <Section
        title="Restore from a backup"
        description="Replaces all toys, transactions and expenses with the ones in a backup file, in one step. If anything goes wrong, nothing changes."
        footer={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => void restore(e.target.files?.[0])}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={!!busy}>
              {busy === "restore" ? "Restoring…" : "Choose backup file…"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">You&apos;ll see what&apos;s in the file and be asked to confirm before anything changes.</p>
      </Section>

      <Section
        title="Start over"
        description="For trying the app out, or starting fresh."
        footer={
          <>
            <Button onClick={() => void sample()} disabled={!!busy}>
              {busy === "sample" ? "Loading…" : "Load sample data"}
            </Button>
            <Button variant="danger" onClick={() => void clear()} disabled={!!busy}>
              {busy === "clear" ? "Deleting…" : "Delete all shop data"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Both replace everything that&apos;s there now.</p>
      </Section>
    </SettingsStack>
  );
}
