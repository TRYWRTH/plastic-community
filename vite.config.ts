import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// SPA mode: prerender a shell at "/" and write it as dist/client/index.html so
// the build can be deployed as a fully static site (Vercel, Cloudflare Pages, etc.).
// All routes are rendered client-side; the server entry is only used at build time
// to generate the shell.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: {
        outputPath: "/index",
      },
    },
  },
});
