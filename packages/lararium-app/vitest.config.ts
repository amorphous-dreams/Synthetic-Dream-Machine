import { defineConfig } from "vitest/config";

// The app's own tests stay PURE — the phone-seat render condition and nothing that boots an island.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
