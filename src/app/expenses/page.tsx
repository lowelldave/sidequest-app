import type { Metadata } from "next";
import { Expenses } from "@/components/Expenses";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return <Expenses />;
}
