import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { BackupSettings } from "@/components/settings/BackupSettings";

export const metadata: Metadata = { title: "Backup and restore" };

export default function Page() {
  return (
    <Gate permission="admin">
      <BackupSettings />
    </Gate>
  );
}
