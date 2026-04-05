import type { APIRoute } from "astro";

/**
 * JPL Horizons telemetry — mirrors the original Netlify function exactly.
 *
 * Single query: 2-hour window, 25 steps. Last point = current data.
 * All points = history for sparklines. No data source mismatch.
 *
 * Falls back to AROW community API if Horizons is unreachable.
 */

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const ORBIT_URL = "https://artemis.cdnspace.ca/api/orbit";
const EARTH_RADIUS_KM = 6371;

// In-memory cache — short TTL so each 30s client refresh gets fresh data
let cached: { json: string; ts: number } | null = null;
const CACHE_TTL = 60_000; // 60s — matches original Netlify function

export const prerender = false;

// ── Vector math ───────────────────────────────────────────────────────

interface Vec3 { x: number; y: number; z: number }
interface VecState extends Vec3 { vx: number; vy: number; vz: number }

function extractVal(line: string, key: string): number | null {
  const re = new RegExp("(?<![A-Z])" + key + "\\s*=\\s*([\\-+]?[\\d.]+[Ee][\\-+]?\\d+)");
  const m = line.match(re);
  return m ? parseFloat(m[1]) : null;
}

function parseVectors(result: string): VecState[] {
  const soe = result.indexOf("$$SOE"), eoe = result.indexOf("$$EOE");
  if (soe === -1 || eoe === -1) return [];
  const lines = result.slice(soe + 5, eoe).trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const out: VecState[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("X ") && lines[i].includes("=") && !lines[i].includes("VX")) {
      const vel = i + 1 < lines.length ? lines[i + 1] : "";
      const x = extractVal(lines[i], "X"), y = extractVal(lines[i], "Y"), z = extractVal(lines[i], "Z");
      const vx = extractVal(vel, "VX"), vy = extractVal(vel, "VY"), vz = extractVal(vel, "VZ");
      if (x != null && y != null && z != null && vx != null && vy != null && vz != null) {
        out.push({ x, y, z, vx, vy, vz });
        i++;
      }
    }
  }
  return out;
}

function parsePositions(result: string): Vec3[] {
  const soe = result.indexOf("$$SOE"), eoe = result.indexOf("$$EOE");
  if (soe === -1 || eoe === -1) return [];
  const lines = result.slice(soe + 5, eoe).trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const out: Vec3[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("X ") && lines[i].includes("=") && !lines[i].includes("VX")) {
      const x = extractVal(lines[i], "X"), y = extractVal(lines[i], "Y"), z = extractVal(lines[i], "Z");
      if (x != null && y != null && z != null) {
        out.push({ x, y, z });
        if (i + 1 < lines.length && lines[i + 1].includes("VX")) i++;
      }
    }
  }
  return out;
}

function mag(v: Vec3) { return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2); }
function dst(a: Vec3, b: Vec3) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2); }
function dot(a: Vec3, b: Vec3) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function rangeRate(o: VecState) { const r = mag(o); return r === 0 ? 0 : (o.x * o.vx + o.y * o.vy + o.z * o.vz) / r; }
function solarPhase(orion: Vec3, sun: Vec3) {
  const toSun = { x: sun.x - orion.x, y: sun.y - orion.y, z: sun.z - orion.z };
  const toEarth = { x: -orion.x, y: -orion.y, z: -orion.z };
  const c = dot(toSun, toEarth) / (mag(toSun) * mag(toEarth));
  return Math.acos(Math.max(-1, Math.min(1, c))) * (180 / Math.PI);
}

function fmtTime(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}

async function jplFetch(body: string, start: string, stop: string, steps: string): Promise<string | null> {
  const params: Record<string, string> = {
    format: "json", COMMAND: `'${body}'`, OBJ_DATA: "NO", MAKE_EPHEM: "YES",
    EPHEM_TYPE: "VECTORS", CENTER: "'500@399'",
    START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: `'${steps}'`,
    VEC_TABLE: "'2'", REF_PLANE: "'ECLIPTIC'", REF_SYSTEM: "'ICRF'", OUT_UNITS: "'KM-S'",
  };
  const qs = new URLSearchParams(params).toString();
  try {
    const r = await fetch(`${HORIZONS_API}?${qs}`);
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, unknown>;
    const result = j.result as string | undefined;
    if (result && result.includes("$$SOE")) return result;
    return null;
  } catch { return null; }
}

