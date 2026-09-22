export type UserRole = "user" | "admin";

export type ApplicationStatus =
  | "shortlisted"
  | "tailoring"
  | "applied"
  | "failed"
  | "skipped_dedup";

export type ApplicationMethod = "email" | "ats_portal";

export type WalletOwnerType = "user" | "cluster";

export interface CanonicalProfile {
  userId: string;
  summary: string;
  skills: string[];
  experienceYears: number;
  updatedAt: string;
}

export interface JobMatchResult {
  jobPostingId: string;
  score: number;
  reasoning: string;
}

export interface AgentRunSummary {
  userId: string;
  startedAt: string;
  finishedAt: string;
  jobsSeen: number;
  jobsShortlisted: number;
  jobsApplied: number;
  tokensSpent: number;
  errorSummary?: string;
}
