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

export interface ParsedCvExperience {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  summary: string;
}

export interface ParsedCvEducation {
  institution: string;
  degree: string;
  field?: string;
  endDate?: string;
}

export interface ParsedCv {
  fullName?: string;
  summary: string;
  skills: string[];
  experience: ParsedCvExperience[];
  education: ParsedCvEducation[];
  totalYearsExperience: number;
  suggestedRoles: string[];
}

export interface ClarifyingQa {
  question: string;
  answer: string | null;
}

export interface JobPreferencesSuggestion {
  roles: string[];
  locations: string[];
  remotePref: "remote" | "hybrid" | "onsite" | "any";
  salaryFloor?: number;
  industries: string[];
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
