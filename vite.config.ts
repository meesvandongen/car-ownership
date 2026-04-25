import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [svelte(), cloudflare()],
  build: {
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});