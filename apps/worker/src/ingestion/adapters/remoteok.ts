import type { JobAdapter } from "../types";
import { htmlToPlainText } from "./html";

interface RemoteOkPosting {
  id?: string;
  slug: string;
  position: string;
  company: string;
  location?: string;
  description?: string;
  url?: string;
  date?: string;
  legal?: string; // present only on the first array element, a ToS notice — not a real posting
}

export const remoteOkAdapter: JobAdapter = async (source) => {
  const res = await fetch(source.baseUrl, {
    headers: { "User-Agent": "job-auto (contact: set via ARCHITECTURE.md)" },
  });
  if (!res.ok) {
    throw new Error(`RemoteOK fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as RemoteOkPosting[];

  return data
    .filter((posting): posting is RemoteOkPosting & { id: string } => Boolean(posting.id))
    .map((posting) => ({
      externalId: posting.id,
      url: posting.url ?? `https://remoteok.com/remote-jobs/${posting.slug}`,
      title: posting.position,
      company: posting.company,
      location: posting.location ?? "Remote",
      description: posting.description ? htmlToPlainText(posting.description) : "",
      postedAt: posting.date ? new Date(posting.date) : null,
    }));
};
