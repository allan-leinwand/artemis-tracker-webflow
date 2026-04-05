import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

const mountPath = "/artemis/";

export default defineConfig({
  base: mountPath,
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
