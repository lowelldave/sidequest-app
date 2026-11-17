"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  applyThemePreference,
  removeAvatar,
  savePreferences,
  updateProfile,
  uploadAvatar,
  useAccount,
  type Preferences,
} from "@/lib/account";
import { Avatar } from "../Avatar";
import { toast } from "../toast";
import { Button, Field, FormError, inputCls } from "../ui";
import { Section, SettingsStack } from "./parts";

export function ProfileSettings() {
  const account = useAccount();
  if (account.status !== "signed-in" || !account.profile) return null;
  const { profile, access } = account;
  return (
    <SettingsStack>
      <NameAndPicture key={profile.id} />
      <Section title="Your role">
        <p className="text-sm">
          <span className="font-medium">{access?.role_name ?? "No role"}</span>
          <span className="text-muted"> · Only the shop&apos;s admin can change roles.</span>
        </p>
      </Section>
      <PreferencesSection preferences={profile.preferences} />
    </SettingsStack>
  );
}

function NameAndPicture() {
  const account = useAccount();
  const profile = account.status === "signed-in" ? account.profile : null;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"name" | "picture" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!profile) return null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("name");
    try {
      await updateProfile({ display_name: name.trim() });
      toast({ tone: "success", title: "Name saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name.");
    } finally {
      setBusy(null);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("picture");
    try {
      await uploadAvatar(file);
      toast({ tone: "success", title: "Profile picture updated" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the picture.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function clearPicture() {
    setBusy("picture");
    try {
      await removeAvatar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the picture.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Name and picture" description="Shown in the sidebar and in the shop's activity log.">
      <form onSubmit={saveName} className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <Avatar profile={profile} size={88} />
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="avatar-file"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <div className="flex gap-1">
            <Button
              className="h-8 px-3"
              onClick={() => fileInput.current?.click()}
              disabled={busy === "picture"}
            >
              {busy === "picture" ? "Uploading…" : profile.avatar_path ? "Change" : "Upload"}
            </Button>
            {profile.avatar_path && (
              <Button variant="ghost" className="h-8 px-2" onClick={() => void clearPicture()} disabled={!!busy}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <Field label="Display name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={profile.email}
              maxLength={80}
            />
          </Field>
          <Field label="Email">
            <input className={`${inputCls} opacity-70`} value={profile.email} readOnly />
          </Field>
          <p className="text-xs text-muted">Change your email in Sign-in and security.</p>
          <FormError message={error} />
          <div className="flex justify-end">
            <Button variant="primary" type="submit" disabled={busy === "name" || name.trim() === profile.display_name}>
              {busy === "name" ? "Saving…" : "Save name"}
            </Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

const THEME_OPTIONS: { value: NonNullable<Preferences["theme"]>; label: string }[] = [
  { value: "system", label: "Match this device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function PreferencesSection({ preferences }: { preferences: Preferences }) {
  const theme = preferences.theme ?? "system";
  const view = preferences.inventoryView ?? "gallery";
  return (
    <Section
      title="Preferences"
      description="Saved to your account, so they follow you to any device you sign in on."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Theme">
          <select
            className={inputCls}
            value={theme}
            onChange={(e) => {
              const next = e.target.value as NonNullable<Preferences["theme"]>;
              applyThemePreference(next);
              savePreferences({ theme: next });
            }}
          >
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inventory shows toys as">
          <select
            className={inputCls}
            value={view}
            onChange={(e) => savePreferences({ inventoryView: e.target.value as "list" | "gallery" })}
          >
            <option value="gallery">Gallery (pictures)</option>
            <option value="list">List (table)</option>
          </select>
        </Field>
      </div>
    </Section>
  );
}
