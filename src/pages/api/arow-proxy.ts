import type { APIRoute } from "astro";

const ALLOWED = new Set(["orbit", "arow", "dsn"]);
const UPSTREAM = "https://artemis.cdnspace.ca/api/";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint || !ALLOWED.has(endpoint)) {
    return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(UPSTREAM + endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(t);
    const body = await res.text();
    const ct = res.headers.get("content-type") || "application/json";
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=2, stale-while-revalidate=8",
      },
    });
  } catch {
    clearTimeout(t);
    return new Response(JSON.stringify({ error: "Upstream fetch failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
