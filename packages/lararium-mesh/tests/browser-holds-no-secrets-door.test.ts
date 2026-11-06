/**
 * browser-holds-no-secrets-door — the static witness for the chainless face's premise (operator clarification
 * 2026-11-06, red 1; reach-plane#/cred-onboarding): the store's one door stands on the node vessel, so no browser
 * module exports or routes an onboarding or vault-stand verb, and none stands a secrets registry row.
 *
 *   W1 — every source module under packages/lararium-browser/src reads clean
 *   CONTROL — the scanner catches each planted door: an exported onboarding verb, a routed vault-stand string,
 *             a registry `register`/`initialize` call; and passes the browser's own persona vault (custody, not reach)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { secretsDoorsIn } from "../src/index.js";

const browserSrc = fileURLToPath(new URL("../../lararium-browser/src", import.meta.url));
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

describe("no browser module holds a secrets-store door", () => {
  test("W1 — the browser's sources read clean", () => {
    const files = sources(browserSrc);
    expect(files.length).toBeGreaterThan(10); // a scan over nothing proves nothing
    const doors = files.flatMap((f) => secretsDoorsIn(readFileSync(f, "utf8")).map((d) => `${f}: ${d}`));
    expect(doors).toEqual([]);
  });

  test("CONTROL — each planted door trips the scanner", () => {
    expect(secretsDoorsIn("export async function onboardReachCredential(t: string) {}")).not.toEqual([]);
    expect(secretsDoorsIn("export const standReachVault = () => {};")).not.toEqual([]);
    expect(secretsDoorsIn(`port.post({ verb: "reach-vault:stand" });`)).not.toEqual([]);
    expect(secretsDoorsIn(`route("secrets:onboard", handler);`)).not.toEqual([]);
    expect(secretsDoorsIn("await secretsRegistry.register(docId);")).not.toEqual([]);
    expect(secretsDoorsIn("await faceSecrets.initialize();")).not.toEqual([]);
    expect(secretsDoorsIn("export async function makeBrowserIdbPersonaVault() {}")).toEqual([]);
    expect(secretsDoorsIn("await bagRegistry.register(bag);")).toEqual([]); // a bag registry stands no secrets store
  });
});
