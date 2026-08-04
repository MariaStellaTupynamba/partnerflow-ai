"use client";

import type { Proposal } from "@partnerflow/shared-types";
import { useState } from "react";

import { ApiError, apiClient } from "@/lib/api-client";

function formatPrice(price: string | null, currency: string): string {
  if (price === null) return "price not specified";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(price));
}

export function ProposalComparison({
  proposals,
  vendorNamesById,
}: {
  proposals: Proposal[];
  vendorNamesById: Record<string, string>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  function toggle(id: string) {
    setResult(null);
    setError(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCompare() {
    setError(null);
    setResult(null);
    setIsComparing(true);
    try {
      const response = await apiClient.compareProposals({
        proposalIds: Array.from(selectedIds),
      });
      setResult(response.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsComparing(false);
    }
  }

  if (proposals.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        No proposals yet — add some from a vendor&apos;s page first.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              id={`proposal-${proposal.id}`}
              checked={selectedIds.has(proposal.id)}
              onChange={() => toggle(proposal.id)}
              className="h-4 w-4"
            />
            <label htmlFor={`proposal-${proposal.id}`} className="flex-1 cursor-pointer">
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                {vendorNamesById[proposal.vendorId] ?? "Unknown vendor"}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                — {proposal.title} — {formatPrice(proposal.price, proposal.currency)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleCompare}
        disabled={selectedIds.size < 2 || isComparing}
        className="mt-4 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {isComparing
          ? "Comparing…"
          : `Compare ${selectedIds.size} proposal${selectedIds.size === 1 ? "" : "s"}`}
      </button>
      {selectedIds.size === 1 && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Select at least 2 proposals to compare.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            AI comparison
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {result}
          </p>
        </div>
      )}
    </div>
  );
}
