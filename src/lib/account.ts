"use client";

import type { User } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import type { Permission } from "./permissions";
import { getSupabase } from "./supabase/client";
import { followSystemTheme, setTheme, type Theme } from "./theme";

export function applyThemePreference(theme: Theme | "system" | undefined) {
  if (theme === "system") followSystemTheme();
  else if (theme) setTheme(theme);
}

/**
 * The signed-in person: their Supabase account, profile and what their role
 * lets them do. Components read it with `useAccount()`; sign-in, sign-out and
 * profile changes go through the functions below.
 *
 * What a role allows is enforced by the database. The checks here only decide
 * what to show, so a page never offers something the database would refuse.
 */

export type Preferences = {
  /** "system" follows the device's light/dark setting. */
  theme?: Theme | "system";
  inventoryView?: "list" | "gallery";
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_path: string;
  role_id: string | null;
  active: boolean;
  must_change_password: boolean;
  preferences: Preferences;
  created_at: string;
};

export type Access = {
  active: boolean;
  must_change_password: boolean;
  role_id: string | null;
  role_name: string | null;
  is_admin: boolean;
  permissions: Permission[];
};

export type AccountState =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      user: User;
      profile: Profile | null;
      access: Access | null;
      /** Set if the profile couldn't be loaded. */
      error: string | null;
    };

export const AVATAR_BUCKET = "avatars";

let state: AccountState = { status: "loading" };
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: AccountState) {
  state = next;
  emit();
}

function start() {
  if (started) return;
  started = true;
  const supabase = getSupabase();
  supabase.auth.onAuthStateChange((event, session) => {
    // Supabase calls this while holding its session lock, so database calls must
    // wait until it returns.
    setTimeout(() => {
      if (!session) {
        set({ status: "signed-out" });
        return;
      }
      const current = state.status === "signed-in" ? state : null;
      if (current && current.user.id === session.user.id && event === "TOKEN_REFRESHED") return;
      void loadAccount(session.user);
    }, 0);
  });
}

async function loadAccount(user: User) {
  const supabase = getSupabase();
  try {
    const [profile, access] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.rpc("my_access"),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    if (access.error) throw new Error(access.error.message);
    const p = profile.data as Profile | null;
    set({
      status: "signed-in",
      user,
      profile: p ? { ...p, preferences: p.preferences ?? {} } : null,
      access: (access.data as Access | null) ?? null,
      error: null,
    });
    // Their saved theme follows them to every device.
    applyThemePreference(p?.preferences?.theme);
  } catch (e) {
    set({ status: "signed-in", user, profile: null, access: null, error: errorText(e) });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

/** The same object every time: React needs a stable value for the server render. */
const LOADING: AccountState = { status: "loading" };

export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/** For modules outside React (the data store). */
export function getAccount(): AccountState {
  return state;
}

export function subscribeAccount(listener: () => void): () => void {
  return subscribe(listener);
}

/** Whether the signed-in person's role allows `permission`. */
export function hasPermission(account: AccountState, permission: Permission): boolean {
  return account.status === "signed-in" && !!account.access?.permissions.includes(permission);
}

export function isAdmin(account: AccountState): boolean {
  return account.status === "signed-in" && !!account.access?.is_admin;
}

/** A function telling whether the signed-in person may do something. */
export function useCan(): (permission: Permission) => boolean {
  const account = useAccount();
  return (permission) => hasPermission(account, permission);
}

/** Reloads the profile and access, for example after the admin changed them. */
export async function refreshAccount() {
  const { data } = await getSupabase().auth.getUser();
  if (data.user) await loadAccount(data.user);
}

export function displayName(profile: Pick<Profile, "display_name" | "email"> | null | undefined): string {
  if (!profile) return "";
  return profile.display_name.trim() || profile.email;
}

export function avatarUrl(path: string): string {
  return getSupabase().storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- Signing in and out ----------

function origin(): string {
  return window.location.origin;
}

function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong.";
}

/** Friendlier wording for the errors people actually hit. */
function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) {
    return "This email address hasn't been confirmed yet. Open the link in the confirmation email first.";
  }
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  return error ? authError(error.message) : null;
}

/**
 * Creates the first account, which becomes the shop's admin. Returns whether
 * the email address must be confirmed before signing in.
 */
