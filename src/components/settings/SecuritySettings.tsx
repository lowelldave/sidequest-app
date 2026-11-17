"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, changeEmail, setPassword, signOut, useAccount } from "@/lib/account";
import { getSupabase } from "@/lib/supabase/client";
import { toast } from "../toast";
import { Button, Field, FormError, inputCls } from "../ui";
import { Section, SettingsStack } from "./parts";

export function SecuritySettings() {
  return (
    <SettingsStack>
      <EmailSection />
      <PasswordSection />
      <SessionsSection />
    </SettingsStack>
  );
}

function EmailSection() {
  const account = useAccount();
  const user = account.status === "signed-in" ? account.user : null;
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (email.toLowerCase() === (user?.email ?? "").toLowerCase()) {
      setError("That's already your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const problem = await changeEmail(email);
    setBusy(false);
    if (problem) setError(problem);
    else {
      setSentTo(email);
      form.reset();
    }
  }

  return (
    <Section
      title="Email address"
      description={
        <>
          You sign in with <strong className="text-foreground">{user.email}</strong>.
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <Field label="New email address">
          <input name="email" type="email" autoComplete="email" required className={inputCls} />
        </Field>
        <FormError message={error} />
        {(sentTo || user.new_email) && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Waiting for confirmation of <strong>{sentTo ?? user.new_email}</strong>. Open the link we emailed to finish
            the change. Until then, keep signing in with your current address.
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Change email"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("confirm") ?? "")) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const problem = await setPassword(password);
    setBusy(false);
    if (problem) setError(problem);
    else {
      form.reset();
      toast({ tone: "success", title: "Password changed", message: "Use the new one next time you sign in." });
    }
  }

  return (
    <Section title="Password" description={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="New password">
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
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** A readable name for the browser and system, from the user agent. */
function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return system ? `${browser} on ${system}` : browser;
}

function SessionsSection() {
  const account = useAccount();
  const [signedInAt, setSignedInAt] = useState<string | null>(null);
  // Settings pages only render in the browser (after the account loads), so navigator exists.
  const [device] = useState(() => (typeof navigator === "undefined" ? "" : describeDevice(navigator.userAgent)));
  const [busy, setBusy] = useState<"others" | "global" | null>(null);

  useEffect(() => {
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        // When this session started: the token's "issued at" time is refreshed hourly,
        // so use the account's last sign-in instead.
        const last = data.session?.user.last_sign_in_at;
        if (last) setSignedInAt(new Date(last).toLocaleString());
      });
  }, []);

  async function end(scope: "others" | "global") {
    const message =
      scope === "others"
        ? "Sign out on every other phone, tablet and computer? This one stays signed in."
        : "Sign out everywhere, including here?";
    if (!confirm(message)) return;
    setBusy(scope);
    const problem = await signOut(scope);
    setBusy(null);
    if (problem) toast({ tone: "error", title: "Couldn't sign out", message: problem });
    else if (scope === "others") toast({ tone: "success", title: "Signed out on your other devices" });
  }

  return (
    <Section
      title="Where you're signed in"
      description="If you used a shared or lost device, sign out of it from here."
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            {device || "This device"} <span className="text-xs font-normal text-muted">· this device</span>
          </p>
          <p className="text-xs text-muted">
            {account.status === "signed-in" && signedInAt ? `Last signed in ${signedInAt}` : " "}
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Active
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Other devices can&apos;t be listed here, but you can end all of their sessions at once.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button onClick={() => void end("others")} disabled={!!busy}>
          {busy === "others" ? "Signing out…" : "Sign out other devices"}
        </Button>
        <Button variant="danger" onClick={() => void end("global")} disabled={!!busy}>
          {busy === "global" ? "Signing out…" : "Sign out everywhere"}
        </Button>
      </div>
    </Section>
  );
}
