import type { Metadata } from "next";
import { Inventory } from "@/components/Inventory";

export const metadata: Metadata = { title: "Inventory" };

export default function InventoryPage() {
  return <Inventory />;
}
