"use client";

import { useEffect, useState } from "react";
import { displayName, isAdmin, useAccount, type Profile } from "@/lib/account";
import { getSupabase } from "@/lib/supabase/client";
import { Avatar } from "../Avatar";
import { Button, Chip } from "../ui";
import { Section } from "./parts";

type Entry = { id: number; user_id: string | null; action: string; summary: string; created_at: string };
type Person = Pick<Profile, "id" | "display_name" | "email" | "avatar_path">;

const PAGE = 50;

const AREA_ICON: Record<string, string> = {
  transactions: "🧾",
  inventory: "🧸",
  expenses: "💸",
  roles: "🛡️",
  people: "👤",
  shop: "🏪",
  data: "💾",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ActivitySettings() {
  const account = useAccount();
  const admin = isAdmin(account);
  const me = account.status === "signed-in" ? account.user.id : null;
  const [everyone, setEveryone] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPage(offset: number): Promise<Entry[]> {
    let query = getSupabase()
      .from("activity_log")
      .select("id, user_id, action, summary, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (!everyone && me) query = query.eq("user_id", me);
    const { data, error: problem } = await query;
    if (problem) throw new Error(problem.message);
    return (data ?? []) as Entry[];
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        setEntries(null);
        const page = await fetchPage(0);
        if (!live) return;
        setEntries(page);
        setMore(page.length === PAGE);
        if (everyone) {
          const { data } = await getSupabase().from("profiles").select("id, display_name, email, avatar_path");
          if (live) setPeople(new Map(((data ?? []) as Person[]).map((p) => [p.id, p])));
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Couldn't load the activity.");
      }
    })();
    return () => {
      live = false;
    };
    // fetchPage only depends on `everyone` and `me`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyone, me]);

  async function loadMore() {
    if (!entries) return;
    const page = await fetchPage(entries.length);
    setEntries([...entries, ...page]);
    setMore(page.length === PAGE);
  }

  return (
    <Section
      title="Activity"
      description={
        everyone
          ? "Everything recorded in the shop, newest first."
          : "What you've recorded and changed, newest first."
      }
    >
      {admin && (
        <div className="mb-4 flex gap-2">
          <Chip active={!everyone} onClick={() => setEveryone(false)}>
            Only mine
          </Chip>
          <Chip active={everyone} onClick={() => setEveryone(true)}>
            Everyone
          </Chip>
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {!entries && !error && <p className="animate-pulse text-sm text-muted">Loading…</p>}
      {entries && entries.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
      {entries && entries.length > 0 && (
        <ol className="divide-y divide-line">
          {entries.map((entry) => {
            const person = entry.user_id ? people.get(entry.user_id) : undefined;
            return (
              <li key={entry.id} className="flex items-start gap-3 py-2.5">
                {everyone ? (
                  <Avatar profile={person ?? null} size={28} />
                ) : (
                  <span aria-hidden="true" className="w-7 text-center text-lg leading-7">
                    {AREA_ICON[entry.action.split(".")[0]] ?? "•"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {everyone && (
                      <span className="font-medium">{person ? displayName(person) : "Someone (removed)"} · </span>
                    )}
                    {entry.summary}
                  </p>
                  <p className="text-xs text-muted">{when(entry.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {more && (
        <div className="mt-3 flex justify-center">
          <Button onClick={() => void loadMore()}>Show older</Button>
        </div>
      )}
    </Section>
  );
}
