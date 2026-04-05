/**
 * Artemis II Mission Tracker — Main Application
 * Data fetching, auto-refresh, time calculations, and DOM updates.
 */

window.onerror = function (msg, url, line) {
  console.error('Global error:', msg, url, line);
};

(function () {
  'use strict';

  // ── Guard: ensure data.js loaded ────────────────────────────────────────
  if (typeof LAUNCH_EPOCH_UTC === 'undefined' || typeof FALLBACK_EVENTS === 'undefined') {
    console.error('data.js did not load — app cannot start.');
    var statusEl = document.getElementById('data-status');
    if (statusEl) {
      statusEl.textContent = 'Error: mission data failed to load.';
      statusEl.className = 'data-status data-status--mock';
    }
    return;
  }

  // ── State ──────────────────────────────────────────────────────────────
  var dataSource = 'prelaunch'; // 'live' | 'horizons' | 'mock' | 'prelaunch'
  var lastTelemetry = null;
  var refreshTimer = null;
  var arowAttempted = false;
  var arowAvailable = false;
  var REFRESH_INTERVAL_MS = 30000; // 30 s
  var SR_ANNOUNCE_INTERVAL_MS = 30000; // 30 s — periodic SR countdown announcement

  // ── Sparkline data history ────────────────────────────────────────────
  var SPARKLINE_MAX_POINTS = 24;
  var sparklineHistory = {
    speed:      [],
    distEarth:  [],
    distMoon:   [],
    altitude:   [],
    rangeRate:  []
  };
  var sparklineTimestamps = [];
  var EARTH_MOON_AVG_KM = 384400;

  // ── AROW endpoint candidates ──────────────────────────────────────────
  var AROW_ENDPOINTS = [
    'https://www.nasa.gov/specials/trackartemis/api/telemetry.json',
    'https://www.nasa.gov/specials/trackartemis/data/latest.json',
    'https://www.nasa.gov/specials/trackartemis/api/v1/position',
    'https://nasa.gov/trackartemis/api/telemetry',
    'https://www.nasa.gov/trackartemis/data/latest.json'
  ];

  // ── Community AROW API (artemis.cdnspace.ca) ───────────────────────────
  var COMMUNITY_API_BASE = (typeof window !== 'undefined' && window.__TRACKER_API_BASE__) || '/api/arow-proxy?endpoint=';
  var INTERNAL_API_BASE = (typeof window !== 'undefined' && window.__INTERNAL_API_BASE__) || '/api/';
  var COMMUNITY_ORBIT_POLL_MS = 300000; // 5 minutes
  var COMMUNITY_DSN_POLL_MS = 10000;    // 10 seconds
  var AROW_POLL_MS = 2000;              // 2 seconds for AROW polling
  var communityArowSSE = null;          // EventSource instance
  var lastCommunityOrbit = null;        // last /api/orbit response
  var lastCommunityArow = null;         // last /api/arow response (from SSE or poll)
  var communityOrbitAvailable = false;
  var communityArowAvailable = false;

  // ── DOM refs (set in init) ────────────────────────────────────────────
  var dom = {};

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Mission elapsed time in fractional hours */
  function getMETHours() {
    var now = Date.now();
    var launch = LAUNCH_EPOCH_UTC.getTime();
    return (now - launch) / 3600000;
  }

  /** Format countdown as "T- 16h 23m 45s" or MET as "MET 02d 14h 33m 12s" */
  function formatCountdownOrMET(metHours) {
    var isPreLaunch = metHours < 0;
    var totalSec = Math.abs(Math.floor(metHours * 3600));
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };

    if (isPreLaunch) {
      var parts = 'L- ';
      if (d > 0) parts += d + 'd ';
      parts += pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
      return parts;
    } else {
      var parts2 = 'MET ';
      if (d > 0) parts2 += pad(d) + 'd ';
      parts2 += pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
      return parts2;
    }
  }

  /** Format countdown/MET in a screen-reader-friendly way (no abbreviations) */
  function formatCountdownOrMETForSR(metHours) {
    var isPreLaunch = metHours < 0;
    var totalSec = Math.abs(Math.floor(metHours * 3600));
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);

    var parts = [];
    if (d > 0) parts.push(d + (d === 1 ? ' day' : ' days'));
    if (h > 0) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m > 0) parts.push(m + (m === 1 ? ' minute' : ' minutes'));

    var timeStr = parts.join(', ') || 'less than a minute';

    if (isPreLaunch) {
      return 'Countdown to launch: ' + timeStr + ' remaining.';
    } else {
      return 'Mission elapsed time: ' + timeStr + '.';
    }
  }


  /** Format remaining time until an event in human-readable form, e.g. "in 4 hours 32 minutes" or "3 hours ago" */
  function formatTimeUntil(utcDateStr) {
    var evtTime = new Date(utcDateStr).getTime();
    var now = Date.now();
    var diff = evtTime - now;
    var absDiff = Math.abs(diff);
    var future = diff > 0;

    var d = Math.floor(absDiff / 86400000);
    var h = Math.floor((absDiff % 86400000) / 3600000);
    var m = Math.floor((absDiff % 3600000) / 60000);

    var segments = [];
    if (d > 0) segments.push(d + (d === 1 ? ' day' : ' days'));
    if (h > 0) segments.push(h + (h === 1 ? ' hour' : ' hours'));
    if (d === 0 && m > 0) segments.push(m + (m === 1 ? ' minute' : ' minutes'));

    var text = segments.join(' ') || 'less than a minute';

    if (future) return 'in ' + text;
    return text + ' ago';
  }


  /** Calculate light delay from distance in km. Speed of light = 299,792.458 km/s */
  function formatLightDelay(distKm) {
    if (!distKm || distKm <= 0) return 'Awaiting data';
    var seconds = distKm / 299792.458;
    if (seconds < 60) return seconds.toFixed(2) + ' seconds';
    var m = Math.floor(seconds / 60);
    var s = (seconds % 60).toFixed(1);
    return m + 'm ' + s + 's';
  }

  /**
   * Parse a detail text block into structured HTML with h4, ul, and p elements.
   * Splits on sentence boundaries and groups related facts.
   */
  function renderDetail(text, container) {
    // Split into sentences (keep abbreviations like "km/h" or "m/s" intact)
    var sentences = text.match(/[^.!]+(?:[.!](?:\s|$))+|[^.!]+$/g);
    if (!sentences) {
      var p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
      return;
    }

    // Clean up sentences
    sentences = sentences.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });

    // Detect sentences that look like "key: value" facts (short, with a colon in the first half)
    function looksLikeFact(s) {
      var colonPos = s.indexOf(':');
      if (colonPos < 0 || colonPos > 40) return false;
      // Must not be a URL (https:)
      if (s.charAt(colonPos - 1) === 's' || s.charAt(colonPos - 1) === 'p') {
        var before = s.substring(Math.max(0, colonPos - 5), colonPos);
        if (before.indexOf('http') !== -1) return false;
      }
      return true;
    }

    // Group sentences: consecutive facts become a list, others become paragraphs.
    // If there are 3+ sentences, pull out the first 1-2 as an intro paragraph.
    var groups = []; // { type: 'p' | 'ul', items: [] }
    var currentGroup = null;

    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      var isFact = looksLikeFact(s);

      if (isFact) {
        if (!currentGroup || currentGroup.type !== 'ul') {
          currentGroup = { type: 'ul', items: [] };
          groups.push(currentGroup);
        }
        currentGroup.items.push(s);
      } else {
        if (!currentGroup || currentGroup.type !== 'p') {
          currentGroup = { type: 'p', items: [] };
          groups.push(currentGroup);
        }
        currentGroup.items.push(s);
      }
    }

    // If we only got one giant paragraph group, try splitting it into intro + details
    if (groups.length === 1 && groups[0].type === 'p' && groups[0].items.length > 3) {
      var items = groups[0].items;
      groups = [
        { type: 'p', items: items.slice(0, 2) },
        { type: 'p', items: items.slice(2) }
      ];
    }

    // Add a heading before fact-lists when they follow a paragraph
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      if (group.type === 'ul' && group.items.length >= 2) {
        var h4 = document.createElement('h4');
        h4.className = 'timeline-step__subheading';
        h4.textContent = 'Key facts';
        container.appendChild(h4);
      }

      if (group.type === 'ul') {
        var ul = document.createElement('ul');
        ul.className = 'timeline-step__facts';
        for (var j = 0; j < group.items.length; j++) {
          var li = document.createElement('li');
          li.textContent = group.items[j];
          ul.appendChild(li);
        }
        container.appendChild(ul);
      } else {
        var para = document.createElement('p');
        para.textContent = group.items.join(' ');
        container.appendChild(para);
      }
    }
  }

  /** Format MET as "T+DDd HH:MM:SS" for timeline display */
  function formatMET(metHours) {
    var negative = metHours < 0;
    var totalSec = Math.abs(Math.round(metHours * 3600));
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var sign = negative ? '\u2212' : '+';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return 'T' + sign + (d > 0 ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  /** Format a Date in the user's local timezone, e.g. "Apr 2, 01:24" */
  function formatLocalTime(date) {
    if (typeof date === 'string') date = new Date(date);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var mo = months[date.getMonth()];
    var day = date.getDate();
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    return mo + ' ' + day + ', ' + hh + ':' + mm;
  }

  /** Format a Date as ISO datetime string for <time> elements */
  function toISODateTime(date) {
    if (typeof date === 'string') return date;
    return date.toISOString();
  }

  /** Format a number with thousand separators */
  function fmtNum(n, decimals) {
    if (n == null) return '\u2014';
    var fixed = typeof decimals === 'number' ? n.toFixed(decimals) : Math.round(n).toString();
    var parts = fixed.split('.');
    // No separators — whole numbers read correctly with screen readers
    return parts.join('.');
  }

  /** km to miles */
  function kmToMi(km) { return km * 0.621371; }

  /** km/h to mph */
  function kmhToMph(kmh) { return kmh * 0.621371; }

  // ── Interpolation of mock telemetry ────────────────────────────────────

  function interpolateTelemetry(metH) {
    var kf = MOCK_TELEMETRY_KEYFRAMES;
    if (!kf || !kf.length) return null;
    if (metH <= kf[0].metHours) return { metHours: metH, distEarthKm: kf[0].distEarthKm, distMoonKm: kf[0].distMoonKm, speedKmh: kf[0].speedKmh, altitudeKm: kf[0].altitudeKm };
    if (metH >= kf[kf.length - 1].metHours) return { metHours: metH, distEarthKm: kf[kf.length - 1].distEarthKm, distMoonKm: kf[kf.length - 1].distMoonKm, speedKmh: kf[kf.length - 1].speedKmh, altitudeKm: kf[kf.length - 1].altitudeKm };

    var lo = 0;
    for (var i = 1; i < kf.length; i++) {
      if (kf[i].metHours >= metH) { lo = i - 1; break; }
    }
    var hi = lo + 1;
    var t = (metH - kf[lo].metHours) / (kf[hi].metHours - kf[lo].metHours);
    return {
      metHours: metH,
      distEarthKm: kf[lo].distEarthKm + t * (kf[hi].distEarthKm - kf[lo].distEarthKm),
      distMoonKm:  kf[lo].distMoonKm  + t * (kf[hi].distMoonKm  - kf[lo].distMoonKm),
      speedKmh:    kf[lo].speedKmh    + t * (kf[hi].speedKmh    - kf[lo].speedKmh),
      altitudeKm:  kf[lo].altitudeKm  + t * (kf[hi].altitudeKm  - kf[lo].altitudeKm)
    };
  }

  // ── JPL Horizons–compatible telemetry (Astro /api/horizons) ─────────────

  function tryFetchHorizons() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);

    return fetch(INTERNAL_API_BASE + 'horizons', { signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) return null;
        return resp.json().then(function (data) {
          if (data.source !== 'jpl-horizons' || data.distEarthKm == null) return null;
          return {
            distEarthKm: data.distEarthKm,
            distMoonKm:  data.distMoonKm,
            speedKmh:    data.speedKmh,
            altitudeKm:  data.altitudeKm,
            rangeRateKms: data.rangeRateKms,
            solarPhaseAngleDeg: data.solarPhaseAngleDeg,
            metHours:    getMETHours(),
            orionPos:    data.orion,
            moonPos:     data.moon,
            sunPos:      data.sun
          };
        });
      })
      .catch(function () {
        clearTimeout(timer);
        return null;
      });
  }

  // ── Community API: /api/orbit (5-min poll) ────────────────────────────

  function fetchCommunityOrbit() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);

    fetch(COMMUNITY_API_BASE + 'orbit', { signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) throw new Error('orbit ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        if (data && data.speedKmH != null) {
          lastCommunityOrbit = data;
          communityOrbitAvailable = true;
          applyCommunityOrbit(data);
        }
      })
      .catch(function () {
        clearTimeout(timer);
        communityOrbitAvailable = false;
      });
  }

  /** Merge community orbit data into lastTelemetry and update dashboard */
  function applyCommunityOrbit(orbit) {
    if (!orbit) return;

    // Update lastTelemetry with community orbit values (more accurate, auto-updated)
    // Only update fields we have data for — preserve rangeRateKms, solarPhaseAngleDeg, earthViewAngleDeg
    if (lastTelemetry) {
      if (orbit.speedKmH != null) lastTelemetry.speedKmh = orbit.speedKmH;
      if (orbit.earthDistKm != null) lastTelemetry.distEarthKm = orbit.earthDistKm;
      if (orbit.moonDistKm != null) lastTelemetry.distMoonKm = orbit.moonDistKm;
      if (orbit.altitudeKm != null) lastTelemetry.altitudeKm = orbit.altitudeKm;
    }

    // Update speed card with km/s as secondary
    setDashValue('speed', fmtNum(orbit.speedKmH) + ' km/h',
      orbit.speedKmS.toFixed(2) + ' km/s (' + fmtNum(kmhToMph(orbit.speedKmH)) + ' mph)');
    setDashValue('dist-earth', fmtNum(orbit.earthDistKm) + ' km',
      '(' + fmtNum(kmToMi(orbit.earthDistKm)) + ' mi)');
    setDashValue('dist-moon', fmtNum(orbit.moonDistKm) + ' km',
      '(' + fmtNum(kmToMi(orbit.moonDistKm)) + ' mi)');
    setDashValue('altitude', fmtNum(orbit.altitudeKm) + ' km',
      '(' + fmtNum(kmToMi(orbit.altitudeKm)) + ' mi)');
    setDashValue('light-delay', formatLightDelay(orbit.earthDistKm));

    // G-Force from orbit API (real computed value)
    if (orbit.gForce != null) {
      var gfEl = document.getElementById('val-gforce');
      if (gfEl) {
        // Remove "(estimated)" label since we have real data
        var estSpan = gfEl.querySelector('.dash-card__est');
        if (estSpan) estSpan.textContent = '(computed)';

        var gPrim = gfEl.querySelector('.dash-primary');
        var gSec = gfEl.querySelector('.dash-secondary');
        if (gPrim) {
          if (orbit.gForce < 0.001) {
            gPrim.textContent = 'Microgravity (~0 G)';
          } else {
            gPrim.textContent = orbit.gForce.toFixed(4) + ' G';
          }
        }
        if (gSec) {
          if (orbit.gForce < 0.001) gSec.textContent = 'Weightless — objects float freely';
          else if (orbit.gForce < 0.01) gSec.textContent = 'Near-weightless coast';
          else if (orbit.gForce < 1.0) gSec.textContent = 'Partial gravity';
          else gSec.textContent = 'Normal Earth gravity';
        }
      }
    }

    // Update sparklines & visuals with new data
    if (lastTelemetry) {
      pushSparklineData(lastTelemetry);
      updateAllSparklines();
      updateProgressBar(lastTelemetry);
      updateTrajectoryViz(lastTelemetry);
    }
  }

  // ── Community API: AROW SSE stream ──────────────────────────────────

  var SC_MODES = {
    '00': 'Off / Safe',
    '01': 'Launch',
    '02': 'Ascent',
    '03': 'Orbit Insertion',
    '04': 'Cruise',
    '05': 'Cruise',
    '06': 'Lunar Ops',
    '07': 'Return',
    '08': 'Entry',
    '09': 'Recovery',
    'ec': 'Earth Coast',
    'ed': 'Earth Departure',
    'tc': 'Trans-lunar Coast',
    'lc': 'Lunar Coast',
    'lo': 'Lunar Ops',
    'rc': 'Return Coast',
    're': 'Re-entry',
    'sm': 'Safe Mode',
    'nm': 'Normal Mode'
  };

  function startArowSSE() {
    // Use polling instead of SSE due to proxy limitations
    fetchArowPoll();
    setInterval(fetchArowPoll, AROW_POLL_MS);
  }

  function fetchArowPoll() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 5000);

    fetch(COMMUNITY_API_BASE + 'arow', { signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) throw new Error('arow ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        lastCommunityArow = data;
        communityArowAvailable = true;
        var sec = document.getElementById('spacecraft-telemetry');
        if (sec) sec.hidden = false;
        updateArowTelemetry(data);
      })
      .catch(function () {
        clearTimeout(timer);
        communityArowAvailable = false;
      });
  }

  function updateArowTelemetry(data) {
    if (!data) return;

    // Attitude (Roll / Pitch / Yaw) — separate p elements for screen reader
    if (data.eulerDeg) {
      var r = data.eulerDeg.roll;
      var p = data.eulerDeg.pitch;
      var y = data.eulerDeg.yaw;
      var attEl = document.getElementById('val-attitude');
      if (attEl) {
        var attPrim = attEl.querySelector('.dash-primary');
        if (attPrim) attPrim.innerHTML =
          '<p>Roll: ' + r.toFixed(1) + '\u00B0</p>' +
          '<p>Pitch: ' + p.toFixed(1) + '\u00B0</p>' +
          '<p>Yaw: ' + y.toFixed(1) + '\u00B0</p>';

      }
    }

    // Angular Rates — separate p elements
    // API double-converts rad→deg; undo one conversion (÷ 57.2958)
    if (data.rollRate != null) {
      var RAD2DEG = 57.2957795131;
      var corrRoll = data.rollRate / RAD2DEG;
      var corrPitch = data.pitchRate / RAD2DEG;
      var corrYaw = data.yawRate / RAD2DEG;
      var arEl = document.getElementById('val-angular-rates');
      if (arEl) {
        var arPrim = arEl.querySelector('.dash-primary');
        if (arPrim) arPrim.innerHTML =
          '<p>Roll: ' + corrRoll.toFixed(3) + '\u00B0/s</p>' +
          '<p>Pitch: ' + corrPitch.toFixed(3) + '\u00B0/s</p>' +
          '<p>Yaw: ' + corrYaw.toFixed(3) + '\u00B0/s</p>';

      }
    }

    // Solar Array Wings — separate p elements
    if (data.sawAngles) {
      var sa = data.sawAngles;
      var sawEl = document.getElementById('val-solar-arrays');
      if (sawEl) {
        var sawPrim = sawEl.querySelector('.dash-primary');
        if (sawPrim) sawPrim.innerHTML =
          '<p>Wing 1: ' + sa.saw1.toFixed(1) + '\u00B0</p>' +
          '<p>Wing 2: ' + sa.saw2.toFixed(1) + '\u00B0</p>' +
          '<p>Wing 3: ' + sa.saw3.toFixed(1) + '\u00B0</p>' +
          '<p>Wing 4: ' + sa.saw4.toFixed(1) + '\u00B0</p>';

      }
    }

    // Antenna Gimbals — separate p elements
    if (data.antennaGimbal) {
      var ag = data.antennaGimbal;
      var agEl = document.getElementById('val-antenna-gimbal');
      if (agEl) {
        var agPrim = agEl.querySelector('.dash-primary');
        if (agPrim) agPrim.innerHTML =
          '<p>Antenna 1: Az ' + ag.az1.toFixed(1) + '\u00B0, El ' + ag.el1.toFixed(1) + '\u00B0</p>' +
          '<p>Antenna 2: Az ' + ag.az2.toFixed(1) + '\u00B0, El ' + ag.el2.toFixed(1) + '\u00B0</p>';

      }
    }

    // Spacecraft Mode — show friendly name if known, otherwise just the hex code
    if (data.spacecraftMode != null) {
      var modeCode = String(data.spacecraftMode).toLowerCase();
      var modeLabel = SC_MODES[modeCode];
      if (modeLabel) {
        setDashValue('sc-mode', modeLabel, 'AROW mode byte: 0x' + modeCode.toUpperCase());
      } else {
        setDashValue('sc-mode', '0x' + modeCode.toUpperCase(), 'Raw AROW mode byte');
      }
    }

    // Timestamp with staleness indicator
    var tsEl = document.getElementById('arow-timestamp');
    if (tsEl && data.timestamp) {
      var ts = new Date(data.timestamp);
      var ageSec = Math.round((Date.now() - ts.getTime()) / 1000);
      var ageStr;
      if (ageSec < 10) ageStr = 'just now';
      else if (ageSec < 60) ageStr = ageSec + ' seconds ago';
      else if (ageSec < 3600) ageStr = Math.round(ageSec / 60) + ' minutes ago';
      else ageStr = Math.round(ageSec / 3600) + ' hours ago';

      tsEl.textContent = 'Last update: ' + ts.toLocaleTimeString() + ' (' + ageStr + ')';
    }
  }

  // ── Community API: DSN (10s poll, JSON) ─────────────────────────────

  function fetchCommunityDSN() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);

    fetch(COMMUNITY_API_BASE + 'dsn', { signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) throw new Error('dsn ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        if (data && data.dishes) {
          renderCommunityDSN(data);
        }
      })
      .catch(function (err) {
        clearTimeout(timer);
        // Silently fall through — XML DSN is still running as backup
      });
  }

  function renderCommunityDSN(data) {
    var container = document.getElementById('dsn-orion-dishes');
    var statusEl = document.getElementById('dsn-orion-status');
    if (!container || !statusEl) return;

    var dishes = data.dishes || [];
    if (dishes.length === 0) {
      // Fall through to XML DSN rendering
      return;
    }

    // Build Orion DSN dish entries from community API format
    var orionDishes = [];
    for (var i = 0; i < dishes.length; i++) {
      var d = dishes[i];
      orionDishes.push({
        dish: {
          name: d.dish,
          station: d.stationName || d.station,
          size: '34m'
        },
        target: { name: 'EM2', rtlt: d.rtltSeconds ? String(d.rtltSeconds) : '' }
      });
    }

    // Update comms status
    lastDSNOrionDishes = orionDishes;
    updateCommsStatus(getMETHours(), orionDishes);

    statusEl.textContent = dishes.length + ' dish' + (dishes.length !== 1 ? 'es' : '') + ' tracking Orion';
    statusEl.className = 'dsn-tracking';

    var html = '';
    for (var k = 0; k < dishes.length; k++) {
      var dish = dishes[k];

      var hasUp = dish.uplinkActive;
      var hasDown = dish.downlinkActive;
      var direction = hasUp && hasDown ? 'Uplink + Downlink' : hasUp ? 'Uplink' : hasDown ? 'Downlink' : 'Idle';

      var bands = [];
      if (dish.downlinkBand) bands.push(formatBand(dish.downlinkBand));
      if (dish.uplinkBand && dish.uplinkBand !== dish.downlinkBand) bands.push(formatBand(dish.uplinkBand));

      var dataRate = dish.downlinkRate ? formatDataRate(dish.downlinkRate) : null;

      var rtlt = dish.rtltSeconds;
      var rtltStr = (rtlt && rtlt > 0) ? (rtlt < 60 ? rtlt.toFixed(2) + ' s' : (rtlt / 60).toFixed(1) + ' min') : null;

      var rangeStr = dish.rangeKm ? fmtNum(dish.rangeKm, 0) + ' km' : null;

      var pointingStr = (dish.azimuth != null && dish.elevation != null)
        ? 'Az: ' + dish.azimuth.toFixed(1) + '\u00B0 / El: ' + dish.elevation.toFixed(1) + '\u00B0' : null;

      html += '<div class="dsn-dish-card dsn-dish-card--orion">';
      html += '<div class="dsn-dish-header">';
      html += '<span class="dsn-dish-name">' + dish.dish + '</span>';
      html += '<span class="dsn-dish-meta">' + (dish.stationName || dish.station) + '</span>';
      html += '</div>';
      html += '<dl class="dsn-dish-details">';
      html += '<dt>Signal</dt><dd>' + direction + '</dd>';
      if (bands.length) html += '<dt>Band</dt><dd>' + bands.join(', ') + '</dd>';
      if (dataRate) html += '<dt>Data rate</dt><dd>' + dataRate + '</dd>';
      if (rtltStr) html += '<dt>Round-trip light time</dt><dd>' + rtltStr + '</dd>';
      if (rangeStr) html += '<dt>Range</dt><dd>' + rangeStr + '</dd>';
      if (pointingStr) html += '<dt>Dish pointing</dt><dd>' + pointingStr + '</dd>';
      html += '</dl></div>';
    }

    container.innerHTML = html;
  }

  // ── Data fetching ──────────────────────────────────────────────────────

  function tryFetchLive() {
    var idx = 0;

    function attempt() {
      if (idx >= AROW_ENDPOINTS.length) return Promise.resolve(null);
      var url = AROW_ENDPOINTS[idx];
      idx++;

      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 5000);

      return fetch(url, { mode: 'cors', signal: controller.signal })
        .then(function (resp) {
          clearTimeout(timer);
          if (!resp.ok) return attempt();
          return resp.json().then(function (data) {
            var t = {
              distEarthKm: data.distanceFromEarth || data.distance_earth_km || data.distEarthKm,
              temperature: data.temperature || data.temp || data.temperatureCelsius || null,
              distMoonKm:  data.distanceFromMoon  || data.distance_moon_km  || data.distMoonKm,
              speedKmh:    data.speed              || data.velocity_kmh      || data.speedKmh,
              altitudeKm:  data.altitude           || data.altitude_km       || data.altitudeKm,
              metHours:    getMETHours()
            };
            if (t.distEarthKm != null) return t;
            return attempt();
          });
        })
        .catch(function () {
          clearTimeout(timer);
          return attempt();
        });
    }

    return attempt();
  }

  function tryCommunityOrbit() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);

    return fetch(COMMUNITY_API_BASE + 'orbit', { signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) return null;
        return resp.json().then(function (data) {
          if (data && data.speedKmH != null) {
            lastCommunityOrbit = data;
            communityOrbitAvailable = true;
            return {
              distEarthKm: data.earthDistKm,
              distMoonKm:  data.moonDistKm,
              speedKmh:    data.speedKmH,
              altitudeKm:  data.altitudeKm,
              metHours:    getMETHours(),
              _communityOrbit: data // keep full object for g-force etc.
            };
          }
          return null;
        });
      })
      .catch(function () {
        clearTimeout(timer);
        return null;
      });
  }

  function fetchTelemetry() {
    var metH = getMETHours();

    // Before launch: try AROW once, then try community orbit / Horizons, then show pre-launch state
    if (metH < 0 && !arowAttempted) {
      arowAttempted = true;
      return tryFetchLive().then(function (live) {
        if (live) {
          arowAvailable = true;
          lastTelemetry = live;
          dataSource = 'live';
          updateUI();
          return;
        }
        // AROW unavailable — try community orbit + Horizons together
        return Promise.all([tryCommunityOrbit(), tryFetchHorizons()]).then(function (results) {
          var co = results[0];
          var hz = results[1];

          if (hz) {
            lastTelemetry = hz;
            dataSource = 'horizons';
          } else if (co) {
            lastTelemetry = co;
            dataSource = 'horizons';
          } else {
            dataSource = 'prelaunch';
            lastTelemetry = null;
          }
          updateUI();

          if (co && co._communityOrbit) {
            applyCommunityOrbit(co._communityOrbit);
          }
        });
      }).catch(function (err) {
        console.error('fetchTelemetry error:', err);
        dataSource = 'prelaunch';
        updateUI();
      });
    }

    if (metH < 0 && arowAttempted && !arowAvailable) {
      // Still pre-launch, AROW failed — try community orbit + Horizons together
      return Promise.all([tryCommunityOrbit(), tryFetchHorizons()]).then(function (results) {
        var co = results[0];
        var hz = results[1];

        if (hz) {
          lastTelemetry = hz;
          dataSource = 'horizons';
        } else if (co) {
          lastTelemetry = co;
          dataSource = 'horizons';
        } else {
          dataSource = 'prelaunch';
          lastTelemetry = null;
        }
        updateUI();

        if (co && co._communityOrbit) {
          applyCommunityOrbit(co._communityOrbit);
        }
      }).catch(function () {
        dataSource = 'prelaunch';
        lastTelemetry = null;
        updateUI();
      });
    }

    // After launch or if AROW was available: try live → community orbit → Horizons → mock
    return tryFetchLive().then(function (live) {
      if (live) {
        lastTelemetry = live;
        dataSource = 'live';
        arowAvailable = true;
        updateUI();
        return;
      }
      // AROW failed — try community orbit + Horizons together
      return Promise.all([tryCommunityOrbit(), tryFetchHorizons()]).then(function (results) {
        var co = results[0];
        var hz = results[1];

        if (hz) {
          // Horizons has rangeRate, solarPhase, earthView, positions
          lastTelemetry = hz;
          dataSource = 'horizons';
        } else if (co) {
          lastTelemetry = co;
          dataSource = 'horizons';
        } else {
          lastTelemetry = interpolateTelemetry(metH);
          dataSource = 'mock';
        }

        updateUI();

        // Overlay community orbit on top (better speed/altitude/g-force)
        if (co && co._communityOrbit) {
          applyCommunityOrbit(co._communityOrbit);
        }
      });
    }).catch(function (err) {
      console.error('fetchTelemetry error:', err);
      lastTelemetry = interpolateTelemetry(metH);
      dataSource = 'mock';
      updateUI();
    });
  }

  // ── Current phase detection ────────────────────────────────────────────

  /** Get mission day number (1-based) from MET hours */
  function getMissionDay(metH) {
    if (metH < 0) return 0;
    // NASA flight days align with crew wake cycles, not 24h divisions
    // Day 1: launch through first sleep (~MET 0-20)
    // Day 2: MET ~20-42 (TLI day)
    // Day 3+: roughly 24h cycles after that
    if (metH < 20) return 1;
    if (metH < 42) return 2;
    return Math.floor((metH - 42) / 24) + 3;
  }

  /** Get a human-readable day + phase label, e.g. "Day 3 — Outbound Coast" */
  function getDayPhaseLabel(metH) {
    var day = getMissionDay(metH);
    var phase = getCurrentPhase(metH);
    var phaseLabel = (PHASE_LABELS && PHASE_LABELS[phase]) || phase;
    if (day <= 0) return phaseLabel;
    return 'Day ' + day + ' \u2014 ' + phaseLabel;
  }

  /** Get the next upcoming timed event after the current one */
  function getNextTimedEvent(metH) {
    for (var i = 0; i < TIMELINE.length; i++) {
      if (TIMELINE[i].metHours > metH) return TIMELINE[i];
    }
    return null;
  }

  function getCurrentPhase(metH) {
    if (metH < 0) return 'prelaunch';
    if (metH > 230) return 'postmission';
    for (var i = TIMELINE.length - 1; i >= 0; i--) {
      if (metH >= TIMELINE[i].metHours) return TIMELINE[i].phase;
    }
    return 'launch';
  }

  function getHumanStatus(telemetry, metH) {
    var phase = getCurrentPhase(metH);
    if (phase === 'prelaunch') {
      var hLeft = -metH;
      if (hLeft > 24) return 'Launch is in ' + Math.round(hLeft / 24) + ' days. The crew is preparing at Kennedy Space Center.';
      if (hLeft > 1) return 'Launch is in ' + Math.round(hLeft) + ' hours. Countdown is underway.';
      return 'Launch is in ' + Math.round(hLeft * 60) + ' minutes. Final countdown in progress.';
    }
    if (phase === 'postmission') return 'Mission complete. The Artemis II crew has returned safely to Earth.';
    if (!telemetry) return 'Orion is in flight. Awaiting telemetry data\u2026';

    var d = telemetry;
    var distE = fmtNum(d.distEarthKm);
    var speed = fmtNum(d.speedKmh);

    if (phase === 'launch' || phase === 'earth-orbit') {
      return 'Orion is in Earth orbit at ' + fmtNum(d.altitudeKm) + ' km altitude, travelling at ' + speed + ' km/h.';
    }
    if (phase === 'translunar' || phase === 'outbound-coast') {
      return 'Orion is ' + distE + ' km from Earth, coasting toward the Moon at ' + speed + ' km/h.';
    }
    if (phase === 'lunar-flyby') {
      if (d.distMoonKm < 10000) {
        return 'Orion is ' + fmtNum(d.distMoonKm) + ' km from the Moon \u2014 closest approach! Speed: ' + speed + ' km/h.';
      }
      return 'Orion is ' + distE + ' km from Earth near the Moon, travelling at ' + speed + ' km/h.';
    }
    if (phase === 'return-coast') {
      return 'Orion is ' + distE + ' km from Earth, heading home at ' + speed + ' km/h.';
    }
    if (phase === 'reentry') {
      if (d.altitudeKm != null && d.altitudeKm < 200 && d.speedKmh > 20000) {
        return 'Orion is re-entering Earth\u2019s atmosphere at ' + speed + ' km/h!';
      }
      return 'Orion is approaching Earth at ' + speed + ' km/h.';
    }
    if (phase === 'recovery') {
      return 'Orion has splashed down in the Pacific Ocean. Welcome home, Artemis II crew!';
    }
    return 'Orion is in flight.';
  }

  // ── G-Force calculation ───────────────────────────────────────────────

  function getCurrentGForce(metH) {
    if (typeof GFORCE_EVENTS === 'undefined') return { g: 1.0, label: 'Ground', context: 'Normal Earth gravity' };

    // Find active burn event
    for (var i = 0; i < GFORCE_EVENTS.length; i++) {
      var evt = GFORCE_EVENTS[i];
      if (metH >= evt.startMET && metH < evt.endMET) {
        // Interpolate G within the event
        var progress = (metH - evt.startMET) / (evt.endMET - evt.startMET);
        var g = evt.gMin + progress * (evt.gMax - evt.gMin);
        return { g: g, label: evt.label, context: getGForceContext(g) };
      }
    }

    // Between defined events = microgravity coast
    if (metH < 0) return { g: 1.0, label: 'Ground', context: 'Normal Earth gravity' };
    if (metH > 215) return { g: 1.0, label: 'Recovered', context: 'Normal Earth gravity' };
    return { g: 0, label: 'Coast phase', context: 'Weightless — objects float freely' };
  }

  function getGForceContext(g) {
    if (typeof GFORCE_CONTEXT === 'undefined') return '';
    for (var i = 0; i < GFORCE_CONTEXT.length; i++) {
      if (g <= GFORCE_CONTEXT[i].max) return GFORCE_CONTEXT[i].text;
    }
    return GFORCE_CONTEXT[GFORCE_CONTEXT.length - 1].text;
  }

  function updateGForce(metH) {
    var gf = getCurrentGForce(metH);
    var el = document.getElementById('val-gforce');
    if (!el) return;
    var prim = el.querySelector('.dash-primary');
    var sec = el.querySelector('.dash-secondary');
    if (prim) {
      if (gf.g === 0) {
        prim.textContent = 'Microgravity (0 G)';
      } else {
        prim.textContent = gf.g.toFixed(1) + ' G — ' + gf.label;
      }
    }
    if (sec) {
      sec.textContent = gf.context;
    }
  }

  // ── Crew Schedule ───────────────────────────────────────────────────────

  function getCurrentCrewActivity(metH) {
    if (typeof CREW_SCHEDULE === 'undefined') return null;

    var current = null;
    var next = null;

    for (var i = 0; i < CREW_SCHEDULE.length; i++) {
      var block = CREW_SCHEDULE[i];
      if (metH >= block.startMET && metH < block.endMET) {
        current = block;
        // Find next
        if (i + 1 < CREW_SCHEDULE.length) {
          next = CREW_SCHEDULE[i + 1];
        }
        break;
      }
    }

    // If between blocks, find the next upcoming
    if (!current) {
      for (var j = 0; j < CREW_SCHEDULE.length; j++) {
        if (CREW_SCHEDULE[j].startMET > metH) {
          next = CREW_SCHEDULE[j];
          break;
        }
      }
    }

    return { current: current, next: next };
  }

  function updateCrewActivity(metH) {
    var nowEl = document.getElementById('crew-activity-now');
    var nextEl = document.getElementById('crew-activity-next');
    if (!nowEl) return;

    if (metH < 0) {
      nowEl.textContent = 'Pre-launch preparations';
      if (nextEl) nextEl.textContent = '';
      return;
    }
    if (metH > 215) {
      nowEl.textContent = 'Mission complete \u2014 crew recovered';
      if (nextEl) nextEl.textContent = '';
      return;
    }

    // Now line: show current timed event if active (< 2h old), else show day/phase
    var currentIdx = getCurrentEventIndex(metH);
    var currentEvt = (currentIdx >= 0) ? TIMELINE[currentIdx] : null;
    var eventAge = currentEvt ? (metH - currentEvt.metHours) : 999;
    if (currentEvt && eventAge < 2) {
      nowEl.textContent = 'Now: ' + currentEvt.title;
    } else {
      nowEl.textContent = getDayPhaseLabel(metH);
    }

    // Next line: show next timed event with countdown (never untimed)
    if (nextEl) {
      var nextEvt = getNextTimedEvent(metH);
      if (nextEvt) {
        var hoursUntil = nextEvt.metHours - metH;
        var timeStr;
        if (hoursUntil < 1) {
          var mins = Math.round(hoursUntil * 60);
          timeStr = mins + (mins === 1 ? ' minute' : ' minutes');
        } else {
          var h = Math.floor(hoursUntil);
          var m = Math.round((hoursUntil - h) * 60);
          timeStr = h + (h === 1 ? ' hour' : ' hours');
          if (m > 0) timeStr += ' ' + m + (m === 1 ? ' minute' : ' minutes');
        }
        nextEl.textContent = 'Next: ' + nextEvt.title + ' in ' + timeStr;
      } else {
        nextEl.textContent = '';
      }
    }
  }

  // ── Comms Status ────────────────────────────────────────────────────────

  var lastDSNOrionDishes = [];  // Updated by fetchDSN

  function isInCommsBlackout(metH) {
    if (typeof COMMS_BLACKOUT_WINDOWS === 'undefined') return false;
    for (var i = 0; i < COMMS_BLACKOUT_WINDOWS.length; i++) {
      var w = COMMS_BLACKOUT_WINDOWS[i];
      if (metH >= w.startMET && metH < w.endMET) return w;
    }
    return false;
  }

  function updateCommsStatus(metH, orionDishes) {
    var dotEl = document.getElementById('comms-dot');
    var textEl = document.getElementById('comms-text');
    var detailEl = document.getElementById('comms-detail');
    if (!dotEl || !textEl) return;

    if (metH < 0) {
      dotEl.className = 'comms-dot comms-dot--yellow';
      textEl.textContent = 'Pre-launch — communications not yet active';
      if (detailEl) detailEl.textContent = '';
      return;
    }

    if (metH > 215) {
      dotEl.className = 'comms-dot comms-dot--green';
      textEl.textContent = 'Mission complete — crew recovered';
      if (detailEl) detailEl.textContent = '';
      return;
    }

    var blackout = isInCommsBlackout(metH);
    if (blackout) {
      dotEl.className = 'comms-dot comms-dot--red';
      textEl.textContent = 'Communications blackout — ' + blackout.reason;
      if (detailEl) detailEl.textContent = 'No signal possible. Contact will resume when Orion emerges.';
      return;
    }

    if (orionDishes && orionDishes.length > 0) {
      var stations = [];
      for (var i = 0; i < orionDishes.length; i++) {
        var d = orionDishes[i];
        var name = d.dish ? (d.dish.station + ' ' + d.dish.name) : 'DSN';
        if (stations.indexOf(name) === -1) stations.push(name);
      }
      dotEl.className = 'comms-dot comms-dot--green';
      textEl.textContent = 'In contact with Mission Control';
      if (detailEl) detailEl.textContent = 'Via ' + stations.join(', ');
    } else {
      dotEl.className = 'comms-dot comms-dot--yellow';
      textEl.textContent = 'Between ground station passes — contact will resume shortly';
      if (detailEl) detailEl.textContent = '';
    }
  }

  // ── Earth View (sub-spacecraft point) ──────────────────────────────────

  var OBLIQUITY_RAD = 23.4393 * Math.PI / 180;
  var COS_OBL = Math.cos(OBLIQUITY_RAD);
  var SIN_OBL = Math.sin(OBLIQUITY_RAD);

  /**
   * Convert ecliptic J2000 XYZ (km) to geographic latitude/longitude.
   * Returns { latDeg, lonDeg } or null if orionPos is missing.
   */
  function computeSubSpacecraftPoint(orionPos) {
    if (!orionPos || orionPos.x == null) return null;

    // 1. Ecliptic J2000 -> Equatorial (rotate around X by obliquity)
    var xEq = orionPos.x;
    var yEq = orionPos.y * COS_OBL - orionPos.z * SIN_OBL;
    var zEq = orionPos.y * SIN_OBL + orionPos.z * COS_OBL;

    // 2. Equatorial XYZ -> RA / Dec
    var r = Math.sqrt(xEq * xEq + yEq * yEq + zEq * zEq);
    if (r === 0) return null;
    var decRad = Math.asin(zEq / r);
    var raRad = Math.atan2(yEq, xEq);
    if (raRad < 0) raRad += 2 * Math.PI;

    // 3. GMST for current UTC (simplified IAU formula)
    var now = new Date();
    var jd = now.getTime() / 86400000 + 2440587.5;
    var T = (jd - 2451545.0) / 36525.0;
    var gmstDeg = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                  + 0.000387933 * T * T - (T * T * T) / 38710000;
    gmstDeg = ((gmstDeg % 360) + 360) % 360;
    var gmstRad = gmstDeg * Math.PI / 180;

    // 4. Geographic longitude = RA - GMST, latitude = declination
    var lonDeg = (raRad - gmstRad) * 180 / Math.PI;
    // Normalize to [-180, 180]
    lonDeg = ((lonDeg + 540) % 360) - 180;
    var latDeg = decRad * 180 / Math.PI;

    return { latDeg: latDeg, lonDeg: lonDeg };
  }

  /**
   * Look up which region of Earth a lat/lon falls in.
   * Uses simple bounding boxes — descriptive, not pixel-perfect.
   */
  var EARTH_REGIONS = [
    // Land masses (checked first, roughly north-to-south, west-to-east)
    { name: 'Arctic',           latMin: 66,  latMax: 90,  lonMin: -180, lonMax: 180 },
    { name: 'Scandinavia',      latMin: 55,  latMax: 71,  lonMin: 5,    lonMax: 32 },
    { name: 'Northern Europe',  latMin: 46,  latMax: 55,  lonMin: -10,  lonMax: 32 },
    { name: 'Southern Europe',  latMin: 35,  latMax: 46,  lonMin: -10,  lonMax: 32 },
    { name: 'Eastern Europe',   latMin: 45,  latMax: 62,  lonMin: 32,   lonMax: 60 },
    { name: 'Russia',           latMin: 50,  latMax: 75,  lonMin: 32,   lonMax: 180 },
    { name: 'Alaska',           latMin: 54,  latMax: 72,  lonMin: -170, lonMax: -130 },
    { name: 'Northern Canada',  latMin: 54,  latMax: 72,  lonMin: -130, lonMax: -55 },
    { name: 'Western US',       latMin: 32,  latMax: 49,  lonMin: -125, lonMax: -104 },
    { name: 'Central US',       latMin: 30,  latMax: 49,  lonMin: -104, lonMax: -85 },
    { name: 'Eastern US',       latMin: 25,  latMax: 49,  lonMin: -85,  lonMax: -66 },
    { name: 'Central America',  latMin: 7,   latMax: 25,  lonMin: -120, lonMax: -60 },
    { name: 'Caribbean',        latMin: 10,  latMax: 25,  lonMin: -85,  lonMax: -60 },
    { name: 'Northern South America', latMin: -5, latMax: 12, lonMin: -82, lonMax: -34 },
    { name: 'Brazil',           latMin: -34, latMax: -5,  lonMin: -74,  lonMax: -34 },
    { name: 'Southern South America', latMin: -56, latMax: -20, lonMin: -82, lonMax: -50 },
    { name: 'North Africa',     latMin: 15,  latMax: 37,  lonMin: -18,  lonMax: 40 },
    { name: 'West Africa',      latMin: 0,   latMax: 15,  lonMin: -18,  lonMax: 15 },
    { name: 'Central Africa',   latMin: -10, latMax: 10,  lonMin: 15,   lonMax: 35 },
    { name: 'East Africa',      latMin: -12, latMax: 15,  lonMin: 28,   lonMax: 52 },
    { name: 'Southern Africa',  latMin: -35, latMax: -10, lonMin: 10,   lonMax: 42 },
    { name: 'Middle East',      latMin: 12,  latMax: 42,  lonMin: 32,   lonMax: 60 },
    { name: 'Central Asia',     latMin: 35,  latMax: 55,  lonMin: 50,   lonMax: 90 },
    { name: 'South Asia',       latMin: 5,   latMax: 35,  lonMin: 60,   lonMax: 95 },
    { name: 'East Asia',        latMin: 20,  latMax: 55,  lonMin: 100,  lonMax: 145 },
    { name: 'Southeast Asia',   latMin: -10, latMax: 20,  lonMin: 95,   lonMax: 145 },
    { name: 'Australia',        latMin: -45, latMax: -10, lonMin: 110,  lonMax: 155 },
    { name: 'New Zealand',      latMin: -48, latMax: -34, lonMin: 165,  lonMax: 180 },
    { name: 'Antarctic',        latMin: -90, latMax: -60, lonMin: -180, lonMax: 180 },
    // Oceans (fallback — checked after land)
    { name: 'North Pacific Ocean',  latMin: 0,   latMax: 66, lonMin: 145,  lonMax: 180 },
    { name: 'North Pacific Ocean',  latMin: 0,   latMax: 66, lonMin: -180, lonMax: -120 },
    { name: 'South Pacific Ocean',  latMin: -60, latMax: 0,  lonMin: 145,  lonMax: 180 },
    { name: 'South Pacific Ocean',  latMin: -60, latMax: 0,  lonMin: -180, lonMax: -70 },
    { name: 'North Atlantic Ocean', latMin: 0,   latMax: 66, lonMin: -80,  lonMax: -5 },
    { name: 'South Atlantic Ocean', latMin: -60, latMax: 0,  lonMin: -70,  lonMax: 20 },
    { name: 'Indian Ocean',         latMin: -60, latMax: 30, lonMin: 20,   lonMax: 120 },
    { name: 'Pacific Ocean',        latMin: -60, latMax: 66, lonMin: -180, lonMax: 180 }
  ];

  function lookupRegion(latDeg, lonDeg) {
    for (var i = 0; i < EARTH_REGIONS.length; i++) {
      var r = EARTH_REGIONS[i];
      if (latDeg >= r.latMin && latDeg <= r.latMax &&
          lonDeg >= r.lonMin && lonDeg <= r.lonMax) {
        return r.name;
      }
    }
    return 'Open Ocean';
  }

  function formatLatLon(latDeg, lonDeg) {
    var latDir = latDeg >= 0 ? 'N' : 'S';
    var lonDir = lonDeg >= 0 ? 'E' : 'W';
    return Math.abs(latDeg).toFixed(1) + '\u00B0' + latDir + ', '
         + Math.abs(lonDeg).toFixed(1) + '\u00B0' + lonDir;
  }

  var EARTH_RADIUS_KM = 6371;

  /**
   * Compute the visible extent of Earth from the spacecraft.
   * Returns { westRegion, eastRegion } — the westernmost and easternmost
   * major landmasses/regions visible, or null if data is insufficient.
   */
  function computeVisibleExtent(subLat, subLon, orionPos) {
    // Distance from Earth centre (km)
    var D = Math.sqrt(
      orionPos.x * orionPos.x +
      orionPos.y * orionPos.y +
      orionPos.z * orionPos.z
    );
    if (D <= EARTH_RADIUS_KM) return null;

    // Angular distance on Earth's surface from sub-spacecraft point to
    // the horizon (edge of the visible disc). From the right triangle
    // formed by Earth centre, spacecraft, and tangent point:
    //   cos(groundAngle) = R / D
    var groundAngle = Math.acos(EARTH_RADIUS_KM / D);

    // Sample boundary points around the disc edge.
    var DEG2RAD = Math.PI / 180;
    var RAD2DEG = 180 / Math.PI;
    var subLatRad = subLat * DEG2RAD;
    var subLonRad = subLon * DEG2RAD;

    // Compute lat/lon of a point at angular distance d (rad) and bearing b (rad)
    // from (lat1, lon1) on a sphere.
    function destPoint(lat1, lon1, d, bearing) {
      var sinD = Math.sin(d);
      var cosD = Math.cos(d);
      var sinLat1 = Math.sin(lat1);
      var cosLat1 = Math.cos(lat1);
      var lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(bearing));
      var lon2 = lon1 + Math.atan2(
        Math.sin(bearing) * sinD * cosLat1,
        cosD - sinLat1 * Math.sin(lat2)
      );
      return { latDeg: lat2 * RAD2DEG, lonDeg: ((lon2 * RAD2DEG) + 540) % 360 - 180 };
    }

    // Sample 16 bearings around the disc edge
    var edgePoints = [];
    for (var i = 0; i < 16; i++) {
      var bearing = (i / 16) * 2 * Math.PI;
      edgePoints.push(destPoint(subLatRad, subLonRad, groundAngle, bearing));
    }

    // Find the westernmost and easternmost edge points
    // We need to handle the antimeridian properly.
    // Use the sub-spacecraft longitude as the reference center.
    // Normalize all edge longitudes relative to sub-spacecraft lon.
    var westPt = null, eastPt = null;
    var westOffset = Infinity, eastOffset = -Infinity;

    for (var j = 0; j < edgePoints.length; j++) {
      var ep = edgePoints[j];
      // Offset from sub-spacecraft lon, normalized to [-180, 180]
      var offset = ep.lonDeg - subLon;
      offset = ((offset + 540) % 360) - 180;

      if (offset < westOffset) {
        westOffset = offset;
        westPt = ep;
      }
      if (offset > eastOffset) {
        eastOffset = offset;
        eastPt = ep;
      }
    }

    if (!westPt || !eastPt) return null;

    var westRegion = lookupRegion(westPt.latDeg, westPt.lonDeg);
    var eastRegion = lookupRegion(eastPt.latDeg, eastPt.lonDeg);

    return { westRegion: westRegion, eastRegion: eastRegion };
  }

  /**
   * Determine whether the sub-spacecraft point on Earth is in daylight,
   * twilight, or night by computing the angle between the Sun direction
   * and the spacecraft direction (both as seen from Earth's centre).
   */
  function computeDayNight(orionPos, sunPos) {
    if (!sunPos || sunPos.x == null) return null;

    var dot = orionPos.x * sunPos.x + orionPos.y * sunPos.y + orionPos.z * sunPos.z;
    var magO = Math.sqrt(orionPos.x * orionPos.x + orionPos.y * orionPos.y + orionPos.z * orionPos.z);
    var magS = Math.sqrt(sunPos.x * sunPos.x + sunPos.y * sunPos.y + sunPos.z * sunPos.z);
    if (magO === 0 || magS === 0) return null;

    var cosAngle = dot / (magO * magS);
    var angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

    if (angleDeg < 85) return 'day';
    if (angleDeg > 95) return 'night';
    return 'twilight';
  }

  function updateEarthView(t) {
    if (!t || !t.orionPos) {
      setDashValue('earth-view', 'Awaiting data', '');
      return;
    }
    var pt = computeSubSpacecraftPoint(t.orionPos);
    if (!pt) {
      setDashValue('earth-view', 'Unavailable', '');
      return;
    }
    var region = lookupRegion(pt.latDeg, pt.lonDeg);
    var coords = formatLatLon(pt.latDeg, pt.lonDeg);

    var dayNight = computeDayNight(t.orionPos, t.sunPos);
    var sideLabel = dayNight === 'day' ? 'day side'
                  : dayNight === 'night' ? 'night side'
                  : dayNight === 'twilight' ? 'terminator'
                  : null;

    var primary = sideLabel
      ? 'Facing ' + region + ' (' + sideLabel + ') \u00B7 ' + coords
      : 'Facing ' + region + ' \u2014 ' + coords;

    // Show visible extent as secondary value
    var extent = computeVisibleExtent(pt.latDeg, pt.lonDeg, t.orionPos);
    var extentText = '';
    if (extent) {
      extentText = extent.westRegion === extent.eastRegion
        ? 'Visible: ' + extent.westRegion
        : 'Visible: ' + extent.westRegion + ' to ' + extent.eastRegion;
    }
    setDashValue('earth-view', primary, extentText);
  }

  // ── UI update ──────────────────────────────────────────────────────────

  function updateUI() {
    try {
      var metH = getMETHours();
      var t = lastTelemetry;
      var phase = getCurrentPhase(metH);

      // Hero — badge shows current timed event title if recent, else Day X — phase
      if (dom.missionPhase) {
        var currentIdx = getCurrentEventIndex(metH);
        var timelineEvent = (currentIdx >= 0) ? TIMELINE[currentIdx] : null;
        var eventAge = timelineEvent ? (metH - timelineEvent.metHours) : 999;
        if (timelineEvent && eventAge < 2) {
          dom.missionPhase.textContent = timelineEvent.title;
        } else {
          dom.missionPhase.textContent = getDayPhaseLabel(metH);
        }
      }
      if (dom.heroStatus) {
        dom.heroStatus.textContent = getHumanStatus(t, metH);
      }

      // Countdown / MET clock
      if (dom.metValue) {
        dom.metValue.textContent = formatCountdownOrMET(metH);
      }
      if (dom.metLabel) {
        dom.metLabel.textContent = metH < 0 ? 'Countdown to Launch' : 'Mission Elapsed Time';
      }

      // Data status — only update DOM when values change to prevent flicker
      if (dom.dataStatus) {
        var newStatusText, newStatusClass;
        if (dataSource === 'live') {
          newStatusText = 'Live data from NASA AROW';
          newStatusClass = 'data-status data-status--live';
        } else if (dataSource === 'horizons') {
          newStatusText = communityOrbitAvailable ? 'Real-time orbital data via AROW' : 'Real-time data from JPL Horizons';
          newStatusClass = 'data-status data-status--live';
        } else if (dataSource === 'prelaunch') {
          newStatusText = 'Pre-launch \u2014 data available after liftoff';
          newStatusClass = 'data-status data-status--prelaunch';
        } else {
          newStatusText = 'Simulated data (AROW unavailable)';
          newStatusClass = 'data-status data-status--mock';
        }
        if (dom.dataStatus.textContent !== newStatusText) {
          dom.dataStatus.textContent = newStatusText;
        }
        if (dom.dataStatus.className !== newStatusClass) {
          dom.dataStatus.className = newStatusClass;
        }
      }

      // Dashboard disclaimer — only update when changed to prevent flicker
      var disclaimerEl = document.getElementById('dash-disclaimer');
      if (disclaimerEl) {
        var arowLink = '<a href="https://artemis.cdnspace.ca" target="_blank" rel="noopener noreferrer">AROW Community API</a>';
        var newDisclaimer;
        if (dataSource === 'live') {
          newDisclaimer = 'Showing live telemetry from NASA AROW.';
        } else if (dataSource === 'horizons') {
          newDisclaimer = communityOrbitAvailable
            ? 'Orbital data from ' + arowLink + '. Attitude telemetry streamed live.'
            : 'Position and velocity computed from JPL Horizons ephemeris data (spacecraft ID \u22121024).';
        } else if (dataSource === 'mock') {
          newDisclaimer = communityOrbitAvailable
            ? 'Live telemetry via ' + arowLink
            : 'Data shown is estimated based on mission trajectory. Live NASA telemetry is not yet available.';
        } else {
          newDisclaimer = communityOrbitAvailable
            ? 'Live telemetry via ' + arowLink
            : 'Data shown is estimated based on mission trajectory. Live NASA telemetry is not yet available.';
        }
        if (disclaimerEl.innerHTML !== newDisclaimer) {
          disclaimerEl.innerHTML = newDisclaimer;
        }
      }

      // Dashboard values
      if (t) {
        var speedSec = '(' + fmtNum(kmhToMph(t.speedKmh)) + ' mph)';
        if (t._communityOrbit && t._communityOrbit.speedKmS != null) {
          speedSec = t._communityOrbit.speedKmS.toFixed(2) + ' km/s (' + fmtNum(kmhToMph(t.speedKmh)) + ' mph)';
        }
        setDashValue('speed', fmtNum(t.speedKmh) + ' km/h', speedSec);
        setDashValue('dist-earth', fmtNum(t.distEarthKm) + ' km', '(' + fmtNum(kmToMi(t.distEarthKm)) + ' mi)');
        setDashValue('dist-moon', fmtNum(t.distMoonKm) + ' km', '(' + fmtNum(kmToMi(t.distMoonKm)) + ' mi)');
        setDashValue('altitude', fmtNum(t.altitudeKm) + ' km', '(' + fmtNum(kmToMi(t.altitudeKm)) + ' mi)');
        setDashValue('light-delay', formatLightDelay(t.distEarthKm));

        // Range rate
        if (t.rangeRateKms != null) {
          var rrAbs = Math.abs(t.rangeRateKms);
          var rrLabel = t.rangeRateKms >= 0 ? 'Receding' : 'Approaching';
          setDashValue('range-rate', rrAbs.toFixed(3) + ' km/s', rrLabel + ' Earth');
        }

        // Solar phase angle
        if (t.solarPhaseAngleDeg != null) {
          var spa = t.solarPhaseAngleDeg;
          var spaLabel;
          if (spa < 30) spaLabel = 'Fully sunlit';
          else if (spa < 90) spaLabel = 'Mostly sunlit';
          else if (spa < 150) spaLabel = 'Partially sunlit';
          else spaLabel = 'Backlit';
          setDashValue('solar-phase', spa.toFixed(1) + '\u00B0', spaLabel);
        }

        // Apparent sizes
        updateApparentSizes(t);

        // Earth View (sub-spacecraft point)
        updateEarthView(t);

        // dash-live-summary disabled

        // Sparklines, progress bar, and trajectory
        pushSparklineData(t);
        updateAllSparklines();
        updateProgressBar(t);
        updateTrajectoryViz(t);
      }

      // G-Force indicator — prefer community orbit (real computed) over keyframe estimate
      if (!communityOrbitAvailable) {
        updateGForce(metH);
      }

      // Crew activity
      updateCrewActivity(metH);

      // Comms status
      updateCommsStatus(metH, lastDSNOrionDishes);

      // Timeline — highlight current
      updateTimeline(metH);

      // Feed telemetry to sonification radar
      if (t && window.artemisAudio && typeof window.artemisAudio.updateTelemetry === 'function') {
        window.artemisAudio.updateTelemetry(t);
      }
    } catch (err) {
      console.error('updateUI error:', err);
    }
  }

  // ── Apparent-size helpers ──────────────────────────────────────────────
  var APPARENT_SIZE_COMPARISONS = [
    { deg: 0.5,  label: 'A pea at arm\u2019s length' },
    { deg: 1,    label: 'A pencil eraser at arm\u2019s length' },
    { deg: 2,    label: 'A marble at arm\u2019s length' },
    { deg: 4,    label: 'A ping-pong ball at arm\u2019s length' },
    { deg: 5,    label: 'A tennis ball at arm\u2019s length' },
    { deg: 7,    label: 'A baseball at arm\u2019s length' },
    { deg: 10,   label: 'A grapefruit at arm\u2019s length' },
    { deg: 13,   label: 'A basketball at arm\u2019s length' },
    { deg: 15,   label: 'A football (soccer ball) at arm\u2019s length' },
    { deg: 20,   label: 'A dinner plate at arm\u2019s length' },
    { deg: 30,   label: 'A beach ball at arm\u2019s length' },
    { deg: 45,   label: 'A large umbrella at arm\u2019s length' }
  ];

  function apparentDiameterDeg(radiusKm, distanceKm) {
    if (!distanceKm || distanceKm <= radiusKm) return null;
    return 2 * Math.asin(radiusKm / distanceKm) * (180 / Math.PI);
  }

  function closestComparison(deg) {
    var best = APPARENT_SIZE_COMPARISONS[0];
    var bestDiff = Math.abs(deg - best.deg);
    for (var i = 1; i < APPARENT_SIZE_COMPARISONS.length; i++) {
      var diff = Math.abs(deg - APPARENT_SIZE_COMPARISONS[i].deg);
      if (diff < bestDiff) { best = APPARENT_SIZE_COMPARISONS[i]; bestDiff = diff; }
    }
    return best.label;
  }

  var MOON_FROM_EARTH_DEG = 0.52;

  function updateApparentSizes(t) {
    if (!t) return;

    // Earth apparent size
    var earthDeg = apparentDiameterDeg(6371, t.distEarthKm);
    if (earthDeg != null) {
      var earthComp = closestComparison(earthDeg);
      var earthTimes = earthDeg / MOON_FROM_EARTH_DEG;
      var earthPrimary = earthDeg.toFixed(2) + '\u00B0';
      var earthSecondary = '\u2248 ' + earthComp;
      setDashValue('earth-apparent', earthPrimary, earthSecondary);
      // Update tertiary context line (appended to secondary dd to avoid orphaned dd)
      var earthEl = document.getElementById('val-earth-apparent');
      if (earthEl) {
        var earthSec = earthEl.querySelector('.dash-secondary');
        if (earthSec) {
          earthSec.textContent = earthSecondary + ' \u2014 ' + earthTimes.toFixed(1) + '\u00D7 larger than the Moon appears from Earth';
        }
      }
    }

    // Moon apparent size
    var moonDeg = apparentDiameterDeg(1737, t.distMoonKm);
    if (moonDeg != null) {
      var moonComp = closestComparison(moonDeg);
      var moonTimes = moonDeg / MOON_FROM_EARTH_DEG;
      var moonPrimary = moonDeg.toFixed(2) + '\u00B0';
      var moonSecondary = '\u2248 ' + moonComp;
      setDashValue('moon-apparent', moonPrimary, moonSecondary);
      var moonEl = document.getElementById('val-moon-apparent');
      if (moonEl) {
        var moonSec = moonEl.querySelector('.dash-secondary');
        if (moonSec) {
          var moonCtxText = moonTimes >= 1
            ? moonTimes.toFixed(1) + '\u00D7 larger than the Moon appears from Earth'
            : moonTimes.toFixed(2) + '\u00D7 the size of the Moon from Earth';
          moonSec.textContent = moonSecondary + ' \u2014 ' + moonCtxText;
        }
      }
    }
  }

  function setDashValue(id, primary, secondary) {
    var el = document.getElementById('val-' + id);
    if (!el) return;
    var prim = el.querySelector('.dash-primary');
    var sec  = el.querySelector('.dash-secondary');
    if (prim) prim.textContent = primary;
    if (sec)  sec.textContent = secondary;
  }

  // ── Schedule: single source of truth from GitHub ───────────────────────

  var SCHEDULE_URL = 'https://api.github.com/repos/jakobrosin/artemis-data/contents/schedule.json';

  /**
   * Build the TIMELINE array from raw event objects (from schedule.json or
   * FALLBACK_EVENTS).  Each raw event has { id, metHours, phase, title, summary }.
   * We compute utc from metHours + LAUNCH_EPOCH_UTC, then merge in detail + links
   * from EVENT_DETAILS.  The result is sorted by metHours.
   *
   * Events with timed:false are stored in UNTIMED_ACTIVITIES grouped by day.
   * TIMELINE only contains timed events (used by getCurrentEventIndex, hero, etc).
   * If an event has no 'timed' field, it defaults to timed:true for backwards compat.
   */
  function buildTimeline(rawEvents) {
    var launchMs = LAUNCH_EPOCH_UTC.getTime();
    TIMELINE.length = 0;
    // Clear untimed activities
    var keys = Object.keys(UNTIMED_ACTIVITIES);
    for (var k = 0; k < keys.length; k++) delete UNTIMED_ACTIVITIES[keys[k]];

    for (var i = 0; i < rawEvents.length; i++) {
      var src = rawEvents[i];
      var isTimed = src.timed !== false; // default true for backwards compat

      // Enrich from EVENT_DETAILS lookup
      var detail = null;
      var links = [];
      if (typeof EVENT_DETAILS !== 'undefined' && EVENT_DETAILS[src.id]) {
        var enrich = EVENT_DETAILS[src.id];
        if (enrich.detail) detail = enrich.detail;
        if (enrich.links)  links = enrich.links;
      }

      if (isTimed) {
        var evt = {
          id:          src.id,
          metHours:    src.metHours,
          phase:       src.phase,
          title:       src.title,
          description: src.summary,
          utc:         new Date(launchMs + src.metHours * 3600000).toISOString(),
          detail:      detail,
          links:       links
        };
        TIMELINE.push(evt);
      } else {
        var day = src.day || 1;
        if (!UNTIMED_ACTIVITIES[day]) UNTIMED_ACTIVITIES[day] = [];
        UNTIMED_ACTIVITIES[day].push({
          id:          src.id,
          day:         day,
          phase:       src.phase,
          title:       src.title,
          description: src.summary,
          detail:      detail,
          links:       links
        });
      }
    }
    TIMELINE.sort(function (a, b) { return a.metHours - b.metHours; });
  }

  /**
   * Fetch schedule.json from GitHub (single source of truth).
   * Builds TIMELINE from fetched events, updates CREW_SCHEDULE, and optionally
   * updates LAUNCH_EPOCH_UTC from the launchTime field.
   * Falls back to FALLBACK_EVENTS if fetch fails.
   */
  function fetchRemoteSchedule() {
    return fetch(SCHEDULE_URL, { headers: { 'Accept': 'application/vnd.github.v3.raw' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.events || !Array.isArray(data.events)) return;

        // Update launch epoch if provided
        if (data.launchTime) {
          var newEpoch = new Date(data.launchTime);
          if (!isNaN(newEpoch.getTime())) {
            LAUNCH_EPOCH_UTC.setTime(newEpoch.getTime());
          }
        }

        // Build TIMELINE from remote events
        buildTimeline(data.events);

        // Update CREW_SCHEDULE if present
        if (data.crewSchedule && Array.isArray(data.crewSchedule)) {
          CREW_SCHEDULE.length = 0;
          for (var i = 0; i < data.crewSchedule.length; i++) {
            CREW_SCHEDULE.push(data.crewSchedule[i]);
          }
        }

        // Show last updated time
        if (data.lastUpdated) {
          var updEl = document.getElementById('schedule-updated');
          if (updEl) {
            var updDate = new Date(data.lastUpdated);
            var updAgeSec = Math.round((Date.now() - updDate.getTime()) / 1000);
            var updAgeStr;
            if (updAgeSec < 10) updAgeStr = 'just now';
            else if (updAgeSec < 60) updAgeStr = updAgeSec + ' seconds ago';
            else if (updAgeSec < 3600) updAgeStr = Math.round(updAgeSec / 60) + ' minutes ago';
            else updAgeStr = Math.round(updAgeSec / 3600) + ' hours ago';
            updEl.textContent = 'Schedule last update: ' + updDate.toLocaleTimeString() + ' (' + updAgeStr + ')';
          }
        }


        // Re-render timeline with new data
        try {
          renderTimeline();
          updateTimeline(getMETHours());
          updateUI();
          // Don't auto-scroll to current event — let user start at top
        } catch (e) { console.error('Timeline re-render failed:', e); }
      })
      .catch(function (err) {
        console.warn('[Schedule] Failed to fetch remote schedule, using built-in data:', err.message);
      });
  }

  // ── Timeline rendering (tablist/tabpanel pattern) ──────────────────────

  /** Group TIMELINE events by phase */
  function groupEventsByPhase() {
    var groups = {};
    for (var i = 0; i < TIMELINE.length; i++) {
      var evt = TIMELINE[i];
      if (!groups[evt.phase]) groups[evt.phase] = [];
      groups[evt.phase].push(evt);
    }
    return groups;
  }

  /** Group UNTIMED_ACTIVITIES by phase */
  function groupUntimedByPhase() {
    var groups = {};
    var dayKeys = Object.keys(UNTIMED_ACTIVITIES);
    for (var d = 0; d < dayKeys.length; d++) {
      var activities = UNTIMED_ACTIVITIES[dayKeys[d]];
      for (var i = 0; i < activities.length; i++) {
        var act = activities[i];
        var phase = act.phase || 'outbound-coast';
        if (!groups[phase]) groups[phase] = [];
        groups[phase].push(act);
      }
    }
    return groups;
  }

  /** Determine which phase is "current" */
  function getCurrentTimelinePhase(metH) {
    if (!TIMELINE.length) return PHASE_ORDER[0];
    if (metH < TIMELINE[0].metHours) return TIMELINE[0].phase;
    if (metH > TIMELINE[TIMELINE.length - 1].metHours + 1) return PHASE_ORDER[PHASE_ORDER.length - 1];
    for (var i = TIMELINE.length - 1; i >= 0; i--) {
      if (metH >= TIMELINE[i].metHours) return TIMELINE[i].phase;
    }
    return PHASE_ORDER[0];
  }

  /** Find the current event index */
  function getCurrentEventIndex(metH) {
    var currentIdx = -1;
    for (var i = TIMELINE.length - 1; i >= 0; i--) {
      if (metH >= TIMELINE[i].metHours) {
        currentIdx = i;
        break;
      }
    }
    return currentIdx;
  }

  /** Activate a specific tab */
  function activateTab(phaseKey) {
    var tabs = document.querySelectorAll('#timeline-tabs [role="tab"]');
    var panels = document.querySelectorAll('#timeline-panels [role="tabpanel"]');

    for (var i = 0; i < tabs.length; i++) {
      var isSelected = tabs[i].getAttribute('data-phase') === phaseKey;
      tabs[i].setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tabs[i].setAttribute('tabindex', isSelected ? '0' : '-1');
      tabs[i].classList.toggle('timeline-tab--active', isSelected);
    }

    for (var j = 0; j < panels.length; j++) {
      var panelPhase = panels[j].getAttribute('data-phase');
      panels[j].hidden = (panelPhase !== phaseKey);
    }
  }

  /** Toggle a step's expanded state */
  function toggleStep(button) {
    var expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    var contentId = button.getAttribute('aria-controls');
    var content = document.getElementById(contentId);
    if (content) {
      content.hidden = expanded;
    }
  }

  /** Skip to current event: activate tab, expand step, scroll */
  function skipToCurrentEvent() {
    var metH = getMETHours();
    var currentPhase = getCurrentTimelinePhase(metH);
    var currentIdx = getCurrentEventIndex(metH);

    // If before first event, current is first event
    var targetEvt = currentIdx >= 0 ? TIMELINE[currentIdx] : TIMELINE[0];

    // Activate the tab containing the current event
    activateTab(targetEvt.phase);

    // Expand the current step
    var stepBtn = document.querySelector('#step-' + targetEvt.id + ' .timeline-step__toggle');
    if (stepBtn && stepBtn.getAttribute('aria-expanded') !== 'true') {
      toggleStep(stepBtn);
    }

    // Scroll to it
    var stepEl = document.getElementById('step-' + targetEvt.id);
    if (stepEl) {
      stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the heading inside for screen readers
      var heading = stepEl.querySelector('.timeline-step__heading');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }

  function renderTimeline() {
    var tabContainer = document.getElementById('timeline-tabs');
    var panelContainer = document.getElementById('timeline-panels');
    var hasUntimed = Object.keys(UNTIMED_ACTIVITIES).length > 0;
    if (!tabContainer || !panelContainer) return;
    if (!TIMELINE.length && !hasUntimed) return;

    // Replace containers with clean clones to remove stale event listeners on re-render
    var freshTabs = tabContainer.cloneNode(false);
    tabContainer.parentNode.replaceChild(freshTabs, tabContainer);
    tabContainer = freshTabs;

    var freshPanels = panelContainer.cloneNode(false);
    panelContainer.parentNode.replaceChild(freshPanels, panelContainer);
    panelContainer = freshPanels;

    var groups = groupEventsByPhase();
    var untimedGroups = groupUntimedByPhase();
    var metH = getMETHours();
    var currentPhase = getCurrentTimelinePhase(metH);
    var currentIdx = getCurrentEventIndex(metH);

    // Build tabs and panels
    for (var p = 0; p < PHASE_ORDER.length; p++) {
      var phaseKey = PHASE_ORDER[p];
      var events = groups[phaseKey] || [];
      var untimedForPhase = untimedGroups[phaseKey] || [];
      if (!events.length && !untimedForPhase.length) continue;

      var isCurrentPhase = (phaseKey === currentPhase);
      var tabId = 'tab-' + phaseKey;
      var panelId = 'panel-' + phaseKey;

      // ── Tab button ──
      var tab = document.createElement('button');
      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isCurrentPhase ? 'true' : 'false');
      tab.setAttribute('aria-controls', panelId);
      tab.setAttribute('tabindex', isCurrentPhase ? '0' : '-1');
      tab.setAttribute('data-phase', phaseKey);
      tab.className = 'timeline-tab' + (isCurrentPhase ? ' timeline-tab--active' : '');

      var tabLabel = (PHASE_LABELS[phaseKey] || phaseKey).replace(' Preparations', '').replace(' Operations', '');
      var totalCount = events.length + untimedForPhase.length;
      tab.textContent = tabLabel + ' (' + totalCount + ' step' + (totalCount !== 1 ? 's' : '') + ')';
      tabContainer.appendChild(tab);

      // ── Tab panel ──
      var panel = document.createElement('div');
      panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabId);
      panel.setAttribute('data-phase', phaseKey);
      panel.setAttribute('tabindex', '0');
      panel.hidden = !isCurrentPhase;
      panel.className = 'timeline-panel';

      for (var i = 0; i < events.length; i++) {
        var evt = events[i];
        var stepId = 'step-' + evt.id;
        var contentId = 'step-content-' + evt.id;

        // Determine if this is the current event
        var isCurrentEvent = false;
        if (currentIdx < 0 && evt === TIMELINE[0]) {
          isCurrentEvent = true;
        } else if (currentIdx >= 0 && TIMELINE[currentIdx] === evt) {
          // Check it hasn't been superseded
          var nextEvt = TIMELINE[currentIdx + 1];
          if (!nextEvt || metH < nextEvt.metHours) {
            isCurrentEvent = true;
          }
        }

        // Determine past/future
        var globalIdx = TIMELINE.indexOf(evt);
        var isPast = globalIdx < currentIdx;
        var isFuture = !isCurrentEvent && globalIdx > currentIdx;

        var step = document.createElement('div');
        step.id = stepId;
        step.className = 'timeline-step';
        if (isCurrentEvent) {
          step.classList.add('timeline-step--current');
        }
        else if (isPast) step.classList.add('timeline-step--past');
        else if (isFuture) step.classList.add('timeline-step--future');

        // The toggle button
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'timeline-step__toggle';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', contentId);
        // Current indicator handled by sr-only text, not aria-current

        var btnTitle = document.createElement('span');
        btnTitle.className = 'timeline-step__name';
        btnTitle.textContent = evt.title;
        btn.appendChild(btnTitle);

        var btnTime = document.createElement('span');
        btnTime.className = 'timeline-step__time';
        var timeMain = document.createElement('span');
        timeMain.className = 'timeline-step__time-date';
        timeMain.textContent = formatLocalTime(evt.utc);
        btnTime.appendChild(timeMain);
        var timeCountdown = document.createElement('span');
        timeCountdown.className = 'timeline-step__time-countdown';
        timeCountdown.setAttribute('data-utc', evt.utc);
        timeCountdown.textContent = formatTimeUntil(evt.utc);
        btnTime.appendChild(timeCountdown);
        btn.appendChild(btnTime);

        // C2 fix: append sr-only current event text after btn is created
        if (isCurrentEvent) {
          var srCurrent = document.createElement('span');
          srCurrent.className = 'sr-only sr-current';
          srCurrent.textContent = ' (Current event)';
          btn.appendChild(srCurrent);
        }

        step.appendChild(btn);

        // Heading for screen reader navigation — only current event gets h3
        if (isCurrentEvent) {
          var heading = document.createElement('h3');
          heading.className = 'timeline-step__heading sr-only';
          heading.textContent = 'Current: ' + evt.title;
          step.appendChild(heading);
        }

        // Expandable content
        var content = document.createElement('div');
        content.id = contentId;
        content.className = 'timeline-step__content';
        content.hidden = !isCurrentEvent;

        var descP = document.createElement('p');
        descP.className = 'timeline-step__desc';
        descP.textContent = evt.description;
        content.appendChild(descP);

        // Countdown / time-until
        var timeUntilP = document.createElement('p');
        timeUntilP.className = 'timeline-step__countdown';
        timeUntilP.textContent = formatTimeUntil(evt.utc);
        content.appendChild(timeUntilP);

        // Rich detail — format with headings and lists
        if (evt.detail) {
          var detailDiv = document.createElement('div');
          detailDiv.className = 'timeline-step__detail';
          renderDetail(evt.detail, detailDiv);
          content.appendChild(detailDiv);
        }

        // External links
        if (evt.links && evt.links.length) {
          var linksDiv = document.createElement('div');
          linksDiv.className = 'timeline-step__links';
          for (var k = 0; k < evt.links.length; k++) {
            var link = document.createElement('a');
            link.href = evt.links[k].url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = evt.links[k].text;
            var srHint = document.createElement('span');
            srHint.className = 'sr-only';
            srHint.textContent = ' (opens in new tab)';
            link.appendChild(srHint);
            linksDiv.appendChild(link);
          }
          content.appendChild(linksDiv);
        }

        step.appendChild(content);
        panel.appendChild(step);
      }

      // ── Untimed (planned) activities for this phase ──
      if (untimedForPhase.length) {
        var plannedSection = document.createElement('div');
        plannedSection.className = 'timeline-planned-activities';

        var plannedHeading = document.createElement('h3');
        plannedHeading.className = 'timeline-planned-activities__heading';
        plannedHeading.textContent = 'Planned activities';
        plannedSection.appendChild(plannedHeading);

        for (var u = 0; u < untimedForPhase.length; u++) {
          var act = untimedForPhase[u];
          var actStepId = 'step-' + act.id;
          var actContentId = 'step-content-' + act.id;

          var actStep = document.createElement('div');
          actStep.id = actStepId;
          actStep.className = 'timeline-step timeline-step--untimed';

          var actBtn = document.createElement('button');
          actBtn.type = 'button';
          actBtn.className = 'timeline-step__toggle';
          actBtn.setAttribute('aria-expanded', 'false');
          actBtn.setAttribute('aria-controls', actContentId);

          var actBtnTitle = document.createElement('span');
          actBtnTitle.className = 'timeline-step__name';
          actBtnTitle.textContent = act.title;
          actBtn.appendChild(actBtnTitle);

          if (act.day) {
            var actDayLabel = document.createElement('span');
            actDayLabel.className = 'timeline-step__day-label';
            actDayLabel.textContent = 'Day ' + act.day;
            actBtn.appendChild(actDayLabel);
          }

          actStep.appendChild(actBtn);

          // Expandable content
          var actContent = document.createElement('div');
          actContent.id = actContentId;
          actContent.className = 'timeline-step__content';
          actContent.hidden = true;

          if (act.description) {
            var actDesc = document.createElement('p');
            actDesc.className = 'timeline-step__desc';
            actDesc.textContent = act.description;
            actContent.appendChild(actDesc);
          }

          // Rich detail
          if (act.detail) {
            var actDetailDiv = document.createElement('div');
            actDetailDiv.className = 'timeline-step__detail';
            renderDetail(act.detail, actDetailDiv);
            actContent.appendChild(actDetailDiv);
          }

          // External links
          if (act.links && act.links.length) {
            var actLinksDiv = document.createElement('div');
            actLinksDiv.className = 'timeline-step__links';
            for (var al = 0; al < act.links.length; al++) {
              var actLink = document.createElement('a');
              actLink.href = act.links[al].url;
              actLink.target = '_blank';
              actLink.rel = 'noopener noreferrer';
              actLink.textContent = act.links[al].text;
              var actSrHint = document.createElement('span');
              actSrHint.className = 'sr-only';
              actSrHint.textContent = ' (opens in new tab)';
              actLink.appendChild(actSrHint);
              actLinksDiv.appendChild(actLink);
            }
            actContent.appendChild(actLinksDiv);
          }

          actStep.appendChild(actContent);
          plannedSection.appendChild(actStep);
        }

        panel.appendChild(plannedSection);
      }

      panelContainer.appendChild(panel);
    }

    // ── Tab keyboard navigation (arrow keys) ──
    tabContainer.addEventListener('keydown', function (e) {
      var tabs = tabContainer.querySelectorAll('[role="tab"]');
      var currentTab = document.activeElement;
      var idx = Array.prototype.indexOf.call(tabs, currentTab);
      if (idx < 0) return;

      var newIdx = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        newIdx = (idx + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        newIdx = (idx - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        newIdx = 0;
      } else if (e.key === 'End') {
        newIdx = tabs.length - 1;
      }

      if (newIdx >= 0) {
        e.preventDefault();
        var newPhase = tabs[newIdx].getAttribute('data-phase');
        activateTab(newPhase);
        tabs[newIdx].focus();
      }
    });

    // ── Tab click ──
    tabContainer.addEventListener('click', function (e) {
      var tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      activateTab(tab.getAttribute('data-phase'));
      tab.focus();
    });

    // ── Step toggle click ──
    panelContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.timeline-step__toggle');
      if (btn) toggleStep(btn);
    });

    // ── Skip to current button ──
    var skipBtn = document.getElementById('skip-to-current-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', skipToCurrentEvent);
    }
  }

  function updateTimeline(metH) {
    if (!TIMELINE || !TIMELINE.length) return;

    var currentIdx = getCurrentEventIndex(metH);
    var currentPhase = getCurrentTimelinePhase(metH);

    // Update step states
    for (var j = 0; j < TIMELINE.length; j++) {
      var evt = TIMELINE[j];
      var step = document.getElementById('step-' + evt.id);
      if (!step) continue;

      var btn = step.querySelector('.timeline-step__toggle');
      if (!btn) continue;

      step.classList.remove('timeline-step--past', 'timeline-step--current', 'timeline-step--future');
      // Remove old current sr-only text
      var oldCurrent = btn.querySelector('.sr-current');
      if (oldCurrent) oldCurrent.remove();

      if (currentIdx < 0) {
        if (j === 0) {
          step.classList.add('timeline-step--current');
          if (!btn.querySelector('.sr-current')) { var sc = document.createElement('span'); sc.className = 'sr-only sr-current'; sc.textContent = ' (Current event)'; btn.appendChild(sc); }
        } else {
          step.classList.add('timeline-step--future');
        }
      } else if (j < currentIdx) {
        step.classList.add('timeline-step--past');
      } else if (j === currentIdx) {
        var nextEvt = TIMELINE[j + 1];
        if (nextEvt && metH >= nextEvt.metHours) {
          step.classList.add('timeline-step--past');
        } else {
          step.classList.add('timeline-step--current');
          if (!btn.querySelector('.sr-current')) { var sc2 = document.createElement('span'); sc2.className = 'sr-only sr-current'; sc2.textContent = ' (Current event)'; btn.appendChild(sc2); }
        }
      } else {
        step.classList.add('timeline-step--future');
      }
    }

    // Update tab active states (highlight current phase tab)
    var tabs = document.querySelectorAll('#timeline-tabs [role="tab"]');
    for (var t = 0; t < tabs.length; t++) {
      var phaseKey = tabs[t].getAttribute('data-phase');
      var phaseIdx = PHASE_ORDER.indexOf(phaseKey);
      var currentPhaseIdx = PHASE_ORDER.indexOf(currentPhase);
      tabs[t].classList.toggle('timeline-tab--current-phase', phaseKey === currentPhase);
      tabs[t].classList.toggle('timeline-tab--past-phase', phaseIdx < currentPhaseIdx);
    }
  }

  // ── Crew rendering ─────────────────────────────────────────────────────

  function renderCrew() {
    var container = document.getElementById('crew-list');
    if (!container || !CREW || !CREW.length) return;
    container.innerHTML = '';

    for (var i = 0; i < CREW.length; i++) {
      var member = CREW[i];
      // Use <li> for semantic list since container is now <ul>
      var li = document.createElement('li');
      li.className = 'crew-card';

      var heading = document.createElement('h2');
      heading.className = 'crew-card__name';
      heading.textContent = member.name;
      li.appendChild(heading);

      var role = document.createElement('p');
      role.className = 'crew-card__role';
      role.textContent = member.role + ' \u2014 ' + member.agency;
      li.appendChild(role);

      var bio = document.createElement('p');
      bio.className = 'crew-card__bio';
      bio.textContent = member.bio;
      li.appendChild(bio);

      container.appendChild(li);
    }
  }

  // ── Spacecraft specs rendering ─────────────────────────────────────────

  function renderSpacecraft() {
    var container = document.getElementById('spacecraft-specs');
    if (!container || !SPACECRAFT) return;
    container.innerHTML = '';

    var sections = [
      SPACECRAFT.orion,
      SPACECRAFT.heatShield,
      SPACECRAFT.lifeSupport,
      SPACECRAFT.esm,
      SPACECRAFT.sls
    ];

    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!section) continue;

      var card = document.createElement('section');
      card.className = 'spec-card';

      var heading = document.createElement('h2');
      heading.className = 'spec-card__title';
      heading.textContent = section.name;
      card.appendChild(heading);

      var desc = document.createElement('p');
      desc.className = 'spec-card__desc';
      desc.textContent = section.description;
      card.appendChild(desc);

      var dl = document.createElement('dl');
      dl.className = 'spec-card__list';
      for (var k = 0; k < section.specs.length; k++) {
        var spec = section.specs[k];
        var dt = document.createElement('dt');
        dt.textContent = spec.label;
        dl.appendChild(dt);
        var dd = document.createElement('dd');
        dd.textContent = spec.value;
        dl.appendChild(dd);
      }
      card.appendChild(dl);

      container.appendChild(card);
    }
  }

  // ── Crew Schedule page rendering ──────────────────────────────────────

  function renderCrewSchedule() {
    var container = document.getElementById('crew-schedule-content');
    if (!container || typeof CREW_SCHEDULE === 'undefined') return;

    var metH = getMETHours();

    // Group by day
    var days = {};
    for (var i = 0; i < CREW_SCHEDULE.length; i++) {
      var entry = CREW_SCHEDULE[i];
      var day = entry.day || 1;
      if (!days[day]) days[day] = [];
      days[day].push(entry);
    }

    var DAY_TITLES = {
      1:  'Flight Day 1 — Launch & Earth Orbit',
      2:  'Flight Day 2 — Exercise & TLI Burn',
      3:  'Flight Day 3 — Outbound Coast',
      4:  'Flight Day 4 — Outbound Coast',
      5:  'Flight Day 5 — Spacesuit Testing & Lunar Approach',
      6:  'Flight Day 6 — Lunar Flyby',
      7:  'Flight Day 7 — Return Coast',
      8:  'Flight Day 8 — Radiation & Piloting Demos',
      9:  'Flight Day 9 — Re-entry Preparation',
      10: 'Flight Day 10 — Re-entry & Splashdown'
    };

    container.innerHTML = '';

    var dayKeys = Object.keys(days).sort(function (a, b) { return +a - +b; });
    for (var d = 0; d < dayKeys.length; d++) {
      var dayNum = dayKeys[d];
      var entries = days[dayNum];

      var section = document.createElement('div');
      section.className = 'schedule-day';

      var heading = document.createElement('h2');
      heading.className = 'schedule-day__heading';
      heading.textContent = DAY_TITLES[dayNum] || ('Flight Day ' + dayNum);
      section.appendChild(heading);

      var ul = document.createElement('ul');
      ul.className = 'schedule-list';

      for (var j = 0; j < entries.length; j++) {
        var e = entries[j];
        var isCurrent = metH >= e.startMET && metH < e.endMET;
        var isPast = metH >= e.endMET;

        var li = document.createElement('li');
        li.className = 'schedule-item';
        if (isCurrent) li.className += ' schedule-item--current';
        else if (isPast) li.className += ' schedule-item--past';

        var timeSpan = document.createElement('span');
        timeSpan.className = 'schedule-item__time';
        timeSpan.textContent = formatMETRange(e.startMET, e.endMET);
        li.appendChild(timeSpan);

        var body = document.createElement('div');
        body.className = 'schedule-item__body';

        var label = document.createElement('span');
        label.className = 'schedule-item__label';
        label.textContent = e.label;
        body.appendChild(label);

        if (e.desc) {
          var desc = document.createElement('p');
          desc.className = 'schedule-item__desc';
          desc.textContent = e.desc;
          body.appendChild(desc);
        }

        li.appendChild(body);
        ul.appendChild(li);
      }

      section.appendChild(ul);
      container.appendChild(section);
    }
  }

  function formatMETRange(startH, endH) {
    return 'T+' + formatMETShort(startH) + ' – ' + formatMETShort(endH);
  }

  function formatMETShort(hours) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    if (m === 60) { h++; m = 0; }
    return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
  }

  // Refresh crew schedule page highlights every 60s
  var crewScheduleRefreshTimer = null;

  function startCrewScheduleRefresh() {
    if (!document.getElementById('crew-schedule-content')) return;
    renderCrewSchedule();
    crewScheduleRefreshTimer = setInterval(renderCrewSchedule, 60000);
  }

  // ── News rendering ─────────────────────────────────────────────────────

  var NEWS_API_URL = INTERNAL_API_BASE + 'news';
  var NEWS_POLL_MS = 300000; // 5 minutes

  function formatRelativeTime(isoDate) {
    var now = Date.now();
    var then = new Date(isoDate).getTime();
    var diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return 'posted just now';
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return 'posted ' + diffMin + (diffMin === 1 ? ' minute' : ' minutes') + ' ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return 'posted ' + diffHr + (diffHr === 1 ? ' hour' : ' hours') + ' ago';
    var diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return 'posted ' + diffDay + (diffDay === 1 ? ' day' : ' days') + ' ago';
    var diffMo = Math.floor(diffDay / 30);
    return 'posted ' + diffMo + (diffMo === 1 ? ' month' : ' months') + ' ago';
  }

  function renderNews(items) {
    var container = document.getElementById('news-list');
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = '<p class="news-item__summary">No recent updates.</p>';
      return;
    }

    container.innerHTML = '';
    var totalItems = items.length;

    for (var i = 0; i < totalItems; i++) {
      var item = items[i];
      var article = document.createElement('article');
      article.className = 'news-item';
      article.setAttribute('aria-posinset', String(i + 1));
      article.setAttribute('aria-setsize', String(totalItems));

      var heading = document.createElement('h3');
      heading.className = 'news-item__title';
      var link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title;
      var srHint = document.createElement('span');
      srHint.className = 'sr-only';
      srHint.textContent = ' (opens in new tab)';
      link.appendChild(srHint);
      heading.appendChild(link);
      article.appendChild(heading);

      // Metadata line: relative time + source
      var meta = document.createElement('div');
      meta.className = 'news-item__meta';

      var date = document.createElement('time');
      date.className = 'news-item__date';
      date.setAttribute('datetime', item.date);
      date.textContent = formatRelativeTime(item.date);
      meta.appendChild(date);

      if (item.source) {
        var sep = document.createTextNode(' \u00b7 ');
        meta.appendChild(sep);
        var source = document.createElement('span');
        source.className = 'news-item__source';
        source.textContent = item.source;
        meta.appendChild(source);
      }

      article.appendChild(meta);

      if (item.summary) {
        var summary = document.createElement('p');
        summary.className = 'news-item__summary';
        summary.textContent = item.summary;
        article.appendChild(summary);
      }

      container.appendChild(article);
    }
  }

  function fetchNews() {
    var container = document.getElementById('news-list');
    if (!container) return;
    container.setAttribute('aria-busy', 'true');

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);

    fetch(NEWS_API_URL, { signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.items) {
          renderNews(data.items);
        } else {
          renderNews([]);
        }
        container.setAttribute('aria-busy', 'false');
      })
      .catch(function (err) {
        clearTimeout(timer);
        console.error('News fetch failed:', err.message);
        container.innerHTML =
          '<p class="news-error">Unable to load latest updates. ' +
          '<button type="button" class="btn btn--retry-news">Retry</button></p>';
        container.setAttribute('aria-busy', 'false');
        var retryBtn = container.querySelector('.btn--retry-news');
        if (retryBtn) {
          retryBtn.addEventListener('click', function () {
            container.innerHTML = '<p class="news-item__summary">Loading updates\u2026</p>';
            fetchNews();
          });
        }
      });
  }

  // ── Countdown / MET clock tick ─────────────────────────────────────────

  function tickMET() {
    try {
      var metH = getMETHours();
      if (dom.metValue) {
        dom.metValue.textContent = formatCountdownOrMET(metH);
      }
      if (dom.metLabel) {
        dom.metLabel.textContent = metH < 0 ? 'Countdown to Launch' : 'Mission Elapsed Time';
      }
    } catch (err) {
      console.error('tickMET error:', err);
    }
  }

  /** Periodic SR announcement of countdown/MET — disabled to avoid disruptive auto-announcing */
  function announceMETForSR() {
    // Intentionally disabled: aria-live auto-announcements removed per accessibility review
  }

  // ── Skip-nav focus ─────────────────────────────────────────────────────

  function setupSkipNav() {
    var link = document.getElementById('skip-nav');
    if (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('main-content');
        if (target) {
          target.setAttribute('tabindex', '-1');
          target.focus();
        }
      });
    }
  }

  // ── On-demand MET announcement for screen readers ──────────────────────
  function setupMETAnnounce() {
    var btn = document.getElementById('met-announce-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var metH = getMETHours();
      var srText = formatCountdownOrMETForSR(metH);
      var announceEl = document.getElementById('met-sr-announce');
      if (announceEl) {
        announceEl.textContent = '';
        setTimeout(function () { announceEl.textContent = srText; }, 100);
      }
    });
  }

  // ── Mobile nav toggle with focus trap and Escape key ───────────────────

  function setupNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;

    function openMenu() {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      nav.classList.add('is-open');
      // Move focus to first nav link
      var firstLink = nav.querySelector('a');
      if (firstLink) firstLink.focus();
    }

    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('is-open');
      toggle.focus();
    }

    function isMenuOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    toggle.addEventListener('click', function () {
      if (isMenuOpen()) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close on link click
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        closeMenu();
      }
    });

    // Escape key closes menu
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isMenuOpen()) {
        closeMenu();
      }
    });

    // Focus trap within open mobile menu
    nav.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isMenuOpen()) return;

      var focusables = nav.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        // Shift+Tab from first item: move to toggle button (allow exiting to toggle)
        e.preventDefault();
        toggle.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        // Tab from last item: wrap to toggle button
        e.preventDefault();
        toggle.focus();
      }
    });

    // If focus leaves toggle and goes backward, trap into menu end
    toggle.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isMenuOpen()) return;

      var focusables = nav.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;

      if (!e.shiftKey) {
        // Tab forward from toggle: move to first menu item
        e.preventDefault();
        focusables[0].focus();
      } else {
        // Shift+Tab from toggle: move to last menu item
        e.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    });
  }


  // ── Deep Space Network integration ─────────────────────────────────────

  var DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml';
  var DSN_REFRESH_MS = 60000;
  var DSN_SPACECRAFT_NAMES = {
    'EM2': 'Orion (Artemis II)',
    'VGR1': 'Voyager 1',
    'VGR2': 'Voyager 2',
    'JNO': 'Juno',
    'MRO': 'Mars Reconnaissance Orbiter',
    'ESCB': 'ESA Comet Interceptor',
    'BIOS': 'BIOS-Sat',
    'SWFO': 'Space Weather Follow-On',
    'MVN': 'MAVEN',
    'NHPC': 'New Horizons',
    'SPP': 'Parker Solar Probe',
    'LUCY': 'Lucy',
    'PSYC': 'Psyche',
    'JWST': 'James Webb Space Telescope',
    'ACE': 'ACE',
    'CHDR': 'Chandra',
    'DSN': 'DSN Test',
    'TEST': 'Test Signal',
    'WIND': 'Wind',
    'SOHO': 'SOHO',
    'STEREO': 'STEREO',
    'THB': 'THEMIS-B',
    'THC': 'THEMIS-C',
    'DSCO': 'DSCOVR',
    'EM1': 'Orion (Artemis I)',
    'MSL': 'Curiosity Rover',
    'M20': 'Perseverance Rover',
    'M01O': 'Mars Odyssey',
    'MEX': 'Mars Express',
    'CAS': 'Cassini',
    'LRO': 'Lunar Reconnaissance Orbiter',
    'CLPS': 'CLPS Lander'
  };

  function friendlySpacecraftName(code) {
    return DSN_SPACECRAFT_NAMES[code] || code;
  }

  var DSN_STATION_NAMES = {
    '10': 'Goldstone', '20': 'Goldstone', '30': 'Goldstone',
    '40': 'Canberra', '50': 'Canberra', '60': 'Canberra',
    '70': 'Madrid', '80': 'Madrid', '90': 'Madrid'
  };

  // Spacecraft IDs and name patterns that could be Orion/Artemis
  // IDs may appear as positive (target id) or negative (spacecraftID on signals)
  var ORION_IDS = [23, 24, 28];
  var ORION_NAME_PATTERNS = ['ORION', 'ART', 'ARTEMIS', 'EM2'];

  function getStationName(dssName) {
    // DSS-XX: first two digits indicate the complex
    var match = dssName.match(/(\d+)/);
    if (!match) return 'Unknown';
    var num = match[1];
    // 70m dishes: DSS-14 (Goldstone), DSS-43 (Canberra), DSS-63 (Madrid)
    var prefix = num.length >= 2 ? num.substring(0, num.length - 1) : num;
    // Map based on number ranges
    var n = parseInt(num, 10);
    if (n >= 10 && n <= 29) return 'Goldstone';
    if (n >= 30 && n <= 49) return 'Canberra';
    if (n >= 50 && n <= 69) return 'Madrid';
    return DSN_STATION_NAMES[prefix] || 'Unknown';
  }

  function getDishSize(dssNum) {
    // 70m dishes
    var big = [14, 43, 63];
    var n = parseInt(dssNum, 10);
    if (big.indexOf(n) !== -1) return '70m';
    return '34m';
  }

  function isOrionTarget(spacecraft) {
    // Check spacecraft ID (absolute value — target ids are positive, signal ids are negative)
    var id = Math.abs(parseInt(spacecraft.id, 10));
    if (ORION_IDS.indexOf(id) !== -1) return true;

    // Check spacecraft name
    var name = (spacecraft.name || '').toUpperCase();
    for (var i = 0; i < ORION_NAME_PATTERNS.length; i++) {
      if (name.indexOf(ORION_NAME_PATTERNS[i]) !== -1) return true;
    }

    return false;
  }

  function formatBand(band) {
    if (!band) return null;
    var b = band.toUpperCase();
    if (b === 'S') return 'S-band';
    if (b === 'X') return 'X-band';
    if (b === 'KA') return 'Ka-band';
    if (b === 'K') return 'K-band';
    if (b === 'L') return 'L-band';
    return b + '-band';
  }

  function formatDataRate(rate) {
    var r = parseFloat(rate);
    if (isNaN(r) || r <= 0) return null;
    if (r >= 1e6) return (r / 1e6).toFixed(2) + ' Mb/s';
    if (r >= 1e3) return (r / 1e3).toFixed(1) + ' kb/s';
    return r.toFixed(0) + ' b/s';
  }

  function parseDSNXml(xmlText) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parse errors
    var parseError = doc.querySelector('parsererror');
    if (parseError) return null;

    var dishes = [];
    var stationEls = doc.querySelectorAll('station');

    // Build station lookup from parent elements
    var stationMap = {};
    for (var si = 0; si < stationEls.length; si++) {
      var stn = stationEls[si];
      var stnName = stn.getAttribute('friendlyName') || stn.getAttribute('name') || '';
      var stnDishes = stn.querySelectorAll('dish');
      for (var sd = 0; sd < stnDishes.length; sd++) {
        var dName = stnDishes[sd].getAttribute('name') || '';
        if (dName) stationMap[dName] = stnName;
      }
    }

    var dishEls = doc.querySelectorAll('dish');

    for (var i = 0; i < dishEls.length; i++) {
      var d = dishEls[i];
      var dssName = d.getAttribute('name') || '';
      var dssNum = dssName.replace(/\D/g, '');

      // Collect targets (spacecraft) for this dish
      var targets = [];
      var targetEls = d.querySelectorAll('target');
      for (var j = 0; j < targetEls.length; j++) {
        var t = targetEls[j];
        var scName = t.getAttribute('name') || '';
        var scId = t.getAttribute('id') || '';
        if (scName && scName !== 'NONE' && scName !== 'TEST') {
          targets.push({
            name: scName,
            id: scId,
            uplegRange: t.getAttribute('uplegRange') || '',
            downlegRange: t.getAttribute('downlegRange') || '',
            rtlt: t.getAttribute('rtlt') || ''
          });
        }
      }

      // Signals — uplink and downlink (only active ones with data)
      var upSignals = [];
      var downSignals = [];
      var upEls = d.querySelectorAll('upSignal');
      var downEls = d.querySelectorAll('downSignal');

      for (var u = 0; u < upEls.length; u++) {
        var sig = upEls[u];
        if (sig.getAttribute('active') !== 'true') continue;
        var sigType = sig.getAttribute('signalType') || '';
        if (sigType === 'none') continue;
        upSignals.push({
          type: sigType,
          dataRate: sig.getAttribute('dataRate') || '',
          band: formatBand(sig.getAttribute('band')),
          power: sig.getAttribute('power') || '',
          spacecraft: sig.getAttribute('spacecraft') || '',
          spacecraftID: sig.getAttribute('spacecraftID') || ''
        });
      }

      for (var dn = 0; dn < downEls.length; dn++) {
        var dsig = downEls[dn];
        if (dsig.getAttribute('active') !== 'true') continue;
        var dsigType = dsig.getAttribute('signalType') || '';
        if (dsigType === 'none') continue;
        downSignals.push({
          type: dsigType,
          dataRate: dsig.getAttribute('dataRate') || '',
          band: formatBand(dsig.getAttribute('band')),
          power: dsig.getAttribute('power') || '',
          spacecraft: dsig.getAttribute('spacecraft') || '',
          spacecraftID: dsig.getAttribute('spacecraftID') || ''
        });
      }

      if (targets.length > 0) {
        dishes.push({
          name: dssName,
          num: dssNum,
          station: stationMap[dssName] || getStationName(dssName),
          size: getDishSize(dssNum),
          azimuthAngle: d.getAttribute('azimuthAngle') || '',
          elevationAngle: d.getAttribute('elevationAngle') || '',
          windSpeed: d.getAttribute('windSpeed') || '',
          isMSPA: d.getAttribute('isMSPA') === 'true',
          isArray: d.getAttribute('isArray') === 'true',
          isDDOR: d.getAttribute('isDDOR') === 'true',
          targets: targets,
          upSignals: upSignals,
          downSignals: downSignals
        });
      }
    }

    return dishes;
  }

  function renderDSNOrion(dishes) {
    var container = document.getElementById('dsn-orion-dishes');
    var statusEl = document.getElementById('dsn-orion-status');
    if (!container || !statusEl) return;

    // Find dishes tracking Orion — check targets and signal spacecraft names
    var orionDishes = [];
    for (var i = 0; i < dishes.length; i++) {
      var dish = dishes[i];
      var foundTarget = null;
      // Check targets
      for (var j = 0; j < dish.targets.length; j++) {
        if (isOrionTarget(dish.targets[j])) { foundTarget = dish.targets[j]; break; }
      }
      // Also check signal spacecraft names/IDs
      if (!foundTarget) {
        var allSignals = dish.upSignals.concat(dish.downSignals);
        for (var si = 0; si < allSignals.length; si++) {
          if (isOrionTarget({ name: allSignals[si].spacecraft, id: allSignals[si].spacecraftID })) {
            foundTarget = dish.targets[0] || { name: allSignals[si].spacecraft, id: allSignals[si].spacecraftID, rtlt: '', uplegRange: '', downlegRange: '' };
            break;
          }
        }
      }
      if (foundTarget) {
        orionDishes.push({ dish: dish, target: foundTarget });
      }
    }

    // Store for comms status indicator
    lastDSNOrionDishes = orionDishes;
    updateCommsStatus(getMETHours(), orionDishes);

    if (orionDishes.length === 0) {
      statusEl.textContent = 'No DSN dishes currently tracking Orion.';
      statusEl.className = 'dsn-no-contact';
      container.innerHTML = '<p class="dsn-note">DSN coverage is not continuous — Orion is not always in contact. ' +
        'Check back later or during scheduled comm windows.</p>';
      return;
    }

    statusEl.textContent = orionDishes.length + ' dish' + (orionDishes.length !== 1 ? 'es' : '') + ' tracking Orion';
    statusEl.className = 'dsn-tracking';

    var html = '';
    for (var k = 0; k < orionDishes.length; k++) {
      var entry = orionDishes[k];
      var d = entry.dish;
      var t = entry.target;

      // Signal direction
      var hasUp = d.upSignals.length > 0;
      var hasDown = d.downSignals.length > 0;
      var direction = hasUp && hasDown ? 'Uplink + Downlink' : hasUp ? 'Uplink' : hasDown ? 'Downlink' : 'Idle';

      // Collect bands
      var bands = [];
      for (var s = 0; s < d.upSignals.length; s++) {
        if (d.upSignals[s].band && bands.indexOf(d.upSignals[s].band) === -1) bands.push(d.upSignals[s].band);
      }
      for (var s2 = 0; s2 < d.downSignals.length; s2++) {
        if (d.downSignals[s2].band && bands.indexOf(d.downSignals[s2].band) === -1) bands.push(d.downSignals[s2].band);
      }

      // Data rate (use downlink, which is typically the interesting one)
      var dataRate = null;
      for (var r = 0; r < d.downSignals.length; r++) {
        var dr = formatDataRate(d.downSignals[r].dataRate);
        if (dr) { dataRate = dr; break; }
      }
      if (!dataRate) {
        for (var r2 = 0; r2 < d.upSignals.length; r2++) {
          var ur = formatDataRate(d.upSignals[r2].dataRate);
          if (ur) { dataRate = ur; break; }
        }
      }

      // Signal strength — strongest active downlink signal power
      var signalPower = null;
      for (var sp = 0; sp < d.downSignals.length; sp++) {
        var pw = parseFloat(d.downSignals[sp].power);
        if (!isNaN(pw) && (signalPower === null || pw > signalPower)) signalPower = pw;
      }
      var signalPowerStr = signalPower !== null ? signalPower.toFixed(1) + ' dBm' : null;

      // RTLT — XML value is already in seconds
      var rtlt = parseFloat(t.rtlt);
      var rtltStr = !isNaN(rtlt) && rtlt > 0 ? (rtlt < 60 ? rtlt.toFixed(2) + ' s' : (rtlt / 60).toFixed(1) + ' min') : null;

      // Ranges
      var upleg = parseFloat(t.uplegRange);
      var uplegStr = !isNaN(upleg) && upleg > 0 ? fmtNum(upleg, 0) + ' km' : null;
      var downleg = parseFloat(t.downlegRange);
      var downlegStr = !isNaN(downleg) && downleg > 0 ? fmtNum(downleg, 0) + ' km' : null;

      // Dish pointing — azimuth and elevation
      var az = parseFloat(d.azimuthAngle);
      var el = parseFloat(d.elevationAngle);
      var pointingStr = (!isNaN(az) && !isNaN(el)) ? 'Az: ' + az.toFixed(1) + '\u00b0 / El: ' + el.toFixed(1) + '\u00b0' : null;

      // Wind speed at station (only show if > 0)
      var wind = parseFloat(d.windSpeed);
      var windStr = (!isNaN(wind) && wind > 0) ? wind.toFixed(1) + ' km/h' : null;

      // Mode flags
      var modeFlags = [];
      if (d.isMSPA) modeFlags.push('MSPA');
      if (d.isArray) modeFlags.push('Arrayed');
      if (d.isDDOR) modeFlags.push('DDOR');

      // Other spacecraft at the same station
      var otherSC = [];
      for (var oi = 0; oi < dishes.length; oi++) {
        var otherDish = dishes[oi];
        if (otherDish.name === d.name) continue; // skip same dish
        if (otherDish.station !== d.station) continue; // different station
        for (var oj = 0; oj < otherDish.targets.length; oj++) {
          var oName = otherDish.targets[oj].name;
          var oFriendly = oName ? friendlySpacecraftName(oName) : '';
          if (oFriendly && !isOrionTarget(otherDish.targets[oj]) && otherSC.indexOf(oFriendly) === -1) {
            otherSC.push(oFriendly);
          }
        }
      }

      html += '<div class="dsn-dish-card dsn-dish-card--orion">';
      html += '<div class="dsn-dish-header">';
      html += '<span class="dsn-dish-name">' + d.name + '</span>';
      html += '<span class="dsn-dish-meta">' + d.station + ' &middot; ' + d.size + '</span>';
      if (modeFlags.length) {
        for (var mf = 0; mf < modeFlags.length; mf++) {
          html += '<span class="dsn-mode-tag">' + modeFlags[mf] + '</span>';
        }
      }
      html += '</div>';
      html += '<div class="dsn-dish-details">';
      html += '<p>Signal: ' + direction + '</p>';
      if (bands.length) {
        html += '<p>Band: ' + bands.join(', ') + '</p>';
      }
      if (dataRate) {
        html += '<p>Data rate: ' + dataRate + '</p>';
      }
      if (signalPowerStr) {
        html += '<p>Signal strength: ' + signalPowerStr + '</p>';
      }
      if (rtltStr) {
        html += '<p>Round-trip light time: ' + rtltStr + '</p>';
      }
      if (uplegStr) {
        html += '<p>Upleg range: ' + uplegStr + '</p>';
      }
      if (downlegStr) {
        html += '<p>Downleg range: ' + downlegStr + '</p>';
      }
      if (pointingStr) {
        html += '<p>Dish pointing: ' + pointingStr + '</p>';
      }
      if (windStr) {
        html += '<p>Wind speed: ' + windStr + '</p>';
      }
      if (otherSC.length) {
        html += '<p>Station also tracking: ' + otherSC.join(', ') + '</p>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function fetchDSN() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);

    fetch(DSN_URL, { mode: 'cors', signal: controller.signal })
      .then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) throw new Error('DSN fetch failed: ' + resp.status);
        return resp.text();
      })
      .then(function (xmlText) {
        var dishes = parseDSNXml(xmlText);
        if (!dishes) {
          console.error('DSN XML parse error');
          return;
        }
        renderDSNOrion(dishes);
      })
      .catch(function (err) {
        console.error('DSN fetch error:', err);
        var statusEl = document.getElementById('dsn-orion-status');
        if (statusEl) {
          statusEl.textContent = 'Unable to reach DSN data feed.';
          statusEl.className = 'dsn-error';
        }
      });
  }

  // ── Space Weather ────────────────────────────────────────────────────

  var SW_URL = INTERNAL_API_BASE + 'space-weather';
  var SW_POLL_MS = 900000; // 15 minutes

  /** Format a UTC ISO string to EET with UTC in parentheses */
  function formatSWTime(isoStr) {
    if (!isoStr) return '\u2014';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    // EET is UTC+2, EEST is UTC+3. Use Intl if available, else manual offset.
    var eetStr;
    try {
      eetStr = d.toLocaleString('en-GB', {
        timeZone: 'Europe/Helsinki',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      // Fallback: manual UTC+2
      var eet = new Date(d.getTime() + 2 * 3600000);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      eetStr = months[eet.getUTCMonth()] + ' ' + eet.getUTCDate() + ', '
        + String(eet.getUTCHours()).padStart(2, '0') + ':' + String(eet.getUTCMinutes()).padStart(2, '0');
    }

    var utcStr = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
    return eetStr + ' EET (' + utcStr + ')';
  }

  /** Human-readable "X hours ago" / "X days ago" from an ISO date string */
  function swTimeAgo(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    var diffMs = Date.now() - d.getTime();
    if (diffMs < 0) diffMs = 0;
    var mins = Math.floor(diffMs / 60000);
    if (mins < 60) return mins + ' min' + (mins !== 1 ? 's' : '') + ' ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 48) return hrs + ' hour' + (hrs !== 1 ? 's' : '') + ' ago';
    var days = Math.floor(hrs / 24);
    return days + ' day' + (days !== 1 ? 's' : '') + ' ago';
  }

  /** Crew-relevant risk description for a flare class letter */
  function flareRiskLine(classType) {
    var letter = getFlareClassLetter(classType);
    if (letter === 'X') return 'X-class, high risk to crew';
    if (letter === 'M') return 'M-class, moderate risk to crew';
    if (letter === 'C') return 'C-class, low risk to crew';
    if (letter === 'B') return 'B-class, minimal risk';
    if (letter === 'A') return 'A-class, minimal risk';
    return 'Unknown class';
  }

  /** Get flare class letter (C/M/X) from classType string like "M1.2" */
  function getFlareClassLetter(classType) {
    if (!classType) return '';
    var ch = classType.charAt(0).toUpperCase();
    if (ch === 'X' || ch === 'M' || ch === 'C' || ch === 'B' || ch === 'A') return ch;
    return '';
  }

  /** Get CSS modifier for flare class */
  function getFlareClassModifier(classType) {
    var letter = getFlareClassLetter(classType);
    if (letter === 'X') return 'x';
    if (letter === 'M') return 'm';
    return 'c'; // C, B, A all use green
  }

  /** Human-readable flare class description */
  function describeFlareClass(classType) {
    var letter = getFlareClassLetter(classType);
    if (letter === 'X') return 'Extreme';
    if (letter === 'M') return 'Moderate';
    if (letter === 'C') return 'Common / minor';
    if (letter === 'B') return 'Minor (below C)';
    if (letter === 'A') return 'Minimal';
    return 'Unknown';
  }

  function renderSpaceWeatherStatus(summary) {
    var dotEl = document.getElementById('sw-status-dot');
    var textEl = document.getElementById('sw-status-text');
    var detailEl = document.getElementById('sw-status-detail');
    var cardEl = document.getElementById('sw-status-card');
    var summaryEl = document.getElementById('sw-compact-summary');
    if (!dotEl || !textEl || !cardEl) return;

    // Status card border color via modifier class
    cardEl.className = 'dash-card';
    if (summary.status === 'severe') {
      dotEl.className = 'comms-dot comms-dot--red';
      cardEl.classList.add('dash-card--severe');
      textEl.textContent = 'Severe';
      if (detailEl) {
        detailEl.textContent = 'Highest flare: ' + (summary.highestFlare || 'N/A')
          + '. Active SEP events: ' + summary.sepCount + '. Elevated radiation risk for crew outside Earth\u2019s magnetosphere.';
      }
    } else if (summary.status === 'elevated') {
      dotEl.className = 'comms-dot comms-dot--yellow';
      cardEl.classList.add('dash-card--elevated');
      textEl.textContent = 'Elevated';
      if (detailEl) {
        var parts = [];
        if (summary.highestFlare) parts.push('Highest flare: ' + summary.highestFlare);
        if (summary.sepCount > 0) parts.push('SEP events: ' + summary.sepCount);
        detailEl.textContent = parts.join('. ') + (parts.length ? '.' : '');
      }
    } else {
      dotEl.className = 'comms-dot comms-dot--green';
      cardEl.classList.add('dash-card--nominal');
      textEl.textContent = 'Nominal';
      if (detailEl) {
        detailEl.textContent = 'No significant threats to crew safety.';
      }
    }

    // Build compact one-line summary
    if (summaryEl) {
      var seg = [];
      var fc = summary.flareCount || 0;
      if (fc > 0) {
        var flareDesc = fc + ' flare' + (fc !== 1 ? 's' : '');
        if (summary.highestFlare) flareDesc += ' (' + summary.highestFlare.charAt(0) + '-class highest)';
        seg.push(flareDesc);
      }
      var cc = summary.cmeCount || 0;
      if (cc > 0) seg.push(cc + ' CME' + (cc !== 1 ? 's' : ''));
      var sc = summary.stormCount || 0;
      if (sc > 0) seg.push(sc + ' storm' + (sc !== 1 ? 's' : ''));
      var sep = summary.sepCount || 0;
      if (sep > 0) seg.push(sep + ' SEP event' + (sep !== 1 ? 's' : ''));
      summaryEl.textContent = seg.length ? seg.join(' \u00B7 ') : 'Quiet conditions';
    }

    // Update count badges on collapsible sections
    updateSWBadge('sw-flares-badge', summary.flareCount || 0);
    updateSWBadge('sw-cme-badge', summary.cmeCount || 0);
    updateSWBadge('sw-storms-badge', summary.stormCount || 0);
    updateSWBadge('sw-sep-badge', summary.sepCount || 0);

    // ── Solar Flares: last flare class + time ago ──
    var flarePri = document.getElementById('sw-flare-primary');
    var flareSec = document.getElementById('sw-flare-secondary');
    if (flarePri) {
      var lf = summary.latestFlare;
      if (lf && lf.classType) {
        var ago = swTimeAgo(lf.peakTime);
        flarePri.textContent = lf.classType + (ago ? ' \u2014 ' + ago : '');
        flareSec.textContent = flareRiskLine(lf.classType);
      } else {
        flarePri.textContent = 'None';
        flareSec.textContent = 'No flares in last 3 days';
      }
    }

    // ── Geomagnetic Storms: current state ──
    var stormPri = document.getElementById('sw-storm-primary');
    var stormSec = document.getElementById('sw-storm-secondary');
    if (stormPri) {
      var sc2 = summary.stormCount || 0;
      var kp = summary.highestKp || 0;
      if (sc2 > 0 && kp >= 5) {
        stormPri.textContent = 'Kp ' + kp + ' \u2014 active storm';
        stormSec.textContent = kp >= 7 ? 'May disrupt DSN communications' : 'Monitor DSN communications';
      } else if (sc2 > 0) {
        stormPri.textContent = 'Kp ' + kp + ' \u2014 minor activity';
        stormSec.textContent = 'No impact on DSN communications';
      } else {
        stormPri.textContent = 'Quiet';
        stormSec.textContent = 'No impact on DSN communications';
      }
    }

    // ── Radiation: Normal / Elevated ──
    var radPri = document.getElementById('sw-radiation-primary');
    var radSec = document.getElementById('sw-radiation-secondary');
    if (radPri) {
      var sep2 = summary.sepCount || 0;
      if (sep2 > 0) {
        radPri.textContent = 'Elevated';
        radSec.textContent = 'Crew is beyond Earth magnetosphere';
      } else {
        radPri.textContent = 'Normal';
        radSec.textContent = 'Crew is beyond Earth magnetosphere';
      }
    }

    // ── CMEs: count + direction ──
    var cmePri = document.getElementById('sw-cme-primary');
    var cmeSec = document.getElementById('sw-cme-secondary');
    if (cmePri) {
      var cc2 = summary.cmeCount || 0;
      var edArr = summary.earthDirectedCMEs || [];
      var edCount = Array.isArray(edArr) ? edArr.length : 0;
      if (cc2 > 0) {
        cmePri.textContent = cc2 + ' detected today';
        cmeSec.textContent = edCount > 0
          ? edCount + ' Earth-directed \u2014 monitoring threat'
          : 'No threat to mission';
      } else {
        cmePri.textContent = 'None detected';
        cmeSec.textContent = 'No threat to mission';
      }
    }
  }

  function updateSWBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = count > 0 ? '(' + count + ')' : '(0)';
  }

  function renderSolarFlares(flares) {
    var container = document.getElementById('sw-flares-list');
    if (!container) return;

    if (!flares || flares.length === 0) {
      container.innerHTML = '<p class="sw-none">No solar flares detected in the last 3 days.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < flares.length; i++) {
      var f = flares[i];
      var cls = f.classType || 'Unknown';
      var mod = getFlareClassModifier(cls);
      var desc = describeFlareClass(cls);

      html += '<div class="sw-event-card sw-event-card--' + mod + '" role="article" aria-label="Solar flare ' + cls + '">';
      html += '<div class="sw-event-header">';
      html += '<span class="sw-event-class">' + cls + '</span>';
      html += '<span class="sw-class-tag sw-class-tag--' + mod + '">' + desc + '</span>';
      html += '</div>';
      html += '<dl class="sw-event-details">';

      if (f.beginTime) {
        html += '<dt>Begin</dt><dd><time datetime="' + f.beginTime + '">' + formatSWTime(f.beginTime) + '</time></dd>';
      }
      if (f.peakTime) {
        html += '<dt>Peak</dt><dd><time datetime="' + f.peakTime + '">' + formatSWTime(f.peakTime) + '</time></dd>';
      }
      if (f.endTime) {
        html += '<dt>End</dt><dd><time datetime="' + f.endTime + '">' + formatSWTime(f.endTime) + '</time></dd>';
      }
      if (f.sourceLocation) {
        html += '<dt>Source location</dt><dd>' + f.sourceLocation + ' (heliographic coordinates)</dd>';
      }
      if (f.activeRegionNum) {
        html += '<dt>Active region</dt><dd>AR ' + f.activeRegionNum + '</dd>';
      }

      html += '</dl></div>';
    }

    container.innerHTML = html;
  }

  function renderCMEs(cmes) {
    var container = document.getElementById('sw-cme-list');
    if (!container) return;

    if (!cmes || cmes.length === 0) {
      container.innerHTML = '<p class="sw-none">No coronal mass ejections detected in the last 3 days.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < cmes.length; i++) {
      var c = cmes[i];
      html += '<div class="sw-event-card sw-event-card--cme" role="article" aria-label="Coronal mass ejection' + (c.startTime ? ', ' + formatSWTime(c.startTime) : '') + '">';
      html += '<div class="sw-event-header">';
      html += '<span class="sw-event-class">CME</span>';
      if (c.startTime) {
        html += '<span class="sw-event-time"><time datetime="' + c.startTime + '">' + formatSWTime(c.startTime) + '</time></span>';
      }
      html += '</div>';
      html += '<dl class="sw-event-details">';

      if (c.activityID) {
        html += '<dt>Activity ID</dt><dd>' + c.activityID + '</dd>';
      }

      // Extract speed from CME analysis if available
      if (c.cmeAnalyses && c.cmeAnalyses.length > 0) {
        var analysis = c.cmeAnalyses[0];
        if (analysis.speed) {
          html += '<dt>Speed</dt><dd>' + fmtNum(analysis.speed) + ' km/s</dd>';
        }
        if (analysis.type) {
          html += '<dt>Type</dt><dd>' + analysis.type + '</dd>';
        }
        if (analysis.halfAngle) {
          html += '<dt>Half-angle</dt><dd>' + analysis.halfAngle + '&deg;</dd>';
        }
      }

      if (c.linkedEvents && c.linkedEvents.length > 0) {
        var linked = [];
        for (var j = 0; j < c.linkedEvents.length; j++) {
          var le = c.linkedEvents[j];
          linked.push(le.activityID || 'Unknown');
        }
        html += '<dt>Linked events</dt><dd>' + linked.join(', ') + '</dd>';
      }

      if (c.note) {
        html += '<dt>Note</dt><dd style="font-family:var(--font-sans);white-space:normal">' + c.note + '</dd>';
      }

      html += '</dl></div>';
    }

    container.innerHTML = html;
  }

  function renderStorms(storms) {
    var container = document.getElementById('sw-storms-list');
    if (!container) return;

    if (!storms || storms.length === 0) {
      container.innerHTML = '<p class="sw-none">No geomagnetic storms detected in the last 3 days.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < storms.length; i++) {
      var s = storms[i];
      html += '<div class="sw-event-card sw-event-card--storm" role="article" aria-label="Geomagnetic storm' + (s.startTime ? ', ' + formatSWTime(s.startTime) : '') + '">';
      html += '<div class="sw-event-header">';
      html += '<span class="sw-event-class">Geomagnetic Storm</span>';
      if (s.startTime) {
        html += '<span class="sw-event-time"><time datetime="' + s.startTime + '">' + formatSWTime(s.startTime) + '</time></span>';
      }
      html += '</div>';
      html += '<dl class="sw-event-details">';

      if (s.allKpIndex && s.allKpIndex.length > 0) {
        for (var k = 0; k < s.allKpIndex.length; k++) {
          var kp = s.allKpIndex[k];
          html += '<dt>Kp index (' + kp.source + ')</dt><dd>' + kp.kpIndex + '</dd>';
        }
      }

      if (s.linkedEvents && s.linkedEvents.length > 0) {
        var linked = [];
        for (var j = 0; j < s.linkedEvents.length; j++) {
          linked.push(s.linkedEvents[j].activityID || 'Unknown');
        }
        html += '<dt>Linked events</dt><dd>' + linked.join(', ') + '</dd>';
      }

      html += '</dl></div>';
    }

    container.innerHTML = html;
  }

  function renderSEP(sepEvents) {
    var container = document.getElementById('sw-sep-list');
    if (!container) return;

    if (!sepEvents || sepEvents.length === 0) {
      container.innerHTML = '<p class="sw-none">No solar energetic particle events detected in the last 3 days. Low radiation risk for crew.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < sepEvents.length; i++) {
      var s = sepEvents[i];
      html += '<div class="sw-event-card sw-event-card--sep" role="article" aria-label="Solar energetic particle event' + (s.eventTime ? ', ' + formatSWTime(s.eventTime) : '') + '">';
      html += '<div class="sw-event-header">';
      html += '<span class="sw-event-class">SEP Event</span>';
      if (s.eventTime) {
        html += '<span class="sw-event-time"><time datetime="' + s.eventTime + '">' + formatSWTime(s.eventTime) + '</time></span>';
      }
      html += '</div>';
      html += '<dl class="sw-event-details">';

      if (s.instruments && s.instruments.length > 0) {
        var instr = [];
        for (var j = 0; j < s.instruments.length; j++) {
          instr.push(s.instruments[j].displayName || s.instruments[j].id || 'Unknown');
        }
        html += '<dt>Instruments</dt><dd style="font-family:var(--font-sans)">' + instr.join(', ') + '</dd>';
      }

      if (s.linkedEvents && s.linkedEvents.length > 0) {
        var linked = [];
        for (var k = 0; k < s.linkedEvents.length; k++) {
          linked.push(s.linkedEvents[k].activityID || 'Unknown');
        }
        html += '<dt>Linked events</dt><dd>' + linked.join(', ') + '</dd>';
      }

      html += '</dl></div>';
    }

    container.innerHTML = html;
  }

  function renderSpaceWeatherTimestamp(queriedAt) {
    var el = document.getElementById('sw-timestamp');
    if (!el) return;
    if (!queriedAt) {
      el.textContent = '';
      return;
    }
    var d = new Date(queriedAt);
    if (isNaN(d.getTime())) { el.textContent = ''; return; }
    var ageSec = Math.round((Date.now() - d.getTime()) / 1000);
    var ageStr;
    if (ageSec < 10) ageStr = 'just now';
    else if (ageSec < 60) ageStr = ageSec + ' seconds ago';
    else if (ageSec < 3600) ageStr = Math.round(ageSec / 60) + ' minutes ago';
    else ageStr = Math.round(ageSec / 3600) + ' hours ago';
    el.textContent = ' Last update: ' + d.toLocaleTimeString() + ' (' + ageStr + ').';
  }

  function fetchSpaceWeather() {
    var statusText = document.getElementById('sw-status-text');
    if (!document.getElementById('space-weather')) return;

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);

    fetch(SW_URL, { signal: controller.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('Space weather HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.summary) renderSpaceWeatherStatus(data.summary);
        renderSolarFlares(data.flares);
        renderCMEs(data.cme);
        renderStorms(data.storms);
        renderSEP(data.sep);
        renderSpaceWeatherTimestamp(data.queriedAt);
      })
      .catch(function (err) {
        clearTimeout(timer);
        console.error('Space weather fetch failed:', err);
        if (statusText) {
          statusText.textContent = 'Unable to load space weather data.';
        }
      });
  }

  /** Refresh human-readable countdown text on all timeline steps */
  function refreshTimelineCountdowns() {
    if (typeof TIMELINE === 'undefined') return;
    for (var i = 0; i < TIMELINE.length; i++) {
      var evt = TIMELINE[i];
      var timeEl = document.querySelector('#step-' + evt.id + ' .timeline-step__countdown');
      if (timeEl) {
        timeEl.textContent = formatTimeUntil(evt.utc);
      }
    }
    // Also update the button-level countdowns
    var btnCountdowns = document.querySelectorAll('.timeline-step__time-countdown');
    for (var j = 0; j < btnCountdowns.length; j++) {
      var utc = btnCountdowns[j].getAttribute('data-utc');
      if (utc) {
        btnCountdowns[j].textContent = formatTimeUntil(utc);
      }
    }
  }

  // ── Sparkline rendering ────────────────────────────────────────────────

  function pushSparklineData(t) {
    if (!t) return;
    var map = {
      speed:     t.speedKmh,
      distEarth: t.distEarthKm,
      distMoon:  t.distMoonKm,
      altitude:  t.altitudeKm,
      rangeRate: t.rangeRateKms != null ? t.rangeRateKms : null
    };
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = map[k];
      if (v != null) {
        sparklineHistory[k].push(v);
        if (sparklineHistory[k].length > SPARKLINE_MAX_POINTS) {
          sparklineHistory[k].shift();
        }
      }
    }
    sparklineTimestamps.push(Date.now());
    if (sparklineTimestamps.length > SPARKLINE_MAX_POINTS) {
      sparklineTimestamps.shift();
    }
  }

  function renderSparkline(containerId, dataKey) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var data = sparklineHistory[dataKey];
    var svg = el.querySelector('.sparkline-svg');
    var srSpan = el.querySelector('.sparkline-trend');
    if (!svg || data.length < 2) return;

    var W = svg.getBoundingClientRect().width || svg.clientWidth || 200;
    var H = 30;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var min = data[0], max = data[0];
    for (var i = 1; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    var range = max - min || 1;
    var padding = 2;

    var points = [];
    for (var j = 0; j < data.length; j++) {
      var x = (j / (data.length - 1)) * W;
      var y = padding + ((max - data[j]) / range) * (H - padding * 2);
      points.push(x.toFixed(1) + ',' + y.toFixed(1));
    }

    var polyline = svg.querySelector('polyline');
    if (!polyline) {
      polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      svg.appendChild(polyline);
    }
    polyline.setAttribute('points', points.join(' '));

    // Update sr-only trend text
    if (srSpan) {
      var first = data[0];
      var last = data[data.length - 1];
      var direction = last > first ? 'increasing' : last < first ? 'decreasing' : 'stable';
      var spanLabel = 'few minutes';
      if (sparklineTimestamps.length >= 2) {
        var elapsedMs = sparklineTimestamps[sparklineTimestamps.length - 1] - sparklineTimestamps[0];
        var elapsedMin = Math.round(elapsedMs / 60000);
        if (elapsedMin < 2) spanLabel = 'minute';
        else if (elapsedMin < 60) spanLabel = elapsedMin + ' minutes';
        else {
          var hrs = Math.floor(elapsedMin / 60);
          var mins = elapsedMin % 60;
          if (mins === 0) spanLabel = hrs + ' hour' + (hrs !== 1 ? 's' : '');
          else spanLabel = hrs + ' hour' + (hrs !== 1 ? 's' : '') + ' ' + mins + ' minutes';
        }
      }
      var dispFirst = fmtNum(Math.abs(first), 2);
      var dispLast = fmtNum(Math.abs(last), 2);
      srSpan.textContent = direction + ' over the last ' + spanLabel + ', from ' + dispFirst + ' to ' + dispLast;
    }
  }

  var sparklineCardMap = [
    { card: 'val-speed',      key: 'speed' },
    { card: 'val-dist-earth', key: 'distEarth' },
    { card: 'val-dist-moon',  key: 'distMoon' },
    { card: 'val-altitude',   key: 'altitude' },
    { card: 'val-range-rate', key: 'rangeRate' }
  ];

  function updateAllSparklines() {
    for (var i = 0; i < sparklineCardMap.length; i++) {
      renderSparkline(sparklineCardMap[i].card, sparklineCardMap[i].key);
    }
  }

  function injectSparklineSVGs() {
    for (var i = 0; i < sparklineCardMap.length; i++) {
      var el = document.getElementById(sparklineCardMap[i].card);
      if (!el || el.querySelector('.sparkline-svg')) continue;
      var dd = document.createElement('dd');
      dd.className = 'dash-sparkline';
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'sparkline-svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('preserveAspectRatio', 'none');
      dd.appendChild(svg);
      var sr = document.createElement('span');
      sr.className = 'sr-only sparkline-trend';
      dd.appendChild(sr);
      el.appendChild(dd);
    }
  }

  // ── Progress bar on Moon distance card ────────────────────────────────

  function injectProgressBar() {
    var moonCard = document.getElementById('val-dist-moon');
    if (!moonCard || moonCard.querySelector('.moon-progress')) return;
    var dd = document.createElement('dd');
    dd.className = 'dash-progress';
    var bar = document.createElement('div');
    bar.className = 'moon-progress';
    bar.setAttribute('role', 'img');
    bar.innerHTML = '<div class="moon-progress__fill"></div><span class="sr-only moon-progress__sr"></span>';
    dd.appendChild(bar);
    moonCard.appendChild(dd);
  }

  function updateProgressBar(t) {
    if (!t) return;
    var fill = document.querySelector('.moon-progress__fill');
    var sr = document.querySelector('.moon-progress__sr');
    if (!fill) return;
    var pct = Math.min(100, Math.max(0, (t.distEarthKm / EARTH_MOON_AVG_KM) * 100));
    fill.style.width = pct.toFixed(1) + '%';
    if (sr) sr.textContent = Math.round(pct) + '% of the way to the Moon';
  }

  // ── Trajectory SVG visualization ──────────────────────────────────────

  function injectTrajectorySVG() {
    var metBlock = document.querySelector('.hero__met');
    if (!metBlock || document.getElementById('trajectory-viz')) return;
    var container = document.createElement('div');
    container.id = 'trajectory-viz';
    container.className = 'trajectory-viz';
    container.innerHTML =
      '<svg class="trajectory-svg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid meet" role="img">' +
        '<desc id="traj-desc">Orion is in transit between Earth and the Moon.</desc>' +
        '<!-- Earth -->' +
        '<circle cx="80" cy="100" r="22" class="traj-earth"/>' +
        '<text x="80" y="140" class="traj-label" text-anchor="middle">Earth</text>' +
        '<!-- Moon -->' +
        '<circle cx="520" cy="100" r="10" class="traj-moon"/>' +
        '<text x="520" y="128" class="traj-label" text-anchor="middle">Moon</text>' +
        '<!-- Trajectory path (figure-8 free-return) -->' +
        '<path class="traj-path" d="M102,100 C200,30 350,20 520,90 C520,90 530,105 520,110 C350,180 200,170 102,100" fill="none"/>' +
        '<!-- Orion dot -->' +
        '<circle cx="102" cy="100" r="5" class="traj-orion" id="traj-orion-dot"/>' +
        '<text x="102" y="85" class="traj-orion-label" id="traj-orion-label" text-anchor="middle">Orion</text>' +
      '</svg>';
    metBlock.parentNode.insertBefore(container, metBlock);
  }

  function updateTrajectoryViz(t) {
    if (!t) return;
    var dot = document.getElementById('traj-orion-dot');
    var label = document.getElementById('traj-orion-label');
    var desc = document.querySelector('#trajectory-viz .trajectory-svg desc');
    if (!dot) return;

    // Compute progress along the path: 0 = Earth, 1 = Moon (at closest approach)
    var totalDist = t.distEarthKm + t.distMoonKm;
    var progress = totalDist > 0 ? t.distEarthKm / totalDist : 0;
    progress = Math.max(0, Math.min(1, progress));

    // Get the trajectory path element and compute point along it
    var pathEl = document.querySelector('.traj-path');
    if (pathEl && pathEl.getTotalLength) {
      var len = pathEl.getTotalLength();
      // Map progress to the outbound half of the path (0 to 0.5 of total path)
      // If returning (distEarthKm decreasing), use the return half (0.5 to 1.0)
      var pathFraction = progress * 0.5; // outbound: 0..0.5
      var pt = pathEl.getPointAtLength(pathFraction * len);
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      if (label) {
        label.setAttribute('x', pt.x.toFixed(1));
        label.setAttribute('y', (pt.y - 12).toFixed(1));
      }
    }

    // Update alt/desc text
    var pctMoon = Math.round((t.distEarthKm / EARTH_MOON_AVG_KM) * 100);
    var trajText = 'Orion is ' + fmtNum(t.distEarthKm) + ' km from Earth and ' + fmtNum(t.distMoonKm) + ' km from the Moon, ' + pctMoon + '% of the way to lunar flyby.';
    if (desc) desc.textContent = trajText;

  }

  // ── Init ───────────────────────────────────────────────────────────────

  function init() {
    // Grab DOM references
    dom = {
      missionPhase: document.getElementById('mission-phase'),
      heroStatus:   document.getElementById('hero-status'),
      metValue:     document.getElementById('val-met'),
      metLabel:     document.getElementById('met-label'),
      dataStatus:   document.getElementById('data-status')
    };

    // Setup navigation
    try { setupSkipNav(); } catch (e) { console.error('setupSkipNav failed:', e); }
    // setupMETAnnounce(); // disabled
    try { setupNavToggle(); } catch (e) { console.error('setupNavToggle failed:', e); }

    // Build timeline from fallback events first (immediate render, no waiting for fetch)
    try { buildTimeline(FALLBACK_EVENTS); } catch (e) { console.error('buildTimeline failed:', e); }

    // Immediately show correct pre-launch state (don't wait for async fetch)
    try { updateUI(); } catch (e) { console.error('Initial updateUI failed:', e); }

    // Render sections that exist on the current page
    try { renderTimeline(); } catch (e) { console.error('Timeline render failed:', e); }
    try { renderCrew(); } catch (e) { console.error('Crew render failed:', e); }
    try { renderSpacecraft(); } catch (e) { console.error('Spacecraft render failed:', e); }
    try { startCrewScheduleRefresh(); } catch (e) { console.error('Crew schedule render failed:', e); }
    // Show loading state, then fetch live RSS news (falls back to static data)
    try {
      var newsContainer = document.getElementById('news-list');
      if (newsContainer) {
        newsContainer.innerHTML = '<p class="news-item__summary">Loading news\u2026</p>';
      }
      fetchNews();
      setInterval(fetchNews, NEWS_POLL_MS);
    } catch (e) { console.error('News fetch setup failed:', e); }

    // Space weather
    try {
      fetchSpaceWeather();
      setInterval(fetchSpaceWeather, SW_POLL_MS);
    } catch (e) { console.error('Space weather fetch setup failed:', e); }

    // Sonification radar
    try {
      if (window.artemisAudio && typeof window.artemisAudio.init === 'function') {
        window.artemisAudio.init();
      }
    } catch (e) { console.error('Sonification init failed:', e); }

    // M2: Escape key stops audio radar
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && window.artemisAudio && window.artemisAudio.isRunning && window.artemisAudio.isRunning()) {
        window.artemisAudio.stop();
        var audioBtn = document.getElementById('audio-enable-btn');
        if (audioBtn) {
          audioBtn.setAttribute('aria-pressed', 'false');
          audioBtn.textContent = 'Enable Audio';
        }
        var statusEl = document.getElementById('preview-status');
        if (statusEl) statusEl.textContent = 'Audio stopped';
      }
    });

    // Visual enhancements: sparklines, trajectory, progress bar
    try { injectSparklineSVGs(); } catch (e) { console.error('Sparkline injection failed:', e); }
    try { injectProgressBar(); } catch (e) { console.error('Progress bar injection failed:', e); }
    try { injectTrajectorySVG(); } catch (e) { console.error('Trajectory SVG injection failed:', e); }

    // Hide schedule-dependent content until fetch completes (avoid flash of stale data)
    var phaseEl = document.getElementById('mission-phase');
    var timelineSection = document.getElementById('timeline');
    var crewNowEl = document.getElementById('crew-activity-now');
    var crewNextEl = document.getElementById('crew-activity-next');
    if (phaseEl) phaseEl.textContent = 'Loading schedule\u2026';
    if (crewNowEl) crewNowEl.textContent = '';
    if (crewNextEl) crewNextEl.textContent = '';
    if (timelineSection) { timelineSection.style.opacity = '0.3'; timelineSection.setAttribute('aria-busy', 'true'); }

    // Fetch live schedule from GitHub
    fetchRemoteSchedule().finally(function() {
      if (timelineSection) { timelineSection.style.opacity = '1'; timelineSection.removeAttribute('aria-busy'); }
    });

    // Pre-fill sparklines with 2h of historical data from Horizons
    fetch(INTERNAL_API_BASE + 'horizons?history=2h')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.history) {
          var now = Date.now();
          var histLen = data.history.length;
          var stepMs = 300000; // 5 minutes between Horizons data points
          var startTs = now - (histLen - 1) * stepMs;
          for (var i = 0; i < histLen; i++) {
            var h = data.history[i];
            sparklineHistory.speed.push(h.speedKmh);
            sparklineHistory.distEarth.push(h.distEarthKm);
            sparklineHistory.distMoon.push(h.distMoonKm);
            sparklineHistory.altitude.push(h.altitudeKm);
            sparklineHistory.rangeRate.push(h.rangeRateKms);
            sparklineTimestamps.push(startTs + i * stepMs);
          }
          updateAllSparklines();
        }
      }).catch(function() {});

    // Initial data fetch (async — uses .catch() for error handling)
    fetchTelemetry();

    // Auto-refresh telemetry
    refreshTimer = setInterval(function () {
      fetchTelemetry();
    }, REFRESH_INTERVAL_MS);

    // MET / countdown clock ticks every second
    setInterval(tickMET, 1000);
    setInterval(refreshTimelineCountdowns, 60000);

    // DSN data fetch and polling — community API (10s) as primary, XML (60s) as fallback
    try { fetchCommunityDSN(); } catch (e) { console.error('Community DSN initial fetch failed:', e); }
    setInterval(fetchCommunityDSN, COMMUNITY_DSN_POLL_MS);
    try { fetchDSN(); } catch (e) { console.error('DSN initial fetch failed:', e); }
    setInterval(fetchDSN, DSN_REFRESH_MS);

    // Community orbit API (5 min poll) — supplements Horizons with cleaner data
    try { fetchCommunityOrbit(); } catch (e) { console.error('Community orbit initial fetch failed:', e); }
    setInterval(fetchCommunityOrbit, COMMUNITY_ORBIT_POLL_MS);

    // AROW SSE stream for live spacecraft attitude telemetry
    try { startArowSSE(); } catch (e) { console.error('AROW SSE failed:', e); }

    // Periodic SR-friendly announcement (every 30s, not every second)
    announceMETForSR();
    setInterval(announceMETForSR, SR_ANNOUNCE_INTERVAL_MS);

    // ── Mission event notifications ──────────────────────────────────────
    initNotifications();

    // Fix #14: Resize handler for sparklines (orientation changes)
    var sparklineResizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(sparklineResizeTimer);
      sparklineResizeTimer = setTimeout(updateAllSparklines, 250);
    });

    // Fix #15: Back-to-top button show/hide
    var backToTop = document.getElementById('back-to-top');
    if (backToTop) {
      window.addEventListener('scroll', function() {
        if (window.scrollY > window.innerHeight) {
          backToTop.classList.add('visible');
        } else {
          backToTop.classList.remove('visible');
        }
      }, { passive: true });
    }

    // Fix #17: Collapse space weather detail cards on mobile by default
    var swCollapse = document.getElementById('sw-mobile-collapse');
    if (swCollapse) {
      if (window.innerWidth <= 768) {
        swCollapse.removeAttribute('open');
      }
      window.addEventListener('resize', function() {
        // Re-open on desktop, keep user choice on mobile
        if (window.innerWidth > 768 && !swCollapse.hasAttribute('open')) {
          swCollapse.setAttribute('open', '');
        }
      });
    }
  }

  // ── Notification service worker registration & button logic ────────────
  function initNotifications() {
    var btn = document.getElementById('notify-toggle-btn');
    if (!btn || !('serviceWorker' in navigator) || !('Notification' in window)) {
      if (btn) btn.style.display = 'none';
      return;
    }

    var STORAGE_KEY = 'artemis-notify-pref';

    function updateButton() {
      var perm = Notification.permission;
      if (perm === 'denied') {
        btn.textContent = 'Notifications Blocked';
        btn.classList.add('btn--notify-blocked');
        btn.classList.remove('btn--notify-on');
        btn.disabled = true;
        btn.setAttribute('aria-pressed', 'false');
      } else if (perm === 'granted' && localStorage.getItem(STORAGE_KEY) === 'on') {
        btn.textContent = 'Notifications On';
        btn.classList.add('btn--notify-on');
        btn.classList.remove('btn--notify-blocked');
        btn.disabled = false;
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.textContent = 'Enable Notifications';
        btn.classList.remove('btn--notify-on', 'btn--notify-blocked');
        btn.disabled = false;
        btn.setAttribute('aria-pressed', 'false');
      }
    }

    function registerSW() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function (reg) {
        // Tell the SW to start its timer
        if (reg.active) {
          reg.active.postMessage('start-notifications');
        }
        navigator.serviceWorker.ready.then(function (readyReg) {
          if (readyReg.active) {
            readyReg.active.postMessage('start-notifications');
          }
        });
      }).catch(function (err) {
        console.error('SW registration failed:', err);
      });
    }

    btn.addEventListener('click', function () {
      var perm = Notification.permission;

      if (perm === 'granted' && localStorage.getItem(STORAGE_KEY) === 'on') {
        // Turn off — unregister the service worker
        localStorage.setItem(STORAGE_KEY, 'off');
        navigator.serviceWorker.getRegistration('/sw.js').then(function (reg) {
          if (reg) reg.unregister();
        });
        updateButton();
        return;
      }

      if (perm === 'default') {
        Notification.requestPermission().then(function (result) {
          if (result === 'granted') {
            localStorage.setItem(STORAGE_KEY, 'on');
            registerSW();
          }
          updateButton();
        });
        return;
      }

      if (perm === 'granted') {
        localStorage.setItem(STORAGE_KEY, 'on');
        registerSW();
        updateButton();
      }
    });

    // On load: if previously opted in and permission is still granted, register SW
    updateButton();
    if (Notification.permission === 'granted' && localStorage.getItem(STORAGE_KEY) === 'on') {
      registerSW();
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
