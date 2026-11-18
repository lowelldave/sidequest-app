"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  MIN_PASSWORD_LENGTH,
  hasPermission,
  isAdmin,
  refreshAccount,
  setPassword,
  signOut,
  useAccount,
} from "@/lib/account";
import { firstAllowedPage, type Permission } from "@/lib/permissions";
import { ShopLogo } from "./ShopLogo";
import { Button, Field, FormError, inputCls, PasswordInput } from "./ui";

/**
 * Shows `children` only to someone signed in whose account is usable and whose
 * role allows `permission` ("admin" for the admin's pages). Otherwise it shows
 * what's in the way: loading, sign-in, "waiting for access", and so on.
 *
 * Each page wraps itself in a Gate rather than the root layout deciding, so the
 * page is always part of the server render, which Next.js needs in order to
 * check that navigation between pages is instant.
 */
export function Gate({ permission, children }: { permission?: Permission | "admin"; children: ReactNode }) {
  const account = useAccount();

  if (account.status === "loading") return <PageLoading />;
  if (account.status === "signed-out") return <GoToSignIn />;

  const { access } = account;
  if (account.error || !access) {
    return (
      <Notice title="Couldn't load your account">
        <p>{account.error ?? "Your account has no profile. Ask the shop's admin to check it."}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={() => void refreshAccount()}>
            Try again
          </Button>
          <SignOutButton />
        </div>
      </Notice>
    );
  }
  if (!access.active) {
    return (
      <Notice title="Your account is blocked">
        <p>The shop&apos;s admin has switched off your access. Ask them if you think this is a mistake.</p>
        <div className="mt-4 flex justify-center">
          <SignOutButton />
        </div>
      </Notice>
    );
  }
  if (!access.role_id) {
    return (
      <Notice title="Waiting for access">
        <p>
          You&apos;re signed in as <strong>{account.user.email}</strong>, but you haven&apos;t been given a role yet.
          Ask the shop&apos;s admin to give you one in Settings → People.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="primary" onClick={() => void refreshAccount()}>
            Check again
          </Button>
          <SignOutButton />
        </div>
      </Notice>
    );
  }
  if (access.must_change_password) return <ChooseOwnPassword />;

  if (permission) {
    const allowed = permission === "admin" ? isAdmin(account) : hasPermission(account, permission);
    if (!allowed) {
      return (
        <NoAccess
          admin={permission === "admin"}
          home={firstAllowedPage((p) => hasPermission(account, p))}
        />
      );
    }
  }
  return <>{children}</>;
}

/** Whether the signed-in person can use the app at all; the sidebar shows only then. */
export function useIsMember(): boolean {
  const account = useAccount();
  return (
    account.status === "signed-in" &&
    !!account.access?.active &&
    !!account.access.role_id &&
    !account.access.must_change_password
  );
}

function NoAccess({ admin, home }: { admin: boolean; home: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // The dashboard is the default page; send people without it to the first page they can use.
  const redirect = pathname === "/" && home !== "/";

  useEffect(() => {
    if (redirect) router.replace(home);
  }, [redirect, home, router]);

  if (redirect) return <PageLoading />;
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <p className="text-lg font-semibold">You don&apos;t have access to this page</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {admin
          ? "Only the shop's admin can open this page."
          : "Your role doesn't include this page. Ask the shop's admin if you need it."}
      </p>
      <Link href={home} className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
        Go to a page you can use
      </Link>
    </div>
  );
}

function GoToSignIn() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [router, pathname]);
  return <PageLoading />;
}

function PageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center" aria-busy="true">
      <p className="animate-pulse text-sm text-muted">Loading…</p>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[80dvh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <ShopLogo className="mx-auto mb-4 h-20 w-auto" />
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

function SignOutButton() {
  return <Button onClick={() => void signOut()}>Sign out</Button>;
}

/** After the admin set a temporary password, the person picks their own before going further. */
function ChooseOwnPassword() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password !== String(fd.get("confirm") ?? "")) return setError("The two passwords don't match.");
    setBusy(true);
    const problem = await setPassword(password);
    setBusy(false);
    setError(problem);
  }

  return (
    <Notice title="Choose your own password">
      <p>You signed in with a temporary password from the admin. Pick a new one only you know.</p>
      <form onSubmit={submit} className="mt-5 space-y-3 text-left">
        <Field label="New password">
          <PasswordInput
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            autoFocus
            className={inputCls}
          />
        </Field>
        <Field label="Type it again">
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className={inputCls}
          />
        </Field>
        <FormError message={error} />
        <div className="flex justify-between gap-2 pt-1">
          <SignOutButton />
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </div>
      </form>
    </Notice>
  );
}
