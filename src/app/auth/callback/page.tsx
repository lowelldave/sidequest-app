import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailLinkCallback } from "@/components/auth/EmailLink";

export const metadata: Metadata = { title: "Signing in" };

/** Where links in confirmation and email-change emails land. */
export default function CallbackPage() {
  return (
    <Suspense>
      <EmailLinkCallback />
    </Suspense>
  );
}
