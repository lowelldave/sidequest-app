import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { ActivitySettings } from "@/components/settings/ActivitySettings";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return (
    <Gate>
      <ActivitySettings />
    </Gate>
  );
}
