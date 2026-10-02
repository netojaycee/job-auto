import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ManualPostingInput {
  rawText: string;
  applicationEmail?: string;
}

interface ManualOutreachInput {
  companyName: string;
  contactEmail?: string;
  website?: string;
  context: string;
}

export function useSubmitManualApplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postings: ManualPostingInput[]) => {
      const res = await fetch("/api/jobs/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't queue these listings");
      return data as { enqueued: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["runs"] }),
  });
}

export function useSubmitManualOutreachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targets: ManualOutreachInput[]) => {
      const res = await fetch("/api/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't queue this outreach");
      return data as { enqueued: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["runs"] }),
  });
}
