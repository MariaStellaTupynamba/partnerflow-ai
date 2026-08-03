"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

type Status = "checking" | "online" | "offline";

export function ApiHealthStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    apiClient
      .getHealth()
      .then((result) => {
        if (!cancelled) setStatus(result.status === "ok" ? "online" : "offline");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status === "checking" ? "Checking API…" : status === "online" ? "API online" : "API offline";

  const dotColor =
    status === "checking"
      ? "bg-zinc-400"
      : status === "online"
        ? "bg-emerald-500"
        : "bg-red-500";

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      {label}
    </div>
  );
}
