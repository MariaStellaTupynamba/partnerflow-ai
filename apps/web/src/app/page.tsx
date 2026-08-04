import Link from "next/link";

import { ApiHealthStatus } from "@/components/ApiHealthStatus";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            PartnerFlow AI
          </span>
          <div className="flex items-center gap-4">
            <ApiHealthStatus />
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Vendor sourcing &amp; partner management
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
          Compare vendor proposals with AI-assisted clarity.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          PartnerFlow AI helps teams source vendors, compare proposals side by side, and manage
          partner relationships in one place. This foundation milestone establishes the platform
          architecture and authenticated shell — sourcing, comparison, and reporting features are
          built on top of it in later milestones.
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="inline-flex items-center rounded-md bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        &copy; {new Date().getFullYear()} PartnerFlow AI. Portfolio project — fictional data only.
      </footer>
    </div>
  );
}
