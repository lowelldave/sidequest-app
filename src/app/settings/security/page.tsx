import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

export const metadata: Metadata = { title: "Sign-in and security" };

export default function Page() {
  return (
    <Gate>
      <SecuritySettings />
    </Gate>
  );
}
