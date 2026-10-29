import { useCallback, useEffect, useState } from "react";

/** What a CAD app's server says when a newer text-to-cad is out (`cadgen/updates.py`). */
export interface UpdateNotice {
  /** The release offered. */
  latest: string;
  /** The release this install runs. */
  version: string;
  /** `A new version v0.9.0 of text-to-cad is available (currently on v0.8.1)` */
  text: string;
  /** The install command for this computer, which updates text-to-cad when run again: `curl -fsSL https://texttocad.dev/install.sh | sh`, or on Windows `irm https://www.texttocad.dev/install.ps1 | iex`. */
  command: string;
  /** What has the person's agent run it: ``Run `curl -fsSL https://texttocad.dev/install.sh | sh` to update text-to-cad to 0.9.0 (on Windows: `irm https://www.texttocad.dev/install.ps1 | iex`)``. */
  prompt: string;
  /** The install instructions (`https://www.texttocad.dev/install`), which lead to installing by hand. */
  instructions: string;
  /**
   * Where the engine updates itself, how far it has got; absent for a copy nothing updates by
   * itself (one installed by hand, a development install), whose update is the command's.
   * `pending`: the engine installs `release` within a day. `updating`: it is downloading or
   * installing `release` (`stage`). `updated`: `release` is installed on this computer, and what runs
   * the older one says how it gets the new one: `restart`, the agent app to restart (its name and a
   * note), or `handover`, a Viewer whose page may restart the engine itself. `failed`: it could not
   * install `release` (`error`, one line, says why).
   */
  auto?: {
    state: "pending" | "updating" | "updated" | "failed";
    release: string;
    stage?: "downloading" | "installing";
    error?: string;
    restart?: { app: string; note: string };
    handover?: true;
  };
}

/**
 * Whether the notice leaves the person something to do, and so shows: a copy the engine does not
 * update (the command), or the engine's update installed (a restart) or failed (Try again). One
 * pending or under way is the engine's business, and shows only in a card that started it.
 */
export function updateShows(notice: UpdateNotice): boolean {
  return !notice.auto || notice.auto.state === "updated" || notice.auto.state === "failed";
}

/** The engine's own update, started now (`POST /__cad/update`): `reason` says why it did not start. */
export type UpdateStart = () => Promise<{ started: boolean; reason?: string }>;

/**
 * The engine handing its port to the release it installed (`POST /__cad/restart`), as the host follows
 * it: `reason` names what still holds the engine; once it is `ok` the host waits for the new engine
 * (the page reloads when it answers), and `stayed`, where the host gives it, settles if the old one
 * still answers a minute on.
 */
export type UpdateRestart = () => Promise<{ ok: boolean; reason?: string; stayed?: Promise<void> }>;

/** The host's call to its server: whether a newer text-to-cad is out. */
export type UpdateCall = () => Promise<{ notice: UpdateNotice | null }>;

/** The pages' notices that read their server again when the update card opens (`readUpdateNotice`). */
const readers = new Set<() => void>();

/** Reads the host's call again, for every `useUpdateNotice`: what the update card does as it opens. */
export function readUpdateNotice(): void {
  for (const read of readers) read();
}

/**
 * The update button's state, from the host's server: what the host already knew as the page started
 * (`initial`: a CAD app's launch carries it, the web page reads it with its server's description), so
 * the button draws with the page rather than after it; then read again whenever the person comes back
 * to the page (the day's check may have found a release meanwhile) and whenever the update card opens
 * (an engine updating itself moves on within minutes while the page keeps the focus). There is no
 * answer to keep: the button stays while this install is behind and goes once the update lands. A
 * read that fails changes nothing.
 */
export function useUpdateNotice(call: UpdateCall, initial: UpdateNotice | null): UpdateNotice | null {
  const [notice, setNotice] = useState<UpdateNotice | null>(initial);
  const read = useCallback(() => {
    void call().then(reply => setNotice(reply.notice ?? null), () => {});
  }, [call]);
  useEffect(() => {
    window.addEventListener("focus", read);
    readers.add(read);
    return () => {
      window.removeEventListener("focus", read);
      readers.delete(read);
    };
  }, [read]);
  return notice;
}
