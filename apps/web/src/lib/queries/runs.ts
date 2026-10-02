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
  method: string | null;
  matchScore: number | null;
  matchReasoning: string | null;
  title: string;
  company: string;
  applicationEmail: string | null;
  createdAt: string;
}

export interface Suggestion {
  id: string;
  suggestionText: string;
}

export interface OutreachRow {
  id: string;
  status: string;
  company: string;
  contactEmail: string | null;
  contactEmailGuessed: boolean;
  createdAt: string;
}

interface RunsData {
  runs: AgentRun[];
  applications: ApplicationRow[];
  suggestions: Suggestion[];
  outreach: OutreachRow[];
}

async function fetchRuns(): Promise<RunsData> {
  const res = await fetch("/api/runs");
  if (!res.ok) throw new Error("Failed to load agent activity");
  return res.json();
}

export function useRunsQuery() {
  return useQuery({ queryKey: ["runs"], queryFn: fetchRuns });
}
