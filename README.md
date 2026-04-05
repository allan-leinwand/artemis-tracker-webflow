# Artemis II Mission Tracker — Webflow Cloud Edition

A real-time dashboard for NASA's Artemis II crewed mission around the Moon. Live telemetry, mission timeline, crew schedule, space weather, DSN status, and audio sonification radar.

## Original Project

Built by **Jakob Rosin** ([jakob.rsn@gmail.com](mailto:jakob.rsn@gmail.com) · [Mastodon](https://universeodon.com/@jakobrosin)). Data from NASA AROW. Not affiliated with NASA.

## Webflow Cloud Fork

This fork adapts the original Netlify-hosted tracker to run on **Webflow Cloud** with Cloudflare Workers. The following changes were made:

1. **Platform migration** — Replaced Netlify functions and references with Webflow Cloud hosting and Cloudflare Workers for the JPL Horizons API proxy.
2. **Header flicker fix** — Prevented the data-status indicator from flickering by only updating DOM elements when values actually change, avoiding CSS animation restarts.
3. **Header bleed-through fix** — Made the sticky header background fully opaque so page content no longer shows through during scroll.
4. **Consistent attribution styling** — Standardized all section attribution lines (AROW, DONKI, DSN) to use the same font style, alignment, spacing, and linked source names.
5. **Consistent timestamps** — Unified all "Last update" timestamps across the site to use the same format: local time with relative age in parentheses.
6. **Hero layout improvements** — Moved the trajectory visualization into the hero section above the MET timer, removed the duplicate day/phase label, and placed "View full schedule" inline with the "Next event" text.
7. **Spacing and typography standardization** — Normalized card title sizes (1.1rem), card description sizes (0.9rem), grid gaps, section padding, and h2 margins across all pages for visual consistency.
8. **Lighthouse performance fixes** — Added `fetchpriority="high"` to the hero image, set `min-height` on dashboard cards to reduce Cumulative Layout Shift (CLS), and removed render-blocking font issues.
9. **Accessibility fixes** — Wrapped dynamically injected sparklines and progress bars in proper `<dd>` elements so definition lists pass WCAG validation.
10. **Console cleanup** — Removed informational `console.log` messages, keeping only `console.error` for actual failures.

## Data Sources

- [NASA AROW Community API](https://artemis.cdnspace.ca) — orbital telemetry
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) — ephemeris data
- [NASA DONKI](https://ccmc.gsfc.nasa.gov/donki/) — space weather
- [NASA DSN Now](https://eyes.nasa.gov/dsn/dsn.html) — Deep Space Network status

## License

See the original project for license terms.
