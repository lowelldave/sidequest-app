"use client";

import { applyThemePreference, savePreferences, useAccount, type Preferences } from "@/lib/account";
import { Chip } from "./ui";

type Mode = NonNullable<Preferences["theme"]>;

const MODES: { value: Mode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "Match this device", icon: "🖥️" },
];

/**
 * Light, dark, or follow the device. It's the signed-in person's own choice: it applies
 * at once and is saved to their account, so it follows them to other devices.
 */
export function ThemeMode() {
  const account = useAccount();
  const current: Mode = (account.status === "signed-in" && account.profile?.preferences.theme) || "system";

  return (
    <div role="group" aria-label="Light or dark" className="flex flex-wrap gap-2">
      {MODES.map((m) => (
        <Chip
          key={m.value}
          active={current === m.value}
          onClick={() => {
            applyThemePreference(m.value);
            savePreferences({ theme: m.value });
          }}
        >
          <span aria-hidden="true">{m.icon} </span>
          {m.label}
        </Chip>
      ))}
    </div>
  );
}
