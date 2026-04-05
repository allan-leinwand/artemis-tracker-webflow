import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// For Webflow Cloud subpaths, set e.g. base: '/your-mount-path', assetsPrefix in build — see Webflow docs.
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
