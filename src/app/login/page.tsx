import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    // useSearchParams (for ?next=) needs a Suspense boundary.
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
