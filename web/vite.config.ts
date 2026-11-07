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
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
