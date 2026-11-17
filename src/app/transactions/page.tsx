import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { Transactions } from "@/components/Transactions";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <Gate permission="transactions.view">
      <Transactions />
    </Gate>
  );
}
