import { useEffect, useState } from "react";
import { db } from "./db";

export function useOnlineStatus(): boolean {
  // Always start with `true` to match SSR output; sync to real state after mount.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export const HISTORY_PREF_KEY = "biblioteca:saveHistory";

export function isHistoryEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(HISTORY_PREF_KEY);
  return v === null ? true : v === "1";
}

export function setHistoryEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_PREF_KEY, enabled ? "1" : "0");
}

export async function recordHistory(query: string, docId?: number, page?: number) {
  if (!query.trim() && !docId) return;
  if (!isHistoryEnabled()) return;
  await db.history.add({ query, docId, page, createdAt: Date.now() });
  // cap at 200
  const count = await db.history.count();
  if (count > 200) {
    const excess = await db.history.orderBy("createdAt").limit(count - 200).toArray();
    await db.history.bulkDelete(excess.map((h) => h.id!));
  }
}

export async function clearHistoryAll(): Promise<void> {
  await db.history.clear();
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  await db.history.delete(id);
}

export async function clearHistoryOlderThan(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const old = await db.history.where("createdAt").below(cutoff).toArray();
  const ids = old.map((h) => h.id!).filter(Boolean);
  if (ids.length) await db.history.bulkDelete(ids);
  return ids.length;
}
