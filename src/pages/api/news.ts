import type { APIRoute } from "astro";

export const prerender = false;

const FEEDS: { url: string; source: string }[] = [
  { url: "https://www.nasa.gov/news-release/feed/", source: "NASA News" },
  { url: "https://www.nasa.gov/blogs/missions/feed/", source: "NASA Blogs" },
];

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html: string): string {
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return decodeXmlEntities(t);
}

type NewsItem = {
  title: string;
  url: string;
  date: string;
  summary?: string;
  source: string;
};

function parseRss(xml: string, source: string, maxPerFeed: number): NewsItem[] {
  const out: NewsItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && out.length < maxPerFeed) {
    const block = m[1];
    const titleM =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
      block.match(/<title>([^<]*)<\/title>/i);
    const linkM = block.match(/<link>([^<]+)<\/link>/i);
    const pubM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
    const descM =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
      block.match(/<description>([^<]*)<\/description>/i);
    if (!titleM || !linkM) continue;
    const title = stripTags(titleM[1].trim());
    const itemUrl = linkM[1].trim();
    const pub = pubM ? pubM[1].trim() : "";
    const d = pub ? new Date(pub) : new Date();
    const iso = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    let summary: string | undefined;
    if (descM) {
      const raw = descM[1].trim();
      const cleaned = stripTags(raw).slice(0, 400);
      if (cleaned.length > 0) summary = cleaned + (cleaned.length >= 400 ? "…" : "");
    }
    out.push({ title, url: itemUrl, date: iso, summary, source });
  }
  return out;
}

export const GET: APIRoute = async () => {
  const feedStatus: { url: string; items: number; ok: boolean }[] = [];
  const all: NewsItem[] = [];

  for (const f of FEEDS) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(f.url, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) {
        feedStatus.push({ url: f.url, items: 0, ok: false });
        continue;
      }
      const xml = await res.text();
      const items = parseRss(xml, f.source, 12);
      for (const it of items) all.push(it);
      feedStatus.push({ url: f.url, items: items.length, ok: true });
    } catch {
      feedStatus.push({ url: f.url, items: 0, ok: false });
    }
  }

  all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const items = all.slice(0, 24);

  return new Response(JSON.stringify({ items, feedStatus }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
    },
  });
};
