/**
 * `lares vessel rotate` — the place rotates by its founding card, through the door an operator reaches.
 *
 * Proven, on a staged root (the read-back stands in, and `--cold-key` stands in for the terminal):
 *   · POSITIVE: a founding prints the place's card; `vessel rotate` with that card rotates the place to seq 1, and the
 *     replacement card it prints rotates the place again to seq 2, each time seating a replacement signer;
 *   · RED: a card that opens no commitment (the spent one) refuses and moves no byte; a vessel standing refuses first;
 *     a rotation staged and cut short before its publish finishes on the next rotate's reconcile, and the cut-short
 *     card then reads spent. CONTROL: an unrotated place reads its head unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, coldKeySeedFromCode, mintColdKey, mintPlaceRotation, placeSignerFromSeed } from "@lararium/mesh";
import { createServer } from "node:net";
import { loadPlaceKelChain, loadVesselVerifyingKey } from "@lararium/node";
import { cmdVessel } from "../src/commands/vessel.js";
import { larIdentityDir } from "../src/env.js";
import { udsSocketPath } from "../src/local-connector.js";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });
let root: string;
let prior: string | undefined;
let said: string[];
const run = (sub: string, flags: Record<string, true> = {}, options: Record<string, string> = {}) =>
  cmdVessel({ command: "vessel", positional: [sub], options, flags });

/** The card code a printed card carries: its rows of six four-hex groups, joined. */
const printedCode = (): string => {
  const rows = said.join("\n").split("\n").map((l) => l.trim()).filter((l) => /^([0-9a-f]{4}-){5}[0-9a-f]{4}$/.test(l));
  return rows.slice(-3).join("-");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-rotate-door-"));
  prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  writeFileSync(join(root, ".lar-test-scratch"), "");
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
  said = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { said.push(String(chunk)); return true; });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  rmSync(root, { recursive: true, force: true });
});

describe("lares vessel rotate", () => {
  it("rotates twice by the printed cards, refuses a spent card and a standing vessel, and finishes a cut-short stage", async () => {
    expect(await run("found")).toBe(0);                      // prints the place card (non-JSON), read back by the stand-in
    const first = printedCode();
    expect(first).toMatch(/^([0-9a-f]{4}-){17}[0-9a-f]{4}$/);
    expect((await loadPlaceKelChain()).length).toBe(1);      // CONTROL: the unrotated place reads its one inception
    const signer0 = await loadVesselVerifyingKey();

    said.length = 0;
    expect(await run("rotate", {}, { "cold-key": first })).toBe(0);
    const second = printedCode();
    expect(second).not.toBe(first);
    expect((await loadPlaceKelChain()).length).toBe(2);
    const signer1 = await loadVesselVerifyingKey();
    expect(signer1).not.toBe(signer0);

    // RED: the spent card opens no commitment; nothing moves.
    const dir = larIdentityDir();
    const before = readdirSync(dir).map((n) => [n, readFileSync(join(dir, n)).toString("hex")]);
    expect(await run("rotate", {}, { "cold-key": first })).toBe(2);
    expect(readdirSync(dir).map((n) => [n, readFileSync(join(dir, n)).toString("hex")])).toEqual(before);

    // RED: a vessel standing refuses before any card is read.
    const standing = createServer((sock) => { sock.on("data", () => { sock.end(JSON.stringify({ op: "custody", unlocked: true }) + "\n"); }); });
    await new Promise<void>((resolve) => standing.listen(udsSocketPath(), resolve));
    try { expect(await run("rotate", {}, { "cold-key": second })).toBe(2); } finally { await new Promise<void>((resolve) => standing.close(() => resolve())); }
    expect((await loadPlaceKelChain()).length).toBe(2);

    // A rotation staged by the second card and cut short before its publish: the next rotate's reconcile finishes it.
    const chain = await loadPlaceKelChain();
    const next = await mintColdKey();
    const signerSeed = new Uint8Array(32).fill(41);
    const event = mintPlaceRotation({ chain, coldSeed: coldKeySeedFromCode(second), newSignerKey: placeSignerFromSeed(signerSeed).key, nextColdVerifyingKey: next.verifyingKey });
    const keyFile = readdirSync(dir).find((n) => n.startsWith(".vessel-key"))!;
    writeFileSync(join(dir, keyFile.replace(".vessel-key", ".vessel-rotating")),
      canonicalJson({ event, signingKey: Buffer.from(signerSeed).toString("hex"), cardRead: true }));
    expect(await run("rotate", {}, { "cold-key": second })).toBe(2);   // the reconcile lands seq 2; the card it used now reads spent
    expect((await loadPlaceKelChain()).length).toBe(3);
    expect(await loadVesselVerifyingKey()).toBe(event.key);
  });
});
