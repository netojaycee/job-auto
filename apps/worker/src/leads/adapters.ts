import { parseRssItems, type RssItem } from "./rss";

export interface FundingFeedSource {
  key: string;
  url: string;
}

export const FUNDING_FEEDS: FundingFeedSource[] = [
  { key: "techcrunch-funding", url: "https://techcrunch.com/tag/funding/feed/" },
  { key: "techeu", url: "https://tech.eu/feed/" },
  { key: "techcabal-funding", url: "https://techcabal.com/tag/funding/feed/" },
];

export async function fetchFundingFeed(source: FundingFeedSource): Promise<RssItem[]> {
  const res = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    throw new Error(`Feed fetch failed for ${source.key}: ${res.status}`);
  }
  return parseRssItems(await res.text());
}
