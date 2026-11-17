"use client";

import { avatarUrl, displayName, type Profile } from "@/lib/account";

/** A person's profile picture, or their initials on the accent colour. */
export function Avatar({
  profile,
  size = 32,
}: {
  profile: Pick<Profile, "display_name" | "email" | "avatar_path"> | null | undefined;
  size?: number;
}) {
  const name = displayName(profile) || "?";
  const initials =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  if (profile?.avatar_path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- stored pictures are already sized
      <img
        src={avatarUrl(profile.avatar_path)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
