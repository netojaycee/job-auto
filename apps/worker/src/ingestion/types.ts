export interface NormalizedPosting {
  externalId: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  postedAt: Date | null;
}

export interface JobSourceConfig {
  id: string;
  /** For per-company boards (Greenhouse/Lever) this is the board token/account
   * slug, e.g. "gitlab" or "palantir". For single global feeds (RemoteOK)
   * it's the full API URL. */
  baseUrl: string;
}

export type JobAdapter = (source: JobSourceConfig) => Promise<NormalizedPosting[]>;
