import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <Gate>
      <ProfileSettings />
    </Gate>
  );
}
