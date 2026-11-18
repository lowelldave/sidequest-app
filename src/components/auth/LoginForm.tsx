"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  MIN_PASSWORD_LENGTH,
  createFirstAdmin,
  sendPasswordReset,
  shopNeedsAdmin,
  signIn,
  useAccount,
} from "@/lib/account";
import { Button, Field, FormError, inputCls } from "../ui";
import { AuthCard } from "./AuthCard";

type Mode = "checking" | "sign-in" | "forgot" | "setup";

/** Only paths inside this app, so a link can't send someone elsewhere after signing in. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const account = useAccount();
  const [mode, setMode] = useState<Mode>("checking");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A sign-in link from an email that ended up here (its session is in the URL
  // fragment, which redirects keep): hand it to the page that finishes it.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!hash.has("access_token") && !hash.has("error_description")) return;
    const type = hash.get("type");
    const page = type === "invite" || type === "recovery" ? "/auth/reset" : "/auth/callback";
    window.location.replace(page + window.location.hash);
  }, []);

  // Before anyone has an account, this page sets up the shop's admin instead.
  useEffect(() => {
    let live = true;
    void shopNeedsAdmin().then((needs) => {
      if (live) setMode(needs ? "setup" : "sign-in");
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (account.status === "signed-in") router.replace(next);
  }, [account.status, next, router]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  function submitSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void run(async () => {
      const problem = await signIn(String(fd.get("email")), String(fd.get("password")));
      if (problem) setError(problem);
      // On success the account changes and the effect above moves on.
    });
  }

  function submitForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    void run(async () => {
      const problem = await sendPasswordReset(email);
      if (problem) setError(problem);
      else setNotice(`If ${email} has an account, a link to choose a new password is on its way. Check your inbox.`);
    });
  }

  function submitSetup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password !== String(fd.get("confirm"))) {
      setError("The two passwords don't match.");
      return;
    }
    void run(async () => {
      const result = await createFirstAdmin(String(fd.get("email")), password, String(fd.get("name")));
      if (result.error) setError(result.error);
      else if (result.needsConfirmation) {
        setMode("sign-in");
        setNotice("Account created. Open the confirmation link we emailed you, then sign in here.");
      }
    });
  }

  if (mode === "checking") {
    return <p className="animate-pulse text-sm text-muted">Loading…</p>;
  }

  if (mode === "setup") {
    return (
      <AuthCard
        title="Set up your shop"
        subtitle="Create the admin account. The admin manages people, roles and the shop's settings."
      >
        <form onSubmit={submitSetup} className="space-y-3">
          <Field label="Your name">
            <input name="name" autoComplete="name" required autoFocus className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={inputCls} />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
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
          <p className="text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <FormError message={error} />
          <Button variant="primary" type="submit" disabled={busy} className="w-full">
            {busy ? "Creating…" : "Create admin account"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthCard title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
        <form onSubmit={submitForgot} className="space-y-3">
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required autoFocus className={inputCls} />
          </Field>
          <FormError message={error} />
          {notice && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{notice}</p>}
          <Button variant="primary" type="submit" disabled={busy} className="w-full">
            {busy ? "Sending…" : "Send link"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted hover:text-foreground"
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setNotice(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={submitSignIn} className="space-y-3">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required autoFocus className={inputCls} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </Field>
        <FormError message={error} />
        {notice && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{notice}</p>}
        <Button variant="primary" type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-muted hover:text-foreground"
          onClick={() => {
            setMode("forgot");
            setError(null);
            setNotice(null);
          }}
        >
          Forgot your password?
        </button>
      </form>
      <p className="mt-5 border-t border-line pt-4 text-center text-xs text-muted">
        New staff accounts are created by the shop&apos;s admin.
      </p>
    </AuthCard>
  );
}
