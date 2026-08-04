import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/server-auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            PartnerFlow AI
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Welcome back
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Signed in as <span className="font-medium">{user.email}</span>.
        </p>
        <p className="mt-6 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          This is a placeholder dashboard — vendor sourcing, proposal comparison, and partner
          management features aren&apos;t built yet. This milestone establishes the authenticated
          shell they&apos;ll live in.
        </p>
      </main>
    </div>
  );
}
