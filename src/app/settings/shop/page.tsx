import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { ShopSetup } from "@/components/settings/ShopSetup";

export const metadata: Metadata = { title: "Shop setup" };

export default function Page() {
  return (
    <Gate permission="admin">
      <ShopSetup />
    </Gate>
  );
}
