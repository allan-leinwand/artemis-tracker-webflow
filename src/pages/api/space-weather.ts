import type { APIRoute } from "astro";

export const prerender = false;

function donkiKey(): string {
  const k = import.meta.env.NASA_DONKI_API_KEY;
  return typeof k === "string" && k.length > 0 ? k : "DEMO_KEY";
}

function rangeDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 3 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function donki(path: string, start: string, end: string): Promise<unknown[]> {
  const u = new URL(`https://api.nasa.gov/DONKI/${path}`);
  u.searchParams.set("startDate", start);
  u.searchParams.set("endDate", end);
  u.searchParams.set("api_key", donkiKey());
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(u.toString(), { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    clearTimeout(t);
    return [];
  }
}

function flareStrength(classType: string): number {
  if (!classType) return 0;
  const letter = classType.charAt(0).toUpperCase();
  const num = parseFloat(classType.slice(1)) || 0;
  const base =
    letter === "X" ? 1e6 : letter === "M" ? 1e4 : letter === "C" ? 1e2 : letter === "B" ? 1 : 0;
  return base * (num + 0.001);
}

function isEarthDirectedCme(c: Record<string, unknown>): boolean {
  const note = String(c.note || "").toLowerCase();
  if (
    note.includes("earth") ||
    note.includes("geo-effective") ||
    note.includes("glancing") ||
    note.includes("geo effective")
  ) {
    return true;
  }
  const analyses = c.cmeAnalyses as Array<Record<string, unknown>> | undefined;
  if (!analyses) return false;
  for (const a of analyses) {
    const enlil = a.enlilList as Array<Record<string, unknown>> | undefined;
    if (!enlil) continue;
    for (const e of enlil) {
      if (e.isEarthGB === true || e.isEarthMinorImpact === true) return true;
    }
  }
  return false;
}

function maxKpForStorm(s: Record<string, unknown>): number {
  let max = 0;
  const indices = s.allKpIndex as Array<{ kpIndex?: number }> | undefined;
  if (!indices) return 0;
  for (const k of indices) {
    const v = Number(k.kpIndex);
    if (!isNaN(v) && v > max) max = v;
  }
  return max;
}

function buildSummary(
  flares: Record<string, unknown>[],
  cmes: Record<string, unknown>[],
  storms: Record<string, unknown>[],
  sep: Record<string, unknown>[],
): Record<string, unknown> {
  const now = Date.now();
  const dayMs = 86400000;

  let highestFlare = "";
  let best = 0;
  for (const f of flares) {
    const ct = String(f.classType || "");
    const s = flareStrength(ct);
    if (s > best) {
      best = s;
      highestFlare = ct;
    }
  }

  const sortedFlares = [...flares].sort(
    (a, b) => new Date(String(b.peakTime)).getTime() - new Date(String(a.peakTime)).getTime(),
  );
  const lf = sortedFlares[0];
  const latestFlare = lf
    ? {
        classType: String(lf.classType || ""),
        peakTime: String(lf.peakTime || ""),
        sourceRegion:
          lf.activeRegionNum != null
            ? "AR " + lf.activeRegionNum
            : lf.sourceLocation
              ? String(lf.sourceLocation)
              : "",
      }
    : null;

  let highestKp = 0;
  for (const s of storms) {
    const m = maxKpForStorm(s);
    if (m > highestKp) highestKp = m;
  }

  const earthDirectedCMEs = cmes.filter(isEarthDirectedCme).map((c) => {
    const analyses = c.cmeAnalyses as Array<{ speed?: number }> | undefined;
    return {
      startTime: c.startTime,
      speed: analyses?.[0]?.speed ?? null,
      arrivalTime: null,
      note: c.note,
    };
  });

  const hasX = flares.some((f) => String(f.classType || "").startsWith("X"));
  const flare24h = flares.filter((f) => {
    const t = new Date(String(f.peakTime)).getTime();
    return !isNaN(t) && now - t < dayMs;
  });
  const hasM24 = flare24h.some((f) => String(f.classType || "").startsWith("M"));

  let status: "nominal" | "elevated" | "severe" = "nominal";
  if (hasX || sep.length > 0) status = "severe";
  else if (hasM24 || earthDirectedCMEs.length > 0 || highestKp >= 5) status = "elevated";

  return {
    status,
    flareCount: flares.length,
    cmeCount: cmes.length,
    stormCount: storms.length,
    sepCount: sep.length,
    highestFlare: highestFlare || undefined,
    latestFlare,
    highestKp: Math.min(9, Math.round(highestKp)),
    earthDirectedCMEs,
  };
}

export const GET: APIRoute = async () => {
  const { start, end } = rangeDates();
  const [flares, cmes, storms, sep] = await Promise.all([
    donki("FLR", start, end),
    donki("CME", start, end),
    donki("GST", start, end),
    donki("SEP", start, end),
  ]);

  const summary = buildSummary(
    flares as Record<string, unknown>[],
    cmes as Record<string, unknown>[],
    storms as Record<string, unknown>[],
    sep as Record<string, unknown>[],
  );

  const body = {
    flares,
    cme: cmes,
    storms,
    sep,
    summary,
    queriedAt: new Date().toISOString(),
    rangeStart: start,
    rangeEnd: end,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
};
