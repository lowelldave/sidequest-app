import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { Expenses } from "@/components/Expenses";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <Gate permission="expenses.view">
      <Expenses />
    </Gate>
  );
}
