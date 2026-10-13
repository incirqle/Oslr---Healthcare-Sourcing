import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // The edge-function suites import Deno's std asserts by URL; run them
      // here against a local stand-in (src/test/clinician-engine.test.ts).
      {
        find: /^https:\/\/deno\.land\/std@[\d.]+\/testing\/asserts\.ts$/,
        replacement: path.resolve(__dirname, "./src/test/deno-asserts.ts"),
      },
    ],
  },
});
