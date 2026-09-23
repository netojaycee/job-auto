import { useQuery } from "@tanstack/react-query";

export interface AgentRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  jobsSeen: number;
  jobsShortlisted: number;
  jobsApplied: number;
  errorSummary: string | null;
}

export interface ApplicationRow {
  id: string;
  status: string;
  matchScore: number | null;
  matchReasoning: string | null;
  title: string;
  company: string;
  createdAt: string;
}

export interface Suggestion {
  id: string;
  suggestionText: string;
}

interface RunsData {
  runs: AgentRun[];
  applications: ApplicationRow[];
  suggestions: Suggestion[];
}

async function fetchRuns(): Promise<RunsData> {
  const res = await fetch("/api/runs");
  if (!res.ok) throw new Error("Failed to load agent activity");
  return res.json();
}

export function useRunsQuery() {
  return useQuery({ queryKey: ["runs"], queryFn: fetchRuns });
}
