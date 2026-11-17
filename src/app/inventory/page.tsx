import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { Inventory } from "@/components/Inventory";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <Gate permission="inventory.view">
      <Inventory />
    </Gate>
  );
}
