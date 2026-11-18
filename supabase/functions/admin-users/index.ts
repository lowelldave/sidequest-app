// Account management for the shop's admin: create, invite, reset passwords and
// remove people. These need the project's secret key, which must never reach the
// browser, so they run here. Every request must come from a signed-in, active admin.
//
// Body: { action: "create", email, password, display_name, role_id }
//     | { action: "invite", email, display_name, role_id, redirect_to }
//     | { action: "reset_password", user_id, password }
//     | { action: "delete", user_id }
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("No secret key is available to this function.");
  return legacy;
}

const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is asking, and are they an active admin?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in first." });
  const { data: who, error: whoError } = await admin.auth.getUser(token);
  if (whoError || !who.user) return reply(401, { error: "Your session has expired. Sign in again." });
  const { data: me } = await admin
    .from("profiles")
    .select("active, roles(is_admin)")
    .eq("id", who.user.id)
    .maybeSingle();
  const isAdmin = !!me?.active && !!(me.roles as { is_admin?: boolean } | null)?.is_admin;
  if (!isAdmin) return reply(403, { error: "Only an admin can manage people." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "The request wasn't valid JSON." });
  }
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");

  async function checkRole(roleId: string): Promise<string | null> {
    if (!roleId) return "Choose a role.";
    const { data } = await admin.from("roles").select("id").eq("id", roleId).maybeSingle();
    return data ? null : "That role no longer exists.";
  }

  async function setUpProfile(userId: string, displayName: string, roleId: string, mustChange: boolean) {
    const { error } = await admin
      .from("profiles")
      .update({ display_name: displayName, role_id: roleId, active: true, must_change_password: mustChange })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    await admin.from("activity_log").insert({
      user_id: who.user!.id,
      action: "people.create",
      summary: `Added ${displayName || text("email")}`,
    });
  }

  try {
    switch (body.action) {
      case "create": {
        const email = text("email").toLowerCase();
        const password = typeof body.password === "string" ? body.password : "";
        const roleId = text("role_id");
        if (!email.includes("@")) return reply(400, { error: "Enter a valid email address." });
        if (password.length < MIN_PASSWORD) {
          return reply(400, { error: `The temporary password needs at least ${MIN_PASSWORD} characters.` });
        }
        const roleProblem = await checkRole(roleId);
        if (roleProblem) return reply(400, { error: roleProblem });
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: text("display_name") },
        });
        if (error) return reply(400, { error: error.message });
        await setUpProfile(data.user.id, text("display_name"), roleId, true);
        return reply(200, { user_id: data.user.id });
      }

      case "invite": {
        const email = text("email").toLowerCase();
        const roleId = text("role_id");
        if (!email.includes("@")) return reply(400, { error: "Enter a valid email address." });
        const roleProblem = await checkRole(roleId);
        if (roleProblem) return reply(400, { error: roleProblem });
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { display_name: text("display_name") },
          redirectTo: text("redirect_to") || undefined,
        });
        if (error) return reply(400, { error: error.message });
        await setUpProfile(data.user.id, text("display_name"), roleId, false);
        return reply(200, { user_id: data.user.id });
      }

      case "reset_password": {
        const userId = text("user_id");
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < MIN_PASSWORD) {
          return reply(400, { error: `The temporary password needs at least ${MIN_PASSWORD} characters.` });
        }
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) return reply(400, { error: error.message });
        await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
        await admin.from("activity_log").insert({
          user_id: who.user.id,
          action: "people.edit",
          summary: "Set a temporary password for someone",
        });
        return reply(200, { ok: true });
      }

      case "delete": {
        const userId = text("user_id");
        if (userId === who.user.id) return reply(400, { error: "You can't remove your own account." });
        const { data: target } = await admin
          .from("profiles")
          .select("display_name, email")
          .eq("id", userId)
          .maybeSingle();
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) return reply(400, { error: error.message });
        await admin.from("activity_log").insert({
          user_id: who.user.id,
          action: "people.delete",
          summary: `Removed ${target?.display_name || target?.email || "someone"}`,
        });
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: "Unknown action." });
    }
  } catch (e) {
    return reply(500, { error: e instanceof Error ? e.message : "Something went wrong." });
  }
});
