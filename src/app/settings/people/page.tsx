import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { PeopleSettings } from "@/components/settings/PeopleSettings";

export const metadata: Metadata = { title: "People" };

export default function Page() {
  return (
    <Gate permission="admin">
      <PeopleSettings />
    </Gate>
  );
}
