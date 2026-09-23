import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClarifyingQa, ParsedCv } from "@job-auto/types";

export interface ProfileData {
  linkedinUrl: string | null;
  otherLinks: string[];
  aboutMeText: string | null;
  parsedCvJson: ParsedCv | null;
  clarifyingQa: ClarifyingQa[] | null;
  canonicalProfileText: string | null;
}

async function fetchProfile(): Promise<ProfileData | null> {
  const res = await fetch("/api/profile");
  if (!res.ok) throw new Error("Failed to load profile");
  const data = await res.json();
  return data.profile ?? null;
}

export function useProfileQuery() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
}

export function useUploadCvMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("cv", file);
      const res = await fetch("/api/profile/cv", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      return data as { parsedCv: ParsedCv; clarifyingQa: ClarifyingQa[]; canonicalProfileText: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useSaveProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { linkedinUrl: string | null; otherLinks: string[]; aboutMeText: string | null }) => {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useAnswerClarifyingQuestionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: string[]) => {
      const res = await fetch("/api/profile/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save answers");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}
