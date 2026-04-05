import type { APIRoute } from "astro";

/** Forwards to the original tracker's Netlify functions so behaviour matches production. */
const ALLOWED = new Set(["horizons", "news", "space-weather"]);
const UPSTREAM = "https://artemis-tracker.netlify.app/.netlify/functions/";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const endpoint = params.endpoint as string;
  if (!endpoint || !ALLOWED.has(endpoint)) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const target = new URL(UPSTREAM + endpoint);
  url.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { Accept: "*/*" },
    });
    clearTimeout(t);
    const body = await res.text();
    const ct = res.headers.get("content-type") || "application/json";
    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch {
    clearTimeout(t);
    return new Response(JSON.stringify({ error: "Proxy failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
