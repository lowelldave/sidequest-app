"use client";

import { refreshAccount, type Profile } from "./account";
import type { Permission } from "./permissions";
import { getSupabase } from "./supabase/client";

/**
 * The admin's tools: roles, people and their access. The database refuses all
 * of these for anyone who isn't an active admin.
 */

export type Role = {
  id: string;
  name: string;
  description: string;
  is_admin: boolean;
  permissions: Permission[];
  created_at: string;
};

export type Person = Profile;

function fail(message: string | undefined): never {
  throw new Error(message ?? "Something went wrong.");
}

export async function listRoles(): Promise<Role[]> {
  const { data, error } = await getSupabase()
    .from("roles")
    .select("*")
    .order("is_admin", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) fail(error.message);
  return (data ?? []) as Role[];
}

export type RoleInput = Pick<Role, "name" | "description" | "permissions">;

function roleError(message: string): string {
  if (/duplicate key|roles_name_key/i.test(message)) return "There's already a role with that name.";
  if (/check constraint/i.test(message)) return "Give the role a name.";
  return message;
}

export async function createRole(input: RoleInput): Promise<Role> {
  const { data, error } = await getSupabase().from("roles").insert(input).select("*").single();
  if (error) fail(roleError(error.message));
  return data as Role;
}

export async function updateRole(id: string, input: RoleInput): Promise<Role> {
  const { data, error } = await getSupabase().from("roles").update(input).eq("id", id).select("*").maybeSingle();
  if (error) fail(roleError(error.message));
  if (!data) fail("That role can't be changed.");
  return data as Role;
}

export async function deleteRole(id: string) {
  const { error, count } = await getSupabase().from("roles").delete({ count: "exact" }).eq("id", id);
  if (error) fail(error.message);
  if (!count) fail("That role can't be deleted.");
}

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await getSupabase().from("profiles").select("*").order("created_at", { ascending: true });
  if (error) fail(error.message);
  return (data ?? []) as Person[];
}

/** Changes someone's role, or blocks/unblocks them. */
export async function setMemberAccess(userId: string, roleId: string | null, active: boolean) {
  const { error } = await getSupabase().rpc("admin_set_member", {
    p_user: userId,
    p_role: roleId,
    p_active: active,
  });
  if (error) fail(error.message);
  void refreshAccount();
}

type AdminUsersRequest =
  | { action: "create"; email: string; password: string; display_name: string; role_id: string }
  | { action: "invite"; email: string; display_name: string; role_id: string; redirect_to: string }
  | { action: "reset_password"; user_id: string; password: string }
  | { action: "delete"; user_id: string };

/** Calls the admin-users edge function, which holds the secret key needed to manage accounts. */
async function adminUsers(body: AdminUsersRequest): Promise<void> {
  const { error } = await getSupabase().functions.invoke("admin-users", { body });
  if (!error) return;
  // The function answers with { error: "…" }; show that rather than a generic HTTP message.
  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === "function") {
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) fail(payload.error);
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
  }
  fail(error.message);
}

export function createPerson(input: { email: string; password: string; displayName: string; roleId: string }) {
  return adminUsers({
    action: "create",
    email: input.email,
    password: input.password,
    display_name: input.displayName,
    role_id: input.roleId,
  });
}

export function invitePerson(input: { email: string; displayName: string; roleId: string }) {
  return adminUsers({
    action: "invite",
    email: input.email,
    display_name: input.displayName,
    role_id: input.roleId,
    redirect_to: `${window.location.origin}/auth/reset`,
  });
}

export function setTemporaryPassword(userId: string, password: string) {
  return adminUsers({ action: "reset_password", user_id: userId, password });
}

export function removePerson(userId: string) {
  return adminUsers({ action: "delete", user_id: userId });
}

/** A random, readable temporary password (no look-alike characters). */
export function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
