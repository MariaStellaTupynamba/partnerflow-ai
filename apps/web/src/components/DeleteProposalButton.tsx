"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiClient } from "@/lib/api-client";

export function DeleteProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm("Delete this proposal? This can't be undone.")) {
      return;
    }
    setIsDeleting(true);
    try {
      await apiClient.deleteProposal(proposalId);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDeleting}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {isDeleting ? "Deleting…" : "Delete"}
    </button>
  );
}
