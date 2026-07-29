import { useEffect, useState } from "react";
import { db } from "./db";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
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

export async function recordHistory(query: string, docId?: number, page?: number) {
  if (!query.trim() && !docId) return;
  await db.history.add({ query, docId, page, createdAt: Date.now() });
  // cap at 200
  const count = await db.history.count();
  if (count > 200) {
    const excess = await db.history.orderBy("createdAt").limit(count - 200).toArray();
    await db.history.bulkDelete(excess.map((h) => h.id!));
  }
}