// ── Build full response from a single 2-hour / 25-step query ──────────

async function buildResponse(wantHistory: boolean): Promise<string | null> {
  const now = new Date();
  const start = new Date(now.getTime() - 2 * 3600_000);
  const startStr = fmtTime(start), stopStr = fmtTime(now);

  // Single 2-hour window, 25 steps — sequential to avoid rate limits
  const oR = await jplFetch("-1024", startStr, stopStr, "25");
  if (!oR) return null;
  const mR = await jplFetch("301", startStr, stopStr, "25");
  if (!mR) return null;
  const sR = await jplFetch("10", startStr, stopStr, "1");
  if (!sR) return null;

  const orionAll = parseVectors(oR);
  const moonAll = parsePositions(mR);
  const sunAll = parsePositions(sR);
  if (!orionAll.length || !moonAll.length || !sunAll.length) return null;

  // Last point = current data
  const orion = orionAll[orionAll.length - 1];
  const moon = moonAll[moonAll.length - 1];
  const sun = sunAll[sunAll.length - 1];

  const dE = mag(orion), dM = dst(orion, moon);
  const spd = Math.sqrt(orion.vx ** 2 + orion.vy ** 2 + orion.vz ** 2);

  const payload: Record<string, unknown> = {
    source: "jpl-horizons",
    queriedAt: now.toISOString(),
    orion: { x: orion.x, y: orion.y, z: orion.z, vx: orion.vx, vy: orion.vy, vz: orion.vz },
    moon: { x: moon.x, y: moon.y, z: moon.z },
    sun: { x: sun.x, y: sun.y, z: sun.z },
    distEarthKm: dE,
    distMoonKm: dM,
    speedKmh: spd * 3600,
    speedKms: spd,
    altitudeKm: dE - EARTH_RADIUS_KM,
    rangeRateKms: rangeRate(orion),
    solarPhaseAngleDeg: solarPhase(orion, sun),
    dataPoints: orionAll.length,
  };

  // History: all points from the same query (no data source mismatch)
  if (wantHistory) {
    const len = Math.min(orionAll.length, moonAll.length);
    const history = [];
    for (let i = 0; i < len; i++) {
      const o = orionAll[i], m = moonAll[i];
      const d = mag(o);
      const s = Math.sqrt(o.vx ** 2 + o.vy ** 2 + o.vz ** 2);
      history.push({
        distEarthKm: d,
        distMoonKm: dst(o, m),
        speedKmh: s * 3600,
        altitudeKm: d - EARTH_RADIUS_KM,
        rangeRateKms: rangeRate(o),
      });
    }
    payload.history = history;
  }

  return JSON.stringify(payload);
}

// ── Route handler ─────────────────────────────────────────────────────

export const GET: APIRoute = async ({ url }) => {
  const wantHistory = url.searchParams.get("history") === "2h";
  const now = Date.now();

  // Serve from cache if fresh (instant response)
  if (cached && now - cached.ts < CACHE_TTL) {
    // If history requested but cached response might not have it, rebuild
    if (!wantHistory || cached.json.includes('"history"')) {
      return new Response(cached.json, {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      });
    }
  }

  // Fetch fresh data
  try {
    const json = await buildResponse(wantHistory);
    if (!json) throw new Error("JPL failed");

    cached = { json, ts: now };

    return new Response(json, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  } catch {
    // Fallback: AROW community API
    try {
      const r = await fetch(ORBIT_URL, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error();
      const o = (await r.json()) as Record<string, number | null | undefined>;
      const fallback = JSON.stringify({
        source: "arow-fallback",
        queriedAt: new Date().toISOString(),
        distEarthKm: o.earthDistKm, distMoonKm: o.moonDistKm,
        speedKmh: o.speedKmH, speedKms: o.speedKmS,
        altitudeKm: o.altitudeKm,
        rangeRateKms: o.rangeRateKms ?? null,
        solarPhaseAngleDeg: o.solarPhaseAngleDeg ?? null,
        dataPoints: 1,
      });
      return new Response(fallback, {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=10" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Horizons unavailable" }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }
  }
};
