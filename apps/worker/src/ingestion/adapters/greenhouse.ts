import type { JobAdapter } from "../types";
import { htmlToPlainText } from "./html";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  first_published?: string;
  company_name?: string;
}

export const greenhouseAdapter: JobAdapter = async (source) => {
  const boardToken = source.baseUrl;
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
  );
  if (!res.ok) {
    throw new Error(`Greenhouse fetch failed for ${boardToken}: ${res.status}`);
  }
  const data = (await res.json()) as { jobs: GreenhouseJob[] };

  return data.jobs.map((job) => ({
    externalId: String(job.id),
    url: job.absolute_url,
    title: job.title,
    company: job.company_name ?? boardToken,
    location: job.location?.name ?? null,
    description: job.content ? htmlToPlainText(job.content) : "",
    postedAt: job.first_published ? new Date(job.first_published) : null,
  }));
};
