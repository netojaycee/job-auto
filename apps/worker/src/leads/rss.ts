export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e]);
}

function extractTag(itemXml: string, tag: string): string {
  const match = itemXml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  if (!match) return "";
  return decodeEntities(match[1].trim());
}

/** Minimal regex-based RSS 2.0 parser — good enough for WordPress feeds without a full XML dependency. */
export function parseRssItems(xml: string): RssItem[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.map((block) => {
    const pubDateRaw = extractTag(block, "pubDate");
    return {
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description"),
      pubDate: pubDateRaw ? new Date(pubDateRaw) : null,
    };
  });
}