export async function createFirstAdmin(
  email: string,
  password: string,
  name: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: name.trim() },
      emailRedirectTo: `${origin()}/auth/callback`,
    },
  });
  if (error) return { error: authError(error.message), needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

export async function shopNeedsAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("shop_needs_admin");
  return !error && data === true;
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin()}/auth/reset`,
  });
  return error ? authError(error.message) : null;
}

/**
 * Signs in from a link in an email (confirmation, password reset, invitation
 * or email change). Supabase puts either a one-time `code` in the query or the
 * session itself in the URL fragment. Returns an error message, or null once
 * signed in.
 */
export async function signInFromEmailLink(): Promise<string | null> {
  const supabase = getSupabase();
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const linkError = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (linkError) {
    return /expired|invalid/i.test(linkError)
      ? "This link has expired or was already used. Ask for a new one."
      : linkError;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    // Don't leave the tokens in the address bar or history.
    window.history.replaceState(null, "", url.pathname + url.search);
    if (error) return authError(error.message);
  }

  // The client usually trades the code in by itself as it starts; do it here if it hasn't.
  const code = url.searchParams.get("code");
  let { data } = await supabase.auth.getSession();
  if (!data.session && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return "This link has expired, was already used, or was opened in a different browser.";
    ({ data } = await supabase.auth.getSession());
  }
  return data.session ? null : "This link has expired or was already used. Ask for a new one.";
}

export const MIN_PASSWORD_LENGTH = 8;

/** Sets the signed-in person's password. */
export async function setPassword(password: string): Promise<string | null> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/should be different/i.test(error.message)) return "Choose a password different from the current one.";
    return authError(error.message);
  }
  await supabase.rpc("password_changed");
  await refreshAccount();
  return null;
}

/** Starts an email change. Supabase emails a confirmation link; the change applies once it's opened. */
export async function changeEmail(email: string): Promise<string | null> {
  const { error } = await getSupabase().auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${origin()}/auth/callback?next=/settings/security` },
  );
  return error ? authError(error.message) : null;
}

/**
 * Signs out. "local" ends this browser's session, "others" every other device's,
 * and "global" all of them.
 */
export async function signOut(scope: "local" | "others" | "global" = "local"): Promise<string | null> {
  const { error } = await getSupabase().auth.signOut({ scope });
  return error ? errorText(error.message) : null;
}

// ---------- Profile ----------

function signedInProfile(): Profile {
  if (state.status !== "signed-in" || !state.profile) throw new Error("You're not signed in.");
  return state.profile;
}

export async function updateProfile(patch: Partial<Pick<Profile, "display_name" | "avatar_path">>) {
  const profile = signedInProfile();
  const { error } = await getSupabase().from("profiles").update(patch).eq("id", profile.id);
  if (error) throw new Error(error.message);
  if (state.status === "signed-in" && state.profile) {
    set({ ...state, profile: { ...state.profile, ...patch } });
  }
}

/** Saves display preferences to the profile. Applies at once; saving happens in the background. */
export function savePreferences(patch: Preferences) {
  if (state.status !== "signed-in" || !state.profile) return;
  const preferences = { ...state.profile.preferences, ...patch };
  set({ ...state, profile: { ...state.profile, preferences } });
  void getSupabase().from("profiles").update({ preferences }).eq("id", state.profile.id);
}

/** Scales a picture to a 256 px square JPEG, uploads it as the profile picture and returns its path. */
export async function uploadAvatar(file: File): Promise<string> {
  const profile = signedInProfile();
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" isn't an image.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPG, PNG or WebP picture.`);
  }
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the picture.");
  // Crop the middle square.
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Couldn't process the picture.");

  const supabase = getSupabase();
  const path = `${profile.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(`Couldn't upload the picture: ${error.message}`);
  const old = profile.avatar_path;
  await updateProfile({ avatar_path: path });
  if (old) void supabase.storage.from(AVATAR_BUCKET).remove([old]);
  return path;
}

export async function removeAvatar() {
  const profile = signedInProfile();
  const old = profile.avatar_path;
  if (!old) return;
  await updateProfile({ avatar_path: "" });
  void getSupabase().storage.from(AVATAR_BUCKET).remove([old]);
}
