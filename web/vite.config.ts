import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The hero is set in Outfit and Inter; a font that arrives after first paint
 * reflows it. Preloading the latin subsets removes that shift.
 */
function preloadFonts() {
  return {
    name: "preload-latin-fonts",
    enforce: "post" as const,
    transformIndexHtml: {
      order: "post" as const,
      handler(html: string, ctx: { bundle?: Record<string, unknown> }) {
        const files = Object.keys(ctx.bundle ?? {});
        const tags = files
          .filter((file) => /(outfit|inter)-latin-wght-normal-[^/]+\.woff2$/.test(file))
          .map(
            (file) =>
              `<link rel="preload" href="/${file}" as="font" type="font/woff2" crossorigin>`,
          )
          .join("");
        return tags ? html.replace("</head>", `${tags}</head>`) : html;
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadFonts()],
  server: {
    host: "127.0.0.1",
    port: 5183,
  },
  resolve: {
    alias: {
      /**
       * `safe-buffer` calls `require("buffer")`, which a browser build leaves
       * external: at runtime the require answers undefined and the first
       * `Buffer.from` in the wallet code throws. Pointing it at the npm
       * polyfill keeps that path working in the bundle.
       */
      buffer: "buffer/",
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * The wallet modules are loaded on demand, and each of them needs the
         * same near-api primitives. Left to Rollup, those primitives land in the
         * entry chunk, so every wallet chunk imports the entry chunk that
         * imported it: a cycle that leaves the shared exports undefined and
         * makes Meteor fail with "Cannot read properties of undefined".
         * Pinning them to one chunk keeps the wallets leaf modules.
         */
        manualChunks(id: string) {
          if (
            id.includes("node_modules/@near-js/") ||
            id.includes("node_modules/near-api-js/") ||
            id.includes("node_modules/@noble/") ||
            id.includes("node_modules/borsh/") ||
            id.includes("node_modules/elliptic/")
          ) {
            return "near-api";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
