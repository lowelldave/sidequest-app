"use client";

import { useEffect, useState, type FormEvent } from "react";
import { displayName, useAccount } from "@/lib/account";
import {
  createPerson,
  generatePassword,
  invitePerson,
  listPeople,
  listRoles,
  removePerson,
  setMemberAccess,
  setTemporaryPassword,
  type Person,
  type Role,
} from "@/lib/admin";
import { Avatar } from "../Avatar";
import { confirmDialog } from "../confirm";
import { toast } from "../toast";
import { Badge, Button, Chip, Field, FormError, Modal, ModalActions, inputCls } from "../ui";
import { Section } from "./parts";

export function PeopleSettings() {
  const account = useAccount();
  const me = account.status === "signed-in" ? account.user.id : null;
  const [people, setPeople] = useState<Person[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Person | null>(null);

  function reload() {
    return Promise.all([listPeople(), listRoles()]).then(
      ([p, r]) => {
        setPeople(p);
        setRoles(r);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load people."),
    );
  }

  useEffect(() => {
    void reload();
  }, []);

  async function change(person: Person, roleId: string | null, active: boolean) {
    try {
      await setMemberAccess(person.id, roleId, active);
      setPeople((all) => all?.map((p) => (p.id === person.id ? { ...p, role_id: roleId, active } : p)) ?? null);
      toast({ tone: "success", title: "Access updated", message: displayName(person) });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't change access", message: e instanceof Error ? e.message : "" });
    }
  }

  async function remove(person: Person) {
    const confirmed = await confirmDialog({
      title: `Remove ${displayName(person)}'s account?`,
      message: "They won't be able to sign in. What they recorded stays in the shop.",
      confirmLabel: "Remove account",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await removePerson(person.id);
      toast({ tone: "success", title: "Account removed", message: displayName(person) });
      await reload();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't remove the account", message: e instanceof Error ? e.message : "" });
    }
  }

  const waiting = people?.filter((p) => !p.role_id).length ?? 0;

  return (
    <>
      <Section
        title="People"
        description="Everyone who can sign in to the shop, and their role. Only you, as admin, can see this page."
        footer={
          <Button variant="primary" onClick={() => setAdding(true)} disabled={roles.length === 0}>
            + Add person
          </Button>
        }
      >
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        {!people && !error && <p className="animate-pulse text-sm text-muted">Loading…</p>}
        {waiting > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            {waiting === 1 ? "1 person is" : `${waiting} people are`} waiting for a role and can&apos;t use the shop
            yet.
          </p>
        )}
        {people && (
          <ul className="divide-y divide-line">
            {people.map((person) => {
              const self = person.id === me;
              return (
                <li key={person.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar profile={person} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {displayName(person)}
                      {self && <Badge>You</Badge>}
                      {!person.active && <Badge tone="red">Blocked</Badge>}
                      {person.must_change_password && <Badge tone="amber">Temporary password</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{person.email}</p>
                  </div>
                  <select
                    aria-label={`Role for ${displayName(person)}`}
                    className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
                    value={person.role_id ?? ""}
                    onChange={(e) => void change(person, e.target.value || null, person.active)}
                  >
                    <option value="">No role (no access)</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {!self && (
                    <div className="flex gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => void change(person, person.role_id, !person.active)}>
                        {person.active ? "Block" : "Unblock"}
                      </Button>
                      <Button variant="ghost" className="h-8 px-2" onClick={() => setResetting(person)}>
                        Reset password
                      </Button>
                      <Button variant="danger" className="h-8 px-2" onClick={() => void remove(person)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {adding && (
        <AddPerson
          roles={roles}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void reload();
          }}
        />
      )}
      {resetting && (
        <ResetPassword
          person={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

/** Shows a password the admin has to pass on, with a copy button. */
function PasswordToShare({ password }: { password: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
      <code className="flex-1 font-mono text-sm break-all">{password}</code>
      <Button
        className="h-8 px-3"
        onClick={() => {
          void navigator.clipboard?.writeText(password);
          toast({ tone: "success", title: "Password copied" });
        }}
      >
        Copy
      </Button>
    </div>
  );
}

function AddPerson({ roles, onClose, onAdded }: { roles: Role[]; onClose: () => void; onAdded: () => void }) {
  const [method, setMethod] = useState<"password" | "invite">("password");
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null);
  const defaultRole = roles.find((r) => !r.is_admin && r.name === "Cashier") ?? roles.find((r) => !r.is_admin) ?? roles[0];

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const displayName = String(fd.get("name") ?? "").trim();
    const roleId = String(fd.get("role") ?? "");
    setBusy(true);
    setError(null);
    try {
      if (method === "password") {
        await createPerson({ email, password, displayName, roleId });
        setCreated({ email, password });
      } else {
        await invitePerson({ email, displayName, roleId });
        setCreated({ email, password: null });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add them.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal title="Person added" onClose={onAdded}>
        {created.password ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{created.email}</strong> can sign in now with this temporary password. Pass it on privately;
              they&apos;ll choose their own the first time they sign in.
            </p>
            <PasswordToShare password={created.password} />
            <p className="text-xs text-muted">You won&apos;t see this password again.</p>
          </div>
        ) : (
          <p className="text-sm">
            An invitation is on its way to <strong>{created.email}</strong>. The link in it lets them choose a password
            and sign in.
          </p>
        )}
        <ModalActions>
          <Button variant="primary" onClick={onAdded}>
            Done
          </Button>
        </ModalActions>
      </Modal>
    );
  }

  return (
    <Modal title="Add person" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={method === "password"} onClick={() => setMethod("password")}>
            Temporary password
          </Chip>
          <Chip active={method === "invite"} onClick={() => setMethod("invite")}>
            Email invitation
          </Chip>
        </div>
        <p className="text-xs text-muted">
          {method === "password"
            ? "You give them a temporary password; they choose their own when they first sign in. Works without email."
            : "They get an email with a link to choose a password. Supabase's built-in email only reaches a few addresses an hour, and only your Supabase team's, until you set up your own email service (SMTP) in the Supabase dashboard."}
        </p>
        <Field label="Name">
          <input name="name" className={inputCls} autoComplete="off" required autoFocus />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className={inputCls} autoComplete="off" required />
        </Field>
        <Field label="Role">
          <select name="role" className={inputCls} defaultValue={defaultRole?.id}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        {method === "password" && (
          <Field label="Temporary password">
            <div className="flex gap-2">
              <input
                className={`${inputCls} font-mono`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button onClick={() => setPassword(generatePassword())}>New</Button>
            </div>
          </Field>
        )}
        <FormError message={error} />
        <ModalActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Adding…" : method === "password" ? "Create account" : "Send invitation"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function ResetPassword({ person, onClose, onDone }: { person: Person; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setTemporaryPassword(person.id, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password: ${displayName(person)}`} onClose={done ? onDone : onClose}>
      {done ? (
        <div className="space-y-3 text-sm">
          <p>Their new temporary password is below. They&apos;ll choose their own the next time they sign in.</p>
          <PasswordToShare password={password} />
          <ModalActions>
            <Button variant="primary" onClick={onDone}>
              Done
            </Button>
          </ModalActions>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">
            For someone who forgot their password. Their old password stops working straight away.
          </p>
          <Field label="Temporary password">
            <div className="flex gap-2">
              <input
                className={`${inputCls} font-mono`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button onClick={() => setPassword(generatePassword())}>New</Button>
            </div>
          </Field>
          <FormError message={error} />
          <ModalActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Set temporary password"}
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
