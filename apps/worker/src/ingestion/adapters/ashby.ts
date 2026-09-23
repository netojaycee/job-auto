import type { JobAdapter } from "../types";
import { htmlToPlainText } from "./html";

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  descriptionHtml?: string;
  publishedAt?: string;
  location?: string;
}

export const ashbyAdapter: JobAdapter = async (source) => {
  const boardName = source.baseUrl;
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${boardName}`);
  if (!res.ok) {
    throw new Error(`Ashby fetch failed for ${boardName}: ${res.status}`);
  }
  const data = (await res.json()) as { jobs: AshbyJob[] };

  return data.jobs.map((job) => ({
    externalId: job.id,
    url: job.jobUrl,
    title: job.title,
    company: boardName,
    location: job.location ?? null,
    description: job.descriptionHtml ? htmlToPlainText(job.descriptionHtml) : "",
    postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
  }));
};
