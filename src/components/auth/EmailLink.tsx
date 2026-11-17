"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, setPassword, signInFromEmailLink } from "@/lib/account";
import { Button, Field, FormError, inputCls } from "../ui";
import { AuthCard } from "./AuthCard";

/** Signs in from the email link once, however often React runs the effect. */
let pending: Promise<string | null> | null = null;
function useEmailLinkSignIn(): { done: boolean; error: string | null } {
  const [state, setState] = useState<{ done: boolean; error: string | null }>({ done: false, error: null });
  useEffect(() => {
    let live = true;
    pending ??= signInFromEmailLink();
    void pending.then((error) => {
      if (live) setState({ done: true, error });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function LinkProblem({ error }: { error: string }) {
  return (
    <AuthCard title="That link didn't work">
      <p className="text-sm text-muted">{error}</p>
      <Link href="/login" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
        Go to sign in
      </Link>
    </AuthCard>
  );
}

/** Email confirmations and email changes: sign in, then carry on into the app. */
export function EmailLinkCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const { done, error } = useEmailLinkSignIn();

  useEffect(() => {
    if (done && !error) router.replace(next);
  }, [done, error, next, router]);

  if (error) return <LinkProblem error={error} />;
  return <p className="animate-pulse text-sm text-muted">Signing you in…</p>;
}

/** Password resets and invitations: sign in from the link, then choose a password. */
export function NewPasswordFromLink() {
  const router = useRouter();
  const { done, error } = useEmailLinkSignIn();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("confirm") ?? "")) return setFormError("The two passwords don't match.");
    setBusy(true);
    const problem = await setPassword(password);
    setBusy(false);
    if (problem) setFormError(problem);
    else router.replace("/");
  }

  if (error) return <LinkProblem error={error} />;
  if (!done) return <p className="animate-pulse text-sm text-muted">Checking your link…</p>;
  return (
    <AuthCard title="Choose a password" subtitle={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoFocus
            className={inputCls}
          />
        </Field>
        <Field label="Type it again">
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className={inputCls}
          />
        </Field>
        <FormError message={formError} />
        <Button variant="primary" type="submit" disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save password and continue"}
        </Button>
      </form>
    </AuthCard>
  );
}
