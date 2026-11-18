import type { Metadata } from "next";
import { NewPasswordFromLink } from "@/components/auth/EmailLink";

export const metadata: Metadata = { title: "Choose a password" };

/** Where password-reset and invitation emails land: the person picks a password here. */
export default function ResetPage() {
  return <NewPasswordFromLink />;
}
