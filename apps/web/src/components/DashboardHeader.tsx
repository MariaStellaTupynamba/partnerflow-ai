import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";

export function DashboardHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
        >
          PartnerFlow AI
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{email}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
