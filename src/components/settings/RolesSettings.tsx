"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createRole, deleteRole, listPeople, listRoles, updateRole, type Role, type RoleInput } from "@/lib/admin";
import { ACTION_LABEL, PERMISSION_GROUPS, type Action, type Permission } from "@/lib/permissions";
import { toast } from "../toast";
import { Badge, Button, Field, FormError, Modal, inputCls } from "../ui";
import { Section, SettingsStack } from "./parts";

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];

export function RolesSettings() {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [members, setMembers] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Role | "new" | null>(null);

  function reload() {
    return Promise.all([listRoles(), listPeople()]).then(
      ([r, people]) => {
        setRoles(r);
        const counts = new Map<string, number>();
        for (const p of people) if (p.role_id) counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1);
        setMembers(counts);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the roles."),
    );
  }

  useEffect(() => {
    void reload();
  }, []);

  async function remove(role: Role) {
    const n = members.get(role.id) ?? 0;
    const warning =
      n > 0
        ? `\n\n${n} ${n === 1 ? "person has" : "people have"} this role and will lose access until you give them another one.`
        : "";
    if (!confirm(`Delete the role "${role.name}"?${warning}`)) return;
    try {
      await deleteRole(role.id);
      toast({ tone: "success", title: "Role deleted", message: role.name });
      await reload();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete the role", message: e instanceof Error ? e.message : "" });
    }
  }

  return (
    <SettingsStack>
      <Section
        title="Roles"
        description="A role decides which pages someone can open and what they can change there. Give each person a role in People."
        footer={
          <Button variant="primary" onClick={() => setEditing("new")}>
            + New role
          </Button>
        }
      >
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        {!roles && !error && <p className="animate-pulse text-sm text-muted">Loading…</p>}
        {roles && (
          <ul className="divide-y divide-line">
            {roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {role.name}
                    {role.is_admin && <Badge tone="violet">Built in</Badge>}
                    <span className="text-xs font-normal text-muted">
                      {members.get(role.id) ?? 0} {(members.get(role.id) ?? 0) === 1 ? "person" : "people"}
                    </span>
                  </p>
                  {role.description && <p className="text-sm text-muted">{role.description}</p>}
                  <PermissionSummary role={role} />
                </div>
                {role.is_admin ? (
                  <p className="text-xs text-muted">Always has full access.</p>
                ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setEditing(role)}>
                      Edit
                    </Button>
                    <Button variant="danger" className="h-8 px-2" onClick={() => void remove(role)}>
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {editing && (
        <RoleForm
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </SettingsStack>
  );
}

/** One line per page: what the role may do there. */
function PermissionSummary({ role }: { role: Role }) {
  if (role.is_admin) {
    return <p className="mt-1 text-xs text-muted">Every page and action, plus people, roles, shop setup and backups.</p>;
  }
  const parts = PERMISSION_GROUPS.map((group) => {
    const allowed = ACTIONS.filter((a) => {
      const p = group.actions[a]?.permission;
      return p && role.permissions.includes(p);
    });
    if (!allowed.includes("view")) return null;
    const extra = allowed.filter((a) => a !== "view").map((a) => ACTION_LABEL[a].toLowerCase());
    return `${group.page}${extra.length ? ` (${extra.join(", ")})` : " (view only)"}`;
  }).filter(Boolean);
  return (
    <p className="mt-1 text-xs text-muted">{parts.length ? parts.join(" · ") : "No pages: this role can't open anything."}</p>
  );
}

function RoleForm({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(group: (typeof PERMISSION_GROUPS)[number], action: Action) {
    const permission = group.actions[action]?.permission;
    if (!permission) return;
    const next = new Set(permissions);
    if (next.has(permission)) {
      next.delete(permission);
      // Without the page, its actions mean nothing.
      if (action === "view") {
        for (const a of ACTIONS) {
          const p = group.actions[a]?.permission;
          if (p) next.delete(p);
        }
      }
    } else {
      next.add(permission);
      // Doing anything on a page needs the page itself.
      const view = group.actions.view?.permission;
      if (view) next.add(view);
    }
    setPermissions(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the role a name.");
    const input: RoleInput = {
      name: name.trim(),
      description: description.trim(),
      permissions: [...permissions],
    };
    setBusy(true);
    setError(null);
    try {
      if (role) await updateRole(role.id, input);
      else await createRole(input);
      toast({ tone: "success", title: role ? "Role saved" : "Role created", message: input.name });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the role.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={role ? `Edit role: ${role.name}` : "New role"} onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
          </Field>
          <Field label="Description (optional)">
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              placeholder="What this role is for"
            />
          </Field>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Page</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-3 py-2.5 text-center font-medium">
                    {ACTION_LABEL[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <tr key={group.page} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium">{group.page}</td>
                  {ACTIONS.map((action) => {
                    const entry = group.actions[action];
                    if (!entry) {
                      return (
                        <td key={action} className="px-3 py-2.5 text-center text-muted" aria-label="Not applicable">
                          –
                        </td>
                      );
                    }
                    return (
                      <td key={action} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--accent)]"
                          checked={permissions.has(entry.permission)}
                          onChange={() => toggle(group, action)}
                          aria-label={`${group.page}: ${ACTION_LABEL[action]}`}
                          title={entry.hint}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Ticking an action also opens its page. Everyone can always reach their own Settings. Only the Admin role can
          manage people, roles, the shop setup and backups.
        </p>

        <FormError message={error} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : role ? "Save role" : "Create role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
