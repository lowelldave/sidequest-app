import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { RolesSettings } from "@/components/settings/RolesSettings";

export const metadata: Metadata = { title: "Roles" };

export default function Page() {
  return (
    <Gate permission="admin">
      <RolesSettings />
    </Gate>
  );
}
