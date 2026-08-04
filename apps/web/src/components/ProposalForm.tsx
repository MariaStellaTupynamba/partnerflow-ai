"use client";

import type { Proposal } from "@partnerflow/shared-types";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiClient } from "@/lib/api-client";

export function ProposalForm({ vendorId, proposal }: { vendorId: string; proposal?: Proposal }) {
  const router = useRouter();
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [price, setPrice] = useState(proposal?.price ?? "");
  const [currency, setCurrency] = useState(proposal?.currency ?? "USD");
  const [summary, setSummary] = useState(proposal?.summary ?? "");
  const [submittedAt, setSubmittedAt] = useState(proposal?.submittedAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      title,
      price: price || null,
      currency,
      summary,
      submittedAt: submittedAt || null,
    };

    try {
      if (proposal) {
        await apiClient.updateProposal(proposal.id, payload);
      } else {
        await apiClient.createProposal(vendorId, payload);
      }
      router.push(`/dashboard/vendors/${vendorId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label
            htmlFor="price"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Price
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Currency
          </label>
          <input
            id="currency"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 uppercase focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="submittedAt"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Submitted on
        </label>
        <input
          id="submittedAt"
          type="date"
          value={submittedAt}
          onChange={(e) => setSubmittedAt(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="summary"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Summary
        </label>
        <textarea
          id="summary"
          required
          rows={6}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What's included, terms, SLA, anything worth comparing against other proposals…"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 self-start rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "Saving…" : proposal ? "Save changes" : "Add proposal"}
      </button>
    </form>
  );
}
