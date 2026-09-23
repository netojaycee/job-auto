import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface PreferencesData {
  roles: string[];
  locations: string[];
  remotePref: string;
  salaryFloor: number | null;
  industries: string[];
  maxApplicationsPerDay: number;
  dailyRunTime: string;
}

export interface PreferencesSuggestion {
  roles: string[];
  locations: string[];
  remotePref: string;
  salaryFloor?: number;
  industries: string[];
}

async function fetchPreferences(): Promise<PreferencesData | null> {
  const res = await fetch("/api/preferences");
  if (!res.ok) throw new Error("Failed to load preferences");
  const data = await res.json();
  return data.preferences ?? null;
}

export function usePreferencesQuery() {
  return useQuery({ queryKey: ["preferences"], queryFn: fetchPreferences });
}

export function useSavePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: PreferencesData) => {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["preferences"] }),
  });
}

export function useSuggestPreferencesMutation() {
  return useMutation({
    mutationFn: async (): Promise<PreferencesSuggestion> => {
      const res = await fetch("/api/preferences/suggest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate suggestions");
      return data.suggestion;
    },
  });
}
