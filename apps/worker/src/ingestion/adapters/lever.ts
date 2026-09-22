import type { JobAdapter } from "../types";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  categories?: { location?: string };
  descriptionPlain?: string;
}

export const leverAdapter: JobAdapter = async (source) => {
  const account = source.baseUrl;
  const res = await fetch(`https://api.lever.co/v0/postings/${account}?mode=json`);
  if (!res.ok) {
    throw new Error(`Lever fetch failed for ${account}: ${res.status}`);
  }
  const data = (await res.json()) as LeverPosting[] | { ok: false };
  if (!Array.isArray(data)) {
    throw new Error(`Lever fetch for ${account} returned no postings list`);
  }

  return data.map((posting) => ({
    externalId: posting.id,
    url: posting.hostedUrl,
    title: posting.text,
    company: account,
    location: posting.categories?.location ?? null,
    description: posting.descriptionPlain ?? "",
    postedAt: posting.createdAt ? new Date(posting.createdAt) : null,
  }));
};
